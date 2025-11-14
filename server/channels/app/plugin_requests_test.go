// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestServePluginPublicRequest(t *testing.T) {
	installPlugin := func(t *testing.T, th *TestHelper, pluginID string) {
		t.Helper()

		path, _ := fileutils.FindDir("tests")
		fileReader, err := os.Open(filepath.Join(path, fmt.Sprintf("%s.tar.gz", pluginID)))
		require.NoError(t, err)
		defer fileReader.Close()

		_, appErr := th.App.WriteFile(fileReader, getBundleStorePath(pluginID))
		checkNoError(t, appErr)

		appErr = th.App.SyncPlugins()
		checkNoError(t, appErr)

		env := th.App.GetPluginsEnvironment()
		require.NotNil(t, env)

		// Check if installed
		pluginStatus, err := env.Statuses()
		require.NoError(t, err)
		found := false
		for _, pluginStatus := range pluginStatus {
			if pluginStatus.PluginId == pluginID {
				found = true
			}
		}
		require.True(t, found, "failed to find plugin %s in plugin statuses", pluginID)

		appErr = th.App.EnablePlugin(pluginID)
		checkNoError(t, appErr)

		t.Cleanup(func() {
			appErr = th.App.ch.RemovePlugin(pluginID)
			checkNoError(t, appErr)
		})
	}

	t.Run("returns not found when plugins environment is nil", func(t *testing.T) {
		th := Setup(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

		req, err := http.NewRequest(http.MethodGet, "/plugins/plugin_id/public/file.txt", nil)
		require.NoError(t, err)

		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(th.App.ch.ServePluginPublicRequest)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("resolves path for valid plugin", func(t *testing.T) {
		th := Setup(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

		path, _ := fileutils.FindDir("tests")
		fileReader, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)
		defer fileReader.Close()

		installPlugin(t, th, "testplugin")

		req, err := http.NewRequest(http.MethodGet, "/plugins/testplugin/public/file.txt", nil)
		require.NoError(t, err)

		rr := httptest.NewRecorder()
		th.App.ch.srv.Router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		body, err := io.ReadAll(rr.Body)
		require.NoError(t, err)
		require.Equal(t, "Hello World!", string(body))
	})

	t.Run("resolves path for valid plugin when subpath configured", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://localhost:8065/subpath")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		th := Setup(t)

		installPlugin(t, th, "testplugin")

		req, err := http.NewRequest(http.MethodGet, "/subpath/plugins/testplugin/public/file.txt", nil)
		require.NoError(t, err)

		rr := httptest.NewRecorder()
		th.App.ch.srv.RootRouter.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		body, err := io.ReadAll(rr.Body)
		require.NoError(t, err)
		assert.Equal(t, "Hello World!", string(body))
	})

	t.Run("fails for invalid plugin", func(t *testing.T) {
		th := Setup(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

		req, err := http.NewRequest(http.MethodGet, "/plugins/invalidplugin/public/file.txt", nil)
		require.NoError(t, err)

		rr := httptest.NewRecorder()
		th.App.ch.srv.Router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("fails attempting to break out of path", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://localhost:8065/subpath")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		th := Setup(t)

		installPlugin(t, th, "testplugin")
		installPlugin(t, th, "testplugin2")

		req, err := http.NewRequest(http.MethodGet, "/subpath/plugins/testplugin/public/../../testplugin2/file.txt", nil)
		require.NoError(t, err)

		rr := httptest.NewRecorder()
		th.App.ch.srv.RootRouter.ServeHTTP(rr, req)

		require.Equal(t, http.StatusMovedPermanently, rr.Code)
		assert.Equal(t, "/subpath/plugins/testplugin2/file.txt", rr.Header()["Location"][0])
	})
}

// TestUnauthRequestsMFAWarningFix tests the fix for https://mattermost.atlassian.net/browse/MM-63805.
func TestUnauthRequestsMFAWarningFix(t *testing.T) {
	th := Setup(t)

	// Enable MFA and require it
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
		*cfg.ServiceSettings.EnforceMultifactorAuthentication = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	// Setup a buffer to capture logs
	buffer := &mlog.Buffer{}
	err := mlog.AddWriterTarget(th.TestLogger, buffer, true, mlog.StdAll...)
	require.NoError(t, err)

	// Test the fix by simulating an unauthenticated request (no token at all)
	unauthReq := httptest.NewRequest(http.MethodGet, "/plugins/foo/bar", nil)
	unauthReq = mux.SetURLVars(unauthReq, map[string]string{"plugin_id": "foo"})

	// Handler function for the plugin request
	handlerCalled := false
	handler := func(_ *plugin.Context, _ http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		// Verify URL path was properly stripped
		require.Equal(t, "/bar", r.URL.Path)
		// Verify no user ID header (indicating the request is unauthenticated)
		require.Empty(t, r.Header.Get("Mattermost-User-Id"))
	}

	// Call servePluginRequest directly
	th.App.ch.servePluginRequest(nil, unauthReq, handler)

	// Verify the handler was actually called
	require.True(t, handlerCalled, "Plugin request handler should be called")

	// Check the logs for the MFA warning
	err = th.TestLogger.Flush()
	require.NoError(t, err)
	entries := testlib.ParseLogEntries(t, buffer)
	for _, e := range entries {
		if e.Msg == "Treating session as unauthenticated since MFA required" {
			assert.Fail(t, "MFA warning should not be logged for unauthenticated requests")
		}
		if e.Msg == "Token in plugin request is invalid. Treating request as unauthenticated" {
			assert.Fail(t, "MFA warning should not be logged for unauthenticated requests")
		}
	}
}

func TestServePluginRequest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	session, err := th.App.CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser.Id,
	})
	require.Nil(t, err)

	t.Run("Plugins are disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })
		})

		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/plugins/foo/bar", nil)
		th.App.ch.ServePluginRequest(w, r)
		assert.Equal(t, http.StatusNotImplemented, w.Result().StatusCode)
	})

	t.Run("unauthenticated request", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.Empty(t, r.Header.Get("Mattermost-User-Id"))
			assert.Empty(t, ctx.SessionId)
			assert.NotEmpty(t, ctx.RequestId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("bearer token authentication", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+session.Token)
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
			assert.Equal(t, session.Id, ctx.SessionId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)

		// Test again with lower case header prefix
		handlerCalled = false
		req.Header.Set(model.HeaderAuth, "bearer "+session.Token)
		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("token header authentication", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.Header.Set(model.HeaderAuth, model.HeaderToken+" "+session.Token)
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
			assert.Equal(t, session.Id, ctx.SessionId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)

		// Test again with upper case header prefix
		handlerCalled = false
		req.Header.Set(model.HeaderAuth, "TOKEN "+session.Token)
		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("cookie authentication", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.AddCookie(&http.Cookie{
			Name:  model.SessionCookieToken,
			Value: session.Token,
		})
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
			assert.Equal(t, session.Id, ctx.SessionId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("query parameter authentication", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint?access_token="+session.Token, nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
			assert.Equal(t, session.Id, ctx.SessionId)
			// Verify access_token is removed from query parameters
			assert.Empty(t, r.URL.Query().Get("access_token"))
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("invalid token - treats as unauthenticated", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" invalidtoken")
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.Empty(t, r.Header.Get("Mattermost-User-Id"))
			assert.Empty(t, ctx.SessionId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("MFA required - treats as unauthenticated", func(t *testing.T) {
		// Enable MFA requirement
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableMultifactorAuthentication = true
			*cfg.ServiceSettings.EnforceMultifactorAuthentication = true
		})
		th.App.Srv().SetLicense(model.NewTestLicense())
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.EnableMultifactorAuthentication = false
				*cfg.ServiceSettings.EnforceMultifactorAuthentication = false
			})
		})

		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+session.Token)
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.Empty(t, r.Header.Get("Mattermost-User-Id"))
			assert.Empty(t, ctx.SessionId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("header and cookie cleanup", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+session.Token)
		req.Header.Set("Mattermost-Plugin-ID", "evil-plugin")
		req.Header.Set("Mattermost-User-Id", "evil-user")
		req.AddCookie(&http.Cookie{Name: "other_cookie", Value: "keep_me"})
		req.AddCookie(&http.Cookie{Name: "another_cookie", Value: "keep_me_too"})
		req.Header.Set("Referer", "https://evil.com")
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true

			assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
			assert.Equal(t, session.Id, ctx.SessionId)

			assert.Empty(t, r.Header.Get("Mattermost-Plugin-ID"))
			assert.Empty(t, r.Header.Get(model.HeaderAuth))
			assert.Empty(t, r.Header.Get("Referer"))

			// Verify that legitimate cookies are preserved (but not session cookies)
			cookies := r.Cookies()
			cookieNames := make([]string, len(cookies))
			for i, cookie := range cookies {
				cookieNames[i] = cookie.Name
			}
			// Session token cookie should be filtered out
			assert.NotContains(t, cookieNames, model.SessionCookieToken)
			// Other cookies should remain
			assert.Contains(t, cookieNames, "other_cookie")
			assert.Contains(t, cookieNames, "another_cookie")
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("nested URL path", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/some/deep/path", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			// Path should be stripped of the plugin prefix
			assert.Equal(t, "/some/deep/path", r.URL.Path)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("context creation with correct fields", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+session.Token)
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")
		req.Header.Set("User-Agent", "TestAgent/1.0")
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.NotEmpty(t, ctx.RequestId)
			assert.NotEmpty(t, ctx.IPAddress)
			assert.Equal(t, "en-US,en;q=0.9", ctx.AcceptLanguage)
			assert.Equal(t, "TestAgent/1.0", ctx.UserAgent)
			assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
			assert.Equal(t, session.Id, ctx.SessionId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("subpath handling", func(t *testing.T) {
		// Set up with subpath
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://localhost:8065/subpath" })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://localhost:8065" })
		})

		req := httptest.NewRequest(http.MethodGet, "/subpath/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			// Path should be stripped of both subpath and plugin prefix
			assert.Equal(t, "/endpoint", r.URL.Path)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("CSRF validation for cookie auth POST request", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.AddCookie(&http.Cookie{
			Name:  model.SessionCookieToken,
			Value: session.Token,
		})
		req.Header.Set(model.HeaderCsrfToken, session.GetCSRF())
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
			assert.Equal(t, session.Id, ctx.SessionId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("CSRF validation fails for cookie auth POST request", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/testplugin/endpoint", nil)
		req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
		req.AddCookie(&http.Cookie{
			Name:  model.SessionCookieToken,
			Value: session.Token,
		})
		req.Header.Set(model.HeaderCsrfToken, "invalid-csrf-token")
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			// Should not have user ID header due to CSRF failure
			assert.Empty(t, r.Header.Get("Mattermost-User-Id"))
			assert.Empty(t, ctx.SessionId)
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})

	t.Run("third-party use of Authorization header preserved", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/testplugin/endpoint", nil)
		req.Header.Set(model.HeaderAuth, "Bearer 3rd-party-token")
		rr := httptest.NewRecorder()

		handlerCalled := false
		mockHandler := func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			// Should still have the authorization header
			assert.Equal(t, "Bearer 3rd-party-token", r.Header.Get(model.HeaderAuth))
		}

		th.App.ch.servePluginRequest(rr, req, mockHandler)
		require.True(t, handlerCalled)
	})
}

func TestValidateCSRFForPluginRequest(t *testing.T) {
	th := Setup(t)

	t.Run("skip CSRF for non-cookie auth", func(t *testing.T) {
		session := &model.Session{Id: "sessionid", UserId: "userid", Token: "token"}
		session.GenerateCSRF()
		req := httptest.NewRequest(http.MethodPost, "/test", nil)

		result := validateCSRFForPluginRequest(th.Context, req, session, false, false)
		assert.True(t, result)
	})

	t.Run("skip CSRF for GET requests", func(t *testing.T) {
		session := &model.Session{Id: "sessionid", UserId: "userid", Token: "token"}
		session.GenerateCSRF()
		req := httptest.NewRequest(http.MethodGet, "/test", nil)

		result := validateCSRFForPluginRequest(th.Context, req, session, true, false)
		assert.True(t, result)
	})

	t.Run("valid CSRF token in header", func(t *testing.T) {
		session := &model.Session{Id: "sessionid", UserId: "userid", Token: "token"}
		expectedToken := session.GenerateCSRF()
		req := httptest.NewRequest(http.MethodPost, "/test", nil)
		req.Header.Set(model.HeaderCsrfToken, expectedToken)

		result := validateCSRFForPluginRequest(th.Context, req, session, true, false)
		assert.True(t, result)
	})

	t.Run("invalid CSRF token in header", func(t *testing.T) {
		session := &model.Session{Id: "sessionid", UserId: "userid", Token: "token"}
		session.GenerateCSRF()
		req := httptest.NewRequest(http.MethodPost, "/test", nil)
		req.Header.Set(model.HeaderCsrfToken, "invalid-token")

		result := validateCSRFForPluginRequest(th.Context, req, session, true, false)
		assert.False(t, result)
	})

	t.Run("valid CSRF token in form data", func(t *testing.T) {
		session := &model.Session{Id: "sessionid", UserId: "userid", Token: "token"}
		expectedToken := session.GetCSRF()
		formData := "csrf=" + expectedToken + "&other=value"
		req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(formData))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		result := validateCSRFForPluginRequest(th.Context, req, session, true, false)
		assert.True(t, result)
	})

	t.Run("XMLHttpRequest with strict enforcement disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalStrictCSRFEnforcement = false
		})

		session := &model.Session{Id: "sessionid", UserId: "userid", Token: "token"}
		session.GenerateCSRF()
		req := httptest.NewRequest(http.MethodPost, "/test", nil)
		req.Header.Set(model.HeaderRequestedWith, model.HeaderRequestedWithXML)

		result := validateCSRFForPluginRequest(th.Context, req, session, true, false)
		assert.True(t, result)
	})

	t.Run("XMLHttpRequest with strict enforcement enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalStrictCSRFEnforcement = true
		})

		session := &model.Session{Id: "sessionid", UserId: "userid", Token: "token"}
		session.GenerateCSRF()
		req := httptest.NewRequest(http.MethodPost, "/test", nil)
		req.Header.Set(model.HeaderRequestedWith, model.HeaderRequestedWithXML)

		result := validateCSRFForPluginRequest(th.Context, req, session, true, true)
		assert.False(t, result)
	})
}
