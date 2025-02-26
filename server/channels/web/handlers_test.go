// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func handlerForHTTPErrors(c *Context, w http.ResponseWriter, r *http.Request) {
	c.Err = model.NewAppError("loginWithSaml", "api.user.saml.not_available.app_error", nil, "", http.StatusFound)
}

func TestHandlerServeHTTPErrors(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	web := New(th.Server)
	handler := web.NewHandler(handlerForHTTPErrors)

	var flagtests = []struct {
		name     string
		url      string
		mobile   bool
		redirect bool
	}{
		{"redirect on desktop non-api endpoint", "/login/sso/saml", false, true},
		{"not redirect on desktop api endpoint", "/api/v4/test", false, false},
		{"not redirect on mobile non-api endpoint", "/login/sso/saml", true, false},
		{"not redirect on mobile api endpoint", "/api/v4/test", true, false},
	}

	for _, tt := range flagtests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest("GET", tt.url, nil)
			if tt.mobile {
				request.Header.Add("X-Mobile-App", "mattermost")
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)

			if tt.redirect {
				assert.Equal(t, response.Code, http.StatusFound)
			} else {
				assert.NotContains(t, response.Body.String(), "/error?message=")
			}
		})
	}
}

func handlerForServeDefaultSecurityHeaders(c *Context, w http.ResponseWriter, r *http.Request) {
}

func TestHandlerServeDefaultSecurityHeaders(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	web := New(th.Server)
	handler := web.NewHandler(handlerForServeDefaultSecurityHeaders)

	paths := []string{
		"/api/v4/test",          // API
		"/static/manifest.json", // this should always exist. Static files have their own handler
		// Note that the plugin handler isn't tested, also plugins may support arbitrary functionality
	}

	for _, path := range paths {
		request := httptest.NewRequest("GET", path, nil)

		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)

		// header.Get returns a "" also if the header doesn't exist so we check that there is at least
		// one Permissions-Policy header and their value is "". We check with .Values() as it canonicalizes
		// the key.
		permissionsPolicyHeader := response.Header().Get("Permissions-Policy")
		permissionsPolicyHeaderValues := response.Header().Values("Permissions-Policy")

		contentTypeOptionsHeader := response.Header().Get("X-Content-Type-Options")
		referrerPolicyHeader := response.Header().Get("Referrer-Policy")

		assert.NotEqualf(t, 0, len(permissionsPolicyHeaderValues), "Permissions-Policy header doesn't exist")
		assert.Equal(t, "", permissionsPolicyHeader, "Permissions-Policy is not empty")
		assert.Equal(t, "nosniff", contentTypeOptionsHeader)
		assert.Equal(t, "no-referrer", referrerPolicyHeader)
	}
}

func handlerForHTTPSecureTransport(c *Context, w http.ResponseWriter, r *http.Request) {
}

func TestHandlerServeHTTPSecureTransport(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	th.App.UpdateConfig(func(config *model.Config) {
		*config.ServiceSettings.TLSStrictTransport = true
		*config.ServiceSettings.TLSStrictTransportMaxAge = 6000
	})

	web := New(th.Server)
	handler := web.NewHandler(handlerForHTTPSecureTransport)

	request := httptest.NewRequest("GET", "/api/v4/test", nil)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	header := response.Header().Get("Strict-Transport-Security")

	if header == "" {
		t.Errorf("Strict-Transport-Security expected but not existent")
	}

	if header != "max-age=6000" {
		t.Errorf("Expected max-age=6000, got %s", header)
	}

	th.App.UpdateConfig(func(config *model.Config) {
		*config.ServiceSettings.TLSStrictTransport = false
	})

	request = httptest.NewRequest("GET", "/api/v4/test", nil)

	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	header = response.Header().Get("Strict-Transport-Security")

	if header != "" {
		t.Errorf("Strict-Transport-Security header is not expected, but returned")
	}
}

func handlerForCSRFToken(c *Context, w http.ResponseWriter, r *http.Request) {
}

func TestHandlerServeCSRFToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	session := &model.Session{
		UserId:   th.BasicUser.Id,
		CreateAt: model.GetMillis(),
		Roles:    model.SystemUserRoleId,
		IsOAuth:  false,
	}
	session.GenerateCSRF()
	th.App.SetSessionExpireInHours(session, 24)
	session, err := th.App.CreateSession(th.Context, session)
	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}

	web := New(th.Server)

	handler := Handler{
		Srv:            web.srv,
		HandleFunc:     handlerForCSRFToken,
		RequireSession: true,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
	}

	cookie := &http.Cookie{
		Name:  model.SessionCookieUser,
		Value: th.BasicUser.Username,
	}
	cookie2 := &http.Cookie{
		Name:  model.SessionCookieToken,
		Value: session.Token,
	}
	cookie3 := &http.Cookie{
		Name:  model.SessionCookieCsrf,
		Value: session.GetCSRF(),
	}

	// CSRF Token Used - Success Expected

	request := httptest.NewRequest("POST", "/api/v4/test", nil)
	request.AddCookie(cookie)
	request.AddCookie(cookie2)
	request.AddCookie(cookie3)
	request.Header.Add(model.HeaderCsrfToken, session.GetCSRF())
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != 200 {
		t.Errorf("Expected status 200, got %d", response.Code)
	}

	// No CSRF Token Used - Failure Expected

	request = httptest.NewRequest("POST", "/api/v4/test", nil)
	request.AddCookie(cookie)
	request.AddCookie(cookie2)
	request.AddCookie(cookie3)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != 401 {
		t.Errorf("Expected status 401, got %d", response.Code)
	}

	// Fallback Behavior Used - Success expected
	// ToDo (DSchalla) 2019/01/04: Remove once legacy CSRF Handling is removed
	th.App.UpdateConfig(func(config *model.Config) {
		*config.ServiceSettings.ExperimentalStrictCSRFEnforcement = false
	})
	request = httptest.NewRequest("POST", "/api/v4/test", nil)
	request.AddCookie(cookie)
	request.AddCookie(cookie2)
	request.AddCookie(cookie3)
	request.Header.Add(model.HeaderRequestedWith, model.HeaderRequestedWithXML)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != 200 {
		t.Errorf("Expected status 200, got %d", response.Code)
	}

	// Fallback Behavior Used with Strict Enforcement - Failure Expected
	// ToDo (DSchalla) 2019/01/04: Remove once legacy CSRF Handling is removed
	th.App.UpdateConfig(func(config *model.Config) {
		*config.ServiceSettings.ExperimentalStrictCSRFEnforcement = true
	})
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != 401 {
		t.Errorf("Expected status 200, got %d", response.Code)
	}

	// Handler with RequireSession set to false

	handlerNoSession := Handler{
		Srv:            th.Server,
		HandleFunc:     handlerForCSRFToken,
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
	}

	// CSRF Token Used - Success Expected

	request = httptest.NewRequest("POST", "/api/v4/test", nil)
	request.AddCookie(cookie)
	request.AddCookie(cookie2)
	request.AddCookie(cookie3)
	request.Header.Add(model.HeaderCsrfToken, session.GetCSRF())
	response = httptest.NewRecorder()
	handlerNoSession.ServeHTTP(response, request)

	if response.Code != 200 {
		t.Errorf("Expected status 200, got %d", response.Code)
	}

	// No CSRF Token Used - Failure Expected

	request = httptest.NewRequest("POST", "/api/v4/test", nil)
	request.AddCookie(cookie)
	request.AddCookie(cookie2)
	request.AddCookie(cookie3)
	response = httptest.NewRecorder()
	handlerNoSession.ServeHTTP(response, request)

	if response.Code != 401 {
		t.Errorf("Expected status 401, got %d", response.Code)
	}
}

func handlerForCSPHeader(c *Context, w http.ResponseWriter, r *http.Request) {
}

