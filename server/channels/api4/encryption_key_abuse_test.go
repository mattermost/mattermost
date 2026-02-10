// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

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

// ----------------------------------------------------------------------------
// ENCRYPTION KEY ABUSE & EDGE CASES
// ----------------------------------------------------------------------------

func TestEncryptionWeakKeyRegistration(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Minimal valid-format key without proper JWK structure is rejected", func(t *testing.T) {
		// Server should validate JWK structure, not just check starts-with-{ and len>=10
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"weak","e":"AQAB","extra":"pad"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Key that is valid JSON object but not JWK is rejected", func(t *testing.T) {
		// Server should validate actual JWK structure, not just JSON object shape
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"not_a_key": "this is just arbitrary JSON data"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Oversized public key payload is rejected", func(t *testing.T) {
		// Server should enforce max size on public keys to prevent storage abuse
		largeKey := `{"kty":"RSA","n":"` + strings.Repeat("A", 100*1024) + `","e":"AQAB"}`
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: largeKey,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}

func TestEncryptionKeyOverwrite(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("User can overwrite own key by re-registering", func(t *testing.T) {
		// Register first key
		req1 := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("A", 200) + `","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req1)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		// Overwrite with new key
		req2 := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("B", 200) + `","e":"AQAB"}`,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req2)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		// Verify the key was replaced
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var key model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&key)
		require.NoError(t, decErr)
		assert.Contains(t, key.PublicKey, strings.Repeat("B", 200))
	})
}

func TestEncryptionKeyEnumeration(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Bulk endpoint with non-existent user IDs returns empty not error", func(t *testing.T) {
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{model.NewId(), model.NewId()},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var keys []*model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, decErr)
		// Should return empty array, not leak whether users exist
		assert.Empty(t, keys)
	})

	t.Run("Channel keys endpoint for non-existent channel returns error", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/channel/"+model.NewId()+"/keys", "")
		// Should get forbidden (no access) not 500 or data leak
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Any authenticated user can fetch any other users keys via bulk endpoint", func(t *testing.T) {
		// Register a key for user1
		th.LoginBasic(t)
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("A", 200) + `","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		// User2 can fetch user1's key without any shared channel
		th.LoginBasic2(t)
		bulkReq := &model.EncryptionPublicKeysRequest{
			UserIds: []string{th.BasicUser.Id},
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", bulkReq)
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var keys []*model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, decErr)
		// Documents that any user can enumerate any other user's public keys
		assert.NotEmpty(t, keys)
	})
}

func TestEncryptionStatusLeaksSessionId(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Encryption status endpoint returns own session_id for key management", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var status model.EncryptionStatus
		decErr := json.NewDecoder(resp.Body).Decode(&status)
		require.NoError(t, decErr)
		// Session ID must be returned so client can manage per-session encryption keys in localStorage
		assert.NotEmpty(t, status.SessionId, "Session ID is required for client-side key management")
	})
}

func TestEncryptionBulkKeysBoundary(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Exactly 200 user_ids is accepted", func(t *testing.T) {
		ids := make([]string, 200)
		for i := range ids {
			ids[i] = model.NewId()
		}
		req := &model.EncryptionPublicKeysRequest{
			UserIds: ids,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Exactly 201 user_ids is rejected", func(t *testing.T) {
		ids := make([]string, 201)
		for i := range ids {
			ids[i] = model.NewId()
		}
		req := &model.EncryptionPublicKeysRequest{
			UserIds: ids,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Single user_id is accepted", func(t *testing.T) {
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{model.NewId()},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Duplicate user_ids in bulk request are accepted", func(t *testing.T) {
		userId := model.NewId()
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{userId, userId, userId},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}
