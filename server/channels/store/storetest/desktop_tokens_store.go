// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDesktopTokensStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("GetUserId", func(t *testing.T) { testGetUserId(t, ss) })
	t.Run("Insert", func(t *testing.T) { testInsert(t, ss) })
	t.Run("SetUserId", func(t *testing.T) { testSetUserId(t, ss) })
	t.Run("Delete", func(t *testing.T) { testDeleteToken(t, ss) })
	t.Run("DeleteByUserId", func(t *testing.T) { testDeleteByUserId(t, ss) })
	t.Run("DeleteOlderThan", func(t *testing.T) { testDeleteOlderThan(t, ss) })
}

func testGetUserId(t *testing.T, ss store.Store) {
	err := ss.DesktopTokens().Insert("token_with_id", 1000, nil)
	require.NoError(t, err)
	err = ss.DesktopTokens().SetUserId("token_with_id", 1000, "user_id")
	require.NoError(t, err)

	err = ss.DesktopTokens().Insert("token_without_id", 2000, nil)
	require.NoError(t, err)

	t.Run("get user id", func(t *testing.T) {
		userId, err := ss.DesktopTokens().GetUserId("token_with_id", 1000)
		assert.NoError(t, err)
		assert.Equal(t, "user_id", userId)
	})

	t.Run("get user id - expired", func(t *testing.T) {
		userId, err := ss.DesktopTokens().GetUserId("token_with_id", 10000)
		assert.Error(t, err)
		assert.IsType(t, &store.ErrNotFound{}, err)
		assert.Equal(t, "", userId)
	})

	t.Run("get user id - no id set", func(t *testing.T) {
		userId, err := ss.DesktopTokens().GetUserId("token_without_id", 2000)
		assert.NoError(t, err)
		assert.Equal(t, "", userId)
	})
}

func testInsert(t *testing.T, ss store.Store) {
	t.Run("insert", func(t *testing.T) {
		err := ss.DesktopTokens().Insert("token", 1000, nil)
		assert.NoError(t, err)
	})

	t.Run("insert with user id", func(t *testing.T) {
		err := ss.DesktopTokens().Insert("token_2", 1000, model.NewString("user_id"))
		assert.NoError(t, err)
	})

	t.Run("insert - token too long", func(t *testing.T) {
		err := ss.DesktopTokens().Insert(
			"this token is way way way WAAAAAAAAAAAAAY WAAAAAAAAAAAAAY WAAAAAAAAAAAAAY TOO LONG",
			1000,
			nil,
		)
		assert.Error(t, err)
	})
}

func testSetUserId(t *testing.T, ss store.Store) {
	err := ss.DesktopTokens().Insert("new_token", 1000, nil)
	require.NoError(t, err)
	err = ss.DesktopTokens().Insert("new_token_2", 1000, nil)
	require.NoError(t, err)

	t.Run("set user id", func(t *testing.T) {
		err := ss.DesktopTokens().SetUserId("new_token", 1000, "user_id")
		assert.NoError(t, err)
		userId, err := ss.DesktopTokens().GetUserId("new_token", 1000)
		assert.NoError(t, err)
		assert.Equal(t, "user_id", userId)
	})

	t.Run("set user id - doesn't exist", func(t *testing.T) {
		err := ss.DesktopTokens().SetUserId("different_token", 1000, "user_id")
		assert.Error(t, err)
		_, err = ss.DesktopTokens().GetUserId("different_token", 1000)
		assert.Error(t, err)
	})

	t.Run("set user id - expired", func(t *testing.T) {
		err := ss.DesktopTokens().SetUserId("new_token", 2000, "user_id")
		assert.Error(t, err)
		_, err = ss.DesktopTokens().GetUserId("new_token", 2000)
		assert.Error(t, err)
	})

	t.Run("set user id - user id too long", func(t *testing.T) {
		err := ss.DesktopTokens().SetUserId(
			"new_token_2",
			1000,
			"user_id that is WAAAAAAAAAAAAAY WAAAAAAAAAAAAAY WAAAAAAAAAAAAAY TOO LONG",
		)
		assert.Error(t, err)
		userId, err := ss.DesktopTokens().GetUserId("new_token_2", 1000)
		assert.NoError(t, err)
		assert.Equal(t, "", userId)
	})
}

func testDeleteToken(t *testing.T, ss store.Store) {
	err := ss.DesktopTokens().Insert("deleteable_token", 3000, nil)
	require.NoError(t, err)
	err = ss.DesktopTokens().SetUserId("deleteable_token", 3000, "user_id")
	require.NoError(t, err)

	t.Run("delete", func(t *testing.T) {
		userId, err := ss.DesktopTokens().GetUserId("deleteable_token", 3000)
		assert.NoError(t, err)
		assert.Equal(t, "user_id", userId)

		err = ss.DesktopTokens().Delete("deleteable_token")
		assert.NoError(t, err)

		_, err = ss.DesktopTokens().GetUserId("deleteable_token", 3000)
		assert.Error(t, err)
	})
}

func testDeleteByUserId(t *testing.T, ss store.Store) {
	err := ss.DesktopTokens().Insert("deleteable_token_2", 4000, nil)
	require.NoError(t, err)
	err = ss.DesktopTokens().SetUserId("deleteable_token_2", 4000, "deleteable_user_id")
	require.NoError(t, err)

	t.Run("delete by user id", func(t *testing.T) {
		userId, err := ss.DesktopTokens().GetUserId("deleteable_token_2", 3000)
		assert.NoError(t, err)
		assert.Equal(t, "deleteable_user_id", userId)

		err = ss.DesktopTokens().DeleteByUserId("deleteable_user_id")
		assert.NoError(t, err)

		_, err = ss.DesktopTokens().GetUserId("deleteable_token_2", 3000)
		assert.Error(t, err)
	})
}

func testDeleteOlderThan(t *testing.T, ss store.Store) {
	err := ss.DesktopTokens().Insert("deleteable_token_old", 1000, nil)
	require.NoError(t, err)
	err = ss.DesktopTokens().Insert("deleteable_token_new", 5000, nil)
	require.NoError(t, err)

	t.Run("delete older than", func(t *testing.T) {
		_, err := ss.DesktopTokens().GetUserId("deleteable_token_old", 1000)
		assert.NoError(t, err)
		_, err = ss.DesktopTokens().GetUserId("deleteable_token_new", 5000)
		assert.NoError(t, err)

		err = ss.DesktopTokens().DeleteOlderThan(2000)
		assert.NoError(t, err)

		_, err = ss.DesktopTokens().GetUserId("deleteable_token_old", 1000)
		assert.Error(t, err)
		_, err = ss.DesktopTokens().GetUserId("deleteable_token_new", 5000)
		assert.NoError(t, err)
	})
}
