-- MariaDB dump 10.19  Distrib 10.5.10-MariaDB, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: mattermost_test
-- ------------------------------------------------------
-- Server version	5.7.12
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Audits`
--

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
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Bots`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Bots` (
  `UserId` varchar(26) NOT NULL,
  `Description` text,
  `OwnerId` varchar(190) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `LastIconUpdate` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`UserId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ChannelMemberHistory`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ChannelMemberHistory` (
  `ChannelId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `JoinTime` bigint(20) NOT NULL,
  `LeaveTime` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`ChannelId`,`UserId`,`JoinTime`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ChannelMembers`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ChannelMembers` (
  `ChannelId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `Roles` varchar(64) DEFAULT NULL,
  `LastViewedAt` bigint(20) DEFAULT NULL,
  `MsgCount` bigint(20) DEFAULT NULL,
  `MentionCount` bigint(20) DEFAULT NULL,
  `NotifyProps` json DEFAULT NULL,
  `LastUpdateAt` bigint(20) DEFAULT NULL,
  `SchemeUser` tinyint(4) DEFAULT NULL,
  `SchemeAdmin` tinyint(4) DEFAULT NULL,
  `SchemeGuest` tinyint(4) DEFAULT NULL,
  `MentionCountRoot` bigint(20) DEFAULT NULL,
  `MsgCountRoot` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`ChannelId`,`UserId`),
  KEY `idx_channelmembers_user_id_channel_id_last_viewed_at` (`UserId`,`ChannelId`,`LastViewedAt`),
  KEY `idx_channelmembers_channel_id_scheme_guest_user_id` (`ChannelId`,`SchemeGuest`,`UserId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Channels`
--

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
  `SchemeId` varchar(26) DEFAULT NULL,
  `GroupConstrained` tinyint(1) DEFAULT NULL,
  `Shared` tinyint(1) DEFAULT NULL,
  `TotalMsgCountRoot` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`,`TeamId`),
  KEY `idx_channels_update_at` (`UpdateAt`),
  KEY `idx_channels_create_at` (`CreateAt`),
  KEY `idx_channels_delete_at` (`DeleteAt`),
  KEY `idx_channels_scheme_id` (`SchemeId`),
  KEY `idx_channels_team_id_display_name` (`TeamId`,`DisplayName`),
  KEY `idx_channels_team_id_type` (`TeamId`,`Type`),
  FULLTEXT KEY `idx_channel_search_txt` (`Name`,`DisplayName`,`Purpose`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ClusterDiscovery`
--

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
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `CommandWebhooks`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `CommandWebhooks` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `CommandId` varchar(26) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  `RootId` varchar(26) DEFAULT NULL,
  `UseCount` int(11) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_command_webhook_create_at` (`CreateAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Commands`
--

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
  `PluginId` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_command_team_id` (`TeamId`),
  KEY `idx_command_update_at` (`UpdateAt`),
  KEY `idx_command_create_at` (`CreateAt`),
  KEY `idx_command_delete_at` (`DeleteAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Compliances`
--

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
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Emoji`
--

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
  KEY `idx_emoji_delete_at` (`DeleteAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `FileInfo`
--

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
  `MiniPreview` mediumblob,
  `Content` longtext,
  `RemoteId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_fileinfo_update_at` (`UpdateAt`),
  KEY `idx_fileinfo_create_at` (`CreateAt`),
  KEY `idx_fileinfo_delete_at` (`DeleteAt`),
  KEY `idx_fileinfo_postid_at` (`PostId`),
  KEY `idx_fileinfo_extension_at` (`Extension`),
  FULLTEXT KEY `idx_fileinfo_name_txt` (`Name`),
  FULLTEXT KEY `idx_fileinfo_content_txt` (`Content`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `GroupChannels`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `GroupChannels` (
  `GroupId` varchar(26) NOT NULL,
  `AutoAdd` tinyint(1) DEFAULT NULL,
  `SchemeAdmin` tinyint(1) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `ChannelId` varchar(26) NOT NULL,
  PRIMARY KEY (`GroupId`,`ChannelId`),
  KEY `idx_groupchannels_schemeadmin` (`SchemeAdmin`),
  KEY `idx_groupchannels_channelid` (`ChannelId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `GroupMembers`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `GroupMembers` (
  `GroupId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`GroupId`,`UserId`),
  KEY `idx_groupmembers_create_at` (`CreateAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `GroupTeams`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `GroupTeams` (
  `GroupId` varchar(26) NOT NULL,
  `AutoAdd` tinyint(1) DEFAULT NULL,
  `SchemeAdmin` tinyint(1) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `TeamId` varchar(26) NOT NULL,
  PRIMARY KEY (`GroupId`,`TeamId`),
  KEY `idx_groupteams_schemeadmin` (`SchemeAdmin`),
  KEY `idx_groupteams_teamid` (`TeamId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `IncomingWebhooks`
--

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
  `Description` text,
  `Username` varchar(255) DEFAULT NULL,
  `IconURL` text,
  `ChannelLocked` tinyint(1) DEFAULT NULL,
  `Enabled` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  KEY `idx_incoming_webhook_user_id` (`UserId`),
  KEY `idx_incoming_webhook_team_id` (`TeamId`),
  KEY `idx_incoming_webhook_update_at` (`UpdateAt`),
  KEY `idx_incoming_webhook_create_at` (`CreateAt`),
  KEY `idx_incoming_webhook_delete_at` (`DeleteAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Jobs`
--

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
  `Data` json DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_jobs_type` (`Type`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Licenses`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Licenses` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `Bytes` text,
  PRIMARY KEY (`Id`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `LinkMetadata`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `LinkMetadata` (
  `Hash` bigint(20) NOT NULL,
  `URL` text,
  `Timestamp` bigint(20) DEFAULT NULL,
  `Type` varchar(16) DEFAULT NULL,
  `Data` json DEFAULT NULL,
  PRIMARY KEY (`Hash`),
  KEY `idx_link_metadata_url_timestamp` (`URL`(512),`Timestamp`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OAuthAccessData`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `OAuthAccessData` (
  `Token` varchar(26) NOT NULL,
  `RefreshToken` varchar(26) DEFAULT NULL,
  `RedirectUri` text,
  `ClientId` varchar(26) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `ExpiresAt` bigint(20) DEFAULT NULL,
  `Scope` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`Token`),
  UNIQUE KEY `ClientId` (`ClientId`,`UserId`),
  KEY `idx_oauthaccessdata_user_id` (`UserId`),
  KEY `idx_oauthaccessdata_refresh_token` (`RefreshToken`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OAuthApps`
--

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
  `CallbackUrls` text,
  `Homepage` text,
  `IsTrusted` tinyint(1) DEFAULT NULL,
  `IconURL` text,
  PRIMARY KEY (`Id`),
  KEY `idx_oauthapps_creator_id` (`CreatorId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OAuthAuthData`
--

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
  PRIMARY KEY (`Code`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OutgoingWebhooks`
--

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
  `CallbackURLs` text,
  `DisplayName` varchar(64) DEFAULT NULL,
  `ContentType` varchar(128) DEFAULT NULL,
  `TriggerWhen` int(11) DEFAULT NULL,
  `Username` varchar(64) DEFAULT NULL,
  `IconURL` text,
  `Description` text,
  PRIMARY KEY (`Id`),
  KEY `idx_outgoing_webhook_team_id` (`TeamId`),
  KEY `idx_outgoing_webhook_update_at` (`UpdateAt`),
  KEY `idx_outgoing_webhook_create_at` (`CreateAt`),
  KEY `idx_outgoing_webhook_delete_at` (`DeleteAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PluginKeyValueStore`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `PluginKeyValueStore` (
  `PluginId` varchar(190) NOT NULL,
  `PKey` varchar(50) NOT NULL,
  `PValue` mediumblob,
  `ExpireAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`PluginId`,`PKey`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Posts`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Posts` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  `RootId` varchar(26) DEFAULT NULL,
  `OriginalId` varchar(26) DEFAULT NULL,
  `Message` text,
  `Type` varchar(26) DEFAULT NULL,
  `Props` json DEFAULT NULL,
  `Hashtags` text,
  `Filenames` text,
  `FileIds` text,
  `HasReactions` tinyint(1) DEFAULT NULL,
  `EditAt` bigint(20) DEFAULT NULL,
  `IsPinned` tinyint(1) DEFAULT NULL,
  `RemoteId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_posts_update_at` (`UpdateAt`),
  KEY `idx_posts_create_at` (`CreateAt`),
  KEY `idx_posts_delete_at` (`DeleteAt`),
  KEY `idx_posts_user_id` (`UserId`),
  KEY `idx_posts_is_pinned` (`IsPinned`),
  KEY `idx_posts_channel_id_update_at` (`ChannelId`,`UpdateAt`),
  KEY `idx_posts_channel_id_delete_at_create_at` (`ChannelId`,`DeleteAt`,`CreateAt`),
  KEY `idx_posts_root_id_delete_at` (`RootId`,`DeleteAt`),
  FULLTEXT KEY `idx_posts_message_txt` (`Message`),
  FULLTEXT KEY `idx_posts_hashtags_txt` (`Hashtags`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Preferences`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Preferences` (
  `UserId` varchar(26) NOT NULL,
  `Category` varchar(32) NOT NULL,
  `Name` varchar(32) NOT NULL,
  `Value` text,
  PRIMARY KEY (`UserId`,`Category`,`Name`),
  KEY `idx_preferences_category` (`Category`),
  KEY `idx_preferences_name` (`Name`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ProductNoticeViewState`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ProductNoticeViewState` (
  `UserId` varchar(26) NOT NULL,
  `NoticeId` varchar(26) NOT NULL,
  `Viewed` int(11) DEFAULT NULL,
  `Timestamp` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`UserId`,`NoticeId`),
  KEY `idx_notice_views_timestamp` (`Timestamp`),
  KEY `idx_notice_views_notice_id` (`NoticeId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PublicChannels`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `PublicChannels` (
  `Id` varchar(26) NOT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `TeamId` varchar(26) DEFAULT NULL,
  `DisplayName` varchar(64) DEFAULT NULL,
  `Name` varchar(64) DEFAULT NULL,
  `Header` text,
  `Purpose` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`,`TeamId`),
  KEY `idx_publicchannels_team_id` (`TeamId`),
  KEY `idx_publicchannels_delete_at` (`DeleteAt`),
  FULLTEXT KEY `idx_publicchannels_search_txt` (`Name`,`DisplayName`,`Purpose`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Reactions`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Reactions` (
  `UserId` varchar(26) NOT NULL,
  `PostId` varchar(26) NOT NULL,
  `EmojiName` varchar(64) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `RemoteId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`PostId`,`UserId`,`EmojiName`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `RemoteClusters`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `RemoteClusters` (
  `RemoteId` varchar(26) NOT NULL,
  `RemoteTeamId` varchar(26) DEFAULT NULL,
  `Name` varchar(64) NOT NULL,
  `DisplayName` varchar(64) DEFAULT NULL,
  `SiteURL` text,
  `CreateAt` bigint(20) DEFAULT NULL,
  `LastPingAt` bigint(20) DEFAULT NULL,
  `Token` varchar(26) DEFAULT NULL,
  `RemoteToken` varchar(26) DEFAULT NULL,
  `Topics` text,
  `CreatorId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`RemoteId`,`Name`),
  UNIQUE KEY `remote_clusters_site_url_unique` (`RemoteTeamId`,`SiteURL`(168))
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `RetentionPolicies`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `RetentionPolicies` (
  `Id` varchar(26) NOT NULL,
  `DisplayName` varchar(64) DEFAULT NULL,
  `PostDuration` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IDX_RetentionPolicies_DisplayName` (`DisplayName`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `RetentionPoliciesChannels`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `RetentionPoliciesChannels` (
  `PolicyId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) NOT NULL,
  PRIMARY KEY (`ChannelId`),
  KEY `IDX_RetentionPoliciesChannels_PolicyId` (`PolicyId`),
  CONSTRAINT `FK_RetentionPoliciesChannels_RetentionPolicies` FOREIGN KEY (`PolicyId`) REFERENCES `RetentionPolicies` (`Id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `RetentionPoliciesTeams`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `RetentionPoliciesTeams` (
  `PolicyId` varchar(26) DEFAULT NULL,
  `TeamId` varchar(26) NOT NULL,
  PRIMARY KEY (`TeamId`),
  KEY `IDX_RetentionPoliciesTeams_PolicyId` (`PolicyId`),
  CONSTRAINT `FK_RetentionPoliciesTeams_RetentionPolicies` FOREIGN KEY (`PolicyId`) REFERENCES `RetentionPolicies` (`Id`) ON DELETE CASCADE
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Roles`
--

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
  `Permissions` longtext,
  `SchemeManaged` tinyint(1) DEFAULT NULL,
  `BuiltIn` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Schemes`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Schemes` (
  `Id` varchar(26) NOT NULL,
  `Name` varchar(64) DEFAULT NULL,
  `DisplayName` varchar(128) DEFAULT NULL,
  `Description` text,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `Scope` varchar(32) DEFAULT NULL,
  `DefaultTeamAdminRole` varchar(64) DEFAULT NULL,
  `DefaultTeamUserRole` varchar(64) DEFAULT NULL,
  `DefaultChannelAdminRole` varchar(64) DEFAULT NULL,
  `DefaultChannelUserRole` varchar(64) DEFAULT NULL,
  `DefaultTeamGuestRole` varchar(64) DEFAULT NULL,
  `DefaultChannelGuestRole` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`),
  KEY `idx_schemes_channel_guest_role` (`DefaultChannelGuestRole`),
  KEY `idx_schemes_channel_user_role` (`DefaultChannelUserRole`),
  KEY `idx_schemes_channel_admin_role` (`DefaultChannelAdminRole`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Sessions`
--

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
  `Props` json DEFAULT NULL,
  `ExpiredNotify` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_sessions_user_id` (`UserId`),
  KEY `idx_sessions_token` (`Token`),
  KEY `idx_sessions_expires_at` (`ExpiresAt`),
  KEY `idx_sessions_create_at` (`CreateAt`),
  KEY `idx_sessions_last_activity_at` (`LastActivityAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SharedChannelAttachments`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `SharedChannelAttachments` (
  `Id` varchar(26) NOT NULL,
  `FileId` varchar(26) DEFAULT NULL,
  `RemoteId` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `LastSyncAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `FileId` (`FileId`,`RemoteId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SharedChannelRemotes`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `SharedChannelRemotes` (
  `Id` varchar(26) NOT NULL,
  `ChannelId` varchar(26) NOT NULL,
  `CreatorId` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `IsInviteAccepted` tinyint(1) DEFAULT NULL,
  `IsInviteConfirmed` tinyint(1) DEFAULT NULL,
  `RemoteId` varchar(26) DEFAULT NULL,
  `LastPostUpdateAt` bigint(20) DEFAULT NULL,
  `LastPostId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`Id`,`ChannelId`),
  UNIQUE KEY `ChannelId` (`ChannelId`,`RemoteId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SharedChannelUsers`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `SharedChannelUsers` (
  `Id` varchar(26) NOT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `RemoteId` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `LastSyncAt` bigint(20) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UserId` (`UserId`,`ChannelId`,`RemoteId`),
  KEY `idx_sharedchannelusers_remote_id` (`RemoteId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SharedChannels`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `SharedChannels` (
  `ChannelId` varchar(26) NOT NULL,
  `TeamId` varchar(26) DEFAULT NULL,
  `Home` tinyint(1) DEFAULT NULL,
  `ReadOnly` tinyint(1) DEFAULT NULL,
  `ShareName` varchar(64) DEFAULT NULL,
  `ShareDisplayName` varchar(64) DEFAULT NULL,
  `SharePurpose` varchar(250) DEFAULT NULL,
  `ShareHeader` text,
  `CreatorId` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `RemoteId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`ChannelId`),
  UNIQUE KEY `ShareName` (`ShareName`,`TeamId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SidebarCategories`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `SidebarCategories` (
  `Id` varchar(128) NOT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `TeamId` varchar(26) DEFAULT NULL,
  `SortOrder` bigint(20) DEFAULT NULL,
  `Sorting` varchar(64) DEFAULT NULL,
  `Type` varchar(64) DEFAULT NULL,
  `DisplayName` varchar(64) DEFAULT NULL,
  `Muted` tinyint(1) DEFAULT NULL,
  `Collapsed` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SidebarChannels`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `SidebarChannels` (
  `ChannelId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `CategoryId` varchar(128) NOT NULL,
  `SortOrder` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`ChannelId`,`UserId`,`CategoryId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Status`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Status` (
  `UserId` varchar(26) NOT NULL,
  `Status` varchar(32) DEFAULT NULL,
  `Manual` tinyint(1) DEFAULT NULL,
  `LastActivityAt` bigint(20) DEFAULT NULL,
  `DNDEndTime` bigint(20) DEFAULT NULL,
  `PrevStatus` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`UserId`),
  KEY `idx_status_status_dndendtime` (`Status`,`DNDEndTime`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Systems`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Systems` (
  `Name` varchar(64) NOT NULL,
  `Value` text,
  PRIMARY KEY (`Name`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `TeamMembers`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `TeamMembers` (
  `TeamId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `Roles` varchar(64) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `SchemeUser` tinyint(4) DEFAULT NULL,
  `SchemeAdmin` tinyint(4) DEFAULT NULL,
  `SchemeGuest` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`TeamId`,`UserId`),
  KEY `idx_teammembers_user_id` (`UserId`),
  KEY `idx_teammembers_delete_at` (`DeleteAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Teams`
--

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
  `SchemeId` varchar(26) DEFAULT NULL,
  `AllowOpenInvite` tinyint(1) DEFAULT NULL,
  `LastTeamIconUpdate` bigint(20) DEFAULT NULL,
  `GroupConstrained` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`),
  KEY `idx_teams_invite_id` (`InviteId`),
  KEY `idx_teams_update_at` (`UpdateAt`),
  KEY `idx_teams_create_at` (`CreateAt`),
  KEY `idx_teams_delete_at` (`DeleteAt`),
  KEY `idx_teams_scheme_id` (`SchemeId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `TermsOfService`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `TermsOfService` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `Text` text,
  PRIMARY KEY (`Id`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ThreadMemberships`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ThreadMemberships` (
  `PostId` varchar(26) NOT NULL,
  `UserId` varchar(26) NOT NULL,
  `Following` tinyint(1) DEFAULT NULL,
  `LastViewed` bigint(20) DEFAULT NULL,
  `LastUpdated` bigint(20) DEFAULT NULL,
  `UnreadMentions` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`PostId`,`UserId`),
  KEY `idx_thread_memberships_last_update_at` (`LastUpdated`),
  KEY `idx_thread_memberships_last_view_at` (`LastViewed`),
  KEY `idx_thread_memberships_user_id` (`UserId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Threads`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Threads` (
  `PostId` varchar(26) NOT NULL,
  `ReplyCount` bigint(20) DEFAULT NULL,
  `LastReplyAt` bigint(20) DEFAULT NULL,
  `Participants` json DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`PostId`),
  KEY `idx_threads_channel_id_last_reply_at` (`ChannelId`,`LastReplyAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Tokens`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Tokens` (
  `Token` varchar(64) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `Type` varchar(64) DEFAULT NULL,
  `Extra` text,
  PRIMARY KEY (`Token`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UploadSessions`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `UploadSessions` (
  `Id` varchar(26) NOT NULL,
  `Type` varchar(32) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  `Filename` text,
  `Path` text,
  `FileSize` bigint(20) DEFAULT NULL,
  `FileOffset` bigint(20) DEFAULT NULL,
  `RemoteId` varchar(26) DEFAULT NULL,
  `ReqFileId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_uploadsessions_user_id` (`UserId`),
  KEY `idx_uploadsessions_create_at` (`CreateAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UserAccessTokens`
--

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
  KEY `idx_user_access_tokens_user_id` (`UserId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UserGroups`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `UserGroups` (
  `Id` varchar(26) NOT NULL,
  `Name` varchar(64) DEFAULT NULL,
  `DisplayName` varchar(128) DEFAULT NULL,
  `Description` text,
  `Source` varchar(64) DEFAULT NULL,
  `RemoteId` varchar(48) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `AllowReference` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Name` (`Name`),
  UNIQUE KEY `Source` (`Source`,`RemoteId`),
  KEY `idx_usergroups_remote_id` (`RemoteId`),
  KEY `idx_usergroups_delete_at` (`DeleteAt`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UserTermsOfService`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `UserTermsOfService` (
  `UserId` varchar(26) NOT NULL,
  `TermsOfServiceId` varchar(26) DEFAULT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`UserId`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Users`
--

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
  `Roles` text,
  `AllowMarketing` tinyint(1) DEFAULT NULL,
  `Props` json DEFAULT NULL,
  `NotifyProps` json DEFAULT NULL,
  `LastPasswordUpdate` bigint(20) DEFAULT NULL,
  `LastPictureUpdate` bigint(20) DEFAULT NULL,
  `FailedAttempts` int(11) DEFAULT NULL,
  `Locale` varchar(5) DEFAULT NULL,
  `MfaActive` tinyint(1) DEFAULT NULL,
  `MfaSecret` varchar(128) DEFAULT NULL,
  `Position` varchar(128) DEFAULT NULL,
  `Timezone` json DEFAULT NULL,
  `RemoteId` varchar(26) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Username` (`Username`),
  UNIQUE KEY `AuthData` (`AuthData`),
  UNIQUE KEY `Email` (`Email`),
  KEY `idx_users_update_at` (`UpdateAt`),
  KEY `idx_users_create_at` (`CreateAt`),
  KEY `idx_users_delete_at` (`DeleteAt`),
  FULLTEXT KEY `idx_users_all_txt` (`Username`,`FirstName`,`LastName`,`Nickname`,`Email`),
  FULLTEXT KEY `idx_users_all_no_full_name_txt` (`Username`,`Nickname`,`Email`),
  FULLTEXT KEY `idx_users_names_txt` (`Username`,`FirstName`,`LastName`,`Nickname`),
  FULLTEXT KEY `idx_users_names_no_full_name_txt` (`Username`,`Nickname`)
);
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `db_migrations`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `db_migrations` (
  `Version` bigint(20) NOT NULL,
  `Name` varchar(64) NOT NULL,
  PRIMARY KEY (`Version`)
);
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2021-08-31 11:45:07
