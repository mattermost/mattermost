// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestAvailablePlugins(t *testing.T) {
	dir, err1 := os.MkdirTemp("", "mm-plugin-test")
	require.NoError(t, err1)
	t.Cleanup(func() {
		os.RemoveAll(dir)
	})

	logger := mlog.CreateConsoleTestLogger(t)
	env := Environment{
		pluginDir: dir,
		logger:    logger,
	}

	t.Run("Should be able to load available plugins", func(t *testing.T) {
		bundle1 := model.BundleInfo{
			Manifest: &model.Manifest{
				Id:      "someid",
				Version: "1",
			},
		}
		err := os.Mkdir(filepath.Join(dir, "plugin1"), 0700)
		require.NoError(t, err)
		defer os.RemoveAll(filepath.Join(dir, "plugin1"))

		path := filepath.Join(dir, "plugin1", "plugin.json")
		manifestJSON, jsonErr := json.Marshal(bundle1.Manifest)
		require.NoError(t, jsonErr)
		err = os.WriteFile(path, manifestJSON, 0644)
		require.NoError(t, err)

		bundles, err := env.Available()
		require.NoError(t, err)
		require.Len(t, bundles, 1)
	})

	t.Run("Should not be able to load plugins without a valid manifest file", func(t *testing.T) {
		err := os.Mkdir(filepath.Join(dir, "plugin2"), 0700)
		require.NoError(t, err)
		defer os.RemoveAll(filepath.Join(dir, "plugin2"))

		path := filepath.Join(dir, "plugin2", "manifest.json")
		err = os.WriteFile(path, []byte("{}"), 0644)
		require.NoError(t, err)

		bundles, err := env.Available()
		require.NoError(t, err)
		require.Len(t, bundles, 0)
	})

	t.Run("Should not be able to load plugins without a manifest file", func(t *testing.T) {
		err := os.Mkdir(filepath.Join(dir, "plugin3"), 0700)
		require.NoError(t, err)
		defer os.RemoveAll(filepath.Join(dir, "plugin3"))

		bundles, err := env.Available()
		require.NoError(t, err)
		require.Len(t, bundles, 0)
	})
}

func TestHasPluginImplementing(t *testing.T) {
	pluginDir, err := os.MkdirTemp("", "mm-haspluginimpl-plugin")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(pluginDir) })
	webappPluginDir, err := os.MkdirTemp("", "mm-haspluginimpl-webapp")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(webappPluginDir) })

	pluginID := "test-has-plugin-implementing"
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID), 0700))
	backend := filepath.Join(pluginDir, pluginID, "backend.exe")

	// This plugin implements MessageHasBeenPosted but not MessageHasBeenUpdated.
	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost/server/public/model"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	require.NoError(t, os.WriteFile(
		filepath.Join(pluginDir, pluginID, "plugin.json"),
		[]byte(`{"id":"`+pluginID+`","server":{"executable":"backend.exe"}}`),
		0600,
	))

	logger := mlog.CreateConsoleTestLogger(t)
	apiImpl := func(*model.Manifest) API { return nil }
	env, err := NewEnvironment(apiImpl, nil, pluginDir, webappPluginDir, logger, nil)
	require.NoError(t, err)
	t.Cleanup(env.Shutdown)

	t.Run("no plugins registered", func(t *testing.T) {
		require.False(t, env.HasPluginImplementing(MessageHasBeenPostedID))
	})

	_, _, err = env.Activate(pluginID)
	require.NoError(t, err)
	require.True(t, env.IsActive(pluginID))

	t.Run("active plugin implementing the hook", func(t *testing.T) {
		require.True(t, env.HasPluginImplementing(MessageHasBeenPostedID))
	})

	t.Run("active plugin not implementing the hook", func(t *testing.T) {
		require.False(t, env.HasPluginImplementing(MessageHasBeenUpdatedID))
	})

	t.Run("deactivated plugin no longer counts", func(t *testing.T) {
		require.True(t, env.Deactivate(pluginID))
		require.False(t, env.HasPluginImplementing(MessageHasBeenPostedID))
	})
}

// Deactivate reports whether it stopped an active plugin; callers use that to
// tell the webapp to unload the plugin, including webapp-only plugins.
func TestDeactivateWebappOnlyPlugin(t *testing.T) {
	pluginDir := t.TempDir()
	webappPluginDir := t.TempDir()

	pluginID := "test-webapp-only-plugin"
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID, "webapp"), 0700))
	require.NoError(t, os.WriteFile(
		filepath.Join(pluginDir, pluginID, "plugin.json"),
		[]byte(`{"id":"`+pluginID+`","webapp":{"bundle_path":"webapp/bundle.js"}}`),
		0600,
	))
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, pluginID, "webapp", "bundle.js"), []byte("console.log('webapp');"), 0600))

	logger := mlog.CreateConsoleTestLogger(t)
	apiImpl := func(*model.Manifest) API { return nil }
	env, err := NewEnvironment(apiImpl, nil, pluginDir, webappPluginDir, logger, nil)
	require.NoError(t, err)
	t.Cleanup(env.Shutdown)

	_, activated, err := env.Activate(pluginID)
	require.NoError(t, err)
	require.True(t, activated)
	require.True(t, env.IsActive(pluginID))

	require.True(t, env.Deactivate(pluginID))
	require.False(t, env.IsActive(pluginID))
	require.False(t, env.Deactivate(pluginID), "an inactive plugin is not deactivated again")
}

func TestReattachReportsStartFailure(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	apiImpl := func(*model.Manifest) API { return nil }
	env, err := NewEnvironment(apiImpl, nil, t.TempDir(), t.TempDir(), logger, nil)
	require.NoError(t, err)
	t.Cleanup(env.Shutdown)

	manifest := &model.Manifest{
		Id:               "test-reattach-failure",
		MinServerVersion: "99.0.0",
		Server:           &model.ManifestServer{Executable: "backend.exe"},
	}

	require.Error(t, env.Reattach(manifest, &model.PluginReattachConfig{}))
	require.False(t, env.IsActive(manifest.Id))
	require.Equal(t, model.PluginStateFailedToStart, env.GetPluginState(manifest.Id))
}
