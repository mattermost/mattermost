// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestTemporaryPostStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testTemporaryPostSave(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testTemporaryPostGet(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testTemporaryPostDelete(t, rctx, ss) })
	t.Run("GetExpiredPosts", func(t *testing.T) { testTemporaryPostGetExpiredPosts(t, rctx, ss) })
}

func testTemporaryPostSave(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should be able to save a temporary post", func(t *testing.T) {
		post := &model.TemporaryPost{
			ID:       model.NewId(),
			Type:     model.PostTypeDefault,
			ExpireAt: model.GetMillis() + 3600000, // 1 hour from now
			Message:  "Test message",
			FileIDs:  []string{"file1", "file2"},
		}

		saved, err := ss.TemporaryPost().Save(rctx, post)
		require.NoError(t, err)
		require.Equal(t, post.ID, saved.ID)
		require.Equal(t, post.Message, saved.Message)
		require.Equal(t, post.FileIDs, saved.FileIDs)
	})

	t.Run("should fail if id is empty", func(t *testing.T) {
		post := &model.TemporaryPost{
			ID:       "",
			Type:     model.PostTypeDefault,
			ExpireAt: model.GetMillis() + 3600000,
			Message:  "Test message",
		}

		_, err := ss.TemporaryPost().Save(rctx, post)
		require.Error(t, err)
		require.Contains(t, err.Error(), "id is required")
	})
}

func testTemporaryPostGet(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting post", func(t *testing.T) {
		post, err := ss.TemporaryPost().Get(rctx, model.NewId())
		require.Nil(t, post)
		require.Error(t, err)
	})

	t.Run("should be able to retrieve an existing temporary post", func(t *testing.T) {
		post := &model.TemporaryPost{
			ID:       model.NewId(),
			Type:     model.PostTypeDefault,
			ExpireAt: model.GetMillis() + 3600000,
			Message:  "Test message for get",
			FileIDs:  []string{"file1"},
		}

		saved, err := ss.TemporaryPost().Save(rctx, post)
		require.NoError(t, err)

		retrieved, err := ss.TemporaryPost().Get(rctx, saved.ID)
		require.NoError(t, err)
		require.Equal(t, saved.ID, retrieved.ID)
		require.Equal(t, saved.Message, retrieved.Message)
		require.Equal(t, saved.FileIDs, retrieved.FileIDs)
		require.Equal(t, saved.Type, retrieved.Type)
		require.Equal(t, saved.ExpireAt, retrieved.ExpireAt)
	})
}

func testTemporaryPostDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should not fail on nonexistent post", func(t *testing.T) {
		err := ss.TemporaryPost().Delete(rctx, model.NewId())
		require.NoError(t, err)
	})

	t.Run("should be able to delete an existing temporary post", func(t *testing.T) {
		post := &model.TemporaryPost{
			ID:       model.NewId(),
			Type:     model.PostTypeDefault,
			ExpireAt: model.GetMillis() + 3600000,
			Message:  "Test message for delete",
		}

		saved, err := ss.TemporaryPost().Save(rctx, post)
		require.NoError(t, err)

		err = ss.TemporaryPost().Delete(rctx, saved.ID)
		require.NoError(t, err)

		// Verify it's deleted
		retrieved, err := ss.TemporaryPost().Get(rctx, saved.ID)
		require.Nil(t, retrieved)
		require.Error(t, err)
	})
}

func testTemporaryPostGetExpiredPosts(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should get expired posts", func(t *testing.T) {
		now := model.GetMillis()
		pastTime := now - 3600000 // 1 hour ago

		// Create expired post
		expiredPost := &model.TemporaryPost{
			ID:       model.NewId(),
			Type:     model.PostTypeDefault,
			ExpireAt: pastTime,
			Message:  "Expired message",
		}
		_, err := ss.TemporaryPost().Save(rctx, expiredPost)
		require.NoError(t, err)

		// Create non-expired post
		validPost := &model.TemporaryPost{
			ID:       model.NewId(),
			Type:     model.PostTypeDefault,
			ExpireAt: now + 3600000, // 1 hour from now
			Message:  "Valid message",
		}
		_, err = ss.TemporaryPost().Save(rctx, validPost)
		require.NoError(t, err)

		// Get expired posts
		expiredPosts, err := ss.TemporaryPost().GetExpiredPosts(rctx)
		require.NoError(t, err)
		require.Equal(t, 1, len(expiredPosts))
		require.Equal(t, expiredPost.ID, expiredPosts[0])
	})
}
