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
	t.Run("GetSharedChannelsCount", func(t *testing.T) { testGetSharedChannelsCount(t, ss) })
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
	t.Error("not implemented yet")
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
