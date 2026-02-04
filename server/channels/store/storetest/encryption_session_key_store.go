// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestEncryptionSessionKeyStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testEncryptionSessionKeyStoreSave(t, rctx, ss) })
	t.Run("GetBySession", func(t *testing.T) { testEncryptionSessionKeyStoreGetBySession(t, rctx, ss) })
	t.Run("GetByUser", func(t *testing.T) { testEncryptionSessionKeyStoreGetByUser(t, rctx, ss) })
	t.Run("GetByUsers", func(t *testing.T) { testEncryptionSessionKeyStoreGetByUsers(t, rctx, ss) })
	t.Run("DeleteBySession", func(t *testing.T) { testEncryptionSessionKeyStoreDeleteBySession(t, rctx, ss) })
	t.Run("DeleteByUser", func(t *testing.T) { testEncryptionSessionKeyStoreDeleteByUser(t, rctx, ss) })
	t.Run("DeleteAll", func(t *testing.T) { testEncryptionSessionKeyStoreDeleteAll(t, rctx, ss) })
	t.Run("GetStats", func(t *testing.T) { testEncryptionSessionKeyStoreGetStats(t, rctx, ss) })
}

// Helper to create a user and session for testing
func createTestUserAndSession(t *testing.T, rctx request.CTX, ss store.Store) (*model.User, *model.Session) {
	user := &model.User{
		Email:    model.NewId() + "@test.com",
		Username: "user_" + model.NewId(),
	}
	user, err := ss.User().Save(rctx, user)
	require.NoError(t, err)

	session := &model.Session{
		UserId: user.Id,
		Token:  model.NewId(),
	}
	session, err = ss.Session().Save(rctx, session)
	require.NoError(t, err)

	return user, session
}

func testEncryptionSessionKeyStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create test user and session
	user, session := createTestUserAndSession(t, rctx, ss)
	defer func() {
		_ = ss.Session().Remove(session.Id)
		_ = ss.User().PermanentDelete(rctx, user.Id)
	}()

	t.Run("saves new key", func(t *testing.T) {
		key := &model.EncryptionSessionKey{
			SessionId: session.Id,
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"test","e":"AQAB"}`,
		}

		err := ss.EncryptionSessionKey().Save(key)
		require.NoError(t, err)

		// Verify it was saved
		saved, err := ss.EncryptionSessionKey().GetBySession(session.Id)
		require.NoError(t, err)
		assert.Equal(t, key.PublicKey, saved.PublicKey)
		assert.NotZero(t, saved.CreateAt)

		// Cleanup
		_ = ss.EncryptionSessionKey().DeleteBySession(session.Id)
	})

	t.Run("updates existing key (upsert)", func(t *testing.T) {
		key := &model.EncryptionSessionKey{
			SessionId: session.Id,
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"original","e":"AQAB"}`,
		}

		err := ss.EncryptionSessionKey().Save(key)
		require.NoError(t, err)

		// Save again with new key
		key.PublicKey = `{"kty":"RSA","n":"updated","e":"AQAB"}`
		err = ss.EncryptionSessionKey().Save(key)
		require.NoError(t, err)

		// Verify update
		saved, err := ss.EncryptionSessionKey().GetBySession(session.Id)
		require.NoError(t, err)
		assert.Contains(t, saved.PublicKey, "updated")

		// Cleanup
		_ = ss.EncryptionSessionKey().DeleteBySession(session.Id)
	})

	t.Run("validates required fields", func(t *testing.T) {
		// Invalid session ID
		key := &model.EncryptionSessionKey{
			SessionId: "",
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"test","e":"AQAB"}`,
		}
		err := ss.EncryptionSessionKey().Save(key)
		require.Error(t, err)

		// Invalid user ID
		key = &model.EncryptionSessionKey{
			SessionId: session.Id,
			UserId:    "",
			PublicKey: `{"kty":"RSA","n":"test","e":"AQAB"}`,
		}
		err = ss.EncryptionSessionKey().Save(key)
		require.Error(t, err)

		// Empty public key
		key = &model.EncryptionSessionKey{
			SessionId: session.Id,
			UserId:    user.Id,
			PublicKey: "",
		}
		err = ss.EncryptionSessionKey().Save(key)
		require.Error(t, err)
	})
}

func testEncryptionSessionKeyStoreGetBySession(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create test user and session
	user, session := createTestUserAndSession(t, rctx, ss)
	defer func() {
		_ = ss.Session().Remove(session.Id)
		_ = ss.User().PermanentDelete(rctx, user.Id)
	}()

	t.Run("returns key for session", func(t *testing.T) {
		key := &model.EncryptionSessionKey{
			SessionId: session.Id,
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"test","e":"AQAB"}`,
		}
		err := ss.EncryptionSessionKey().Save(key)
		require.NoError(t, err)
		defer func() { _ = ss.EncryptionSessionKey().DeleteBySession(session.Id) }()

		fetched, err := ss.EncryptionSessionKey().GetBySession(session.Id)
		require.NoError(t, err)
		assert.Equal(t, session.Id, fetched.SessionId)
		assert.Equal(t, user.Id, fetched.UserId)
	})

	t.Run("returns error for non-existent session", func(t *testing.T) {
		_, err := ss.EncryptionSessionKey().GetBySession(model.NewId())
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testEncryptionSessionKeyStoreGetByUser(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create test user with multiple sessions
	user, session1 := createTestUserAndSession(t, rctx, ss)
	session2 := &model.Session{
		UserId: user.Id,
		Token:  model.NewId(),
	}
	session2, err := ss.Session().Save(rctx, session2)
	require.NoError(t, err)
	defer func() {
		_ = ss.Session().Remove(session1.Id)
		_ = ss.Session().Remove(session2.Id)
		_ = ss.User().PermanentDelete(rctx, user.Id)
	}()

	t.Run("returns all keys for user", func(t *testing.T) {
		// Save keys for both sessions
		key1 := &model.EncryptionSessionKey{
			SessionId: session1.Id,
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"key1","e":"AQAB"}`,
		}
		key2 := &model.EncryptionSessionKey{
			SessionId: session2.Id,
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"key2","e":"AQAB"}`,
		}
		err := ss.EncryptionSessionKey().Save(key1)
		require.NoError(t, err)
		err = ss.EncryptionSessionKey().Save(key2)
		require.NoError(t, err)
		defer func() {
			_ = ss.EncryptionSessionKey().DeleteByUser(user.Id)
		}()

		keys, err := ss.EncryptionSessionKey().GetByUser(user.Id)
		require.NoError(t, err)
		assert.Len(t, keys, 2)
	})

	t.Run("returns empty for user without keys", func(t *testing.T) {
		keys, err := ss.EncryptionSessionKey().GetByUser(model.NewId())
		require.NoError(t, err)
		assert.Empty(t, keys)
	})
}

func testEncryptionSessionKeyStoreGetByUsers(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create two test users with sessions
	user1, session1 := createTestUserAndSession(t, rctx, ss)
	user2, session2 := createTestUserAndSession(t, rctx, ss)
	defer func() {
		_ = ss.EncryptionSessionKey().DeleteByUser(user1.Id)
		_ = ss.EncryptionSessionKey().DeleteByUser(user2.Id)
		_ = ss.Session().Remove(session1.Id)
		_ = ss.Session().Remove(session2.Id)
		_ = ss.User().PermanentDelete(rctx, user1.Id)
		_ = ss.User().PermanentDelete(rctx, user2.Id)
	}()

	t.Run("returns keys for multiple users", func(t *testing.T) {
		// Save keys for both users
		key1 := &model.EncryptionSessionKey{
			SessionId: session1.Id,
			UserId:    user1.Id,
			PublicKey: `{"kty":"RSA","n":"user1","e":"AQAB"}`,
		}
		key2 := &model.EncryptionSessionKey{
			SessionId: session2.Id,
			UserId:    user2.Id,
			PublicKey: `{"kty":"RSA","n":"user2","e":"AQAB"}`,
		}
		err := ss.EncryptionSessionKey().Save(key1)
		require.NoError(t, err)
		err = ss.EncryptionSessionKey().Save(key2)
		require.NoError(t, err)

		keys, err := ss.EncryptionSessionKey().GetByUsers([]string{user1.Id, user2.Id})
		require.NoError(t, err)
		assert.Len(t, keys, 2)
	})

	t.Run("returns empty for empty user list", func(t *testing.T) {
		keys, err := ss.EncryptionSessionKey().GetByUsers([]string{})
		require.NoError(t, err)
		assert.Empty(t, keys)
	})
}

func testEncryptionSessionKeyStoreDeleteBySession(t *testing.T, rctx request.CTX, ss store.Store) {
	user, session := createTestUserAndSession(t, rctx, ss)
	defer func() {
		_ = ss.Session().Remove(session.Id)
		_ = ss.User().PermanentDelete(rctx, user.Id)
	}()

	t.Run("deletes key by session ID", func(t *testing.T) {
		key := &model.EncryptionSessionKey{
			SessionId: session.Id,
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"todelete","e":"AQAB"}`,
		}
		err := ss.EncryptionSessionKey().Save(key)
		require.NoError(t, err)

		err = ss.EncryptionSessionKey().DeleteBySession(session.Id)
		require.NoError(t, err)

		// Verify deleted
		_, err = ss.EncryptionSessionKey().GetBySession(session.Id)
		require.Error(t, err)
	})

	t.Run("no error for non-existent session", func(t *testing.T) {
		err := ss.EncryptionSessionKey().DeleteBySession(model.NewId())
		require.NoError(t, err)
	})
}

func testEncryptionSessionKeyStoreDeleteByUser(t *testing.T, rctx request.CTX, ss store.Store) {
	user, session1 := createTestUserAndSession(t, rctx, ss)
	session2 := &model.Session{
		UserId: user.Id,
		Token:  model.NewId(),
	}
	session2, _ = ss.Session().Save(rctx, session2)
	defer func() {
		_ = ss.Session().Remove(session1.Id)
		_ = ss.Session().Remove(session2.Id)
		_ = ss.User().PermanentDelete(rctx, user.Id)
	}()

	t.Run("deletes all keys for user", func(t *testing.T) {
		// Save keys for both sessions
		key1 := &model.EncryptionSessionKey{
			SessionId: session1.Id,
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"key1","e":"AQAB"}`,
		}
		key2 := &model.EncryptionSessionKey{
			SessionId: session2.Id,
			UserId:    user.Id,
			PublicKey: `{"kty":"RSA","n":"key2","e":"AQAB"}`,
		}
		err := ss.EncryptionSessionKey().Save(key1)
		require.NoError(t, err)
		err = ss.EncryptionSessionKey().Save(key2)
		require.NoError(t, err)

		err = ss.EncryptionSessionKey().DeleteByUser(user.Id)
		require.NoError(t, err)

		// Verify all deleted
		keys, err := ss.EncryptionSessionKey().GetByUser(user.Id)
		require.NoError(t, err)
		assert.Empty(t, keys)
	})
}

