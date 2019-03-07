-- MySQL dump 10.13  Distrib 5.7.25, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: mattermost_test
-- ------------------------------------------------------
-- Server version	5.7.23

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Audits`
--

DROP TABLE IF EXISTS `Audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Audits` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `Action` text,
  `ExtraInfo` text,
  `IpAddress` varchar(64) DEFAULT NULL,
  `SessionId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_audits_user_id` (`UserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Audits`
--

LOCK TABLES `Audits` WRITE;
/*!40000 ALTER TABLE `Audits` DISABLE KEYS */;
/*!40000 ALTER TABLE `Audits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ChannelMemberHistory`
--

DROP TABLE IF EXISTS `ChannelMemberHistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ChannelMemberHistory` (
  `ChannelId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `JoinTime` bigint(20) NOT NULL,
  `LeaveTime` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`ChannelId`,`UserId`,`JoinTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ChannelMemberHistory`
--

LOCK TABLES `ChannelMemberHistory` WRITE;
/*!40000 ALTER TABLE `ChannelMemberHistory` DISABLE KEYS */;
/*!40000 ALTER TABLE `ChannelMemberHistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ChannelMembers`
--

DROP TABLE IF EXISTS `ChannelMembers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ChannelMembers` (
  `ChannelId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `Roles` varchar(64) DEFAULT NULL,
  `LastViewedAt` bigint(20) DEFAULT NULL,
  `MsgCount` bigint(20) DEFAULT NULL,
  `MentionCount` bigint(20) DEFAULT NULL,
  `NotifyProps` text,
  `LastUpdateAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`ChannelId`,`UserId`),
  KEY `idx_channelmembers_channel_id` (`ChannelId`),
  KEY `idx_channelmembers_user_id` (`UserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ChannelMembers`
--

LOCK TABLES `ChannelMembers` WRITE;
/*!40000 ALTER TABLE `ChannelMembers` DISABLE KEYS */;
/*!40000 ALTER TABLE `ChannelMembers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Channels`
--

DROP TABLE IF EXISTS `Channels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Channels` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `TeamId` varchar(26) DEFAULT NULL,
  `Type` varchar(1) DEFAULT NULL,
  `DisplayName` varchar(64) DEFAULT NULL,
  `Name` varchar(64) DEFAULT NULL,
  `Header` text,
  `Purpose` varchar(250) DEFAULT NULL,
  `LastPostAt` bigint(20) DEFAULT NULL,
  `TotalMsgCount` bigint(20) DEFAULT NULL,
  `ExtraUpdateAt` bigint(20) DEFAULT NULL,
  `CreatorId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`,`TeamId`),
  KEY `idx_channels_team_id` (`TeamId`),
  KEY `idx_channels_name` (`Name`),
  KEY `idx_channels_update_at` (`UpdateAt`),
  KEY `idx_channels_create_at` (`CreateAt`),
  KEY `idx_channels_delete_at` (`DeleteAt`),
  FULLTEXT KEY `idx_channels_txt` (`Name`,`DisplayName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Channels`
--

LOCK TABLES `Channels` WRITE;
/*!40000 ALTER TABLE `Channels` DISABLE KEYS */;
/*!40000 ALTER TABLE `Channels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ClusterDiscovery`
--

DROP TABLE IF EXISTS `ClusterDiscovery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ClusterDiscovery` (
  `Id` varchar(26) NOT NULL,
  `Type` varchar(64) DEFAULT NULL,
  `ClusterName` varchar(64) DEFAULT NULL,
  `Hostname` text,
  `GossipPort` int(11) DEFAULT NULL,
  `Port` int(11) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `LastPingAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ClusterDiscovery`
--

LOCK TABLES `ClusterDiscovery` WRITE;
/*!40000 ALTER TABLE `ClusterDiscovery` DISABLE KEYS */;
/*!40000 ALTER TABLE `ClusterDiscovery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CommandWebhooks`
--

DROP TABLE IF EXISTS `CommandWebhooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `CommandWebhooks` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `CommandId` varchar(26) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  `RootId` varchar(26) DEFAULT NULL,
  `ParentId` varchar(26) DEFAULT NULL,
  `UseCount` int(11) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_command_webhook_create_at` (`CreateAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CommandWebhooks`
--

LOCK TABLES `CommandWebhooks` WRITE;
/*!40000 ALTER TABLE `CommandWebhooks` DISABLE KEYS */;
/*!40000 ALTER TABLE `CommandWebhooks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Commands`
--

DROP TABLE IF EXISTS `Commands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Commands` (
  `Id` varchar(26) NOT NULL,
  `Token` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `CreatorId` varchar(26) DEFAULT NULL,
  `TeamId` varchar(26) DEFAULT NULL,
  `Trigger` varchar(128) DEFAULT NULL,
  `Method` varchar(1) DEFAULT NULL,
  `Username` varchar(64) DEFAULT NULL,
  `IconURL` text,
  `AutoComplete` tinyint(1) DEFAULT NULL,
  `AutoCompleteDesc` text,
  `AutoCompleteHint` text,
  `DisplayName` varchar(64) DEFAULT NULL,
  `Description` varchar(128) DEFAULT NULL,
  `URL` text,
  PRIMARY KEY (`Id`),
  KEY `idx_command_team_id` (`TeamId`),
  KEY `idx_command_update_at` (`UpdateAt`),
  KEY `idx_command_create_at` (`CreateAt`),
  KEY `idx_command_delete_at` (`DeleteAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Commands`
--

LOCK TABLES `Commands` WRITE;
/*!40000 ALTER TABLE `Commands` DISABLE KEYS */;
/*!40000 ALTER TABLE `Commands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Compliances`
--

DROP TABLE IF EXISTS `Compliances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Compliances` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `Status` varchar(64) DEFAULT NULL,
  `Count` int(11) DEFAULT NULL,
  `Desc` text,
  `Type` varchar(64) DEFAULT NULL,
  `StartAt` bigint(20) DEFAULT NULL,
  `EndAt` bigint(20) DEFAULT NULL,
  `Keywords` text,
  `Emails` text,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Compliances`
--

LOCK TABLES `Compliances` WRITE;
/*!40000 ALTER TABLE `Compliances` DISABLE KEYS */;
/*!40000 ALTER TABLE `Compliances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Emoji`
--

DROP TABLE IF EXISTS `Emoji`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Emoji` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `CreatorId` varchar(26) DEFAULT NULL,
  `Name` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`,`DeleteAt`),
  KEY `idx_emoji_update_at` (`UpdateAt`),
  KEY `idx_emoji_create_at` (`CreateAt`),
  KEY `idx_emoji_delete_at` (`DeleteAt`),
  KEY `idx_emoji_name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Emoji`
--

LOCK TABLES `Emoji` WRITE;
/*!40000 ALTER TABLE `Emoji` DISABLE KEYS */;
/*!40000 ALTER TABLE `Emoji` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FileInfo`
--

DROP TABLE IF EXISTS `FileInfo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `FileInfo` (
  `Id` varchar(26) NOT NULL,
  `CreatorId` varchar(26) DEFAULT NULL,
  `PostId` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `Path` text,
  `ThumbnailPath` text,
  `PreviewPath` text,
  `Name` text,
  `Extension` varchar(64) DEFAULT NULL,
  `Size` bigint(20) DEFAULT NULL,
  `MimeType` text,
  `Width` int(11) DEFAULT NULL,
  `Height` int(11) DEFAULT NULL,
  `HasPreviewImage` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_fileinfo_update_at` (`UpdateAt`),
  KEY `idx_fileinfo_create_at` (`CreateAt`),
  KEY `idx_fileinfo_delete_at` (`DeleteAt`),
  KEY `idx_fileinfo_postid_at` (`PostId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FileInfo`
--

LOCK TABLES `FileInfo` WRITE;
/*!40000 ALTER TABLE `FileInfo` DISABLE KEYS */;
/*!40000 ALTER TABLE `FileInfo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `IncomingWebhooks`
--

DROP TABLE IF EXISTS `IncomingWebhooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `IncomingWebhooks` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  `TeamId` varchar(26) DEFAULT NULL,
  `DisplayName` varchar(64) DEFAULT NULL,
  `Description` varchar(128) DEFAULT NULL,
  `Username` varchar(255) DEFAULT NULL,
  `IconURL` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_incoming_webhook_user_id` (`UserId`),
  KEY `idx_incoming_webhook_team_id` (`TeamId`),
  KEY `idx_incoming_webhook_update_at` (`UpdateAt`),
  KEY `idx_incoming_webhook_create_at` (`CreateAt`),
  KEY `idx_incoming_webhook_delete_at` (`DeleteAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `IncomingWebhooks`
--

LOCK TABLES `IncomingWebhooks` WRITE;
/*!40000 ALTER TABLE `IncomingWebhooks` DISABLE KEYS */;
/*!40000 ALTER TABLE `IncomingWebhooks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Jobs`
--

DROP TABLE IF EXISTS `Jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Jobs` (
  `Id` varchar(26) NOT NULL,
  `Type` varchar(32) DEFAULT NULL,
  `Priority` bigint(20) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `StartAt` bigint(20) DEFAULT NULL,
  `LastActivityAt` bigint(20) DEFAULT NULL,
  `Status` varchar(32) DEFAULT NULL,
  `Progress` bigint(20) DEFAULT NULL,
  `Data` text,
  PRIMARY KEY (`Id`),
  KEY `idx_jobs_type` (`Type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Jobs`
--

LOCK TABLES `Jobs` WRITE;
/*!40000 ALTER TABLE `Jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `Jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Licenses`
--

DROP TABLE IF EXISTS `Licenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Licenses` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `Bytes` text,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Licenses`
--

LOCK TABLES `Licenses` WRITE;
/*!40000 ALTER TABLE `Licenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `Licenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `OAuthAccessData`
--

DROP TABLE IF EXISTS `OAuthAccessData`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `OAuthAccessData` (
  `ClientId` varchar(26) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `Token` varchar(26) NOT NULL,
  `RefreshToken` varchar(26) DEFAULT NULL,
  `RedirectUri` text,
  `ExpiresAt` bigint(20) DEFAULT NULL,
  `Scope` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`Token`),
  UNIQUE KEY `ClientId` (`ClientId`,`UserId`),
  KEY `idx_oauthaccessdata_client_id` (`ClientId`),
  KEY `idx_oauthaccessdata_user_id` (`UserId`),
  KEY `idx_oauthaccessdata_refresh_token` (`RefreshToken`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OAuthAccessData`
--

LOCK TABLES `OAuthAccessData` WRITE;
/*!40000 ALTER TABLE `OAuthAccessData` DISABLE KEYS */;
/*!40000 ALTER TABLE `OAuthAccessData` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `OAuthApps`
--

DROP TABLE IF EXISTS `OAuthApps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `OAuthApps` (
  `Id` varchar(26) NOT NULL,
  `CreatorId` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `ClientSecret` varchar(128) DEFAULT NULL,
  `Name` varchar(64) DEFAULT NULL,
  `Description` text,
  `IconURL` text,
  `CallbackUrls` text,
  `Homepage` text,
  `IsTrusted` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_oauthapps_creator_id` (`CreatorId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OAuthApps`
--

LOCK TABLES `OAuthApps` WRITE;
/*!40000 ALTER TABLE `OAuthApps` DISABLE KEYS */;
/*!40000 ALTER TABLE `OAuthApps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `OAuthAuthData`
--

DROP TABLE IF EXISTS `OAuthAuthData`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `OAuthAuthData` (
  `ClientId` varchar(26) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `Code` varchar(128) NOT NULL,
  `ExpiresIn` int(11) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `RedirectUri` text,
  `State` text,
  `Scope` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`Code`),
  KEY `idx_oauthauthdata_client_id` (`Code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OAuthAuthData`
--

LOCK TABLES `OAuthAuthData` WRITE;
/*!40000 ALTER TABLE `OAuthAuthData` DISABLE KEYS */;
/*!40000 ALTER TABLE `OAuthAuthData` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `OutgoingWebhooks`
--

DROP TABLE IF EXISTS `OutgoingWebhooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `OutgoingWebhooks` (
  `Id` varchar(26) NOT NULL,
  `Token` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `CreatorId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  `TeamId` varchar(26) DEFAULT NULL,
  `TriggerWords` text,
  `TriggerWhen` int(11) DEFAULT NULL,
  `CallbackURLs` text,
  `DisplayName` varchar(64) DEFAULT NULL,
  `Description` varchar(128) DEFAULT NULL,
  `ContentType` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_outgoing_webhook_team_id` (`TeamId`),
  KEY `idx_outgoing_webhook_update_at` (`UpdateAt`),
  KEY `idx_outgoing_webhook_create_at` (`CreateAt`),
  KEY `idx_outgoing_webhook_delete_at` (`DeleteAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OutgoingWebhooks`
--

LOCK TABLES `OutgoingWebhooks` WRITE;
/*!40000 ALTER TABLE `OutgoingWebhooks` DISABLE KEYS */;
/*!40000 ALTER TABLE `OutgoingWebhooks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PluginKeyValueStore`
--

DROP TABLE IF EXISTS `PluginKeyValueStore`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `PluginKeyValueStore` (
  `PluginId` varchar(190) NOT NULL,
  `PKey` varchar(50) NOT NULL,
  `PValue` mediumblob,
  PRIMARY KEY (`PluginId`,`PKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PluginKeyValueStore`
--

LOCK TABLES `PluginKeyValueStore` WRITE;
/*!40000 ALTER TABLE `PluginKeyValueStore` DISABLE KEYS */;
/*!40000 ALTER TABLE `PluginKeyValueStore` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Posts`
--

DROP TABLE IF EXISTS `Posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Posts` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `EditAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `IsPinned` tinyint(1) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  `RootId` varchar(26) DEFAULT NULL,
  `ParentId` varchar(26) DEFAULT NULL,
  `OriginalId` varchar(26) DEFAULT NULL,
  `Message` text,
  `Type` varchar(26) DEFAULT NULL,
  `Props` text,
  `Hashtags` text,
  `Filenames` text,
  `FileIds` varchar(150) DEFAULT NULL,
  `HasReactions` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_posts_update_at` (`UpdateAt`),
  KEY `idx_posts_create_at` (`CreateAt`),
  KEY `idx_posts_delete_at` (`DeleteAt`),
  KEY `idx_posts_channel_id` (`ChannelId`),
  KEY `idx_posts_root_id` (`RootId`),
  KEY `idx_posts_user_id` (`UserId`),
  KEY `idx_posts_is_pinned` (`IsPinned`),
  KEY `idx_posts_channel_id_update_at` (`ChannelId`,`UpdateAt`),
  KEY `idx_posts_channel_id_delete_at_create_at` (`ChannelId`,`DeleteAt`,`CreateAt`),
  FULLTEXT KEY `idx_posts_message_txt` (`Message`),
  FULLTEXT KEY `idx_posts_hashtags_txt` (`Hashtags`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Posts`
--

LOCK TABLES `Posts` WRITE;
/*!40000 ALTER TABLE `Posts` DISABLE KEYS */;
/*!40000 ALTER TABLE `Posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Preferences`
--

DROP TABLE IF EXISTS `Preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Preferences` (
  `UserId` varchar(26) NOT NULL,
  `Category` varchar(32) NOT NULL,
  `Name` varchar(32) NOT NULL,
  `Value` text,
  PRIMARY KEY (`UserId`,`Category`,`Name`),
  KEY `idx_preferences_user_id` (`UserId`),
  KEY `idx_preferences_category` (`Category`),
  KEY `idx_preferences_name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Preferences`
--

LOCK TABLES `Preferences` WRITE;
/*!40000 ALTER TABLE `Preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `Preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Reactions`
--

DROP TABLE IF EXISTS `Reactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Reactions` (
  `UserId` varchar(26) NOT NULL,
  `PostId` varchar(26) NOT NULL,
  `EmojiName` varchar(64) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`UserId`,`PostId`,`EmojiName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Reactions`
--

LOCK TABLES `Reactions` WRITE;
/*!40000 ALTER TABLE `Reactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `Reactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Roles`
--

DROP TABLE IF EXISTS `Roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Roles` (
  `Id` varchar(26) NOT NULL,
  `Name` varchar(64) DEFAULT NULL,
  `DisplayName` varchar(128) DEFAULT NULL,
  `Description` text,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `Permissions` text,
  `SchemeManaged` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Roles`
--

LOCK TABLES `Roles` WRITE;
/*!40000 ALTER TABLE `Roles` DISABLE KEYS */;
INSERT INTO `Roles` VALUES ('3uzgtnrn1td5znm9m3dkhpn8iy','system_post_all_public','authentication.roles.system_post_all_public.name','authentication.roles.system_post_all_public.description',1551972981969,1551972981969,0,' create_post_public',1),('7y6d9w8nxpge3mcw4uc7swzjph','channel_admin','authentication.roles.channel_admin.name','authentication.roles.channel_admin.description',1551972981692,1551972981692,0,' manage_channel_roles',1),('bbqbhwn96pyqfbw3qdzdygk67h','system_user_access_token','authentication.roles.system_user_access_token.name','authentication.roles.system_user_access_token.description',1551972981659,1551972981659,0,' create_user_access_token read_user_access_token revoke_user_access_token',1),('emt4jxg647dmpej66zjzqaxanr','system_user','authentication.roles.global_user.name','authentication.roles.global_user.description',1551972981890,1551972981890,0,' create_direct_channel create_group_channel permanent_delete_user create_team',1),('etb1z95763dcdkqqudddc9683h','team_post_all','authentication.roles.team_post_all.name','authentication.roles.team_post_all.description',1551972981726,1551972981726,0,' create_post',1),('gdzbpqniijrfzc43yiicr8yhkc','system_admin','authentication.roles.global_admin.name','authentication.roles.global_admin.description',1551972981316,1551972981316,0,' assign_system_admin_role manage_system manage_roles manage_public_channel_properties manage_public_channel_members manage_private_channel_members delete_public_channel create_public_channel manage_private_channel_properties delete_private_channel create_private_channel manage_system_wide_oauth manage_others_webhooks edit_other_users manage_oauth invite_user delete_post delete_others_posts create_team add_user_to_team list_users_without_team manage_jobs create_post_public create_post_ephemeral create_user_access_token read_user_access_token revoke_user_access_token remove_others_reactions list_team_channels join_public_channels read_public_channel view_team read_channel add_reaction remove_reaction upload_file get_public_link create_post use_slash_commands edit_others_posts remove_user_from_team manage_team import_team manage_team_roles manage_channel_roles manage_slash_commands manage_others_slash_commands manage_webhooks edit_post',1),('jrpoi5rp8tf57ezbyn8no9hgzr','team_admin','authentication.roles.team_admin.name','authentication.roles.team_admin.description',1551972981762,1551972981762,0,' edit_others_posts remove_user_from_team manage_team import_team manage_team_roles manage_channel_roles manage_others_webhooks manage_slash_commands manage_others_slash_commands manage_webhooks delete_post delete_others_posts',1),('my8ejgku7igu8n7hfo55hc479r','channel_user','authentication.roles.channel_user.name','authentication.roles.channel_user.description',1551972981457,1551972981457,0,' read_channel add_reaction remove_reaction manage_public_channel_members upload_file get_public_link create_post use_slash_commands manage_private_channel_members delete_post edit_post',1),('qton7pzqk3ydujxgighhiegahr','team_user','authentication.roles.team_user.name','authentication.roles.team_user.description',1551972981491,1551972981491,0,' list_team_channels join_public_channels read_public_channel view_team create_public_channel manage_public_channel_properties delete_public_channel create_private_channel manage_private_channel_properties delete_private_channel invite_user add_user_to_team',1),('sz6sqakintn35xbaikh86qtbur','team_post_all_public','authentication.roles.team_post_all_public.name','authentication.roles.team_post_all_public.description',1551972981557,1551972981557,0,' create_post_public',1),('ugthq1woc3ddinfi4okt3qqkfy','system_post_all','authentication.roles.system_post_all.name','authentication.roles.system_post_all.description',1551972981625,1551972981625,0,' create_post',1);
/*!40000 ALTER TABLE `Roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Sessions`
--

DROP TABLE IF EXISTS `Sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Sessions` (
  `Id` varchar(26) NOT NULL,
  `Token` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `ExpiresAt` bigint(20) DEFAULT NULL,
  `LastActivityAt` bigint(20) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `DeviceId` text,
  `Roles` varchar(64) DEFAULT NULL,
  `IsOAuth` tinyint(1) DEFAULT NULL,
  `Props` text,
  PRIMARY KEY (`Id`),
  KEY `idx_sessions_user_id` (`UserId`),
  KEY `idx_sessions_token` (`Token`),
  KEY `idx_sessions_expires_at` (`ExpiresAt`),
  KEY `idx_sessions_create_at` (`CreateAt`),
  KEY `idx_sessions_last_activity_at` (`LastActivityAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Sessions`
--

LOCK TABLES `Sessions` WRITE;
/*!40000 ALTER TABLE `Sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `Sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Status`
--

DROP TABLE IF EXISTS `Status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Status` (
  `UserId` varchar(26) NOT NULL,
  `Status` varchar(32) DEFAULT NULL,
  `Manual` tinyint(1) DEFAULT NULL,
  `LastActivityAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`UserId`),
  KEY `idx_status_user_id` (`UserId`),
  KEY `idx_status_status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Status`
--

LOCK TABLES `Status` WRITE;
/*!40000 ALTER TABLE `Status` DISABLE KEYS */;
/*!40000 ALTER TABLE `Status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Systems`
--

DROP TABLE IF EXISTS `Systems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Systems` (
  `Name` varchar(64) NOT NULL,
  `Value` text,
  PRIMARY KEY (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Systems`
--

LOCK TABLES `Systems` WRITE;
/*!40000 ALTER TABLE `Systems` DISABLE KEYS */;
INSERT INTO `Systems` VALUES ('AdvancedPermissionsMigrationComplete','true'),('AsymmetricSigningKey','{\"ecdsa_key\":{\"curve\":\"P-256\",\"x\":101674952426848835190621037548380699401836215796232118964535591012638160698508,\"y\":92938137647988917093523231483248368747266974754293170704729689674206728928089,\"d\":4714756814325604687732823251498188541088786297302254684874899905425188082353}}'),('DiagnosticId','w4dok7unu3gaid1e7qknhasy7o'),('LastSecurityTime','1551972983634'),('Version','4.10.0');
/*!40000 ALTER TABLE `Systems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `TeamMembers`
--

DROP TABLE IF EXISTS `TeamMembers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `TeamMembers` (
  `TeamId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `Roles` varchar(64) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`TeamId`,`UserId`),
  KEY `idx_teammembers_team_id` (`TeamId`),
  KEY `idx_teammembers_user_id` (`UserId`),
  KEY `idx_teammembers_delete_at` (`DeleteAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `TeamMembers`
--

LOCK TABLES `TeamMembers` WRITE;
/*!40000 ALTER TABLE `TeamMembers` DISABLE KEYS */;
/*!40000 ALTER TABLE `TeamMembers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Teams`
--

DROP TABLE IF EXISTS `Teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Teams` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `DisplayName` varchar(64) DEFAULT NULL,
  `Name` varchar(64) DEFAULT NULL,
  `Description` varchar(255) DEFAULT NULL,
  `Email` varchar(128) DEFAULT NULL,
  `Type` varchar(255) DEFAULT NULL,
  `CompanyName` varchar(64) DEFAULT NULL,
  `AllowedDomains` text,
  `InviteId` varchar(32) DEFAULT NULL,
  `AllowOpenInvite` tinyint(1) DEFAULT NULL,
  `LastTeamIconUpdate` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`),
  KEY `idx_teams_name` (`Name`),
  KEY `idx_teams_invite_id` (`InviteId`),
  KEY `idx_teams_update_at` (`UpdateAt`),
  KEY `idx_teams_create_at` (`CreateAt`),
  KEY `idx_teams_delete_at` (`DeleteAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Teams`
--

LOCK TABLES `Teams` WRITE;
/*!40000 ALTER TABLE `Teams` DISABLE KEYS */;
/*!40000 ALTER TABLE `Teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Tokens`
--

DROP TABLE IF EXISTS `Tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Tokens` (
  `Token` varchar(64) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `Type` varchar(64) DEFAULT NULL,
  `Extra` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`Token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Tokens`
--

LOCK TABLES `Tokens` WRITE;
/*!40000 ALTER TABLE `Tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `Tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserAccessTokens`
--

DROP TABLE IF EXISTS `UserAccessTokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `UserAccessTokens` (
  `Id` varchar(26) NOT NULL,
  `Token` varchar(26) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `Description` text,
  `IsActive` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Token` (`Token`),
  KEY `idx_user_access_tokens_token` (`Token`),
  KEY `idx_user_access_tokens_user_id` (`UserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserAccessTokens`
--

LOCK TABLES `UserAccessTokens` WRITE;
/*!40000 ALTER TABLE `UserAccessTokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `UserAccessTokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Users` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `Username` varchar(64) DEFAULT NULL,
  `Password` varchar(128) DEFAULT NULL,
  `AuthData` varchar(128) DEFAULT NULL,
  `AuthService` varchar(32) DEFAULT NULL,
  `Email` varchar(128) DEFAULT NULL,
  `EmailVerified` tinyint(1) DEFAULT NULL,
  `Nickname` varchar(64) DEFAULT NULL,
  `FirstName` varchar(64) DEFAULT NULL,
  `LastName` varchar(64) DEFAULT NULL,
  `Position` varchar(128) DEFAULT NULL,
  `Roles` text,
  `AllowMarketing` tinyint(1) DEFAULT NULL,
  `Props` text,
  `NotifyProps` text,
  `LastPasswordUpdate` bigint(20) DEFAULT NULL,
  `LastPictureUpdate` bigint(20) DEFAULT NULL,
  `FailedAttempts` int(11) DEFAULT NULL,
  `Locale` varchar(5) DEFAULT NULL,
  `Timezone` text,
  `MfaActive` tinyint(1) DEFAULT NULL,
  `MfaSecret` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Username` (`Username`),
  UNIQUE KEY `AuthData` (`AuthData`),
  UNIQUE KEY `Email` (`Email`),
  KEY `idx_users_email` (`Email`),
  KEY `idx_users_update_at` (`UpdateAt`),
  KEY `idx_users_create_at` (`CreateAt`),
  KEY `idx_users_delete_at` (`DeleteAt`),
  FULLTEXT KEY `idx_users_all_txt` (`Username`,`FirstName`,`LastName`,`Nickname`,`Email`),
  FULLTEXT KEY `idx_users_all_no_full_name_txt` (`Username`,`Nickname`,`Email`),
  FULLTEXT KEY `idx_users_names_txt` (`Username`,`FirstName`,`LastName`,`Nickname`),
  FULLTEXT KEY `idx_users_names_no_full_name_txt` (`Username`,`Nickname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Users`
--

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2019-03-07 21:33:26
