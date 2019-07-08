// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func createChannel(ss store.Store, teamId, creatorId string) *model.Channel {
	m := model.Channel{}
	m.TeamId = teamId
	m.CreatorId = creatorId
	m.DisplayName = "Name"
	m.Name = "zz" + model.NewId() + "b"
	m.Type = model.CHANNEL_OPEN
	c, _ := ss.Channel().Save(&m, -1)
	return c
}

func createChannelMember(ss store.Store, channelId, userId string) *model.ChannelMember {
	m := model.ChannelMember{}
	m.ChannelId = channelId
	m.UserId = userId
	m.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m))
	return &m
}

func createChannelWithTeamId(ss store.Store, id string) *model.Channel {
	return createChannel(ss, id, model.NewId());
}

func createChannelWithCreatorId(ss store.Store, id string) *model.Channel {
	return createChannel(ss, model.NewId(), id);
}

func createChannelMemberWithChannelId(ss store.Store, id string) *model.ChannelMember {
	return createChannelMember(ss, id, model.NewId());
}

func createChannelMemberWithUserId(ss store.Store, id string) *model.ChannelMember {
	return createChannelMember(ss, model.NewId(), id);
}

func createPost(ss store.Store, channelId, userId string) *model.Post {
	m := model.Post{}
	m.ChannelId = channelId
	m.UserId = userId
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

func createTeam(ss store.Store, userId string) *model.Team {
	m := model.Team{}
	m.DisplayName = "DisplayName"
	m.Type = model.TEAM_OPEN
	m.Email = "test@example.com"
	m.Name = "z-z-z" + model.NewId() + "b"
	t, _ := ss.Team().Save(&m)
	return t
}

func createTeamMember(ss store.Store, teamId, userId string) *model.TeamMember {
	m := model.TeamMember{}
	m.TeamId = teamId
	m.UserId = userId
	store.Must(ss.Team().SaveMember(&m, -1))
	return &m
}

func createUser(ss store.Store) *model.User {
	m := model.User{}
	m.Username = model.NewId()
	m.Email = "test@example.com"
	store.Must(ss.User().Save(&m))
	return &m
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

func TestCheckChannelsChannelMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsChannelMembersIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 0)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannel(ss, model.NewId(), model.NewId())
			member := createChannelMemberWithChannelId(ss, channel.Id)
			dbmap.Delete(channel)
			result := checkChannelsChannelMembersIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: member.ChannelId,
			}, data.Records[0])
			ss.Channel().PermanentDeleteMembersByUser(member.UserId)
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

func TestCheckTeamsTeamMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsTeamMembersIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 0)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			team := createTeam(ss, model.NewId())
			member := createTeamMember(ss, team.Id, model.NewId())
			dbmap.Delete(team)
			result := checkTeamsTeamMembersIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: team.Id,
			}, data.Records[0])
			ss.Team().RemoveAllMembersByTeam(member.TeamId)
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

func TestCheckUsersChannelMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersChannelMembersIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 0)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			channel := createChannelWithCreatorId(ss, user.Id)
			member := createChannelMember(ss, channel.Id, user.Id)
			dbmap.Delete(user)
			result := checkUsersChannelMembersIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: member.UserId,
			}, data.Records[0])
			dbmap.Delete(channel)
			ss.Channel().PermanentDeleteMembersByUser(member.UserId)
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

func TestCheckUsersTeamMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)
		dbmap := sqlStore.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersTeamMembersIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 0)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			team := createTeam(ss, user.Id)
			member := createTeamMember(ss, team.Id, user.Id)
			dbmap.Delete(user)
			result := checkUsersTeamMembersIntegrity(dbmap)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: member.UserId,
			}, data.Records[0])
			ss.Team().RemoveAllMembersByTeam(member.TeamId)
			dbmap.Delete(team)
		})
	})
}
