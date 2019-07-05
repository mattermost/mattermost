// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/store"
)

func getOrphanedRecords(dbmap *gorp.DbMap, parent, child, parentIdAttr, childIdAttr string) ([]store.OrphanedRecord, error) {
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
	`, parentIdAttr, childIdAttr, child, parent, parent, child, parentIdAttr)

	_, err := dbmap.Select(&records, query)

	return records, err
}

func checkChannelsIntegrity(dbmap *gorp.DbMap, results chan<- store.IntegrityCheckResult) {
	var err error
	var records []store.OrphanedRecord
	var result store.IntegrityCheckResult

	records, err = getOrphanedRecords(dbmap, "Channels", "Posts", "ChannelId", "Id")
	if err != nil {
		mlog.Error(err.Error())
	}

	result.ParentName = "Channels"
	result.ChildName = "Posts"
	result.Records = records
	result.Err = err

	results <- result
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
