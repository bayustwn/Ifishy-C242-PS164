// unit test community.service — semua call prisma dimock via @prisma/client factory
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockPrisma = {
  post: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
  postVote: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  share: { groupBy: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
  comment: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  reply: { findMany: jest.fn(), create: jest.fn() },
  like: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  user: { findUnique: jest.fn(), findMany: jest.fn() },
};
const prisma = mockPrisma;
const service = require('../community.service');

const USER_ID = '70000000-0000-4000-8000-000000000009';
const OTHER_USER_ID = '70000000-0000-4000-8000-000000000007';
const USER_2 = '70000000-0000-4000-8000-000000000002';
const USER_3 = '70000000-0000-4000-8000-000000000003';
const POST_ID = '70000000-0000-4000-8000-000000000005';
const POST_ID_2 = '70000000-0000-4000-8000-000000000002';
const POST_ID_3 = '70000000-0000-4000-8000-000000000003';
const NEW_POST_ID = '70000000-0000-4000-8000-000000000077';
const COMMENT_ID = '70000000-0000-4000-8000-000000000011';
const COMMENT_ID_2 = '70000000-0000-4000-8000-000000000012';
const REPLY_ID = '70000000-0000-4000-8000-000000000031';
const REPLY_ID_2 = '70000000-0000-4000-8000-000000000032';
const LIKE_ID = '70000000-0000-4000-8000-000000000005';
const MISSING_ID = '70000000-0000-4000-8000-000000000999';

const MINUTES_AGO = expect.stringMatching(/^-?\d+ minutes ago$/);
const toDate = (s) => new Date(s);

describe('community.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createPost memanggil post.create dengan data lengkap dan mengembalikan id', async () => {
    prisma.post.create.mockResolvedValue({ id: NEW_POST_ID });

    const postId = await service.createPost(USER_ID, { title: 'T', content: 'C' }, 'u.png');

    expect(prisma.post.create).toHaveBeenCalledWith({ data: { userId: USER_ID, title: 'T', content: 'C', imageUrl: 'u.png' } });
    expect(postId).toBe(NEW_POST_ID);
  });

  test('createPost tanpa gambar: imageUrl null', async () => {
    prisma.post.create.mockResolvedValue({ id: POST_ID_2 });
    await service.createPost(USER_ID, { title: 'T', content: 'C' }, null);
    expect(prisma.post.create).toHaveBeenCalledWith({ data: { userId: USER_ID, title: 'T', content: 'C', imageUrl: null } });
  });

  test('updatePost hanya memanggil post.update (ownership dicek controller)', async () => {
    const result = await service.updatePost(POST_ID, USER_ID, { title: 'T2', content: 'C2' }, 'keep.png');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: { title: 'T2', content: 'C2', imageUrl: 'keep.png' },
    });
    expect(result).toBe('ok');
  });

  test('getPosts: agregat vote/share + voteStatus user + comments flat', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T12:00:00Z');
    prisma.post.findMany.mockResolvedValue([
      { id: POST_ID, title: 'T', content: 'C', imageUrl: 'x.png', createdAt: d1, userId: OTHER_USER_ID, user: { username: 'bayu' } },
    ]);
    prisma.postVote.groupBy.mockResolvedValue([
      { postId: POST_ID, voteType: 'upvote', _count: { _all: 2 } },
      { postId: POST_ID, voteType: 'downvote', _count: { _all: 1 } },
    ]);
    prisma.share.groupBy.mockResolvedValue([{ postId: POST_ID, _count: { _all: 3 } }]);
    prisma.postVote.findMany.mockResolvedValue([{ postId: POST_ID, voteType: 'upvote' }]);
    prisma.comment.findMany.mockResolvedValue([
      { id: COMMENT_ID, content: 'hai', createdAt: d2, postId: POST_ID, user: { username: 'budi' } },
    ]);

    const posts = await service.getPosts(USER_ID);

    expect(prisma.postVote.groupBy).toHaveBeenCalledWith({
      by: ['postId', 'voteType'],
      _count: { _all: true },
      where: { postId: { in: [POST_ID] } },
    });
    expect(prisma.share.groupBy).toHaveBeenCalledWith({ by: ['postId'], _count: { _all: true }, where: { postId: { in: [POST_ID] } } });
    expect(prisma.postVote.findMany).toHaveBeenCalledWith({ where: { userId: USER_ID, postId: { in: [POST_ID] } }, select: { postId: true, voteType: true } });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'asc' } }));
    expect(posts).toEqual([
      {
        id: POST_ID, title: 'T', content: 'C', image_url: 'x.png', created_at: d1, user_id: OTHER_USER_ID, username: 'bayu',
        likeCount: 2, shareCount: 3, voteCount: 3, voteStatus: 'upvote',
        comments: [{ id: COMMENT_ID, content: 'hai', created_at: d2, username: 'budi', post_id: POST_ID, timeSinceCommented: MINUTES_AGO }],
        timeSincePosted: MINUTES_AGO,
      },
    ]);
  });

  test('getPosts tanpa post: agregasi dan comments dilewati', async () => {
    prisma.post.findMany.mockResolvedValue([]);

    const posts = await service.getPosts(USER_ID);

    expect(prisma.postVote.groupBy).not.toHaveBeenCalled();
    expect(prisma.share.groupBy).not.toHaveBeenCalled();
    expect(prisma.postVote.findMany).not.toHaveBeenCalled();
    expect(prisma.comment.findMany).not.toHaveBeenCalled();
    expect(posts).toEqual([]);
  });

  test('getPostById: likeCount = upvote, shareCount dari shares', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T12:00:00Z');
    prisma.post.findFirst.mockResolvedValue({
      id: POST_ID_2, title: 'T', content: 'C', imageUrl: null, createdAt: d1, userId: OTHER_USER_ID, user: { username: 'bayu' },
    });
    prisma.comment.findMany.mockResolvedValue([
      { id: COMMENT_ID, content: 'hai', createdAt: d2, user: { username: 'budi' } },
    ]);
    prisma.postVote.count.mockResolvedValue(3);
    prisma.share.count.mockResolvedValue(4);

    const post = await service.getPostById(POST_ID_2);

    expect(prisma.postVote.count).toHaveBeenCalledWith({ where: { postId: POST_ID_2, voteType: 'upvote' } });
    expect(prisma.share.count).toHaveBeenCalledWith({ where: { postId: POST_ID_2 } });
    expect(post).toEqual({
      id: POST_ID_2, title: 'T', content: 'C', image_url: null, created_at: d1, user_id: OTHER_USER_ID, username: 'bayu',
      comments: [{ id: COMMENT_ID, content: 'hai', created_at: d2, username: 'budi', timeSinceCommented: MINUTES_AGO }],
      likeCount: 3, shareCount: 4, timeSincePosted: MINUTES_AGO,
    });
  });

  test('getPostById: post tidak ada → null', async () => {
    prisma.post.findFirst.mockResolvedValue(null);
    expect(await service.getPostById(MISSING_ID)).toBeNull();
  });

  test('addShareToPost: duplikat → already_shared tanpa insert', async () => {
    prisma.share.findFirst.mockResolvedValue({ id: POST_ID_2 });
    expect(await service.addShareToPost(POST_ID, USER_ID)).toBe('already_shared');
    expect(prisma.share.create).not.toHaveBeenCalled();
  });

  test('addShareToPost: baru → insert create', async () => {
    prisma.share.findFirst.mockResolvedValue(null);
    expect(await service.addShareToPost(POST_ID, USER_ID)).toBe('ok');
    expect(prisma.share.create).toHaveBeenCalledWith({ data: { postId: POST_ID, userId: USER_ID } });
  });

  test('addComment memanggil comment.create', async () => {
    await service.addComment(POST_ID, USER_ID, 'x');
    expect(prisma.comment.create).toHaveBeenCalledWith({ data: { postId: POST_ID, userId: USER_ID, content: 'x' } });
  });

  test('getComments: likeCount dari _count.likes, userLiked dari like.findMany, replies nested', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T00:00:00Z');
    const d3 = toDate('2020-01-03T00:00:00Z');
    prisma.comment.findMany.mockResolvedValue([
      { id: COMMENT_ID, content: 'c1', createdAt: d1, userId: USER_2, user: { username: 'budi' }, _count: { likes: 3 } },
      { id: COMMENT_ID_2, content: 'c2', createdAt: d2, userId: USER_3, user: { username: 'cita' }, _count: { likes: 0 } },
    ]);
    prisma.reply.findMany.mockResolvedValue([
      { id: REPLY_ID, content: 'r1', createdAt: d3, parentCommentId: COMMENT_ID, userId: USER_2, user: { username: 'budi' } },
      { id: REPLY_ID_2, content: 'r2', createdAt: d3, parentCommentId: COMMENT_ID_2, userId: USER_3, user: { username: 'cita' } },
    ]);
    prisma.like.findMany.mockResolvedValue([{ commentId: COMMENT_ID_2 }]);
    prisma.user.findMany.mockResolvedValue([
      { id: USER_2, profilePhoto: 'pf.png' },
      { id: USER_3, profilePhoto: 'pf.png' },
    ]);

    const comments = await service.getComments(POST_ID, USER_ID);

    expect(prisma.reply.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { parentCommentId: { in: [COMMENT_ID, COMMENT_ID_2] } } }));
    expect(prisma.like.findMany).toHaveBeenCalledWith({ where: { userId: USER_ID, commentId: { in: [COMMENT_ID, COMMENT_ID_2] } }, select: { commentId: true } });
    expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { id: { in: [USER_2, USER_3] } }, select: { id: true, profilePhoto: true } });
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(comments[0]).toEqual({
      id: COMMENT_ID, content: 'c1', created_at: d1, user_id: USER_2, username: 'budi', profilePicture: 'pf.png',
      timeSinceCommented: MINUTES_AGO, likeCount: 3, userLiked: false,
      replies: [{ id: REPLY_ID, content: 'r1', created_at: d3, username: 'budi', profilePicture: 'pf.png', timeSinceReplied: MINUTES_AGO }],
    });
    expect(comments[1].likeCount).toBe(0);
    expect(comments[1].userLiked).toBe(true);
  });

  test('getCommentsById: nested detail reply dengan likeCount/userLiked per reply', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T00:00:00Z');
    prisma.comment.findFirst.mockResolvedValue({
      id: COMMENT_ID, content: 'c', createdAt: d1, userId: USER_2, user: { username: 'budi' }, _count: { likes: 7 },
    });
    prisma.reply.findMany.mockResolvedValue([
      { id: REPLY_ID, content: 'r', createdAt: d2, parentCommentId: COMMENT_ID, userId: USER_3, user: { username: 'cita' } },
    ]);
    prisma.like.groupBy.mockResolvedValue([{ commentId: REPLY_ID, _count: { _all: 2 } }]);
    prisma.like.findMany.mockResolvedValue([{ commentId: COMMENT_ID }, { commentId: REPLY_ID }]);
    prisma.user.findMany.mockResolvedValue([
      { id: USER_2, profilePhoto: 'pf.png' },
      { id: USER_3, profilePhoto: 'pf.png' },
    ]);

    const comment = await service.getCommentsById(COMMENT_ID, USER_ID);

    expect(prisma.like.groupBy).toHaveBeenCalledWith({ by: ['commentId'], _count: { _all: true }, where: { commentId: { in: [REPLY_ID] } } });
    expect(prisma.like.findMany).toHaveBeenCalledWith({ where: { userId: USER_ID, commentId: { in: [COMMENT_ID, REPLY_ID] } }, select: { commentId: true } });
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(comment).toEqual({
      id: COMMENT_ID, content: 'c', created_at: d1, username: 'budi', profilePicture: 'pf.png',
      timeSinceCommented: MINUTES_AGO, likeCount: 7, userLiked: true,
      replies: [{
        id: REPLY_ID, content: 'r', created_at: d2, username: 'cita', profilePicture: 'pf.png',
        timeSinceReplied: MINUTES_AGO, likeCount: 2, userLiked: true,
      }],
    });
  });

  test('getCommentsById: comment tidak ada → null', async () => {
    prisma.comment.findFirst.mockResolvedValue(null);
    expect(await service.getCommentsById(MISSING_ID, USER_ID)).toBeNull();
  });

  test('addReplyToComment memanggil reply.create', async () => {
    await service.addReplyToComment(COMMENT_ID, USER_ID, 'r');
    expect(prisma.reply.create).toHaveBeenCalledWith({ data: { parentCommentId: COMMENT_ID, userId: USER_ID, content: 'r' } });
  });

  test('addLikeToComment: sudah ada → already_liked; baru → create + increment like_count', async () => {
    prisma.like.findUnique.mockResolvedValueOnce({ id: LIKE_ID });
    expect(await service.addLikeToComment(COMMENT_ID, USER_ID)).toBe('already_liked');
    expect(prisma.like.create).not.toHaveBeenCalled();

    prisma.like.findUnique.mockResolvedValueOnce(null);
    expect(await service.addLikeToComment(COMMENT_ID, USER_ID)).toBe('ok');
    expect(prisma.like.create).toHaveBeenCalledWith({ data: { commentId: COMMENT_ID, userId: USER_ID } });
    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: COMMENT_ID }, data: { likeCount: { increment: 1 } } });
  });

  test('removeLikeFromComment: NaN → not_liked tanpa query; tidak ada → not_liked; ada → delete + decrement', async () => {
    expect(await service.removeLikeFromComment('abc', 9)).toBe('not_liked');
    expect(prisma.like.findUnique).not.toHaveBeenCalled();

    prisma.like.findUnique.mockResolvedValueOnce(null);
    expect(await service.removeLikeFromComment(COMMENT_ID, USER_ID)).toBe('not_liked');

    prisma.like.findUnique.mockResolvedValueOnce({ id: LIKE_ID });
    expect(await service.removeLikeFromComment(COMMENT_ID, USER_ID)).toBe('ok');
    expect(prisma.like.delete).toHaveBeenCalledWith({ where: { id: LIKE_ID } });
    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: COMMENT_ID }, data: { likeCount: { decrement: 1 } } });
  });

  test('getLikedCommentsByUser: orderBy comment.createdAt desc, shape snake_case', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    prisma.like.findMany.mockResolvedValue([
      { comment: { id: COMMENT_ID, content: 'c', createdAt: d1, likeCount: 5, post: { id: POST_ID_3, title: 'PT' } } },
    ]);

    const liked = await service.getLikedCommentsByUser(USER_ID);

    expect(prisma.like.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { comment: { createdAt: 'desc' } } }));
    expect(liked).toEqual([
      { id: COMMENT_ID, content: 'c', created_at: d1, like_count: 5, post_title: 'PT', post_id: POST_ID_3, timeSinceLiked: MINUTES_AGO },
    ]);
  });

  test('addUpvoteToPost: duplikat upvote → 400-ish state; ganti arah → hapus lama + turunkan downvoteCount; baru → insert + increment', async () => {
    prisma.postVote.findFirst.mockResolvedValueOnce({ voteType: 'upvote' });
    expect(await service.addUpvoteToPost(POST_ID, USER_ID)).toBe('already_upvoted');
    expect(prisma.postVote.create).not.toHaveBeenCalled();

    prisma.postVote.findFirst.mockResolvedValueOnce({ voteType: 'downvote' });
    expect(await service.addUpvoteToPost(POST_ID, USER_ID)).toBe('ok');
    expect(prisma.postVote.deleteMany).toHaveBeenCalledWith({ where: { postId: POST_ID, userId: USER_ID } });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: POST_ID }, data: { downvoteCount: { decrement: 1 } } });
    expect(prisma.postVote.create).toHaveBeenCalledWith({ data: { postId: POST_ID, userId: USER_ID, voteType: 'upvote' } });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: POST_ID }, data: { upvoteCount: { increment: 1 } } });

    prisma.postVote.findFirst.mockResolvedValueOnce(null);
    expect(await service.addUpvoteToPost(POST_ID, USER_ID)).toBe('ok');
    expect(prisma.postVote.create).toHaveBeenLastCalledWith({ data: { postId: POST_ID, userId: USER_ID, voteType: 'upvote' } });
  });

  test('addDownvoteToPost: duplikat; switch dari upvote decrement upvoteCount; baru → increment downvoteCount', async () => {
    prisma.postVote.findFirst.mockResolvedValueOnce({ voteType: 'downvote' });
    expect(await service.addDownvoteToPost(POST_ID, USER_ID)).toBe('already_downvoted');

    prisma.postVote.findFirst.mockResolvedValueOnce({ voteType: 'upvote' });
    expect(await service.addDownvoteToPost(POST_ID, USER_ID)).toBe('ok');
    expect(prisma.postVote.deleteMany).toHaveBeenCalledWith({ where: { postId: POST_ID, userId: USER_ID } });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: POST_ID }, data: { upvoteCount: { decrement: 1 } } });
    expect(prisma.postVote.create).toHaveBeenLastCalledWith({ data: { postId: POST_ID, userId: USER_ID, voteType: 'downvote' } });
    expect(prisma.post.update).toHaveBeenLastCalledWith({ where: { id: POST_ID }, data: { downvoteCount: { increment: 1 } } });
  });

  test('getVoteStatusById: vote tersimpan → type; tidak ada atau NaN → no vote', async () => {
    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'downvote' });
    expect(await service.getVoteStatusById(POST_ID, USER_ID)).toBe('downvote');
    expect(prisma.postVote.findFirst).toHaveBeenCalledWith({
      where: { postId: POST_ID, userId: USER_ID },
      select: { voteType: true },
    });

    prisma.postVote.findFirst.mockClear();
    prisma.postVote.findFirst.mockResolvedValue(null);
    expect(await service.getVoteStatusById(POST_ID, USER_ID)).toBe('no vote');

    prisma.postVote.findFirst.mockClear();
    expect(await service.getVoteStatusById('abc', USER_ID)).toBe('no vote');
    expect(prisma.postVote.findFirst).not.toHaveBeenCalled();
  });

  test('removeUpvoteFromPost: NaN/tidak ada/salah tipe → not_upvote; pas → deleteMany + decrement', async () => {
    expect(await service.removeUpvoteFromPost('abc', USER_ID)).toBe('not_upvote');
    expect(prisma.postVote.findFirst).not.toHaveBeenCalled();

    prisma.postVote.findFirst.mockResolvedValue(null);
    expect(await service.removeUpvoteFromPost(POST_ID, USER_ID)).toBe('not_upvote');

    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'downvote' });
    expect(await service.removeUpvoteFromPost(POST_ID, USER_ID)).toBe('not_upvote');

    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'upvote' });
    expect(await service.removeUpvoteFromPost(POST_ID, USER_ID)).toBe('ok');
    expect(prisma.postVote.deleteMany).toHaveBeenCalledWith({ where: { postId: POST_ID, userId: USER_ID } });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: POST_ID }, data: { upvoteCount: { decrement: 1 } } });
  });

  test('removeDownvoteFromPost: mirror removeUpvote', async () => {
    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'upvote' });
    expect(await service.removeDownvoteFromPost(POST_ID, USER_ID)).toBe('not_downvote');

    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'downvote' });
    expect(await service.removeDownvoteFromPost(POST_ID, USER_ID)).toBe('ok');
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: POST_ID }, data: { downvoteCount: { decrement: 1 } } });
  });
});