func TestHandlerServeCSPHeader(t *testing.T) {
	t.Run("non-static", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		web := New(th.Server)

		handler := Handler{
			Srv:            web.srv,
			HandleFunc:     handlerForCSPHeader,
			RequireSession: false,
			TrustRequester: false,
			RequireMfa:     false,
			IsStatic:       false,
		}

		request := httptest.NewRequest("POST", "/api/v4/test", nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		assert.Equal(t, 200, response.Code)
		assert.Empty(t, response.Header()["Content-Security-Policy"])
	})

	t.Run("static, without subpath", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		web := New(th.Server)

		handler := Handler{
			Srv:            web.srv,
			HandleFunc:     handlerForCSPHeader,
			RequireSession: false,
			TrustRequester: false,
			RequireMfa:     false,
			IsStatic:       true,
		}

		request := httptest.NewRequest("POST", "/", nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		assert.Equal(t, 200, response.Code)
		assert.Equal(t, []string{"frame-ancestors " + frameAncestors + "; script-src 'self' cdn.rudderlabs.com"}, response.Header()["Content-Security-Policy"])
	})

	t.Run("static, with subpath", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockUserStore := mocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
		mockPostStore := mocks.PostStore{}
		mockPostStore.On("GetMaxPostSize").Return(65535, nil)
		mockSystemStore := mocks.SystemStore{}
		mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
		mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
		mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

		mockStore.On("User").Return(&mockUserStore)
		mockStore.On("Post").Return(&mockPostStore)
		mockStore.On("System").Return(&mockSystemStore)
		mockStore.On("GetDBSchemaVersion").Return(1, nil)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = *cfg.ServiceSettings.SiteURL + "/subpath"
		})

		web := New(th.Server)

		handler := Handler{
			Srv:            web.srv,
			HandleFunc:     handlerForCSPHeader,
			RequireSession: false,
			TrustRequester: false,
			RequireMfa:     false,
			IsStatic:       true,
		}

		request := httptest.NewRequest("POST", "/", nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		assert.Equal(t, 200, response.Code)
		assert.Equal(t, []string{"frame-ancestors " + frameAncestors + "; script-src 'self' cdn.rudderlabs.com"}, response.Header()["Content-Security-Policy"])

		// TODO: It's hard to unit test this now that the CSP directive is effectively
		// decided in Setup(). Circle back to this in master once the memory store is
		// merged, allowing us to mock the desired initial config to take effect in Setup().
		// assert.Contains(t, response.Header()["Content-Security-Policy"], "frame-ancestors 'self'; script-src 'self' cdn.rudderlabs.com 'sha256-tPOjw+tkVs9axL78ZwGtYl975dtyPHB6LYKAO2R3gR4='")

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = *cfg.ServiceSettings.SiteURL + "/subpath2"
		})

		request = httptest.NewRequest("POST", "/", nil)
		response = httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		assert.Equal(t, 200, response.Code)
		assert.Equal(t, []string{"frame-ancestors " + frameAncestors + "; script-src 'self' cdn.rudderlabs.com"}, response.Header()["Content-Security-Policy"])
		// TODO: See above.
		// assert.Contains(t, response.Header()["Content-Security-Policy"], "frame-ancestors 'self'; script-src 'self' cdn.rudderlabs.com 'sha256-tPOjw+tkVs9axL78ZwGtYl975dtyPHB6LYKAO2R3gR4='", "csp header incorrectly changed after subpath changed")
	})

	t.Run("dev mode", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		oldBuildNumber := model.BuildNumber
		model.BuildNumber = "dev"
		defer func() {
			model.BuildNumber = oldBuildNumber
		}()

		web := New(th.Server)

		handler := Handler{
			Srv:            web.srv,
			HandleFunc:     handlerForCSPHeader,
			RequireSession: false,
			TrustRequester: false,
			RequireMfa:     false,
			IsStatic:       true,
		}

		request := httptest.NewRequest("POST", "/", nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		assert.Equal(t, 200, response.Code)
		assert.Equal(t, []string{"frame-ancestors " + frameAncestors + "; script-src 'self' cdn.rudderlabs.com 'unsafe-eval' 'unsafe-inline'"}, response.Header()["Content-Security-Policy"])
	})
}

