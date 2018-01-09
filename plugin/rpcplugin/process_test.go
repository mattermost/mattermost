package rpcplugin

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/plugin/rpcplugin/rpcplugintest"
)

func TestProcess(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	ping := filepath.Join(dir, "ping.exe")
	rpcplugintest.CompileGo(t, `
		package main

		import (
			"log"

			"github.com/mattermost/mattermost-server/plugin/rpcplugin"
		)

		func main() {
			ipc, err := rpcplugin.InheritedProcessIPC()
			if err != nil {
				log.Fatal("unable to get inherited ipc")
			}
			defer ipc.Close()
			_, err = ipc.Write([]byte("ping"))
			if err != nil {
				log.Fatal("unable to write to ipc")
			}
		}
	`, ping)

	p, ipc, err := NewProcess(context.Background(), ping)
	require.NoError(t, err)
	defer ipc.Close()
	b := make([]byte, 10)
	n, err := ipc.Read(b)
	require.NoError(t, err)
	assert.Equal(t, 4, n)
	assert.Equal(t, "ping", string(b[:4]))
	require.NoError(t, p.Wait())
}

func TestInvalidProcess(t *testing.T) {
	p, ipc, err := NewProcess(context.Background(), "thisfileshouldnotexist")
	require.Nil(t, p)
	require.Nil(t, ipc)
	require.Error(t, err)
}
