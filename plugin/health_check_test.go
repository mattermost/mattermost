// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/stretchr/testify/require"
)

func TestPluginHealthCheck(t *testing.T) {
	for name, f := range map[string]func(*testing.T){
		"PluginHealthCheck_Success": testPluginHealthCheckSuccess,
		"PluginHealthCheck_Panic":   testPluginHealthCheckPanic,
	} {
		t.Run(name, f)
	}
}

func testPluginHealthCheckSuccess(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
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

	supervisor, err := newSupervisor(bundle, nil, log, nil)
	require.Nil(t, err)
	require.NotNil(t, supervisor)
	defer supervisor.Shutdown()

	err = supervisor.PerformHealthCheck()
	require.Nil(t, err)
}

func testPluginHealthCheckPanic(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/model"
			"github.com/mattermost/mattermost-server/v5/plugin"
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

	supervisor, err := newSupervisor(bundle, nil, log, nil)
	require.Nil(t, err)
	require.NotNil(t, supervisor)
	defer supervisor.Shutdown()

	err = supervisor.PerformHealthCheck()
	require.Nil(t, err)

	supervisor.hooks.MessageWillBePosted(&Context{}, &model.Post{})

	err = supervisor.PerformHealthCheck()
	require.NotNil(t, err)
}

func TestShouldDeactivatePlugin(t *testing.T) {
	// No failures, don't restart
	ftime := []time.Time{}
	result := shouldDeactivatePlugin(ftime)
	require.Equal(t, false, result)

	now := time.Now()

	// Failures are recent enough to restart
	ftime = []time.Time{}
	ftime = append(ftime, now.Add(-HEALTH_CHECK_DEACTIVATION_WINDOW/10*2))
	ftime = append(ftime, now.Add(-HEALTH_CHECK_DEACTIVATION_WINDOW/10))
	ftime = append(ftime, now)

	result = shouldDeactivatePlugin(ftime)
	require.Equal(t, true, result)

	// Failures are too spaced out to warrant a restart
	ftime = []time.Time{}
	ftime = append(ftime, now.Add(-HEALTH_CHECK_DEACTIVATION_WINDOW*2))
	ftime = append(ftime, now.Add(-HEALTH_CHECK_DEACTIVATION_WINDOW*1))
	ftime = append(ftime, now)

	result = shouldDeactivatePlugin(ftime)
	require.Equal(t, false, result)

	// Not enough failures are present to warrant a restart
	ftime = []time.Time{}
	ftime = append(ftime, now.Add(-HEALTH_CHECK_DEACTIVATION_WINDOW/10))
	ftime = append(ftime, now)

	result = shouldDeactivatePlugin(ftime)
	require.Equal(t, false, result)
}
