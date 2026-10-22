DELETE pv1 FROM `post_votes` pv1 INNER JOIN `post_votes` pv2 ON pv1.post_id = pv2.post_id AND pv1.user_id = pv2.user_id AND pv1.id > pv2.id;

CREATE UNIQUE INDEX `post_votes_post_id_user_id_key` ON `post_votes`(`post_id`, `user_id`);

DROP INDEX `post_votes_post_id_idx` ON `post_votes`;
DROP INDEX `post_votes_post_id_user_id_idx` ON `post_votes`;

CREATE INDEX `likes_user_id_idx` ON `likes`(`user_id`);
CREATE INDEX `posts_created_at_idx` ON `posts`(`created_at`);
