// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"

	"github.com/mattermost/gorp"
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

func getOrphanedRecords(dbmap *gorp.DbMap, cfg relationalCheckConfig) ([]store.OrphanedRecord, error) {
	var records []store.OrphanedRecord

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

func checkParentChildIntegrity(dbmap *gorp.DbMap, config relationalCheckConfig) store.IntegrityCheckResult {
	var result store.IntegrityCheckResult
	var data store.RelationalIntegrityCheckData

	config.sortRecords = true
	data.Records, result.Err = getOrphanedRecords(dbmap, config)
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

func checkChannelsCommandWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "CommandWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkChannelsChannelMemberHistoryIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "ChannelMemberHistory"
	return checkParentChildIntegrity(dbmap, config)
}

func checkChannelsChannelMembersIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "ChannelMembers"
	return checkParentChildIntegrity(dbmap, config)
}

func checkChannelsIncomingWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "IncomingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkChannelsOutgoingWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "OutgoingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkChannelsPostsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Channels"
	config.parentIdAttr = "ChannelId"
	config.childName = "Posts"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkCommandsCommandWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Commands"
	config.parentIdAttr = "CommandId"
	config.childName = "CommandWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkPostsFileInfoIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "PostId"
	config.childName = "FileInfo"
	return checkParentChildIntegrity(dbmap, config)
}

func checkPostsPostsParentIdIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "ParentId"
	config.childName = "Posts"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(dbmap, config)
}

func checkPostsPostsRootIdIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "RootId"
	config.childName = "Posts"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(dbmap, config)
}

func checkPostsReactionsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "PostId"
	config.childName = "Reactions"
	return checkParentChildIntegrity(dbmap, config)
}

func checkSchemesChannelsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Schemes"
	config.parentIdAttr = "SchemeId"
	config.childName = "Channels"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(dbmap, config)
}

func checkSchemesTeamsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Schemes"
	config.parentIdAttr = "SchemeId"
	config.childName = "Teams"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(dbmap, config)
}

func checkSessionsAuditsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Sessions"
	config.parentIdAttr = "SessionId"
	config.childName = "Audits"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(dbmap, config)
}

func checkTeamsChannelsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "Channels"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkTeamsCommandsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "Commands"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkTeamsIncomingWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "IncomingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkTeamsOutgoingWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "OutgoingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkTeamsTeamMembersIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Teams"
	config.parentIdAttr = "TeamId"
	config.childName = "TeamMembers"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersAuditsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Audits"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersCommandWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "CommandWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersChannelMemberHistoryIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "ChannelMemberHistory"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersChannelMembersIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "ChannelMembers"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersChannelsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "Channels"
	config.childIdAttr = "Id"
	config.canParentIdBeEmpty = true
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersCommandsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "Commands"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersCompliancesIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Compliances"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersEmojiIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "Emoji"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersFileInfoIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Posts"
	config.parentIdAttr = "CreatorId"
	config.childName = "FileInfo"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersIncomingWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "IncomingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersOAuthAccessDataIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "OAuthAccessData"
	config.childIdAttr = "Token"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersOAuthAppsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "OAuthApps"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersOAuthAuthDataIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "OAuthAuthData"
	config.childIdAttr = "Code"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersOutgoingWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "CreatorId"
	config.childName = "OutgoingWebhooks"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersPostsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Posts"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersPreferencesIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Preferences"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersReactionsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Reactions"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersSessionsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Sessions"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersStatusIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Status"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersTeamMembersIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "TeamMembers"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersUserAccessTokensIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "UserAccessTokens"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkChannelsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkChannelsCommandWebhooksIntegrity(dbmap)
	results <- checkChannelsChannelMemberHistoryIntegrity(dbmap)
	results <- checkChannelsChannelMembersIntegrity(dbmap)
	results <- checkChannelsIncomingWebhooksIntegrity(dbmap)
	results <- checkChannelsOutgoingWebhooksIntegrity(dbmap)
	results <- checkChannelsPostsIntegrity(dbmap)
}

func checkCommandsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkCommandsCommandWebhooksIntegrity(dbmap)
}

func checkPostsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkPostsFileInfoIntegrity(dbmap)
	results <- checkPostsPostsParentIdIntegrity(dbmap)
	results <- checkPostsPostsRootIdIntegrity(dbmap)
	results <- checkPostsReactionsIntegrity(dbmap)
}

func checkSchemesIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkSchemesChannelsIntegrity(dbmap)
	results <- checkSchemesTeamsIntegrity(dbmap)
}

func checkSessionsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkSessionsAuditsIntegrity(dbmap)
}

func checkTeamsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkTeamsChannelsIntegrity(dbmap)
	results <- checkTeamsCommandsIntegrity(dbmap)
	results <- checkTeamsIncomingWebhooksIntegrity(dbmap)
	results <- checkTeamsOutgoingWebhooksIntegrity(dbmap)
	results <- checkTeamsTeamMembersIntegrity(dbmap)
}

func checkUsersIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkUsersAuditsIntegrity(dbmap)
	results <- checkUsersCommandWebhooksIntegrity(dbmap)
	results <- checkUsersChannelMemberHistoryIntegrity(dbmap)
	results <- checkUsersChannelMembersIntegrity(dbmap)
	results <- checkUsersChannelsIntegrity(dbmap)
	results <- checkUsersCommandsIntegrity(dbmap)
	results <- checkUsersCompliancesIntegrity(dbmap)
	results <- checkUsersEmojiIntegrity(dbmap)
	results <- checkUsersFileInfoIntegrity(dbmap)
	results <- checkUsersIncomingWebhooksIntegrity(dbmap)
	results <- checkUsersOAuthAccessDataIntegrity(dbmap)
	results <- checkUsersOAuthAppsIntegrity(dbmap)
	results <- checkUsersOAuthAuthDataIntegrity(dbmap)
	results <- checkUsersOutgoingWebhooksIntegrity(dbmap)
	results <- checkUsersPostsIntegrity(dbmap)
	results <- checkUsersPreferencesIntegrity(dbmap)
	results <- checkUsersReactionsIntegrity(dbmap)
	results <- checkUsersSessionsIntegrity(dbmap)
	results <- checkUsersStatusIntegrity(dbmap)
	results <- checkUsersTeamMembersIntegrity(dbmap)
	results <- checkUsersUserAccessTokensIntegrity(dbmap)
}

func CheckRelationalIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	mlog.Info("Starting relational integrity checks...")
	checkChannelsIntegrity(dbmap, results)
	checkCommandsIntegrity(dbmap, results)
	checkPostsIntegrity(dbmap, results)
	checkSchemesIntegrity(dbmap, results)
	checkSessionsIntegrity(dbmap, results)
	checkTeamsIntegrity(dbmap, results)
	checkUsersIntegrity(dbmap, results)
	mlog.Info("Done with relational integrity checks")
	close(results)
}
