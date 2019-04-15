// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/require"
)

func TestPluginHealthCheck(t *testing.T) {
	for name, f := range map[string]func(*testing.T){
		"PluginHealthCheck_Success":                   testPluginHealthCheck_Success,
		"PluginHealthCheck_HookNotImplementedSuccess": testPluginHealthCheck_HookNotImplementedSuccess,
		"PluginHealthCheck_PluginPanicProcessCheck":   testPluginHealthCheck_PluginPanicProcessCheck,
		"PluginHealthCheck_RPCPingFail":               testPluginHealthCheck_RPCPingFail,
		"PluginHealthCheck_HealthCheckHookError":      testPluginHealthCheck_HealthCheckHookError,
		"PluginHealthCheck_ShouldDeactivatePlugin":    testShouldDeactivatePlugin,
	} {
		t.Run(name, f)
	}
}

func testPluginHealthCheck_Success(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) HealthCheck() error {
			return nil
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})

	supervisor, err := newSupervisor(bundle, log, nil)
	require.Nil(t, err)
	require.NotNil(t, supervisor)

	err = supervisor.PerformHealthCheck()
	require.Nil(t, err)
}

func testPluginHealthCheck_HookNotImplementedSuccess(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})

	supervisor, err := newSupervisor(bundle, log, nil)
	require.Nil(t, err)
	require.NotNil(t, supervisor)

	err = supervisor.PerformHealthCheck()
	require.Nil(t, err)
}

func testPluginHealthCheck_PluginPanicProcessCheck(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost-server/model"
			"github.com/mattermost/mattermost-server/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) HealthCheck() error {
			return nil
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			panic("Uncaught error")
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})

	supervisor, err := newSupervisor(bundle, log, nil)
	require.Nil(t, err)
	require.NotNil(t, supervisor)

	err = supervisor.PerformHealthCheck()
	require.Nil(t, err)

	supervisor.hooks.MessageWillBePosted(&Context{}, &model.Post{})
	time.Sleep(10 * time.Millisecond)

	err = supervisor.PerformHealthCheck()
	require.NotNil(t, err)
	require.Equal(t, "Plugin process not found, or not responding", err.Error())
}

func testPluginHealthCheck_RPCPingFail(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) HealthCheck() error {
			return nil
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})

	supervisor, err := newSupervisor(bundle, log, nil)
	require.Nil(t, err)
	require.NotNil(t, supervisor)

	err = supervisor.PerformHealthCheck()
	require.Nil(t, err)

	c, err := supervisor.client.Client()
	require.Nil(t, err)
	c.Close()

	err = supervisor.PerformHealthCheck()
	require.NotNil(t, err)
	require.Equal(t, "Plugin RPC connection is not responding", err.Error())
}

func testPluginHealthCheck_HealthCheckHookError(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		import (
			"errors"

			"github.com/mattermost/mattermost-server/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) HealthCheck() error {
			return errors.New("I am not healthy!")
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})

	supervisor, err := newSupervisor(bundle, log, nil)
	require.Nil(t, err)
	require.NotNil(t, supervisor)

	err = supervisor.PerformHealthCheck()
	require.NotNil(t, err)
	require.Equal(t, "I am not healthy!", err.Error())
}

func testShouldDeactivatePlugin(t *testing.T) {
	health := newPluginHealthStatus()
	require.NotNil(t, health)

	// No failures, don't restart
	result := shouldDeactivatePlugin(health)
	require.Equal(t, false, result)

	now := time.Now()

	// Failures are recent enough to restart
	health = newPluginHealthStatus()
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.2*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.1*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now)

	result = shouldDeactivatePlugin(health)
	require.Equal(t, true, result)

	// Failures are too spaced out to warrant a restart
	health = newPluginHealthStatus()
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*2*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*1*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now)

	result = shouldDeactivatePlugin(health)
	require.Equal(t, false, result)

	// Not enough failures are present to warrant a restart
	health = newPluginHealthStatus()
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.1*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now)

	result = shouldDeactivatePlugin(health)
	require.Equal(t, false, result)
}
