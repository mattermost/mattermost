// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	emailmocks "github.com/mattermost/mattermost/server/v8/channels/app/email/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func savePasskey(t *testing.T, th *TestHelper, userID, name string, createAt int64) *model.Passkey {
	t.Helper()

	saved, err := th.App.Srv().Store().Passkey().SaveIfUnderLimit(&model.Passkey{
		UserId:       userID,
		Name:         name,
		CreateAt:     createAt,
		UserHandle:   []byte("handle-" + userID),
		CredentialId: []byte("cred-" + model.NewId()),
		PublicKey:    []byte("key"),
		AAGUID:       []byte{},
	}, model.PasskeyMaxPerUser)
	require.NoError(t, err)
	return saved
}

// recentSession returns a session that just signed in with a password, which is what
// passkey registration requires.
func recentSession(userID string) *model.Session {
	return &model.Session{
		Id:       model.NewId(),
		UserId:   userID,
		CreateAt: model.GetMillis(),
		Props:    model.StringMap{model.SessionPropLoginMethod: model.SessionLoginMethodStandard},
	}
}

func TestGetPasskeysForUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("no passkeys gives an empty non-nil slice", func(t *testing.T) {
		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, passkeys)
		require.Empty(t, passkeys)
	})

	t.Run("returns only the user's passkeys, oldest first", func(t *testing.T) {
		now := model.GetMillis()
		newer := savePasskey(t, th, th.BasicUser2.Id, "newer", now)
		older := savePasskey(t, th, th.BasicUser2.Id, "older", now-1000)
		savePasskey(t, th, th.BasicUser.Id, "someone else's", now)

		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser2.Id)
		require.Nil(t, appErr)
		require.Len(t, passkeys, 2)
		require.Equal(t, older.Id, passkeys[0].Id)
		require.Equal(t, newer.Id, passkeys[1].Id)
	})
}

func TestDeletePasskey(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("deletes the user's own passkey", func(t *testing.T) {
		passkey := savePasskey(t, th, th.BasicUser.Id, "mine", model.GetMillis())

		require.Nil(t, th.App.DeletePasskey(th.BasicUser.Id, passkey.Id))

		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Empty(t, passkeys)
	})

	t.Run("another user's passkey is a 404 and survives", func(t *testing.T) {
		passkey := savePasskey(t, th, th.BasicUser2.Id, "theirs", model.GetMillis())

		appErr := th.App.DeletePasskey(th.BasicUser.Id, passkey.Id)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
		require.Equal(t, "app.passkey.not_found.app_error", appErr.Id)

		passkeys, appErr := th.App.GetPasskeysForUser(th.BasicUser2.Id)
		require.Nil(t, appErr)
		require.Len(t, passkeys, 1)
	})

	t.Run("unknown id is a 404", func(t *testing.T) {
		appErr := th.App.DeletePasskey(th.BasicUser.Id, model.NewId())
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
		require.Equal(t, "app.passkey.not_found.app_error", appErr.Id)
	})
}

func TestPasskeyRelyingParty(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	tests := []struct {
		name    string
		siteURL string
		rpID    string
		origins []string
		wantErr bool
	}{
		{"https host", "https://chat.example.com", "chat.example.com", []string{"https://chat.example.com"}, false},
		{"mixed case, port and path", "https://Chat.Example.com:8443/mm", "chat.example.com", []string{"https://chat.example.com:8443"}, false},
		{"localhost over http", "http://localhost:8065", "localhost", []string{"http://localhost:8065"}, false},
		{"internationalized host is ASCII", "https://bücher.example", "xn--bcher-kva.example", []string{"https://xn--bcher-kva.example"}, false},
		{"http non-localhost", "http://chat.example.com", "", nil, true},
		{"IP address", "https://10.0.0.5", "", nil, true},
		{"empty", "", "", nil, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			th.UpdateConfig(t, func(cfg *model.Config) {
				*cfg.ServiceSettings.SiteURL = tc.siteURL
				*cfg.TeamSettings.SiteName = "Chat"
			})

			rp, appErr := th.App.passkeyRelyingParty()
			if tc.wantErr {
				require.NotNil(t, appErr)
				require.Nil(t, rp)
				require.Equal(t, "app.passkey.unavailable.app_error", appErr.Id)
				require.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
				return
			}
			require.Nil(t, appErr)
			require.NotNil(t, rp)

			cfg := rp.Config
			require.Equal(t, tc.rpID, cfg.RPID)
			require.Equal(t, tc.origins, cfg.RPOrigins)
			require.Equal(t, "Chat", cfg.RPDisplayName)
			require.Equal(t, protocol.PreferNoAttestation, cfg.AttestationPreference)
			require.Equal(t, protocol.VerificationRequired, cfg.AuthenticatorSelection.UserVerification)
			require.Equal(t, protocol.ResidentKeyRequirementRequired, cfg.AuthenticatorSelection.ResidentKey)
			require.NotNil(t, cfg.AuthenticatorSelection.RequireResidentKey)
			require.True(t, *cfg.AuthenticatorSelection.RequireResidentKey)
			require.True(t, cfg.Timeouts.Registration.Enforce)
			require.Equal(t, 5*time.Minute, cfg.Timeouts.Registration.Timeout)
			require.True(t, cfg.Timeouts.Login.Enforce)
			require.Equal(t, 5*time.Minute, cfg.Timeouts.Login.Timeout)
		})
	}
}

