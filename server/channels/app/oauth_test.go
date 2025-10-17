// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestGetOAuthAccessTokenForImplicitFlow(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("BasicFlow_Success", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

		oapp := &model.OAuthApp{
			Name:         "fakeoauthapp" + model.NewRandomString(10),
			CreatorId:    th.BasicUser2.Id,
			Homepage:     "https://nowhere.com",
			Description:  "test",
			CallbackUrls: []string{"https://nowhere.com"},
		}

		oapp, err := th.App.CreateOAuthApp(oapp)
		require.Nil(t, err)

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.ImplicitResponseType,
			ClientId:     oapp.Id,
			RedirectURI:  oapp.CallbackUrls[0],
			Scope:        "",
			State:        "123",
		}

		session, err := th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
		assert.Nil(t, err)
		assert.NotNil(t, session)
	})

	t.Run("OAuthDisabled_ShouldFail", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

		oapp := &model.OAuthApp{
			Name:         "fakeoauthapp" + model.NewRandomString(10),
			CreatorId:    th.BasicUser2.Id,
			Homepage:     "https://nowhere.com",
			Description:  "test",
			CallbackUrls: []string{"https://nowhere.com"},
		}

		oapp, err := th.App.CreateOAuthApp(oapp)
		require.Nil(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.ImplicitResponseType,
			ClientId:     oapp.Id,
			RedirectURI:  oapp.CallbackUrls[0],
			Scope:        "",
			State:        "123",
		}

		session, err := th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
		assert.NotNil(t, err)
		assert.Nil(t, session)
	})

	t.Run("BadClientId_ShouldFail", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.ImplicitResponseType,
			ClientId:     "invalid_client_id",
			RedirectURI:  "https://nowhere.com",
			Scope:        "",
			State:        "123",
		}

		session, err := th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
		assert.NotNil(t, err)
		assert.Nil(t, session)
	})

	t.Run("BadUserId_ShouldFail", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

		oapp := &model.OAuthApp{
			Name:         "fakeoauthapp" + model.NewRandomString(10),
			CreatorId:    th.BasicUser2.Id,
			Homepage:     "https://nowhere.com",
			Description:  "test",
			CallbackUrls: []string{"https://nowhere.com"},
		}

		oapp, err := th.App.CreateOAuthApp(oapp)
		require.Nil(t, err)

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.ImplicitResponseType,
			ClientId:     oapp.Id,
			RedirectURI:  oapp.CallbackUrls[0],
			Scope:        "",
			State:        "123",
		}

		session, err := th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, "invalid_user_id", authRequest)
		assert.NotNil(t, err)
		assert.Nil(t, session)
	})

	t.Run("PublicClient_Success", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

		dcrRequest := &model.ClientRegistrationRequest{
			ClientName:              model.NewPointer("Public Client Test"),
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
			ClientURI:               model.NewPointer("https://example.com"),
		}

		publicApp, appErr := th.App.RegisterOAuthClient(th.Context, dcrRequest, th.BasicUser2.Id)
		require.Nil(t, appErr)
		require.Empty(t, publicApp.ClientSecret)

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.ImplicitResponseType,
			ClientId:     publicApp.Id,
			RedirectURI:  publicApp.CallbackUrls[0],
			Scope:        "user",
			State:        "test_state",
		}

		session, appErr := th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
		require.Nil(t, appErr)
		require.NotNil(t, session)
		require.NotEmpty(t, session.Token)
		require.Equal(t, th.BasicUser.Id, session.UserId)
		require.True(t, session.IsOAuth)

		redirectURL, appErr := th.App.GetOAuthImplicitRedirect(th.Context, th.BasicUser.Id, authRequest)
		require.Nil(t, appErr)
		require.Contains(t, redirectURL, "#access_token=")
		require.Contains(t, redirectURL, "token_type=bearer")
		require.Contains(t, redirectURL, "state=test_state")
	})

	t.Run("ConfidentialClient_Success", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

		confidentialApp := &model.OAuthApp{
			Name:         "Confidential Client Test",
			CreatorId:    th.BasicUser2.Id,
			Homepage:     "https://example.com",
			Description:  "test confidential client",
			CallbackUrls: []string{"https://example.com/callback"},
			ClientSecret: model.NewId(),
		}

		confidentialApp, appErr := th.App.CreateOAuthApp(confidentialApp)
		require.Nil(t, appErr)
		require.NotEmpty(t, confidentialApp.ClientSecret)

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.ImplicitResponseType,
			ClientId:     confidentialApp.Id,
			RedirectURI:  confidentialApp.CallbackUrls[0],
			Scope:        "user",
			State:        "test_state",
		}

		session, appErr := th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
		require.Nil(t, appErr)
		require.NotNil(t, session)
		require.NotEmpty(t, session.Token)
		require.Equal(t, th.BasicUser.Id, session.UserId)
		require.True(t, session.IsOAuth)
	})
}

