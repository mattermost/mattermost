// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func createChannel(ss store.Store, TeamId, CreatorId string) *model.Channel {
	m := model.Channel{}
	m.TeamId = TeamId
	m.CreatorId = CreatorId
	m.DisplayName = "Name"
	m.Name = "zz" + model.NewId() + "b"
	m.Type = model.CHANNEL_OPEN
	c, _ := ss.Channel().Save(&m, -1)
	return c
}

func createChannelWithTeamId(ss store.Store, id string) *model.Channel {
	return createChannel(ss, id, model.NewId());
}

func createChannelWithCreatorId(ss store.Store, id string) *model.Channel {
	return createChannel(ss, model.NewId(), id);
}

func createPost(ss store.Store, ChannelId, UserId string) *model.Post {
	m := model.Post{}
	m.ChannelId = ChannelId
	m.UserId = UserId
	m.Message = "zz" + model.NewId() + "b"
	p, _ := ss.Post().Save(&m)
	return p
}

func createPostWithChannelId(ss store.Store, id string) *model.Post {
	return createPost(ss, id, model.NewId());
}

func createPostWithUserId(ss store.Store, id string) *model.Post {
	return createPost(ss, model.NewId(), id);
}

func TestCheckIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		ss.DropAllTables()

		t.Run("generate reports with no records", func(t *testing.T) {
			results := ss.CheckIntegrity()
			require.NotNil(t, results)
			for result := range results {
				require.IsType(t, store.IntegrityCheckResult{}, result)
				require.Nil(t, result.Err)
				switch data := result.Data.(type) {
				case store.RelationalIntegrityCheckData:
					require.Len(t, data.Records, 0)
				}
			}
		})
	})
}

func TestCheckParentChildIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should receive an error", func(t *testing.T) {
			config := relationalCheckConfig{
				parentName: "NotValid",
				parentIdAttr: "NotValid",
				childName: "NotValid",
				childIdAttr: "NotValid",
			}
			result := checkParentChildIntegrity(dbmap, config)
			require.NotNil(t, result.Err)
			require.Empty(t, result.Data)
		})
	})
}

func TestCheckChannelsPostsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsPostsIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 0)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			post := createPostWithChannelId(ss, model.NewId())
			result := checkChannelsPostsIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: post.ChannelId,
				ChildId: post.Id,
			}, data.Records[0])
			dbmap.Delete(post)
		})
	})
}

func TestCheckUsersChannelsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersChannelsIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 0)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannelWithCreatorId(ss, model.NewId())
			result := checkUsersChannelsIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: channel.CreatorId,
				ChildId: channel.Id,
			}, data.Records[0])
			dbmap.Delete(channel)
		})
	})
}

func TestCheckUsersPostsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersPostsIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 0)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			post := createPostWithUserId(ss, model.NewId())
			result := checkUsersPostsIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: post.UserId,
				ChildId: post.Id,
			}, data.Records[0])
			dbmap.Delete(post)
		})
	})
}

func TestCheckTeamsChannelsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsChannelsIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 0)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannelWithTeamId(ss, model.NewId())
			result := checkTeamsChannelsIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: channel.TeamId,
				ChildId: channel.Id,
			}, data.Records[0])
			dbmap.Delete(channel)
		})
	})
}
