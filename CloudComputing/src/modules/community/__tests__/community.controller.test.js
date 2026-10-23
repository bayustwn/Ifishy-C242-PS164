// unit test community.controller — service dimock, fokus mapping status/message wire
jest.mock('../community.service');

jest.mock('../../../shared/r2', () => {
  const actual = jest.requireActual('../../../shared/r2');
  return { ...actual, verifyUpload: jest.fn(), deleteOwned: jest.fn() };
});

const r2 = require('../../../shared/r2');
const service = require('../community.service');
const controller = require('../community.controller');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const req = (overrides = {}) => ({ user: { id: 9 }, params: {}, body: {}, file: undefined, ...overrides });

beforeEach(() => {
  jest.resetAllMocks();
  r2.verifyUpload.mockResolvedValue({});
  r2.deleteOwned.mockResolvedValue(true);
});

describe('community.controller', () => {
  test('createPost: 201 dengan postId dan imageUrl null ketika tanpa file', async () => {
    service.createPost.mockResolvedValue(77);
    const res = makeRes();

    await controller.createPost(req({ body: { title: 'T', content: 'C' } }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { postId: 77 }, message: 'Post created successfully!' });
    expect(service.createPost).toHaveBeenCalledWith(9, { title: 'T', content: 'C' }, null);
  });

  test('createPost: dengan imageKey valid → key diteruskan', async () => {
    service.createPost.mockResolvedValue(1);
    const res = makeRes();

    await controller.createPost(req({ body: { title: 'T', content: 'C', imageKey: 'posts/9/f.png' } }), res);

    expect(service.createPost).toHaveBeenLastCalledWith(9, { title: 'T', content: 'C' }, 'posts/9/f.png');
  });

  test('createPost: imageKey milik user lain → 400 tanpa memanggil service', async () => {
    const res = makeRes();

    await controller.createPost(req({ body: { title: 'T', content: 'C', imageKey: 'posts/8/f.png' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.createPost).not.toHaveBeenCalled();
  });

  test('createPost: imageKey valid tapi objek tidak ada → 400 tanpa memanggil service', async () => {
    r2.verifyUpload.mockRejectedValue(new Error('not found'));
    const res = makeRes();

    await controller.createPost(req({ body: { title: 'T', content: 'C', imageKey: 'posts/9/f.png' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Upload not found or invalid' } });
    expect(service.createPost).not.toHaveBeenCalled();
  });

  test('createPost: service gagal → 500 Failed to create post', async () => {
    service.createPost.mockRejectedValue(new Error('db'));
    const res = makeRes();

    await controller.createPost(req({ body: { title: 'T', content: 'C' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create post' } });
  });

  test('updatePost: postId non-numeric → 404 tanpa cek db', async () => {
    const res = makeRes();

    await controller.updatePost(req({ params: { postId: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found or you do not have permission to edit this post' } });
    expect(service.findPostByIdAndUser).not.toHaveBeenCalled();
  });

  test('updatePost: bukan pemilik → 404; pemilik → update ke service', async () => {
    service.findPostByIdAndUser.mockResolvedValueOnce(null);
    let res = makeRes();
    await controller.updatePost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);

    service.findPostByIdAndUser.mockResolvedValueOnce({ imageUrl: 'old.png' });
    service.updatePost.mockResolvedValueOnce('ok');
    res = makeRes();
    await controller.updatePost(req({ params: { postId: '5' }, body: { title: 'T', content: 'C' } }), res);

    expect(service.updatePost).toHaveBeenCalledWith(5, 9, { title: 'T', content: 'C' }, 'old.png');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Post updated successfully!' });
  });

  test('updatePost: imageKey baru mengganti imageUrl', async () => {
    service.findPostByIdAndUser.mockResolvedValue({ imageUrl: 'old.png' });
    service.updatePost.mockResolvedValue('ok');
    const res = makeRes();

    await controller.updatePost(
      req({ params: { postId: '5' }, body: { title: 'T', content: 'C', imageKey: 'posts/9/new.png' } }),
      res,
    );

    expect(service.updatePost).toHaveBeenCalledWith(5, 9, { title: 'T', content: 'C' }, 'posts/9/new.png');
  });

  test('updatePost: imageKey null menghapus gambar', async () => {
    service.findPostByIdAndUser.mockResolvedValue({ imageUrl: 'old.png' });
    service.updatePost.mockResolvedValue('ok');
    const res = makeRes();

    await controller.updatePost(req({ params: { postId: '5' }, body: { title: 'T', content: 'C', imageKey: null } }), res);

    expect(service.updatePost).toHaveBeenCalledWith(5, 9, { title: 'T', content: 'C' }, null);
  });

  test('updatePost: gambar R2 lama dihapus setelah update berhasil', async () => {
    service.findPostByIdAndUser.mockResolvedValue({ imageUrl: 'posts/9/old.png' });
    service.updatePost.mockResolvedValue('ok');
    const res = makeRes();

    await controller.updatePost(
      req({ params: { postId: '5' }, body: { title: 'T', content: 'C', imageKey: 'posts/9/new.png' } }),
      res,
    );

    expect(r2.deleteOwned).toHaveBeenCalledWith('posts/9/old.png', 'post', 9);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getPosts dan error path', async () => {
    service.getPosts.mockResolvedValue([{ id: 1 }]);
    let res = makeRes();
    await controller.getPosts(req(), res);
    expect(service.getPosts).toHaveBeenCalledWith(9, {});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });

    service.getPosts.mockRejectedValueOnce(new Error('db'));
    res = makeRes();
    await controller.getPosts(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve posts' } });
  });

  test('getPostById: non-numeric → 404 tanpa db; kosong → 404; ada → 200', async () => {
    let res = makeRes();
    await controller.getPostById(req({ params: { id: 'abc' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } });
    expect(service.getPostById).not.toHaveBeenCalled();

    service.getPostById.mockResolvedValueOnce(null);
    res = makeRes();
    await controller.getPostById(req({ params: { id: '5' } }), res);
    expect(service.getPostById).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(404);

    service.getPostById.mockResolvedValueOnce({ id: 5 });
    res = makeRes();
    await controller.getPostById(req({ params: { id: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 5 } });
  });

  test('addShareToPost: already → 400; baru → 201; error → 500', async () => {
    service.addShareToPost.mockResolvedValueOnce('already_shared');
    let res = makeRes();
    await controller.addShareToPost(req({ params: { postId: '5' } }), res);
    expect(service.addShareToPost).toHaveBeenCalledWith(5, 9);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'ALREADY_SHARED', message: 'You have already shared this post' } });

    service.addShareToPost.mockResolvedValueOnce('ok');
    res = makeRes();
    await controller.addShareToPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Post successfully shared!' });

    service.addShareToPost.mockRejectedValueOnce(new Error('db'));
    res = makeRes();
    await controller.addShareToPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to share post' } });
  });

  test('addComment: postId wajib; content wajib; sukses 201', async () => {
    let res = makeRes();
    await controller.addComment(req({ params: { postId: '' }, body: { content: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Post ID is required' } });

    res = makeRes();
    await controller.addComment(req({ params: { postId: '5' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Content is required' } });

    res = makeRes();
    await controller.addComment(req({ params: { postId: '5' }, body: { content: 'hi' } }), res);
    expect(service.addComment).toHaveBeenCalledWith(5, 9, 'hi');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Comment added successfully!' });
  });

  test('getComments: non-numeric → -1 (dipetakan 200 []); passthrough', async () => {
    service.getComments.mockResolvedValue([{ id: 11 }]);
    let res = makeRes();
    await controller.getComments(req({ params: { postId: 'abc' } }), res);
    expect(service.getComments).toHaveBeenCalledWith(-1, 9, {});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 11 }] });

    res = makeRes();
    await controller.getComments(req({ params: { postId: '5' } }), res);
    expect(service.getComments).toHaveBeenCalledWith(5, 9, {});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 11 }] });
  });

  test('getCommentsById: non-numeric/kosong → 404; ada → 200', async () => {
    service.getCommentsById.mockResolvedValue(null);
    let res = makeRes();
    await controller.getCommentsById(req({ params: { commentId: 'abc' } }), res);
    expect(service.getCommentsById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } });

    res = makeRes();
    await controller.getCommentsById(req({ params: { commentId: '11' } }), res);
    expect(service.getCommentsById).toHaveBeenCalledWith(11, 9);
    expect(res.status).toHaveBeenCalledWith(404);

    service.getCommentsById.mockResolvedValueOnce({ id: 11 });
    res = makeRes();
    await controller.getCommentsById(req({ params: { commentId: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 11 } });
  });

  test('addReplyToComment: content wajib (Reply content is required); sukses 201', async () => {
    let res = makeRes();
    await controller.addReplyToComment(req({ params: { commentId: '11' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reply content is required' } });
    expect(service.addReplyToComment).not.toHaveBeenCalled();

    res = makeRes();
    await controller.addReplyToComment(req({ params: { commentId: '11' }, body: { content: 'r' } }), res);
    expect(service.addReplyToComment).toHaveBeenCalledWith(11, 9, 'r');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Reply added successfully' });
  });

  test('addLikeToComment: already → 400; sukses → 200', async () => {
    service.addLikeToComment.mockResolvedValueOnce('already_liked');
    let res = makeRes();
    await controller.addLikeToComment(req({ params: { commentId: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'ALREADY_LIKED', message: 'You have already liked this comment' } });

    service.addLikeToComment.mockResolvedValueOnce('ok');
    res = makeRes();
    await controller.addLikeToComment(req({ params: { commentId: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Like added to comment successfully' });
  });

  test('removeLikeFromComment: not_liked → 400; sukses → 200', async () => {
    service.removeLikeFromComment.mockResolvedValueOnce('not_liked');
    let res = makeRes();
    await controller.removeLikeFromComment(req({ params: { commentId: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'NOT_LIKED', message: 'You have not liked this comment yet' } });

    service.removeLikeFromComment.mockResolvedValueOnce('ok');
    res = makeRes();
    await controller.removeLikeFromComment(req({ params: { commentId: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Like removed from comment successfully' });
  });

  test('getLikedCommentsByUser: passthrough likedComments', async () => {
    service.getLikedCommentsByUser.mockResolvedValue([{ id: 11 }]);
    const res = makeRes();

    await controller.getLikedCommentsByUser(req(), res);

    expect(service.getLikedCommentsByUser).toHaveBeenCalledWith(9, {});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 11 }] });
  });

  test('addUpvoteToPost: already → 400; sukses → 200; error → 500', async () => {
    service.addUpvoteToPost.mockResolvedValueOnce('already_upvoted');
    let res = makeRes();
    await controller.addUpvoteToPost(req({ params: { postId: '5' } }), res);
    expect(service.addUpvoteToPost).toHaveBeenCalledWith(5, 9);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'ALREADY_UPVOTED', message: 'You have already upvoted this post' } });

    service.addUpvoteToPost.mockResolvedValueOnce('ok');
    res = makeRes();
    await controller.addUpvoteToPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Upvote added successfully' });

    service.addUpvoteToPost.mockRejectedValueOnce(new Error('db'));
    res = makeRes();
    await controller.addUpvoteToPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add upvote' } });
  });

  test('addDownvoteToPost: already → 400; sukses → 200; error → 500', async () => {
    service.addDownvoteToPost.mockResolvedValueOnce('already_downvoted');
    let res = makeRes();
    await controller.addDownvoteToPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'ALREADY_DOWNVOTED', message: 'You have already downvoted this post' } });

    service.addDownvoteToPost.mockResolvedValueOnce('ok');
    res = makeRes();
    await controller.addDownvoteToPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Downvote added successfully' });

    service.addDownvoteToPost.mockRejectedValueOnce(new Error('db'));
    res = makeRes();
    await controller.addDownvoteToPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add downvote' } });
  });

  test('getVoteStatusById: no vote vs vote tersimpan', async () => {
    service.getVoteStatusById.mockResolvedValueOnce('no vote');
    let res = makeRes();
    await controller.getVoteStatusById(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { vote_status: 'no vote' }, message: 'User has not voted yet' });

    service.getVoteStatusById.mockResolvedValueOnce('upvote');
    res = makeRes();
    await controller.getVoteStatusById(req({ params: { postId: '5' } }), res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { vote_status: 'upvote' }, message: 'Vote status retrieved successfully' });
  });

  test('removeUpvoteFromPost: not → 400; sukses → 200', async () => {
    service.removeUpvoteFromPost.mockResolvedValueOnce('not_upvote');
    let res = makeRes();
    await controller.removeUpvoteFromPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'NOT_UPVOTED', message: 'You have not upvoted this post yet' } });

    service.removeUpvoteFromPost.mockResolvedValueOnce('ok');
    res = makeRes();
    await controller.removeUpvoteFromPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Upvote removed from post successfully' });
  });

  test('removeDownvoteFromPost: not → 400; sukses → 200', async () => {
    service.removeDownvoteFromPost.mockResolvedValueOnce('not_downvote');
    let res = makeRes();
    await controller.removeDownvoteFromPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'NOT_DOWNVOTED', message: 'You have not downvoted this post yet' } });

    service.removeDownvoteFromPost.mockResolvedValueOnce('ok');
    res = makeRes();
    await controller.removeDownvoteFromPost(req({ params: { postId: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Downvote removed from post successfully' });
  });
});
