ALTER TABLE threads ADD COLUMN IF NOT EXISTS deleteat bigint;
UPDATE threads SET deleteat = posts.deleteat FROM posts WHERE threads.deleteat IS NULL AND posts.id = threads.postid;
