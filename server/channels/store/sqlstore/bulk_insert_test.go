// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestBulkInsertChunking(t *testing.T) {
	StoreTest(t, testBulkInsertChunking)
}

// setMaxInsertParams overrides the max-insert-params threshold on the
// underlying SqlStore and returns a cleanup function that restores the default.
func setMaxInsertParams(t *testing.T, ss store.Store, maxParams int) {
	t.Helper()
	sqlStore := ss.(*SqlStore)
	sqlStore.maxInsertParams = maxParams
	t.Cleanup(func() { sqlStore.maxInsertParams = 0 })
}

func testBulkInsertChunking(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("ChannelMembers across multiple chunks", func(t *testing.T) {
		// 15 columns/row. With maxInsertParams=30, chunkSize=2,
		// so 5 members split into 3 chunks (2+2+1).
		setMaxInsertParams(t, ss, 30)

		team := &model.Team{
			DisplayName: "ChunkTest",
			Name:        storetest.NewTestID(),
			Email:       storetest.MakeEmail(),
			Type:        model.TeamOpen,
		}
		team, err := ss.Team().Save(team)
		require.NoError(t, err)

		channel := &model.Channel{
			DisplayName: "ChunkTest",
			Name:        "z-z-z" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		channel, err = ss.Channel().Save(rctx, channel, -1)
		require.NoError(t, err)

		const n = 5
		members := make([]*model.ChannelMember, n)
		defaultNotifyProps := model.GetDefaultChannelNotifyProps()
		for i := range members {
			u, uErr := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, uErr)
			members[i] = &model.ChannelMember{
				ChannelId:   channel.Id,
				UserId:      u.Id,
				NotifyProps: defaultNotifyProps,
			}
		}

		saved, err := ss.Channel().SaveMultipleMembers(members)
		require.NoError(t, err)
		require.Len(t, saved, n)

		for _, m := range saved {
			got, gErr := ss.Channel().GetMember(rctx, channel.Id, m.UserId)
			require.NoError(t, gErr)
			require.Equal(t, channel.Id, got.ChannelId)
		}
	})

	t.Run("ChannelMembers atomicity on conflict", func(t *testing.T) {
		// With chunkSize=2, inserting [A, B, B] produces chunks [A,B] and [B].
		// Chunk 1 succeeds; chunk 2 hits a unique constraint. The transaction
		// must roll back all chunks, leaving zero rows.
		setMaxInsertParams(t, ss, 30)

		team := &model.Team{
			DisplayName: "AtomicTest",
			Name:        storetest.NewTestID(),
			Email:       storetest.MakeEmail(),
			Type:        model.TeamOpen,
		}
		team, err := ss.Team().Save(team)
		require.NoError(t, err)

		channel := &model.Channel{
			DisplayName: "AtomicTest",
			Name:        "z-z-z" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
		}
		channel, err = ss.Channel().Save(rctx, channel, -1)
		require.NoError(t, err)

		users := make([]*model.User, 3)
		for i := range users {
			u, uErr := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, uErr)
			users[i] = u
		}

		defaultNotifyProps := model.GetDefaultChannelNotifyProps()
		members := []*model.ChannelMember{
			{ChannelId: channel.Id, UserId: users[0].Id, NotifyProps: defaultNotifyProps},
			{ChannelId: channel.Id, UserId: users[1].Id, NotifyProps: defaultNotifyProps},
			{ChannelId: channel.Id, UserId: users[1].Id, NotifyProps: defaultNotifyProps}, // duplicate
		}

		_, err = ss.Channel().SaveMultipleMembers(members)
		require.Error(t, err)

		// Verify none were persisted (transaction rolled back).
		_, gErr := ss.Channel().GetMember(rctx, channel.Id, users[0].Id)
		require.Error(t, gErr, "member from chunk 1 should not exist after rollback")
	})

	t.Run("TeamMembers across multiple chunks", func(t *testing.T) {
		// 8 columns/row. With maxInsertParams=16, chunkSize=2,
		// so 5 members split into 3 chunks (2+2+1).
		setMaxInsertParams(t, ss, 16)

		teamID := model.NewId()
		const n = 5
		members := make([]*model.TeamMember, n)
		for i := range members {
			u, uErr := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, uErr)
			members[i] = &model.TeamMember{TeamId: teamID, UserId: u.Id}
		}

		saved, err := ss.Team().SaveMultipleMembers(members, -1)
		require.NoError(t, err)
		require.Len(t, saved, n)

		for _, m := range saved {
			got, gErr := ss.Team().GetMember(rctx, teamID, m.UserId)
			require.NoError(t, gErr)
			require.Equal(t, teamID, got.TeamId)
		}
	})

	t.Run("TeamMembers atomicity on conflict", func(t *testing.T) {
		setMaxInsertParams(t, ss, 16)

		teamID := model.NewId()
		users := make([]*model.User, 3)
		for i := range users {
			u, uErr := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, uErr)
			users[i] = u
		}

		members := []*model.TeamMember{
			{TeamId: teamID, UserId: users[0].Id},
			{TeamId: teamID, UserId: users[1].Id},
			{TeamId: teamID, UserId: users[1].Id}, // duplicate
		}

		_, err := ss.Team().SaveMultipleMembers(members, -1)
		require.Error(t, err)

		_, gErr := ss.Team().GetMember(rctx, teamID, users[0].Id)
		require.Error(t, gErr, "member from chunk 1 should not exist after rollback")
	})

	t.Run("ThreadMemberships across multiple chunks", func(t *testing.T) {
		// 6 columns/row. With maxInsertParams=12, chunkSize=2,
		// so 5 memberships split into 3 chunks (2+2+1).
		setMaxInsertParams(t, ss, 12)

		const n = 5
		memberships := make([]*model.ThreadMembership, n)
		for i := range memberships {
			memberships[i] = &model.ThreadMembership{
				PostId:    model.NewId(),
				UserId:    model.NewId(),
				Following: true,
			}
		}

		saved, err := ss.Thread().SaveMultipleMemberships(memberships)
		require.NoError(t, err)
		require.Len(t, saved, n)

		for _, m := range saved {
			got, gErr := ss.Thread().GetMembershipForUser(m.UserId, m.PostId)
			require.NoError(t, gErr)
			require.Equal(t, m.PostId, got.PostId)
			require.Equal(t, m.UserId, got.UserId)
		}
	})

	t.Run("Posts across multiple chunks", func(t *testing.T) {
		// 18 columns/row. With maxInsertParams=36, chunkSize=2,
		// so 5 posts split into 3 chunks (2+2+1).
		setMaxInsertParams(t, ss, 36)

		channel := &model.Channel{
			DisplayName: "PostChunkTest",
			Name:        "z-z-z" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      model.NewId(),
		}
		channel, err := ss.Channel().Save(rctx, channel, -1)
		require.NoError(t, err)

		u, err := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
		require.NoError(t, err)

		const n = 5
		posts := make([]*model.Post, n)
		for i := range posts {
			posts[i] = &model.Post{
				ChannelId: channel.Id,
				UserId:    u.Id,
				Message:   "chunk test post",
			}
		}

		saved, _, err := ss.Post().SaveMultiple(rctx, posts)
		require.NoError(t, err)
		require.Len(t, saved, n)

		for _, p := range saved {
			got, gErr := ss.Post().GetSingle(rctx, p.Id, false)
			require.NoError(t, gErr)
			require.Equal(t, p.Id, got.Id)
		}
	})

	t.Run("Posts atomicity on conflict", func(t *testing.T) {
		// Use remote posts to allow pre-set IDs. With chunkSize=2,
		// posts [A, B, A-dup] produce chunks [A,B] and [A-dup].
		// Chunk 2 hits PK violation; transaction must roll back all.
		setMaxInsertParams(t, ss, 36)

		channel := &model.Channel{
			DisplayName: "PostAtomicTest",
			Name:        "z-z-z" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      model.NewId(),
		}
		channel, err := ss.Channel().Save(rctx, channel, -1)
		require.NoError(t, err)

		u, err := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
		require.NoError(t, err)

		remoteId := model.NewPointer(model.NewId())
		duplicateId := model.NewId()

		posts := []*model.Post{
			{Id: duplicateId, RemoteId: remoteId, ChannelId: channel.Id, UserId: u.Id, Message: "post A"},
			{Id: model.NewId(), RemoteId: remoteId, ChannelId: channel.Id, UserId: u.Id, Message: "post B"},
			{Id: duplicateId, RemoteId: remoteId, ChannelId: channel.Id, UserId: u.Id, Message: "post A dup"},
		}

		_, _, err = ss.Post().SaveMultiple(rctx, posts)
		require.Error(t, err)

		// Post from chunk 1 should not exist (transaction rolled back).
		_, gErr := ss.Post().GetSingle(rctx, duplicateId, false)
		require.Error(t, gErr, "post from chunk 1 should not exist after rollback")
	})

	t.Run("GroupMembers via CreateWithUserIds atomicity on conflict", func(t *testing.T) {
		// With chunkSize=2, userIds [A, B, B] produce chunks [A,B] and [B].
		// Chunk 2 hits unique constraint; transaction must roll back all
		// (including the group row itself).
		setMaxInsertParams(t, ss, 8)

		users := make([]*model.User, 2)
		for i := range users {
			u, uErr := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, uErr)
			users[i] = u
		}

		group := &model.GroupWithUserIds{
			Group: model.Group{
				DisplayName: "AtomicGroup",
				Name:        model.NewPointer("atomic-group-" + model.NewId()),
				Source:      model.GroupSourceCustom,
			},
			UserIds: []string{users[0].Id, users[1].Id, users[1].Id}, // duplicate
		}

		_, err := ss.Group().CreateWithUserIds(group)
		require.Error(t, err)
	})

	t.Run("Status upserts across multiple chunks", func(t *testing.T) {
		// 6 columns/row. With maxInsertParams=12, chunkSize=2,
		// so 5 statuses split into 3 chunks (2+2+1).
		setMaxInsertParams(t, ss, 12)

		const n = 5
		statuses := make(map[string]*model.Status, n)
		userIDs := make([]string, 0, n)
		for range n {
			u, uErr := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, uErr)
			statuses[u.Id] = &model.Status{
				UserId: u.Id,
				Status: model.StatusOnline,
				Manual: false,
			}
			userIDs = append(userIDs, u.Id)
		}

		err := ss.Status().SaveOrUpdateMany(statuses)
		require.NoError(t, err)

		for _, uid := range userIDs {
			got, gErr := ss.Status().Get(uid)
			require.NoError(t, gErr)
			require.Equal(t, model.StatusOnline, got.Status)
		}
	})

	t.Run("GroupMembers via CreateWithUserIds across chunks", func(t *testing.T) {
		// 4 columns/row. With maxInsertParams=8, chunkSize=2,
		// so 5 members split into 3 chunks (2+2+1).
		setMaxInsertParams(t, ss, 8)

		const n = 5
		userIDs := make([]string, n)
		for i := range userIDs {
			u, uErr := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, uErr)
			userIDs[i] = u.Id
		}

		group := &model.GroupWithUserIds{
			Group: model.Group{
				DisplayName: "ChunkGroup",
				Name:        model.NewPointer("chunk-group-" + model.NewId()),
				Source:      model.GroupSourceCustom,
			},
			UserIds: userIDs,
		}

		created, err := ss.Group().CreateWithUserIds(group)
		require.NoError(t, err)
		require.NotNil(t, created)

		members, err := ss.Group().GetMemberUsers(created.Id)
		require.NoError(t, err)
		require.Len(t, members, n)
	})

	t.Run("GroupMembers via UpsertMembers across chunks", func(t *testing.T) {
		// 4 columns/row. With maxInsertParams=8, chunkSize=2,
		// so 5 members split into 3 chunks (2+2+1).
		setMaxInsertParams(t, ss, 8)

		// Create a group first (with no members).
		group := &model.GroupWithUserIds{
			Group: model.Group{
				DisplayName: "UpsertGroup",
				Name:        model.NewPointer("upsert-group-" + model.NewId()),
				Source:      model.GroupSourceCustom,
			},
		}
		created, err := ss.Group().CreateWithUserIds(group)
		require.NoError(t, err)

		const n = 5
		userIDs := make([]string, n)
		for i := range userIDs {
			u, uErr := ss.User().Save(rctx, &model.User{Username: model.NewUsername(), Email: storetest.MakeEmail()})
			require.NoError(t, uErr)
			userIDs[i] = u.Id
		}

		upserted, err := ss.Group().UpsertMembers(created.Id, userIDs)
		require.NoError(t, err)
		require.Len(t, upserted, n)

		members, err := ss.Group().GetMemberUsers(created.Id)
		require.NoError(t, err)
		require.Len(t, members, n)
	})
}
