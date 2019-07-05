// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/mlog"
)

type OrphanedRecord struct {
	ParentId string
	ChildId  string
}

type IntegrityCheckResult struct {
	ParentName string
	ChildName  string
	Records    []OrphanedRecord
}

func getOrphanedRecords(dbmap *gorp.DbMap, parent, child, parentIdAttr, childIdAttr string) ([]OrphanedRecord, error) {
	var records []OrphanedRecord

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

func printOrphanedRecords(records []OrphanedRecord, parent, child string) {
	fmt.Println(fmt.Sprintf("Found %d records of %s orphans of %s", len(records), child, parent))
	for _, record := range records {
		fmt.Println(fmt.Sprintf("	Child %s is orphan of Parent %s", record.ChildId, record.ParentId))
	}
}

func checkChannelsIntegrity(dbmap *gorp.DbMap) {
	var err error
	var records []OrphanedRecord
	records, err = getOrphanedRecords(dbmap, "Channels", "Posts", "ChannelId", "Id")
	if err != nil {
		mlog.Error(err.Error())
		return
	}
	printOrphanedRecords(records, "Channels", "Posts")
}

func checkUsersIntegrity(dbmap *gorp.DbMap) {

}

func checkTeamsIntegrity(dbmap *gorp.DbMap) {

}

func CheckRelationalIntegrity(dbmap *gorp.DbMap) {
	mlog.Info("Starting relational integrity checks...")
	checkChannelsIntegrity(dbmap)
	//checkUsersIntegrity(dbmap)
	//checkTeamsIntegrity(dbmap)
	mlog.Info("Done with relational integrity checks")
}
