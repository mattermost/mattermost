// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/require"
)

func TestChannelStoreSharedChannels(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("SaveSharedChannel", func(t *testing.T) { testSaveSharedChannel(t, ss) })
	t.Run("GetSharedChannel", func(t *testing.T) { testGetSharedChannel(t, ss) })
	t.Run("GetSharedChannels", func(t *testing.T) { testGetSharedChannels(t, ss) })
	t.Run("UpdateSharedChannel", func(t *testing.T) { testUpdateSharedChannel(t, ss) })
	t.Run("DeleteSharedChannel", func(t *testing.T) { testDeleteSharedChannel(t, ss) })

	t.Run("SaveSharedChannelRemote", func(t *testing.T) { testSaveSharedChannelRemote(t, ss) })
	t.Run("GetSharedChannelRemote", func(t *testing.T) { testGetSharedChannelRemote(t, ss) })
	t.Run("GetSharedChannelRemotes", func(t *testing.T) { testGetSharedChannelRemotes(t, ss) })
	t.Run("DeleteSharedChannelRemote", func(t *testing.T) { testDeleteSharedChannelRemote(t, ss) })
}

func testSaveSharedChannel(t *testing.T, ss store.Store) {
	t.Run("Save shared channel", func(t *testing.T) {
		sc := &model.SharedChannel{
			ChannelId: model.NewId(),
			TeamId:    model.NewId(),
			CreatorId: model.NewId(),
			ShareName: "testshare",
		}

		scSaved, err := ss.Channel().SaveSharedChannel(sc)
		require.Nil(t, err, "couldn't save shared channel", err)

		require.Equal(t, sc.ChannelId, scSaved.ChannelId)
		require.Equal(t, sc.TeamId, scSaved.TeamId)
		require.Equal(t, sc.CreatorId, scSaved.CreatorId)
	})
}

func testGetSharedChannel(t *testing.T, ss store.Store) {
	sc := &model.SharedChannel{
		ChannelId: model.NewId(),
		TeamId:    model.NewId(),
		CreatorId: model.NewId(),
		ShareName: "testshare",
	}

	scSaved, err := ss.Channel().SaveSharedChannel(sc)
	require.Nil(t, err, "couldn't save shared channel", err)

	t.Run("Get existing shared channel", func(t *testing.T) {
		sc, err := ss.Channel().GetSharedChannel(scSaved.ChannelId)
		require.Nil(t, err, "couldn't get shared channel", err)

		require.Equal(t, sc.ChannelId, scSaved.ChannelId)
		require.Equal(t, sc.TeamId, scSaved.TeamId)
		require.Equal(t, sc.CreatorId, scSaved.CreatorId)
	})

	t.Run("Get non-existent shared channel", func(t *testing.T) {
		sc, err := ss.Channel().GetSharedChannel(model.NewId())
		require.NotNil(t, err)
		require.Nil(t, sc)
	})
}

