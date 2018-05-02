package rpcplugin

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/mattermost/mattermost-server/plugin/rpcplugin/rpcplugintest"
)

func TestMain(t *testing.T) {
	// Setup a global logger to catch tests logging outside of app context
	// The global logger will be stomped by apps initalizing but that's fine for testing. Ideally this won't happen.
	mlog.InitGlobalLogger(mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	}))

	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	plugin := filepath.Join(dir, "plugin.exe")
	rpcplugintest.CompileGo(t, `
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin/rpcplugin"
		)

		type MyPlugin struct {}

		func main() {
			rpcplugin.Main(&MyPlugin{})
		}
	`, plugin)

	ctx, cancel := context.WithCancel(context.Background())
	p, ipc, err := NewProcess(ctx, plugin)
	require.NoError(t, err)
	defer p.Wait()

	muxer := NewMuxer(ipc, false)
	defer muxer.Close()

	defer cancel()

	var api plugintest.API

	hooks, err := ConnectMain(muxer, "plugin_id")
	require.NoError(t, err)
	assert.NoError(t, hooks.OnActivate(&api))
	assert.NoError(t, hooks.OnDeactivate())
}
