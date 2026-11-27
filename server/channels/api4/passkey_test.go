// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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

	t.Run("response carries the credential id and user handle but no other credential material", func(t *testing.T) {
		th := setupPasskeys(t, true)
		saved := savePasskey(t, th, th.BasicUser.Id, "laptop")

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
		assert.ElementsMatch(t, []string{"id", "user_id", "name", "create_at", "last_used_at", "credential_id", "user_handle"}, keys)
		credentialId, err := base64.RawURLEncoding.DecodeString(raw[0]["credential_id"].(string))
		require.NoError(t, err)
		assert.Equal(t, saved.CredentialId, credentialId)
		userHandle, err := base64.RawURLEncoding.DecodeString(raw[0]["user_handle"].(string))
		require.NoError(t, err)
		assert.Equal(t, saved.UserHandle, userHandle)
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
		require.NoError(t, err)
		assert.Len(t, passkeys, 1)
	})

	t.Run("another user's path is forbidden", func(t *testing.T) {
		th := setupPasskeys(t, true)
		theirs := savePasskey(t, th, th.BasicUser2.Id, "theirs")

		resp, err := th.Client.DeletePasskey(context.Background(), th.BasicUser2.Id, theirs.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser2.Id)
		require.NoError(t, appErr)
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

	auth, err := testlib.NewSoftAuthenticator()
	require.NoError(t, err)
	return registerPasskeyWith(t, th, userID, name, auth)
}

// registerPasskeyWith is registerPasskey with a caller-held authenticator, so the test can sign in with it later.
func registerPasskeyWith(t *testing.T, th *TestHelper, userID, name string, auth *testlib.SoftAuthenticator) (*model.Passkey, *model.Response, error) {
	t.Helper()

	opts, _, err := th.Client.BeginPasskeyRegistration(context.Background(), userID)
	require.NoError(t, err)
	credential, err := auth.CreateResponse(opts.Options, "http://localhost:8065")
	require.NoError(t, err)

	return th.Client.FinishPasskeyRegistration(context.Background(), userID, &model.PasskeyRegistrationFinish{
		CeremonyId: opts.CeremonyId,
		Name:       name,
		Credential: credential,
	})
}

// ageSession backdates the client's session past the recent sign-in window.
func ageSession(t *testing.T, th *TestHelper, client *model.Client4) {
	t.Helper()

	_, err := th.Server.Store().GetInternalMasterDB().Exec(
		`UPDATE Sessions SET CreateAt = $1 WHERE Token = $2`,
		model.GetMillis()-model.PasskeyRecentLoginWindow-1000, client.AuthToken)
	require.NoError(t, err)
	th.App.ClearSessionCacheForUser(th.BasicUser.Id)
}

func TestCreatePasskeyEnrollmentTicket(t *testing.T) {
	t.Run("issues a ticket through me and the explicit id", func(t *testing.T) {
		th := setupPasskeyRegistration(t)

		for _, userID := range []string{model.Me, th.BasicUser.Id} {
			ticket, resp, err := th.Client.CreatePasskeyEnrollmentTicket(context.Background(), userID)
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
			assert.Len(t, ticket.Ticket, 64)
			assert.InDelta(t, model.GetMillis()+model.PasskeyEnrollmentTicketExpiryTime, ticket.ExpireAt, 5000)
		}
	})

	t.Run("ticket belongs to the request's own session", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		other := th.CreateClient()
		th.LoginBasicWithClient(t, other)

		ticket, _, err := th.Client.CreatePasskeyEnrollmentTicket(context.Background(), model.Me)
		require.NoError(t, err)

		token, err := th.App.Srv().Store().Token().GetByToken(ticket.Ticket)
		require.NoError(t, err)
		var extra struct {
			SessionID string `json:"session_id"`
		}
		require.NoError(t, json.Unmarshal([]byte(token.Extra), &extra))
		own, appErr := th.App.GetSession(th.Client.AuthToken)
		require.Nil(t, appErr)
		otherSession, appErr := th.App.GetSession(other.AuthToken)
		require.Nil(t, appErr)
		assert.Equal(t, own.Id, extra.SessionID)
		assert.NotEqual(t, otherSession.Id, extra.SessionID)
	})

	t.Run("enrollment on with login off still issues", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyLogin = false
		})

		_, resp, err := th.Client.CreatePasskeyEnrollmentTicket(context.Background(), model.Me)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("session older than ten minutes still issues", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		ageSession(t, th, th.Client)

		_, resp, err := th.Client.CreatePasskeyEnrollmentTicket(context.Background(), model.Me)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	checkNotImplemented := func(t *testing.T, th *TestHelper, id string) {
		t.Helper()
		_, resp, err := th.Client.CreatePasskeyEnrollmentTicket(context.Background(), model.Me)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, id, appErr.Id)
	}

	t.Run("flag off", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) { cfg.FeatureFlags.Passkeys = false })
		checkNotImplemented(t, th, "api.passkey.feature_disabled.app_error")
	})

	t.Run("no license", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		th.App.Srv().SetLicense(nil)
		checkNotImplemented(t, th, "api.passkey.license.app_error")
	})

	t.Run("enrollment off", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyEnrollment = false
		})
		checkNotImplemented(t, th, "api.passkey.enrollment_disabled.app_error")
	})

	t.Run("Site URL that cannot serve passkeys", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://chat.example.com"
		})
		checkNotImplemented(t, th, "api.passkey.unavailable.app_error")
	})

	t.Run("another user's id is forbidden even for a system admin", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		th.LoginSystemAdmin(t)

		_, resp, err := th.SystemAdminClient.CreatePasskeyEnrollmentTicket(context.Background(), th.BasicUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = th.Client.CreatePasskeyEnrollmentTicket(context.Background(), th.BasicUser2.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("bot is refused", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableBotAccountCreation = true })
		th.LoginSystemAdmin(t)
		bot := th.CreateBotWithSystemAdminClient(t)
		token, _, err := th.SystemAdminClient.CreateUserAccessToken(context.Background(), bot.UserId, "test", 0)
		require.NoError(t, err)
		botClient := th.CreateClient()
		botClient.SetToken(token.Token)

		_, resp, err := botClient.CreatePasskeyEnrollmentTicket(context.Background(), model.Me)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.passkey.user_not_allowed.app_error", appErr.Id)
	})
}

