// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type relationalCheckConfig struct {
	parentName         string
	parentIdAttr       string
	childName          string
	childIdAttr        string
	canParentIdBeEmpty bool
	sortRecords        bool
	filter             any
}

func getOrphanedRecords(ss *SqlStore, cfg relationalCheckConfig) ([]model.OrphanedRecord, error) {
	records := []model.OrphanedRecord{}

	sub := ss.getQueryBuilder().
		Select("TRUE").
		From(cfg.parentName + " AS PT").
		Prefix("NOT EXISTS (").
		Suffix(")").
		Where("PT.id = CT." + cfg.parentIdAttr)

	main := ss.getQueryBuilder().
		Select().
		Column("CT." + cfg.parentIdAttr + " AS ParentId").
		From(cfg.childName + " AS CT").
		Where(sub)

	if cfg.childIdAttr != "" {
		main = main.Column("CT." + cfg.childIdAttr + " AS ChildId")
	}

	if cfg.canParentIdBeEmpty {
		main = main.Where(sq.NotEq{"CT." + cfg.parentIdAttr: ""})
	}

	if cfg.filter != nil {
		main = main.Where(cfg.filter)
	}

	if cfg.sortRecords {
		main = main.OrderBy("CT." + cfg.parentIdAttr)
	}

	query, args, err := main.ToSql()
	if err != nil {
		return nil, err
	}

	err = ss.GetMasterX().Select(&records, query, args...)
	return records, err
}

func checkParentChildIntegrity(ss *SqlStore, config relationalCheckConfig) model.IntegrityCheckResult {
	var result model.IntegrityCheckResult
	var data model.RelationalIntegrityCheckData

	config.sortRecords = true
	data.Records, result.Err = getOrphanedRecords(ss, config)
	if result.Err != nil {
		mlog.Error("Error while getting orphaned records", mlog.Err(result.Err))
		return result
	}
	data.ParentName = config.parentName
	data.ChildName = config.childName
	data.ParentIdAttr = config.parentIdAttr
	data.ChildIdAttr = config.childIdAttr
	result.Data = data

	return result
}

func checkChannelsCommandWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Channels",
		parentIdAttr: "ChannelId",
		childName:    "CommandWebhooks",
		childIdAttr:  "Id",
	})
}

func checkChannelsChannelMemberHistoryIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Channels",
		parentIdAttr: "ChannelId",
		childName:    "ChannelMemberHistory",
		childIdAttr:  "",
	})
}

func checkChannelsChannelMembersIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Channels",
		parentIdAttr: "ChannelId",
		childName:    "ChannelMembers",
		childIdAttr:  "",
	})
}

func checkChannelsIncomingWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Channels",
		parentIdAttr: "ChannelId",
		childName:    "IncomingWebhooks",
		childIdAttr:  "Id",
	})
}

func checkChannelsOutgoingWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Channels",
		parentIdAttr: "ChannelId",
		childName:    "OutgoingWebhooks",
		childIdAttr:  "Id",
	})
}

func checkChannelsPostsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Channels",
		parentIdAttr: "ChannelId",
		childName:    "Posts",
		childIdAttr:  "Id",
	})
}

func checkChannelsFileInfoIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Channels",
		parentIdAttr: "ChannelId",
		childName:    "FileInfo",
		childIdAttr:  "Id",
	})
}

func checkCommandsCommandWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Commands",
		parentIdAttr: "CommandId",
		childName:    "CommandWebhooks",
		childIdAttr:  "Id",
	})
}

func checkPostsFileInfoIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Posts",
		parentIdAttr: "PostId",
		childName:    "FileInfo",
		childIdAttr:  "Id",
	})
}

func checkPostsPostsRootIdIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:         "Posts",
		parentIdAttr:       "RootId",
		childName:          "Posts",
		childIdAttr:        "Id",
		canParentIdBeEmpty: true,
	})
}

func checkPostsReactionsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Posts",
		parentIdAttr: "PostId",
		childName:    "Reactions",
		childIdAttr:  "",
	})
}

func checkSchemesChannelsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:         "Schemes",
		parentIdAttr:       "SchemeId",
		childName:          "Channels",
		childIdAttr:        "Id",
		canParentIdBeEmpty: true,
	})
}

func checkSchemesTeamsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:         "Schemes",
		parentIdAttr:       "SchemeId",
		childName:          "Teams",
		childIdAttr:        "Id",
		canParentIdBeEmpty: true,
	})
}

func checkSessionsAuditsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:         "Sessions",
		parentIdAttr:       "SessionId",
		childName:          "Audits",
		childIdAttr:        "Id",
		canParentIdBeEmpty: true,
	})
}

func checkTeamsChannelsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	res1 := checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Teams",
		parentIdAttr: "TeamId",
		childName:    "Channels",
		childIdAttr:  "Id",
		filter:       sq.NotEq{"CT.Type": []model.ChannelType{model.ChannelTypeDirect, model.ChannelTypeGroup}},
	})
	res2 := checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:         "Teams",
		parentIdAttr:       "TeamId",
		childName:          "Channels",
		childIdAttr:        "Id",
		canParentIdBeEmpty: true,
		filter:             sq.Eq{"CT.Type": []model.ChannelType{model.ChannelTypeDirect, model.ChannelTypeGroup}},
	})
	data1 := res1.Data.(model.RelationalIntegrityCheckData)
	data2 := res2.Data.(model.RelationalIntegrityCheckData)
	data1.Records = append(data1.Records, data2.Records...)
	res1.Data = data1
	return res1
}

func checkTeamsCommandsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Teams",
		parentIdAttr: "TeamId",
		childName:    "Commands",
		childIdAttr:  "Id",
	})
}

func checkTeamsIncomingWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Teams",
		parentIdAttr: "TeamId",
		childName:    "IncomingWebhooks",
		childIdAttr:  "Id",
	})
}

func checkTeamsOutgoingWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Teams",
		parentIdAttr: "TeamId",
		childName:    "OutgoingWebhooks",
		childIdAttr:  "Id",
	})
}

func checkTeamsTeamMembersIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Teams",
		parentIdAttr: "TeamId",
		childName:    "TeamMembers",
		childIdAttr:  "",
	})
}

func checkUsersAuditsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:         "Users",
		parentIdAttr:       "UserId",
		childName:          "Audits",
		childIdAttr:        "Id",
		canParentIdBeEmpty: true,
	})
}

func checkUsersCommandWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "CommandWebhooks",
		childIdAttr:  "Id",
	})
}

func checkUsersChannelMemberHistoryIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "ChannelMemberHistory",
		childIdAttr:  "",
	})
}

func checkUsersChannelMembersIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "ChannelMembers",
		childIdAttr:  "",
	})
}

func checkUsersChannelsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:         "Users",
		parentIdAttr:       "CreatorId",
		childName:          "Channels",
		childIdAttr:        "Id",
		canParentIdBeEmpty: true,
	})
}

func checkUsersCommandsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "CreatorId",
		childName:    "Commands",
		childIdAttr:  "Id",
	})
}

func checkUsersCompliancesIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "Compliances",
		childIdAttr:  "Id",
	})
}

func checkUsersEmojiIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "CreatorId",
		childName:    "Emoji",
		childIdAttr:  "Id",
	})
}

func checkUsersFileInfoIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "CreatorId",
		childName:    "FileInfo",
		childIdAttr:  "Id",
	})
}

func checkUsersIncomingWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "IncomingWebhooks",
		childIdAttr:  "Id",
	})
}

func checkUsersOAuthAccessDataIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "OAuthAccessData",
		childIdAttr:  "Token",
	})
}

func checkUsersOAuthAppsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "CreatorId",
		childName:    "OAuthApps",
		childIdAttr:  "Id",
	})
}

func checkUsersOAuthAuthDataIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "OAuthAuthData",
		childIdAttr:  "Code",
	})
}

func checkUsersOutgoingWebhooksIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "CreatorId",
		childName:    "OutgoingWebhooks",
		childIdAttr:  "Id",
	})
}

func checkUsersPostsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "Posts",
		childIdAttr:  "Id",
	})
}

func checkUsersPreferencesIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "Preferences",
		childIdAttr:  "",
	})
}

func checkUsersReactionsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "Reactions",
		childIdAttr:  "",
	})
}

func checkUsersSessionsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "Sessions",
		childIdAttr:  "Id",
	})
}

func checkUsersStatusIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "Status",
		childIdAttr:  "",
	})
}

func checkUsersTeamMembersIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "TeamMembers",
		childIdAttr:  "",
	})
}

func checkUsersUserAccessTokensIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:   "Users",
		parentIdAttr: "UserId",
		childName:    "UserAccessTokens",
		childIdAttr:  "Id",
	})
}

func checkChannelsIntegrity(ss *SqlStore, results chan<- model.IntegrityCheckResult) {
	results <- checkChannelsCommandWebhooksIntegrity(ss)
	results <- checkChannelsChannelMemberHistoryIntegrity(ss)
	results <- checkChannelsChannelMembersIntegrity(ss)
	results <- checkChannelsIncomingWebhooksIntegrity(ss)
	results <- checkChannelsOutgoingWebhooksIntegrity(ss)
	results <- checkChannelsPostsIntegrity(ss)
	results <- checkChannelsFileInfoIntegrity(ss)
}

func checkCommandsIntegrity(ss *SqlStore, results chan<- model.IntegrityCheckResult) {
	results <- checkCommandsCommandWebhooksIntegrity(ss)
}

func checkPostsIntegrity(ss *SqlStore, results chan<- model.IntegrityCheckResult) {
	results <- checkPostsFileInfoIntegrity(ss)
	results <- checkPostsPostsRootIdIntegrity(ss)
	results <- checkPostsReactionsIntegrity(ss)
	results <- checkThreadsTeamsIntegrity(ss)
}

func checkSchemesIntegrity(ss *SqlStore, results chan<- model.IntegrityCheckResult) {
	results <- checkSchemesChannelsIntegrity(ss)
	results <- checkSchemesTeamsIntegrity(ss)
}

func checkSessionsIntegrity(ss *SqlStore, results chan<- model.IntegrityCheckResult) {
	results <- checkSessionsAuditsIntegrity(ss)
}

func checkTeamsIntegrity(ss *SqlStore, results chan<- model.IntegrityCheckResult) {
	results <- checkTeamsChannelsIntegrity(ss)
	results <- checkTeamsCommandsIntegrity(ss)
	results <- checkTeamsIncomingWebhooksIntegrity(ss)
	results <- checkTeamsOutgoingWebhooksIntegrity(ss)
	results <- checkTeamsTeamMembersIntegrity(ss)
}

func checkUsersIntegrity(ss *SqlStore, results chan<- model.IntegrityCheckResult) {
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

func checkThreadsTeamsIntegrity(ss *SqlStore) model.IntegrityCheckResult {
	return checkParentChildIntegrity(ss, relationalCheckConfig{
		parentName:         "Teams",
		parentIdAttr:       "ThreadTeamId",
		childName:          "Threads",
		childIdAttr:        "PostId",
		canParentIdBeEmpty: false,
	})
}

func CheckRelationalIntegrity(ss *SqlStore, results chan<- model.IntegrityCheckResult) {
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
