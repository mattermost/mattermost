// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestMEChannelKeysStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testMEChannelKeysSave(t, rctx, ss) })
	t.Run("SaveDuplicate", func(t *testing.T) { testMEChannelKeysSaveDuplicate(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testMEChannelKeysGet(t, rctx, ss) })
	t.Run("GetAll", func(t *testing.T) { testMEChannelKeysGetAll(t, rctx, ss) })
	t.Run("GetAllReturnsUsableSlice", func(t *testing.T) { testMEChannelKeysGetAllReturnsUsableSlice(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testMEChannelKeysDelete(t, rctx, ss) })
	t.Run("DeleteNonExistent", func(t *testing.T) { testMEChannelKeysDeleteNonExistent(t, rctx, ss) })
	t.Run("Upsert", func(t *testing.T) { testMEChannelKeysUpsert(t, rctx, ss) })
}

func testMEChannelKeysSave(t *testing.T, rctx request.CTX, ss store.Store) {
	key := &model.MEChannelKey{
		ChannelID:  model.NewId(),
		WrappedDEK: []byte("wrapped-dek-bytes-for-testing-01"),
		KeyID:      "me-kek-test/v1",
	}

	err := ss.MEChannelKeys().Save(rctx, key)
	require.NoError(t, err)
	require.NotZero(t, key.CreateAt)
	require.NotZero(t, key.UpdateAt)

	got, err := ss.MEChannelKeys().Get(rctx, key.ChannelID)
	require.NoError(t, err)
	require.Equal(t, key.ChannelID, got.ChannelID)
	require.Equal(t, key.WrappedDEK, got.WrappedDEK)
	require.Equal(t, key.KeyID, got.KeyID)
	require.Equal(t, key.CreateAt, got.CreateAt)
	require.Equal(t, key.UpdateAt, got.UpdateAt)
}

func testMEChannelKeysSaveDuplicate(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	key := &model.MEChannelKey{
		ChannelID:  channelID,
		WrappedDEK: []byte("wrapped-dek-bytes-for-testing-02"),
		KeyID:      "me-kek-test/v1",
	}

	err := ss.MEChannelKeys().Save(rctx, key)
	require.NoError(t, err)

	key2 := &model.MEChannelKey{
		ChannelID:  channelID,
		WrappedDEK: []byte("different-wrapped-dek-bytes-here"),
		KeyID:      "me-kek-test/v2",
	}

	err = ss.MEChannelKeys().Save(rctx, key2)
	require.Error(t, err, "saving duplicate channelId should fail")
}

func testMEChannelKeysGet(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("existing", func(t *testing.T) {
		key := &model.MEChannelKey{
			ChannelID:  model.NewId(),
			WrappedDEK: []byte("wrapped-dek-bytes-for-testing-03"),
			KeyID:      "me-kek-test",
		}
		err := ss.MEChannelKeys().Save(rctx, key)
		require.NoError(t, err)

		got, err := ss.MEChannelKeys().Get(rctx, key.ChannelID)
		require.NoError(t, err)
		require.Equal(t, key.ChannelID, got.ChannelID)
	})

	t.Run("non-existent", func(t *testing.T) {
		got, err := ss.MEChannelKeys().Get(rctx, "nonexistent-channel-id")
		require.Error(t, err)
		require.Nil(t, got)
		require.IsType(t, &store.ErrNotFound{}, err)
	})
}

func testMEChannelKeysGetAll(t *testing.T, rctx request.CTX, ss store.Store) {
	// Save 3 distinct keys.
	ids := make([]string, 3)
	for i := range 3 {
		id := model.NewId()
		ids[i] = id
		err := ss.MEChannelKeys().Save(rctx, &model.MEChannelKey{
			ChannelID:  id,
			WrappedDEK: []byte("wrapped-dek-getall-" + id[:8]),
			KeyID:      "me-kek-test",
		})
		require.NoError(t, err)
	}

	all, err := ss.MEChannelKeys().GetAll(rctx)
	require.NoError(t, err)
	// At least our 3 keys should be present (other tests may have added more).
	require.GreaterOrEqual(t, len(all), 3)

	found := map[string]bool{}
	for _, k := range all {
		found[k.ChannelID] = true
	}
	for _, id := range ids {
		require.True(t, found[id], "expected to find channel %s in GetAll results", id)
	}
}

func testMEChannelKeysGetAllReturnsUsableSlice(t *testing.T, rctx request.CTX, ss store.Store) {
	// Verify GetAll returns a usable (non-nil) slice even when our specific key
	// has been deleted. This exercises the "no matching rows" code path in the
	// query builder — the result must be safe to range over and check len().
	id := model.NewId()
	err := ss.MEChannelKeys().Save(rctx, &model.MEChannelKey{
		ChannelID:  id,
		WrappedDEK: []byte("wrapped-dek-getall-empty-test!!"),
		KeyID:      "me-kek-test",
	})
	require.NoError(t, err)

	err = ss.MEChannelKeys().Delete(rctx, id)
	require.NoError(t, err)

	all, err := ss.MEChannelKeys().GetAll(rctx)
	require.NoError(t, err)
	require.NotNil(t, all, "GetAll must return a non-nil slice so callers can safely range and check len()")

	// Our key should not be in the results.
	for _, k := range all {
		require.NotEqual(t, id, k.ChannelID)
	}
}

func testMEChannelKeysDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	key := &model.MEChannelKey{
		ChannelID:  model.NewId(),
		WrappedDEK: []byte("wrapped-dek-bytes-for-testing-04"),
		KeyID:      "me-kek-test",
	}
	err := ss.MEChannelKeys().Save(rctx, key)
	require.NoError(t, err)

	err = ss.MEChannelKeys().Delete(rctx, key.ChannelID)
	require.NoError(t, err)

	got, err := ss.MEChannelKeys().Get(rctx, key.ChannelID)
	require.Error(t, err)
	require.Nil(t, got)
	require.IsType(t, &store.ErrNotFound{}, err)
}