func testGetSharedChannels(t *testing.T, ss store.Store) {
	creator := model.NewId()
	token := model.NewId()
	team1 := model.NewId()
	team2 := model.NewId()

	data := []model.SharedChannel{
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team1, ShareName: "test1", Home: true},
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team1, ShareName: "test2", Home: false},
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team1, ShareName: "test3", Home: false},
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team1, ShareName: "test4", Home: true},
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team2, ShareName: "test5", Home: true},
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team2, ShareName: "test6", Home: false},
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team2, ShareName: "test7", Home: false},
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team2, ShareName: "test8", Home: true},
		{ChannelId: model.NewId(), CreatorId: creator, Token: token, TeamId: team2, ShareName: "test9", Home: true},
	}

	for _, sc := range data {
		_, err := ss.Channel().SaveSharedChannel(&sc)
		require.Nil(t, err, "error saving shared channel")
	}

	t.Run("Get shared channels home only", func(t *testing.T) {
		opts := store.SharedChannelFilterOpts{
			ExcludeRemote: true,
			Token:         token,
		}

		count, err := ss.Channel().GetSharedChannelsCount(opts)
		require.Nil(t, err, "error getting shared channels count")

		remotes, err := ss.Channel().GetSharedChannels(0, 100, opts)
		require.Nil(t, err, "error getting shared channels")

		require.Equal(t, int(count), len(remotes))
		require.Len(t, remotes, 5, "should be 5 home channels")
		for _, sc := range remotes {
			require.True(t, sc.Home, "should be home channel")
		}
	})

	t.Run("Get shared channels remote only", func(t *testing.T) {
		opts := store.SharedChannelFilterOpts{
			ExcludeHome: true,
			Token:       token,
		}

		count, err := ss.Channel().GetSharedChannelsCount(opts)
		require.Nil(t, err, "error getting shared channels count")

		remotes, err := ss.Channel().GetSharedChannels(0, 100, opts)
		require.Nil(t, err, "error getting shared channels")

		require.Equal(t, int(count), len(remotes))
		require.Len(t, remotes, 4, "should be 4 remote channels")
		for _, sc := range remotes {
			require.False(t, sc.Home, "should be remote channel")
		}
	})

	t.Run("Get shared channels bad opts", func(t *testing.T) {
		opts := store.SharedChannelFilterOpts{
			ExcludeHome:   true,
			ExcludeRemote: true,
		}
		_, err := ss.Channel().GetSharedChannels(0, 100, opts)
		require.NotNil(t, err, "error expected")
	})

	t.Run("Get shared channels by token", func(t *testing.T) {
		opts := store.SharedChannelFilterOpts{
			Token: token,
		}

		count, err := ss.Channel().GetSharedChannelsCount(opts)
		require.Nil(t, err, "error getting shared channels count")

		remotes, err := ss.Channel().GetSharedChannels(0, 100, opts)
		require.Nil(t, err, "error getting shared channels")

		require.Equal(t, int(count), len(remotes))
		require.Len(t, remotes, 9, "should be 9 matching channels")
		for _, sc := range remotes {
			require.Equal(t, token, sc.Token)
		}
	})

	t.Run("Get shared channels by token and team", func(t *testing.T) {
		opts := store.SharedChannelFilterOpts{
			Token:  token,
			TeamId: team1,
		}

		count, err := ss.Channel().GetSharedChannelsCount(opts)
		require.Nil(t, err, "error getting shared channels count")

		remotes, err := ss.Channel().GetSharedChannels(0, 100, opts)
		require.Nil(t, err, "error getting shared channels")

		require.Equal(t, int(count), len(remotes))
		require.Len(t, remotes, 4, "should be 4 matching channels")
		for _, sc := range remotes {
			require.Equal(t, token, sc.Token)
			require.Equal(t, team1, sc.TeamId)
		}
	})
}

func testGetSharedChannelsCount(t *testing.T, ss store.Store) {
	t.Error("not implemented yet")
}

func testUpdateSharedChannel(t *testing.T, ss store.Store) {
	t.Error("not implemented yet")
}

func testDeleteSharedChannel(t *testing.T, ss store.Store) {
	channelId := model.NewId()

	sc := &model.SharedChannel{
		ChannelId: channelId,
		TeamId:    model.NewId(),
		CreatorId: model.NewId(),
		ShareName: "testshare",
	}

	_, err := ss.Channel().SaveSharedChannel(sc)
	require.Nil(t, err, "couldn't save shared channel", err)

	t.Run("Delete existing shared channel", func(t *testing.T) {
		deleted, err := ss.Channel().DeleteSharedChannel(channelId)
		require.Nil(t, err, "delete existing shared channel should not error", err)
		require.True(t, deleted, "expected true from delete shared channel")
	})

	t.Run("Delete non-existent shared channel", func(t *testing.T) {
		deleted, err := ss.Channel().DeleteSharedChannel(model.NewId())
		require.Nil(t, err, "delete non-existent shared channel should not error", err)
		require.False(t, deleted, "expected false from delete shared channel")
	})
}

func testSaveSharedChannelRemote(t *testing.T, ss store.Store) {
	t.Error("not implemented yet")
}

func testGetSharedChannelRemote(t *testing.T, ss store.Store) {
	t.Error("not implemented yet")
}

func testGetSharedChannelRemotes(t *testing.T, ss store.Store) {
	t.Error("not implemented yet")
}

func testDeleteSharedChannelRemote(t *testing.T, ss store.Store) {
	t.Error("not implemented yet")
}
