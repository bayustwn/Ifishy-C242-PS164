// unit test community.service — semua call prisma dimock via @prisma/client factory
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockPrisma = {
  post: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
  postVote: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  share: { groupBy: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  comment: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  reply: { findMany: jest.fn(), create: jest.fn() },
  like: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), count: jest.fn() },
  user: { findUnique: jest.fn() },
};
const prisma = mockPrisma;
const service = require('../community.service');

const MINUTES_AGO = expect.stringMatching(/^-?\d+ minutes ago$/);
const toDate = (s) => new Date(s);

describe('community.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createPost memanggil post.create dengan data lengkap dan mengembalikan id', async () => {
    prisma.post.create.mockResolvedValue({ id: 77 });

    const postId = await service.createPost(9, { title: 'T', content: 'C' }, 'u.png');

    expect(prisma.post.create).toHaveBeenCalledWith({ data: { userId: 9, title: 'T', content: 'C', imageUrl: 'u.png' } });
    expect(postId).toBe(77);
  });

  test('createPost tanpa gambar: imageUrl null', async () => {
    prisma.post.create.mockResolvedValue({ id: 1 });
    await service.createPost(9, { title: 'T', content: 'C' }, null);
    expect(prisma.post.create).toHaveBeenCalledWith({ data: { userId: 9, title: 'T', content: 'C', imageUrl: null } });
  });

  test('updatePost hanya memanggil post.update (ownership dicek controller)', async () => {
    const result = await service.updatePost(5, 9, { title: 'T2', content: 'C2' }, 'keep.png');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { title: 'T2', content: 'C2', imageUrl: 'keep.png' },
    });
    expect(result).toBe('ok');
  });

  test('getPosts: agregat vote/share + voteStatus user + comments flat', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T12:00:00Z');
    prisma.post.findMany.mockResolvedValue([
      { id: 1, title: 'T', content: 'C', imageUrl: 'x.png', createdAt: d1, userId: 7, user: { username: 'bayu' } },
    ]);
    prisma.postVote.groupBy.mockResolvedValue([
      { postId: 1, voteType: 'upvote', _count: { _all: 2 } },
      { postId: 1, voteType: 'downvote', _count: { _all: 1 } },
    ]);
    prisma.share.groupBy.mockResolvedValue([{ postId: 1, _count: { _all: 3 } }]);
    prisma.postVote.findMany.mockResolvedValue([{ postId: 1, voteType: 'upvote' }]);
    prisma.comment.findMany.mockResolvedValue([
      { id: 11, content: 'hai', createdAt: d2, postId: 1, user: { username: 'budi' } },
    ]);

    const posts = await service.getPosts(9);

    expect(prisma.postVote.groupBy).toHaveBeenCalledWith({
      by: ['postId', 'voteType'],
      _count: { _all: true },
      where: { postId: { in: [1] } },
    });
    expect(prisma.share.groupBy).toHaveBeenCalledWith({ by: ['postId'], _count: { _all: true }, where: { postId: { in: [1] } } });
    expect(prisma.postVote.findMany).toHaveBeenCalledWith({ where: { userId: 9, postId: { in: [1] } }, select: { postId: true, voteType: true } });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'asc' } }));
    expect(posts).toEqual([
      {
        id: 1, title: 'T', content: 'C', image_url: 'x.png', created_at: d1, user_id: 7, username: 'bayu',
        likeCount: 2, shareCount: 3, voteCount: 3, voteStatus: 'upvote',
        comments: [{ id: 11, content: 'hai', created_at: d2, username: 'budi', post_id: 1, timeSinceCommented: MINUTES_AGO }],
        timeSincePosted: MINUTES_AGO,
      },
    ]);
  });

  test('getPosts tanpa post: agregasi dilewati, comments tetap di-query', async () => {
    prisma.post.findMany.mockResolvedValue([]);
    prisma.comment.findMany.mockResolvedValue([]);

    const posts = await service.getPosts(9);

    expect(prisma.postVote.groupBy).not.toHaveBeenCalled();
    expect(prisma.share.groupBy).not.toHaveBeenCalled();
    expect(prisma.postVote.findMany).not.toHaveBeenCalled();
    expect(prisma.comment.findMany).toHaveBeenCalled();
    expect(posts).toEqual([]);
  });

  test('getPostById: likeCount = upvote, shareCount = semua post_votes (perilaku lama dipertahankan)', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T12:00:00Z');
    prisma.post.findFirst.mockResolvedValue({
      id: 2, title: 'T', content: 'C', imageUrl: null, createdAt: d1, userId: 7, user: { username: 'bayu' },
    });
    prisma.comment.findMany.mockResolvedValue([
      { id: 11, content: 'hai', createdAt: d2, user: { username: 'budi' } },
    ]);
    prisma.postVote.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);

    const post = await service.getPostById(2);

    expect(prisma.postVote.count).toHaveBeenNthCalledWith(1, { where: { postId: 2, voteType: 'upvote' } });
    expect(prisma.postVote.count).toHaveBeenNthCalledWith(2, { where: { postId: 2 } });
    expect(post).toEqual({
      id: 2, title: 'T', content: 'C', image_url: null, created_at: d1, user_id: 7, username: 'bayu',
      comments: [{ id: 11, content: 'hai', created_at: d2, username: 'budi', timeSinceCommented: MINUTES_AGO }],
      likeCount: 3, shareCount: 4, timeSincePosted: MINUTES_AGO,
    });
  });

  test('getPostById: post tidak ada → null', async () => {
    prisma.post.findFirst.mockResolvedValue(null);
    expect(await service.getPostById(999)).toBeNull();
  });

  test('addShareToPost: duplikat → already_shared tanpa insert', async () => {
    prisma.share.findFirst.mockResolvedValue({ id: 1 });
    expect(await service.addShareToPost(5, 9)).toBe('already_shared');
    expect(prisma.share.create).not.toHaveBeenCalled();
  });

  test('addShareToPost: baru → insert create', async () => {
    prisma.share.findFirst.mockResolvedValue(null);
    expect(await service.addShareToPost(5, 9)).toBe('ok');
    expect(prisma.share.create).toHaveBeenCalledWith({ data: { postId: 5, userId: 9 } });
  });

  test('addComment memanggil comment.create', async () => {
    await service.addComment(5, 9, 'x');
    expect(prisma.comment.create).toHaveBeenCalledWith({ data: { postId: 5, userId: 9, content: 'x' } });
  });

  test('getComments: likeCount dari _count.likes, userLiked dari like.findMany, replies nested', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T00:00:00Z');
    const d3 = toDate('2020-01-03T00:00:00Z');
    prisma.comment.findMany.mockResolvedValue([
      { id: 11, content: 'c1', createdAt: d1, userId: 2, user: { username: 'budi' }, _count: { likes: 3 } },
      { id: 12, content: 'c2', createdAt: d2, userId: 3, user: { username: 'cita' }, _count: { likes: 0 } },
    ]);
    prisma.reply.findMany.mockResolvedValue([
      { id: 31, content: 'r1', createdAt: d3, parentCommentId: 11, userId: 2, user: { username: 'budi' } },
      { id: 32, content: 'r2', createdAt: d3, parentCommentId: 12, userId: 3, user: { username: 'cita' } },
    ]);
    prisma.like.findMany.mockResolvedValue([{ commentId: 12 }]);
    prisma.user.findUnique.mockResolvedValue({ profilePhoto: 'pf.png' });

    const comments = await service.getComments(5, 9);

    expect(prisma.reply.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { parentCommentId: { in: [11, 12] } } }));
    expect(prisma.like.findMany).toHaveBeenCalledWith({ where: { userId: 9, commentId: { in: [11, 12] } }, select: { commentId: true } });
    expect(comments[0]).toEqual({
      id: 11, content: 'c1', created_at: d1, user_id: 2, username: 'budi', profilePicture: 'pf.png',
      timeSinceCommented: MINUTES_AGO, likeCount: 3, userLiked: false,
      replies: [{ id: 31, content: 'r1', created_at: d3, username: 'budi', profilePicture: 'pf.png', timeSinceReplied: MINUTES_AGO }],
    });
    expect(comments[1].likeCount).toBe(0);
    expect(comments[1].userLiked).toBe(true);
  });

  test('getCommentsById: nested detail reply dengan likeCount/userLiked per reply', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T00:00:00Z');
    prisma.comment.findFirst.mockResolvedValue({
      id: 11, content: 'c', createdAt: d1, userId: 2, user: { username: 'budi' }, _count: { likes: 7 },
    });
    prisma.reply.findMany.mockResolvedValue([
      { id: 31, content: 'r', createdAt: d2, parentCommentId: 11, userId: 3, user: { username: 'cita' } },
    ]);
    prisma.like.count.mockResolvedValue(2);
    prisma.like.findUnique.mockResolvedValue({ id: 1 });
    prisma.user.findUnique.mockResolvedValue({ profilePhoto: 'pf.png' });

    const comment = await service.getCommentsById(11, 9);

    expect(prisma.like.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { commentId_userId: { commentId: 31, userId: 9 } } })
    );
    expect(comment).toEqual({
      id: 11, content: 'c', created_at: d1, username: 'budi', profilePicture: 'pf.png',
      timeSinceCommented: MINUTES_AGO, likeCount: 7, userLiked: true,
      replies: [{
        id: 31, content: 'r', created_at: d2, username: 'cita', profilePicture: 'pf.png',
        timeSinceReplied: MINUTES_AGO, likeCount: 2, userLiked: true,
      }],
    });
  });

  test('getCommentsById: comment tidak ada → null', async () => {
    prisma.comment.findFirst.mockResolvedValue(null);
    expect(await service.getCommentsById(999, 9)).toBeNull();
  });

  test('addReplyToComment memanggil reply.create', async () => {
    await service.addReplyToComment(11, 9, 'r');
    expect(prisma.reply.create).toHaveBeenCalledWith({ data: { parentCommentId: 11, userId: 9, content: 'r' } });
  });

  test('getCommentsWithReplies: like_count snake_case, replies tanpa like detail', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    const d2 = toDate('2020-01-02T00:00:00Z');
    prisma.comment.findMany.mockResolvedValue([
      { id: 11, content: 'c', createdAt: d1, user: { username: 'budi' }, _count: { likes: 4 } },
    ]);
    prisma.reply.findMany.mockResolvedValue([
      { id: 31, content: 'r', createdAt: d2, parentCommentId: 11, user: { username: 'cita' } },
    ]);

    const comments = await service.getCommentsWithReplies(5);

    expect(comments).toEqual([
      {
        id: 11, content: 'c', created_at: d1, username: 'budi', like_count: 4, timeSinceCommented: MINUTES_AGO,
        replies: [{ id: 31, content: 'r', created_at: d2, username: 'cita', timeSinceReplied: MINUTES_AGO }],
      },
    ]);
  });

  test('addLikeToComment: sudah ada → already_liked; baru → create + increment like_count', async () => {
    prisma.like.findUnique.mockResolvedValueOnce({ id: 5 });
    expect(await service.addLikeToComment(11, 9)).toBe('already_liked');
    expect(prisma.like.create).not.toHaveBeenCalled();

    prisma.like.findUnique.mockResolvedValueOnce(null);
    expect(await service.addLikeToComment(11, 9)).toBe('ok');
    expect(prisma.like.create).toHaveBeenCalledWith({ data: { commentId: 11, userId: 9 } });
    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { likeCount: { increment: 1 } } });
  });

  test('removeLikeFromComment: NaN → not_liked tanpa query; tidak ada → not_liked; ada → delete + decrement', async () => {
    expect(await service.removeLikeFromComment('abc', 9)).toBe('not_liked');
    expect(prisma.like.findUnique).not.toHaveBeenCalled();

    prisma.like.findUnique.mockResolvedValueOnce(null);
    expect(await service.removeLikeFromComment(11, 9)).toBe('not_liked');

    prisma.like.findUnique.mockResolvedValueOnce({ id: 5 });
    expect(await service.removeLikeFromComment(11, 9)).toBe('ok');
    expect(prisma.like.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { likeCount: { decrement: 1 } } });
  });

  test('getLikedCommentsByUser: orderBy comment.createdAt desc, shape snake_case', async () => {
    const d1 = toDate('2020-01-01T00:00:00Z');
    prisma.like.findMany.mockResolvedValue([
      { comment: { id: 11, content: 'c', createdAt: d1, likeCount: 5, post: { id: 3, title: 'PT' } } },
    ]);

    const liked = await service.getLikedCommentsByUser(9);

    expect(prisma.like.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { comment: { createdAt: 'desc' } } }));
    expect(liked).toEqual([
      { id: 11, content: 'c', created_at: d1, like_count: 5, post_title: 'PT', post_id: 3, timeSinceLiked: MINUTES_AGO },
    ]);
  });

  test('addUpvoteToPost: duplikat upvote → 400-ish state; ganti arah → hapus lama; baru → insert + increment', async () => {
    prisma.postVote.findFirst.mockResolvedValueOnce({ voteType: 'upvote' });
    expect(await service.addUpvoteToPost(5, 9)).toBe('already_upvoted');
    expect(prisma.postVote.create).not.toHaveBeenCalled();

    prisma.postVote.findFirst.mockResolvedValueOnce({ voteType: 'downvote' });
    expect(await service.addUpvoteToPost(5, 9)).toBe('ok');
    expect(prisma.postVote.deleteMany).toHaveBeenCalledWith({ where: { postId: 5, userId: 9 } });
    expect(prisma.postVote.create).toHaveBeenCalledWith({ data: { postId: 5, userId: 9, voteType: 'upvote' } });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { upvoteCount: { increment: 1 } } });

    prisma.postVote.findFirst.mockResolvedValueOnce(null);
    expect(await service.addUpvoteToPost(5, 9)).toBe('ok');
    expect(prisma.postVote.create).toHaveBeenLastCalledWith({ data: { postId: 5, userId: 9, voteType: 'upvote' } });
  });

  test('addDownvoteToPost: duplikat; switch dari upvote decrement upvoteCount; baru → increment downvoteCount', async () => {
    prisma.postVote.findFirst.mockResolvedValueOnce({ voteType: 'downvote' });
    expect(await service.addDownvoteToPost(5, 9)).toBe('already_downvoted');

    prisma.postVote.findFirst.mockResolvedValueOnce({ voteType: 'upvote' });
    expect(await service.addDownvoteToPost(5, 9)).toBe('ok');
    expect(prisma.postVote.deleteMany).toHaveBeenCalledWith({ where: { postId: 5, userId: 9 } });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { upvoteCount: { decrement: 1 } } });
    expect(prisma.postVote.create).toHaveBeenLastCalledWith({ data: { postId: 5, userId: 9, voteType: 'downvote' } });
    expect(prisma.post.update).toHaveBeenLastCalledWith({ where: { id: 5 }, data: { downvoteCount: { increment: 1 } } });
  });

  test('getVoteStatusById: vote tersimpan → type; tidak ada atau NaN → no vote', async () => {
    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'downvote' });
    expect(await service.getVoteStatusById(5, 9)).toBe('downvote');
    expect(prisma.postVote.findFirst).toHaveBeenCalledWith({
      where: { postId: 5, userId: 9 },
      select: { voteType: true },
    });

    prisma.postVote.findFirst.mockClear();
    prisma.postVote.findFirst.mockResolvedValue(null);
    expect(await service.getVoteStatusById(5, 9)).toBe('no vote');

    prisma.postVote.findFirst.mockClear();
    expect(await service.getVoteStatusById('abc', 9)).toBe('no vote');
    expect(prisma.postVote.findFirst).not.toHaveBeenCalled();
  });

  test('removeUpvoteFromPost: NaN/tidak ada/salah tipe → not_upvote; pas → deleteMany + decrement', async () => {
    expect(await service.removeUpvoteFromPost('abc', 9)).toBe('not_upvote');
    expect(prisma.postVote.findFirst).not.toHaveBeenCalled();

    prisma.postVote.findFirst.mockResolvedValue(null);
    expect(await service.removeUpvoteFromPost(5, 9)).toBe('not_upvote');

    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'downvote' });
    expect(await service.removeUpvoteFromPost(5, 9)).toBe('not_upvote');

    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'upvote' });
    expect(await service.removeUpvoteFromPost(5, 9)).toBe('ok');
    expect(prisma.postVote.deleteMany).toHaveBeenCalledWith({ where: { postId: 5, userId: 9 } });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { upvoteCount: { decrement: 1 } } });
  });

  test('removeDownvoteFromPost: mirror removeUpvote', async () => {
    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'upvote' });
    expect(await service.removeDownvoteFromPost(5, 9)).toBe('not_downvote');

    prisma.postVote.findFirst.mockResolvedValue({ voteType: 'downvote' });
    expect(await service.removeDownvoteFromPost(5, 9)).toBe('ok');
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { downvoteCount: { decrement: 1 } } });
  });
});
