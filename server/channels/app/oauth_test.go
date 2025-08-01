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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", "", "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.unsupported.app_error", err.Id)
	})

	t.Run("with an improperly encoded state", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		state := "!"

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", err.Id)
	})

	t.Run("without a stored token", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		state := base64.StdEncoding.EncodeToString([]byte(model.MapToJSON(map[string]string{
			"token": model.NewId(),
		})))

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err = th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", err.Id)
	})

	t.Run("without an OAuth cookie", func(t *testing.T) {
		th := setup(t, true, true, true, "")
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest("")
		state := makeState(makeToken(th, cookie))

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err = th.App.AuthorizeOAuthUser(th.Context, nil, request, model.ServiceGitlab, "", state, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.user.authorize_oauth_user.invalid_state.app_error", err.Id)
	})

	t.Run("with an incorrect token endpoint", func(t *testing.T) {
		th := setup(t, true, false, true, "")
		defer th.TearDown()

		cookie := model.NewId()
		request := makeRequest(cookie)
		state := makeState(makeToken(th, cookie))

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, &httptest.ResponseRecorder{}, request, model.ServiceGitlab, "", state, "")
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

		_, _, _, _, err := th.App.AuthorizeOAuthUser(th.Context, nil, nil, model.ServiceOpenid, "", "", "")
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
				body, receivedTeamID, receivedStateProps, _, err := th.App.AuthorizeOAuthUser(th.Context, &recorder, request, model.ServiceGitlab, "", state, "")

				require.NotNil(t, body)
				bodyBytes, bodyErr := io.ReadAll(body)
				require.NoError(t, bodyErr)
				assert.Equal(t, userData, string(bodyBytes))

				assert.Equal(t, stateProps["team_id"], receivedTeamID)
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

	resp, appErr := th.App.GetOAuthAccessTokenForCodeFlow(th.Context, oapp.Id, model.AccessTokenGrantType, oapp.CallbackUrls[0], code, oapp.ClientSecret, "", "")
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

	// Test basic registration functionality
	t.Run("Valid DCR request with client_uri", func(t *testing.T) {
		request := &model.ClientRegistrationRequest{
			RedirectURIs: []string{"https://example.com/callback/" + model.NewId()},
			ClientName:   model.NewPointer("Test Client"),
			ClientURI:    model.NewPointer("https://example.com"),
			LogoURI:      model.NewPointer("https://example.com/logo.png"),
			Scope:        model.NewPointer("user"),
		}

		app, appErr := th.App.RegisterOAuthClient(th.Context, request, th.BasicUser.Id)

		require.Nil(t, appErr)
		require.NotNil(t, app)
		assert.Equal(t, request.RedirectURIs, []string(app.CallbackUrls))
		assert.True(t, app.IsDynamicallyRegistered)
		assert.Equal(t, th.BasicUser.Id, app.CreatorId)
		assert.NotEmpty(t, app.Id)
		assert.NotEmpty(t, app.ClientSecret)
		assert.Equal(t, "https://example.com", app.Homepage) // Should use client_uri
	})

	// Test DCR without client_uri (optional per RFC 7591)
	t.Run("Valid DCR request without client_uri", func(t *testing.T) {
		request := &model.ClientRegistrationRequest{
			RedirectURIs: []string{"https://minimal.com/callback/" + model.NewId()},
			ClientName:   model.NewPointer("Minimal Client"),
		}

		app, appErr := th.App.RegisterOAuthClient(th.Context, request, th.BasicUser.Id)

		require.Nil(t, appErr)
		require.NotNil(t, app)
		assert.Equal(t, request.RedirectURIs, []string(app.CallbackUrls))
		assert.True(t, app.IsDynamicallyRegistered)
		assert.Equal(t, th.BasicUser.Id, app.CreatorId)
		assert.NotEmpty(t, app.Id)
		assert.NotEmpty(t, app.ClientSecret)
		assert.Empty(t, app.Homepage) // Should be empty since no client_uri provided
	})

	// Test duplicate detection
	t.Run("Duplicate registration prevention", func(t *testing.T) {
		uniqueURI := "https://test-duplicate.com/callback/" + model.NewId()
		
		// Create first app
		request1 := &model.ClientRegistrationRequest{
			RedirectURIs: []string{uniqueURI},
			ClientName:   model.NewPointer("First Client"),
		}
		
		app1, appErr1 := th.App.RegisterOAuthClient(th.Context, request1, th.BasicUser.Id)
		require.Nil(t, appErr1)
		require.NotNil(t, app1)
		
		// Try to create second app with same redirect URI - should fail
		request2 := &model.ClientRegistrationRequest{
			RedirectURIs: []string{uniqueURI},
			ClientName:   model.NewPointer("Duplicate Client"),
		}
		
		app2, appErr2 := th.App.RegisterOAuthClient(th.Context, request2, th.BasicUser.Id)
		require.NotNil(t, appErr2)
		require.Nil(t, app2)
		assert.Equal(t, "app.oauth.duplicate_registration.app_error", appErr2.Id)
		assert.Equal(t, http.StatusBadRequest, appErr2.StatusCode)
	})

}

func TestCheckForDuplicateOAuthRegistration(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { 
		*cfg.ServiceSettings.EnableOAuthServiceProvider = true 
	})

	// Create existing app
	existingApp := &model.OAuthApp{
		Name:         "Existing App",
		CreatorId:    th.BasicUser.Id,
		Homepage:     "https://existing.com",
		Description:  "test",
		CallbackUrls: []string{"https://existing.com/callback1", "https://existing.com/callback2"},
	}
	existingApp, err := th.App.CreateOAuthApp(existingApp)
	require.Nil(t, err)

	testCases := []struct {
		name          string
		redirectURIs  []string
		expectError   bool
		expectedError string
	}{
		{
			name:          "No duplicate - different URIs",
			redirectURIs:  []string{"https://different.com/callback"},
			expectError:   false,
			expectedError: "",
		},
		{
			name:          "No duplicate - partial overlap",
			redirectURIs:  []string{"https://existing.com/callback1", "https://different.com/callback"},
			expectError:   false,
			expectedError: "",
		},
		{
			name:          "Duplicate - exact match",
			redirectURIs:  []string{"https://existing.com/callback1", "https://existing.com/callback2"},
			expectError:   true,
			expectedError: "app.oauth.duplicate_registration.app_error",
		},
		{
			name:          "Duplicate - same URIs different order",
			redirectURIs:  []string{"https://existing.com/callback2", "https://existing.com/callback1"},
			expectError:   true,
			expectedError: "app.oauth.duplicate_registration.app_error",
		},
		{
			name:          "No duplicate - subset",
			redirectURIs:  []string{"https://existing.com/callback1"},
			expectError:   false,
			expectedError: "",
		},
		{
			name:          "No duplicate - superset",
			redirectURIs:  []string{"https://existing.com/callback1", "https://existing.com/callback2", "https://existing.com/callback3"},
			expectError:   false,
			expectedError: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			appErr := th.App.checkForDuplicateOAuthRegistration(tc.redirectURIs)

			if tc.expectError {
				require.NotNil(t, appErr)
				assert.Equal(t, tc.expectedError, appErr.Id)
				assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
			} else {
				require.Nil(t, appErr)
			}
		})
	}
}

