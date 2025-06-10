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
		t.Cleanup(th.TearDown)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

		req, err := http.NewRequest("GET", "/plugins/plugin_id/public/file.txt", nil)
		require.NoError(t, err)

		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(th.App.ch.ServePluginPublicRequest)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("resolves path for valid plugin", func(t *testing.T) {
		th := Setup(t)
		t.Cleanup(th.TearDown)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

		path, _ := fileutils.FindDir("tests")
		fileReader, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)
		defer fileReader.Close()

		installPlugin(t, th, "testplugin")

		req, err := http.NewRequest("GET", "/plugins/testplugin/public/file.txt", nil)
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
		t.Cleanup(th.TearDown)

		installPlugin(t, th, "testplugin")

		req, err := http.NewRequest("GET", "/subpath/plugins/testplugin/public/file.txt", nil)
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
		t.Cleanup(th.TearDown)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

		req, err := http.NewRequest("GET", "/plugins/invalidplugin/public/file.txt", nil)
		require.NoError(t, err)

		rr := httptest.NewRecorder()
		th.App.ch.srv.Router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("fails attempting to break out of path", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://localhost:8065/subpath")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		th := Setup(t)
		t.Cleanup(th.TearDown)

		installPlugin(t, th, "testplugin")
		installPlugin(t, th, "testplugin2")

		req, err := http.NewRequest("GET", "/subpath/plugins/testplugin/public/../../testplugin2/file.txt", nil)
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
	defer th.TearDown()

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
	unauthReq := httptest.NewRequest("GET", "/plugins/foo/bar", nil)
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
