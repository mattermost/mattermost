// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/store"
)

type relationalCheckConfig struct {
	parentName         string
	parentIdAttr       string
	childName          string
	childIdAttr        string
	canParentIdBeEmpty bool
	sortRecords        bool
}

func getOrphanedRecords(ss *SqlSupplier, cfg relationalCheckConfig) ([]store.OrphanedRecord, error) {
	var records []store.OrphanedRecord

	dbmap := ss.GetMaster()
	query := fmt.Sprintf(`SELECT %s AS ParentId`, cfg.parentIdAttr)

	if cfg.childIdAttr != "" {
		query += fmt.Sprintf(` , %s AS ChildId`, cfg.childIdAttr)
	}

	query += fmt.Sprintf(`
		FROM
			%s
		WHERE NOT EXISTS (
			SELECT
  			id
			FROM
				%s
			WHERE
				id = %s.%s
		)
	`, cfg.childName, cfg.parentName, cfg.childName, cfg.parentIdAttr)

	if cfg.canParentIdBeEmpty {
		query += fmt.Sprintf(` AND %s != ''`, cfg.parentIdAttr)
	}

	if cfg.sortRecords {
		query += fmt.Sprintf(` ORDER BY %s`, cfg.parentIdAttr)
	}

	_, err := dbmap.Select(&records, query)

	return records, err
}

func checkParentChildIntegrity(ss *SqlSupplier, config relationalCheckConfig) store.IntegrityCheckResult {
	var result store.IntegrityCheckResult
	var data store.RelationalIntegrityCheckData

	config.sortRecords = true
	data.Records, result.Err = getOrphanedRecords(ss, config)
	if result.Err != nil {
		mlog.Error(result.Err.Error())
		return result
	}
	data.ParentName = config.parentName
	data.ChildName = config.childName
	data.ParentIdAttr = config.parentIdAttr
	data.ChildIdAttr = config.childIdAttr
	result.Data = data

	return result
}

func checkChannelsCommandWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "CommandWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkChannelsChannelMemberHistoryIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "ChannelMemberHistory"
	return checkParentChildIntegrity(ss, config)
}

func checkChannelsChannelMembersIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "ChannelMembers"
	return checkParentChildIntegrity(ss, config)
}

func checkChannelsIncomingWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "IncomingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkChannelsOutgoingWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "OutgoingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkChannelsPostsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "Posts"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkCommandsCommandWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Commands"
	config.parentIdAttr = "CommandId"
	config.childName = "CommandWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkPostsFileInfoIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "PostId"
	config.childName = "FileInfo"
	return checkParentChildIntegrity(ss, config)
}

func checkPostsPostsParentIdIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "ParentId"
	config.childName = "Posts"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(ss, config)
}

func checkPostsPostsRootIdIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "RootId"
	config.childName = "Posts"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(ss, config)
}

func checkPostsReactionsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "PostId"
	config.childName = "Reactions"
	return checkParentChildIntegrity(ss, config)
}

func checkSchemesChannelsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Schemes"
	config.parentIdAttr = "SchemeId"
	config.childName = "Channels"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(ss, config)
}

func checkSchemesTeamsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Schemes"
	config.parentIdAttr = "SchemeId"
	config.childName = "Teams"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(ss, config)
}

func checkSessionsAuditsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Sessions"
	config.parentIdAttr = "SessionId"
	config.childName = "Audits"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(ss, config)
}

func checkTeamsChannelsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "Channels"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkTeamsCommandsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "Commands"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkTeamsIncomingWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "IncomingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkTeamsOutgoingWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "OutgoingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkTeamsTeamMembersIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "TeamMembers"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersAuditsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Audits"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(ss, config)
}

func checkUsersCommandWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "CommandWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersChannelMemberHistoryIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "ChannelMemberHistory"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersChannelMembersIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "ChannelMembers"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersChannelsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "Channels"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(ss, config)
}

func checkUsersCommandsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "Commands"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersCompliancesIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Compliances"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersEmojiIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "Emoji"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersFileInfoIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "CreatorId"
	config.childName = "FileInfo"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersIncomingWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "IncomingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersOAuthAccessDataIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "OAuthAccessData"
	config.childIdAttr = "Token"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersOAuthAppsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "OAuthApps"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersOAuthAuthDataIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "OAuthAuthData"
	config.childIdAttr = "Code"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersOutgoingWebhooksIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "OutgoingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersPostsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Posts"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersPreferencesIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Preferences"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersReactionsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Reactions"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersSessionsIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Sessions"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersStatusIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Status"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersTeamMembersIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "TeamMembers"
	return checkParentChildIntegrity(ss, config)
}

