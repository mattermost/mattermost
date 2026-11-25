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
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	emailmocks "github.com/mattermost/mattermost/server/v8/channels/app/email/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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

func TestCreatePasskeyEnrollmentTicket(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// storedSession saves a session, as the ticket's later redemption resolves it from the store.
	storedSession := func(t *testing.T, userID string) *model.Session {
		t.Helper()
		session, appErr := th.App.CreateSession(th.Context, &model.Session{
			UserId: userID,
			Props:  model.StringMap{model.SessionPropLoginMethod: model.SessionLoginMethodStandard},
		})
		require.Nil(t, appErr)
		return session
	}
	requireFails := func(t *testing.T, session *model.Session, status int, id string) {
		t.Helper()
		ticket, appErr := th.App.CreatePasskeyEnrollmentTicket(th.Context, session)
		require.Nil(t, ticket)
		require.NotNil(t, appErr)
		require.Equal(t, status, appErr.StatusCode)
		require.Equal(t, id, appErr.Id)
	}

	t.Run("stored session gets a ticket tied to it", func(t *testing.T) {
		user := th.CreateUser(t)
		session := storedSession(t, user.Id)

		ticket, appErr := th.App.CreatePasskeyEnrollmentTicket(th.Context, session)
		require.Nil(t, appErr)
		require.NotNil(t, ticket)
		require.Len(t, ticket.Ticket, model.TokenSize)

		token, err := th.App.Srv().Store().Token().GetByToken(ticket.Ticket)
		require.NoError(t, err)
		require.Equal(t, model.TokenTypePasskeyEnrollmentTicket, token.Type)
		var extra passkeyEnrollmentTicket
		require.NoError(t, json.Unmarshal([]byte(token.Extra), &extra))
		require.Equal(t, user.Id, extra.UserID)
		require.Equal(t, session.Id, extra.SessionID)
		require.Equal(t, token.CreateAt+10*60*1000, ticket.ExpireAt)
	})

	t.Run("ticket expires after 10 minutes", func(t *testing.T) {
		ticket, appErr := th.App.CreatePasskeyEnrollmentTicket(th.Context, storedSession(t, th.CreateUser(t).Id))
		require.Nil(t, appErr)
		require.NotNil(t, ticket)
		token, err := th.App.Srv().Store().Token().GetByToken(ticket.Ticket)
		require.NoError(t, err)
		require.False(t, token.IsExpired())

		token.CreateAt = model.GetMillis() - 9*60*1000
		require.False(t, token.IsExpired())
		token.CreateAt = model.GetMillis() - (10*60*1000 + 1000)
		require.True(t, token.IsExpired())
	})

	t.Run("session older than the recent sign-in window still gets a ticket", func(t *testing.T) {
		session := storedSession(t, th.CreateUser(t).Id)
		session.CreateAt = model.GetMillis() - 11*60*1000
		ticket, appErr := th.App.CreatePasskeyEnrollmentTicket(th.Context, session)
		require.Nil(t, appErr)
		require.NotNil(t, ticket)
	})

	t.Run("bot is refused", func(t *testing.T) {
		bot := th.CreateBot(t)
		requireFails(t, storedSession(t, bot.UserId), http.StatusForbidden, "app.passkey.user_not_allowed.app_error")
	})

	t.Run("remote user is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		// CreateSession refuses remote users, so the session exists before the user turns remote.
		session := storedSession(t, user.Id)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Users SET RemoteId = ? WHERE Id = ?`, model.NewId(), user.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)
		requireFails(t, session, http.StatusForbidden, "app.passkey.user_not_allowed.app_error")
	})

	t.Run("a failure to save the ticket is a server error", func(t *testing.T) {
		session := storedSession(t, th.CreateUser(t).Id)
		original := th.App.Srv().Store()
		th.App.Srv().SetStore(&passkeyStoreWrapper{
			Store:    original,
			passkeys: original.Passkey(),
			tokens:   failingSaveTokenStore{TokenStore: original.Token()},
		})
		t.Cleanup(func() { th.App.Srv().SetStore(original) })

		requireFails(t, session, http.StatusInternalServerError, "app.passkey.save_ticket.app_error")
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

// storedPasskeySession creates a stored session, because a ticket resolves its issuing session
// from the store.
func storedPasskeySession(t *testing.T, th *TestHelper, userID, method string) *model.Session {
	t.Helper()
	session, appErr := th.App.CreateSession(th.Context, &model.Session{
		UserId: userID,
		Props:  model.StringMap{model.SessionPropLoginMethod: method},
	})
	require.Nil(t, appErr)
	return session
}

func agePasskeySession(t *testing.T, th *TestHelper, session *model.Session) {
	t.Helper()
	_, err := th.SQLStore.GetMaster().Exec(`UPDATE Sessions SET CreateAt = ? WHERE Id = ?`, model.GetMillis()-11*60*1000, session.Id)
	require.NoError(t, err)
	th.App.ClearSessionCacheForUser(session.UserId)
}

func agePasskeyTicket(t *testing.T, th *TestHelper, ticket string) {
	t.Helper()
	_, err := th.SQLStore.GetMaster().Exec(`UPDATE Tokens SET CreateAt = ? WHERE Token = ?`, model.GetMillis()-11*60*1000, ticket)
	require.NoError(t, err)
}

func issuePasskeyTicket(t *testing.T, th *TestHelper, session *model.Session) string {
	t.Helper()
	ticket, appErr := th.App.CreatePasskeyEnrollmentTicket(th.Context, session)
	require.Nil(t, appErr)
	return ticket.Ticket
}

func useTicketStore(t *testing.T, th *TestHelper, tokens *ticketTokenStore) {
	t.Helper()
	original := th.App.Srv().Store()
	tokens.TokenStore = original.Token()
	th.App.Srv().SetStore(&passkeyStoreWrapper{Store: original, passkeys: original.Passkey(), tokens: tokens})
	t.Cleanup(func() { th.App.Srv().SetStore(original) })
}

func TestPasskeyRegistrationWithTicket(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	})
	const origin = "http://localhost:8065"
	const chromeOnMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
	const ticketInvalid = "app.passkey.ticket_invalid.app_error"

	storedSession := func(t *testing.T, userID, method string) *model.Session {
		t.Helper()
		return storedPasskeySession(t, th, userID, method)
	}
	ageSession := func(t *testing.T, session *model.Session) {
		t.Helper()
		agePasskeySession(t, th, session)
	}
	ageTicket := func(t *testing.T, ticket string) {
		t.Helper()
		agePasskeyTicket(t, th, ticket)
	}
	issue := func(t *testing.T, session *model.Session) string {
		t.Helper()
		return issuePasskeyTicket(t, th, session)
	}
	// fresh returns a user, its recently signed-in stored session and a ticket issued by it.
	fresh := func(t *testing.T) (*model.User, *model.Session, string) {
		t.Helper()
		user := th.CreateUser(t)
		session := storedSession(t, user.Id, model.SessionLoginMethodStandard)
		return user, session, issue(t, session)
	}
	begin := func(t *testing.T, ticket string) *model.PasskeyRegistrationOptions {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyRegistrationWithTicket(th.Context, ticket)
		require.Nil(t, appErr)
		return opts
	}
	newAuthenticator := func(t *testing.T) *testlib.SoftAuthenticator {
		t.Helper()
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		return auth
	}
	respond := func(t *testing.T, auth *testlib.SoftAuthenticator, opts *model.PasskeyRegistrationOptions, authOpts ...testlib.SoftAuthenticatorOption) []byte {
		t.Helper()
		resp, err := auth.CreateResponse(opts.Options, origin, authOpts...)
		require.NoError(t, err)
		return resp
	}
	finish := func(t *testing.T, opts *model.PasskeyRegistrationOptions, name string, resp []byte) (*model.Passkey, *model.AppError) {
		t.Helper()
		return th.App.FinishPasskeyRegistrationWithTicket(th.Context, opts.CeremonyId, name, chromeOnMac, resp)
	}
	requireFails := func(t *testing.T, pk *model.Passkey, appErr *model.AppError, status int, id string) {
		t.Helper()
		require.Nil(t, pk)
		require.NotNil(t, appErr)
		require.Equal(t, status, appErr.StatusCode)
		require.Equal(t, id, appErr.Id)
	}
	requireBeginFails := func(t *testing.T, ticket string, status int, id string) {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyRegistrationWithTicket(th.Context, ticket)
		require.Nil(t, opts)
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
	register := func(t *testing.T, ticket string) *model.Passkey {
		t.Helper()
		opts := begin(t, ticket)
		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		require.Nil(t, appErr)
		return pk
	}
	withTicketStore := func(t *testing.T, tokens *ticketTokenStore) {
		t.Helper()
		useTicketStore(t, th, tokens)
	}

	t.Run("begin then finish stores a passkey for the ticket's user, named after the browser", func(t *testing.T) {
		user, _, ticket := fresh(t)
		opts := begin(t, ticket)
		auth := newAuthenticator(t)

		pk, appErr := finish(t, opts, " ", respond(t, auth, opts))
		require.Nil(t, appErr)
		require.NotNil(t, pk)
		require.Equal(t, "Chrome on Mac OS", pk.Name)

		passkeys := stored(t, user.Id)
		require.Len(t, passkeys, 1)
		require.Equal(t, user.Id, passkeys[0].UserId)
		require.Equal(t, auth.CredentialID, passkeys[0].CredentialId)
	})

	t.Run("a given name is kept", func(t *testing.T) {
		_, _, ticket := fresh(t)
		opts := begin(t, ticket)

		pk, appErr := finish(t, opts, " My laptop ", respond(t, newAuthenticator(t), opts))
		require.Nil(t, appErr)
		require.Equal(t, "My laptop", pk.Name)
	})

	t.Run("a too long name is refused without using up the ticket", func(t *testing.T) {
		user, _, ticket := fresh(t)
		opts := begin(t, ticket)
		resp := respond(t, newAuthenticator(t), opts)

		pk, appErr := finish(t, opts, strings.Repeat("é", model.PasskeyNameMaxRunes+1), resp)
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.name_too_long.app_error")

		pk, appErr = finish(t, opts, "ok", resp)
		require.Nil(t, appErr)
		require.NotNil(t, pk)
		require.Len(t, stored(t, user.Id), 1)
	})

	t.Run("begin does not consume the ticket, so the page may begin again", func(t *testing.T) {
		user, _, ticket := fresh(t)
		first, second := begin(t, ticket), begin(t, ticket)
		require.NotEqual(t, first.CeremonyId, second.CeremonyId)

		pk, appErr := finish(t, second, "a", respond(t, newAuthenticator(t), second))
		require.Nil(t, appErr)
		require.NotNil(t, pk)

		// The first ceremony is still unexpired, but the ticket behind it is spent.
		pk, appErr = finish(t, first, "b", respond(t, newAuthenticator(t), first))
		requireFails(t, pk, appErr, http.StatusBadRequest, ticketInvalid)
		require.Len(t, stored(t, user.Id), 1)
	})

	t.Run("a spent ticket cannot begin again", func(t *testing.T) {
		_, _, ticket := fresh(t)
		register(t, ticket)

		requireBeginFails(t, ticket, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("unknown ticket is refused at begin", func(t *testing.T) {
		requireBeginFails(t, model.NewRandomString(model.TokenSize), http.StatusBadRequest, ticketInvalid)
	})

	t.Run("a token of another type is not a ticket", func(t *testing.T) {
		// A ceremony token carries the same user and session ids as a ticket, so only its type refuses it.
		session := storedSession(t, th.CreateUser(t).Id, model.SessionLoginMethodStandard)
		opts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, appErr)

		requireBeginFails(t, opts.CeremonyId, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("an expired ticket is refused at begin", func(t *testing.T) {
		_, _, ticket := fresh(t)
		ageTicket(t, ticket)

		requireBeginFails(t, ticket, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("a ticket that expires between begin and finish is refused at finish", func(t *testing.T) {
		user, _, ticket := fresh(t)
		opts := begin(t, ticket)
		ageTicket(t, ticket)

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, ticketInvalid)
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("a ticket whose issuing session was revoked is refused at begin", func(t *testing.T) {
		_, session, ticket := fresh(t)
		require.Nil(t, th.App.RevokeSession(th.Context, session))

		requireBeginFails(t, ticket, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("an issuing session revoked after begin is refused at finish", func(t *testing.T) {
		user, session, ticket := fresh(t)
		opts := begin(t, ticket)
		require.Nil(t, th.App.RevokeSession(th.Context, session))

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, ticketInvalid)
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("an expired issuing session is refused at begin and at finish", func(t *testing.T) {
		user, session, ticket := fresh(t)
		opts := begin(t, ticket)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Sessions SET ExpiresAt = ? WHERE Id = ?`, model.GetMillis()-1000, session.Id)
		require.NoError(t, err)
		th.App.ClearSessionCacheForUser(user.Id)

		requireBeginFails(t, ticket, http.StatusBadRequest, ticketInvalid)
		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, ticketInvalid)
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("a ticket naming another user than its session is refused", func(t *testing.T) {
		_, session, _ := fresh(t)
		extra, err := json.Marshal(passkeyEnrollmentTicket{UserID: th.CreateUser(t).Id, SessionID: session.Id})
		require.NoError(t, err)
		token := model.NewToken(model.TokenTypePasskeyEnrollmentTicket, string(extra))
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		requireBeginFails(t, token.Token, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("a ticket with unreadable contents is refused", func(t *testing.T) {
		token := model.NewToken(model.TokenTypePasskeyEnrollmentTicket, "not json")
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		requireBeginFails(t, token.Token, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("a failure to read the ticket is a server error", func(t *testing.T) {
		_, _, ticket := fresh(t)
		withTicketStore(t, &ticketTokenStore{getByTokenFromMaster: func() (*model.Token, error) { return nil, errors.New("db down") }})

		requireBeginFails(t, ticket, http.StatusInternalServerError, "app.passkey.get_ticket.app_error")
	})

	t.Run("a ticket a lagging replica does not have yet is still found", func(t *testing.T) {
		_, _, ticket := fresh(t)
		withTicketStore(t, &ticketTokenStore{getByToken: func() (*model.Token, error) { return nil, store.NewErrNotFound("Token", "x") }})

		require.NotNil(t, begin(t, ticket))
	})

	t.Run("a failure to read the issuing session is a server error", func(t *testing.T) {
		_, _, ticket := fresh(t)
		original := th.App.Srv().Store()
		th.App.Srv().SetStore(&passkeyStoreWrapper{Store: original, passkeys: original.Passkey(), sessions: failingGetSessionStore{original.Session()}})
		t.Cleanup(func() { th.App.Srv().SetStore(original) })

		requireBeginFails(t, ticket, http.StatusInternalServerError, "app.passkey.get_ticket.app_error")
	})

	t.Run("an issuing session that is not a recent sign-in is refused even if another session is", func(t *testing.T) {
		user, session, ticket := fresh(t)
		ageSession(t, session)
		storedSession(t, user.Id, model.SessionLoginMethodStandard)

		requireBeginFails(t, ticket, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
	})

	t.Run("an issuing session that ages before finish is refused even if another session is recent", func(t *testing.T) {
		user, session, ticket := fresh(t)
		opts := begin(t, ticket)
		ageSession(t, session)
		storedSession(t, user.Id, model.SessionLoginMethodStandard)

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("a passkey-started issuing session never qualifies", func(t *testing.T) {
		user := th.CreateUser(t)
		ticket := issue(t, storedSession(t, user.Id, model.SessionLoginMethodPasskey))
		storedSession(t, user.Id, model.SessionLoginMethodStandard)

		requireBeginFails(t, ticket, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
	})

	t.Run("a remote user is refused", func(t *testing.T) {
		user, _, ticket := fresh(t)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Users SET RemoteId = ? WHERE Id = ?`, model.NewId(), user.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)

		requireBeginFails(t, ticket, http.StatusForbidden, "app.passkey.user_not_allowed.app_error")
	})

	t.Run("a user at the limit is refused at begin", func(t *testing.T) {
		user, _, ticket := fresh(t)
		for i := range model.PasskeyMaxPerUser {
			savePasskey(t, th, user.Id, fmt.Sprintf("key %d", i), model.GetMillis())
		}

		requireBeginFails(t, ticket, http.StatusBadRequest, "app.passkey.limit_reached.app_error")
	})

	t.Run("a limit reached after the ticket is consumed leaves it spent", func(t *testing.T) {
		user, _, ticket := fresh(t)
		for i := range model.PasskeyMaxPerUser - 1 {
			savePasskey(t, th, user.Id, fmt.Sprintf("key %d", i), model.GetMillis())
		}
		opts := begin(t, ticket)
		savePasskey(t, th, user.Id, "late", model.GetMillis())

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.limit_reached.app_error")
		require.Len(t, stored(t, user.Id), model.PasskeyMaxPerUser)

		requireBeginFails(t, ticket, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("the same authenticator cannot be registered twice", func(t *testing.T) {
		user, session, ticket := fresh(t)
		auth := newAuthenticator(t)
		sessionOpts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, appErr)
		_, appErr = th.App.FinishPasskeyRegistration(th.Context, session, sessionOpts.CeremonyId, "a", chromeOnMac, respond(t, auth, sessionOpts))
		require.Nil(t, appErr)

		opts := begin(t, ticket)
		pk, appErr := finish(t, opts, "b", respond(t, auth, opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.already_registered.app_error")
		require.Len(t, stored(t, user.Id), 1)
	})

	t.Run("a ceremony begun with a ticket is refused by session registration, and the ticket still works", func(t *testing.T) {
		user, session, ticket := fresh(t)
		opts := begin(t, ticket)

		pk, appErr := th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", chromeOnMac, respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
		require.Empty(t, stored(t, user.Id))

		register(t, ticket)
		require.Len(t, stored(t, user.Id), 1)
	})

	t.Run("a ceremony begun from a session is refused by ticket registration", func(t *testing.T) {
		user, session, ticket := fresh(t)
		opts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, appErr)

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
		require.Empty(t, stored(t, user.Id))

		register(t, ticket)
	})

	t.Run("an unknown ceremony is refused", func(t *testing.T) {
		_, _, ticket := fresh(t)
		opts := begin(t, ticket)

		pk, appErr := th.App.FinishPasskeyRegistrationWithTicket(th.Context, model.NewId(), "a", chromeOnMac, respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
	})

	t.Run("a credential the library refuses leaves the ticket usable", func(t *testing.T) {
		user, _, ticket := fresh(t)
		opts := begin(t, ticket)

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts, testlib.WithoutUserVerification()))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.invalid_credential.app_error")
		require.Empty(t, stored(t, user.Id))

		register(t, ticket)
		require.Len(t, stored(t, user.Id), 1)
	})

	t.Run("a garbage credential leaves the ticket usable", func(t *testing.T) {
		_, _, ticket := fresh(t)
		opts := begin(t, ticket)

		pk, appErr := finish(t, opts, "a", []byte(`{"id":`))
		requireFails(t, pk, appErr, http.StatusBadRequest, "app.passkey.invalid_credential.app_error")

		register(t, ticket)
	})

	t.Run("a ticket consumed by a concurrent finish saves nothing", func(t *testing.T) {
		user, _, ticket := fresh(t)
		opts := begin(t, ticket)
		withTicketStore(t, &ticketTokenStore{consumeTicket: func(next func() (*model.Token, error)) (*model.Token, error) {
			_, err := next()
			require.NoError(t, err)
			return next()
		}})

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, ticketInvalid)
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("a ticket that expires while being consumed saves nothing", func(t *testing.T) {
		user, _, ticket := fresh(t)
		opts := begin(t, ticket)
		withTicketStore(t, &ticketTokenStore{consumeTicket: func(next func() (*model.Token, error)) (*model.Token, error) {
			ageTicket(t, ticket)
			return next()
		}})

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusBadRequest, ticketInvalid)
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("a failure to consume the ticket is a server error and saves nothing", func(t *testing.T) {
		user, _, ticket := fresh(t)
		opts := begin(t, ticket)
		withTicketStore(t, &ticketTokenStore{consumeTicket: func(func() (*model.Token, error)) (*model.Token, error) {
			return nil, errors.New("db down")
		}})

		pk, appErr := finish(t, opts, "a", respond(t, newAuthenticator(t), opts))
		requireFails(t, pk, appErr, http.StatusInternalServerError, "app.passkey.finish_registration.app_error")
		require.Empty(t, stored(t, user.Id))
	})

	t.Run("sends the passkey added email", func(t *testing.T) {
		user, _, ticket := fresh(t)
		opts := begin(t, ticket)
		mockSvc := &emailmocks.ServiceInterface{}
		orig := th.App.Srv().EmailService
		th.App.Srv().EmailService = mockSvc
		t.Cleanup(func() { th.App.Srv().EmailService = orig })
		mockSvc.On("SendPasskeyAddedEmail", user.Email, user.Locale, th.App.GetSiteURL(), "My laptop").Return(nil).Once()

		_, appErr := finish(t, opts, "My laptop", respond(t, newAuthenticator(t), opts))
		require.Nil(t, appErr)
		mockSvc.AssertExpectations(t)
	})
}

func TestPasskeyVerificationWithTicket(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	})
	const origin = "http://localhost:8065"
	const ticketInvalid = "app.passkey.ticket_invalid.app_error"
	const ceremonyInvalid = "app.passkey.ceremony_invalid.app_error"
	const invalidCredential = "app.passkey.invalid_credential.app_error"
	const counterRegressed = "app.passkey.counter_regressed.app_error"

	// assertion mirrors the parts of the library's assertion options the tests inspect.
	type assertion struct {
		PublicKey struct {
			UserVerification string `json:"userVerification"`
			AllowCredentials []struct {
				ID string `json:"id"`
			} `json:"allowCredentials"`
		} `json:"publicKey"`
	}

	newAuthenticator := func(t *testing.T) *testlib.SoftAuthenticator {
		t.Helper()
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		return auth
	}
	addPasskey := func(t *testing.T, user *model.User, auth *testlib.SoftAuthenticator) {
		t.Helper()
		session := recentSession(user.Id)
		opts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, appErr)
		resp, err := auth.CreateResponse(opts.Options, origin)
		require.NoError(t, err)
		_, appErr = th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", "", resp)
		require.Nil(t, appErr)
	}
	// registered returns a user with one passkey, its recently signed-in stored session and a ticket
	// that session issued.
	registered := func(t *testing.T) (*model.User, *testlib.SoftAuthenticator, *model.Session, string) {
		t.Helper()
		user, auth := th.CreateUser(t), newAuthenticator(t)
		addPasskey(t, user, auth)
		session := storedPasskeySession(t, th, user.Id, model.SessionLoginMethodStandard)
		return user, auth, session, issuePasskeyTicket(t, th, session)
	}
	begin := func(t *testing.T, ticket string) *model.PasskeyLoginOptions {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyVerificationWithTicket(th.Context, ticket)
		require.Nil(t, appErr)
		require.NotNil(t, opts)
		return opts
	}
	assert := func(t *testing.T, auth *testlib.SoftAuthenticator, opts *model.PasskeyLoginOptions, authOpts ...testlib.SoftAuthenticatorOption) []byte {
		t.Helper()
		resp, err := auth.GetAssertion(opts.Options, origin, authOpts...)
		require.NoError(t, err)
		return resp
	}
	verify := func(t *testing.T, ticket string, auth *testlib.SoftAuthenticator, authOpts ...testlib.SoftAuthenticatorOption) *model.AppError {
		t.Helper()
		opts := begin(t, ticket)
		return th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, assert(t, auth, opts, authOpts...))
	}
	requireFails := func(t *testing.T, appErr *model.AppError, status int, id string) {
		t.Helper()
		require.NotNil(t, appErr)
		require.Equal(t, status, appErr.StatusCode)
		require.Equal(t, id, appErr.Id)
	}
	requireBeginFails := func(t *testing.T, ticket string, status int, id string) {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyVerificationWithTicket(th.Context, ticket)
		require.Nil(t, opts)
		requireFails(t, appErr, status, id)
	}
	stored := func(t *testing.T, userID string) []*model.Passkey {
		t.Helper()
		passkeys, appErr := th.App.GetPasskeysForUser(userID)
		require.Nil(t, appErr)
		return passkeys
	}
	sessionCount := func(t *testing.T, userID string) int {
		t.Helper()
		sessions, appErr := th.App.GetSessions(th.Context, userID)
		require.Nil(t, appErr)
		return len(sessions)
	}
	saveCeremony := func(t *testing.T, extra string, createAt int64) string {
		t.Helper()
		token := model.NewToken(model.TokenTypePasskeyVerification, extra)
		token.CreateAt = createAt
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		return token.Token
	}
	withPasskeyStore := func(t *testing.T, passkeys store.PasskeyStore) {
		t.Helper()
		original := th.App.Srv().Store()
		th.App.Srv().SetStore(&passkeyStoreWrapper{Store: original, passkeys: passkeys})
		t.Cleanup(func() { th.App.Srv().SetStore(original) })
	}
	withTokenStore := func(t *testing.T, tokens store.TokenStore) {
		t.Helper()
		original := th.App.Srv().Store()
		th.App.Srv().SetStore(&passkeyStoreWrapper{Store: original, passkeys: original.Passkey(), tokens: tokens})
		t.Cleanup(func() { th.App.Srv().SetStore(original) })
	}

	t.Run("verifies the passkey, records its use and creates no session", func(t *testing.T) {
		user, auth, _, ticket := registered(t)
		require.NoError(t, th.App.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, 2))
		th.App.InvalidateCacheForUser(user.Id)
		sessions := sessionCount(t, user.Id)

		opts := begin(t, ticket)
		var a assertion
		require.NoError(t, json.Unmarshal(opts.Options, &a))
		require.Equal(t, "required", a.PublicKey.UserVerification)
		require.Len(t, a.PublicKey.AllowCredentials, 1)
		require.Equal(t, base64.RawURLEncoding.EncodeToString(auth.CredentialID), a.PublicKey.AllowCredentials[0].ID)

		token, err := th.App.Srv().Store().Token().GetByToken(opts.CeremonyId)
		require.NoError(t, err)
		require.Equal(t, model.TokenTypePasskeyVerification, token.Type)
		var ceremony passkeyCeremony
		require.NoError(t, json.Unmarshal([]byte(token.Extra), &ceremony))
		require.Equal(t, ticket, ceremony.Ticket)
		require.Equal(t, user.Id, ceremony.UserID)
		require.Empty(t, ceremony.SessionData.AllowedCredentialIDs)

		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)
		require.Nil(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, assert(t, auth, opts)))
		require.Positive(t, stored(t, user.Id)[0].LastUsedAt)
		require.Equal(t, sessions, sessionCount(t, user.Id))

		refreshed, err := th.App.Srv().Store().User().Get(th.Context, user.Id)
		require.NoError(t, err)
		require.Equal(t, 2, refreshed.FailedAttempts)
	})

	t.Run("accepts any of the user's passkeys whatever user handle each was registered with", func(t *testing.T) {
		user := th.CreateUser(t)
		auths := []*testlib.SoftAuthenticator{newAuthenticator(t), newAuthenticator(t)}
		sessions := []*model.Session{recentSession(user.Id), recentSession(user.Id)}
		// Each registration begun while the user has no passkeys draws its own random handle.
		begun := make([]*model.PasskeyRegistrationOptions, len(auths))
		for i, session := range sessions {
			opts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
			require.Nil(t, appErr)
			begun[i] = opts
		}
		for i, auth := range auths {
			resp, err := auth.CreateResponse(begun[i].Options, origin)
			require.NoError(t, err)
			_, appErr := th.App.FinishPasskeyRegistration(th.Context, sessions[i], begun[i].CeremonyId, "a", "", resp)
			require.Nil(t, appErr)
		}
		passkeys := stored(t, user.Id)
		require.Len(t, passkeys, 2)
		require.NotEqual(t, passkeys[0].UserHandle, passkeys[1].UserHandle)
		session := storedPasskeySession(t, th, user.Id, model.SessionLoginMethodStandard)

		require.Nil(t, verify(t, issuePasskeyTicket(t, th, session), auths[1]))
		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)
		require.Positive(t, stored(t, user.Id)[1].LastUsedAt)

		require.Nil(t, verify(t, issuePasskeyTicket(t, th, session), auths[0]))
		require.Positive(t, stored(t, user.Id)[0].LastUsedAt)
	})

	t.Run("verification tokens expire after the ceremony window", func(t *testing.T) {
		now := model.GetMillis()
		require.True(t, (&model.Token{Type: model.TokenTypePasskeyVerification, CreateAt: now - 6*60*1000}).IsExpired())
		require.False(t, (&model.Token{Type: model.TokenTypePasskeyVerification, CreateAt: now - 4*60*1000}).IsExpired())
	})

	t.Run("a user without passkeys is refused", func(t *testing.T) {
		session := storedPasskeySession(t, th, th.CreateUser(t).Id, model.SessionLoginMethodStandard)

		requireBeginFails(t, issuePasskeyTicket(t, th, session), http.StatusBadRequest, "app.passkey.none_registered.app_error")
	})

	t.Run("ten passkeys with the longest credential ids still begin", func(t *testing.T) {
		user := th.CreateUser(t)
		for i := range model.PasskeyMaxPerUser {
			id := make([]byte, model.PasskeyCredentialIdMaxSize)
			copy(id, fmt.Sprintf("%04d", i))
			_, err := th.App.Srv().Store().Passkey().SaveIfUnderLimit(&model.Passkey{
				UserId:       user.Id,
				Name:         fmt.Sprintf("key %d", i),
				UserHandle:   []byte("handle-" + user.Id),
				CredentialId: id,
				PublicKey:    []byte("key"),
				AAGUID:       []byte{},
			}, model.PasskeyMaxPerUser)
			require.NoError(t, err)
		}
		session := storedPasskeySession(t, th, user.Id, model.SessionLoginMethodStandard)

		opts := begin(t, issuePasskeyTicket(t, th, session))
		var a assertion
		require.NoError(t, json.Unmarshal(opts.Options, &a))
		require.Len(t, a.PublicKey.AllowCredentials, model.PasskeyMaxPerUser)
	})

	t.Run("another user's passkey is refused and the ticket still works", func(t *testing.T) {
		user, auth, _, ticket := registered(t)
		_, other, _, _ := registered(t)

		requireFails(t, verify(t, ticket, other), http.StatusUnauthorized, invalidCredential)
		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)

		require.Nil(t, verify(t, ticket, auth))
	})

	t.Run("a passkey deleted after begin is refused", func(t *testing.T) {
		user, auth, _, ticket := registered(t)
		addPasskey(t, user, newAuthenticator(t))
		opts := begin(t, ticket)
		for _, p := range stored(t, user.Id) {
			if string(p.CredentialId) == string(auth.CredentialID) {
				require.Nil(t, th.App.DeletePasskey(user.Id, p.Id))
			}
		}

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, assert(t, auth, opts)), http.StatusUnauthorized, invalidCredential)
	})

	t.Run("an assertion without user verification is refused and the ticket still works", func(t *testing.T) {
		_, auth, _, ticket := registered(t)

		requireFails(t, verify(t, ticket, auth, testlib.WithoutUserVerification()), http.StatusUnauthorized, invalidCredential)
		require.Nil(t, verify(t, ticket, auth))
	})

	t.Run("a garbage credential is refused and the ticket still works", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		opts := begin(t, ticket)

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, []byte(`{"id":`)), http.StatusBadRequest, invalidCredential)
		require.Nil(t, verify(t, ticket, auth))
	})

	t.Run("the counter must increase, and a ticket survives a refusal", func(t *testing.T) {
		user, auth, session, ticket := registered(t)

		auth.SignCount = 5
		require.Nil(t, verify(t, ticket, auth))
		require.EqualValues(t, 5, stored(t, user.Id)[0].SignCount)

		ticket = issuePasskeyTicket(t, th, session)
		requireFails(t, verify(t, ticket, auth), http.StatusUnauthorized, counterRegressed)
		require.EqualValues(t, 5, stored(t, user.Id)[0].SignCount)

		auth.SignCount = 6
		require.Nil(t, verify(t, ticket, auth))
		require.EqualValues(t, 6, stored(t, user.Id)[0].SignCount)
	})

	t.Run("a counter that stays at zero is accepted", func(t *testing.T) {
		_, auth, session, ticket := registered(t)

		require.Nil(t, verify(t, ticket, auth))
		require.Nil(t, verify(t, issuePasskeyTicket(t, th, session), auth))
	})

	t.Run("a failure to record the use is a server error", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		original := th.App.Srv().Store()
		withPasskeyStore(t, &racingPasskeyStore{
			PasskeyStore: original.Passkey(),
			updateUsage: func(func() error, string, int64, int64, int64) error {
				return errors.New("db down")
			},
		})

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusInternalServerError, "app.passkey.update_usage.app_error")
	})

	t.Run("a verification that loses the race to record its use is refused", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		original := th.App.Srv().Store()
		withPasskeyStore(t, &racingPasskeyStore{
			PasskeyStore: original.Passkey(),
			updateUsage: func(next func() error, id string, prev, _, at int64) error {
				require.NoError(t, original.Passkey().UpdateUsage(id, prev, prev+1, at))
				return next()
			},
		})

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusUnauthorized, counterRegressed)
	})

	t.Run("a spent ticket cannot begin again", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		require.Nil(t, verify(t, ticket, auth))

		requireBeginFails(t, ticket, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("a ticket spent by another finish refuses the other ceremony", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		first, second := begin(t, ticket), begin(t, ticket)
		require.Nil(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, first.CeremonyId, assert(t, auth, first)))

		auth.SignCount = 1
		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, second.CeremonyId, assert(t, auth, second)), http.StatusBadRequest, ticketInvalid)
	})

	t.Run("unknown, aged and wrong-type tickets are refused at begin", func(t *testing.T) {
		requireBeginFails(t, model.NewRandomString(model.TokenSize), http.StatusBadRequest, ticketInvalid)

		_, _, _, ticket := registered(t)
		agePasskeyTicket(t, th, ticket)
		requireBeginFails(t, ticket, http.StatusBadRequest, ticketInvalid)

		_, _, session, _ := registered(t)
		reg, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, appErr)
		requireBeginFails(t, reg.CeremonyId, http.StatusBadRequest, ticketInvalid)
	})

	t.Run("a ticket that ages between begin and finish is refused", func(t *testing.T) {
		user, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		agePasskeyTicket(t, th, ticket)

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, assert(t, auth, opts)), http.StatusBadRequest, ticketInvalid)
		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)
	})

	t.Run("a revoked issuing session is refused even if the user has another", func(t *testing.T) {
		user, auth, session, ticket := registered(t)
		opts := begin(t, ticket)
		storedPasskeySession(t, th, user.Id, model.SessionLoginMethodStandard)
		require.Nil(t, th.App.RevokeSession(th.Context, session))

		requireBeginFails(t, ticket, http.StatusBadRequest, ticketInvalid)
		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, assert(t, auth, opts)), http.StatusBadRequest, ticketInvalid)
		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)
	})

	t.Run("an issuing session older than the recent sign-in window still verifies", func(t *testing.T) {
		_, auth, session, ticket := registered(t)
		agePasskeySession(t, th, session)

		require.Nil(t, verify(t, ticket, auth))
	})

	t.Run("a ticket consumed by a concurrent finish records nothing", func(t *testing.T) {
		user, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		useTicketStore(t, th, &ticketTokenStore{consumeTicket: func(next func() (*model.Token, error)) (*model.Token, error) {
			_, err := next()
			require.NoError(t, err)
			return next()
		}})

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusBadRequest, ticketInvalid)
		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)
	})

	t.Run("a ticket that expires while being consumed records nothing", func(t *testing.T) {
		user, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		useTicketStore(t, th, &ticketTokenStore{consumeTicket: func(next func() (*model.Token, error)) (*model.Token, error) {
			agePasskeyTicket(t, th, ticket)
			return next()
		}})

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusBadRequest, ticketInvalid)
		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)
	})

	t.Run("a failure to consume the ticket is a server error and records nothing", func(t *testing.T) {
		user, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		useTicketStore(t, th, &ticketTokenStore{consumeTicket: func(func() (*model.Token, error)) (*model.Token, error) {
			return nil, errors.New("db down")
		}})

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusInternalServerError, "app.passkey.finish_verification.app_error")
		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)
	})

	t.Run("a failure to read the ticket is a server error at begin and at finish", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		useTicketStore(t, th, &ticketTokenStore{getByTokenFromMaster: func() (*model.Token, error) { return nil, errors.New("db down") }})

		requireBeginFails(t, ticket, http.StatusInternalServerError, "app.passkey.get_ticket.app_error")
		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusInternalServerError, "app.passkey.get_ticket.app_error")
	})

	t.Run("a ticket a lagging replica does not have yet is still found at begin and at finish", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		useTicketStore(t, th, &ticketTokenStore{getByToken: func() (*model.Token, error) { return nil, store.NewErrNotFound("Token", "x") }})

		require.Nil(t, verify(t, ticket, auth))
	})

	t.Run("a failure to read the passkeys is a server error at begin and at finish", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		withPasskeyStore(t, &failingGetForUserPasskeyStore{PasskeyStore: th.App.Srv().Store().Passkey()})

		requireBeginFails(t, ticket, http.StatusInternalServerError, "app.passkey.get.app_error")
		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusInternalServerError, "app.passkey.get.app_error")
	})

	t.Run("a failure to save the ceremony is a server error", func(t *testing.T) {
		_, _, _, ticket := registered(t)
		withTokenStore(t, failingSaveTokenStore{th.App.Srv().Store().Token()})

		requireBeginFails(t, ticket, http.StatusInternalServerError, "app.passkey.begin_verification.app_error")
	})

	t.Run("a failure to consume the ceremony is a server error", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		withTokenStore(t, failingConsumeTokenStore{th.App.Srv().Store().Token()})

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusInternalServerError, "app.passkey.finish_verification.app_error")
	})

	t.Run("a ticket whose user no longer exists is refused", func(t *testing.T) {
		user, _, _, ticket := registered(t)
		_, err := th.SQLStore.GetMaster().Exec(`DELETE FROM Users WHERE Id = ?`, user.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)

		opts, appErr := th.App.BeginPasskeyVerificationWithTicket(th.Context, ticket)
		require.Nil(t, opts)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("an unusable Site URL is a 501 at begin and at finish", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		th.UpdateConfig(t, func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://chat.example.com" })
		t.Cleanup(func() {
			th.UpdateConfig(t, func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = origin })
		})

		requireBeginFails(t, ticket, http.StatusNotImplemented, "app.passkey.unavailable.app_error")
		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, opts.CeremonyId, resp), http.StatusNotImplemented, "app.passkey.unavailable.app_error")
	})

	t.Run("an unknown ceremony is refused", func(t *testing.T) {
		_, auth, _, ticket := registered(t)
		opts := begin(t, ticket)

		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, model.NewId(), assert(t, auth, opts)), http.StatusBadRequest, ceremonyInvalid)
	})

	t.Run("an unusable stored ceremony is refused", func(t *testing.T) {
		_, auth, session, ticket := registered(t)
		opts := begin(t, ticket)
		resp := assert(t, auth, opts)
		now := model.GetMillis()
		ceremony := func(c passkeyCeremony) string {
			extra, err := json.Marshal(c)
			require.NoError(t, err)
			return string(extra)
		}
		bound := passkeyCeremony{UserID: session.UserId, SessionID: session.Id, SessionData: &webauthn.SessionData{}, Ticket: ticket}
		noTicket := bound
		noTicket.Ticket = ""
		noData := bound
		noData.SessionData = nil
		otherUser := bound
		otherUser.UserID = th.BasicUser.Id
		otherSession := bound
		otherSession.SessionID = model.NewId()

		for name, id := range map[string]string{
			"not json":      saveCeremony(t, "not json", now),
			"expired":       saveCeremony(t, ceremony(bound), now-6*60*1000),
			"no ticket":     saveCeremony(t, ceremony(noTicket), now),
			"no state":      saveCeremony(t, ceremony(noData), now),
			"another user":  saveCeremony(t, ceremony(otherUser), now),
			"other session": saveCeremony(t, ceremony(otherSession), now),
		} {
			t.Run(name, func(t *testing.T) {
				requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, id, resp), http.StatusBadRequest, ceremonyInvalid)
			})
		}
	})

	t.Run("a sign-in ceremony is refused by verification and a verification ceremony by sign-in", func(t *testing.T) {
		user, auth, _, ticket := registered(t)

		login, appErr := th.App.BeginPasskeyLogin(th.Context)
		require.Nil(t, appErr)
		requireFails(t, th.App.FinishPasskeyVerificationWithTicket(th.Context, login.CeremonyId, assert(t, auth, login)), http.StatusBadRequest, ceremonyInvalid)

		opts := begin(t, ticket)
		got, _, appErr := th.App.FinishPasskeyLogin(th.Context, opts.CeremonyId, assert(t, auth, opts))
		require.Nil(t, got)
		requireFails(t, appErr, http.StatusBadRequest, ceremonyInvalid)
		require.Zero(t, stored(t, user.Id)[0].LastUsedAt)
	})
}

func TestFinishPasskeyLogin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	})
	const origin = "http://localhost:8065"

	register := func(t *testing.T, user *model.User, auth *testlib.SoftAuthenticator, authOpts ...testlib.SoftAuthenticatorOption) {
		t.Helper()
		session := recentSession(user.Id)
		opts, appErr := th.App.BeginPasskeyRegistration(th.Context, session)
		require.Nil(t, appErr)
		resp, err := auth.CreateResponse(opts.Options, origin, authOpts...)
		require.NoError(t, err)
		_, appErr = th.App.FinishPasskeyRegistration(th.Context, session, opts.CeremonyId, "a", "", resp)
		require.Nil(t, appErr)
	}
	newAuthenticator := func(t *testing.T) *testlib.SoftAuthenticator {
		t.Helper()
		auth, err := testlib.NewSoftAuthenticator()
		require.NoError(t, err)
		return auth
	}
	registered := func(t *testing.T, authOpts ...testlib.SoftAuthenticatorOption) (*model.User, *testlib.SoftAuthenticator) {
		t.Helper()
		user, auth := th.CreateUser(t), newAuthenticator(t)
		register(t, user, auth, authOpts...)
		return user, auth
	}
	begin := func(t *testing.T) *model.PasskeyLoginOptions {
		t.Helper()
		opts, appErr := th.App.BeginPasskeyLogin(th.Context)
		require.Nil(t, appErr)
		return opts
	}
	finish := func(t *testing.T, auth *testlib.SoftAuthenticator, origin string, authOpts ...testlib.SoftAuthenticatorOption) (*model.User, *model.AppError) {
		t.Helper()
		opts := begin(t)
		resp, err := auth.GetAssertion(opts.Options, origin, authOpts...)
		require.NoError(t, err)
		user, _, appErr := th.App.FinishPasskeyLogin(th.Context, opts.CeremonyId, resp)
		return user, appErr
	}
	requireFails := func(t *testing.T, user *model.User, appErr *model.AppError, status int, id string) {
		t.Helper()
		require.Nil(t, user)
		require.NotNil(t, appErr)
		require.Equal(t, status, appErr.StatusCode)
		require.Equal(t, id, appErr.Id)
	}
	requireSucceeds := func(t *testing.T, want *model.User, got *model.User, appErr *model.AppError) {
		t.Helper()
		require.Nil(t, appErr)
		require.NotNil(t, got)
		require.Equal(t, want.Id, got.Id)
	}
	storedPasskey := func(t *testing.T, userID string) *model.Passkey {
		t.Helper()
		passkeys, appErr := th.App.GetPasskeysForUser(userID)
		require.Nil(t, appErr)
		require.Len(t, passkeys, 1)
		return passkeys[0]
	}
	setFailedAttempts := func(t *testing.T, userID string, n int) {
		t.Helper()
		require.NoError(t, th.App.Srv().Store().User().UpdateFailedPasswordAttempts(userID, n))
		th.App.InvalidateCacheForUser(userID)
	}
	failedAttempts := func(t *testing.T, userID string) int {
		t.Helper()
		user, err := th.App.Srv().Store().User().Get(th.Context, userID)
		require.NoError(t, err)
		return user.FailedAttempts
	}

	t.Run("signs in the passkey's user and records the use", func(t *testing.T) {
		user, auth := registered(t)
		require.Zero(t, storedPasskey(t, user.Id).LastUsedAt)

		got, appErr := finish(t, auth, origin)
		requireSucceeds(t, user, got, appErr)
		require.Positive(t, storedPasskey(t, user.Id).LastUsedAt)
	})

	t.Run("returns the passkey that signed in, and none on failure", func(t *testing.T) {
		user, auth := registered(t)

		opts := begin(t)
		resp, err := auth.GetAssertion(opts.Options, origin)
		require.NoError(t, err)
		got, passkey, appErr := th.App.FinishPasskeyLogin(th.Context, opts.CeremonyId, resp)
		requireSucceeds(t, user, got, appErr)
		require.NotNil(t, passkey)
		require.Equal(t, storedPasskey(t, user.Id).Id, passkey.Id)

		opts = begin(t)
		resp, err = auth.GetAssertion(opts.Options, "http://evil.example")
		require.NoError(t, err)
		got, passkey, appErr = th.App.FinishPasskeyLogin(th.Context, opts.CeremonyId, resp)
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.invalid_credential.app_error")
		require.Nil(t, passkey)
	})

	t.Run("the counter must increase", func(t *testing.T) {
		user, auth := registered(t)

		auth.SignCount = 5
		got, appErr := finish(t, auth, origin)
		requireSucceeds(t, user, got, appErr)
		require.EqualValues(t, 5, storedPasskey(t, user.Id).SignCount)

		auth.SignCount = 3
		got, appErr = finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.counter_regressed.app_error")
		require.EqualValues(t, 5, storedPasskey(t, user.Id).SignCount)

		auth.SignCount = 5
		got, appErr = finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.counter_regressed.app_error")
		require.EqualValues(t, 5, storedPasskey(t, user.Id).SignCount)

		auth.SignCount = 0
		got, appErr = finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.counter_regressed.app_error")

		auth.SignCount = 6
		got, appErr = finish(t, auth, origin)
		requireSucceeds(t, user, got, appErr)
		require.EqualValues(t, 6, storedPasskey(t, user.Id).SignCount)
	})

	t.Run("a counter that stays at zero is accepted", func(t *testing.T) {
		user, auth := registered(t)

		for range 2 {
			got, appErr := finish(t, auth, origin)
			requireSucceeds(t, user, got, appErr)
		}
		require.Zero(t, storedPasskey(t, user.Id).SignCount)
	})

	t.Run("a synced passkey signs in", func(t *testing.T) {
		user, auth := registered(t, testlib.WithBackupEligible())

		got, appErr := finish(t, auth, origin, testlib.WithBackupEligible())
		requireSucceeds(t, user, got, appErr)
	})

	t.Run("a passkey the server does not know is refused as unknown", func(t *testing.T) {
		registered(t)
		stranger := newAuthenticator(t)
		// A real authenticator always answers with a user handle; the library refuses a blank one first.
		stranger.UserHandle = []byte("some other server's handle")

		got, appErr := finish(t, stranger, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.unknown_credential.app_error")
	})

	t.Run("a deleted passkey is refused as unknown", func(t *testing.T) {
		user, auth := registered(t)
		require.Nil(t, th.App.DeletePasskey(user.Id, storedPasskey(t, user.Id).Id))

		got, appErr := finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.unknown_credential.app_error")
	})

	t.Run("a user handle that is not the passkey's is refused", func(t *testing.T) {
		user, auth := registered(t)
		auth.UserHandle = append([]byte{}, auth.UserHandle...)
		auth.UserHandle[0] ^= 0xff

		got, appErr := finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.invalid_credential.app_error")
		require.Zero(t, storedPasskey(t, user.Id).LastUsedAt)
	})

	t.Run("wrong origin is refused", func(t *testing.T) {
		_, auth := registered(t)

		got, appErr := finish(t, auth, "http://evil.example")
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.invalid_credential.app_error")
	})

	t.Run("an assertion without user verification is refused", func(t *testing.T) {
		_, auth := registered(t)

		got, appErr := finish(t, auth, origin, testlib.WithoutUserVerification())
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.invalid_credential.app_error")
	})

	t.Run("garbage credential is refused", func(t *testing.T) {
		got, _, appErr := th.App.FinishPasskeyLogin(th.Context, begin(t).CeremonyId, []byte(`{"id":`))
		requireFails(t, got, appErr, http.StatusBadRequest, "app.passkey.invalid_credential.app_error")
	})

	t.Run("a ceremony can only be finished once", func(t *testing.T) {
		user, auth := registered(t)
		opts := begin(t)
		resp, err := auth.GetAssertion(opts.Options, origin)
		require.NoError(t, err)

		got, _, appErr := th.App.FinishPasskeyLogin(th.Context, opts.CeremonyId, resp)
		requireSucceeds(t, user, got, appErr)

		got, _, appErr = th.App.FinishPasskeyLogin(th.Context, opts.CeremonyId, resp)
		requireFails(t, got, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
	})

	t.Run("unknown ceremony is refused", func(t *testing.T) {
		_, auth := registered(t)
		resp, err := auth.GetAssertion(begin(t).Options, origin)
		require.NoError(t, err)

		got, _, appErr := th.App.FinishPasskeyLogin(th.Context, model.NewId(), resp)
		requireFails(t, got, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
	})

	t.Run("expired ceremony is refused", func(t *testing.T) {
		_, auth := registered(t)
		opts := begin(t)
		resp, err := auth.GetAssertion(opts.Options, origin)
		require.NoError(t, err)
		_, err = th.SQLStore.GetMaster().Exec(`UPDATE Tokens SET CreateAt = ? WHERE Token = ?`, model.GetMillis()-6*60*1000, opts.CeremonyId)
		require.NoError(t, err)

		got, _, appErr := th.App.FinishPasskeyLogin(th.Context, opts.CeremonyId, resp)
		requireFails(t, got, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
	})

	t.Run("a registration ceremony cannot finish a sign-in", func(t *testing.T) {
		_, auth := registered(t)
		reg, appErr := th.App.BeginPasskeyRegistration(th.Context, recentSession(th.CreateUser(t).Id))
		require.Nil(t, appErr)
		resp, err := auth.GetAssertion(begin(t).Options, origin)
		require.NoError(t, err)

		got, _, appErr := th.App.FinishPasskeyLogin(th.Context, reg.CeremonyId, resp)
		requireFails(t, got, appErr, http.StatusBadRequest, "app.passkey.ceremony_invalid.app_error")
	})

	t.Run("a deactivated user is refused as inactive", func(t *testing.T) {
		user, auth := registered(t)
		_, appErr := th.App.UpdateActive(th.Context, user, false)
		require.Nil(t, appErr)

		got, appErr := finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "api.user.login.inactive.app_error")
		require.Zero(t, storedPasskey(t, user.Id).LastUsedAt)
	})

	t.Run("a user converted to a bot is refused", func(t *testing.T) {
		user, auth := registered(t)
		_, appErr := th.App.ConvertUserToBot(th.Context, user)
		require.Nil(t, appErr)

		got, appErr := finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "api.user.login.bot_login_forbidden.app_error")
	})

	t.Run("a user locked out by failed password attempts is refused", func(t *testing.T) {
		user, auth := registered(t)
		setFailedAttempts(t, user.Id, *th.App.Config().ServiceSettings.MaximumLoginAttempts)

		got, appErr := finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "api.user.check_user_login_attempts.too_many.app_error")
	})

	t.Run("an LDAP user is locked out at the LDAP threshold", func(t *testing.T) {
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.MaximumLoginAttempts = 10
			*cfg.LdapSettings.MaximumLoginAttempts = 3
		})
		t.Cleanup(func() {
			th.UpdateConfig(t, func(cfg *model.Config) { *cfg.LdapSettings.MaximumLoginAttempts = 10 })
		})
		ldapUser, ldapAuth := registered(t)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Users SET AuthService = ?, AuthData = ?, Password = '' WHERE Id = ?`, model.UserAuthServiceLdap, model.NewId(), ldapUser.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(ldapUser.Id)
		setFailedAttempts(t, ldapUser.Id, 5)
		emailUser, emailAuth := registered(t)
		setFailedAttempts(t, emailUser.Id, 5)

		got, appErr := finish(t, ldapAuth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "api.user.check_user_login_attempts.too_many_ldap.app_error")

		got, appErr = finish(t, emailAuth, origin)
		requireSucceeds(t, emailUser, got, appErr)
	})

	t.Run("an unverified email is refused when verification is required", func(t *testing.T) {
		user, auth := registered(t)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Users SET EmailVerified = false WHERE Id = ?`, user.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)

		got, appErr := finish(t, auth, origin)
		requireSucceeds(t, user, got, appErr)

		th.UpdateConfig(t, func(cfg *model.Config) { *cfg.EmailSettings.RequireEmailVerification = true })
		t.Cleanup(func() {
			th.UpdateConfig(t, func(cfg *model.Config) { *cfg.EmailSettings.RequireEmailVerification = false })
		})
		got, appErr = finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "api.user.login.not_verified.app_error")
	})

	t.Run("a user with MFA active signs in without a code", func(t *testing.T) {
		user, auth := registered(t)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Users SET MfaActive = true WHERE Id = ?`, user.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)

		got, appErr := finish(t, auth, origin)
		requireSucceeds(t, user, got, appErr)
	})

	t.Run("failed password attempts are left alone by a failure and by a success", func(t *testing.T) {
		user, auth := registered(t)
		setFailedAttempts(t, user.Id, 2)

		got, appErr := finish(t, auth, "http://evil.example")
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.invalid_credential.app_error")
		require.Equal(t, 2, failedAttempts(t, user.Id))

		got, appErr = finish(t, auth, origin)
		requireSucceeds(t, user, got, appErr)
		require.Equal(t, 2, failedAttempts(t, user.Id))
	})

	// The sequential counter tests above never reach UpdateUsage's compare-and-set failing,
	// because the library's clone check refuses first. Swapping the store is the only way to
	// make two sign-ins race deterministically.
	t.Run("a sign-in that loses the race to record its use is refused", func(t *testing.T) {
		_, auth := registered(t)
		original := th.App.Srv().Store()
		th.App.Srv().SetStore(&passkeyStoreWrapper{Store: original, passkeys: &racingPasskeyStore{
			PasskeyStore: original.Passkey(),
			updateUsage: func(next func() error, id string, prev, _, at int64) error {
				// Another sign-in records its use between this one's verification and update.
				require.NoError(t, original.Passkey().UpdateUsage(id, prev, prev+1, at))
				return next()
			},
		}})
		t.Cleanup(func() { th.App.Srv().SetStore(original) })

		got, appErr := finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusUnauthorized, "app.passkey.counter_regressed.app_error")
	})

	t.Run("a failure to record the use is a server error", func(t *testing.T) {
		_, auth := registered(t)
		original := th.App.Srv().Store()
		th.App.Srv().SetStore(&passkeyStoreWrapper{Store: original, passkeys: &racingPasskeyStore{
			PasskeyStore: original.Passkey(),
			updateUsage: func(func() error, string, int64, int64, int64) error {
				return errors.New("db down")
			},
		}})
		t.Cleanup(func() { th.App.Srv().SetStore(original) })

		got, appErr := finish(t, auth, origin)
		requireFails(t, got, appErr, http.StatusInternalServerError, "app.passkey.update_usage.app_error")
	})
}

type passkeyStoreWrapper struct {
	store.Store
	passkeys store.PasskeyStore
	tokens   store.TokenStore   // nil passes through to the real store
	sessions store.SessionStore // nil passes through to the real store
}

func (w *passkeyStoreWrapper) Session() store.SessionStore {
	if w.sessions != nil {
		return w.sessions
	}
	return w.Store.Session()
}

func (w *passkeyStoreWrapper) Passkey() store.PasskeyStore { return w.passkeys }

func (w *passkeyStoreWrapper) Token() store.TokenStore {
	if w.tokens != nil {
		return w.tokens
	}
	return w.Store.Token()
}

// Every other call passes through to the real store.
type failingGetSessionStore struct {
	store.SessionStore
}

func (failingGetSessionStore) Get(request.CTX, string) (*model.Session, error) {
	return nil, errors.New("db down")
}

// Every other call passes through to the real store.
type failingSaveTokenStore struct {
	store.TokenStore
}

func (failingSaveTokenStore) Save(*model.Token) error { return errors.New("db down") }

// ticketTokenStore lets a test run code around, or instead of, reading and consuming a passkey
// enrollment ticket. Nil hooks, and every other call, pass through to the real store.
type ticketTokenStore struct {
	store.TokenStore
	getByToken           func() (*model.Token, error)
	getByTokenFromMaster func() (*model.Token, error)
	consumeTicket        func(next func() (*model.Token, error)) (*model.Token, error)
}

func (s *ticketTokenStore) GetByToken(token string) (*model.Token, error) {
	if s.getByToken != nil {
		return s.getByToken()
	}
	return s.TokenStore.GetByToken(token)
}

func (s *ticketTokenStore) GetByTokenFromMaster(token string) (*model.Token, error) {
	if s.getByTokenFromMaster != nil {
		return s.getByTokenFromMaster()
	}
	return s.TokenStore.GetByTokenFromMaster(token)
}

func (s *ticketTokenStore) ConsumeOnce(tokenType, tokenStr string) (*model.Token, error) {
	next := func() (*model.Token, error) { return s.TokenStore.ConsumeOnce(tokenType, tokenStr) }
	if tokenType == model.TokenTypePasskeyEnrollmentTicket && s.consumeTicket != nil {
		return s.consumeTicket(next)
	}
	return next()
}

// racingPasskeyStore lets a test run code around, or instead of, UpdateUsage. Every other
// call passes through to the real store.
type racingPasskeyStore struct {
	store.PasskeyStore
	updateUsage func(next func() error, id string, prevSignCount, signCount, lastUsedAt int64) error
}

func (s *racingPasskeyStore) UpdateUsage(id string, prevSignCount, signCount, lastUsedAt int64) error {
	return s.updateUsage(func() error {
		return s.PasskeyStore.UpdateUsage(id, prevSignCount, signCount, lastUsedAt)
	}, id, prevSignCount, signCount, lastUsedAt)
}

// Every other call passes through to the real store.
type failingConsumeTokenStore struct {
	store.TokenStore
}

func (failingConsumeTokenStore) ConsumeOnce(string, string) (*model.Token, error) {
	return nil, errors.New("db down")
}

// Every other call passes through to the real store.
type failingGetForUserPasskeyStore struct {
	store.PasskeyStore
}

func (failingGetForUserPasskeyStore) GetForUser(string) ([]*model.Passkey, error) {
	return nil, errors.New("db down")
}
