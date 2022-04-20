ALTER TABLE threadmemberships ADD COLUMN IF NOT EXISTS seenreplycount bigint DEFAULT 0;

UPDATE
	threadmemberships
SET
	seenreplycount = threads.replycount from threads where threadmemberships.lastviewed >= threads.lastreplyat AND threadmemberships.postid = threads.postid;

UPDATE
	threadmemberships
SET
	seenreplycount = (SELECT COUNT(posts.Id) FROM posts WHERE posts.deleteat = 0 AND posts.rootid = threadmemberships.postid AND posts.createat < threadmemberships.lastviewed)
FROM
	threads
WHERE
	threadmemberships.lastviewed < threads.lastreplyat AND threadmemberships.postid = threads.postid;


