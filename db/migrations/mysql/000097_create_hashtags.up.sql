CREATE TABLE IF NOT EXISTS `Hashtags` (`Id` VARCHAR(26) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL , `PostId` VARCHAR(26) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL , `Value` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL , PRIMARY KEY (`Id`), INDEX (`PostId`)) ENGINE = InnoDB;
ALTER TABLE `Hashtags` ADD FULLTEXT `hashtags_value_fulltext` (`Value`);
