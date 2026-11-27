// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

const mobileQRTestSiteURL = "https://chat.example.com"

func setupMobileQRLogin(t *testing.T) *TestHelper {
	t.Helper()

	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableMobileQRLogin = true
		*cfg.ServiceSettings.SiteURL = mobileQRTestSiteURL
		*cfg.ServiceSettings.EnableUserAccessTokens = true
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})
	return th
}

func mobileQRTestDeviceId() string {
	return model.PushNotifyAndroidReactNative + ":" + model.NewId()
}

// newSessionClient returns a client authenticated with a freshly created session for user.
func newSessionClient(t *testing.T, th *TestHelper, user *model.User, session *model.Session) (*model.Client4, *model.Session) {
	t.Helper()

	session.UserId = user.Id
	session.Roles = user.GetRawRoles()
	created, appErr := th.App.CreateSession(th.Context, session)
	require.Nil(t, appErr)

	client := th.CreateClient()
	client.SetToken(created.Token)
	return client, created
}

func mobileQRTokenFromLink(t *testing.T, link string) string {
	t.Helper()

	parsed, err := url.Parse(link)
	require.NoError(t, err)
	token := parsed.Query().Get("t")
	require.Len(t, token, model.TokenSize)
	return token
}

func saveMobileQRToken(t *testing.T, th *TestHelper, user *model.User, sourceSessionId string, createAt, expiresAt int64) string {
	t.Helper()

	extra, err := json.Marshal(model.MobileQRLoginTokenExtra{
		UserId:          user.Id,
		SourceSessionId: sourceSessionId,
		ExpiresAt:       expiresAt,
	})
	require.NoError(t, err)

	token := model.NewToken(model.TokenTypeMobileQRLogin, string(extra))
	token.CreateAt = createAt
	require.NoError(t, th.App.Srv().Store().Token().Save(token))
	return token.Token
}

