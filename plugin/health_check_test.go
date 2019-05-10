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
		"PluginHealthCheck_Success":                 testPluginHealthCheck_Success,
		"PluginHealthCheck_PluginPanicProcessCheck": testPluginHealthCheck_PluginPanicProcessCheck,
		"PluginHealthCheck_RPCPingFail":             testPluginHealthCheck_RPCPingFail,
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

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	err = ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)
	require.NoError(t, err)

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

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			panic("Uncaught error")
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	err = ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)
	require.NoError(t, err)

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

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`, backend)

	err = ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)
	require.NoError(t, err)

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

func TestShouldDeactivatePlugin(t *testing.T) {
	h := newPluginHealthStatus()
	require.NotNil(t, h)

	// No failures, don't restart
	result := shouldDeactivatePlugin(h)
	require.Equal(t, false, result)

	now := time.Now()

	// Failures are recent enough to restart
	h = newPluginHealthStatus()
	h.failTimeStamps = append(h.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.2*time.Minute))
	h.failTimeStamps = append(h.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.1*time.Minute))
	h.failTimeStamps = append(h.failTimeStamps, now)

	result = shouldDeactivatePlugin(h)
	require.Equal(t, true, result)

	// Failures are too spaced out to warrant a restart
	h = newPluginHealthStatus()
	h.failTimeStamps = append(h.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*2*time.Minute))
	h.failTimeStamps = append(h.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*1*time.Minute))
	h.failTimeStamps = append(h.failTimeStamps, now)

	result = shouldDeactivatePlugin(h)
	require.Equal(t, false, result)

	// Not enough failures are present to warrant a restart
	h = newPluginHealthStatus()
	h.failTimeStamps = append(h.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.1*time.Minute))
	h.failTimeStamps = append(h.failTimeStamps, now)

	result = shouldDeactivatePlugin(h)
	require.Equal(t, false, result)
}
