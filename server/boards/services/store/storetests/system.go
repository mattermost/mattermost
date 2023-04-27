// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
)

func StoreTestSystemStore(t *testing.T, runStoreTests func(*testing.T, func(*testing.T, store.Store))) {
	t.Run("SetGetSystemSettings", func(t *testing.T) {
		runStoreTests(t, testSetGetSystemSettings)
	})
}

func testSetGetSystemSettings(t *testing.T, store store.Store) {
	t.Run("Get empty settings", func(t *testing.T) {
		settings, err := store.GetSystemSettings()
		require.NoError(t, err)
		// although data migrations would usually write some settings
		// to the table on store initialization, we're cleaning all
		// tables before store tests, so the initial result should
		// come back empty
		require.Empty(t, settings)
	})

	t.Run("Set, update and get multiple settings", func(t *testing.T) {
		err := store.SetSystemSetting("test-1", "test-value-1")
		require.NoError(t, err)
		err = store.SetSystemSetting("test-2", "test-value-2")
		require.NoError(t, err)
		settings, err := store.GetSystemSettings()
		require.NoError(t, err)
		require.Equal(t, map[string]string{"test-1": "test-value-1", "test-2": "test-value-2"}, settings)

		err = store.SetSystemSetting("test-2", "test-value-updated-2")
		require.NoError(t, err)
		settings, err = store.GetSystemSettings()
		require.NoError(t, err)
		require.Equal(t, map[string]string{"test-1": "test-value-1", "test-2": "test-value-updated-2"}, settings)
	})

	t.Run("Get a single setting", func(t *testing.T) {
		value, err := store.GetSystemSetting("test-1")
		require.NoError(t, err)
		require.Equal(t, "test-value-1", value)
	})
}
