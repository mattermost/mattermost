// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"sync"
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
	t.Run("ConsumeToken", func(t *testing.T) { testConsumeToken(t, rctx, ss) })
	t.Run("ConsumeToken/idempotent", func(t *testing.T) { testConsumeTokenIdempotent(t, rctx, ss) })
	t.Run("ConsumeToken/concurrent", func(t *testing.T) { testConsumeTokenConcurrent(t, rctx, ss) })
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

func testConsumeToken(t *testing.T, rctx request.CTX, ss store.Store) {
	const tok = "consume_token_valid"
	err := ss.DesktopTokens().Insert(tok, 1000, "consume_user_id")
	require.NoError(t, err)

	// Consuming a valid, unexpired token returns the userId and removes the row.
	userID, err := ss.DesktopTokens().ConsumeToken(tok, 1000)
	assert.NoError(t, err)
	require.NotNil(t, userID)
	assert.Equal(t, "consume_user_id", *userID)

	// Row must be gone after consume.
	_, err = ss.DesktopTokens().GetUserId(tok, 1000)
	assert.Error(t, err)
	assert.IsType(t, &store.ErrNotFound{}, err)
}

func testConsumeTokenIdempotent(t *testing.T, rctx request.CTX, ss store.Store) {
	const tok = "consume_token_idempotent"
	err := ss.DesktopTokens().Insert(tok, 1000, "consume_user_id_2")
	require.NoError(t, err)

	// First consume succeeds.
	userID, err := ss.DesktopTokens().ConsumeToken(tok, 1000)
	assert.NoError(t, err)
	require.NotNil(t, userID)

	// Second consume on the same token returns nil, nil (not an error).
	userID2, err := ss.DesktopTokens().ConsumeToken(tok, 1000)
	assert.NoError(t, err)
	assert.Nil(t, userID2)
}

func testConsumeTokenConcurrent(t *testing.T, rctx request.CTX, ss store.Store) {
	const tok = "consume_token_concurrent"
	const goroutines = 10
	err := ss.DesktopTokens().Insert(tok, 1000, "consume_user_id_concurrent")
	require.NoError(t, err)

	var (
		mu      sync.Mutex
		winners []string
	)

	var wg sync.WaitGroup
	wg.Add(goroutines)
	start := make(chan struct{})

	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			<-start
			userID, err := ss.DesktopTokens().ConsumeToken(tok, 1000)
			assert.NoError(t, err)
			if userID != nil {
				mu.Lock()
				winners = append(winners, *userID)
				mu.Unlock()
			}
		}()
	}

	close(start)
	wg.Wait()

	// Exactly one goroutine must have consumed the token.
	assert.Len(t, winners, 1, "exactly one goroutine should have consumed the token")
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