func testEncryptionSessionKeyStoreDeleteAll(t *testing.T, rctx request.CTX, ss store.Store) {
	user1, session1 := createTestUserAndSession(t, rctx, ss)
	user2, session2 := createTestUserAndSession(t, rctx, ss)
	defer func() {
		_ = ss.Session().Remove(session1.Id)
		_ = ss.Session().Remove(session2.Id)
		_ = ss.User().PermanentDelete(rctx, user1.Id)
		_ = ss.User().PermanentDelete(rctx, user2.Id)
	}()

	t.Run("deletes all keys", func(t *testing.T) {
		// Save keys for both users
		key1 := &model.EncryptionSessionKey{
			SessionId: session1.Id,
			UserId:    user1.Id,
			PublicKey: `{"kty":"RSA","n":"user1","e":"AQAB"}`,
		}
		key2 := &model.EncryptionSessionKey{
			SessionId: session2.Id,
			UserId:    user2.Id,
			PublicKey: `{"kty":"RSA","n":"user2","e":"AQAB"}`,
		}
		err := ss.EncryptionSessionKey().Save(key1)
		require.NoError(t, err)
		err = ss.EncryptionSessionKey().Save(key2)
		require.NoError(t, err)

		err = ss.EncryptionSessionKey().DeleteAll()
		require.NoError(t, err)

		// Verify all deleted
		stats, err := ss.EncryptionSessionKey().GetStats()
		require.NoError(t, err)
		assert.Equal(t, 0, stats.TotalKeys)
	})
}

func testEncryptionSessionKeyStoreGetStats(t *testing.T, rctx request.CTX, ss store.Store) {
	// Clean up first
	_ = ss.EncryptionSessionKey().DeleteAll()

	user1, session1 := createTestUserAndSession(t, rctx, ss)
	user2, session2 := createTestUserAndSession(t, rctx, ss)
	session3 := &model.Session{
		UserId: user1.Id,
		Token:  model.NewId(),
	}
	session3, _ = ss.Session().Save(rctx, session3)
	defer func() {
		_ = ss.EncryptionSessionKey().DeleteAll()
		_ = ss.Session().Remove(session1.Id)
		_ = ss.Session().Remove(session2.Id)
		_ = ss.Session().Remove(session3.Id)
		_ = ss.User().PermanentDelete(rctx, user1.Id)
		_ = ss.User().PermanentDelete(rctx, user2.Id)
	}()

	t.Run("returns correct counts", func(t *testing.T) {
		// User1 has 2 keys, User2 has 1 key
		key1 := &model.EncryptionSessionKey{
			SessionId: session1.Id,
			UserId:    user1.Id,
			PublicKey: `{"kty":"RSA","n":"u1s1","e":"AQAB"}`,
		}
		key2 := &model.EncryptionSessionKey{
			SessionId: session3.Id,
			UserId:    user1.Id,
			PublicKey: `{"kty":"RSA","n":"u1s2","e":"AQAB"}`,
		}
		key3 := &model.EncryptionSessionKey{
			SessionId: session2.Id,
			UserId:    user2.Id,
			PublicKey: `{"kty":"RSA","n":"u2s1","e":"AQAB"}`,
		}
		err := ss.EncryptionSessionKey().Save(key1)
		require.NoError(t, err)
		err = ss.EncryptionSessionKey().Save(key2)
		require.NoError(t, err)
		err = ss.EncryptionSessionKey().Save(key3)
		require.NoError(t, err)

		stats, err := ss.EncryptionSessionKey().GetStats()
		require.NoError(t, err)
		assert.Equal(t, 3, stats.TotalKeys)
		assert.Equal(t, 2, stats.TotalUsers)
	})
}
