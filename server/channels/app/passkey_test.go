// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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

	freshSession := func(userID string) *model.Session {
		return &model.Session{
			Id:       model.NewId(),
			UserId:   userID,
			CreateAt: model.GetMillis(),
			Props:    model.StringMap{model.SessionPropLoginMethod: model.SessionLoginMethodStandard},
		}
	}

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
		session := freshSession(user.Id)

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

		_, c := begin(t, freshSession(user.Id))

		require.Len(t, c.PublicKey.ExcludeCredentials, 1)
		require.Equal(t, base64.RawURLEncoding.EncodeToString(existing.CredentialId), c.PublicKey.ExcludeCredentials[0].ID)
		require.Equal(t, base64.RawURLEncoding.EncodeToString(existing.UserHandle), c.PublicKey.User.ID)
	})

	t.Run("display name is the full name, else the username", func(t *testing.T) {
		user := th.CreateUser(t)
		_, c := begin(t, freshSession(user.Id))
		require.Equal(t, user.Username, c.PublicKey.User.DisplayName)

		named := th.CreateUser(t)
		named.FirstName, named.LastName = "Ada", "Lovelace"
		_, appErr := th.App.UpdateUser(th.Context, named, false)
		require.Nil(t, appErr)
		_, c = begin(t, freshSession(named.Id))
		require.Equal(t, "Ada Lovelace", c.PublicKey.User.DisplayName)
	})

	t.Run("session older than the window is refused", func(t *testing.T) {
		session := freshSession(th.CreateUser(t).Id)
		session.CreateAt = model.GetMillis() - 11*60*1000
		requireFails(t, session, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
	})

	t.Run("session without a login method is refused", func(t *testing.T) {
		session := freshSession(th.CreateUser(t).Id)
		session.Props = nil
		requireFails(t, session, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
	})

	t.Run("passkey login method is refused", func(t *testing.T) {
		session := freshSession(th.CreateUser(t).Id)
		session.Props[model.SessionPropLoginMethod] = "passkey"
		requireFails(t, session, http.StatusForbidden, "app.passkey.recent_login_required.app_error")
	})

	t.Run("bot is refused", func(t *testing.T) {
		bot := th.CreateBot(t)
		requireFails(t, freshSession(bot.UserId), http.StatusForbidden, "app.passkey.user_not_allowed.app_error")
	})

	t.Run("remote user is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		_, err := th.SQLStore.GetMaster().Exec(`UPDATE Users SET RemoteId = ? WHERE Id = ?`, model.NewId(), user.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(user.Id)
		requireFails(t, freshSession(user.Id), http.StatusForbidden, "app.passkey.user_not_allowed.app_error")
	})

	t.Run("user at the passkey limit is refused", func(t *testing.T) {
		user := th.CreateUser(t)
		for i := range model.PasskeyMaxPerUser {
			savePasskey(t, th, user.Id, fmt.Sprintf("key %d", i), model.GetMillis())
		}
		requireFails(t, freshSession(user.Id), http.StatusBadRequest, "app.passkey.limit_reached.app_error")
	})

	t.Run("internationalized Site URL gives an ASCII relying party ID", func(t *testing.T) {
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "https://bücher.example"
		})
		_, c := begin(t, freshSession(th.CreateUser(t).Id))
		require.Equal(t, "xn--bcher-kva.example", c.PublicKey.RP.ID)
	})

	t.Run("unusable Site URL passes the relying party error through", func(t *testing.T) {
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = ""
		})
		requireFails(t, freshSession(th.CreateUser(t).Id), http.StatusNotImplemented, "app.passkey.unavailable.app_error")
	})
}
