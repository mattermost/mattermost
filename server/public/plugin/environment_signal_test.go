// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// activationProbeAPI records what the environment reports about a plugin while its OnActivate
// runs. The plugin calls ListSignalContributions from OnActivate to trigger the probe.
type activationProbeAPI struct {
	API
	env   **Environment
	id    string
	probe func(env *Environment, id string)
}

func (a *activationProbeAPI) ListSignalContributions() (*model.SignalCatalog, error) {
	a.probe(*a.env, a.id)
	return &model.SignalCatalog{}, nil
}

type lifecycleEvents struct {
	mu     sync.Mutex
	events []string
}

func (l *lifecycleEvents) record(kind string) func(string) {
	return func(id string) {
		l.mu.Lock()
		defer l.mu.Unlock()
		l.events = append(l.events, kind+":"+id)
	}
}

// take returns and clears the events recorded so far.
func (l *lifecycleEvents) take() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	events := l.events
	l.events = nil
	return events
}

func writeTestPlugin(t *testing.T, pluginDir, pluginID, code string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Join(pluginDir, pluginID), 0700))
	utils.CompileGo(t, code, filepath.Join(pluginDir, pluginID, "backend.exe"))
	require.NoError(t, os.WriteFile(
		filepath.Join(pluginDir, pluginID, "plugin.json"),
		[]byte(`{"id":"`+pluginID+`","server":{"executable":"backend.exe"}}`),
		0600,
	))
}

func TestEnvironmentLifecycleCallbacks(t *testing.T) {
	const (
		okID   = "test-lifecycle-ok"
		failID = "test-lifecycle-fail"
	)
	pluginDir := t.TempDir()
	writeTestPlugin(t, pluginDir, okID, `
		package main

		import (
			"github.com/mattermost/mattermost/server/public/model"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnActivate() error {
			_, err := p.API.ListSignalContributions()
			return err
		}

		func (p *MyPlugin) OnSignal(c *plugin.Context, d *model.SignalDelivery) {
			if d.Signal == "crash" {
				panic("crash")
			}
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`)
	writeTestPlugin(t, pluginDir, failID, `
		package main

		import (
			"errors"

			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnActivate() error {
			return errors.New("activation failed")
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`)

	var (
		env    *Environment
		probes []map[string]bool
		mu     sync.Mutex
	)
	probe := func(env *Environment, id string) {
		_, hooksErr := env.HooksForPlugin(id)
		mu.Lock()
		defer mu.Unlock()
		probes = append(probes, map[string]bool{
			"OnSignal":     env.PluginImplements(id, OnSignalID),
			"OnActionCall": env.PluginImplements(id, OnActionCallID),
			"hooksReady":   hooksErr == nil,
		})
	}
	apiImpl := func(m *model.Manifest) API {
		return &activationProbeAPI{env: &env, id: m.Id, probe: probe}
	}

	events := &lifecycleEvents{}
	var err error
	env, err = NewEnvironment(apiImpl, nil, pluginDir, t.TempDir(), mlog.CreateConsoleTestLogger(t), nil,
		WithOnActivate(events.record("activate")),
		WithOnDeactivate(events.record("deactivate")),
	)
	require.NoError(t, err)

	t.Run("activate runs the callback before OnActivate", func(t *testing.T) {
		_, activated, err := env.Activate(okID)
		require.NoError(t, err)
		require.True(t, activated)
		assert.Equal(t, []string{"activate:" + okID}, events.take())

		mu.Lock()
		require.Len(t, probes, 1)
		assert.Equal(t, map[string]bool{"OnSignal": true, "OnActionCall": false, "hooksReady": false}, probes[0],
			"implemented hooks are known while OnActivate runs, before hooks are reachable")
		mu.Unlock()

		assert.True(t, env.PluginImplements(okID, OnSignalID))
		assert.False(t, env.PluginImplements(okID, OnActionCallID))
		assert.False(t, env.PluginImplements(okID, -1))
		assert.False(t, env.PluginImplements(okID, TotalHooksID))
		assert.False(t, env.PluginImplements("unknown", OnSignalID))
	})

	t.Run("a failed OnActivate runs the deactivate callback", func(t *testing.T) {
		_, _, err := env.Activate(failID)
		require.Error(t, err)
		assert.Equal(t, []string{"activate:" + failID, "deactivate:" + failID}, events.take())
		assert.False(t, env.PluginImplements(failID, OnSignalID))
	})

	t.Run("deactivate", func(t *testing.T) {
		require.True(t, env.Deactivate(okID))
		assert.Equal(t, []string{"deactivate:" + okID}, events.take())
		assert.False(t, env.PluginImplements(okID, OnSignalID))
	})

	t.Run("restart", func(t *testing.T) {
		_, _, err := env.Activate(okID)
		require.NoError(t, err)
		events.take()

		require.NoError(t, env.RestartPlugin(okID))
		assert.Equal(t, []string{"deactivate:" + okID, "activate:" + okID}, events.take())
		assert.True(t, env.PluginImplements(okID, OnSignalID))
	})

	t.Run("health check restart", func(t *testing.T) {
		hooks, err := env.HooksForPlugin(okID)
		require.NoError(t, err)
		hooks.OnSignal(&Context{}, &model.SignalDelivery{Signal: "crash"})
		require.Eventually(t, func() bool { return env.PerformHealthCheck(okID) != nil }, 10*time.Second, 50*time.Millisecond)

		newPluginHealthCheckJob(env).CheckPlugin(okID)
		assert.Equal(t, []string{"deactivate:" + okID, "activate:" + okID}, events.take())
		assert.True(t, env.IsActive(okID))
	})

	t.Run("shutdown", func(t *testing.T) {
		env.Shutdown()
		assert.ElementsMatch(t, []string{"deactivate:" + okID, "deactivate:" + failID}, events.take())
	})
}

func TestNewEnvironmentWithoutCallbacks(t *testing.T) {
	pluginDir := t.TempDir()
	const pluginID = "test-no-callbacks"
	writeTestPlugin(t, pluginDir, pluginID, `
		package main

		import "github.com/mattermost/mattermost/server/public/plugin"

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`)

	env, err := NewEnvironment(func(*model.Manifest) API { return nil }, nil, pluginDir, t.TempDir(), mlog.CreateConsoleTestLogger(t), nil)
	require.NoError(t, err)
	t.Cleanup(env.Shutdown)

	_, _, err = env.Activate(pluginID)
	require.NoError(t, err)
	require.NoError(t, env.RestartPlugin(pluginID))
	require.True(t, env.Deactivate(pluginID))
}
