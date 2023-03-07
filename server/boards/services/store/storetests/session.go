// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
)

func StoreTestSessionStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("CreateAndGetAndDeleteSession", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testCreateAndGetAndDeleteSession(t, store)
	})

	t.Run("GetActiveUserCount", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetActiveUserCount(t, store)
	})

	t.Run("UpdateSession", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testUpdateSession(t, store)
	})
}

func testCreateAndGetAndDeleteSession(t *testing.T, store store.Store) {
	session := &model.Session{
		ID:    "session-id",
		Token: "token",
	}

	t.Run("CreateAndGetSession", func(t *testing.T) {
		err := store.CreateSession(session)
		require.NoError(t, err)

		got, err := store.GetSession(session.Token, 60*60)
		require.NoError(t, err)
		require.Equal(t, session, got)
	})

	t.Run("Get nonexistent session", func(t *testing.T) {
		got, err := store.GetSession("nonexistent-token", 60*60)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, got)
	})

	t.Run("DeleteAndGetSession", func(t *testing.T) {
		err := store.DeleteSession(session.ID)
		require.NoError(t, err)

		_, err = store.GetSession(session.Token, 60*60)
		require.Error(t, err)
	})
}

func testGetActiveUserCount(t *testing.T, store store.Store) {
	t.Run("no active user", func(t *testing.T) {
		count, err := store.GetActiveUserCount(60)
		require.NoError(t, err)
		require.Equal(t, 0, count)
	})

	t.Run("active user", func(t *testing.T) {
		// gen random count active user session
		count := int(time.Now().Unix() % 10)
		for i := 0; i < count; i++ {
			session := &model.Session{
				ID:     fmt.Sprintf("id-%d", i),
				UserID: fmt.Sprintf("user-id-%d", i),
				Token:  fmt.Sprintf("token-%d", i),
			}
			err := store.CreateSession(session)
			require.NoError(t, err)
		}

		got, err := store.GetActiveUserCount(60)
		require.NoError(t, err)
		require.Equal(t, count, got)
	})
}

func testUpdateSession(t *testing.T, store store.Store) {
	session := &model.Session{
		ID:    "session-id",
		Token: "token",
		Props: map[string]interface{}{"field1": "A"},
	}

	err := store.CreateSession(session)
	require.NoError(t, err)

	// update session
	session.Props["field1"] = "B"
	err = store.UpdateSession(session)
	require.NoError(t, err)

	got, err := store.GetSession(session.Token, 60)
	require.NoError(t, err)
	require.Equal(t, session, got)
}