func TestAreRedirectURIsSame(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testCases := []struct {
		name     string
		existing []string
		new      []string
		expected bool
	}{
		{
			name:     "Identical URIs",
			existing: []string{"https://example.com/callback1", "https://example.com/callback2"},
			new:      []string{"https://example.com/callback1", "https://example.com/callback2"},
			expected: true,
		},
		{
			name:     "Same URIs different order",
			existing: []string{"https://example.com/callback1", "https://example.com/callback2"},
			new:      []string{"https://example.com/callback2", "https://example.com/callback1"},
			expected: true,
		},
		{
			name:     "Different URIs",
			existing: []string{"https://example.com/callback1", "https://example.com/callback2"},
			new:      []string{"https://example.com/callback1", "https://example.com/callback3"},
			expected: false,
		},
		{
			name:     "Different lengths - existing longer",
			existing: []string{"https://example.com/callback1", "https://example.com/callback2"},
			new:      []string{"https://example.com/callback1"},
			expected: false,
		},
		{
			name:     "Different lengths - new longer",
			existing: []string{"https://example.com/callback1"},
			new:      []string{"https://example.com/callback1", "https://example.com/callback2"},
			expected: false,
		},
		{
			name:     "Empty arrays",
			existing: []string{},
			new:      []string{},
			expected: true,
		},
		{
			name:     "One empty array",
			existing: []string{"https://example.com/callback1"},
			new:      []string{},
			expected: false,
		},
		{
			name:     "Single URI match",
			existing: []string{"https://example.com/callback1"},
			new:      []string{"https://example.com/callback1"},
			expected: true,
		},
		{
			name:     "Single URI no match",
			existing: []string{"https://example.com/callback1"},
			new:      []string{"https://example.com/callback2"},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := th.App.areRedirectURIsSame(tc.existing, tc.new)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestGetAuthorizationServerMetadata_NilDCRConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Enable OAuth service provider and set SiteURL
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableOAuthServiceProvider = model.NewPointer(true)
		cfg.ServiceSettings.SiteURL = model.NewPointer("https://example.com")
	})

	// Test with nil DCR config (should not include registration endpoint)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableDynamicClientRegistration = nil
	})

	metadata, err := th.App.GetAuthorizationServerMetadata(th.Context)
	require.Nil(t, err)
	require.NotNil(t, metadata)
	
	// Should not include registration endpoint when DCR is nil/disabled
	assert.Empty(t, metadata.RegistrationEndpoint)
	
	// Should include basic OAuth endpoints
	assert.Equal(t, "https://example.com", metadata.Issuer)
	assert.Equal(t, "https://example.com/oauth/authorize", metadata.AuthorizationEndpoint)
	assert.Equal(t, "https://example.com/oauth/access_token", metadata.TokenEndpoint)
	
	// Test with DCR explicitly enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(true)
	})

	metadata, err = th.App.GetAuthorizationServerMetadata(th.Context)
	require.Nil(t, err)
	require.NotNil(t, metadata)
	
	// Should include registration endpoint when DCR is enabled
	assert.Equal(t, "https://example.com/api/v4/oauth/apps/register", metadata.RegistrationEndpoint)
}

