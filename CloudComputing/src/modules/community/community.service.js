const prisma = require('../../shared/prisma');
const logger = require('../../shared/logger');
const { publicUrl } = require('../../shared/r2');
const { sliceArgs } = require('../../shared/pagination');

const minutesAgo = (createdAt) => {
  const minutes = Math.floor((Date.now() - new Date(createdAt)) / 60000);
  return `${isNaN(minutes) ? 0 : minutes} minutes ago`;
};

const profilePictures = async (userIds) => {
  const uniqueIds = [...new Set(userIds)];
  try {
    const rows = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, profilePhoto: true },
    });
    const pictureMap = new Map();
    for (const row of rows) pictureMap.set(row.id, publicUrl(row.profilePhoto) || '');
    return pictureMap;
  } catch (error) {
    logger.error({ err: error }, 'Error getting profile pictures from database');
    return new Map();
  }
};

const createPost = async (userId, { title, content }, imageUrl = null) => {
  const created = await prisma.post.create({
    data: { userId, title, content, imageUrl },
  });
  return created.id;
};

const findPostByIdAndUser = (postId, userId) =>
  prisma.post.findFirst({ where: { id: postId, userId } });

const updatePost = async (postId, userId, { title, content }, imageUrl) => {
  await prisma.post.update({
    where: { id: postId },
    data: { title: title ?? null, content: content ?? null, imageUrl },
  });
  return 'ok';
};

const POST_SELECT = {
  id: true,
  title: true,
  content: true,
  imageUrl: true,
  createdAt: true,
  userId: true,
  user: { select: { username: true } },
};

const toPostCore = (p) => ({
  id: p.id,
  title: p.title,
  content: p.content,
  image_url: publicUrl(p.imageUrl),
  created_at: p.createdAt,
  user_id: p.userId,
  username: p.user.username,
});

const aggregateVotes = (voteGroups) => {
  const likeCounts = {};
  const voteCounts = {};
  for (const group of voteGroups) {
    const n = Number(group._count._all);
    voteCounts[group.postId] = (voteCounts[group.postId] ?? 0) + n;
    if (group.voteType === 'upvote') likeCounts[group.postId] = n;
  }
  return { likeCounts, voteCounts };
};

const getPosts = async (userId, opts = {}) => {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    select: POST_SELECT,
    ...sliceArgs(opts),
  });

  const postIds = posts.map((p) => p.id);
  if (postIds.length === 0) return [];

  const voteGroups = postIds.length
    ? await prisma.postVote.groupBy({ by: ['postId', 'voteType'], _count: { _all: true }, where: { postId: { in: postIds } } })
    : [];
  const shareGroups = postIds.length
    ? await prisma.share.groupBy({ by: ['postId'], _count: { _all: true }, where: { postId: { in: postIds } } })
    : [];
  const myVotes = postIds.length
    ? await prisma.postVote.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true, voteType: true } })
    : [];

  const { likeCounts, voteCounts } = aggregateVotes(voteGroups);
  const shareCounts = {};
  for (const group of shareGroups) shareCounts[group.postId] = Number(group._count._all);
  const myVoteStatus = {};
  for (const vote of myVotes) myVoteStatus[vote.postId] = vote.voteType;

  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: 'asc' },
    where: { postId: { in: postIds } },
    select: { id: true, content: true, createdAt: true, postId: true, user: { select: { username: true } } },
  });
  const commentsByPost = {};
  for (const c of comments) {
    (commentsByPost[c.postId] ??= []).push({
      id: c.id,
      content: c.content,
      created_at: c.createdAt,
      username: c.user.username,
      post_id: c.postId,
      timeSinceCommented: minutesAgo(c.createdAt),
    });
  }

  return posts.map((p) => ({
    ...toPostCore(p),
    likeCount: likeCounts[p.id] ?? 0,
    shareCount: shareCounts[p.id] ?? 0,
    voteCount: voteCounts[p.id] ?? 0,
    voteStatus: myVoteStatus[p.id] ?? null,
    comments: commentsByPost[p.id] ?? [],
    timeSincePosted: minutesAgo(p.createdAt),
  }));
};

