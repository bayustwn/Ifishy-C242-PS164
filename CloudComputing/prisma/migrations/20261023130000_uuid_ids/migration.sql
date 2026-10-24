-- Convert every primary and foreign key from INT AUTO_INCREMENT to UUID (CHAR(36)).
-- UUID mappings are created before the columns change so existing rows and
-- relationships are preserved; article IDs are converted too.

CREATE TABLE `_uuid_map_users` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_posts` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_comments` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_replies` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_likes` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_post_votes` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_shares` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_articles` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_bookmarks` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));
CREATE TABLE `_uuid_map_scan_history` (`old_id` INT NOT NULL, `new_id` CHAR(36) NOT NULL, PRIMARY KEY (`old_id`));

INSERT INTO `_uuid_map_users` SELECT `id`, UUID() FROM `users`;
INSERT INTO `_uuid_map_posts` SELECT `id`, UUID() FROM `posts`;
INSERT INTO `_uuid_map_comments` SELECT `id`, UUID() FROM `comments`;
INSERT INTO `_uuid_map_replies` SELECT `id`, UUID() FROM `replies`;
INSERT INTO `_uuid_map_likes` SELECT `id`, UUID() FROM `likes`;
INSERT INTO `_uuid_map_post_votes` SELECT `id`, UUID() FROM `post_votes`;
INSERT INTO `_uuid_map_shares` SELECT `id`, UUID() FROM `shares`;
INSERT INTO `_uuid_map_articles` SELECT `id`, UUID() FROM `articles`;
INSERT INTO `_uuid_map_bookmarks` SELECT `id`, UUID() FROM `bookmarks`;
INSERT INTO `_uuid_map_scan_history` SELECT `id`, UUID() FROM `scan_history`;

ALTER TABLE `bookmarks` DROP FOREIGN KEY `bookmarks_user_id_fkey`;
ALTER TABLE `comments` DROP FOREIGN KEY `comments_post_id_fkey`;
ALTER TABLE `comments` DROP FOREIGN KEY `comments_user_id_fkey`;
ALTER TABLE `likes` DROP FOREIGN KEY `likes_comment_id_fkey`;
ALTER TABLE `likes` DROP FOREIGN KEY `likes_user_id_fkey`;
ALTER TABLE `post_votes` DROP FOREIGN KEY `post_votes_post_id_fkey`;
ALTER TABLE `post_votes` DROP FOREIGN KEY `post_votes_user_id_fkey`;
ALTER TABLE `posts` DROP FOREIGN KEY `posts_user_id_fkey`;
ALTER TABLE `replies` DROP FOREIGN KEY `replies_parent_comment_id_fkey`;
ALTER TABLE `replies` DROP FOREIGN KEY `replies_user_id_fkey`;
ALTER TABLE `scan_history` DROP FOREIGN KEY `scan_history_user_id_fkey`;
ALTER TABLE `shares` DROP FOREIGN KEY `shares_post_id_fkey`;
ALTER TABLE `shares` DROP FOREIGN KEY `shares_user_id_fkey`;

ALTER TABLE `users` ADD COLUMN `new_id` CHAR(36) NULL;
UPDATE `users` u JOIN `_uuid_map_users` m ON m.`old_id` = u.`id` SET u.`new_id` = m.`new_id`;
ALTER TABLE `users` DROP PRIMARY KEY, DROP COLUMN `id`;
ALTER TABLE `users` CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL, ADD PRIMARY KEY (`id`);

ALTER TABLE `articles` ADD COLUMN `new_id` CHAR(36) NULL;
UPDATE `articles` a JOIN `_uuid_map_articles` m ON m.`old_id` = a.`id` SET a.`new_id` = m.`new_id`;
ALTER TABLE `articles` DROP PRIMARY KEY, DROP COLUMN `id`;
ALTER TABLE `articles` CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL, ADD PRIMARY KEY (`id`);