func TestCreateMobileQRLoginToken(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("works for a regular session", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		before := model.GetMillis()
		result, resp, err := th.Client.CreateMobileQRLoginToken(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.True(t, strings.HasPrefix(result.Link, "mattermost://chat.example.com/login/mobile_qr?t="), result.Link)
		token := mobileQRTokenFromLink(t, result.Link)

		assert.GreaterOrEqual(t, result.ExpiresAt, before+int64(*th.App.Config().ServiceSettings.MobileQRLoginTokenExpirySeconds)*1000)
		assert.LessOrEqual(t, result.ExpiresAt, model.GetMillis()+int64(*th.App.Config().ServiceSettings.MobileQRLoginTokenExpirySeconds)*1000)

		img, err := base64.StdEncoding.DecodeString(result.QRCode)
		require.NoError(t, err)
		decoded, err := png.Decode(bytes.NewReader(img))
		require.NoError(t, err)
		assert.Positive(t, decoded.Bounds().Dx())

		stored, err := th.App.Srv().Store().Token().GetByToken(token)
		require.NoError(t, err)
		assert.Equal(t, model.TokenTypeMobileQRLogin, stored.Type)

		var extra model.MobileQRLoginTokenExtra
		require.NoError(t, json.Unmarshal([]byte(stored.Extra), &extra))
		session, appErr := th.App.GetSession(th.Client.AuthToken)
		require.Nil(t, appErr)
		assert.Equal(t, th.BasicUser.Id, extra.UserId)
		assert.Equal(t, session.Id, extra.SourceSessionId)
		assert.Equal(t, result.ExpiresAt, extra.ExpiresAt)
	})

	t.Run("honors the configured expiry", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.MobileQRLoginTokenExpirySeconds = 60 })

		before := model.GetMillis()
		result, _, err := th.Client.CreateMobileQRLoginToken(context.Background())
		require.NoError(t, err)
		assert.GreaterOrEqual(t, result.ExpiresAt, before+60*1000)
		assert.LessOrEqual(t, result.ExpiresAt, model.GetMillis()+60*1000)
	})

	t.Run("rejects when the user is not the session user", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		r, err := th.Client.DoAPIPost(context.Background(), "/users/"+th.BasicUser2.Id+"/mobile_login_token", "")
		require.Error(t, err)
		assert.Equal(t, http.StatusForbidden, r.StatusCode)
	})

	t.Run("requires a session", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		_, resp, err := th.CreateClient().CreateMobileQRLoginToken(context.Background())
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("rejected when the feature is disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMobileQRLogin = false })

		_, resp, err := th.Client.CreateMobileQRLoginToken(context.Background())
		CheckErrorID(t, err, "api.user.mobile_qr_login.disabled.app_error")
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("rejected without a site URL", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "" })

		_, resp, err := th.Client.CreateMobileQRLoginToken(context.Background())
		CheckErrorID(t, err, "api.user.mobile_qr_login.site_url.app_error")
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("rejected for sessions that are not interactive workstation sessions", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		oAuthApp, appErr := th.App.CreateOAuthApp(&model.OAuthApp{
			CreatorId:    th.SystemAdminUser.Id,
			Name:         "name",
			CallbackUrls: []string{"http://test.com"},
			Homepage:     "http://test.com",
		})
		require.Nil(t, appErr)

		bot := th.CreateBotWithSystemAdminClient(t)
		botToken, _, err := th.SystemAdminClient.CreateUserAccessToken(context.Background(), bot.UserId, "bot token", 0)
		require.NoError(t, err)

		patToken, _, err := th.SystemAdminClient.CreateUserAccessToken(context.Background(), th.BasicUser.Id, "pat", 0)
		require.NoError(t, err)

		mobileClient := th.CreateClient()
		_, _, err = mobileClient.LoginWithDevice(context.Background(), th.BasicUser.Email, th.BasicUser.Password, mobileQRTestDeviceId())
		require.NoError(t, err)

		oAuthSession, appErr := th.App.CreateSession(th.Context, &model.Session{
			UserId:  th.BasicUser.Id,
			IsOAuth: true,
			Props:   model.StringMap{model.SessionPropOAuthAppID: oAuthApp.Id},
		})
		require.Nil(t, appErr)
		oAuthClient := th.CreateClient()
		oAuthClient.SetOAuthToken(oAuthSession.Token)

		patClient := th.CreateClient()
		patClient.SetToken(patToken.Token)

		botClient := th.CreateClient()
		botClient.SetToken(botToken.Token)

		mobilePropClient, _ := newSessionClient(t, th, th.BasicUser, &model.Session{Props: model.StringMap{model.UserAuthServiceIsMobile: "true"}})

		for name, client := range map[string]*model.Client4{
			"mobile app session (device id)": mobileClient,
			"mobile app session (prop)":      mobilePropClient,
			"personal access token":          patClient,
			"oauth app":                      oAuthClient,
			"bot":                            botClient,
		} {
			t.Run(name, func(t *testing.T) {
				_, resp, err := client.CreateMobileQRLoginToken(context.Background())
				CheckErrorID(t, err, "api.user.mobile_qr_login.session_not_allowed.app_error")
				CheckForbiddenStatus(t, resp)
			})
		}
	})
}

