// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// Tests in this file are not parallel: they set the license on their server.

func setupPasskeys(t *testing.T, flagEnabled bool) *TestHelper {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.Passkeys = flagEnabled
	})
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
	th.LoginBasic(t)

	return th
}

func savePasskey(t *testing.T, th *TestHelper, userID, name string) *model.Passkey {
	t.Helper()

	saved, err := th.App.Srv().Store().Passkey().SaveIfUnderLimit(&model.Passkey{
		UserId:       userID,
		Name:         name,
		UserHandle:   []byte("handle-" + userID),
		CredentialId: []byte("cred-" + model.NewId()),
		PublicKey:    []byte("key"),
		AAGUID:       []byte{},
	}, model.PasskeyMaxPerUser)
	require.NoError(t, err)
	return saved
}

func TestGetPasskeys(t *testing.T) {
	t.Run("lists own passkeys through me and the explicit id", func(t *testing.T) {
		th := setupPasskeys(t, true)
		first := savePasskey(t, th, th.BasicUser.Id, "laptop")
		second := savePasskey(t, th, th.BasicUser.Id, "phone")
		savePasskey(t, th, th.BasicUser2.Id, "not mine")

		for _, userID := range []string{model.Me, th.BasicUser.Id} {
			passkeys, resp, err := th.Client.GetPasskeysForUser(context.Background(), userID)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Len(t, passkeys, 2)
			assert.Equal(t, first.Id, passkeys[0].Id)
			assert.Equal(t, "laptop", passkeys[0].Name)
			assert.Equal(t, th.BasicUser.Id, passkeys[0].UserId)
			assert.NotZero(t, passkeys[0].CreateAt)
			assert.Equal(t, second.Id, passkeys[1].Id)
		}
	})

	t.Run("response carries no credential material", func(t *testing.T) {
		th := setupPasskeys(t, true)
		savePasskey(t, th, th.BasicUser.Id, "laptop")

		r, err := th.Client.DoAPIGet(context.Background(), "/users/me/passkeys", "")
		require.NoError(t, err)
		defer r.Body.Close()
		var raw []map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&raw))
		require.Len(t, raw, 1)
		keys := make([]string, 0, len(raw[0]))
		for k := range raw[0] {
			keys = append(keys, k)
		}
		assert.ElementsMatch(t, []string{"id", "user_id", "name", "create_at", "last_used_at"}, keys)
	})

	t.Run("none is an empty array", func(t *testing.T) {
		th := setupPasskeys(t, true)

		r, err := th.Client.DoAPIGet(context.Background(), "/users/me/passkeys", "")
		require.NoError(t, err)
		defer r.Body.Close()
		var raw json.RawMessage
		require.NoError(t, json.NewDecoder(r.Body).Decode(&raw))
		assert.JSONEq(t, "[]", string(raw))
	})

	t.Run("another user's id is forbidden", func(t *testing.T) {
		th := setupPasskeys(t, true)
		savePasskey(t, th, th.BasicUser2.Id, "theirs")

		_, resp, err := th.Client.GetPasskeysForUser(context.Background(), th.BasicUser2.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("flag off", func(t *testing.T) {
		th := setupPasskeys(t, false)
		_, resp, err := th.Client.GetPasskeysForUser(context.Background(), model.Me)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("no license", func(t *testing.T) {
		th := setupPasskeys(t, true)
		th.App.Srv().SetLicense(nil)
		_, resp, err := th.Client.GetPasskeysForUser(context.Background(), model.Me)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("license below Professional", func(t *testing.T) {
		th := setupPasskeys(t, true)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuE20))
		_, resp, err := th.Client.GetPasskeysForUser(context.Background(), model.Me)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("works with enrollment, login and Site URL all unset", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.Passkeys = true
			cfg.ServiceSettings.EnablePasskeyEnrollment = model.NewPointer(false)
			cfg.ServiceSettings.EnablePasskeyLogin = model.NewPointer(false)
			cfg.ServiceSettings.SiteURL = model.NewPointer("")
		})
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		th.LoginBasic(t)
		savePasskey(t, th, th.BasicUser.Id, "laptop")

		passkeys, resp, err := th.Client.GetPasskeysForUser(context.Background(), model.Me)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Len(t, passkeys, 1)
	})
}

func TestDeletePasskey(t *testing.T) {
	t.Run("deletes own passkey", func(t *testing.T) {
		th := setupPasskeys(t, true)
		pk := savePasskey(t, th, th.BasicUser.Id, "laptop")
		keep := savePasskey(t, th, th.BasicUser.Id, "phone")

		resp, err := th.Client.DeletePasskey(context.Background(), model.Me, pk.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		passkeys, _, err := th.Client.GetPasskeysForUser(context.Background(), model.Me)
		require.NoError(t, err)
		require.Len(t, passkeys, 1)
		assert.Equal(t, keep.Id, passkeys[0].Id)
	})

	t.Run("another user's passkey under own path is not found and survives", func(t *testing.T) {
		th := setupPasskeys(t, true)
		theirs := savePasskey(t, th, th.BasicUser2.Id, "theirs")

		resp, err := th.Client.DeletePasskey(context.Background(), th.BasicUser.Id, theirs.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		passkeys, err := th.App.GetPasskeysForUser(th.BasicUser2.Id)
		require.Nil(t, err)
		assert.Len(t, passkeys, 1)
	})

	t.Run("another user's path is forbidden", func(t *testing.T) {
		th := setupPasskeys(t, true)
		theirs := savePasskey(t, th, th.BasicUser2.Id, "theirs")

		resp, err := th.Client.DeletePasskey(context.Background(), th.BasicUser2.Id, theirs.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser2.Id)
		require.Nil(t, appErr)
		assert.Len(t, passkeys, 1)
	})

	t.Run("malformed passkey id", func(t *testing.T) {
		th := setupPasskeys(t, true)

		resp, err := th.Client.DeletePasskey(context.Background(), model.Me, "short")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unknown passkey id", func(t *testing.T) {
		th := setupPasskeys(t, true)

		resp, err := th.Client.DeletePasskey(context.Background(), model.Me, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("flag off", func(t *testing.T) {
		th := setupPasskeys(t, false)
		resp, err := th.Client.DeletePasskey(context.Background(), model.Me, model.NewId())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("no license", func(t *testing.T) {
		th := setupPasskeys(t, true)
		th.App.Srv().SetLicense(nil)
		resp, err := th.Client.DeletePasskey(context.Background(), model.Me, model.NewId())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("license below Professional", func(t *testing.T) {
		th := setupPasskeys(t, true)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuE20))
		resp, err := th.Client.DeletePasskey(context.Background(), model.Me, model.NewId())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("works with enrollment, login and Site URL all unset", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.Passkeys = true
			cfg.ServiceSettings.EnablePasskeyEnrollment = model.NewPointer(false)
			cfg.ServiceSettings.EnablePasskeyLogin = model.NewPointer(false)
			cfg.ServiceSettings.SiteURL = model.NewPointer("")
		})
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		th.LoginBasic(t)
		pk := savePasskey(t, th, th.BasicUser.Id, "laptop")

		resp, err := th.Client.DeletePasskey(context.Background(), model.Me, pk.Id)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
