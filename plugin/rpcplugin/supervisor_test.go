package rpcplugin

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestSupervisor(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	compileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin/rpcplugin"
		)

		type MyPlugin struct {}

		func main() {
			rpcplugin.Main(&MyPlugin{})
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	supervisor, err := SupervisorProvider(bundle)
	require.NoError(t, err)
	require.NoError(t, supervisor.Start())
	require.NoError(t, supervisor.Hooks().OnActivate(nil))
	require.NoError(t, supervisor.Stop())
}

func TestSupervisor_InvalidExecutablePath(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "/foo/../../backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	supervisor, err := SupervisorProvider(bundle)
	assert.Nil(t, supervisor)
	assert.Error(t, err)
}

// If plugin development goes really wrong, let's make sure plugin activation won't block forever.
func TestSupervisor_StartTimeout(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	compileGo(t, `
		package main

		func main() {
			for {
			}
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	supervisor, err := SupervisorProvider(bundle)
	require.NoError(t, err)
	require.Error(t, supervisor.Start())
}

// Crashed plugins should be relaunched.
func TestSupervisor_PluginCrash(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	compileGo(t, `
		package main

		import (
			"os"

			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/plugin/rpcplugin"
		)

		type MyPlugin struct {}

		func (p *MyPlugin) OnActivate(api plugin.API) error {
			os.Exit(1)
			return nil
		}

		func main() {
			rpcplugin.Main(&MyPlugin{})
		}
	`, backend)

	ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)

	bundle := model.BundleInfoForPath(dir)
	supervisor, err := SupervisorProvider(bundle)
	require.NoError(t, err)
	require.NoError(t, supervisor.Start())
	require.Error(t, supervisor.Hooks().OnActivate(nil))

	recovered := false
	for i := 0; i < 30; i++ {
		if supervisor.Hooks().OnDeactivate() == nil {
			recovered = true
			break
		}
		time.Sleep(time.Millisecond * 100)
	}
	assert.True(t, recovered)
	require.NoError(t, supervisor.Stop())
}