func TestGetOAuthAccessTokenForCodeFlow_PublicClient_WithPKCE_Success(t *testing.T) {
	// Test public client OAuth flow with mandatory PKCE
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Create public client
	publicApp := &model.OAuthApp{
		Name:                    "Public Client Test",
		CreatorId:               th.BasicUser2.Id,
		Homepage:                "https://example.com",
		Description:             "test public client",
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
	}

	publicApp, appErr := th.App.CreateOAuthApp(publicApp)
	require.Nil(t, appErr)
	require.Empty(t, publicApp.ClientSecret) // Public client should have no secret

	// PKCE parameters
	codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	codeChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	codeChallengeMethod := model.PKCECodeChallengeMethodS256

	// Authorization request with PKCE
	authRequest := &model.AuthorizeRequest{
		ResponseType:        model.ResponseTypeCode,
		ClientId:            publicApp.Id,
		RedirectURI:         publicApp.CallbackUrls[0],
		Scope:               "user",
		State:               "test_state",
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
	}

	// Get authorization code
	redirectURL, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
	require.Nil(t, appErr)

	// Extract authorization code from redirect URL
	uri, err := url.Parse(redirectURL)
	require.NoError(t, err)
	code := uri.Query().Get("code")
	require.NotEmpty(t, code)

	// Token exchange with PKCE verification (no client secret)
	accessResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
		th.Context,
		publicApp.Id,
		model.AccessTokenGrantType,
		authRequest.RedirectURI,
		code,
		"", // No client secret for public clients
		"", // No refresh token
		codeVerifier,
	)

	require.Nil(t, appErr)
	require.NotNil(t, accessResponse)
	require.NotEmpty(t, accessResponse.AccessToken)
	require.Equal(t, model.AccessTokenType, accessResponse.TokenType)
	require.Empty(t, accessResponse.RefreshToken) // Public clients don't get refresh tokens
}