func TestGenerateDevCSP(t *testing.T) {
	t.Run("dev mode", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		oldBuildNumber := model.BuildNumber
		model.BuildNumber = "dev"
		defer func() {
			model.BuildNumber = oldBuildNumber
		}()
		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     th.App.Log(),
		}

		devCSP := generateDevCSP(*c)

		assert.Equal(t, " 'unsafe-eval' 'unsafe-inline'", devCSP)
	})

	t.Run("allowed dev flags", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		oldBuildNumber := model.BuildNumber
		model.BuildNumber = "0"
		defer func() {
			model.BuildNumber = oldBuildNumber
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.DeveloperFlags = "unsafe-inline=true,unsafe-eval=true"
		})

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     th.App.Log(),
		}

		devCSP := generateDevCSP(*c)

		assert.Equal(t, " 'unsafe-inline' 'unsafe-eval'", devCSP)
	})

	t.Run("partial dev flags", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		oldBuildNumber := model.BuildNumber
		model.BuildNumber = "0"
		defer func() {
			model.BuildNumber = oldBuildNumber
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.DeveloperFlags = "unsafe-inline=false,unsafe-eval=true"
		})

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     th.App.Log(),
		}

		devCSP := generateDevCSP(*c)

		assert.Equal(t, " 'unsafe-eval'", devCSP)
	})

	t.Run("unknown dev flags", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		oldBuildNumber := model.BuildNumber
		model.BuildNumber = "0"
		defer func() {
			model.BuildNumber = oldBuildNumber
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.DeveloperFlags = "unknown=true,unsafe-inline=false,unsafe-eval=true"
		})

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     th.App.Log(),
		}

		devCSP := generateDevCSP(*c)

		assert.Equal(t, " 'unsafe-eval'", devCSP)
	})

	t.Run("empty dev flags", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.DeveloperFlags = ""
		})

		logger := mlog.CreateConsoleTestLogger(t)
		buf := &mlog.Buffer{}
		require.NoError(t, mlog.AddWriterTarget(logger, buf, false, mlog.LvlWarn))

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
			Logger:     logger,
		}

		generateDevCSP(*c)

		assert.Equal(t, "", buf.String())
	})
}

func TestHandlerServeInvalidToken(t *testing.T) {
	testCases := []struct {
		Description                   string
		SiteURL                       string
		ExpectedSetCookieHeaderRegexp string
	}{
		{"no subpath", "http://localhost:8065", "^MMAUTHTOKEN=; Path=/"},
		{"subpath", "http://localhost:8065/subpath", "^MMAUTHTOKEN=; Path=/subpath"},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			th := Setup(t)
			defer th.TearDown()

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.SiteURL = tc.SiteURL
			})

			web := New(th.Server)

			handler := Handler{
				Srv:            web.srv,
				HandleFunc:     handlerForCSRFToken,
				RequireSession: true,
				TrustRequester: false,
				RequireMfa:     false,
				IsStatic:       false,
			}

			cookie := &http.Cookie{
				Name:  model.SessionCookieToken,
				Value: "invalid",
			}

			request := httptest.NewRequest("POST", "/api/v4/test", nil)
			request.AddCookie(cookie)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			require.Equal(t, http.StatusUnauthorized, response.Code)

			cookies := response.Header().Get("Set-Cookie")
			assert.Regexp(t, tc.ExpectedSetCookieHeaderRegexp, cookies)
		})
	}
}