func TestBeginPasskeyRegistration(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	})

	// creation mirrors the parts of the library's creation options the tests inspect.
	type creation struct {
		PublicKey struct {
			RP struct {
				ID string `json:"id"`
			} `json:"rp"`
			User struct {
				ID          string `json:"id"`
				Name        string `json:"name"`
				DisplayName string `json:"displayName"`
			} `json:"user"`
			AuthenticatorSelection struct {
				ResidentKey      string `json:"residentKey"`
				UserVerification string `json:"userVerification"`
			} `json:"authenticatorSelection"`
			ExcludeCredentials []struct {
				ID string `json:"id"`
			} `json:"excludeCredentials"`
		} `json:"publicKey"`
	}
	begin := func(t *testing.T, session *model.Session) (*model.PasskeyRegistrationOptions, creation) {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, appErr)
		require.NotNil(t, opts)
		var c creation
		require.NoError(t, json.Unmarshal(opts.Options, &c))
		return opts, c
	}
	requireFails := func(t *testing.T, session *model.Session, status int, id string) {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, opts)
		require.NotNil(t, appErr)
		require.Equal(t, status, appErr.StatusCode)
		require.Equal(t, id, appErr.Id)
	}

	t.Run("fresh standard session gets options and a stored ceremony", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)

		opts, c := begin(t, session)

		require.Equal(t, "localhost", c.PublicKey.RP.ID)
		require.Equal(t, "required", c.PublicKey.AuthenticatorSelection.UserVerification)
		require.Equal(t, "required", c.PublicKey.AuthenticatorSelection.ResidentKey)
		require.Equal(t, user.Username, c.PublicKey.User.Name)
		handle, err := base64.RawURLEncoding.DecodeString(c.PublicKey.User.ID)
		require.NoError(t, err)
		require.Len(t, handle, model.PasskeyUserHandleSize)
		require.Empty(t, c.PublicKey.ExcludeCredentials)

		token, err := th.App.Srv().Store().Token().GetByToken(opts.CeremonyId)
		require.NoError(t, err)
		require.Equal(t, model.TokenTypePasskeyRegistration, token.Type)
		var ceremony passkeyCeremony
		require.NoError(t, json.Unmarshal([]byte(token.Extra), &ceremony))
		require.Equal(t, user.Id, ceremony.UserID)
		require.Equal(t, session.Id, ceremony.SessionID)
		require.NotNil(t, ceremony.SessionData)
	})

	t.Run("existing passkey is excluded and its handle reused", func(t *testing.T) {
		user := th.CreateUser(t)
		existing := savePasskey(t, th, user.Id, "existing", model.GetMillis())

		_, c := begin(t, recentSession(user.Id))

		require.Len(t, c.PublicKey.ExcludeCredentials, 1)
		require.Equal(t, base64.RawURLEncoding.EncodeToString(existing.CredentialId), c.PublicKey.ExcludeCredentials[0].ID)
		require.Equal(t, base64.RawURLEncoding.EncodeToString(existing.UserHandle), c.PublicKey.User.ID)
	})

	t.Run("display name is the full name, else the username", func(t *testing.T) {
		user := th.CreateUser(t)
		_, c := begin(t, recentSession(user.Id))
		require.Equal(t, user.Username, c.PublicKey.User.DisplayName)

		named := th.CreateUser(t)
		named.FirstName, named.LastName = "Ada", "Lovelace"
		_, appErr := th.App.UpdateUser(th.Context, named, false)
		require.Nil(t, appErr)
		_, c = begin(t, recentSession(named.Id))
		require.Equal(t, "Ada Lovelace", c.PublicKey.User.DisplayName)
	})

	t.Run("session older than the window is refused", func(t *testing.T) {
		session := recentSession(th.CreateUser(t).Id)
		session.CreateAt = model.GetMillis() - 11*60*1000
		requireFails(t, session, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
	})

	t.Run("session without a login method is refused", func(t *testing.T) {
		session := recentSession(th.CreateUser(t).Id)
		session.Props = nil
		requireFails(t, session, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
	})

	t.Run("passkey login method is refused", func(t *testing.T) {
		session := recentSession(th.CreateUser(t).Id)
		session.Props[model.SessionPropLoginMethod] = "passkey"
		requireFails(t, session, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
	})

	t.Run("bot is refused", func(t *testing.T) {
		bot := th.CreateBot(t)
		requireFails(t, recentSession(bot.UserId), http.StatusForbidden, "app.passkey.user_not_allowed.app_error")
	})

	t.Run("remote user is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Users SET RemoteId = ? WHERE Id = ?`, model.NewId(), user.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)
		requireFails(t, recentSession(user.Id), http.StatusForbidden, "app.passkey.user_not_allowed.app_error")
	})

	t.Run("user at the passkey limit is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		for i := range model.PasskeyMaxPerUser {
			savePasskey(t, th, user.Id, fmt.Sprintf("key %d", i), model.GetMillis())
		}
		requireFails(t, recentSession(user.Id), http.StatusBadRequest, "app.passkey.limit_reached.app_error")
	})

	t.Run("internationalized Site URL gives an ASCII relying party ID", func(t *testing.T) {
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "https://bücher.example"
		})
		_, c := begin(t, recentSession(th.CreateUser(t).Id))
		require.Equal(t, "xn--bcher-kva.example", c.PublicKey.RP.ID)
	})

	t.Run("unusable Site URL passes the relying party error through", func(t *testing.T) {
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = ""
		})
		requireFails(t, recentSession(th.CreateUser(t).Id), http.StatusNotImplemented, "app.passkey.unavailable.app_error")
	})
}

