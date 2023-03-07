// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
)

// these system settings are created when running the data migrations,
// so they will be present after the tests setup.
var dataMigrationSystemSettings = map[string]string{
	"UniqueIDsMigrationComplete":      "true",
	"CategoryUuidIdMigrationComplete": "true",
}

func addBaseSettings(m map[string]string) map[string]string {
	r := map[string]string{}
	for k, v := range dataMigrationSystemSettings {
		r[k] = v
	}
	for k, v := range m {
		r[k] = v
	}
	return r
}

func StoreTestSystemStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("SetGetSystemSettings", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testSetGetSystemSettings(t, store)
	})
}

func testSetGetSystemSettings(t *testing.T, store store.Store) {
	t.Run("Get empty settings", func(t *testing.T) {
		settings, err := store.GetSystemSettings()
		require.NoError(t, err)
		require.Equal(t, dataMigrationSystemSettings, settings)
	})

	t.Run("Set, update and get multiple settings", func(t *testing.T) {
		err := store.SetSystemSetting("test-1", "test-value-1")
		require.NoError(t, err)
		err = store.SetSystemSetting("test-2", "test-value-2")
		require.NoError(t, err)
		settings, err := store.GetSystemSettings()
		require.NoError(t, err)
		require.Equal(t, addBaseSettings(map[string]string{"test-1": "test-value-1", "test-2": "test-value-2"}), settings)

		err = store.SetSystemSetting("test-2", "test-value-updated-2")
		require.NoError(t, err)
		settings, err = store.GetSystemSettings()
		require.NoError(t, err)
		require.Equal(t, addBaseSettings(map[string]string{"test-1": "test-value-1", "test-2": "test-value-updated-2"}), settings)
	})

	t.Run("Get a single setting", func(t *testing.T) {
		value, err := store.GetSystemSetting("test-1")
		require.NoError(t, err)
		require.Equal(t, "test-value-1", value)
	})
}