func TestCheckCSRFToken(t *testing.T) {
	t.Run("should allow a POST request with a valid CSRF token header", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		h := &Handler{
			RequireSession: true,
			TrustRequester: false,
		}

		token := "token"
		tokenLocation := app.TokenLocationCookie

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
		}
		r, _ := http.NewRequest(http.MethodPost, "", nil)
		r.Header.Set(model.HeaderCsrfToken, token)
		session := &model.Session{
			Props: map[string]string{
				"csrf": token,
			},
		}

		checked, passed := h.checkCSRFToken(c, r, token, tokenLocation, session)

		assert.True(t, checked)
		assert.True(t, passed)
		assert.Nil(t, c.Err)
	})

	t.Run("should allow a POST request with an X-Requested-With header", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		h := &Handler{
			RequireSession: true,
			TrustRequester: false,
		}

		token := "token"
		tokenLocation := app.TokenLocationCookie

		c := &Context{
			App:        th.App,
			Logger:     th.App.Log(),
			AppContext: th.Context,
		}
		r, _ := http.NewRequest(http.MethodPost, "", nil)
		r.Header.Set(model.HeaderRequestedWith, model.HeaderRequestedWithXML)
		session := &model.Session{
			Props: map[string]string{
				"csrf": token,
			},
		}

		checked, passed := h.checkCSRFToken(c, r, token, tokenLocation, session)

		assert.True(t, checked)
		assert.True(t, passed)
		assert.Nil(t, c.Err)
	})

	t.Run("should not allow a POST request with an X-Requested-With header with strict CSRF enforcement enabled", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockUserStore := mocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
		mockPostStore := mocks.PostStore{}
		mockPostStore.On("GetMaxPostSize").Return(65535, nil)
		mockSystemStore := mocks.SystemStore{}
		mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
		mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
		mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

		mockStore.On("User").Return(&mockUserStore)
		mockStore.On("Post").Return(&mockPostStore)
		mockStore.On("System").Return(&mockSystemStore)
		mockStore.On("GetDBSchemaVersion").Return(1, nil)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalStrictCSRFEnforcement = true
		})

		h := &Handler{
			RequireSession: true,
			TrustRequester: false,
		}

		token := "token"
		tokenLocation := app.TokenLocationCookie

		c := &Context{
			App:        th.App,
			Logger:     th.App.Log(),
			AppContext: th.Context,
		}
		r, _ := http.NewRequest(http.MethodPost, "", nil)
		r.Header.Set(model.HeaderRequestedWith, model.HeaderRequestedWithXML)
		session := &model.Session{
			Props: map[string]string{
				"csrf": token,
			},
		}

		checked, passed := h.checkCSRFToken(c, r, token, tokenLocation, session)

		assert.True(t, checked)
		assert.False(t, passed)
		assert.NotNil(t, c.Err)
	})

	t.Run("should not allow a POST request without either header", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		h := &Handler{
			RequireSession: true,
			TrustRequester: false,
		}

		token := "token"
		tokenLocation := app.TokenLocationCookie

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
		}
		r, _ := http.NewRequest(http.MethodPost, "", nil)
		session := &model.Session{
			Props: map[string]string{
				"csrf": token,
			},
		}

		checked, passed := h.checkCSRFToken(c, r, token, tokenLocation, session)

		assert.True(t, checked)
		assert.False(t, passed)
		assert.NotNil(t, c.Err)
	})

	t.Run("should not check GET requests", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		h := &Handler{
			RequireSession: true,
			TrustRequester: false,
		}

		token := "token"
		tokenLocation := app.TokenLocationCookie

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
		}
		r, _ := http.NewRequest(http.MethodGet, "", nil)
		session := &model.Session{
			Props: map[string]string{
				"csrf": token,
			},
		}

		checked, passed := h.checkCSRFToken(c, r, token, tokenLocation, session)

		assert.False(t, checked)
		assert.False(t, passed)
		assert.Nil(t, c.Err)
	})

	t.Run("should not check a request passing the auth token in a header", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		h := &Handler{
			RequireSession: true,
			TrustRequester: false,
		}

		token := "token"
		tokenLocation := app.TokenLocationHeader

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
		}
		r, _ := http.NewRequest(http.MethodPost, "", nil)
		session := &model.Session{
			Props: map[string]string{
				"csrf": token,
			},
		}

		checked, passed := h.checkCSRFToken(c, r, token, tokenLocation, session)

		assert.False(t, checked)
		assert.False(t, passed)
		assert.Nil(t, c.Err)
	})

	t.Run("should not check a request passing a nil session", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		h := &Handler{
			RequireSession: false,
			TrustRequester: false,
		}

		token := "token"
		tokenLocation := app.TokenLocationCookie

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
		}
		r, _ := http.NewRequest(http.MethodPost, "", nil)
		r.Header.Set(model.HeaderCsrfToken, token)

		checked, passed := h.checkCSRFToken(c, r, token, tokenLocation, nil)

		assert.False(t, checked)
		assert.False(t, passed)
		assert.Nil(t, c.Err)
	})

	t.Run("should check requests for handlers that don't require a session but have one", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		h := &Handler{
			RequireSession: false,
			TrustRequester: false,
		}

		token := "token"
		tokenLocation := app.TokenLocationCookie

		c := &Context{
			App:        th.App,
			AppContext: th.Context,
		}
		r, _ := http.NewRequest(http.MethodPost, "", nil)
		r.Header.Set(model.HeaderCsrfToken, token)
		session := &model.Session{
			Props: map[string]string{
				"csrf": token,
			},
		}

		checked, passed := h.checkCSRFToken(c, r, token, tokenLocation, session)

		assert.True(t, checked)
		assert.True(t, passed)
		assert.Nil(t, c.Err)
	})
}