func checkUsersUserAccessTokensIntegrity(ss *SqlSupplier) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "UserAccessTokens"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(ss, config)
}

func checkChannelsIntegrity(ss *SqlSupplier, results chan<- store.IntegrityCheckResult) {
	results <- checkChannelsCommandWebhooksIntegrity(ss)
	results <- checkChannelsChannelMemberHistoryIntegrity(ss)
	results <- checkChannelsChannelMembersIntegrity(ss)
	results <- checkChannelsIncomingWebhooksIntegrity(ss)
	results <- checkChannelsOutgoingWebhooksIntegrity(ss)
	results <- checkChannelsPostsIntegrity(ss)
}

func checkCommandsIntegrity(ss *SqlSupplier, results chan<- store.IntegrityCheckResult) {
	results <- checkCommandsCommandWebhooksIntegrity(ss)
}

func checkPostsIntegrity(ss *SqlSupplier, results chan<- store.IntegrityCheckResult) {
	results <- checkPostsFileInfoIntegrity(ss)
	results <- checkPostsPostsParentIdIntegrity(ss)
	results <- checkPostsPostsRootIdIntegrity(ss)
	results <- checkPostsReactionsIntegrity(ss)
}

func checkSchemesIntegrity(ss *SqlSupplier, results chan<- store.IntegrityCheckResult) {
	results <- checkSchemesChannelsIntegrity(ss)
	results <- checkSchemesTeamsIntegrity(ss)
}

func checkSessionsIntegrity(ss *SqlSupplier, results chan<- store.IntegrityCheckResult) {
	results <- checkSessionsAuditsIntegrity(ss)
}

func checkTeamsIntegrity(ss *SqlSupplier, results chan<- store.IntegrityCheckResult) {
	results <- checkTeamsChannelsIntegrity(ss)
	results <- checkTeamsCommandsIntegrity(ss)
	results <- checkTeamsIncomingWebhooksIntegrity(ss)
	results <- checkTeamsOutgoingWebhooksIntegrity(ss)
	results <- checkTeamsTeamMembersIntegrity(ss)
}

func checkUsersIntegrity(ss *SqlSupplier, results chan<- store.IntegrityCheckResult) {
	results <- checkUsersAuditsIntegrity(ss)
	results <- checkUsersCommandWebhooksIntegrity(ss)
	results <- checkUsersChannelMemberHistoryIntegrity(ss)
	results <- checkUsersChannelMembersIntegrity(ss)
	results <- checkUsersChannelsIntegrity(ss)
	results <- checkUsersCommandsIntegrity(ss)
	results <- checkUsersCompliancesIntegrity(ss)
	results <- checkUsersEmojiIntegrity(ss)
	results <- checkUsersFileInfoIntegrity(ss)
	results <- checkUsersIncomingWebhooksIntegrity(ss)
	results <- checkUsersOAuthAccessDataIntegrity(ss)
	results <- checkUsersOAuthAppsIntegrity(ss)
	results <- checkUsersOAuthAuthDataIntegrity(ss)
	results <- checkUsersOutgoingWebhooksIntegrity(ss)
	results <- checkUsersPostsIntegrity(ss)
	results <- checkUsersPreferencesIntegrity(ss)
	results <- checkUsersReactionsIntegrity(ss)
	results <- checkUsersSessionsIntegrity(ss)
	results <- checkUsersStatusIntegrity(ss)
	results <- checkUsersTeamMembersIntegrity(ss)
	results <- checkUsersUserAccessTokensIntegrity(ss)
}

func CheckRelationalIntegrity(ss *SqlSupplier, results chan<- store.IntegrityCheckResult) {
	mlog.Info("Starting relational integrity checks...")
	checkChannelsIntegrity(ss, results)
	checkCommandsIntegrity(ss, results)
	checkPostsIntegrity(ss, results)
	checkSchemesIntegrity(ss, results)
	checkSessionsIntegrity(ss, results)
	checkTeamsIntegrity(ss, results)
	checkUsersIntegrity(ss, results)
	mlog.Info("Done with relational integrity checks")
	close(results)
}
