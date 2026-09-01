// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestPluginMarksNotRunningAfterOnDeactivate verifies the state transitions during plugin
// teardown, for both Shutdown and Deactivate. While a plugin's OnDeactivate is still running,
// IsActive must return true so that hook dispatches the plugin makes to itself (e.g. CreatePost)
// are not rejected. Once OnDeactivate completes, IsActive must return false before the RPC
// connection is torn down.
func TestPluginMarksNotRunningAfterOnDeactivate(t *testing.T) {
	testCases := []struct {
		name     string
		teardown func(env *Environment, pluginID string)
	}{
		{
			name: "Shutdown",
			teardown: func(env *Environment, _ string) {
				env.Shutdown()
			},
		},
		{
			name: "Deactivate",
			teardown: func(env *Environment, pluginID string) {
				env.Deactivate(pluginID)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			pluginDir, err := os.MkdirTemp("", "mm-shutdown-state-plugin")
			require.NoError(t, err)
			t.Cleanup(func() { os.RemoveAll(pluginDir) })
			webappPluginDir, err := os.MkdirTemp("", "mm-shutdown-state-webapp")
			require.NoError(t, err)
			t.Cleanup(func() { os.RemoveAll(webappPluginDir) })

			pluginID := "test-shutdown-state-plugin"
			require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID), 0700))
			backend := filepath.Join(pluginDir, pluginID, "backend.exe")

			// OnDeactivate blocks until the test signals it via MessageWillBePosted.
			utils.CompileGo(t, `
				package main

				import (
					"sync"

					"github.com/mattermost/mattermost/server/public/model"
					"github.com/mattermost/mattermost/server/public/plugin"
				)

				type MyPlugin struct {
					plugin.MattermostPlugin
					once    sync.Once
					proceed chan struct{}
				}

				func (p *MyPlugin) OnActivate() error {
					p.proceed = make(chan struct{})
					return nil
				}

				func (p *MyPlugin) OnDeactivate() error {
					<-p.proceed
					return nil
				}

				func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
					p.once.Do(func() { close(p.proceed) })
					return nil, ""
				}

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

			_, _, err = env.Activate(pluginID)
			require.NoError(t, err)
			require.True(t, env.IsActive(pluginID))

			teardownDone := make(chan struct{})
			go func() {
				defer close(teardownDone)
				tc.teardown(env, pluginID)
			}()

			// Plugin is blocked in OnDeactivate — state must still be Running so a plugin
			// dispatching hooks back to itself from OnDeactivate isn't rejected.
			require.True(t, env.IsActive(pluginID), "IsActive should be true while OnDeactivate is blocking")

			// Signal the plugin to complete OnDeactivate.
			env.RunMultiPluginHook(func(hooks Hooks, _ *model.Manifest) bool {
				hooks.MessageWillBePosted(&Context{}, &model.Post{})
				return true
			}, MessageWillBePostedID)

			select {
			case <-teardownDone:
			case <-time.After(2 * time.Second):
				t.Fatalf("%s did not return", tc.name)
			}

			require.False(t, env.IsActive(pluginID))
		})
	}
}

// TestShutdownAfterDeactivateNoOnDeactivateRPC verifies that shutting down the environment after a
// plugin has already been deactivated does not dispatch a second OnDeactivate over the plugin's
// already-closed RPC connection. Previously Shutdown ran deactivateAndTeardown unconditionally for
// every registered plugin, dispatching OnDeactivate to inactive plugins and logging a spurious
// "connection is shut down" error.
func TestShutdownAfterDeactivateNoOnDeactivateRPC(t *testing.T) {
	pluginDir, err := os.MkdirTemp("", "mm-shutdown-after-deactivate-plugin")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(pluginDir) })
	webappPluginDir, err := os.MkdirTemp("", "mm-shutdown-after-deactivate-webapp")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(webappPluginDir) })

	pluginID := "test-shutdown-after-deactivate-plugin"
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID), 0700))
	backend := filepath.Join(pluginDir, pluginID, "backend.exe")

	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnDeactivate() error {
			return nil
		}

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
	var buf mlog.Buffer
	require.NoError(t, mlog.AddWriterTarget(logger, &buf, true, mlog.LvlError))

	apiImpl := func(*model.Manifest) API { return nil }
	env, err := NewEnvironment(apiImpl, nil, pluginDir, webappPluginDir, logger, nil)
	require.NoError(t, err)

	_, _, err = env.Activate(pluginID)
	require.NoError(t, err)
	require.True(t, env.IsActive(pluginID))

	// Deactivate tears down the RPC connection but leaves the plugin registered.
	require.True(t, env.Deactivate(pluginID))
	require.False(t, env.IsActive(pluginID))

	// Shutdown must not dispatch OnDeactivate again to the now-inactive plugin.
	env.Shutdown()

	require.NoError(t, logger.Flush())
	assert.NotContains(t, buf.String(), "OnDeactivate",
		"Shutdown dispatched OnDeactivate to an already-deactivated plugin")
}

// TestDeactivateReconcilesPluginState verifies that deactivation always reconciles the plugin to
// PluginStateNotRunning, clearing any prior error state, and that the health check job's ordering
// (deactivate, then set state) still records PluginStateFailedToStayRunning.
func TestDeactivateReconcilesPluginState(t *testing.T) {
	pluginDir, err := os.MkdirTemp("", "mm-deactivate-state-plugin")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(pluginDir) })
	webappPluginDir, err := os.MkdirTemp("", "mm-deactivate-state-webapp")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(webappPluginDir) })

	pluginID := "test-deactivate-state-plugin"
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID), 0700))
	backend := filepath.Join(pluginDir, pluginID, "backend.exe")

	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnDeactivate() error {
			return nil
		}

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

	t.Run("deactivating an inactive, failed plugin clears the error state", func(t *testing.T) {
		_, _, err = env.Activate(pluginID)
		require.NoError(t, err)
		require.True(t, env.IsActive(pluginID))

		// Tear the plugin down, then simulate the health check marking it as failed while it
		// remains registered but inactive.
		require.True(t, env.Deactivate(pluginID))
		require.False(t, env.IsActive(pluginID))
		env.setPluginState(pluginID, model.PluginStateFailedToStayRunning)

		// Deactivating an already-inactive plugin (e.g. on Shutdown or an explicit disable) must
		// reconcile the error state back to not running rather than leaving it as failed.
		require.False(t, env.Deactivate(pluginID))
		assert.Equal(t, model.PluginStateNotRunning, env.GetPluginState(pluginID))
	})

	t.Run("health check ordering records FailedToStayRunning", func(t *testing.T) {
		_, _, err = env.Activate(pluginID)
		require.NoError(t, err)
		require.True(t, env.IsActive(pluginID))

		// Mirror PluginHealthCheckJob.CheckPlugin: deactivate first, then record the failed state.
		require.True(t, env.Deactivate(pluginID))
		env.setPluginState(pluginID, model.PluginStateFailedToStayRunning)

		assert.Equal(t, model.PluginStateFailedToStayRunning, env.GetPluginState(pluginID))
	})
}