func TestGetOriginClient(t *testing.T) {
	testCases := []struct {
		name           string
		userAgent      string
		mobilev2       bool
		expectedClient OriginClient
	}{
		{
			name:           "No user agent - unknown client",
			userAgent:      "",
			expectedClient: OriginClientUnknown,
		},
		{
			name:           "Mozilla user agent",
			userAgent:      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0",
			expectedClient: OriginClientWeb,
		},
		{
			name:           "Chrome user agent",
			userAgent:      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
			expectedClient: OriginClientWeb,
		},
		{
			name:           "Mobile post v2",
			userAgent:      "someother-agent/3.2.4",
			mobilev2:       true,
			expectedClient: OriginClientMobile,
		},
		{
			name:           "Mobile Android",
			userAgent:      "rnbeta/2.0.0.441 someother-agent/3.2.4",
			expectedClient: OriginClientMobile,
		},
		{
			name:           "Mobile iOS",
			userAgent:      "Mattermost/2.0.0.441 someother-agent/3.2.4",
			expectedClient: OriginClientMobile,
		},
		{
			name:           "Desktop user agent",
			userAgent:      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.177 Electron/23.1.2 Safari/537.36 Mattermost/5.3.1",
			expectedClient: OriginClientDesktop,
		},
	}

	for _, tc := range testCases {
		req, err := http.NewRequest(http.MethodGet, "example.com", nil)
		require.NoError(t, err)

		// Set User-Agent header, if any
		if tc.userAgent != "" {
			req.Header.Set("User-Agent", tc.userAgent)
		}

		// Set mobilev2 query if needed
		if tc.mobilev2 {
			q := req.URL.Query()
			q.Add("mobilev2", "true")
			req.URL.RawQuery = q.Encode()
		}

		// Compute origin client
		actualClient := GetOriginClient(req)

		require.Equal(t, tc.expectedClient, actualClient)
	}
}

func noOpHandler(_ *Context, _ http.ResponseWriter, _ *http.Request) {
	// no op
}