ALTER TABLE `posts` ADD COLUMN `new_id` CHAR(36) NULL, ADD COLUMN `new_user_id` CHAR(36) NULL;
UPDATE `posts` p JOIN `_uuid_map_posts` m ON m.`old_id` = p.`id` SET p.`new_id` = m.`new_id`;
UPDATE `posts` p JOIN `_uuid_map_users` m ON m.`old_id` = p.`user_id` SET p.`new_user_id` = m.`new_id`;
ALTER TABLE `posts` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `user_id`;
ALTER TABLE `posts`
  CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_user_id` `user_id` CHAR(36) NOT NULL,
  ADD PRIMARY KEY (`id`);
CREATE INDEX `posts_user_id_idx` ON `posts` (`user_id`);

ALTER TABLE `comments` ADD COLUMN `new_id` CHAR(36) NULL, ADD COLUMN `new_post_id` CHAR(36) NULL, ADD COLUMN `new_user_id` CHAR(36) NULL;
UPDATE `comments` c JOIN `_uuid_map_comments` m ON m.`old_id` = c.`id` SET c.`new_id` = m.`new_id`;
UPDATE `comments` c JOIN `_uuid_map_posts` m ON m.`old_id` = c.`post_id` SET c.`new_post_id` = m.`new_id`;
UPDATE `comments` c JOIN `_uuid_map_users` m ON m.`old_id` = c.`user_id` SET c.`new_user_id` = m.`new_id`;
ALTER TABLE `comments` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `post_id`, DROP COLUMN `user_id`;
ALTER TABLE `comments`
  CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_post_id` `post_id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_user_id` `user_id` CHAR(36) NOT NULL,
  ADD PRIMARY KEY (`id`);
CREATE INDEX `comments_post_id_idx` ON `comments` (`post_id`);

ALTER TABLE `replies` ADD COLUMN `new_id` CHAR(36) NULL, ADD COLUMN `new_parent_comment_id` CHAR(36) NULL, ADD COLUMN `new_user_id` CHAR(36) NULL;
UPDATE `replies` r JOIN `_uuid_map_replies` m ON m.`old_id` = r.`id` SET r.`new_id` = m.`new_id`;
UPDATE `replies` r JOIN `_uuid_map_comments` m ON m.`old_id` = r.`parent_comment_id` SET r.`new_parent_comment_id` = m.`new_id`;
UPDATE `replies` r JOIN `_uuid_map_users` m ON m.`old_id` = r.`user_id` SET r.`new_user_id` = m.`new_id`;
ALTER TABLE `replies` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `parent_comment_id`, DROP COLUMN `user_id`;
ALTER TABLE `replies`
  CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_parent_comment_id` `parent_comment_id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_user_id` `user_id` CHAR(36) NOT NULL,
  ADD PRIMARY KEY (`id`);
CREATE INDEX `replies_parent_comment_id_idx` ON `replies` (`parent_comment_id`);

ALTER TABLE `likes` ADD COLUMN `new_id` CHAR(36) NULL, ADD COLUMN `new_comment_id` CHAR(36) NULL, ADD COLUMN `new_user_id` CHAR(36) NULL;
UPDATE `likes` l JOIN `_uuid_map_likes` m ON m.`old_id` = l.`id` SET l.`new_id` = m.`new_id`;
UPDATE `likes` l JOIN `_uuid_map_comments` m ON m.`old_id` = l.`comment_id` SET l.`new_comment_id` = m.`new_id`;
UPDATE `likes` l JOIN `_uuid_map_users` m ON m.`old_id` = l.`user_id` SET l.`new_user_id` = m.`new_id`;
ALTER TABLE `likes` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `comment_id`, DROP COLUMN `user_id`;
ALTER TABLE `likes`
  CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_comment_id` `comment_id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_user_id` `user_id` CHAR(36) NOT NULL,
  ADD PRIMARY KEY (`id`);
CREATE UNIQUE INDEX `likes_comment_id_user_id_key` ON `likes` (`comment_id`, `user_id`);
CREATE INDEX `likes_user_id_idx` ON `likes` (`user_id`);

ALTER TABLE `post_votes` ADD COLUMN `new_id` CHAR(36) NULL, ADD COLUMN `new_post_id` CHAR(36) NULL, ADD COLUMN `new_user_id` CHAR(36) NULL;
UPDATE `post_votes` v JOIN `_uuid_map_post_votes` m ON m.`old_id` = v.`id` SET v.`new_id` = m.`new_id`;
UPDATE `post_votes` v JOIN `_uuid_map_posts` m ON m.`old_id` = v.`post_id` SET v.`new_post_id` = m.`new_id`;
UPDATE `post_votes` v JOIN `_uuid_map_users` m ON m.`old_id` = v.`user_id` SET v.`new_user_id` = m.`new_id`;
ALTER TABLE `post_votes` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `post_id`, DROP COLUMN `user_id`;
ALTER TABLE `post_votes`
  CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_post_id` `post_id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_user_id` `user_id` CHAR(36) NOT NULL,
  ADD PRIMARY KEY (`id`);
CREATE UNIQUE INDEX `post_votes_post_id_user_id_key` ON `post_votes` (`post_id`, `user_id`);

ALTER TABLE `shares` ADD COLUMN `new_id` CHAR(36) NULL, ADD COLUMN `new_post_id` CHAR(36) NULL, ADD COLUMN `new_user_id` CHAR(36) NULL;
UPDATE `shares` s JOIN `_uuid_map_shares` m ON m.`old_id` = s.`id` SET s.`new_id` = m.`new_id`;
UPDATE `shares` s JOIN `_uuid_map_posts` m ON m.`old_id` = s.`post_id` SET s.`new_post_id` = m.`new_id`;
UPDATE `shares` s JOIN `_uuid_map_users` m ON m.`old_id` = s.`user_id` SET s.`new_user_id` = m.`new_id`;
ALTER TABLE `shares` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `post_id`, DROP COLUMN `user_id`;
ALTER TABLE `shares`
  CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_post_id` `post_id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_user_id` `user_id` CHAR(36) NOT NULL,
  ADD PRIMARY KEY (`id`);
