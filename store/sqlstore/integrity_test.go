// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func createChannel(ss store.Store) *model.Channel {
	teamId := model.NewId()
	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	c, _ := ss.Channel().Save(&o1, -1)
	return c
}

func createPost(ss store.Store) *model.Post {
	o1 := model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	p, _ := ss.Post().Save(&o1)
	return p
}

func TestStoreCheckIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		ss.DropAllTables()
		t.Run("there should be no orphaned records on new db", func(t *testing.T) {
			results := ss.CheckIntegrity()
			require.NotNil(t, results)
			for result := range results {
				require.IsType(t, store.IntegrityCheckResult{}, result)
				require.Nil(t, result.Err)
				require.Empty(t, result.Records)
			}
			createPost(ss)
		})
	})
}

func TestCheckChannelsPostsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		ss.DropAllTables()
		dbmap.DropTable(model.Channel{})

		t.Run("should fail with an error", func(t *testing.T) {
			results := make(chan store.IntegrityCheckResult)
			go checkChannelsPostsIntegrity(dbmap, results)
			result := <-results
			require.NotNil(t, result.Err)
			close(results)
		})

		dbmap.CreateTablesIfNotExists()
	})
}

func TestIntegrityGetOrphanedRecords(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()
		info := store.IntegrityRelationInfo{}

		ss.DropAllTables()

		t.Run("should fail with an error", func(t *testing.T) {
			records, err := getOrphanedRecords(dbmap, info)
			require.NotNil(t, err)
			require.Nil(t, records)
		})

		t.Run("there should be no orphaned records on new db", func(t *testing.T) {
			info.ParentName = "Channels"
			info.ChildName = "Posts"
			info.ParentIdAttr = "ChannelId"
			info.ChildIdAttr = "Id"
			records, err := getOrphanedRecords(dbmap, info)
			require.Nil(t, err)
			require.Empty(t, records)
		})

		t.Run("there should be one orphaned record", func(t *testing.T) {
			post := createPost(ss)
			records, err := getOrphanedRecords(sqlStore.GetMaster(), info)
			require.Nil(t, err)
			require.Len(t, records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: post.ChannelId,
				ChildId: post.Id,
			}, records[0])
		})
	})
}