func TestLoginWithMobileQRToken(t *testing.T) {
	mainHelper.Parallel(t)

	authCases := []struct {
		name        string
		authService string
		props       model.StringMap
		expectSaml  string
		expectOAuth string
	}{
		{name: "email and password", props: model.StringMap{}, expectSaml: "false", expectOAuth: "false"},
		{name: "ldap", authService: model.UserAuthServiceLdap, props: model.StringMap{}, expectSaml: "false", expectOAuth: "false"},
		{name: "saml", authService: model.UserAuthServiceSaml, props: model.StringMap{model.UserAuthServiceIsSaml: "true"}, expectSaml: "true", expectOAuth: "false"},
		{name: "oauth", authService: model.ServiceGitlab, props: model.StringMap{model.UserAuthServiceIsOAuth: "true"}, expectSaml: "false", expectOAuth: "true"},
		{name: "guest", authService: "", props: model.StringMap{model.SessionPropIsGuest: "true"}, expectSaml: "false", expectOAuth: "false"},
	}

	for _, tc := range authCases {
		t.Run("redeem succeeds for "+tc.name+" users", func(t *testing.T) {
			mainHelper.Parallel(t)
			th := setupMobileQRLogin(t)

			var user *model.User
			switch {
			case tc.name == "email and password":
				user = th.BasicUser
			case tc.name == "guest":
				user = th.CreateGuestUser(t)
			default:
				user = th.CreateUserWithAuth(t, tc.authService)
			}

			sourceClient, sourceSession := newSessionClient(t, th, user, &model.Session{Props: tc.props})
			ws := th.CreateConnectedWebSocketClientWithClient(t, sourceClient)

			created, _, err := sourceClient.CreateMobileQRLoginToken(context.Background())
			require.NoError(t, err)
			code := mobileQRTokenFromLink(t, created.Link)

			mobileClient := th.CreateClient()
			deviceId := mobileQRTestDeviceId()
			result, resp, err := mobileClient.LoginWithMobileQRToken(context.Background(), code, deviceId)
			require.NoError(t, err)
			CheckOKStatus(t, resp)

			require.NotEmpty(t, result.Token)
			require.NotEmpty(t, result.Csrf)
			assert.Equal(t, result.Token, resp.Header.Get(model.HeaderToken))

			session, appErr := th.App.GetSession(result.Token)
			require.Nil(t, appErr)
			assert.Equal(t, user.Id, session.UserId)
			assert.NotEqual(t, sourceSession.Id, session.Id)
			assert.True(t, session.IsMobileApp())
			assert.Equal(t, deviceId, session.DeviceId)
			assert.Equal(t, result.Csrf, session.GetCSRF())
			assert.Equal(t, tc.expectSaml, session.Props[model.UserAuthServiceIsSaml])
			assert.Equal(t, tc.expectOAuth, session.Props[model.UserAuthServiceIsOAuth])
			assert.Equal(t, sourceSession.Id, session.Props[model.SessionPropMobileQRSourceSessionId])

			stored, appErr := th.App.GetSessionById(th.Context, session.Id)
			require.Nil(t, appErr)
			assert.Equal(t, sourceSession.Id, stored.Props[model.SessionPropMobileQRSourceSessionId])

			me, _, err := mobileClient.GetMe(context.Background(), "")
			require.NoError(t, err)
			assert.Equal(t, user.Id, me.Id)

			timeout := time.After(5 * time.Second)
			for received := false; !received; {
				select {
				case ev := <-ws.EventChannel:
					if ev.EventType() != model.WebsocketEventMobileQRLoginRedeemed {
						continue
					}
					assert.Equal(t, map[string]any{"source_session_id": sourceSession.Id}, ev.GetData())
					received = true
				case <-timeout:
					require.FailNow(t, "did not receive the redeemed websocket event")
				}
			}
		})
	}

	t.Run("redeem without a device id still creates a mobile session", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		created, _, err := th.Client.CreateMobileQRLoginToken(context.Background())
		require.NoError(t, err)

		result, _, err := th.CreateClient().LoginWithMobileQRToken(context.Background(), mobileQRTokenFromLink(t, created.Link), "")
		require.NoError(t, err)

		session, appErr := th.App.GetSession(result.Token)
		require.Nil(t, appErr)
		assert.True(t, session.IsMobile())
	})

	t.Run("rejects an empty token and an invalid device id", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		_, resp, err := th.CreateClient().LoginWithMobileQRToken(context.Background(), "", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		created, _, err := th.Client.CreateMobileQRLoginToken(context.Background())
		require.NoError(t, err)
		_, resp, err = th.CreateClient().LoginWithMobileQRToken(context.Background(), mobileQRTokenFromLink(t, created.Link), "not a device id")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("a code can only be redeemed once", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		created, _, err := th.Client.CreateMobileQRLoginToken(context.Background())
		require.NoError(t, err)
		code := mobileQRTokenFromLink(t, created.Link)

		_, _, err = th.CreateClient().LoginWithMobileQRToken(context.Background(), code, "")
		require.NoError(t, err)

		_, resp, err := th.CreateClient().LoginWithMobileQRToken(context.Background(), code, "")
		CheckErrorID(t, err, "api.user.mobile_qr_login.invalid_token.app_error")
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("an unknown code is rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		_, resp, err := th.CreateClient().LoginWithMobileQRToken(context.Background(), model.NewRandomString(model.TokenSize), "")
		CheckErrorID(t, err, "api.user.mobile_qr_login.invalid_token.app_error")
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("a code of another type is rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		session, appErr := th.App.GetSession(th.Client.AuthToken)
		require.Nil(t, appErr)
		extra, err := json.Marshal(model.MobileQRLoginTokenExtra{UserId: th.BasicUser.Id, SourceSessionId: session.Id, ExpiresAt: model.GetMillis() + 60000})
		require.NoError(t, err)
		other := model.NewToken(model.TokenTypeSSOCodeExchange, string(extra))
		require.NoError(t, th.App.Srv().Store().Token().Save(other))

		_, resp, err := th.CreateClient().LoginWithMobileQRToken(context.Background(), other.Token, "")
		CheckErrorID(t, err, "api.user.mobile_qr_login.invalid_token.app_error")
		CheckUnauthorizedStatus(t, resp)
	})

	rejectedCases := []struct {
		name  string
		setup func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string
	}{
		{
			name: "expired by the configured expiry",
			setup: func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string {
				return saveMobileQRToken(t, th, user, sourceSession.Id, model.GetMillis(), model.GetMillis()-1000)
			},
		},
		{
			name: "expired by the token ceiling",
			setup: func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string {
				createAt := model.GetMillis() - model.MobileQRLoginMaxExpiryTime - 1000
				return saveMobileQRToken(t, th, user, sourceSession.Id, createAt, model.GetMillis()+60000)
			},
		},
		{
			name: "source session revoked",
			setup: func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string {
				created, _, err := th.Client.CreateMobileQRLoginToken(context.Background())
				require.NoError(t, err)
				require.Nil(t, th.App.RevokeSession(th.Context, sourceSession))
				return mobileQRTokenFromLink(t, created.Link)
			},
		},
		{
			name: "source session expired",
			setup: func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string {
				created, _, err := th.Client.CreateMobileQRLoginToken(context.Background())
				require.NoError(t, err)
				require.NoError(t, th.App.Srv().Store().Session().UpdateExpiresAt(sourceSession.Id, model.GetMillis()-1000))
				return mobileQRTokenFromLink(t, created.Link)
			},
		},
		{
			name: "source session belongs to another user",
			setup: func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string {
				_, otherSession := newSessionClient(t, th, th.BasicUser2, &model.Session{})
				return saveMobileQRToken(t, th, user, otherSession.Id, model.GetMillis(), model.GetMillis()+60000)
			},
		},
		{
			name: "source session does not exist",
			setup: func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string {
				return saveMobileQRToken(t, th, user, model.NewId(), model.GetMillis(), model.GetMillis()+60000)
			},
		},
		{
			name: "user deactivated",
			setup: func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string {
				created, _, err := th.Client.CreateMobileQRLoginToken(context.Background())
				require.NoError(t, err)
				th.UpdateActiveUser(t, user, false)
				return mobileQRTokenFromLink(t, created.Link)
			},
		},
		{
			name: "feature disabled after the code was created",
			setup: func(t *testing.T, th *TestHelper, user *model.User, sourceSession *model.Session) string {
				created, _, err := th.Client.CreateMobileQRLoginToken(context.Background())
				require.NoError(t, err)
				th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableMobileQRLogin = false })
				return mobileQRTokenFromLink(t, created.Link)
			},
		},
	}

	for _, tc := range rejectedCases {
		t.Run("redeem rejected: "+tc.name, func(t *testing.T) {
			mainHelper.Parallel(t)
			th := setupMobileQRLogin(t)

			sourceSession, appErr := th.App.GetSession(th.Client.AuthToken)
			require.Nil(t, appErr)

			code := tc.setup(t, th, th.BasicUser, sourceSession)

			mobileClient := th.CreateClient()
			_, resp, err := mobileClient.LoginWithMobileQRToken(context.Background(), code, mobileQRTestDeviceId())
			CheckErrorID(t, err, "api.user.mobile_qr_login.invalid_token.app_error")
			CheckUnauthorizedStatus(t, resp)

			sessions, err := th.App.Srv().Store().Session().GetSessions(th.Context, th.BasicUser.Id)
			require.NoError(t, err)
			for _, session := range sessions {
				assert.Empty(t, session.Props[model.SessionPropMobileQRSourceSessionId], "no mobile session should have been created")
			}
		})
	}

	t.Run("redeem rejected for a bot user", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupMobileQRLogin(t)

		bot := th.CreateBotWithSystemAdminClient(t)
		botUser, appErr := th.App.GetUser(th.Context, bot.UserId)
		require.Nil(t, appErr)
		_, botSession := newSessionClient(t, th, botUser, &model.Session{})

		code := saveMobileQRToken(t, th, botUser, botSession.Id, model.GetMillis(), model.GetMillis()+60000)
		_, resp, err := th.CreateClient().LoginWithMobileQRToken(context.Background(), code, "")
		CheckErrorID(t, err, "api.user.mobile_qr_login.invalid_token.app_error")
		CheckUnauthorizedStatus(t, resp)
	})
}