func TestOAuthRevokeAccessToken(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.SystemUserRoleId
	th.App.SetSessionExpireInHours(session, 24)

	session, err := th.App.CreateSession(th.Context, session)
	require.Nil(t, err)
	err = th.App.RevokeAccessToken(th.Context, session.Token)
	require.NotNil(t, err, "Should have failed does not have an access token")
	require.Equal(t, http.StatusBadRequest, err.StatusCode)
}

func TestOAuthDeleteApp(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	*th.App.Config().ServiceSettings.EnableOAuthServiceProvider = true

	a1 := &model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"

	a1, appErr := th.App.CreateOAuthApp(a1)
	require.Nil(t, appErr)

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.SystemUserRoleId
	session.IsOAuth = true
	th.App.ch.srv.platform.SetSessionExpireInHours(session, 24)

	session, appErr = th.App.CreateSession(th.Context, session)
	require.Nil(t, appErr)

	accessData := &model.AccessData{}
	accessData.Token = session.Token
	accessData.UserId = session.UserId
	accessData.RedirectUri = "http://example.com"
	accessData.ClientId = a1.Id
	accessData.ExpiresAt = session.ExpiresAt

	_, err := th.App.Srv().Store().OAuth().SaveAccessData(accessData)
	require.NoError(t, err)

	appErr = th.App.DeleteOAuthApp(th.Context, a1.Id)
	require.Nil(t, appErr)

	_, appErr = th.App.GetSession(session.Token)
	require.NotNil(t, appErr, "should not get session from cache or db")
}

