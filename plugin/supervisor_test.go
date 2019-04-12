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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSupervisor(t *testing.T) {
	for name, f := range map[string]func(*testing.T){
		"Supervisor_InvalidExecutablePath":     testSupervisor_InvalidExecutablePath,
		"Supervisor_NonExistentExecutablePath": testSupervisor_NonExistentExecutablePath,
		"Supervisor_StartTimeout":              testSupervisor_StartTimeout,
		"Supervisor_HealthCheckSuccess":        testSupervisor_HealthCheckSuccess,
		"Supervisor_ProcessKilled":             testSupervisor_ProcessKilled,
		"Supervisor_RPCPingFailed":             testSupervisor_RPCPingFailed,
		"Supervisor_HealthCheckHookError":      testSupervisor_HealthCheckHookError,
	} {
		t.Run(name, f)
	}
}

func testSupervisor_InvalidExecutablePath(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "/foo/../../backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})
	supervisor, err := newSupervisor(bundle, log, nil)
	assert.Nil(t, supervisor)
	assert.Error(t, err)
}

func testSupervisor_NonExistentExecutablePath(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "thisfileshouldnotexist"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})
	supervisor, err := newSupervisor(bundle, log, nil)
	require.Error(t, err)
	require.Nil(t, supervisor)
}

// If plugin development goes really wrong, let's make sure plugin activation won't block forever.
func testSupervisor_StartTimeout(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		func main() {
			for {
			}
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
	require.Error(t, err)
	require.Nil(t, supervisor)
}

func testSupervisor_HealthCheckSuccess(t *testing.T) {
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

func testSupervisor_ProcessKilled(t *testing.T) {
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

	process, err := os.FindProcess(supervisor.pid)
	process.Kill()
	time.Sleep(10 * time.Millisecond)

	err = supervisor.PerformHealthCheck()
	require.NotNil(t, err)
	require.Equal(t, "Plugin process not found, or not responding", err.Error())
}

func testSupervisor_RPCPingFailed(t *testing.T) {
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
	err = c.Close()
	require.Nil(t, err)

	err = supervisor.PerformHealthCheck()
	require.NotNil(t, err)
	require.Equal(t, "Plugin RPC connection is not responding", err.Error())
}

func testSupervisor_HealthCheckHookError(t *testing.T) {
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