func TestGetOAuthAccessTokenForCodeFlow_PublicClient_WithoutPKCE_ShouldFail(t *testing.T) {
	// Test that public client OAuth flow fails without PKCE
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Create public client
	publicApp := &model.OAuthApp{
		Name:                    "Public Client Test",
		CreatorId:               th.BasicUser2.Id,
		Homepage:                "https://example.com",
		Description:             "test public client",
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
	}

	publicApp, appErr := th.App.CreateOAuthApp(publicApp)
	require.Nil(t, appErr)

	// Authorization request WITHOUT PKCE (should fail for public clients)
	authRequest := &model.AuthorizeRequest{
		ResponseType: model.ResponseTypeCode,
		ClientId:     publicApp.Id,
		RedirectURI:  publicApp.CallbackUrls[0],
		Scope:        "user",
		State:        "test_state",
		// No CodeChallenge or CodeChallengeMethod
	}

	// This should fail because public clients require PKCE
	_, appErr = th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
	require.NotNil(t, appErr)
	require.Contains(t, appErr.Id, "pkce_required") // Should indicate PKCE is required
}

func TestGetOAuthAccessTokenForCodeFlow_ConfidentialClient_WithPKCE_Success(t *testing.T) {
	// Test confidential client OAuth flow with optional PKCE
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Create confidential client
	confidentialApp := &model.OAuthApp{
		Name:                    "Confidential Client Test",
		CreatorId:               th.BasicUser2.Id,
		Homepage:                "https://example.com",
		Description:             "test confidential client",
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodClientSecretPost),
	}

	confidentialApp, appErr := th.App.CreateOAuthApp(confidentialApp)
	require.Nil(t, appErr)
	require.NotEmpty(t, confidentialApp.ClientSecret) // Confidential client should have secret

	// PKCE parameters
	codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	codeChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	codeChallengeMethod := model.PKCECodeChallengeMethodS256

	// Authorization request with PKCE
	authRequest := &model.AuthorizeRequest{
		ResponseType:        model.ResponseTypeCode,
		ClientId:            confidentialApp.Id,
		RedirectURI:         confidentialApp.CallbackUrls[0],
		Scope:               "user",
		State:               "test_state",
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
	}

	// Get authorization code
	redirectURL, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
	require.Nil(t, appErr)

	// Extract authorization code from redirect URL
	uri, err := url.Parse(redirectURL)
	require.NoError(t, err)
	code := uri.Query().Get("code")
	require.NotEmpty(t, code)

	// Token exchange with both client secret and PKCE verification
	accessResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
		th.Context,
		confidentialApp.Id,
		model.AccessTokenGrantType,
		authRequest.RedirectURI,
		code,
		confidentialApp.ClientSecret,
		"", // No refresh token in initial request
		codeVerifier,
	)

	require.Nil(t, appErr)
	require.NotNil(t, accessResponse)
	require.NotEmpty(t, accessResponse.AccessToken)
	require.Equal(t, model.AccessTokenType, accessResponse.TokenType)
	require.NotEmpty(t, accessResponse.RefreshToken) // Confidential clients get refresh tokens
}