func testMEChannelKeysDeleteNonExistent(t *testing.T, rctx request.CTX, ss store.Store) {
	err := ss.MEChannelKeys().Delete(rctx, "nonexistent-channel-id-delete")
	require.NoError(t, err, "deleting non-existent key should not error")
}

func testMEChannelKeysUpsert(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()
	key := &model.MEChannelKey{
		ChannelID:  channelID,
		WrappedDEK: []byte("wrapped-dek-bytes-for-testing-05"),
		KeyID:      "me-kek-test/v1",
	}

	err := ss.MEChannelKeys().Save(rctx, key)
	require.NoError(t, err)
	originalCreateAt := key.CreateAt
	originalUpdateAt := key.UpdateAt

	updated := &model.MEChannelKey{
		ChannelID:  channelID,
		WrappedDEK: []byte("updated-wrapped-dek-bytes-here!!"),
		KeyID:      "me-kek-rotated/v2",
	}

	// Sleep past the millisecond boundary so UpdateAt must strictly advance —
	// catches regressions where Upsert silently skips refreshing UpdateAt.
	time.Sleep(2 * time.Millisecond)

	err = ss.MEChannelKeys().Upsert(rctx, updated)
	require.NoError(t, err)

	// Upsert must not mutate the caller's struct on the conflict path: the DB
	// row keeps its original CreateAt, so the caller struct must too.
	require.Zero(t, updated.CreateAt, "Upsert must not mutate caller CreateAt")
	require.Zero(t, updated.UpdateAt, "Upsert must not mutate caller UpdateAt")

	got, err := ss.MEChannelKeys().Get(rctx, channelID)
	require.NoError(t, err)
	require.Equal(t, updated.WrappedDEK, got.WrappedDEK)
	require.Equal(t, "me-kek-rotated/v2", got.KeyID)
	require.Equal(t, originalCreateAt, got.CreateAt, "CreateAt should not change on upsert")
	require.Greater(t, got.UpdateAt, originalUpdateAt, "UpdateAt should strictly advance after upsert")
}