func TestAuthorizeOAuthUser(t *testing.T) {
	mainHelper.Parallel(t)
	setup := func(t *testing.T, enable, tokenEndpoint, userEndpoint bool, serverURL string) *TestHelper {
		mainHelper.Parallel(t)

		th := Setup(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.GitLabSettings.Enable = enable

			if tokenEndpoint {
				*cfg.GitLabSettings.TokenEndpoint = serverURL + "/token"
			} else {
				*cfg.GitLabSettings.TokenEndpoint = ""
			}

			if userEndpoint {
				*cfg.GitLabSettings.UserAPIEndpoint = serverURL + "/user"
			} else {
				*cfg.GitLabSettings.UserAPIEndpoint = ""
			}
		})

		return th
	}

	makeState := func(token *model.Token) string {
		return base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(map[string]string{
			"token": token.Token,
		})))
	}

	makeToken := func(th *TestHelper, cookie string) *model.Token {
		token, appErr := th.App.CreateOAuthStateToken(generateOAuthStateTokenExtra("", "", cookie))
		require.Nil(t, appErr)
		return token
	}

	makeRequest := func(cookie string) *http.Request {
		request, err := http.NewRequest(http.MethodGet, "https://mattermost.example.com", nil)
		require.NoError(t, err)

		if cookie != "" {
			request.AddCookie(&http.Cookie{
				Name:  CookieOAuth,
				Value: cookie,
			})
		}

		return request
	}

	t.Run("not enabled", func(t *testing.T) {
		th := setup(t, false, true, true, "")
		defer th.TearDown()

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", "", "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.unsupported.app_error", err.Id)
	})

	t.Run("with an improperly encoded state", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		state := "!"

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", err.Id)
	})

	t.Run("without a stored token", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		state := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(map[string]string{
			"token": model.NewId(),
		})))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.oauth.invalid_state_token.app_error", err.Id)
		assert.Error(t, err.Unwrap())
	})

	t.Run("with a stored token of the wrong type", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		token := model.NewToken("invalid", "")
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		state := makeState(token)

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.oauth.invalid_state_token.app_error", err.Id)
		assert.Equal(t, "", err.DetailedError)
	})

	t.Run("with email missing when changing login types", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		email := ""
		action := model.OAuthActionEmailToSSO
		cookie := model.NewId()

		token, err := th.App.CreateOAuthStateToken(generateOAuthStateTokenExtra(email, action, cookie))
		require.Nil(t, err)

		state := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(map[string]string{
			"action": action,
			"email":  email,
			"token":  token.Token,
		})))

		_, _, _, err = th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", err.Id)
	})

	t.Run("without an OAuth cookie", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest("")
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", err.Id)
	})

	t.Run("with an invalid token", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		cookie := model.NewId()

		token, err := th.App.CreateOAuthStateToken(model.NewId())
		require.Nil(t, err)

		request := makeRequest(cookie)
		state := makeState(token)

		_, _, _, err = th.App.AuthorizeOAuthUser(th.Context, nil, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", err.Id)
	})

	t.Run("with an incorrect token endpoint", func(t *testing.T) {
		th := setup(t, true, false, true, "")
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.token_failed.app_error", err.Id)
	})

	t.Run("with an error token response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTeapot)
		}))
		defer server.Close()

		th := setup(t, true, true, true, server.URL)
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.bad_response.app_error", err.Id)
		assert.Contains(t, err.DetailedError, "status_code=418")
	})

	t.Run("with an invalid token response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, err := w.Write([]byte("invalid"))
			require.NoError(t, err)
		}))
		defer server.Close()

		th := setup(t, true, true, true, server.URL)
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.bad_response.app_error", err.Id)
		assert.Contains(t, err.DetailedError, "response_body=invalid")
	})

	t.Run("with an invalid token type", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			err := json.NewEncoder(w).Encode(&model.AccessResponse{
				AccessToken: model.NewId(),
				TokenType:   "",
			})
			require.NoError(t, err)
		}))
		defer server.Close()

		th := setup(t, true, true, true, server.URL)
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.bad_token.app_error", err.Id)
	})

	t.Run("with an empty token response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			err := json.NewEncoder(w).Encode(&model.AccessResponse{
				AccessToken: "",
				TokenType:   model.AccessTokenType,
			})
			require.NoError(t, err)
		}))
		defer server.Close()

		th := setup(t, true, true, true, server.URL)
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.missing.app_error", err.Id)
	})

	t.Run("with an incorrect user endpoint", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			err := json.NewEncoder(w).Encode(&model.AccessResponse{
				AccessToken: model.NewId(),
				TokenType:   model.AccessTokenType,
			})
			require.NoError(t, err)
		}))
		defer server.Close()

		th := setup(t, true, true, false, server.URL)
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.service.app_error", err.Id)
	})

	t.Run("with an error user response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/token":
				t.Log("hit token")
				err := json.NewEncoder(w).Encode(&model.AccessResponse{
					AccessToken: model.NewId(),
					TokenType:   model.AccessTokenType,
				})
				require.NoError(t, err)
			case "/user":
				t.Log("hit user")
				w.WriteHeader(http.StatusTeapot)
			}
		}))
		defer server.Close()

		th := setup(t, true, true, true, server.URL)
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.response.app_error", err.Id)
	})

	t.Run("with an error user response due to GitLab TOS", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/token":
				t.Log("hit token")
				err := json.NewEncoder(w).Encode(&model.AccessResponse{
					AccessToken: model.NewId(),
					TokenType:   model.AccessTokenType,
				})
				require.NoError(t, err)
			case "/user":
				t.Log("hit user")
				w.WriteHeader(http.StatusForbidden)
				_, err := w.Write([]byte("Terms of Service"))
				require.NoError(t, err)
			}
		}))
		defer server.Close()

		th := setup(t, true, true, true, server.URL)
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "oauth.gitlab.tos.error", err.Id)
	})

	t.Run("with error in GetSSOSettings", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.OpenIdSettings.Enable = true
		})

		providerMock := &mocks.OAuthProvider{}
		providerMock.On("GetSSOSettings", mock.AnythingOfType("*request.Context"), mock.Anything, model.ServiceOpenid).Return(nil, errors.New("error"))
		einterfaces.RegisterOAuthProvider(model.ServiceOpenid, providerMock)

		_, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceOpenid, "", "", "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.get_authorization_code.endpoint.app_error", err.Id)
	})

	t.Run("enabled and properly configured", func(t *testing.T) {
		testCases := []struct {
			Description                   string
			SiteURL                       string
			ExpectedSetCookieHeaderRegexp string
		}{
			{"no subpath", "http://localhost:8065", "^MMOAUTH=; Path=/"},
			{"subpath", "http://localhost:8065/subpath", "^MMOAUTH=; Path=/subpath"},
		}

		for _, tc := range testCases {
			t.Run(tc.Description, func(t *testing.T) {
				userData := "Hello, World!"

				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					switch r.URL.Path {
					case "/token":
						err := json.NewEncoder(w).Encode(&model.AccessResponse{
							AccessToken: model.NewId(),
							TokenType:   model.AccessTokenType,
						})
						require.NoError(t, err)
					case "/user":
						w.WriteHeader(http.StatusOK)
						_, err := w.Write([]byte(userData))
						require.NoError(t, err)
					}
				}))
				defer server.Close()

				th := setup(t, true, true, true, server.URL)
				defer th.TearDown()

				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ServiceSettings.SiteURL = tc.SiteURL
				})

				cookie := model.NewId()
				request := makeRequest(cookie)

				stateProps := map[string]string{
					"team_id": model.NewId(),
					"token":   makeToken(th, cookie).Token,
				}
				state := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(stateProps)))

				recorder := httptest.ResponseRecorder{}
				body, receivedStateProps, _, err := th.App.AuthorizeOAuthUser(th.Context, &recorder, request, model.ServiceGitlab, "", state, "")

				require.NotNil(t, body)
				bodyBytes, bodyErr := io.ReadAll(body)
				require.NoError(t, bodyErr)
				assert.Equal(t, userData, string(bodyBytes))

				// team_id is no longer returned as it was removed for security reasons
				assert.Equal(t, stateProps, receivedStateProps)
				assert.Nil(t, err)

				cookies := recorder.Header().Get("Set-Cookie")
				assert.Regexp(t, tc.ExpectedSetCookieHeaderRegexp, cookies)
			})
		}
	})
}

