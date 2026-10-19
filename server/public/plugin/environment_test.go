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

func TestReservedPluginActivation(t *testing.T) {
	for _, component := range []string{"server", "webapp"} {
		t.Run(component, func(t *testing.T) {
			pluginDir, webappDir := t.TempDir(), t.TempDir()
			id := "Com.Mattermost.Server"
			bundleDir := filepath.Join(pluginDir, id)
			require.NoError(t, os.Mkdir(bundleDir, 0700))
			manifest := &model.Manifest{Id: id, Version: "1.0.0"}
			if component == "server" {
				manifest.Server = &model.ManifestServer{Executable: "backend"}
			} else {
				manifest.Webapp = &model.ManifestWebapp{BundlePath: "main.js"}
				require.NoError(t, os.WriteFile(filepath.Join(bundleDir, "main.js"), []byte("// fixture"), 0600))
			}
			data, err := json.Marshal(manifest)
			require.NoError(t, err)
			require.NoError(t, os.WriteFile(filepath.Join(bundleDir, "plugin.json"), data, 0600))
			env, err := NewEnvironment(func(*model.Manifest) API {
				t.Fatal("reserved plugin must not construct an API")
				return nil
			}, nil, pluginDir, webappDir, mlog.CreateConsoleTestLogger(t), nil)
			require.NoError(t, err)
			loaded, activated, err := env.Activate(id)
			require.ErrorContains(t, err, "reserved for the core server")
			require.Nil(t, loaded)
			require.False(t, activated)
			_, registered := env.registeredPlugins.Load(id)
			require.False(t, registered)
			entries, err := os.ReadDir(webappDir)
			require.NoError(t, err)
			require.Empty(t, entries, "reserved webapp must not be unpacked")

			// A stale running entry must not turn rejection into a successful no-op.
			rp := newRegisteredPlugin(&model.BundleInfo{Manifest: manifest})
			rp.State = model.PluginStateRunning
			env.registeredPlugins.Store(id, rp)
			_, _, err = env.Activate(id)
			require.ErrorContains(t, err, "reserved for the core server")
		})
	}
}

func TestReservedPluginReattach(t *testing.T) {
	manifest := &model.Manifest{Id: model.CoreServerPluginID, Server: &model.ManifestServer{Executable: "backend"}}
	env := &Environment{newAPIImpl: func(*model.Manifest) API {
		t.Fatal("reserved plugin must not construct an API")
		return nil
	}}
	require.ErrorContains(t, env.Reattach(manifest, nil), "reserved for the core server")
	_, registered := env.registeredPlugins.Load(manifest.Id)
	require.False(t, registered)

	rp := newRegisteredPlugin(&model.BundleInfo{Manifest: manifest})
	rp.State = model.PluginStateRunning
	env.registeredPlugins.Store(manifest.Id, rp)
	require.ErrorContains(t, env.Reattach(manifest, nil), "reserved for the core server")
	actual, _ := env.registeredPlugins.Load(manifest.Id)
	require.Equal(t, rp, actual, "reattach must not replace an existing registration")
}
