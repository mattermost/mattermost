// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// Both the wire-level client and the metrics-wrapping layer returned by
// supervisor.Hooks() must implement HooksWithRPCErr — RunMultiPluginHookWithRPCErr's
// type assertion targets the latter.
var (
	_ HooksWithRPCErr = (*hooksRPCClient)(nil)
	_ HooksWithRPCErr = (*hooksTimerLayer)(nil)
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
