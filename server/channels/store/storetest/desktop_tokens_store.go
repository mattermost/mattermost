// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDesktopTokensStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("GetUserId", func(t *testing.T) { testGetUserID(t, rctx, ss) })
	t.Run("Insert", func(t *testing.T) { testInsert(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testDeleteToken(t, rctx, ss) })
	t.Run("DeleteByUserId", func(t *testing.T) { testDeleteByUserID(t, rctx, ss) })
	t.Run("DeleteOlderThan", func(t *testing.T) { testDeleteOlderThan(t, rctx, ss) })
}

func testGetUserID(t *testing.T, rctx request.CTX, ss store.Store) {
	err := ss.DesktopTokens().Insert("token_with_id", 1000, "user_id")
	require.NoError(t, err)

	t.Run("get user id", func(t *testing.T) {
		userID, err := ss.DesktopTokens().GetUserId("token_with_id", 1000)
		assert.NoError(t, err)
		assert.Equal(t, "user_id", *userID)
	})

	t.Run("get user id - expired", func(t *testing.T) {
		userID, err := ss.DesktopTokens().GetUserId("token_with_id", 10000)
		assert.Error(t, err)
		assert.IsType(t, &store.ErrNotFound{}, err)
		assert.Nil(t, userID)
	})
}

func testInsert(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("insert", func(t *testing.T) {
		err := ss.DesktopTokens().Insert("token", 1000, "user_id")
		assert.NoError(t, err)
	})

	t.Run("insert - token too long", func(t *testing.T) {
		err := ss.DesktopTokens().Insert(
			"this token is way way way WAAAAAAAAAAAAAY WAAAAAAAAAAAAAY WAAAAAAAAAAAAAY TOO LONG",
			1000,
			"user_id",
		)
		assert.Error(t, err)
	})
}

func testDeleteToken(t *testing.T, rctx request.CTX, ss store.Store) {
	err := ss.DesktopTokens().Insert("deleteable_token", 3000, "user_id")
	require.NoError(t, err)

	t.Run("delete", func(t *testing.T) {
		userID, err := ss.DesktopTokens().GetUserId("deleteable_token", 3000)
		assert.NoError(t, err)
		assert.Equal(t, "user_id", *userID)

		err = ss.DesktopTokens().Delete("deleteable_token")
		assert.NoError(t, err)

		_, err = ss.DesktopTokens().GetUserId("deleteable_token", 3000)
		assert.Error(t, err)
	})
}

func testDeleteByUserID(t *testing.T, rctx request.CTX, ss store.Store) {
	err := ss.DesktopTokens().Insert("deleteable_token_2", 4000, "deleteable_user_id")
	require.NoError(t, err)

	t.Run("delete by user id", func(t *testing.T) {
		userID, err := ss.DesktopTokens().GetUserId("deleteable_token_2", 3000)
		assert.NoError(t, err)
		assert.Equal(t, "deleteable_user_id", *userID)

		err = ss.DesktopTokens().DeleteByUserId("deleteable_user_id")
		assert.NoError(t, err)

		_, err = ss.DesktopTokens().GetUserId("deleteable_token_2", 3000)
		assert.Error(t, err)
	})
}

func testDeleteOlderThan(t *testing.T, rctx request.CTX, ss store.Store) {
	err := ss.DesktopTokens().Insert("deleteable_token_old", 1000, "deleteable_user_id")
	require.NoError(t, err)
	err = ss.DesktopTokens().Insert("deleteable_token_new", 5000, "deleteable_user_id")
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
