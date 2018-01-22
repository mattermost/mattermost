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

func TestIPC(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	pingpong := filepath.Join(dir, "pingpong.exe")
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
			b := make([]byte, 10)
			n, err := ipc.Read(b)
			if err != nil {
				log.Fatal("unable to read from ipc")
			}
			if n != 4 || string(b[:4]) != "pong" {
				log.Fatal("unexpected response")
			}
		}
	`, pingpong)

	p, ipc, err := NewProcess(context.Background(), pingpong)
	require.NoError(t, err)
	defer ipc.Close()
	b := make([]byte, 10)
	n, err := ipc.Read(b)
	require.NoError(t, err)
	assert.Equal(t, 4, n)
	assert.Equal(t, "ping", string(b[:4]))
	_, err = ipc.Write([]byte("pong"))
	require.NoError(t, err)
	require.NoError(t, p.Wait())
}