func TestGetAuthorizationCode(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("not enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.GitLabSettings.Enable = false
		})

		_, err := th.App.GetAuthorizationCode(th.Context, nil, nil, model.ServiceGitlab, map[string]string{}, "")
		require.NotNil(t, err)

		assert.Equal(t, "api.user.authorize_oauth_user.unsupported.app_error", err.Id)
	})

	t.Run("enabled and properly configured", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.GitLabSettings.Enable = true
		})

		testCases := []struct {
			Description                   string
			SiteURL                       string
			ExpectedSetCookieHeaderRegexp string
		}{
			{"no subpath", "http://localhost:8065", "^MMOAUTH=[a-z0-9]+; Path=/"},
			{"subpath", "http://localhost:8065/subpath", "^MMOAUTH=[a-z0-9]+; Path=/subpath"},
		}

		for _, tc := range testCases {
			t.Run(tc.Description, func(t *testing.T) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ServiceSettings.SiteURL = tc.SiteURL
				})

				request, _ := http.NewRequest(http.MethodGet, "https://mattermost.example.com", nil)

				stateProps := map[string]string{
					"email":  "email@example.com",
					"action": "action",
				}

				recorder := httptest.ResponseRecorder{}
				url, err := th.App.GetAuthorizationCode(th.Context, &recorder, request, model.ServiceGitlab, stateProps, "")
				require.Nil(t, err)
				assert.NotEmpty(t, url)

				cookies := recorder.Header().Get("Set-Cookie")
				assert.Regexp(t, tc.ExpectedSetCookieHeaderRegexp, cookies)
			})
		}
	})
}

func TestDeauthorizeOAuthApp(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{
		Name:         "fakeoauthapp" + model.NewRandomString(10),
		CreatorId:    th.BasicUser2.Id,
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://nowhere.com"},
	}

	oapp, appErr := th.App.CreateOAuthApp(oapp)
	require.Nil(t, appErr)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.ImplicitResponseType,
		ClientId:     oapp.Id,
		RedirectURI:  oapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	redirectUrl, appErr := th.App.GetOAuthCodeRedirect(th.BasicUser.Id, authRequest)
	assert.Nil(t, appErr)

	dErr := th.App.DeauthorizeOAuthAppForUser(th.Context, th.BasicUser.Id, oapp.Id)
	assert.Nil(t, dErr)

	uri, uErr := url.Parse(redirectUrl)
	require.NoError(t, uErr)

	queryParams := uri.Query()
	code := queryParams.Get("code")

	data, err := th.App.Srv().Store().OAuth().GetAuthData(code)
	require.Equal(t, store.NewErrNotFound("AuthData", fmt.Sprintf("code=%s", code)), err)
	assert.Nil(t, data)
}

func TestDeactivatedUserOAuthApp(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{
		Name:         "fakeoauthapp" + model.NewRandomString(10),
		CreatorId:    th.BasicUser2.Id,
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://nowhere.com"},
	}

	oapp, appErr := th.App.CreateOAuthApp(oapp)
	require.Nil(t, appErr)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.ImplicitResponseType,
		ClientId:     oapp.Id,
		RedirectURI:  oapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	redirectUrl, appErr := th.App.GetOAuthCodeRedirect(th.BasicUser.Id, authRequest)
	assert.Nil(t, appErr)

	uri, err := url.Parse(redirectUrl)
	require.NoError(t, err)

	queryParams := uri.Query()
	code := queryParams.Get("code")

	_, appErr = th.App.UpdateActive(th.Context, th.BasicUser, false)
	require.Nil(t, appErr)

	resp, appErr := th.App.GetOAuthAccessTokenForCodeFlow(th.Context, oapp.Id, model.AccessTokenGrantType, oapp.CallbackUrls[0], code, oapp.ClientSecret, "", "", "")
	assert.Nil(t, resp)
	require.NotNil(t, appErr, "Should not get access token")
	require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	assert.Equal(t, "api.oauth.get_access_token.expired_code.app_error", appErr.Id)
}

