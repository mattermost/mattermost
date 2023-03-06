SELECT 1;

-- we retroactively dropped this index in "0.29.0 > 0.30.0" to fix the blocked migration, 
-- and then repeated it in a new migration("0.35.0 > 0.36.0") too so that the schemas remain in sync.
-- so we don't need to restore index here

-- SET @preparedStatement = (SELECT IF(
--     NOT EXISTS(
--         SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
--         WHERE table_name = 'IR_StatusPosts'
--         AND table_schema = DATABASE()
--         AND index_name = 'posts_unique'
--     ),
--     'ALTER TABLE IR_StatusPosts ADD CONSTRAINT posts_unique UNIQUE (IncidentID, PostID)',
--     'SELECT 1'
-- ));

-- PREPARE createIndexIfNotExists FROM @preparedStatement;
-- EXECUTE createIndexIfNotExists;
-- DEALLOCATE PREPARE createIndexIfNotExists;