// registerWithTicket runs a full ticket ceremony on client, which needs no session.
func registerWithTicket(t *testing.T, client *model.Client4, ticket string) (*model.Passkey, *model.Response, error) {
	t.Helper()

	opts, _, err := client.BeginPasskeyRegistrationWithTicket(context.Background(), ticket)
	require.NoError(t, err)
	auth, err := testlib.NewSoftAuthenticator()
	require.NoError(t, err)
	credential, err := auth.CreateResponse(opts.Options, "http://localhost:8065")
	require.NoError(t, err)

	return client.FinishPasskeyRegistrationWithTicket(context.Background(), &model.PasskeyRegistrationFinish{
		CeremonyId: opts.CeremonyId,
		Credential: credential,
	})
}

func TestPasskeyRegistrationWithTicket(t *testing.T) {
	issue := func(t *testing.T, client *model.Client4) string {
		t.Helper()
		ticket, _, err := client.CreatePasskeyEnrollmentTicket(context.Background(), model.Me)
		require.NoError(t, err)
		return ticket.Ticket
	}

	checkBeginFails := func(t *testing.T, client *model.Client4, ticket string, check func(testing.TB, *model.Response), id string) {
		t.Helper()
		_, resp, err := client.BeginPasskeyRegistrationWithTicket(context.Background(), ticket)
		require.Error(t, err)
		check(t, resp)
		CheckErrorID(t, err, id)
	}

	t.Run("a client that never signed in registers a passkey for the ticket's user", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		browser := th.CreateClient()

		pk, resp, err := registerWithTicket(t, browser, issue(t, th.Client))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		assert.Equal(t, th.BasicUser.Id, pk.UserId)

		list, _, err := th.Client.GetPasskeysForUser(context.Background(), model.Me)
		require.NoError(t, err)
		require.Len(t, list, 1)
		assert.Equal(t, pk.Id, list[0].Id)
	})

	t.Run("the ticket, not the browser's session, decides the account", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		browser := th.CreateClient()
		th.LoginBasic2WithClient(t, browser)

		pk, _, err := registerWithTicket(t, browser, issue(t, th.Client))
		require.NoError(t, err)
		assert.Equal(t, th.BasicUser.Id, pk.UserId)

		mine, _, err := th.Client.GetPasskeysForUser(context.Background(), model.Me)
		require.NoError(t, err)
		assert.Len(t, mine, 1)
		theirs, _, err := browser.GetPasskeysForUser(context.Background(), model.Me)
		require.NoError(t, err)
		assert.Empty(t, theirs)
	})

	t.Run("login off still registers", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyLogin = false
		})

		_, resp, err := registerWithTicket(t, th.CreateClient(), issue(t, th.Client))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("a spent ticket is refused", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		browser := th.CreateClient()
		ticket := issue(t, th.Client)

		_, _, err := registerWithTicket(t, browser, ticket)
		require.NoError(t, err)

		checkBeginFails(t, browser, ticket, CheckBadRequestStatus, "app.passkey.ticket_invalid.app_error")
	})

	t.Run("an expired ticket is refused", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		ticket := issue(t, th.Client)
		_, err := th.Server.Store().GetInternalMasterDB().Exec(
			`UPDATE Tokens SET CreateAt = $1 WHERE Token = $2`,
			model.GetMillis()-model.PasskeyEnrollmentTicketExpiryTime-1000, ticket)
		require.NoError(t, err)

		checkBeginFails(t, th.CreateClient(), ticket, CheckBadRequestStatus, "app.passkey.ticket_invalid.app_error")
	})

	t.Run("a ticket whose issuing session signed out is refused", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		ticket := issue(t, th.Client)
		_, err := th.Client.Logout(context.Background())
		require.NoError(t, err)

		checkBeginFails(t, th.CreateClient(), ticket, CheckBadRequestStatus, "app.passkey.ticket_invalid.app_error")
	})

	t.Run("recency is judged on the issuing session", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		fresh := th.CreateClient()
		th.LoginBasicWithClient(t, fresh)
		ticket := issue(t, th.Client)
		ageSession(t, th, th.Client)

		checkBeginFails(t, th.CreateClient(), ticket, CheckForbiddenStatus, "app.passkey.recent_login_required.app_error")
	})

	t.Run("a ticket issued from a passkey sign-in is refused", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		viaPasskey := th.CreateClient()
		_, _, err := signInWithPasskey(t, viaPasskey, auth)
		require.NoError(t, err)

		checkBeginFails(t, th.CreateClient(), issue(t, viaPasskey), CheckForbiddenStatus, "app.passkey.recent_login_required.app_error")
	})

	t.Run("a ceremony begun with a ticket cannot finish through the session route", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		browser := th.CreateClient()
		ticket := issue(t, th.Client)

		opts, _, err := browser.BeginPasskeyRegistrationWithTicket(context.Background(), ticket)
		require.NoError(t, err)
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		credential, err := auth.CreateResponse(opts.Options, "http://localhost:8065")
		require.NoError(t, err)

		_, _, err = th.Client.FinishPasskeyRegistration(context.Background(), model.Me, &model.PasskeyRegistrationFinish{
			CeremonyId: opts.CeremonyId, Credential: credential,
		})
		require.Error(t, err)
		CheckErrorID(t, err, "app.passkey.ceremony_invalid.app_error")

		_, resp, err := registerWithTicket(t, browser, ticket)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	checkGated := func(t *testing.T, th *TestHelper, id string) {
		t.Helper()
		browser := th.CreateClient()
		_, resp, err := browser.BeginPasskeyRegistrationWithTicket(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, id)

		_, resp, err = browser.FinishPasskeyRegistrationWithTicket(context.Background(), &model.PasskeyRegistrationFinish{
			CeremonyId: model.NewId(), Credential: json.RawMessage(`{}`),
		})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, id)
	}

	t.Run("flag off", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) { cfg.FeatureFlags.Passkeys = false })
		checkGated(t, th, "api.passkey.feature_disabled.app_error")
	})

	t.Run("no license", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		th.App.Srv().SetLicense(nil)
		checkGated(t, th, "api.passkey.license.app_error")
	})

	t.Run("enrollment off", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyEnrollment = false
		})
		checkGated(t, th, "api.passkey.enrollment_disabled.app_error")
	})

	t.Run("Site URL that cannot serve passkeys", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://chat.example.com"
		})
		checkGated(t, th, "api.passkey.unavailable.app_error")
	})

	t.Run("malformed body or missing fields", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		browser := th.CreateClient()

		for _, path := range []string{"begin", "finish"} {
			r, err := browser.DoAPIPost(context.Background(), "/users/passkeys/enrollment/registration/"+path, "not json")
			require.Error(t, err)
			CheckBadRequestStatus(t, model.BuildResponse(r))
		}

		_, resp, err := browser.BeginPasskeyRegistrationWithTicket(context.Background(), "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = browser.FinishPasskeyRegistrationWithTicket(context.Background(), &model.PasskeyRegistrationFinish{
			Credential: json.RawMessage(`{}`),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = browser.FinishPasskeyRegistrationWithTicket(context.Background(), &model.PasskeyRegistrationFinish{
			CeremonyId: model.NewId(),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestPasskeyVerificationWithTicket(t *testing.T) {
	issue := func(t *testing.T, client *model.Client4) string {
		t.Helper()
		ticket, _, err := client.CreatePasskeyEnrollmentTicket(context.Background(), model.Me)
		require.NoError(t, err)
		return ticket.Ticket
	}

	begin := func(t *testing.T, client *model.Client4, ticket string) *model.PasskeyLoginOptions {
		t.Helper()
		opts, _, err := client.BeginPasskeyVerificationWithTicket(context.Background(), ticket)
		require.NoError(t, err)
		return opts
	}

	finish := func(t *testing.T, client *model.Client4, auth *testlib.SoftAuthenticator, opts *model.PasskeyLoginOptions) (*model.PasskeyVerification, *model.Response, error) {
		t.Helper()
		credential, err := auth.GetAssertion(opts.Options, "http://localhost:8065")
		require.NoError(t, err)
		return client.FinishPasskeyVerificationWithTicket(context.Background(), &model.PasskeyLoginFinish{
			CeremonyId: opts.CeremonyId,
			Credential: credential,
		})
	}

	sessionCount := func(t *testing.T, th *TestHelper) int {
		t.Helper()
		sessions, appErr := th.App.GetSessions(th.Context, th.BasicUser.Id)
		require.Nil(t, appErr)
		return len(sessions)
	}

	t.Run("a client that never signed in verifies a passkey and records its use", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, pk := registerAndAuthenticator(t, th)
		browser := th.CreateClient()

		opts := begin(t, browser, issue(t, th.Client))
		verified, resp, err := finish(t, browser, auth, opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Equal(t, th.BasicUser.Id, verified.UserId)

		list, appErr := th.App.GetPasskeysForUser(th.BasicUser.Id)
		require.NoError(t, appErr)
		require.Len(t, list, 1)
		assert.Equal(t, pk.Id, list[0].Id)
		assert.NotZero(t, list[0].LastUsedAt)
	})

	t.Run("creates no session and sets no cookies", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		browser := th.CreateClient()
		browser.HTTPHeader[model.HeaderRequestedWith] = model.HeaderRequestedWithXML
		before := sessionCount(t, th)

		_, resp, err := finish(t, browser, auth, begin(t, browser, issue(t, th.Client)))
		require.NoError(t, err)
		assert.Empty(t, resp.Header.Get(model.HeaderToken))
		assert.Empty(t, resp.Header.Values("Set-Cookie"))
		assert.Empty(t, browser.AuthToken)
		assert.Equal(t, before, sessionCount(t, th))
	})

	t.Run("login off still verifies", func(t *testing.T) {
		th := setupPasskeyLogin(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyLogin = false
		})
		auth, _ := registerAndAuthenticator(t, th)
		browser := th.CreateClient()

		_, resp, err := finish(t, browser, auth, begin(t, browser, issue(t, th.Client)))
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("a user without passkeys has nothing to verify", func(t *testing.T) {
		th := setupPasskeyLogin(t)

		_, resp, err := th.CreateClient().BeginPasskeyVerificationWithTicket(context.Background(), issue(t, th.Client))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.none_registered.app_error")
	})

	t.Run("an undecodable credential is refused", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		registerAndAuthenticator(t, th)
		browser := th.CreateClient()
		opts := begin(t, browser, issue(t, th.Client))

		_, resp, err := browser.FinishPasskeyVerificationWithTicket(context.Background(), &model.PasskeyLoginFinish{
			CeremonyId: opts.CeremonyId,
			Credential: json.RawMessage(`{"id":1}`),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.invalid_credential.app_error")
	})

	t.Run("another user's authenticator is refused", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		registerAndAuthenticator(t, th)
		other := th.CreateClient()
		th.LoginBasic2WithClient(t, other)
		otherAuth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		regOpts, _, err := other.BeginPasskeyRegistration(context.Background(), model.Me)
		require.NoError(t, err)
		credential, err := otherAuth.CreateResponse(regOpts.Options, "http://localhost:8065")
		require.NoError(t, err)
		_, _, err = other.FinishPasskeyRegistration(context.Background(), model.Me, &model.PasskeyRegistrationFinish{
			CeremonyId: regOpts.CeremonyId, Credential: credential,
		})
		require.NoError(t, err)

		browser := th.CreateClient()
		_, resp, err := finish(t, browser, otherAuth, begin(t, browser, issue(t, th.Client)))
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.invalid_credential.app_error")
	})

	t.Run("a counter that did not advance is refused", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		browser := th.CreateClient()
		auth.SignCount = 5
		_, resp, err := finish(t, browser, auth, begin(t, browser, issue(t, th.Client)))
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, resp, err = finish(t, browser, auth, begin(t, browser, issue(t, th.Client)))
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.counter_regressed.app_error")
	})

	t.Run("a spent ticket is refused", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		browser := th.CreateClient()
		ticket := issue(t, th.Client)

		_, _, err := finish(t, browser, auth, begin(t, browser, ticket))
		require.NoError(t, err)

		_, resp, err := browser.BeginPasskeyVerificationWithTicket(context.Background(), ticket)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.ticket_invalid.app_error")
	})

	t.Run("a ticket whose session aged past the sign-in window still verifies", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		browser := th.CreateClient()
		ticket := issue(t, th.Client)
		ageSession(t, th, th.Client)

		_, resp, err := finish(t, browser, auth, begin(t, browser, ticket))
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("a verification ceremony cannot finish as a sign-in", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		browser := th.CreateClient()
		opts := begin(t, browser, issue(t, th.Client))

		user, resp, err := browser.FinishPasskeyLogin(context.Background(), &model.PasskeyLoginFinish{
			CeremonyId: opts.CeremonyId,
			Credential: func() []byte {
				credential, err := auth.GetAssertion(opts.Options, "http://localhost:8065")
				require.NoError(t, err)
				return credential
			}(),
		})
		require.Error(t, err)
		assert.Nil(t, user)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.ceremony_invalid.app_error")
		assert.Empty(t, browser.AuthToken)
	})

	checkGated := func(t *testing.T, th *TestHelper, id string) {
		t.Helper()
		browser := th.CreateClient()
		_, resp, err := browser.BeginPasskeyVerificationWithTicket(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, id)

		_, resp, err = browser.FinishPasskeyVerificationWithTicket(context.Background(), &model.PasskeyLoginFinish{
			CeremonyId: model.NewId(), Credential: json.RawMessage(`{}`),
		})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, id)
	}

	t.Run("flag off", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) { cfg.FeatureFlags.Passkeys = false })
		checkGated(t, th, "api.passkey.feature_disabled.app_error")
	})

	t.Run("no license", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		th.App.Srv().SetLicense(nil)
		checkGated(t, th, "api.passkey.license.app_error")
	})

	t.Run("enrollment off", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyEnrollment = false
		})
		checkGated(t, th, "api.passkey.enrollment_disabled.app_error")
	})

	t.Run("Site URL that cannot serve passkeys", func(t *testing.T) {
		th := setupPasskeyRegistration(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://chat.example.com"
		})
		checkGated(t, th, "api.passkey.unavailable.app_error")
	})

	t.Run("malformed body or missing fields", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		browser := th.CreateClient()

		for _, path := range []string{"begin", "finish"} {
			r, err := browser.DoAPIPost(context.Background(), "/users/passkeys/enrollment/verification/"+path, "not json")
			require.Error(t, err)
			CheckBadRequestStatus(t, model.BuildResponse(r))
		}

		_, resp, err := browser.BeginPasskeyVerificationWithTicket(context.Background(), "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = browser.FinishPasskeyVerificationWithTicket(context.Background(), &model.PasskeyLoginFinish{
			Credential: json.RawMessage(`{}`),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = browser.FinishPasskeyVerificationWithTicket(context.Background(), &model.PasskeyLoginFinish{
			CeremonyId: model.NewId(),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
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

	t.Run("finish response carries the credential id and user handle but no other credential material", func(t *testing.T) {
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
		assert.ElementsMatch(t, []string{"id", "user_id", "name", "create_at", "last_used_at", "credential_id", "user_handle"}, keys)
		assert.NotEmpty(t, raw["name"], "empty name falls back to the default")

		stored, err := th.App.Srv().Store().Passkey().GetForUser(th.BasicUser.Id)
		require.NoError(t, err)
		require.Len(t, stored, 1)
		credentialId, err := base64.RawURLEncoding.DecodeString(raw["credential_id"].(string))
		require.NoError(t, err)
		assert.Equal(t, stored[0].CredentialId, credentialId)
		userHandle, err := base64.RawURLEncoding.DecodeString(raw["user_handle"].(string))
		require.NoError(t, err)
		assert.Equal(t, stored[0].UserHandle, userHandle)
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
		ageSession(t, th, th.Client)

		_, resp, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.passkey.recent_login_required.app_error", appErr.Id)
	})

	t.Run("recency is judged on the request's own session", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		fresh := th.CreateClient()
		th.LoginBasicWithClient(t, fresh)
		ageSession(t, th, th.Client)

		_, resp, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.passkey.recent_login_required.app_error", appErr.Id)

		opts, _, err := fresh.BeginPasskeyRegistration(context.Background(), model.Me)
		require.NoError(t, err)
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		credential, err := auth.CreateResponse(opts.Options, "http://localhost:8065")
		require.NoError(t, err)
		_, resp, err = fresh.FinishPasskeyRegistration(context.Background(), model.Me, &model.PasskeyRegistrationFinish{
			CeremonyId: opts.CeremonyId, Credential: credential,
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("finish from another session of the same user is refused", func(t *testing.T) {
		th := setupPasskeyRegistration(t)
		other := th.CreateClient()
		th.LoginBasicWithClient(t, other)

		opts, _, err := th.Client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.NoError(t, err)
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		credential, err := auth.CreateResponse(opts.Options, "http://localhost:8065")
		require.NoError(t, err)

		_, resp, err := other.FinishPasskeyRegistration(context.Background(), model.Me, &model.PasskeyRegistrationFinish{
			CeremonyId: opts.CeremonyId, Credential: credential,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.passkey.ceremony_invalid.app_error", appErr.Id)
	})
}

func setupPasskeyLogin(t *testing.T, mutate ...func(cfg *model.Config)) *TestHelper {
	t.Helper()

	return setupPasskeyRegistration(t, append([]func(cfg *model.Config){func(cfg *model.Config) {
		*cfg.ServiceSettings.EnablePasskeyLogin = true
	}}, mutate...)...)
}

func registerAndAuthenticator(t *testing.T, th *TestHelper) (*testlib.SoftAuthenticator, *model.Passkey) {
	t.Helper()

	auth, err := testlib.NewSoftAuthenticator()
	require.NoError(t, err)
	pk, _, err := registerPasskeyWith(t, th, model.Me, "laptop", auth)
	require.NoError(t, err)
	return auth, pk
}

func signInWithPasskey(t *testing.T, client *model.Client4, auth *testlib.SoftAuthenticator) (*model.User, *model.Response, error) {
	t.Helper()

	opts, _, err := client.BeginPasskeyLogin(context.Background())
	require.NoError(t, err)
	credential, err := auth.GetAssertion(opts.Options, "http://localhost:8065")
	require.NoError(t, err)
	return client.FinishPasskeyLogin(context.Background(), &model.PasskeyLoginFinish{
		CeremonyId: opts.CeremonyId,
		Credential: credential,
	})
}

func TestPasskeyLogin(t *testing.T) {
	t.Run("signs in on a fresh client and marks the session", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, pk := registerAndAuthenticator(t, th)

		client := th.CreateClient()
		user, resp, err := signInWithPasskey(t, client, auth)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Equal(t, th.BasicUser.Id, user.Id)
		assert.Empty(t, user.Password)
		assert.NotEmpty(t, client.AuthToken)

		me, _, err := client.GetMe(context.Background(), "")
		require.NoError(t, err)
		assert.Equal(t, th.BasicUser.Id, me.Id)

		session, appErr := th.App.GetSession(client.AuthToken)
		require.Nil(t, appErr)
		assert.Equal(t, model.SessionLoginMethodPasskey, session.Props[model.SessionPropLoginMethod])
		assert.Equal(t, pk.Id, session.Props[model.SessionPropPasskeyId])
	})

	t.Run("sets session cookies with X-Requested-With", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)

		client := th.CreateClient()
		client.HTTPHeader[model.HeaderRequestedWith] = model.HeaderRequestedWithXML
		_, resp, err := signInWithPasskey(t, client, auth)
		require.NoError(t, err)

		sessionCookie, methodCookie := "", ""
		for _, cookie := range resp.Header["Set-Cookie"] {
			if match := regexp.MustCompile("^" + model.SessionCookieToken + "=([a-z0-9]+)").FindStringSubmatch(cookie); match != nil {
				sessionCookie = match[1]
			} else if match := regexp.MustCompile("^" + model.SessionCookieLoginMethod + "=([a-z]+)").FindStringSubmatch(cookie); match != nil {
				methodCookie = match[1]
			}
		}
		assert.Equal(t, client.AuthToken, sessionCookie)
		assert.Equal(t, model.SessionLoginMethodPasskey, methodCookie)
	})

	t.Run("sets no cookies without X-Requested-With", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)

		_, resp, err := signInWithPasskey(t, th.CreateClient(), auth)
		require.NoError(t, err)
		assert.Empty(t, resp.Header.Get("Set-Cookie"))
	})

	t.Run("session length follows the user's normal method", func(t *testing.T) {
		const hour = int64(time.Hour / time.Millisecond)
		th := setupPasskeyLogin(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SessionLengthWebInHours = 1
			*cfg.ServiceSettings.SessionLengthSSOInHours = 2
			*cfg.ServiceSettings.SessionLengthMobileInHours = 3
		})
		auth, _ := registerAndAuthenticator(t, th)

		length := func(client *model.Client4) int64 {
			session, appErr := th.App.GetSession(client.AuthToken)
			require.Nil(t, appErr)
			return session.ExpiresAt - session.CreateAt
		}

		web := th.CreateClient()
		_, _, err := signInWithPasskey(t, web, auth)
		require.NoError(t, err)
		assert.InDelta(t, hour, length(web), 1000)

		mobile := th.CreateClient()
		mobile.HTTPHeader["User-Agent"] = "Mattermost Mobile/2.20 (iPhone; iOS 17)"
		_, _, err = signInWithPasskey(t, mobile, auth)
		require.NoError(t, err)
		assert.InDelta(t, 3*hour, length(mobile), 1000)

		_, err = th.App.Srv().Store().User().UpdateAuthData(th.BasicUser.Id, model.UserAuthServiceSaml, model.NewPointer("saml-id"), "", false)
		require.NoError(t, err)
		th.App.Srv().Store().User().InvalidateProfileCacheForUser(th.BasicUser.Id)
		sso := th.CreateClient()
		_, _, err = signInWithPasskey(t, sso, auth)
		require.NoError(t, err)
		assert.InDelta(t, 2*hour, length(sso), 1000)
	})

	t.Run("satisfies enforced MFA that a password session does not", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		// Enforced after registration: the password session that registered the passkey would be refused otherwise.
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional, "mfa"))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableMultifactorAuthentication = true
			*cfg.ServiceSettings.EnforceMultifactorAuthentication = true
		})

		client := th.CreateClient()
		_, _, err := signInWithPasskey(t, client, auth)
		require.NoError(t, err)
		_, resp, err := client.GetTeamsForUser(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		th.LoginBasic(t)
		_, resp, err = th.Client.GetTeamsForUser(context.Background(), th.BasicUser.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "api.context.mfa_required.app_error")
	})

	t.Run("a user with MFA active signs in without a code", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		err := th.App.Srv().Store().User().UpdateMfaActive(th.BasicUser.Id, true)
		require.NoError(t, err)

		user, _, err := signInWithPasskey(t, th.CreateClient(), auth)
		require.NoError(t, err)
		assert.Equal(t, th.BasicUser.Id, user.Id)
	})

	t.Run("a passkey session cannot register another passkey", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)

		client := th.CreateClient()
		_, _, err := signInWithPasskey(t, client, auth)
		require.NoError(t, err)

		_, resp, err := client.BeginPasskeyRegistration(context.Background(), model.Me)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.recent_login_required.app_error")
	})

	t.Run("deleting the passkey just used ends the session", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, pk := registerAndAuthenticator(t, th)

		client := th.CreateClient()
		_, _, err := signInWithPasskey(t, client, auth)
		require.NoError(t, err)

		resp, err := client.DeletePasskey(context.Background(), model.Me, pk.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		_, resp, err = client.GetMe(context.Background(), "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("a passkey deleted just after the session was made leaves no session", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, pk := registerAndAuthenticator(t, th)
		original := th.App.Srv().Store()
		// UpdateUsage is the last passkey write before the session is made, so deleting there
		// makes the re-check after the session exists find the row gone.
		passkeys := &deleteAfterUpdateUsagePasskeyStore{PasskeyStore: original.Passkey(), onUpdateUsage: func() {
			require.NoError(t, original.Passkey().Delete(th.BasicUser.Id, pk.Id))
		}}
		th.App.Srv().SetStore(&deleteAfterUpdateUsageStore{Store: original, passkeys: passkeys})
		t.Cleanup(func() { th.App.Srv().SetStore(original) })

		client := th.CreateClient()
		client.HTTPHeader[model.HeaderRequestedWith] = model.HeaderRequestedWithXML
		_, resp, err := signInWithPasskey(t, client, auth)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.unknown_credential.app_error")
		assert.Empty(t, resp.Header.Get(model.HeaderToken))
		assert.Empty(t, resp.Header.Get("Set-Cookie"))
		assert.Empty(t, client.AuthToken)

		sessions, err := th.App.Srv().Store().Session().GetSessionsByLoginMethod(model.SessionLoginMethodPasskey)
		require.NoError(t, err)
		for _, s := range sessions {
			assert.NotEqual(t, th.BasicUser.Id, s.UserId)
		}
	})

	t.Run("refused when the server cannot offer sign-in", func(t *testing.T) {
		for name, tc := range map[string]struct {
			mutate func(th *TestHelper)
			id     string
		}{
			"flag off": {func(th *TestHelper) {
				th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.Passkeys = false })
			}, "api.passkey.feature_disabled.app_error"},
			"no license": {func(th *TestHelper) {
				th.App.Srv().SetLicense(nil)
			}, "api.passkey.license.app_error"},
			"site url not usable": {func(th *TestHelper) {
				th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://chat.example.com" })
			}, "api.passkey.unavailable.app_error"},
			"login off, enrollment on": {func(th *TestHelper) {
				th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePasskeyLogin = false })
			}, "api.passkey.login_disabled.app_error"},
		} {
			t.Run(name, func(t *testing.T) {
				th := setupPasskeyLogin(t)
				auth, _ := registerAndAuthenticator(t, th)
				opts, _, err := th.CreateClient().BeginPasskeyLogin(context.Background())
				require.NoError(t, err)
				credential, err := auth.GetAssertion(opts.Options, "http://localhost:8065")
				require.NoError(t, err)

				tc.mutate(th)

				client := th.CreateClient()
				_, resp, err := client.BeginPasskeyLogin(context.Background())
				require.Error(t, err)
				CheckNotImplementedStatus(t, resp)
				CheckErrorID(t, err, tc.id)

				_, resp, err = client.FinishPasskeyLogin(context.Background(), &model.PasskeyLoginFinish{CeremonyId: opts.CeremonyId, Credential: credential})
				require.Error(t, err)
				CheckNotImplementedStatus(t, resp)
				CheckErrorID(t, err, tc.id)
			})
		}
	})

	t.Run("remote users cannot sign in", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		_, err := th.App.Srv().Store().GetInternalMasterDB().Exec(`UPDATE Users SET RemoteId = $1 WHERE Id = $2`, model.NewId(), th.BasicUser.Id)
		require.NoError(t, err)
		th.App.Srv().Store().User().InvalidateProfileCacheForUser(th.BasicUser.Id)

		_, resp, err := signInWithPasskey(t, th.CreateClient(), auth)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		CheckErrorID(t, err, "api.user.login.remote_users.login.error")
	})

	t.Run("guests cannot sign in while guest accounts are off", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, _ := registerAndAuthenticator(t, th)
		_, err := th.App.Srv().Store().GetInternalMasterDB().Exec(`UPDATE Users SET Roles = $1 WHERE Id = $2`, model.SystemGuestRoleId, th.BasicUser.Id)
		require.NoError(t, err)
		th.App.Srv().Store().User().InvalidateProfileCacheForUser(th.BasicUser.Id)

		_, resp, err := signInWithPasskey(t, th.CreateClient(), auth)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		CheckErrorID(t, err, "api.user.login.guest_accounts.disabled.error")
	})

	t.Run("bad requests", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		// A real authenticator always answers with a user handle; the library refuses a blank one first.
		auth.UserHandle = []byte("some other server's handle")
		client := th.CreateClient()

		r, err := client.DoAPIPost(context.Background(), "/users/login/passkey/finish", "not json")
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(r))

		opts, _, err := client.BeginPasskeyLogin(context.Background())
		require.NoError(t, err)
		credential, err := auth.GetAssertion(opts.Options, "http://localhost:8065")
		require.NoError(t, err)

		_, resp, err := client.FinishPasskeyLogin(context.Background(), &model.PasskeyLoginFinish{Credential: credential})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// raw body: marshalling a nil credential would send "null", which only the app layer rejects
		r, err = client.DoAPIPost(context.Background(), "/users/login/passkey/finish", `{"ceremony_id":"`+opts.CeremonyId+`"}`)
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(r))

		// the failed finishes above did not consume the ceremony, so an unregistered authenticator reaches the app layer
		_, resp, err = client.FinishPasskeyLogin(context.Background(), &model.PasskeyLoginFinish{CeremonyId: opts.CeremonyId, Credential: credential})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		CheckErrorID(t, err, "app.passkey.unknown_credential.app_error")
	})
}

