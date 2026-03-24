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

func testBulkInsertChunking(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("ChannelMembers across multiple chunks", func(t *testing.T) {
		// 15 columns/row. With maxInsertParams=30, chunkSize=2,
		// so 5 members split into 3 chunks (2+2+1).
		orig := maxInsertParams
		maxInsertParams = 30
		defer func() { maxInsertParams = orig }()

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

	t.Run("TeamMembers across multiple chunks", func(t *testing.T) {
		// 8 columns/row. With maxInsertParams=16, chunkSize=2,
		// so 5 members split into 3 chunks (2+2+1).
		orig := maxInsertParams
		maxInsertParams = 16
		defer func() { maxInsertParams = orig }()

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

	t.Run("ThreadMemberships across multiple chunks", func(t *testing.T) {
		// 6 columns/row. With maxInsertParams=12, chunkSize=2,
		// so 5 memberships split into 3 chunks (2+2+1).
		orig := maxInsertParams
		maxInsertParams = 12
		defer func() { maxInsertParams = orig }()

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
}
