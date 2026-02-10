// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ============================================================================
// MATTERMOST EXTENDED - Encryption (E2EE) API Tests
// ============================================================================

// Helper to create a valid JWK public key for testing
func createTestJwk() string {
	return `{"kty":"RSA","n":"` + strings.Repeat("A", 200) + `","e":"AQAB"}`
}

// TestGetEncryptionStatus tests the GET /api/v4/encryption/status endpoint
func TestGetEncryptionStatus(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns status when enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var status model.EncryptionStatus
		err = json.NewDecoder(resp.Body).Decode(&status)
		require.NoError(t, err)

		assert.True(t, status.Enabled)
		assert.True(t, status.CanEncrypt)
		assert.False(t, status.HasKey) // No key registered yet
		assert.NotEmpty(t, status.SessionId)
	})

	t.Run("Shows key registered status", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register a key first
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
		resp.Body.Close()

		// Check status
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		require.NoError(t, err)
		defer resp.Body.Close()

		var status model.EncryptionStatus
		err = json.NewDecoder(resp.Body).Decode(&status)
		require.NoError(t, err)

		assert.True(t, status.HasKey)
	})

	t.Run("Returns disabled status when feature flag disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = false
		})

		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var status model.EncryptionStatus
		err = json.NewDecoder(resp.Body).Decode(&status)
		require.NoError(t, err)

		assert.False(t, status.Enabled)
		assert.False(t, status.CanEncrypt)
	})
}

// TestRegisterPublicKey tests the POST /api/v4/encryption/publickey endpoint
func TestRegisterPublicKey(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Registers new public key", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}

		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
		defer resp.Body.Close()

		var pubKey model.EncryptionPublicKey
		err = json.NewDecoder(resp.Body).Decode(&pubKey)
		require.NoError(t, err)

		assert.Equal(t, th.BasicUser.Id, pubKey.UserId)
		assert.NotEmpty(t, pubKey.SessionId)
		assert.Equal(t, createTestJwk(), pubKey.PublicKey)
	})

	t.Run("Updates existing key for session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register first key
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, _ := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		resp.Body.Close()

		// Register updated key
		updatedKey := `{"kty":"RSA","n":"` + strings.Repeat("B", 200) + `","e":"AQAB"}`
		keyReq.PublicKey = updatedKey
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
		defer resp.Body.Close()

		var pubKey model.EncryptionPublicKey
		err = json.NewDecoder(resp.Body).Decode(&pubKey)
		require.NoError(t, err)
		assert.Equal(t, updatedKey, pubKey.PublicKey)
	})

	t.Run("Validates JWK format", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Invalid format - not JSON
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: "not-a-jwk",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()

		// Empty key
		keyReq = &model.EncryptionPublicKeyRequest{
			PublicKey: "",
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Returns 403 when feature flag disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = false
		})

		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestGetMyPublicKey tests the GET /api/v4/encryption/publickey endpoint
func TestGetMyPublicKey(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns registered key", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register a key
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, _ := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		resp.Body.Close()

		// Get the key
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var pubKey model.EncryptionPublicKey
		err = json.NewDecoder(resp.Body).Decode(&pubKey)
		require.NoError(t, err)

		assert.Equal(t, createTestJwk(), pubKey.PublicKey)
		assert.Equal(t, th.BasicUser.Id, pubKey.UserId)
	})

	t.Run("Returns empty key if not registered", func(t *testing.T) {
		// Create new session without key
		th2 := Setup(t).InitBasic(t)
		th2.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err := th2.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var pubKey model.EncryptionPublicKey
		err = json.NewDecoder(resp.Body).Decode(&pubKey)
		require.NoError(t, err)

		assert.Empty(t, pubKey.PublicKey)
	})
}