CREATE UNIQUE INDEX `shares_post_id_user_id_key` ON `shares` (`post_id`, `user_id`);

ALTER TABLE `bookmarks`
  ADD COLUMN `new_id` CHAR(36) NULL,
  ADD COLUMN `new_user_id` CHAR(36) NULL,
  ADD COLUMN `new_item_id` CHAR(36) NULL;
UPDATE `bookmarks` b JOIN `_uuid_map_bookmarks` m ON m.`old_id` = b.`id` SET b.`new_id` = m.`new_id`;
UPDATE `bookmarks` b JOIN `_uuid_map_users` m ON m.`old_id` = b.`user_id` SET b.`new_user_id` = m.`new_id`;
UPDATE `bookmarks` b
  LEFT JOIN `_uuid_map_posts` p ON b.`type` = 'post' AND p.`old_id` = b.`item_id`
  LEFT JOIN `_uuid_map_articles` a ON b.`type` = 'article' AND a.`old_id` = b.`item_id`
  SET b.`new_item_id` = COALESCE(p.`new_id`, a.`new_id`, UUID());
ALTER TABLE `bookmarks` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `user_id`, DROP COLUMN `item_id`;
ALTER TABLE `bookmarks`
  CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_user_id` `user_id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_item_id` `item_id` CHAR(36) NOT NULL,
  ADD PRIMARY KEY (`id`);
DROP INDEX `bookmarks_user_id_type_item_id_key` ON `bookmarks`;
CREATE UNIQUE INDEX `bookmarks_user_id_type_item_id_key` ON `bookmarks` (`user_id`, `type`, `item_id`);

ALTER TABLE `scan_history` ADD COLUMN `new_id` CHAR(36) NULL, ADD COLUMN `new_user_id` CHAR(36) NULL;
UPDATE `scan_history` h JOIN `_uuid_map_scan_history` m ON m.`old_id` = h.`id` SET h.`new_id` = m.`new_id`;
UPDATE `scan_history` h JOIN `_uuid_map_users` m ON m.`old_id` = h.`user_id` SET h.`new_user_id` = m.`new_id`;
ALTER TABLE `scan_history` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `user_id`;
ALTER TABLE `scan_history`
  CHANGE COLUMN `new_id` `id` CHAR(36) NOT NULL,
  CHANGE COLUMN `new_user_id` `user_id` CHAR(36) NOT NULL,
  ADD PRIMARY KEY (`id`);
CREATE INDEX `scan_history_user_id_idx` ON `scan_history` (`user_id`);

DROP TABLE `_uuid_map_users`;
DROP TABLE `_uuid_map_posts`;
DROP TABLE `_uuid_map_comments`;
DROP TABLE `_uuid_map_replies`;
DROP TABLE `_uuid_map_likes`;
DROP TABLE `_uuid_map_post_votes`;
DROP TABLE `_uuid_map_shares`;
DROP TABLE `_uuid_map_articles`;
DROP TABLE `_uuid_map_bookmarks`;
DROP TABLE `_uuid_map_scan_history`;

ALTER TABLE `posts` ADD CONSTRAINT `posts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `comments` ADD CONSTRAINT `comments_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `comments` ADD CONSTRAINT `comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `replies` ADD CONSTRAINT `replies_parent_comment_id_fkey` FOREIGN KEY (`parent_comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `replies` ADD CONSTRAINT `replies_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `likes` ADD CONSTRAINT `likes_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `likes` ADD CONSTRAINT `likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `post_votes` ADD CONSTRAINT `post_votes_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `post_votes` ADD CONSTRAINT `post_votes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `shares` ADD CONSTRAINT `shares_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `shares` ADD CONSTRAINT `shares_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `scan_history` ADD CONSTRAINT `scan_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
