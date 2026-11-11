-- Shrinking the message columns would rebuild idx_posts_message_txt and fail once longer
-- messages exist, so leave them in place on rollback.
SELECT 1;
