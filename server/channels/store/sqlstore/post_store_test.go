// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchtest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestPostStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPostStore)
}

func TestSearchPostStore(t *testing.T) {
	StoreTestWithSearchTestEngine(t, searchtest.TestSearchPostStore)
}

func TestDetermineMaxPostSize(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	t.Cleanup(store.Close)

	setColLength := func(t *testing.T, size int) {
		t.Helper()
		_, alterErr := store.GetMaster().ExecNoTimeout(fmt.Sprintf("ALTER TABLE posts ALTER COLUMN message TYPE VARCHAR(%d)", size))
		require.NoError(t, alterErr)
	}
	t.Cleanup(func() { setColLength(t, model.PostMessageMaxBytesV2) })

	postStore := store.Post().(*SqlPostStore)

	for _, tc := range []struct {
		columnBytes  int
		expectedSize int
	}{
		{model.PostMessageMaxBytesV2, model.PostMessageMaxRunesV2},
		{model.PostMessageMaxBytesV3, model.PostMessageMaxRunesV3},
	} {
		t.Run(fmt.Sprintf("VARCHAR(%d)", tc.columnBytes), func(t *testing.T) {
			setColLength(t, tc.columnBytes)
			assert.Equal(t, tc.expectedSize, postStore.determineMaxPostSize())
		})
	}
}
