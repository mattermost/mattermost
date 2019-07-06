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

func checkChannelsPostsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	var result store.IntegrityCheckResult

	result.Info.ParentName = "Channels"
	result.Info.ChildName = "Posts"
	result.Info.ParentIdAttr = "ChannelId"
	result.Info.ChildIdAttr = "Id"
	result.Records, result.Err = getOrphanedRecords(dbmap, result.Info)
	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	results <- result
}

func checkChannelsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	checkChannelsPostsIntegrity(dbmap, results)
}

func checkUsersIntegrity(dbmap *gorp.DbMap) {

}

func checkTeamsIntegrity(dbmap *gorp.DbMap) {

}

func CheckRelationalIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	mlog.Info("Starting relational integrity checks...")
	checkChannelsIntegrity(dbmap, results)
	//checkUsersIntegrity(dbmap)
	//checkTeamsIntegrity(dbmap)
	mlog.Info("Done with relational integrity checks")
	close(results)
}
