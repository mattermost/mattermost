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
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
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

// setupPasskeyRegistration is setupPasskeys with enrollment on and a Site URL a browser would
// accept; mutate adjusts the config further.
func setupPasskeyRegistration(t *testing.T, mutate ...func(cfg *model.Config)) *TestHelper {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.Passkeys = true
		*cfg.ServiceSettings.EnablePasskeyEnrollment = true
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
		for _, m := range mutate {
			m(cfg)
		}
	})
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
	th.LoginBasic(t)

	return th
}

// registerPasskey runs a full ceremony as the logged-in th.Client and returns the finish result.
func registerPasskey(t *testing.T, th *TestHelper, userID, name string) (*model.Passkey, *model.Response, error) {
	t.Helper()

	opts, _, err := th.Client.BeginPasskeyRegistration(context.Background(), userID)
	require.NoError(t, err)
	auth, err := testlib.NewSoftAuthenticator()
	require.NoError(t, err)
	credential, err := auth.CreateResponse(opts.Options, "http://localhost:8065")
	require.NoError(t, err)

	return th.Client.FinishPasskeyRegistration(context.Background(), userID, &model.PasskeyRegistrationFinish{
		CeremonyId: opts.CeremonyId,
		Name:       name,
		Credential: credential,
	})
}

func TestPasskeyRegistration(t *testing.T) {
	t.Run("registers a passkey through me and the explicit id", func(t *testing.T) {
		th := setupPasskeyRegistration(t)

		for _, userID := range []string{model.Me, th.BasicUser.Id} {
			pk, resp, err := registerPasskey(t, th, userID, "laptop")
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
			assert.Equal(t, "laptop", pk.Name)
			assert.Equal(t, th.BasicUser.Id, pk.UserId)
			assert.NotEmpty(t, pk.Id)
		}

		passkeys, _, err := th.Client.GetPasskeysForUser(context.Background(), model.Me)
		require.NoError(t, err)
		assert.Len(t, passkeys, 2)
	})

	t.Run("finish response carries no credential material", func(t *testing.T) {
		th := setupPasskeyRegistration(t)

		opts, _, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.NoError(t, err)
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		credential, err := auth.CreateResponse(opts.Options, "http://localhost:8065")
		require.NoError(t, err)

		body, err := json.Marshal(model.PasskeyRegistrationFinish{CeremonyId: opts.CeremonyId, Credential: credential})
		require.NoError(t, err)
		r, err := th.Client.DoAPIPost(context.Background(), "/users/me/passkeys/registration/finish", string(body))
		require.NoError(t, err)
		defer r.Body.Close()
		assert.Equal(t, http.StatusCreated, r.StatusCode)
		var raw map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&raw))
		keys := make([]string, 0, len(raw))
		for k := range raw {
			keys = append(keys, k)
		}
		assert.ElementsMatch(t, []string{"id", "user_id", "name", "create_at", "last_used_at"}, keys)
		assert.NotEmpty(t, raw["name"], "empty name falls back to the default")
	})

	t.Run("enrollment on with login off still registers", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyLogin = false
		})

		_, resp, err := registerPasskey(t, th, model.Me, "laptop")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("flag off", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) { cfg.FeatureFlags.Passkeys = false })

		_, resp, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("no license", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		th.App.Srv().SetLicense(nil)

		_, resp, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("enrollment off", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyEnrollment = false
		})

		_, resp, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		_, resp, err = th.Client.FinishPasskeyRegistration(context.Background(), model.Me, &model.PasskeyRegistrationFinish{
			CeremonyId: model.NewId(), Credential: json.RawMessage(`{}`),
		})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("Site URL that cannot serve passkeys", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://chat.example.com"
		})

		_, resp, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("another user's id is forbidden even for a system admin", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		th.LoginSystemAdmin(t)

		_, resp, err := th.SystemAdminClient.BeginPasskeyRegistration(context.Background(), th.BasicUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = th.SystemAdminClient.FinishPasskeyRegistration(context.Background(), th.BasicUser.Id, &model.PasskeyRegistrationFinish{
			CeremonyId: model.NewId(), Credential: json.RawMessage(`{}`),
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("finish with an unknown ceremony id", func(t *testing.T) {
		th := setupPasskeyRegistration(t)

		_, resp, err := th.Client.FinishPasskeyRegistration(context.Background(), model.Me, &model.PasskeyRegistrationFinish{
			CeremonyId: model.NewId(), Credential: json.RawMessage(`{}`),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("finish with a malformed body or missing fields", func(t *testing.T) {
		th := setupPasskeyRegistration(t)

		r, err := th.Client.DoAPIPost(context.Background(), "/users/me/passkeys/registration/finish", "not json")
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(r))

		_, resp, err := th.Client.FinishPasskeyRegistration(context.Background(), model.Me, &model.PasskeyRegistrationFinish{
			Credential: json.RawMessage(`{}`),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = th.Client.FinishPasskeyRegistration(context.Background(), model.Me, &model.PasskeyRegistrationFinish{
			CeremonyId: model.NewId(),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("session older than ten minutes is refused", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		_, err := th.Server.Store().GetInternalMasterDB().Exec(
			`UPDATE Sessions SET CreateAt = $1 WHERE Token = $2`,
			model.GetMillis()-model.PasskeyRecentLoginWindow-1000, th.Client.AuthToken)
		require.NoError(t, err)
		th.App.ClearSessionCacheForUser(th.BasicUser.Id)

		_, resp, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.passkey.recent_login_required.app_error", appErr.Id)
	})
}