// TestGetPublicKeysByUserIds tests the POST /api/v4/encryption/publickeys endpoint
func TestGetPublicKeysByUserIds(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns keys for valid users", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register key for basic user
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, _ := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		resp.Body.Close()

		// Request keys
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{th.BasicUser.Id},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var keys []*model.EncryptionPublicKey
		err = json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, err)
		assert.Len(t, keys, 1)
		assert.Equal(t, th.BasicUser.Id, keys[0].UserId)
	})

	t.Run("Returns empty for users without keys", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Request keys for user who hasn't registered
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{th.BasicUser2.Id},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var keys []*model.EncryptionPublicKey
		err = json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, err)
		assert.Empty(t, keys)
	})

	t.Run("Validates user IDs", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Empty user IDs
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()

		// Invalid user ID format
		req = &model.EncryptionPublicKeysRequest{
			UserIds: []string{"invalid"},
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestGetChannelMemberKeys tests the GET /api/v4/encryption/channel/{channel_id}/keys endpoint
func TestGetChannelMemberKeys(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns keys for channel members", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register key for basic user
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, _ := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		resp.Body.Close()

		// Get channel member keys
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/channel/"+th.BasicChannel.Id+"/keys", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var keys []*model.EncryptionPublicKey
		err = json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, err)
		assert.NotEmpty(t, keys)
	})

	t.Run("Returns 403 for non-channel members", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Create private channel without BasicUser2
		privateChannel := th.CreatePrivateChannel(t)

		// Try to get keys as user who isn't a member
		th.LoginBasic2(t)
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/channel/"+privateChannel.Id+"/keys", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestAdminGetAllKeys tests the GET /api/v4/encryption/admin/keys endpoint
func TestAdminGetAllKeys(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns all keys for admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register key
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, _ := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		resp.Body.Close()

		// Get all keys as admin
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/encryption/admin/keys", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var response model.EncryptionKeysResponse
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)
		assert.NotEmpty(t, response.Keys)
		assert.NotNil(t, response.Stats)
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/admin/keys", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestAdminDeleteSessionKey tests the DELETE /api/v4/encryption/admin/keys/session/{session_id} endpoint
func TestAdminDeleteSessionKey(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Deletes key by session ID", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register key
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, _ := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		resp.Body.Close()

		// Get session ID from status
		resp, _ = th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		var status model.EncryptionStatus
		json.NewDecoder(resp.Body).Decode(&status)
		resp.Body.Close()

		// Delete key as admin
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys/session/"+status.SessionId)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()

		// Verify key is deleted
		resp, _ = th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		var pubKey model.EncryptionPublicKey
		json.NewDecoder(resp.Body).Decode(&pubKey)
		resp.Body.Close()
		assert.Empty(t, pubKey.PublicKey)
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/session/"+model.NewId())
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestAdminDeleteAllKeys tests the DELETE /api/v4/encryption/admin/keys endpoint
func TestAdminDeleteAllKeys(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Deletes all keys for admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register key
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, _ := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		resp.Body.Close()

		// Delete all keys
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()

		// Verify keys are deleted
		resp, _ = th.SystemAdminClient.DoAPIGet(context.Background(), "/encryption/admin/keys", "")
		var response model.EncryptionKeysResponse
		json.NewDecoder(resp.Body).Decode(&response)
		resp.Body.Close()
		assert.Empty(t, response.Keys)
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestAdminDeleteOrphanedKeys tests the DELETE /api/v4/encryption/admin/keys/orphaned endpoint
func TestAdminDeleteOrphanedKeys(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Admin can delete orphaned keys", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys/orphaned")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/orphaned")
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestAdminDeleteUserKeys tests the DELETE /api/v4/encryption/admin/keys/{user_id} endpoint
func TestAdminDeleteUserKeys(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Deletes all keys for user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		// Register key
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: createTestJwk(),
		}
		resp, _ := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		resp.Body.Close()

		// Delete user keys as admin
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys/"+th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()

		// Verify key is deleted
		resp, _ = th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		var pubKey model.EncryptionPublicKey
		json.NewDecoder(resp.Body).Decode(&pubKey)
		resp.Body.Close()
		assert.Empty(t, pubKey.PublicKey)
	})

	t.Run("Returns 403 for non-admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.Encryption = true
		})

		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/"+th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})
}
