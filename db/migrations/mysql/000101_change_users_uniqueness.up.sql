SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'Email'
    ) > 0,
    'DROP INDEX Email ON Users;',
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
        AND index_name = 'Username'
    ) > 0,
    'DROP INDEX Username ON Users;',
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
        AND index_name = 'AuthData'
    ) > 0,
    'DROP INDEX AuthData ON Users;',
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
	'CREATE UNIQUE INDEX users_email_key ON Users (email,(IF(deleteat,NULL,1)));',
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
    'CREATE UNIQUE INDEX users_username_key ON Users (username,(IF(deleteat,NULL,1)));',
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
    'CREATE UNIQUE INDEX users_authdata_key ON Users (authdata,(IF(deleteat,NULL,1)));',
    'SELECT 1'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
