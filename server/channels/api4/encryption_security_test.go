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
// ENCRYPTION API SECURITY
// ----------------------------------------------------------------------------

func TestEncryptionSecurityFeatureFlagDisabled(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = false
	})

	t.Run("RegisterPublicKey returns 403 when encryption disabled", func(t *testing.T) {
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("A", 200) + `","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GetEncryptionStatus returns OK with disabled flag when encryption off", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/status", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var status model.EncryptionStatus
		decErr := json.NewDecoder(resp.Body).Decode(&status)
		require.NoError(t, decErr)
		assert.False(t, status.Enabled)
		assert.False(t, status.CanEncrypt)
	})

	t.Run("GetMyPublicKey returns OK with empty key when encryption off", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var key model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&key)
		require.NoError(t, decErr)
		assert.Empty(t, key.PublicKey)
	})
}

func TestEncryptionSecurityAdminEndpoints(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("GET admin/keys returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/admin/keys", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE admin/keys returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE admin/keys/orphaned returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/orphaned")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE admin/keys/session/{id} returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/session/"+model.NewId())
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE admin/keys/{user_id} returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIDelete(context.Background(), "/encryption/admin/keys/"+th.BasicUser.Id)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can access GET admin/keys", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/encryption/admin/keys", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can access DELETE admin/keys", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Admin can access DELETE admin/keys/orphaned", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys/orphaned")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestEncryptionSecurityChannelPermissions(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Non-member of private channel gets 403 for channel keys", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		th.LoginBasic2(t)
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/channel/"+privateChannel.Id+"/keys", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Channel member can access channel keys", func(t *testing.T) {
		th.LoginBasic(t)
		resp, err := th.Client.DoAPIGet(context.Background(), "/encryption/channel/"+th.BasicChannel.Id+"/keys", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestEncryptionSecurityInputValidation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Bulk public keys with empty user_ids returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Bulk public keys with invalid user_id format returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{"invalid-id-format"},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Bulk public keys with >200 user_ids returns 400", func(t *testing.T) {
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

	t.Run("Register public key with empty key returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: "",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Register public key with non-JSON format returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: "not-json-key",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Register public key with short invalid JSON returns 400", func(t *testing.T) {
		req := &model.EncryptionPublicKeyRequest{
			PublicKey: "{a}",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}

func TestEncryptionSecuritySessionIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("User can only see own key via GET publickey", func(t *testing.T) {
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("A", 200) + `","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		th.LoginBasic2(t)
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var key model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&key)
		require.NoError(t, decErr)
		assert.Empty(t, key.PublicKey)
		assert.Equal(t, th.BasicUser2.Id, key.UserId)
	})

	t.Run("User2 can fetch User1 key only via bulk endpoint", func(t *testing.T) {
		th.LoginBasic2(t)
		req := &model.EncryptionPublicKeysRequest{
			UserIds: []string{th.BasicUser.Id},
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickeys", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var keys []*model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, decErr)
		assert.NotEmpty(t, keys)
	})
}

func TestEncryptionAdminDeleteUserKeysIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Encryption = true
	})

	t.Run("Admin deleting user1 keys does not affect user2", func(t *testing.T) {
		th.LoginBasic(t)
		keyReq := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("A", 200) + `","e":"AQAB"}`,
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		th.LoginBasic2(t)
		keyReq2 := &model.EncryptionPublicKeyRequest{
			PublicKey: `{"kty":"RSA","n":"` + strings.Repeat("B", 200) + `","e":"AQAB"}`,
		}
		resp, err = th.Client.DoAPIPostJSON(context.Background(), "/encryption/publickey", keyReq2)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)

		resp, err = th.SystemAdminClient.DoAPIDelete(context.Background(), "/encryption/admin/keys/"+th.BasicUser.Id)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)

		// Don't re-login as BasicUser2 - th.Client is already authenticated from LoginBasic2 above.
		// Re-logging would create a new session, but the key was registered on the previous session.
		resp, err = th.Client.DoAPIGet(context.Background(), "/encryption/publickey", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var key model.EncryptionPublicKey
		decErr := json.NewDecoder(resp.Body).Decode(&key)
		require.NoError(t, decErr)
		assert.NotEmpty(t, key.PublicKey)
		assert.Contains(t, key.PublicKey, strings.Repeat("B", 200))
	})
}
