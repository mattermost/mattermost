// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/store"
)

func getOrphanedRecords(dbmap *gorp.DbMap, info store.RelationalIntegrityCheckData) ([]store.OrphanedRecord, error) {
	var records []store.OrphanedRecord

	query := fmt.Sprintf(`
		SELECT
  		%s AS ParentId, %s AS ChildId
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
		AND (%s IS NOT NULL AND %s != '')
		ORDER BY
			%s
	`, info.ParentIdAttr, info.ChildIdAttr, info.ChildName,
		info.ParentName, info.ChildName, info.ParentIdAttr,
		info.ParentIdAttr, info.ParentIdAttr, info.ParentIdAttr)

	_, err := dbmap.Select(&records, query)

	return records, err
}

func checkParentChildIntegrity(dbmap *gorp.DbMap, parentName, childName, parentIdAttr, childIdAttr string) store.IntegrityCheckResult {
	var result store.IntegrityCheckResult
	var data store.RelationalIntegrityCheckData

	data.ParentName = parentName
	data.ChildName = childName
	data.ParentIdAttr = parentIdAttr
	data.ChildIdAttr = childIdAttr
	data.Records, result.Err = getOrphanedRecords(dbmap, data)
	if result.Err != nil {
		mlog.Error(result.Err.Error())
		return result
	}
	result.Data = data

	return result
}

func checkChannelsPostsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	return checkParentChildIntegrity(dbmap, "Channels", "Posts", "ChannelId", "Id")
}

func checkUsersChannelsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	return checkParentChildIntegrity(dbmap, "Users", "Channels", "CreatorId", "Id")
}

func checkUsersPostsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	return checkParentChildIntegrity(dbmap, "Users", "Posts", "UserId", "Id")
}

func checkTeamsChannelsIntegrity(dbmap *gorp.DbMap) store.IntegrityCheckResult {
	return checkParentChildIntegrity(dbmap, "Teams", "Channels", "TeamId", "Id")
}

func checkChannelsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkChannelsPostsIntegrity(dbmap)
}

func checkUsersIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkUsersChannelsIntegrity(dbmap)
	results <- checkUsersPostsIntegrity(dbmap)
}

func checkTeamsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	results <- checkTeamsChannelsIntegrity(dbmap)
}

func CheckRelationalIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	mlog.Info("Starting relational integrity checks...")
	checkChannelsIntegrity(dbmap, results)
	checkUsersIntegrity(dbmap, results)
	checkTeamsIntegrity(dbmap, results)
	mlog.Info("Done with relational integrity checks")
	close(results)
}
