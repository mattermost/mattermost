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

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils/fileutils"
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
