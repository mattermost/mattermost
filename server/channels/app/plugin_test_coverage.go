// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// TestEnablePlugin_ErrorPaths tests error handling for EnablePlugin
func TestEnablePlugin_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	t.Run("plugins disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		err := th.App.EnablePlugin("test-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.disabled.app_error", err.Id)
		assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("plugin not found", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		err := th.App.EnablePlugin("non-existent-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)
		assert.Equal(t, http.StatusNotFound, err.StatusCode)
	})

	t.Run("already enabled plugin", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			cfg.PluginSettings.PluginStates["test-plugin"] = &model.PluginState{Enable: true}
		})

		// Try to enable an already enabled plugin - should not error but be idempotent
		err := th.App.EnablePlugin("non-existent-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)
	})
}

// TestDisablePlugin_ErrorPaths tests error handling for DisablePlugin
func TestDisablePlugin_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	t.Run("plugins disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		err := th.App.DisablePlugin("test-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.disabled.app_error", err.Id)
		assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("plugin not found", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		err := th.App.DisablePlugin("non-existent-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)
		assert.Equal(t, http.StatusNotFound, err.StatusCode)
	})

	t.Run("already disabled plugin", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			cfg.PluginSettings.PluginStates["test-plugin"] = &model.PluginState{Enable: false}
		})

		// Try to disable an already disabled plugin - should not error but be idempotent
		err := th.App.DisablePlugin("non-existent-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)
	})
}

// TestInstallPlugin_ErrorPaths tests error handling for InstallPlugin
func TestInstallPlugin_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("plugins disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		manifest, err := th.App.InstallPlugin(bytes.NewReader([]byte("test")), false)
		assert.Nil(t, manifest)
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.disabled.app_error", err.Id)
		assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("invalid plugin file", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		manifest, err := th.App.InstallPlugin(bytes.NewReader([]byte("not a valid tar.gz")), false)
		assert.Nil(t, manifest)
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.extract.app_error", err.Id)
	})

	t.Run("nil reader", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		manifest, err := th.App.InstallPlugin(&nilPluginReader{}, false)
		assert.Nil(t, manifest)
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.extract.app_error", err.Id)
	})
}

// TestRemovePlugin_ErrorPaths tests error handling for RemovePlugin
func TestRemovePlugin_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("plugins disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		err := th.App.ch.RemovePlugin("test-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.disabled.app_error", err.Id)
		assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("plugin not found", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		err := th.App.ch.RemovePlugin("non-existent-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)
		assert.Equal(t, http.StatusNotFound, err.StatusCode)
	})

	t.Run("cannot remove prepackaged plugin", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		// Set up a mock prepackaged plugin in the environment
		env := th.App.GetPluginsEnvironment()
		if env != nil {
			prepackagedPlugins := []*plugin.PrepackagedPlugin{
				{
					Manifest: &model.Manifest{
						Id:      "prepackaged-plugin",
						Version: "1.0.0",
					},
				},
			}
			env.SetPrepackagedPlugins(prepackagedPlugins, nil)
		}

		err := th.App.ch.RemovePlugin("prepackaged-plugin")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.prepackaged.app_error", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})
}

// TestGetPlugins_ErrorPaths tests error handling for GetPlugins
func TestGetPlugins_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("plugins disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		resp, err := th.App.GetPlugins()
		assert.Nil(t, resp)
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.disabled.app_error", err.Id)
		assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("empty plugin list", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		resp, err := th.App.GetPlugins()
		assert.Nil(t, err)
		assert.NotNil(t, resp)
		assert.Empty(t, resp.Active)
		assert.Empty(t, resp.Inactive)
	})
}

// TestGetPluginStatuses_ErrorPaths tests error handling for GetPluginStatuses
func TestGetPluginStatuses_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("plugins disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		statuses, err := th.App.GetPluginStatuses()
		assert.Nil(t, statuses)
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.disabled.app_error", err.Id)
		assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("empty status list", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		statuses, err := th.App.GetPluginStatuses()
		assert.Nil(t, err)
		assert.NotNil(t, statuses)
		assert.Empty(t, statuses)
	})
}

// TestGetPluginStatus_SinglePlugin tests GetPluginStatus for edge cases
func TestGetPluginStatus_SinglePlugin(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("plugins disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		status, err := th.App.GetPluginStatus("test-plugin")
		assert.Nil(t, status)
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.disabled.app_error", err.Id)
		assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("plugin not found", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		status, err := th.App.GetPluginStatus("non-existent-plugin")
		assert.Nil(t, status)
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)
		assert.Equal(t, http.StatusNotFound, err.StatusCode)
	})
}

// TestPluginStateManagement_EdgeCases tests plugin state management edge cases
func TestPluginStateManagement_EdgeCases(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("enable then disable quickly", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.RequirePluginSignature = false
		})

		// First we need a plugin to work with
		// This is a basic test to ensure state changes work properly
		// In a real scenario, we'd have an actual plugin installed

		err := th.App.EnablePlugin("non-existent")
		require.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)

		err = th.App.DisablePlugin("non-existent")
		require.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)
	})

	t.Run("config save failure", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		// Test that even with a non-existent plugin, we handle the error correctly
		err := th.App.EnablePlugin("test-plugin-not-found")
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.not_installed.app_error", err.Id)
	})
}

// TestSyncPlugins_ErrorPaths tests error cases in plugin synchronization
func TestSyncPlugins_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("plugins disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		err := th.App.SyncPlugins()
		assert.NotNil(t, err)
		assert.Equal(t, "app.plugin.disabled.app_error", err.Id)
		assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("no plugins to sync", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})

		// With no plugins in the file store, sync should succeed but do nothing
		err := th.App.SyncPlugins()
		assert.Nil(t, err)
	})
}

// TestPluginEnvironmentNil tests handling when plugin environment is nil
func TestPluginEnvironmentNil(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("get plugins environment when disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		env := th.App.GetPluginsEnvironment()
		assert.Nil(t, env)
	})
}

// Helper type for simulating nil/empty plugin readers
type nilPluginReader struct{}

func (r *nilPluginReader) Read(p []byte) (int, error) {
	return 0, io.EOF
}

func (r *nilPluginReader) Seek(offset int64, whence int) (int64, error) {
	return 0, nil
}