func TestBeginPasskeyLogin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	})

	// assertion mirrors the parts of the library's assertion options the tests inspect.
	type assertion struct {
		PublicKey struct {
			Challenge        string `json:"challenge"`
			RPID             string `json:"rpId"`
			UserVerification string `json:"userVerification"`
			AllowCredentials []struct {
				ID string `json:"id"`
			} `json:"allowCredentials"`
		} `json:"publicKey"`
	}
	begin := func(t *testing.T) (*model.PasskeyLoginOptions, assertion) {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyLogin(th.Context)
		require.Nil(t, appErr)
		require.NotNil(t, opts)
		var a assertion
		require.NoError(t, json.Unmarshal(opts.Options, &a))
		return opts, a
	}

	t.Run("options are usernameless and a ceremony is stored", func(t *testing.T) {
		opts, a := begin(t)

		require.Equal(t, "localhost", a.PublicKey.RPID)
		require.Equal(t, "required", a.PublicKey.UserVerification)
		require.NotEmpty(t, a.PublicKey.Challenge)
		require.Empty(t, a.PublicKey.AllowCredentials)

		token, err := th.App.Srv().Store().Token().GetByToken(opts.CeremonyId)
		require.NoError(t, err)
		require.Equal(t, model.TokenTypePasskeyLogin, token.Type)
		var ceremony passkeyCeremony
		require.NoError(t, json.Unmarshal([]byte(token.Extra), &ceremony))
		require.NotNil(t, ceremony.SessionData)
		require.Equal(t, a.PublicKey.Challenge, ceremony.SessionData.Challenge)
		require.Empty(t, ceremony.SessionData.UserID)
		require.Empty(t, ceremony.UserID)
		require.Empty(t, ceremony.SessionID)
	})

	t.Run("each call gets its own ceremony and challenge", func(t *testing.T) {
		first, a1 := begin(t)
		second, a2 := begin(t)
		require.NotEqual(t, first.CeremonyId, second.CeremonyId)
		require.NotEqual(t, a1.PublicKey.Challenge, a2.PublicKey.Challenge)
	})

	t.Run("token expires after the ceremony window", func(t *testing.T) {
		now := model.GetMillis()
		stale := &model.Token{Type: model.TokenTypePasskeyLogin, CreateAt: now - 6*60*1000}
		fresh := &model.Token{Type: model.TokenTypePasskeyLogin, CreateAt: now - 4*60*1000}
		require.True(t, stale.IsExpired())
		require.False(t, fresh.IsExpired())
	})

	t.Run("unusable Site URL passes the relying party error through", func(t *testing.T) {
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://chat.example.com"
		})
		opts, appErr := th.App.BeginPasskeyLogin(th.Context)
		require.Nil(t, opts)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
		require.Equal(t, "app.passkey.unavailable.app_error", appErr.Id)
	})
}