func TestGetOAuthAccessTokenForCodeFlow_ConfidentialClient_WithoutPKCE_Success(t *testing.T) {
	// Test confidential client OAuth flow without PKCE (legacy flow)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Create confidential client
	confidentialApp := &model.OAuthApp{
		Name:                    "Confidential Client Test",
		CreatorId:               th.BasicUser2.Id,
		Homepage:                "https://example.com",
		Description:             "test confidential client",
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodClientSecretPost),
	}

	confidentialApp, appErr := th.App.CreateOAuthApp(confidentialApp)
	require.Nil(t, appErr)

	// Authorization request WITHOUT PKCE (should work for confidential clients)
	authRequest := &model.AuthorizeRequest{
		ResponseType: model.ResponseTypeCode,
		ClientId:     confidentialApp.Id,
		RedirectURI:  confidentialApp.CallbackUrls[0],
		Scope:        "user",
		State:        "test_state",
		// No PKCE parameters
	}

	// Get authorization code
	redirectURL, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
	require.Nil(t, appErr)

	// Extract authorization code from redirect URL
	uri, err := url.Parse(redirectURL)
	require.NoError(t, err)
	code := uri.Query().Get("code")
	require.NotEmpty(t, code)

	// Token exchange with only client secret (no PKCE)
	accessResponse, appErr := th.App.GetOAuthAccessTokenForCodeFlow(
		th.Context,
		confidentialApp.Id,
		model.AccessTokenGrantType,
		authRequest.RedirectURI,
		code,
		confidentialApp.ClientSecret,
		"", // No refresh token in initial request
		"", // No code verifier
	)

	require.Nil(t, appErr)
	require.NotNil(t, accessResponse)
	require.NotEmpty(t, accessResponse.AccessToken)
	require.Equal(t, model.AccessTokenType, accessResponse.TokenType)
	require.NotEmpty(t, accessResponse.RefreshToken) // Confidential clients get refresh tokens
}

func TestGetOAuthAccessTokenForCodeFlow_ConfidentialClient_PKCEEnforcement(t *testing.T) {
	// Test PKCE enforcement - if started with PKCE, must complete with PKCE
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Create confidential client
	confidentialApp := &model.OAuthApp{
		Name:                    "Confidential Client Test",
		CreatorId:               th.BasicUser2.Id,
		Homepage:                "https://example.com",
		Description:             "test confidential client",
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodClientSecretPost),
	}

	confidentialApp, appErr := th.App.CreateOAuthApp(confidentialApp)
	require.Nil(t, appErr)

	// PKCE parameters
	codeChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	codeChallengeMethod := model.PKCECodeChallengeMethodS256

	// Authorization request WITH PKCE
	authRequest := &model.AuthorizeRequest{
		ResponseType:        model.ResponseTypeCode,
		ClientId:            confidentialApp.Id,
		RedirectURI:         confidentialApp.CallbackUrls[0],
		Scope:               "user",
		State:               "test_state",
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
	}

	// Get authorization code
	redirectURL, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
	require.Nil(t, appErr)

	// Extract authorization code from redirect URL
	uri, err := url.Parse(redirectURL)
	require.NoError(t, err)
	code := uri.Query().Get("code")
	require.NotEmpty(t, code)

	// Token exchange WITHOUT code verifier (should fail because we started with PKCE)
	_, appErr = th.App.GetOAuthAccessTokenForCodeFlow(
		th.Context,
		confidentialApp.Id,
		model.AccessTokenGrantType,
		authRequest.RedirectURI,
		code,
		confidentialApp.ClientSecret,
		"", // No refresh token in initial request
		"", // Missing code verifier - should fail
	)

	require.NotNil(t, appErr)
	require.Contains(t, appErr.Id, "pkce") // Should indicate PKCE verification failed
}

func TestGetOAuthAccessTokenForCodeFlow_PublicClient_NoRefreshToken(t *testing.T) {
	// Test that public clients cannot use refresh tokens
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Create public client
	publicApp := &model.OAuthApp{
		Name:                    "Public Client Test",
		CreatorId:               th.BasicUser2.Id,
		Homepage:                "https://example.com",
		Description:             "test public client",
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
	}

	publicApp, appErr := th.App.CreateOAuthApp(publicApp)
	require.Nil(t, appErr)

	// Attempt to use refresh token grant type (should fail for public clients)
	_, appErr = th.App.GetOAuthAccessTokenForCodeFlow(
		th.Context,
		publicApp.Id,
		model.RefreshTokenGrantType,
		"https://example.com/callback",
		"", // No code for refresh token flow
		"", // No client secret for public clients
		"some_fake_refresh_token",
		"", // No code verifier for refresh token flow
	)

	require.NotNil(t, appErr)
	require.Contains(t, appErr.Id, "public_client_refresh_token.app_error")
}

