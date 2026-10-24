const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = '';
process.env.CORS_ORIGINS = '';
process.env.LOG_LEVEL = 'silent';

const app = require('../app');
const prisma = require('../shared/prisma');

let server;
let baseUrl;
let userId;
let token;
let postId;
let commentId;

const email = `integration-${Date.now()}@ifishy.test`;
const username = `integration_${Date.now()}`;
const password = 'password123';

const request = async (method, urlPath, { auth, body, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data, headers: response.headers };
};

beforeAll(async () => {
  await prisma.$connect();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (userId) {
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: '@ifishy.test' } } }).catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

describe('API integration', () => {
  test('health endpoint is reachable', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Ifihsy');
  });

  test('browser origins are denied when CORS_ORIGINS is empty', async () => {
    const response = await fetch(`${baseUrl}/`, { headers: { Origin: 'https://evil.example' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('registration rejects invalid email and weak password', async () => {
    const invalidEmail = await request('POST', '/api/auth/register', {
      body: { username, email: 'not-an-email', password, confirmPassword: password },
    });
    expect(invalidEmail.status).toBe(400);
    expect(invalidEmail.data.error.code).toBe('VALIDATION_ERROR');

    const weakPassword = await request('POST', '/api/auth/register', {
      body: { username, email, password: 'short', confirmPassword: 'short' },
    });
    expect(weakPassword.status).toBe(400);
    expect(weakPassword.data.error.message).toBe('Password must be at least 8 characters');
  });

  test('register, login, and unknown login is generic 401', async () => {
    const registered = await request('POST', '/api/auth/register', {
      body: { username, email, password, confirmPassword: password },
    });
    expect(registered.status).toBe(201);
    expect(registered.data.data.id).toMatch(/^[0-9a-f-]{36}$/i);
    userId = registered.data.data.id;

    const loggedIn = await request('POST', '/api/auth/login', { body: { email, password } });
    expect(loggedIn.status).toBe(200);
    token = loggedIn.data.data.token;
    expect(typeof token).toBe('string');

    const unknown = await request('POST', '/api/auth/login', {
      body: { email: 'missing@ifishy.test', password },
    });
    expect(unknown.status).toBe(401);
    expect(unknown.data.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.data.error.message).toBe('Invalid credentials');
  });

  test('seeded articles are returned with UUID ids and default pagination', async () => {
    const response = await request('GET', '/api/articles');
    expect(response.status).toBe(200);
    expect(response.data.data.length).toBeLessThanOrEqual(10);
    expect(response.data.data.length).toBeGreaterThan(0);
    expect(response.data.data[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('scraping endpoint is removed', async () => {
    const response = await request('GET', '/api/article/scrape/example.com', { auth: token });
    expect(response.status).toBe(404);
  });

  test('post validation returns 400 instead of 500', async () => {
    const response = await request('POST', '/api/community/posts', {
      auth: token,
      body: { title: 123, content: 'body' },
    });
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
  });

  test('list endpoints default to 10 items and cap at 100', async () => {
    const created = [];
    for (let index = 0; index < 12; index += 1) {
      const response = await request('POST', '/api/community/posts', {
        auth: token,
        body: { title: `Post ${index}`, content: `Content ${index}` },
      });
      expect(response.status).toBe(201);
      created.push(response.data.data.postId);
    }
    postId = created[created.length - 1];

    const firstPage = await request('GET', '/api/community/posts', { auth: token });
    expect(firstPage.status).toBe(200);
    expect(firstPage.data.data).toHaveLength(10);

    const all = await request('GET', '/api/community/posts?limit=100', { auth: token });
    expect(all.status).toBe(200);
    expect(all.data.data).toHaveLength(12);

    const invalid = await request('GET', '/api/community/posts?limit=200', { auth: token });
    expect(invalid.status).toBe(200);
    expect(invalid.data.data).toHaveLength(10);
  });

  test('comment like is idempotent and count follows likes', async () => {
    const comment = await request('POST', `/api/community/posts/${postId}/comments`, {
      auth: token,
      body: { content: 'integration comment' },
    });
    expect(comment.status).toBe(201);

    const comments = await request('GET', `/api/community/posts/${postId}/comments`, { auth: token });
    expect(comments.status).toBe(200);
    commentId = comments.data.data[0].id;

    const like = await request('POST', `/api/comments/${commentId}/like`, { auth: token });
    expect(like.status).toBe(200);

    const duplicate = await request('POST', `/api/comments/${commentId}/like`, { auth: token });
    expect(duplicate.status).toBe(400);
    expect(duplicate.data.error.code).toBe('ALREADY_LIKED');

    const likedComments = await request('GET', `/api/community/posts/${postId}/comments`, { auth: token });
    expect(likedComments.data.data[0].likeCount).toBe(1);

    const unlike = await request('DELETE', `/api/comments/${commentId}/like`, { auth: token });
    expect(unlike.status).toBe(200);

    const unlikedComments = await request('GET', `/api/community/posts/${postId}/comments`, { auth: token });
    expect(unlikedComments.data.data[0].likeCount).toBe(0);
  });

  test('concurrent votes do not create duplicates', async () => {
    const [first, second] = await Promise.all([
      request('POST', `/api/community/posts/${postId}/upvote`, { auth: token }),
      request('POST', `/api/community/posts/${postId}/upvote`, { auth: token }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);

    const votes = await prisma.postVote.count({ where: { postId, userId } });
    expect(votes).toBe(1);

    const removed = await request('DELETE', `/api/community/posts/${postId}/upvote`, { auth: token });
    expect(removed.status).toBe(200);

    const status = await request('GET', `/api/community/posts/${postId}/vote-status`, { auth: token });
    expect(status.data.data.vote_status).toBe('no vote');
  });

  test('shares and bookmark toggles are consistent', async () => {
    const share = await request('POST', `/api/community/posts/${postId}/share`, { auth: token });
    expect(share.status).toBe(201);

    const duplicateShare = await request('POST', `/api/community/posts/${postId}/share`, { auth: token });
    expect(duplicateShare.status).toBe(400);
    expect(duplicateShare.data.error.code).toBe('ALREADY_SHARED');

    const bookmark = await request('POST', '/api/bookmark', {
      auth: token,
      body: { itemId: postId, type: 'post' },
    });
    expect(bookmark.status).toBe(201);

    const bookmarks = await request('GET', '/api/bookmarks', { auth: token });
    expect(bookmarks.data.data).toHaveLength(1);

    const removed = await request('POST', '/api/bookmark', {
      auth: token,
      body: { itemId: postId, type: 'post' },
    });
    expect(removed.status).toBe(200);

    const empty = await request('GET', '/api/bookmarks', { auth: token });
    expect(empty.data.data).toHaveLength(0);
  });

  test('account deletion removes the user and invalidates login', async () => {
    const deleted = await request('DELETE', '/api/auth/delete', { auth: token });
    expect(deleted.status).toBe(200);

    const login = await request('POST', '/api/auth/login', { body: { email, password } });
    expect(login.status).toBe(401);

    const remaining = await prisma.user.count({ where: { id: userId } });
    expect(remaining).toBe(0);
    userId = null;
  });
});