const getPostById = async (postId) => {
  const post = await prisma.post.findFirst({
    where: { id: postId },
    select: POST_SELECT,
  });
  if (!post) return null;

  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, content: true, createdAt: true, user: { select: { username: true } } },
  });

  const likeCount = await prisma.postVote.count({ where: { postId, voteType: 'upvote' } });
  const shareCount = await prisma.share.count({ where: { postId } });

  return {
    ...toPostCore(post),
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.createdAt,
      username: c.user.username,
      timeSinceCommented: minutesAgo(c.createdAt),
    })),
    likeCount,
    shareCount,
    timeSincePosted: minutesAgo(post.createdAt),
  };
};

const addShareToPost = async (postId, userId) => {
  const existingShare = await prisma.share.findFirst({ where: { postId, userId } });
  if (existingShare) return 'already_shared';

  await prisma.share.create({ data: { postId, userId } });
  return 'ok';
};

const addComment = async (postId, userId, content) => {
  await prisma.comment.create({ data: { postId, userId, content } });
  return 'ok';
};

const toReplyShape = (r) => ({
  id: r.id,
  content: r.content,
  created_at: r.createdAt,
  username: r.user.username,
});

const getComments = async (postId, userId, opts = {}) => {
  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, content: true, createdAt: true, userId: true, user: { select: { username: true } },
      _count: { select: { likes: true } },
    },
    ...sliceArgs(opts),
  });

  const commentIds = comments.map((c) => c.id);
  const replies = commentIds.length
    ? await prisma.reply.findMany({
        where: { parentCommentId: { in: commentIds } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, content: true, createdAt: true, parentCommentId: true, userId: true, user: { select: { username: true } } },
      })
    : [];

  const myLikes = commentIds.length
    ? await prisma.like.findMany({ where: { userId, commentId: { in: commentIds } }, select: { commentId: true } })
    : [];
  const likedSet = new Set(myLikes.map((l) => l.commentId));

  const pictureMap = await profilePictures([
    ...comments.map((c) => c.userId),
    ...replies.map((r) => r.userId),
  ]);

  const repliesByComment = {};
  for (const reply of replies) {
    (repliesByComment[reply.parentCommentId] ??= []).push({
      ...toReplyShape(reply),
      profilePicture: pictureMap.get(reply.userId) ?? '',
      timeSinceReplied: minutesAgo(reply.createdAt),
    });
  }

  return comments.map((c) => ({
    id: c.id,
    content: c.content,
    created_at: c.createdAt,
    user_id: c.userId,
    username: c.user.username,
    profilePicture: pictureMap.get(c.userId) ?? '',
    timeSinceCommented: minutesAgo(c.createdAt),
    likeCount: Number(c._count.likes),
    userLiked: likedSet.has(c.id),
    replies: repliesByComment[c.id] ?? [],
  }));
};

const getCommentsById = async (commentId, userId) => {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId },
    select: {
      id: true, content: true, createdAt: true, userId: true, user: { select: { username: true } },
      _count: { select: { likes: true } },
    },
  });
  if (!comment) return null;

  const replies = await prisma.reply.findMany({
    where: { parentCommentId: commentId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, content: true, createdAt: true, userId: true, user: { select: { username: true } } },
  });

  const replyIds = replies.map((r) => r.id);
  const countGroups = replyIds.length
    ? await prisma.like.groupBy({ by: ['commentId'], _count: { _all: true }, where: { commentId: { in: replyIds } } })
    : [];
  const replyLikeCounts = new Map();
  for (const group of countGroups) replyLikeCounts.set(group.commentId, Number(group._count._all));

  const myLikes = await prisma.like.findMany({
    where: { userId, commentId: { in: [commentId, ...replyIds] } },
    select: { commentId: true },
  });
  const likedSet = new Set(myLikes.map((l) => l.commentId));

  const pictureMap = await profilePictures([comment.userId, ...replies.map((r) => r.userId)]);

  return {
    id: comment.id,
    content: comment.content,
    created_at: comment.createdAt,
    username: comment.user.username,
    profilePicture: pictureMap.get(comment.userId) ?? '',
    timeSinceCommented: minutesAgo(comment.createdAt),
    likeCount: Number(comment._count.likes),
    userLiked: likedSet.has(comment.id),
    replies: replies.map((reply) => ({
      ...toReplyShape(reply),
      profilePicture: pictureMap.get(reply.userId) ?? '',
      timeSinceReplied: minutesAgo(reply.createdAt),
      likeCount: replyLikeCounts.get(reply.id) ?? 0,
      userLiked: likedSet.has(reply.id),
    })),
  };
};