func TestHandlerServeHTTPBasicSecurityChecks(t *testing.T) {
	t.Run("Should not cause 414 error if url is smaller than configured limit", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		web := New(th.Server)
		handler := web.NewHandler(noOpHandler)

		// using the default URL length
		request := httptest.NewRequest("GET", "/api/v4/test?with=not&many=query_params", nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	t.Run("Should cause 414 error if url is longer than configured limit", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockUserStore := mocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
		mockPostStore := mocks.PostStore{}
		mockPostStore.On("GetMaxPostSize").Return(65535, nil)
		mockSystemStore := mocks.SystemStore{}
		mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
		mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
		mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

		mockStore.On("User").Return(&mockUserStore)
		mockStore.On("Post").Return(&mockPostStore)
		mockStore.On("System").Return(&mockSystemStore)
		mockStore.On("GetDBSchemaVersion").Return(1, nil)

		th.App.UpdateConfig(func(config *model.Config) {
			config.ServiceSettings.MaximumURLLength = model.NewPointer(10)
		})

		web := New(th.Server)
		handler := web.NewHandler(noOpHandler)

		request := httptest.NewRequest("GET", "/api/v4/test?a_url_longer_than_10_characters_including_query_params", nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		assert.Equal(t, http.StatusRequestURITooLong, response.Code)
	})

	t.Run("414 error should include query params in computing URL length", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockUserStore := mocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
		mockPostStore := mocks.PostStore{}
		mockPostStore.On("GetMaxPostSize").Return(65535, nil)
		mockSystemStore := mocks.SystemStore{}
		mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
		mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
		mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

		mockStore.On("User").Return(&mockUserStore)
		mockStore.On("Post").Return(&mockPostStore)
		mockStore.On("System").Return(&mockSystemStore)
		mockStore.On("GetDBSchemaVersion").Return(1, nil)

		th.App.UpdateConfig(func(config *model.Config) {
			config.ServiceSettings.MaximumURLLength = model.NewPointer(20)
		})

		web := New(th.Server)
		handler := web.NewHandler(noOpHandler)

		// this URL is within the 20 characters limit excluding query params.
		// but this should still fail as URL length includes query params
		request := httptest.NewRequest("GET", "/api/v4/test?a_url_longer_than_10_characters_including_query_params", nil)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		assert.Equal(t, http.StatusRequestURITooLong, response.Code)
	})
}

func TestHandlerServeHTTPRequestPayloadLimit(t *testing.T) {
	jsonReaderHandler := func(context *Context, writer http.ResponseWriter, request *http.Request) {
		// read request body into a string
		var body *string
		err := json.NewDecoder(request.Body).Decode(&body)
		if err != nil {
			fmt.Printf("Error occurred reading request body, error: %s", err.Error())
			context.Err = model.NewAppError("TestHandlerServeHTTPRequestPayloadLimit", "", nil, "", http.StatusBadRequest).Wrap(err)
		} else {
			fmt.Printf("Received body- '%s'", *body)
			writer.WriteHeader(http.StatusOK)
		}
	}

	t.Run("should allow payload smaller than set limit", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		web := New(th.Server)
		handler := web.NewHandler(jsonReaderHandler)

		body := strings.NewReader("\"a very small request body\"")
		request := httptest.NewRequest("POST", "/api/v4/test", body)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)

		assert.Equal(t, http.StatusOK, response.Code)
	})

	t.Run("Should error out when request body is larger than set limit", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockUserStore := mocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
		mockPostStore := mocks.PostStore{}
		mockPostStore.On("GetMaxPostSize").Return(65535, nil)
		mockSystemStore := mocks.SystemStore{}
		mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
		mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
		mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

		mockStore.On("User").Return(&mockUserStore)
		mockStore.On("Post").Return(&mockPostStore)
		mockStore.On("System").Return(&mockSystemStore)
		mockStore.On("GetDBSchemaVersion").Return(1, nil)

		th.App.UpdateConfig(func(config *model.Config) {
			config.ServiceSettings.MaximumPayloadSizeBytes = model.NewPointer(int64(1))
		})

		web := New(th.Server)
		handler := web.NewHandler(jsonReaderHandler)

		// this is a 600 character long string.
		// Even though we have set the max payload size to be 1, we still need at least 513 bytes (1 byte configured + bytes.MinRead = 1 + 512 = 513) bytes.
		// This is because the buffer will always be at least bytes.MinRead bytes large, so the effective payload limit is bytes.MinRead + the configured value.
		body := strings.NewReader("\"weunfrwghyajuaqqkrecexurpmrmgpimjieymiwfhfrrrgiqpqrznkjtubwcuybyixyxwtwddpytukritccyugyeuvdtzjkkyiwhquzqkrqkhgyyfqnquzchjqkrkzfrxthduzizqtdxzqirxhzihbivmkdwpbeddepdanzuuzqxbdqfvgkwumervhghywexitbjdnvxcniuamwmqdecbbqbgnjjqwkdcucvnpwynuruztpdtmmvbpkevurpjdwdhpayaindzmnkmyybudfkjdkqwuiviriudtqytybuwfkkwpepwhpekfewnxgpkfctdqjmemngvntnizvfznaiqpbumgtcxidvawtgcdyqijbxzrgezvjmcwikiabbpqabrwfgncrmvqththepffatnhchhnmrhkuqvgrzfugzhuwicaemhcacrazmgzmrgrkuhwucfydhwxfhzfukzjhvdxkuhzjrxwippxadvwzigndxwdxvganxggjjxwdqtgqgnpqqygndviadvttwfntcreitijaqrpfygdehbcftyfcjvrfwvjmbtdptutjgtbyhbyddfecyyujgrxyujzmryymj\"")
		request := httptest.NewRequest("POST", "/api/v4/test", body)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)

		assert.Equal(t, http.StatusRequestEntityTooLarge, response.Code)
	})
}