func TestRegisterOAuthClient(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableOAuthServiceProvider = true
	})

	t.Run("Valid DCR request with client_uri", func(t *testing.T) {
		request := &model.ClientRegistrationRequest{
			RedirectURIs: []string{"https://example.com/callback/" + model.NewId()},
			ClientName:   model.NewPointer("Test Client"),
			ClientURI:    model.NewPointer("https://example.com"),
		}

		app, appErr := th.App.RegisterOAuthClient(th.Context, request, th.BasicUser.Id)

		require.Nil(t, appErr)
		require.NotNil(t, app)
		assert.Equal(t, request.RedirectURIs, []string(app.CallbackUrls))
		assert.True(t, app.IsDynamicallyRegistered)
		assert.Equal(t, th.BasicUser.Id, app.CreatorId)
		assert.NotEmpty(t, app.Id)
		assert.NotEmpty(t, app.ClientSecret)
		assert.Equal(t, "https://example.com", app.Homepage) // client_uri is mapped to homepage
	})

	t.Run("Valid DCR request without client_uri", func(t *testing.T) {
		request := &model.ClientRegistrationRequest{
			RedirectURIs: []string{"https://example.com/callback/" + model.NewId()},
			ClientName:   model.NewPointer("Test Client"),
		}

		app, appErr := th.App.RegisterOAuthClient(th.Context, request, th.BasicUser.Id)

		require.Nil(t, appErr)
		require.NotNil(t, app)
		assert.Equal(t, request.RedirectURIs, []string(app.CallbackUrls))
		assert.True(t, app.IsDynamicallyRegistered)
		assert.Equal(t, th.BasicUser.Id, app.CreatorId)
		assert.NotEmpty(t, app.Id)
		assert.NotEmpty(t, app.ClientSecret)
		assert.Equal(t, "", app.Homepage) // Homepage is empty when client_uri is not provided
	})

	t.Run("Invalid client_uri", func(t *testing.T) {
		request := &model.ClientRegistrationRequest{
			RedirectURIs: []string{"https://example.com/callback/" + model.NewId()},
			ClientName:   model.NewPointer("Test Client"),
			ClientURI:    model.NewPointer("invalid-url"),
		}

		_, appErr := th.App.RegisterOAuthClient(th.Context, request, th.BasicUser.Id)

		require.NotNil(t, appErr)
		assert.Equal(t, "model.oauth.is_valid.homepage.app_error", appErr.Id)
	})

	t.Run("PublicClient_Success", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(true)
		})

		dcrRequest := &model.ClientRegistrationRequest{
			RedirectURIs:            []string{"https://example.com/callback"},
			ClientName:              model.NewPointer("Test Public Client"),
			TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
		}

		registeredApp, appErr := th.App.RegisterOAuthClient(th.Context, dcrRequest, "")
		require.Nil(t, appErr)
		require.NotNil(t, registeredApp)

		require.Empty(t, registeredApp.ClientSecret)
		require.True(t, registeredApp.IsPublicClient())
		require.Equal(t, model.ClientAuthMethodNone, registeredApp.GetTokenEndpointAuthMethod())
		require.True(t, registeredApp.IsDynamicallyRegistered)
	})
}

func TestGetAuthorizationServerMetadata_DCRConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Enable OAuth service provider and set SiteURL
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableOAuthServiceProvider = model.NewPointer(true)
		cfg.ServiceSettings.SiteURL = model.NewPointer("https://example.com")
	})

	t.Run("DCR disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(false)
		})

		metadata, err := th.App.GetAuthorizationServerMetadata(th.Context)
		require.Nil(t, err)
		require.NotNil(t, metadata)

		// Should not include registration endpoint when DCR is disabled
		assert.Empty(t, metadata.RegistrationEndpoint)

		// Should include basic OAuth endpoints
		assert.Equal(t, "https://example.com", metadata.Issuer)
		assert.Equal(t, "https://example.com/oauth/authorize", metadata.AuthorizationEndpoint)
		assert.Equal(t, "https://example.com/oauth/access_token", metadata.TokenEndpoint)
	})

	t.Run("DCR enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(true)
		})

		metadata, err := th.App.GetAuthorizationServerMetadata(th.Context)
		require.Nil(t, err)
		require.NotNil(t, metadata)

		// Should include registration endpoint when DCR is enabled
		assert.Equal(t, "https://example.com/api/v4/oauth/apps/register", metadata.RegistrationEndpoint)

		// Should include basic OAuth endpoints
		assert.Equal(t, "https://example.com", metadata.Issuer)
		assert.Equal(t, "https://example.com/oauth/authorize", metadata.AuthorizationEndpoint)
		assert.Equal(t, "https://example.com/oauth/access_token", metadata.TokenEndpoint)
	})
}