func TestRegisterOAuthClient_PublicClient_Success(t *testing.T) {
	// Test DCR for public clients
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { 
		*cfg.ServiceSettings.EnableOAuthServiceProvider = true
		cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(true)
	})

	// DCR request for public client
	dcrRequest := &model.ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
		GrantTypes:              []string{model.GrantTypeAuthorizationCode},
		ResponseTypes:           []string{model.ResponseTypeCode},
		ClientName:              model.NewPointer("Test Public Client"),
		ClientURI:               model.NewPointer("https://example.com"),
	}

	// Register public client
	registeredApp, appErr := th.App.RegisterOAuthClient(th.Context, dcrRequest, "")
	require.Nil(t, appErr)
	require.NotNil(t, registeredApp)

	// Verify public client properties
	require.Empty(t, registeredApp.ClientSecret) // No secret for public clients
	require.Equal(t, model.ClientAuthMethodNone, *registeredApp.TokenEndpointAuthMethod)
	require.Equal(t, []string{model.GrantTypeAuthorizationCode}, registeredApp.GrantTypes)
	require.NotContains(t, registeredApp.GrantTypes, model.GrantTypeRefreshToken)
	require.True(t, registeredApp.IsDynamicallyRegistered)
}

func TestGetOAuthAccessTokenForImplicitFlow_PublicClient_Success(t *testing.T) {
	// Test that implicit flow still works for public clients (no PKCE required)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Create public client
	publicApp := &model.OAuthApp{
		Name:                    "Public Client Test",
		CreatorId:               th.BasicUser2.Id,
		Homepage:                "https://example.com",
		Description:             "test public client",
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
	}

	publicApp, appErr := th.App.CreateOAuthApp(publicApp)
	require.Nil(t, appErr)
	require.Empty(t, publicApp.ClientSecret) // Public client should have no secret

	// Implicit flow authorization request (no PKCE parameters needed)
	authRequest := &model.AuthorizeRequest{
		ResponseType: model.ImplicitResponseType, // Using implicit flow
		ClientId:     publicApp.Id,
		RedirectURI:  publicApp.CallbackUrls[0],
		Scope:        "user",
		State:        "test_state",
		// No PKCE parameters for implicit flow
	}

	// Get access token directly via implicit flow
	session, appErr := th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
	require.Nil(t, appErr)
	require.NotNil(t, session)
	require.NotEmpty(t, session.Token)
	require.Equal(t, th.BasicUser.Id, session.UserId)
	require.True(t, session.IsOAuth)

	// Verify redirect URL format for implicit flow
	redirectURL, appErr := th.App.GetOAuthImplicitRedirect(th.Context, th.BasicUser.Id, authRequest)
	require.Nil(t, appErr)
	require.Contains(t, redirectURL, "#access_token=")
	require.Contains(t, redirectURL, "token_type=bearer")
	require.Contains(t, redirectURL, "state=test_state")
}

func TestGetOAuthAccessTokenForImplicitFlow_ConfidentialClient_Success(t *testing.T) {
	// Test that implicit flow works for confidential clients too
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// Create confidential client
	confidentialApp := &model.OAuthApp{
		Name:                    "Confidential Client Test",
		CreatorId:               th.BasicUser2.Id,
		Homepage:                "https://example.com",
		Description:             "test confidential client",
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodClientSecretPost),
	}

	confidentialApp, appErr := th.App.CreateOAuthApp(confidentialApp)
	require.Nil(t, appErr)
	require.NotEmpty(t, confidentialApp.ClientSecret) // Confidential client should have secret

	// Implicit flow authorization request (no PKCE needed for implicit flow)
	authRequest := &model.AuthorizeRequest{
		ResponseType: model.ImplicitResponseType, // Using implicit flow
		ClientId:     confidentialApp.Id,
		RedirectURI:  confidentialApp.CallbackUrls[0],
		Scope:        "user",
		State:        "test_state",
		// No PKCE parameters for implicit flow
	}

	// Get access token directly via implicit flow
	session, appErr := th.App.GetOAuthAccessTokenForImplicitFlow(th.Context, th.BasicUser.Id, authRequest)
	require.Nil(t, appErr)
	require.NotNil(t, session)
	require.NotEmpty(t, session.Token)
	require.Equal(t, th.BasicUser.Id, session.UserId)
	require.True(t, session.IsOAuth)
}
