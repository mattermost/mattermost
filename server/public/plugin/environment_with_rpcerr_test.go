// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"errors"
	"io"
	"net/rpc"
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

func TestRunMultiPluginHookWithRPCErr(t *testing.T) {
	pluginDir, err := os.MkdirTemp("", "mm-rpcerr-plugin")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(pluginDir) })
	webappPluginDir, err := os.MkdirTemp("", "mm-rpcerr-webapp")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(webappPluginDir) })

	pluginID1 := "test-rpc-err-plugin"
	pluginID2 := "test-rpc-err-plugin-2"
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID1), 0700))
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID2), 0700))
	backend1 := filepath.Join(pluginDir, pluginID1, "backend.exe")
	backend2 := filepath.Join(pluginDir, pluginID2, "backend.exe")

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
	`, backend1)
	copyExecutable(t, backend1, backend2)

	require.NoError(t, os.WriteFile(
		filepath.Join(pluginDir, pluginID1, "plugin.json"),
		[]byte(`{"id":"`+pluginID1+`","server":{"executable":"backend.exe"}}`),
		0600,
	))
	require.NoError(t, os.WriteFile(
		filepath.Join(pluginDir, pluginID2, "plugin.json"),
		[]byte(`{"id":"`+pluginID2+`","server":{"executable":"backend.exe"}}`),
		0600,
	))

	logger := mlog.CreateConsoleTestLogger(t)
	apiImpl := func(*model.Manifest) API { return nil }
	env, err := NewEnvironment(apiImpl, nil, pluginDir, webappPluginDir, logger, nil)
	require.NoError(t, err)
	t.Cleanup(env.Shutdown)

	_, _, err = env.Activate(pluginID1)
	require.NoError(t, err)
	require.True(t, env.IsActive(pluginID1))
	_, _, err = env.Activate(pluginID2)
	require.NoError(t, err)
	require.True(t, env.IsActive(pluginID2))

	t.Run("both plugins healthy - closure invoked once per plugin", func(t *testing.T) {
		seen := map[string]int{}
		runErr := env.RunMultiPluginHookWithRPCErr(func(hooks HooksWithRPCErr, manifest *model.Manifest) (bool, error) {
			seen[manifest.Id]++
			require.NoError(t, hooks.MessageHasBeenPostedWithRPCErr(&Context{}, &model.Post{}))
			return true, nil
		}, MessageHasBeenPostedID)
		require.NoError(t, runErr)
		require.Equal(t, map[string]int{pluginID1: 1, pluginID2: 1}, seen)
	})

	t.Run("closure error propagates and stops iteration", func(t *testing.T) {
		sentinel := errors.New("from closure")
		var calls int
		runErr := env.RunMultiPluginHookWithRPCErr(func(_ HooksWithRPCErr, _ *model.Manifest) (bool, error) {
			calls++
			return true, sentinel
		}, MessageHasBeenPostedID)
		require.ErrorIs(t, runErr, sentinel)
		require.Equal(t, 1, calls)
	})

	t.Run("hook id not implemented - closure never invoked", func(t *testing.T) {
		var calls int
		runErr := env.RunMultiPluginHookWithRPCErr(func(_ HooksWithRPCErr, _ *model.Manifest) (bool, error) {
			calls++
			return true, nil
		}, MessageHasBeenUpdatedID)
		require.NoError(t, runErr)
		require.Equal(t, 0, calls)
	})

	t.Run("rpc transport error surfaces after plugin process dies", func(t *testing.T) {
		rp, ok := env.registeredPlugins.Load(pluginID1)
		require.True(t, ok)
		sup := rp.(registeredPlugin).supervisor
		require.NotNil(t, sup)
		sup.client.Kill()

		// Give the rpc client a moment to notice the dead connection.
		require.Eventually(t, func() bool {
			var rpcErr error
			_ = env.RunMultiPluginHookWithRPCErr(func(hooks HooksWithRPCErr, manifest *model.Manifest) (bool, error) {
				if manifest.Id != pluginID1 {
					return true, nil
				}
				rpcErr = hooks.MessageHasBeenPostedWithRPCErr(&Context{}, &model.Post{})
				return true, nil
			}, MessageHasBeenPostedID)
			return rpcErr != nil
		}, 2*time.Second, 50*time.Millisecond)
	})
}

// TestShutdownNoRPCErrorsDuringConcurrentHookDispatch verifies that concurrent
// RunMultiPluginHookWithRPCErr calls during Shutdown do not observe "connection
// is shut down" errors.
//
// The race: Shutdown closes each plugin's RPC connection (supervisor.Shutdown)
// before removing it from registeredPlugins, leaving a window where the plugin
// still appears active but its transport is dead.  The fix sets the plugin state
// to NotRunning before closing the RPC, so concurrent callers skip it cleanly.
func TestShutdownNoRPCErrorsDuringConcurrentHookDispatch(t *testing.T) {
	pluginDir, err := os.MkdirTemp("", "mm-shutdown-race-plugin")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(pluginDir) })
	webappPluginDir, err := os.MkdirTemp("", "mm-shutdown-race-webapp")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(webappPluginDir) })

	fastID := "test-shutdown-race-fast"
	slowID := "test-shutdown-race-slow"
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, fastID), 0700))
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, slowID), 0700))

	fastBackend := filepath.Join(pluginDir, fastID, "backend.exe")
	slowBackend := filepath.Join(pluginDir, slowID, "backend.exe")

	// fast plugin: instant OnDeactivate
	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost/server/public/model"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type FastPlugin struct{ plugin.MattermostPlugin }

		func (p *FastPlugin) MessageHasBeenPosted(_ *plugin.Context, _ *model.Post) {}

		func main() { plugin.ClientMain(&FastPlugin{}) }
	`, fastBackend)

	// slow plugin: OnDeactivate blocks until the test signals it via MessageWillBePosted,
	// keeping Shutdown's wg.Wait alive so the fast plugin's entry lingers in registeredPlugins.
	utils.CompileGo(t, `
		package main

		import (
			"sync"

			"github.com/mattermost/mattermost/server/public/model"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type SlowPlugin struct {
			plugin.MattermostPlugin
			once    sync.Once
			proceed chan struct{}
		}

		func (p *SlowPlugin) OnActivate() error {
			p.proceed = make(chan struct{})
			return nil
		}

		func (p *SlowPlugin) OnDeactivate() error {
			<-p.proceed
			return nil
		}

		func (p *SlowPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
			p.once.Do(func() { close(p.proceed) })
			return nil, ""
		}

		func (p *SlowPlugin) MessageHasBeenPosted(_ *plugin.Context, _ *model.Post) {}

		func main() { plugin.ClientMain(&SlowPlugin{}) }
	`, slowBackend)

	require.NoError(t, os.WriteFile(
		filepath.Join(pluginDir, fastID, "plugin.json"),
		[]byte(`{"id":"`+fastID+`","server":{"executable":"backend.exe"}}`),
		0600,
	))
	require.NoError(t, os.WriteFile(
		filepath.Join(pluginDir, slowID, "plugin.json"),
		[]byte(`{"id":"`+slowID+`","server":{"executable":"backend.exe"}}`),
		0600,
	))

	logger := mlog.CreateConsoleTestLogger(t)
	apiImpl := func(*model.Manifest) API { return nil }
	env, err := NewEnvironment(apiImpl, nil, pluginDir, webappPluginDir, logger, nil)
	require.NoError(t, err)

	_, _, err = env.Activate(fastID)
	require.NoError(t, err)
	_, _, err = env.Activate(slowID)
	require.NoError(t, err)

	// Race window: Shutdown is running concurrently.  After the fast plugin's RPC
	// is closed (it finishes OnDeactivate first) but before registeredPlugins is
	// cleaned up (gated on the slow plugin finishing), concurrent hook dispatches
	// must not observe net/rpc.ErrShutdown.
	//
	// The slow plugin blocks in OnDeactivate until we call MessageWillBePosted,
	// giving us a controlled window to dispatch hooks while the fast plugin's RPC
	// is already closed.  Each dispatch involves IPC (a Unix socket round-trip),
	// which yields to the scheduler and lets the fast plugin's teardown goroutine run.
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		env.Shutdown()
	}()

	var rpcErrs []error
	for range 200 {
		_ = env.RunMultiPluginHookWithRPCErr(func(hooks HooksWithRPCErr, _ *model.Manifest) (bool, error) {
			if rpcErr := hooks.MessageHasBeenPostedWithRPCErr(&Context{}, &model.Post{}); rpcErr != nil {
				rpcErrs = append(rpcErrs, rpcErr)
			}
			return true, nil
		}, MessageHasBeenPostedID)
	}

	// Signal the slow plugin to finish OnDeactivate, unblocking Shutdown.
	env.RunMultiPluginHook(func(hooks Hooks, _ *model.Manifest) bool {
		hooks.MessageWillBePosted(&Context{}, &model.Post{})
		return true
	}, MessageWillBePostedID)

	<-shutdownDone

	// Filter to only the canonical shutdown error so the test isn't brittle
	// against other transient RPC errors (e.g. EOF on race-y reads).
	var shutdownErrs []error
	for _, e := range rpcErrs {
		if errors.Is(e, rpc.ErrShutdown) {
			shutdownErrs = append(shutdownErrs, e)
		}
	}
	assert.Empty(t, shutdownErrs,
		"RunMultiPluginHookWithRPCErr dispatched to a plugin whose RPC connection was already closed during Shutdown")
}

func copyExecutable(t *testing.T, src, dst string) {
	t.Helper()
	in, err := os.Open(src)
	require.NoError(t, err)
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0700)
	require.NoError(t, err)
	defer out.Close()
	_, err = io.Copy(out, in)
	require.NoError(t, err)
}
