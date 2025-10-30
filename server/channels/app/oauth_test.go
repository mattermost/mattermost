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

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })

	session, err = th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
	assert.NotNil(t, err, "should fail - oauth2 disabled")
	assert.Nil(t, session)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
	authRequest.ClientId = "junk"

	session, err = th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
	assert.NotNil(t, err, "should fail - bad client id")
	assert.Nil(t, session)

	authRequest.ClientId = oapp.Id

	session, err = th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, "junk", authRequest)
	assert.NotNil(t, err, "should fail - bad user id")
	assert.Nil(t, session)
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

				require.Nil(t, err)
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

	resp, appErr := th.App.GetOAuthAccessTokenForCodeFlow(th.Context, oapp.Id, model.AccessTokenGrantType, oapp.CallbackUrls[0], code, oapp.ClientSecret, "")
	assert.Nil(t, resp)
	require.NotNil(t, appErr, "Should not get access token")
	require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	assert.Equal(t, "api.oauth.get_access_token.expired_code.app_error", appErr.Id)
}

func TestParseOAuthStateTokenExtra(t *testing.T) {
	t.Run("valid token with normal values", func(t *testing.T) {
		email, action, cookie, err := parseOAuthStateTokenExtra("user@example.com:email_to_sso:randomcookie123")
		require.NoError(t, err)
		assert.Equal(t, "user@example.com", email)
		assert.Equal(t, "email_to_sso", action)
		assert.Equal(t, "randomcookie123", cookie)
	})

	t.Run("valid token with empty email and action", func(t *testing.T) {
		email, action, cookie, err := parseOAuthStateTokenExtra("::randomcookie123")
		require.NoError(t, err)
		assert.Equal(t, "", email)
		assert.Equal(t, "", action)
		assert.Equal(t, "randomcookie123", cookie)
	})

	t.Run("token with too many colons", func(t *testing.T) {
		_, _, _, err := parseOAuthStateTokenExtra("user@example.com:action:value:extra")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "expected exactly 3 parts")
		assert.Contains(t, err.Error(), "got 4")
	})

	t.Run("token with too few colons", func(t *testing.T) {
		_, _, _, err := parseOAuthStateTokenExtra("user@example.com:email_to_sso")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "expected exactly 3 parts")
		assert.Contains(t, err.Error(), "got 2")
	})

	t.Run("token with no colons", func(t *testing.T) {
		_, _, _, err := parseOAuthStateTokenExtra("invalidtoken")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "expected exactly 3 parts")
		assert.Contains(t, err.Error(), "got 1")
	})

	t.Run("empty token string", func(t *testing.T) {
		_, _, _, err := parseOAuthStateTokenExtra("")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "expected exactly 3 parts")
	})
}

func TestAuthorizeOAuthUser_InvalidToken(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	mockProvider := &mocks.OAuthProvider{}
	einterfaces.RegisterOAuthProvider(model.ServiceOpenid, mockProvider)

	service := model.ServiceOpenid
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableOAuthServiceProvider = true
		cfg.OpenIdSettings.Enable = model.NewPointer(true)
		cfg.OpenIdSettings.Id = model.NewPointer("test-client-id")
		cfg.OpenIdSettings.Secret = model.NewPointer("test-secret")
		cfg.OpenIdSettings.Scope = model.NewPointer(OpenIDScope)
	})

	mockProvider.On("GetSSOSettings", mock.Anything, mock.Anything, service).Return(&model.SSOSettings{
		Enable: model.NewPointer(true),
		Id:     model.NewPointer("test-client-id"),
		Secret: model.NewPointer("test-secret"),
	}, nil)

	t.Run("rejects token with extra delimiters in email field", func(t *testing.T) {
		cookieValue := model.NewId()

		invalidEmail := "user@example.com:action"
		action := "email_to_sso"

		tokenExtra := generateOAuthStateTokenExtra(invalidEmail, action, cookieValue)
		token, err := th.App.CreateOAuthStateToken(tokenExtra)
		require.Nil(t, err)

		stateProps := map[string]string{
			"token":  token.Token,
			"email":  "user@example.com",
			"action": action,
		}
		state := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(stateProps)))

		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/", nil)
		r.AddCookie(&http.Cookie{
			Name:  CookieOAuth,
			Value: "action:" + cookieValue,
		})

		_, _, _, appErr := th.App.AuthorizeOAuthUser(th.Context, w, r, service, "auth-code", state, "http://localhost/callback")

		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", appErr.Id)
	})

	t.Run("rejects token with mismatched email", func(t *testing.T) {
		cookieValue := model.NewId()
		action := "email_to_sso"

		tokenExtra := generateOAuthStateTokenExtra("token@example.com", action, cookieValue)
		token, err := th.App.CreateOAuthStateToken(tokenExtra)
		require.Nil(t, err)

		stateProps := map[string]string{
			"token":  token.Token,
			"email":  "state@example.com",
			"action": action,
		}
		state := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(stateProps)))

		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/", nil)
		r.AddCookie(&http.Cookie{
			Name:  CookieOAuth,
			Value: cookieValue,
		})

		_, _, _, appErr := th.App.AuthorizeOAuthUser(th.Context, w, r, service, "auth-code", state, "http://localhost/callback")

		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", appErr.Id)
	})

	t.Run("rejects token with mismatched action", func(t *testing.T) {
		cookieValue := model.NewId()
		email := "user@example.com"

		tokenExtra := generateOAuthStateTokenExtra(email, "email_to_sso", cookieValue)
		token, err := th.App.CreateOAuthStateToken(tokenExtra)
		require.Nil(t, err)

		stateProps := map[string]string{
			"token":  token.Token,
			"email":  email,
			"action": "sso_to_email",
		}
		state := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(stateProps)))

		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/", nil)
		r.AddCookie(&http.Cookie{
			Name:  CookieOAuth,
			Value: cookieValue,
		})

		_, _, _, appErr := th.App.AuthorizeOAuthUser(th.Context, w, r, service, "auth-code", state, "http://localhost/callback")

		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", appErr.Id)
	})

	t.Run("rejects token with mismatched cookie", func(t *testing.T) {
		email := "user@example.com"
		action := "email_to_sso"

		tokenExtra := generateOAuthStateTokenExtra(email, action, "token-cookie-value")
		token, err := th.App.CreateOAuthStateToken(tokenExtra)
		require.Nil(t, err)

		stateProps := map[string]string{
			"token":  token.Token,
			"email":  email,
			"action": action,
		}
		state := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(stateProps)))

		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/", nil)
		r.AddCookie(&http.Cookie{
			Name:  CookieOAuth,
			Value: "different-cookie-value",
		})

		_, _, _, appErr := th.App.AuthorizeOAuthUser(th.Context, w, r, service, "auth-code", state, "http://localhost/callback")

		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", appErr.Id)
	})
}