const addReplyToComment = async (commentId, userId, content) => {
  await prisma.reply.create({ data: { parentCommentId: commentId, userId, content } });
  return 'ok';
};

const addLikeToComment = async (commentId, userId) => {
  const existingLike = await prisma.like.findUnique({
    where: { commentId_userId: { commentId, userId } },
    select: { id: true },
  });
  if (existingLike) return 'already_liked';

  await prisma.like.create({ data: { commentId, userId } });
  await prisma.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
  return 'ok';
};

const removeLikeFromComment = async (commentId, userId) => {
  if (Number.isNaN(Number(commentId))) return 'not_liked';
  const existingLike = await prisma.like.findUnique({
    where: { commentId_userId: { commentId, userId } },
    select: { id: true },
  });
  if (!existingLike) return 'not_liked';

  await prisma.like.delete({ where: { id: existingLike.id } });
  await prisma.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } });
  return 'ok';
};

const getLikedCommentsByUser = async (userId, opts = {}) => {
  const rows = await prisma.like.findMany({
    where: { userId },
    orderBy: { comment: { createdAt: 'desc' } },
    ...sliceArgs(opts),
    select: {
      comment: {
        select: {
          id: true, content: true, createdAt: true, likeCount: true,
          post: { select: { id: true, title: true } },
        },
      },
    },
  });

  return rows.map(({ comment }) => ({
    id: comment.id,
    content: comment.content,
    created_at: comment.createdAt,
    like_count: comment.likeCount,
    post_title: comment.post.title,
    post_id: comment.post.id,
    timeSinceLiked: minutesAgo(comment.createdAt),
  }));
};

const findVote = (postId, userId) =>
  prisma.postVote.findFirst({
    where: { postId, userId },
    select: { voteType: true },
  });

const addUpvoteToPost = async (postId, userId) => {
  const existingVote = await findVote(postId, userId);
  if (existingVote?.voteType === 'upvote') return 'already_upvoted';
  if (existingVote?.voteType === 'downvote') {
    await prisma.postVote.deleteMany({ where: { postId, userId } });
    await prisma.post.update({ where: { id: postId }, data: { downvoteCount: { decrement: 1 } } });
  }

  await prisma.postVote.create({ data: { postId, userId, voteType: 'upvote' } });
  await prisma.post.update({ where: { id: postId }, data: { upvoteCount: { increment: 1 } } });
  return 'ok';
};

const addDownvoteToPost = async (postId, userId) => {
  const existingVote = await findVote(postId, userId);
  if (existingVote?.voteType === 'downvote') return 'already_downvoted';
  if (existingVote?.voteType === 'upvote') {
    await prisma.postVote.deleteMany({ where: { postId, userId } });
    await prisma.post.update({ where: { id: postId }, data: { upvoteCount: { decrement: 1 } } });
  }

  await prisma.postVote.create({ data: { postId, userId, voteType: 'downvote' } });
  await prisma.post.update({ where: { id: postId }, data: { downvoteCount: { increment: 1 } } });
  return 'ok';
};

const getVoteStatusById = async (postId, userId) => {
  if (Number.isNaN(Number(postId))) return 'no vote';
  const existingVote = await findVote(postId, userId);
  return existingVote ? existingVote.voteType : 'no vote';
};

const removeVoteFromPost = async (postId, userId, type) => {
  if (Number.isNaN(Number(postId))) return `not_${type}`;
  const existingVote = await findVote(postId, userId);
  if (!existingVote || existingVote.voteType !== type) return `not_${type}`;

  await prisma.postVote.deleteMany({ where: { postId, userId } });
  const column = type === 'upvote' ? { upvoteCount: { decrement: 1 } } : { downvoteCount: { decrement: 1 } };
  await prisma.post.update({ where: { id: postId }, data: column });
  return 'ok';
};

module.exports = {
  createPost,
  findPostByIdAndUser,
  updatePost,
  getPosts,
  getPostById,
  addShareToPost,
  addComment,
  getComments,
  getCommentsById,
  addReplyToComment,
  addLikeToComment,
  removeLikeFromComment,
  getLikedCommentsByUser,
  addUpvoteToPost,
  addDownvoteToPost,
  getVoteStatusById,
  removeUpvoteFromPost: (postId, userId) => removeVoteFromPost(postId, userId, 'upvote'),
  removeDownvoteFromPost: (postId, userId) => removeVoteFromPost(postId, userId, 'downvote'),
};
