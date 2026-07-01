// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"errors"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// activateTeardownGuardTestPlugin compiles and activates a minimal plugin implementing
// MessageHasBeenPosted, returning the environment and the plugin's id.
func activateTeardownGuardTestPlugin(t *testing.T, opts ...EnvironmentOption) (*Environment, string) {
	t.Helper()

	pluginDir, err := os.MkdirTemp("", "mm-teardown-guard-plugin")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(pluginDir) })
	webappPluginDir, err := os.MkdirTemp("", "mm-teardown-guard-webapp")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(webappPluginDir) })

	pluginID := "test-teardown-guard-plugin"
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID), 0700))
	backend := filepath.Join(pluginDir, pluginID, "backend.exe")

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
	env, err := NewEnvironment(apiImpl, nil, pluginDir, webappPluginDir, logger, opts...)
	require.NoError(t, err)
	t.Cleanup(env.Shutdown)

	_, _, err = env.Activate(pluginID)
	require.NoError(t, err)
	require.True(t, env.IsActive(pluginID))

	return env, pluginID
}

func TestNewEnvironmentSkipsNilOptions(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	apiImpl := func(*model.Manifest) API { return nil }

	env, err := NewEnvironment(apiImpl, nil, t.TempDir(), t.TempDir(), logger, nil, WithTeardownGuardEnabled(false), nil)
	require.NoError(t, err)
	require.False(t, env.teardownGuardEnabled)
}

func TestNewEnvironmentOptionError(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	apiImpl := func(*model.Manifest) API { return nil }
	sentinel := errors.New("boom")
	failingOption := func(*Environment) error { return sentinel }

	env, err := NewEnvironment(apiImpl, nil, t.TempDir(), t.TempDir(), logger, failingOption)
	require.Nil(t, env)
	require.ErrorIs(t, err, sentinel)
}

func TestRunMultiPluginHookSkipsWhileWriteLockHeld(t *testing.T) {
	env, pluginID := activateTeardownGuardTestPlugin(t)

	p, ok := env.registeredPlugins.Load(pluginID)
	require.True(t, ok)
	rp := p.(registeredPlugin)

	rp.mu.Lock()
	var calls int
	env.RunMultiPluginHook(func(_ Hooks, _ *model.Manifest) bool {
		calls++
		return true
	}, MessageHasBeenPostedID)
	rp.mu.Unlock()
	require.Equal(t, 0, calls, "hook should be skipped while the write lock is held")

	calls = 0
	env.RunMultiPluginHook(func(_ Hooks, _ *model.Manifest) bool {
		calls++
		return true
	}, MessageHasBeenPostedID)
	require.Equal(t, 1, calls, "hook should run once the write lock is released")
}

func TestRunMultiPluginHookIgnoresLockWhenGuardDisabled(t *testing.T) {
	env, pluginID := activateTeardownGuardTestPlugin(t, WithTeardownGuardEnabled(false))

	p, ok := env.registeredPlugins.Load(pluginID)
	require.True(t, ok)
	rp := p.(registeredPlugin)

	rp.mu.Lock()
	defer rp.mu.Unlock()

	var calls int
	env.RunMultiPluginHook(func(_ Hooks, _ *model.Manifest) bool {
		calls++
		return true
	}, MessageHasBeenPostedID)
	require.Equal(t, 1, calls, "hook should still run when the teardown guard is disabled")
}

// TestDeactivateBlocksConcurrentHookDispatch hammers RunMultiPluginHookWithRPCErr concurrently with
// Deactivate and asserts the guard prevents any dispatch into the plugin's closing RPC connection:
// every observed call either completes cleanly (before teardown starts) or is skipped entirely (once
// teardown begins), but none surfaces a transport error. Run with -race to also confirm the guard
// itself is race-free.
func TestDeactivateBlocksConcurrentHookDispatch(t *testing.T) {
	env, pluginID := activateTeardownGuardTestPlugin(t)

	var wg sync.WaitGroup
	stop := make(chan struct{})
	var errCount atomic.Int32

	wg.Go(func() {
		for {
			select {
			case <-stop:
				return
			default:
			}
			runErr := env.RunMultiPluginHookWithRPCErr(func(hooks HooksWithRPCErr, _ *model.Manifest) (bool, error) {
				return true, hooks.MessageHasBeenPostedWithRPCErr(&Context{}, &model.Post{})
			}, MessageHasBeenPostedID)
			if runErr != nil {
				errCount.Add(1)
			}
		}
	})

	// Give the hammering goroutine a head start before tearing down.
	time.Sleep(10 * time.Millisecond)
	require.True(t, env.Deactivate(pluginID))

	close(stop)
	wg.Wait()

	require.Zero(t, errCount.Load(), "no hook dispatch should race the closing RPC connection")
}
