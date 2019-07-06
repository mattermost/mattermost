// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/store"
)

func getOrphanedRecords(dbmap *gorp.DbMap, info store.IntegrityRelationInfo) ([]store.OrphanedRecord, error) {
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
				%s.id = %s.%s
		)
		ORDER BY
			%s
	`, info.ParentIdAttr, info.ChildIdAttr, info.ChildName,
		info.ParentName, info.ParentName, info.ChildName, info.ParentIdAttr, info.ParentIdAttr)

	_, err := dbmap.Select(&records, query)

	return records, err
}

func checkParentChildIntegrity(dbmap *gorp.DbMap, parentName, childName, parentIdAttr, childIdAttr string) store.IntegrityCheckResult {
	var result store.IntegrityCheckResult

	result.Info.ParentName = parentName
	result.Info.ChildName = childName
	result.Info.ParentIdAttr = parentIdAttr
	result.Info.ChildIdAttr = childIdAttr
	result.Records, result.Err = getOrphanedRecords(dbmap, result.Info)
	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	return result
}

func checkChannelsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	var result store.IntegrityCheckResult

	result = checkParentChildIntegrity(dbmap, "Channels", "Posts", "ChannelId", "Id")
	results <- result
}

func checkUsersIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	var result store.IntegrityCheckResult

	result = checkParentChildIntegrity(dbmap, "Users", "Posts", "UserId", "Id")
	results <- result
}

func checkTeamsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	var result store.IntegrityCheckResult

	result = checkParentChildIntegrity(dbmap, "Teams", "Channels", "TeamId", "Id")
	results <- result
}

func CheckRelationalIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	mlog.Info("Starting relational integrity checks...")
	checkChannelsIntegrity(dbmap, results)
	checkUsersIntegrity(dbmap, results)
	checkTeamsIntegrity(dbmap, results)
	mlog.Info("Done with relational integrity checks")
	close(results)
}