func TestGetOAuthAccessTokenForCodeFlow(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Helper function to create a confidential OAuth app
	createConfidentialOAuthApp := func(name string) *model.OAuthApp {
		oapp := &model.OAuthApp{
			Name:         name + model.NewRandomString(10),
			CreatorId:    th.BasicUser2.Id,
			Homepage:     "https://nowhere.com",
			Description:  "test",
			CallbackUrls: []string{"https://example.com/callback"},
		}
		oapp, err := th.App.CreateOAuthApp(oapp)
		require.Nil(t, err)
		return oapp
	}

	// Helper function to get authorization code
	getAuthorizationCode := func(app *model.OAuthApp, resource string) string {
		authRequest := &model.AuthorizeRequest{
			ResponseType: model.AuthCodeResponseType,
			ClientId:     app.Id,
			RedirectURI:  app.CallbackUrls[0],
			Scope:        "user",
			State:        "test_state",
			Resource:     resource,
		}

		redirectURI, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		require.Nil(t, appErr)

		uri, urlErr := url.Parse(redirectURI)
		require.NoError(t, urlErr)
		code := uri.Query().Get("code")
		require.NotEmpty(t, code)
		return code
	}

	t.Run("PublicClient_WithPKCE_Success", func(t *testing.T) {
		dcrRequest := &model.ClientRegistrationRequest{
			ClientName:              model.NewPointer("Public Client Test"),
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
			ClientURI:               model.NewPointer("https://example.com"),
		}

		publicApp, appErr := th.App.RegisterOAuthClient(th.Context, dcrRequest, th.BasicUser2.Id)
		require.Nil(t, appErr)
		require.Empty(t, publicApp.ClientSecret)

		codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
		codeChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
		codeChallengeMethod := model.PKCECodeChallengeMethodS256

		authRequest := &model.AuthorizeRequest{
			ResponseType:        model.ResponseTypeCode,
			ClientId:            publicApp.Id,
			RedirectURI:         publicApp.CallbackUrls[0],
			Scope:               "user",
			State:               "test_state",
			CodeChallenge:       codeChallenge,
			CodeChallengeMethod: codeChallengeMethod,
		}

		redirectURL, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		require.Nil(t, appErr)

		uri, err := url.Parse(redirectURL)
		require.NoError(t, err)
		code := uri.Query().Get("code")
		require.NotEmpty(t, code)

		accessResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
			th.Context,
			publicApp.Id,
			model.AccessTokenGrantType,
			authRequest.RedirectURI,
			code,
			"",
			"",
			codeVerifier,
			"",
		)

		require.Nil(t, appErr)
		require.NotNil(t, accessResponse)
		require.NotEmpty(t, accessResponse.AccessToken)
		require.Equal(t, model.AccessTokenType, accessResponse.TokenType)
		require.Empty(t, accessResponse.RefreshToken)
	})

	t.Run("PublicClient_WithoutPKCE_ShouldFail", func(t *testing.T) {
		dcrRequest := &model.ClientRegistrationRequest{
			ClientName:              model.NewPointer("Public Client Test"),
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
			ClientURI:               model.NewPointer("https://example.com"),
		}

		publicApp, appErr := th.App.RegisterOAuthClient(th.Context, dcrRequest, th.BasicUser2.Id)
		require.Nil(t, appErr)

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.ResponseTypeCode,
			ClientId:     publicApp.Id,
			RedirectURI:  publicApp.CallbackUrls[0],
			Scope:        "user",
			State:        "test_state",
		}

		_, appErr = th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "pkce_required")
	})

	t.Run("ConfidentialClient_WithPKCE_Success", func(t *testing.T) {
		confidentialApp := &model.OAuthApp{
			Name:         "Confidential Client Test",
			CreatorId:    th.BasicUser2.Id,
			Homepage:     "https://example.com",
			Description:  "test confidential client",
			CallbackUrls: []string{"https://example.com/callback"},
			ClientSecret: model.NewId(),
		}

		confidentialApp, appErr := th.App.CreateOAuthApp(confidentialApp)
		require.Nil(t, appErr)
		require.NotEmpty(t, confidentialApp.ClientSecret)

		codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
		codeChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
		codeChallengeMethod := model.PKCECodeChallengeMethodS256

		authRequest := &model.AuthorizeRequest{
			ResponseType:        model.ResponseTypeCode,
			ClientId:            confidentialApp.Id,
			RedirectURI:         confidentialApp.CallbackUrls[0],
			Scope:               "user",
			State:               "test_state",
			CodeChallenge:       codeChallenge,
			CodeChallengeMethod: codeChallengeMethod,
		}

		redirectURL, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		require.Nil(t, appErr)

		uri, err := url.Parse(redirectURL)
		require.NoError(t, err)
		code := uri.Query().Get("code")
		require.NotEmpty(t, code)

		accessResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
			th.Context,
			confidentialApp.Id,
			model.AccessTokenGrantType,
			authRequest.RedirectURI,
			code,
			confidentialApp.ClientSecret,
			"",
			codeVerifier,
			"",
		)

		require.Nil(t, appErr)
		require.NotNil(t, accessResponse)
		require.NotEmpty(t, accessResponse.AccessToken)
		require.Equal(t, model.AccessTokenType, accessResponse.TokenType)
		require.NotEmpty(t, accessResponse.RefreshToken)
	})

	t.Run("ConfidentialClient_WithoutPKCE_Success", func(t *testing.T) {
		confidentialApp := &model.OAuthApp{
			Name:         "Confidential Client Test",
			CreatorId:    th.BasicUser2.Id,
			Homepage:     "https://example.com",
			Description:  "test confidential client",
			CallbackUrls: []string{"https://example.com/callback"},
			ClientSecret: model.NewId(),
		}

		confidentialApp, appErr := th.App.CreateOAuthApp(confidentialApp)
		require.Nil(t, appErr)

		authRequest := &model.AuthorizeRequest{
			ResponseType: model.ResponseTypeCode,
			ClientId:     confidentialApp.Id,
			RedirectURI:  confidentialApp.CallbackUrls[0],
			Scope:        "user",
			State:        "test_state",
		}

		redirectURL, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		require.Nil(t, appErr)

		uri, err := url.Parse(redirectURL)
		require.NoError(t, err)
		code := uri.Query().Get("code")
		require.NotEmpty(t, code)

		accessResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
			th.Context,
			confidentialApp.Id,
			model.AccessTokenGrantType,
			authRequest.RedirectURI,
			code,
			confidentialApp.ClientSecret,
			"",
			"",
			"",
		)

		require.Nil(t, appErr)
		require.NotNil(t, accessResponse)
		require.NotEmpty(t, accessResponse.AccessToken)
		require.Equal(t, model.AccessTokenType, accessResponse.TokenType)
		require.NotEmpty(t, accessResponse.RefreshToken)
	})

	t.Run("ConfidentialClient_PKCEEnforcement", func(t *testing.T) {
		confidentialApp := &model.OAuthApp{
			Name:         "Confidential Client Test",
			CreatorId:    th.BasicUser2.Id,
			Homepage:     "https://example.com",
			Description:  "test confidential client",
			CallbackUrls: []string{"https://example.com/callback"},
			ClientSecret: model.NewId(),
		}

		confidentialApp, appErr := th.App.CreateOAuthApp(confidentialApp)
		require.Nil(t, appErr)

		codeChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
		codeChallengeMethod := model.PKCECodeChallengeMethodS256

		authRequest := &model.AuthorizeRequest{
			ResponseType:        model.ResponseTypeCode,
			ClientId:            confidentialApp.Id,
			RedirectURI:         confidentialApp.CallbackUrls[0],
			Scope:               "user",
			State:               "test_state",
			CodeChallenge:       codeChallenge,
			CodeChallengeMethod: codeChallengeMethod,
		}

		redirectURL, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		require.Nil(t, appErr)

		uri, err := url.Parse(redirectURL)
		require.NoError(t, err)
		code := uri.Query().Get("code")
		require.NotEmpty(t, code)

		_, appErr = th.App.GetOAuthAccessTokenForCodeFlow(
			th.Context,
			confidentialApp.Id,
			model.AccessTokenGrantType,
			authRequest.RedirectURI,
			code,
			confidentialApp.ClientSecret,
			"",
			"",
			"",
		)

		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "pkce")
	})

	t.Run("PublicClient_NoRefreshToken", func(t *testing.T) {
		dcrRequest := &model.ClientRegistrationRequest{
			ClientName:              model.NewPointer("Public Client Test"),
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
			ClientURI:               model.NewPointer("https://example.com"),
		}

		publicApp, appErr := th.App.RegisterOAuthClient(th.Context, dcrRequest, th.BasicUser2.Id)
		require.Nil(t, appErr)

		_, appErr = th.App.GetOAuthAccessTokenForCodeFlow(
			th.Context,
			publicApp.Id,
			model.RefreshTokenGrantType,
			"https://example.com/callback",
			"",
			"",
			"some_fake_refresh_token",
			"",
			"",
		)

		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "public_client_refresh_token.app_error")
	})

	t.Run("WithResourceParameter_Success", func(t *testing.T) {
		oapp := createConfidentialOAuthApp("TestResourceApp")
		resourceParam := "https://api.example.com/resource"
		code := getAuthorizationCode(oapp, resourceParam)

		accessResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
			th.Context,
			oapp.Id,
			model.AccessTokenGrantType,
			oapp.CallbackUrls[0],
			code,
			oapp.ClientSecret,
			"",
			"",
			resourceParam,
		)

		require.Nil(t, appErr)
		require.NotNil(t, accessResponse)
		require.NotEmpty(t, accessResponse.AccessToken)
		require.Equal(t, model.AccessTokenType, accessResponse.TokenType)
		require.Equal(t, resourceParam, accessResponse.Audience)
	})

	t.Run("ResourceParameterValidation", func(t *testing.T) {
		oapp := createConfidentialOAuthApp("TestResourceValidationApp")

		t.Run("Invalid resource parameter should fail", func(t *testing.T) {
			code := getAuthorizationCode(oapp, "")

			_, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
				th.Context,
				oapp.Id,
				model.AccessTokenGrantType,
				oapp.CallbackUrls[0],
				code,
				oapp.ClientSecret,
				"",
				"",
				"invalid-resource-uri",
			)

			require.NotNil(t, appErr)
			require.Contains(t, appErr.Id, "resource")
		})

		t.Run("Resource with fragment should fail", func(t *testing.T) {
			code := getAuthorizationCode(oapp, "")

			_, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
				th.Context,
				oapp.Id,
				model.AccessTokenGrantType,
				oapp.CallbackUrls[0],
				code,
				oapp.ClientSecret,
				"",
				"",
				"https://api.example.com/resource#fragment",
			)

			require.NotNil(t, appErr)
			require.Contains(t, appErr.Id, "resource")
		})
	})

	t.Run("RefreshTokenWithResource", func(t *testing.T) {
		oapp := createConfidentialOAuthApp("TestRefreshResourceApp")
		resourceParam := "https://api.example.com/resource"

		t.Run("Refresh token with matching resource should succeed", func(t *testing.T) {
			code := getAuthorizationCode(oapp, resourceParam)

			// Get initial access token
			initialResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
				th.Context,
				oapp.Id,
				model.AccessTokenGrantType,
				oapp.CallbackUrls[0],
				code,
				oapp.ClientSecret,
				"",
				"",
				resourceParam,
			)
			require.Nil(t, appErr)
			require.NotEmpty(t, initialResponse.RefreshToken)

			refreshResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
				th.Context,
				oapp.Id,
				model.RefreshTokenGrantType,
				oapp.CallbackUrls[0],
				"",
				oapp.ClientSecret,
				initialResponse.RefreshToken,
				"",
				resourceParam,
			)

			require.Nil(t, appErr)
			require.NotNil(t, refreshResponse)
			require.Equal(t, resourceParam, refreshResponse.Audience)
		})

		t.Run("Refresh token with mismatched resource should fail", func(t *testing.T) {
			code := getAuthorizationCode(oapp, resourceParam)

			// Get initial access token with original resource
			initialResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
				th.Context,
				oapp.Id,
				model.AccessTokenGrantType,
				oapp.CallbackUrls[0],
				code,
				oapp.ClientSecret,
				"",
				"",
				resourceParam,
			)
			require.Nil(t, appErr)
			require.NotEmpty(t, initialResponse.RefreshToken)

			// Try to refresh with different resource - should fail
			_, appErr = th.App.GetOAuthAccessTokenForCodeFlow(
				th.Context,
				oapp.Id,
				model.RefreshTokenGrantType,
				oapp.CallbackUrls[0],
				"",
				oapp.ClientSecret,
				initialResponse.RefreshToken,
				"",
				"https://different.api.com/resource",
			)

			require.NotNil(t, appErr)
			require.Contains(t, appErr.Id, "resource_mismatch")
		})
	})
}
