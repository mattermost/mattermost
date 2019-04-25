// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/require"
)

func TestStoreUpgrade(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)

		t.Run("invalid currentModelVersion", func(t *testing.T) {
			err := UpgradeDatabase(sqlStore, "notaversion")
			require.EqualError(t, err, "failed to parse current model version notaversion: No Major.Minor.Patch elements found")
		})

		t.Run("upgrade from invalid version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "invalid")
			err := UpgradeDatabase(sqlStore, "5.8.0")
			require.EqualError(t, err, "failed to parse database schema version invalid: No Major.Minor.Patch elements found")
			require.Equal(t, "invalid", sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade from unsupported version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "2.0.0")
			err := UpgradeDatabase(sqlStore, "5.8.0")
			require.EqualError(t, err, "Database schema version 2.0.0 is no longer supported. This Mattermost server supports automatic upgrades from schema version 3.0.0 through schema version 5.8.0. Please manually upgrade to at least version 3.0.0 before continuing.")
			require.Equal(t, "2.0.0", sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade from earliest supported version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, VERSION_3_0_0)
			err := UpgradeDatabase(sqlStore, model.CurrentVersion)
			require.NoError(t, err)
			require.Equal(t, model.CurrentVersion, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade from no existing version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "")
			err := UpgradeDatabase(sqlStore, model.CurrentVersion)
			require.NoError(t, err)
			require.Equal(t, model.CurrentVersion, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade schema running earlier minor version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "5.1.0")
			err := UpgradeDatabase(sqlStore, "5.8.0")
			require.NoError(t, err)
			// Assert model.CurrentVersion, not 5.8.0, since the migrations will move
			// past 5.8.0 regardless of the input parameter.
			require.Equal(t, model.CurrentVersion, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade schema running later minor version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "5.29.0")
			err := UpgradeDatabase(sqlStore, "5.8.0")
			require.NoError(t, err)
			require.Equal(t, "5.29.0", sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade schema running earlier major version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "4.1.0")
			err := UpgradeDatabase(sqlStore, model.CurrentVersion)
			require.NoError(t, err)
			require.Equal(t, model.CurrentVersion, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("upgrade schema running later major version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, "6.0.0")
			err := UpgradeDatabase(sqlStore, "5.8.0")
			require.EqualError(t, err, "Database schema version 6.0.0 is not supported. This Mattermost server supports only >=5.8.0, <6.0.0. Please upgrade to at least version 6.0.0 before continuing.")
			require.Equal(t, "6.0.0", sqlStore.GetCurrentSchemaVersion())
		})
	})
}

func TestSaveSchemaVersion(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*store.LayeredStore).DatabaseLayer.(SqlStore)

		t.Run("set earliest version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, VERSION_3_0_0)
			result := <-ss.System().Get()
			require.Nil(t, result.Err)

			props := result.Data.(model.StringMap)
			require.Equal(t, VERSION_3_0_0, props["Version"])
			require.Equal(t, VERSION_3_0_0, sqlStore.GetCurrentSchemaVersion())
		})

		t.Run("set current version", func(t *testing.T) {
			saveSchemaVersion(sqlStore, model.CurrentVersion)
			result := <-ss.System().Get()
			require.Nil(t, result.Err)

			props := result.Data.(model.StringMap)
			require.Equal(t, model.CurrentVersion, props["Version"])
			require.Equal(t, model.CurrentVersion, sqlStore.GetCurrentSchemaVersion())
		})
	})
}
