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

	t.Run("Minimal valid-format key is accepted (server has no JWK validation)", func(t *testing.T) {
		// This is a valid concern: server only checks starts-with-{ and len>=10
		// A weak 512-bit RSA key in JWK format would pass validation
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"weak","e":"AQAB","extra":"pad"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
	})

	t.Run("Key that is valid JSON object but not JWK is accepted", func(t *testing.T) {
		// Server only checks first char is { and length, not actual JWK structure
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"not_a_key": "this is just arbitrary JSON data"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
	})

	t.Run("Oversized public key payload is accepted (no max size check)", func(t *testing.T) {
		// No server-side max size on public keys - potential storage abuse
		largeKey := `{"kty":"RSA","n":"` + strings.Repeat("A", 100*1024) + `","e":"AQAB"}`
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: largeKey,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		// Document current behavior: accepted (no size limit enforced)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
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
			PublicKey: `{"kty":"RSA","n":"original-key-data","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req1)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		// Overwrite with new key
		req2 := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"replaced-key-data","e":"AQAB"}`,
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
		assert.Contains(t, key.PublicKey, "replaced-key-data")
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
			PublicKey: `{"kty":"RSA","n":"user1-enumeration-test","e":"AQAB"}`,
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

	t.Run("Encryption status endpoint returns session_id to caller", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var status model.EncryptionStatus
		decErr := json.NewDecoder(resp.Body).Decode(&status)
		require.NoError(t, decErr)
		// Session ID is returned (needed for key storage but is sensitive)
		assert.NotEmpty(t, status.SessionId)
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