func TestPasskeyRateLimit(t *testing.T) {
	// The server-wide limiter comes on with RateLimitSettings.Enable too; its limits are set out of
	// reach so any 429 below comes from a route limiter (burst 10, so X-RateLimit-Limit is 11).
	enableRateLimit := func(cfg *model.Config) {
		*cfg.RateLimitSettings.Enable = true
		*cfg.RateLimitSettings.PerSec = 1000
		*cfg.RateLimitSettings.MaxBurst = 10000
	}

	// limited sends 20 back-to-back POSTs, more than the burst, and reports whether a route
	// limiter answered 429 to any of them.
	limited := func(th *TestHelper, path string) bool {
		url := fmt.Sprintf("http://localhost:%v/api/v4%s", th.App.Srv().ListenAddr.Port, path)
		for range 20 {
			req, err := http.NewRequest(http.MethodPost, url, nil)
			require.NoError(t, err)
			req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+th.Client.AuthToken)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			resp.Body.Close()

			if resp.StatusCode == http.StatusTooManyRequests {
				// The server-wide limiter adds its own value to this header first.
				assert.Contains(t, resp.Header.Values("X-RateLimit-Limit"), "11")
				return true
			}
		}
		return false
	}

	t.Run("limits each passkey route when rate limiting is enabled", func(t *testing.T) {
		th := setupPasskeyLogin(t, enableRateLimit)

		for _, path := range []string{
			"/users/login/passkey/begin",
			"/users/login/passkey/finish",
			"/users/me/passkeys/registration/begin",
			"/users/me/passkeys/registration/finish",
			"/users/me/passkeys/enrollment/ticket",
			"/users/passkeys/enrollment/registration/begin",
			"/users/passkeys/enrollment/registration/finish",
			"/users/passkeys/enrollment/verification/begin",
			"/users/passkeys/enrollment/verification/finish",
		} {
			assert.True(t, limited(th, path), path)
		}
	})

	t.Run("does not limit when rate limiting is disabled", func(t *testing.T) {
		th := setupPasskeyLogin(t)

		assert.False(t, limited(th, "/users/login/passkey/begin"))
	})
}

