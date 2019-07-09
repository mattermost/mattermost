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
	config.childIdAttr = ""
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

func checkUsersIncomingWebhooksIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "IncomingWebhooks"
	config.childIdAttr = "Id"
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

func checkUsersSessionsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "Sessions"
	config.childIdAttr = "Id"
	return checkParentChildIntegrity(dbmap, config)
}

func checkUsersTeamMembersIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	var config relationalCheckConfig
	config.parentName = "Users"
	config.parentIdAttr = "UserId"
	config.childName = "TeamMembers"
	return checkParentChildIntegrity(dbmap, config)
}

func checkChannelsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkChannelsCommandWebhooksIntegrity(dbmap)
	results <- checkChannelsChannelMemberHistoryIntegrity(dbmap)
	results <- checkChannelsChannelMembersIntegrity(dbmap)
	results <- checkChannelsIncomingWebhooksIntegrity(dbmap)
	results <- checkChannelsPostsIntegrity(dbmap)
}

func checkCommandsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkCommandsCommandWebhooksIntegrity(dbmap)
}

func checkTeamsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkTeamsChannelsIntegrity(dbmap)
	results <- checkTeamsCommandsIntegrity(dbmap)
	results <- checkTeamsIncomingWebhooksIntegrity(dbmap)
	results <- checkTeamsOutgoingWebhooksIntegrity(dbmap)
	results <- checkTeamsTeamMembersIntegrity(dbmap)
}

func checkUsersIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkUsersCommandWebhooksIntegrity(dbmap)
	results <- checkUsersChannelMemberHistoryIntegrity(dbmap)
	results <- checkUsersChannelMembersIntegrity(dbmap)
	results <- checkUsersChannelsIntegrity(dbmap)
	results <- checkUsersCommandsIntegrity(dbmap)
	results <- checkUsersIncomingWebhooksIntegrity(dbmap)
	results <- checkUsersOutgoingWebhooksIntegrity(dbmap)
	results <- checkUsersPostsIntegrity(dbmap)
	results <- checkUsersSessionsIntegrity(dbmap)
	results <- checkUsersTeamMembersIntegrity(dbmap)
}

func CheckRelationalIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	mlog.Info("Starting relational integrity checks...")
	checkChannelsIntegrity(dbmap, results)
	checkCommandsIntegrity(dbmap, results)
	checkTeamsIntegrity(dbmap, results)
	checkUsersIntegrity(dbmap, results)
	mlog.Info("Done with relational integrity checks")
	close(results)
}
