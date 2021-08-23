// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func TestStoreUpgradeDotRelease(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*SqlStore)
		saveSchemaVersion(sqlStore, "5.33.1")
		err := upgradeDatabase(sqlStore, CurrentSchemaVersion)
		require.NoError(t, err)
		require.Equal(t, CurrentSchemaVersion, sqlStore.GetCurrentSchemaVersion())
	})
}

func TestStoreUpgrade(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*SqlStore)

		t.Run("invalid currentModelVersion", func(t *testing.T) {
			err := upgradeDatabase(sqlStore, "notaversion")
			require.EqualError(t, err, "failed to parse current model version notaversion: No Major.Minor.Patch elements found")
		})

		t.Run("upgrade from invalid version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "invalid")
			err := upgradeDatabase(sqlStore, "5.8.0")
			require.EqualError(t, err, "failed to parse database schema version invalid: No Major.Minor.Patch elements found")
			require.Equal(t, "invalid", sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade from unsupported version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "2.0.0")
			err := upgradeDatabase(sqlStore, "5.8.0")
			require.EqualError(t, err, "Database schema version 2.0.0 is no longer supported. This Mattermost server supports automatic upgrades from schema version 3.0.0 through schema version 5.8.0. Please manually upgrade to at least version 3.0.0 before continuing.")
			require.Equal(t, "2.0.0", sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade from earliest supported version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, Version300)
			err := upgradeDatabase(sqlStore, CurrentSchemaVersion)
			require.NoError(t, err)
			require.Equal(t, CurrentSchemaVersion, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade from no existing version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "")
			err := upgradeDatabase(sqlStore, CurrentSchemaVersion)
			require.NoError(t, err)
			require.Equal(t, CurrentSchemaVersion, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade schema running earlier minor version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "5.1.0")
			err := upgradeDatabase(sqlStore, "5.8.0")
			require.NoError(t, err)
			// Assert CurrentSchemaVersion, not 5.8.0, since the migrations will move
			// past 5.8.0 regardless of the input parameter.
			require.Equal(t, CurrentSchemaVersion, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade schema running later minor version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "5.99.0")
			err := upgradeDatabase(sqlStore, "5.8.0")
			require.NoError(t, err)
			require.Equal(t, "5.99.0", sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade schema running earlier major version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "4.1.0")
			err := upgradeDatabase(sqlStore, CurrentSchemaVersion)
			require.NoError(t, err)
			require.Equal(t, CurrentSchemaVersion, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade schema running later major version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "6.0.0")
			err := upgradeDatabase(sqlStore, "5.8.0")
			require.EqualError(t, err, "Database schema version 6.0.0 is not supported. This Mattermost server supports only >=5.8.0, <6.0.0. Please upgrade to at least version 6.0.0 before continuing.")
			require.Equal(t, "6.0.0", sqlStore.GetCurrentSchemaVersion())
		})
	})
}

func TestSaveSchemaVersion(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*SqlStore)

		t.Run("set earliest version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, Version300)
			props, err := ss.System().Get()
			require.NoError(t, err)

			require.Equal(t, Version300, props["Version"])
			require.Equal(t, Version300, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("set current version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, CurrentSchemaVersion)
			props, err := ss.System().Get()
			require.NoError(t, err)

			require.Equal(t, CurrentSchemaVersion, props["Version"])
			require.Equal(t, CurrentSchemaVersion, sqlStore.GetCurrentSchemaVersion())
		})
	})
}
func createChannelMemberWithLastViewAt(ss store.Store, channelId, userId string, lastViewAt int64) *model.ChannelMember {
	m := model.ChannelMember{}
	m.ChannelId = channelId
	m.UserId = userId
	m.LastViewedAt = lastViewAt
	m.NotifyProps = model.GetDefaultChannelNotifyProps()
	cm, _ := ss.Channel().SaveMember(&m)
	return cm
}
func createPostWithTimestamp(ss store.Store, channelId, userId, rootId, parentId string, timestamp int64) *model.Post {
	m := model.Post{}
	m.CreateAt = timestamp
	m.ChannelId = channelId
	m.UserId = userId
	m.RootId = rootId
	m.ParentId = parentId
	m.Message = "zz" + model.NewId() + "b"
	p, _ := ss.Post().Save(&m)
	return p
}

func createChannelWithLastPostAt(ss store.Store, teamId, creatorId string, lastPostAt, msgCount, rootCount int64) (*model.Channel, error) {
	m := model.Channel{}
	m.TeamId = teamId
	m.TotalMsgCount = msgCount
	m.TotalMsgCountRoot = rootCount
	m.LastPostAt = lastPostAt
	m.CreatorId = creatorId
	m.DisplayName = "Name"
	m.Name = "zz" + model.NewId() + "b"
	m.Type = model.CHANNEL_OPEN
	return ss.Channel().Save(&m, -1)
}