func TestRevokePasskeySessions(t *testing.T) {
	revoke := func(client *model.Client4) (*model.Response, error) {
		return client.RevokePasskeySessions(context.Background())
	}

	sessionClient := func(t *testing.T, th *TestHelper, user *model.User, method string) *model.Client4 {
		t.Helper()
		session, appErr := th.App.CreateSession(th.Context, &model.Session{
			UserId: user.Id,
			Roles:  user.GetRawRoles(),
			Props:  model.StringMap{model.SessionPropLoginMethod: method},
		})
		require.Nil(t, appErr)
		client := th.CreateClient()
		client.SetToken(session.Token)
		return client
	}

	works := func(t *testing.T, client *model.Client4) bool {
		t.Helper()
		_, resp, err := client.GetMe(context.Background(), "")
		if err != nil {
			require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
			return false
		}
		return true
	}

	t.Run("system admin revokes every user's passkey sessions and leaves the rest", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		passkeyA := sessionClient(t, th, th.BasicUser, model.SessionLoginMethodPasskey)
		passkeyB := sessionClient(t, th, th.BasicUser2, model.SessionLoginMethodPasskey)
		passwordA := sessionClient(t, th, th.BasicUser, model.SessionLoginMethodStandard)
		passwordB := sessionClient(t, th, th.BasicUser2, model.SessionLoginMethodStandard)

		resp, err := revoke(th.SystemAdminClient)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.False(t, works(t, passkeyA))
		assert.False(t, works(t, passkeyB))
		assert.True(t, works(t, passwordA))
		assert.True(t, works(t, passwordB))
	})

	t.Run("a system admin's own passkey session is revoked too", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		adminPasskey := sessionClient(t, th, th.SystemAdminUser, model.SessionLoginMethodPasskey)

		resp, err := revoke(adminPasskey)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.False(t, works(t, adminPasskey))
	})

	t.Run("works with passkey login and enrollment turned off", func(t *testing.T) {
		th := setupPasskeyLogin(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePasskeyLogin = false
			*cfg.ServiceSettings.EnablePasskeyEnrollment = false
		})
		passkey := sessionClient(t, th, th.BasicUser, model.SessionLoginMethodPasskey)

		resp, err := revoke(th.SystemAdminClient)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.False(t, works(t, passkey))
	})

	t.Run("a regular user is forbidden and nothing is revoked", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		passkey := sessionClient(t, th, th.BasicUser, model.SessionLoginMethodPasskey)

		resp, err := revoke(th.Client)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		resp, err = revoke(passkey)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		assert.True(t, works(t, passkey))
	})

	t.Run("works with the flag off", func(t *testing.T) {
		th := setupPasskeyLogin(t, func(cfg *model.Config) {
			cfg.FeatureFlags.Passkeys = false
		})
		passkey := sessionClient(t, th, th.BasicUser, model.SessionLoginMethodPasskey)

		resp, err := revoke(th.SystemAdminClient)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.False(t, works(t, passkey))
	})

	t.Run("works with no license", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		passkey := sessionClient(t, th, th.BasicUser, model.SessionLoginMethodPasskey)
		th.App.Srv().SetLicense(nil)

		resp, err := revoke(th.SystemAdminClient)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.False(t, works(t, passkey))
	})

	t.Run("works with a license below Professional", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		passkey := sessionClient(t, th, th.BasicUser, model.SessionLoginMethodPasskey)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuE20))

		resp, err := revoke(th.SystemAdminClient)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.False(t, works(t, passkey))
	})

	t.Run("local mode", func(t *testing.T) {
		th := setupPasskeyLogin(t)
		passkey := sessionClient(t, th, th.BasicUser, model.SessionLoginMethodPasskey)

		resp, err := revoke(th.LocalClient)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.False(t, works(t, passkey))
	})
}

// deleteAfterUpdateUsagePasskeyStore runs onUpdateUsage after the real UpdateUsage succeeds. Every
// other call passes through to the real store.
type deleteAfterUpdateUsagePasskeyStore struct {
	store.PasskeyStore
	onUpdateUsage func()
}

func (s *deleteAfterUpdateUsagePasskeyStore) UpdateUsage(id string, prevSignCount, signCount, lastUsedAt int64) error {
	if err := s.PasskeyStore.UpdateUsage(id, prevSignCount, signCount, lastUsedAt); err != nil {
		return err
	}
	s.onUpdateUsage()
	return nil
}

type deleteAfterUpdateUsageStore struct {
	store.Store
	passkeys store.PasskeyStore
}

func (s *deleteAfterUpdateUsageStore) Passkey() store.PasskeyStore { return s.passkeys }