func TestFinishPasskeyRegistration(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	})
	const origin = "http://localhost:8065"
	const chromeOnMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

	begin := func(t *testing.T, session *model.Session) *model.PasskeyRegistrationOptions {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, appErr)
		return opts
	}
	newAuthenticator := func(t *testing.T) *testlib.SoftAuthenticator {
		t.Helper()
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		return auth
	}
	respond := func(t *testing.T, auth *testlib.SoftAuthenticator, opts *model.PasskeyRegistrationOptions, origin string, authOpts ...testlib.SoftAuthenticatorOption) []byte {
		t.Helper()
		resp, err := auth.CreateResponse(opts.Options, origin, authOpts...)
		require.NoError(t, err)
		return resp
	}
	requireFails := func(t *testing.T, pk *model.Passkey, appErr *model.AppError, status int, id string) {
		t.Helper()
		require.Nil(t, pk)
		require.NotNil(t, appErr)
		require.Equal(t, status, appErr.StatusCode)
		require.Equal(t, id, appErr.Id)
	}
	stored := func(t *testing.T, userID string) []*model.Passkey {
		t.Helper()
		passkeys, appErr := th.App.GetPasskeysForUser(userID)
		require.Nil(t, appErr)
		return passkeys
	}

	t.Run("begin then finish stores the passkey with the begin handle", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)
		auth := newAuthenticator(t)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, " My laptop ", chromeOnMac, respond(t, auth, opts, origin))
		require.Nil(t, appErr)
		require.NotNil(t, pk)
		require.Equal(t, "My laptop", pk.Name)

		passkeys := stored(t, user.Id)
		require.Len(t, passkeys, 1)
		require.Equal(t, pk.Id, passkeys[0].Id)
		require.Equal(t, user.Id, passkeys[0].UserId)
		require.Equal(t, auth.CredentialID, passkeys[0].CredentialId)
		require.Equal(t, auth.AAGUID, passkeys[0].AAGUID)
		require.NotEmpty(t, passkeys[0].PublicKey)
		require.Equal(t, "internal", passkeys[0].Transports)
		require.Zero(t, passkeys[0].LastUsedAt)

		var c struct {
			PublicKey struct {
				User struct {
					ID string `json:"id"`
				} `json:"user"`
			} `json:"publicKey"`
		}
		require.NoError(t, json.Unmarshal(opts.Options, &c))
		handle, err := base64.RawURLEncoding.DecodeString(c.PublicKey.User.ID)
		require.NoError(t, err)
		require.Equal(t, handle, passkeys[0].UserHandle)
	})

	t.Run("empty name defaults to the browser and OS of the request", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "  ", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		require.Nil(t, appErr)
		require.Equal(t, "Chrome on Mac OS", pk.Name)
	})

	t.Run("empty name with an unknown browser is Passkey", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "", "", respond(t, newAuthenticator(t), opts, origin))
		require.Nil(t, appErr)
		require.Equal(t, "Passkey", pk.Name)
	})

	t.Run("too long name is refused without using up the ceremony", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)
		resp := respond(t, newAuthenticator(t), opts, origin)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, strings.Repeat("é", model.PasskeyNameMaxRunes+1), chromeOnMac, resp)
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.name_too_long.app_error")

		pk, appErr = th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, strings.Repeat("é", model.PasskeyNameMaxRunes), chromeOnMac, resp)
		require.Nil(t, appErr)
		require.NotNil(t, pk)
	})

	t.Run("a ceremony can only be finished once", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)
		resp := respond(t, newAuthenticator(t), opts, origin)

		_, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, resp)
		require.Nil(t, appErr)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, resp)
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
		require.Len(t, stored(t, user.Id), 1)
	})

	t.Run("unknown ceremony is refused", func(t *testing.T) {
		session := recentSession(th.CreateUser(t).Id)
		opts := begin(t, session)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, model.NewId(), "a", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
	})

	t.Run("a ceremony begun in another session of the same user is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		began := recentSession(user.Id)
		opts := begin(t, began)
		other := recentSession(user.Id)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, other, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("a ceremony begun by another user is refused", func(t *testing.T) {
		began := recentSession(th.CreateUser(t).Id)
		opts := begin(t, began)
		attacker := recentSession(th.CreateUser(t).Id)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, attacker, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
	})

	t.Run("expired ceremony is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Tokens SET CreateAt = ? WHERE Token = ?`, model.GetMillis()-6*60*1000, opts.CeremonyId)
		require.NoError(t, err)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("the session that began the ceremony must still be a recent sign-in", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)
		aged := *session
		aged.CreateAt = model.GetMillis() - 11*60*1000

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, &aged, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		requireFails(t, pk, appErr, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("garbage credential is refused", func(t *testing.T) {
		session := recentSession(th.CreateUser(t).Id)
		opts := begin(t, session)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, []byte(`{"id":`))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.invalid_credential.app_error")
	})

	t.Run("authenticator that did not verify the user is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts, origin, testlib.WithoutUserVerification()))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.invalid_credential.app_error")
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("wrong origin is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts, "http://evil.example"))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.invalid_credential.app_error")
		require.Empty(t, stored(t, user.Id))
	})

	mockEmail := func(t *testing.T) *emailmocks.ServiceInterface {
		t.Helper()
		mockSvc := &emailmocks.ServiceInterface{}
		orig := th.App.Srv().EmailService
		th.App.Srv().EmailService = mockSvc
		t.Cleanup(func() { th.App.Srv().EmailService = orig })
		return mockSvc
	}

	t.Run("sends the passkey added email once after a successful registration", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)
		mockSvc := mockEmail(t)
		mockSvc.On("SendPasskeyAddedEmail", user.Email, user.Locale, th.App.GetSiteURL(), "My laptop").Return(nil).Once()

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "My laptop", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		require.Nil(t, appErr)
		require.NotNil(t, pk)
		mockSvc.AssertNumberOfCalls(t, "SendPasskeyAddedEmail", 1)
		mockSvc.AssertExpectations(t)
	})

	t.Run("an email failure does not fail the registration", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		opts := begin(t, session)
		mockSvc := mockEmail(t)
		mockSvc.On("SendPasskeyAddedEmail", user.Email, user.Locale, th.App.GetSiteURL(), "a").Return(errors.New("smtp down")).Once()

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		require.Nil(t, appErr)
		require.NotNil(t, pk)
		require.Len(t, stored(t, user.Id), 1)
		mockSvc.AssertExpectations(t)
	})

	t.Run("no email is sent for a refused registration", func(t *testing.T) {
		session := recentSession(th.CreateUser(t).Id)
		opts := begin(t, session)
		mockSvc := mockEmail(t)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, model.NewId(), "a", chromeOnMac, respond(t, newAuthenticator(t), opts, origin))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
		mockSvc.AssertNotCalled(t, "SendPasskeyAddedEmail")
	})

	t.Run("the same authenticator cannot be registered twice", func(t *testing.T) {
		user := th.CreateUser(t)
		session := recentSession(user.Id)
		auth := newAuthenticator(t)

		opts := begin(t, session)
		_, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, respond(t, auth, opts, origin))
		require.Nil(t, appErr)

		// The soft authenticator ignores excludeCredentials, as a misbehaving client might.
		opts = begin(t, session)
		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "b", chromeOnMac, respond(t, auth, opts, origin))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.already_registered.app_error")
		require.Len(t, stored(t, user.Id), 1)
	})

	t.Run("the limit holds against two ceremonies begun below it", func(t *testing.T) {
		user := th.CreateUser(t)
		for i := range model.PasskeyMaxPerUser - 1 {
			savePasskey(t, th, user.Id, fmt.Sprintf("key %d", i), model.GetMillis())
		}
		session := recentSession(user.Id)
		first, second := begin(t, session), begin(t, session)

		_, appErr := th.App.FinishPasskeyRegistration(th.Context, session, first.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), first, origin))
		require.Nil(t, appErr)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, second.CeremonyId, "b", chromeOnMac, respond(t, newAuthenticator(t), second, origin))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.limit_reached.app_error")
		require.Len(t, stored(t, user.Id), model.PasskeyMaxPerUser)
	})

	t.Run("internationalized Site URL registers against the punycode origin", func(t *testing.T) {
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "https://bücher.example"
		})
		session := recentSession(th.CreateUser(t).Id)
		opts := begin(t, session)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts, "https://xn--bcher-kva.example"))
		require.Nil(t, appErr)
		require.NotNil(t, pk)
	})
}
