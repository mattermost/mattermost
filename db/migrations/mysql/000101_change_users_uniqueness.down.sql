SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'users_email_key'
    ) > 0,
    'DROP INDEX users_email_key ON Users;',
    'SELECT 1'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'users_username_key'
    ) > 0,
    'DROP INDEX users_username_key ON Users;',
    'SELECT 1'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'users_authdata_key'
    ) > 0,
    'DROP INDEX users_authdata_key ON Users;',
    'SELECT 1'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
    ) > 0,
    'CREATE UNIQUE INDEX Email ON Users (email);',
    'SELECT 1'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
    ) > 0,
    'CREATE UNIQUE INDEX Username ON Users (username);',
    'SELECT 1'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
    ) > 0,
    'CREATE UNIQUE INDEX AuthData ON Users (authdata);',
    'SELECT 1'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
