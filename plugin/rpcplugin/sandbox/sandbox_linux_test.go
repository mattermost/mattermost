// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sandbox

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

func TestNewProcess(t *testing.T) {
	if err := CheckSupport(); err != nil {
		t.Skip("sandboxing not supported:", err)
	}

	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	ping := filepath.Join(dir, "ping.exe")
	rpcplugintest.CompileGo(t, `
		package main

		import (
			"crypto/rand"
			"fmt"
			"io/ioutil"
			"net/http"
			"os"
			"os/exec"
			"syscall"

			"github.com/stretchr/testify/assert"
			"github.com/stretchr/testify/require"

			"github.com/mattermost/mattermost-server/plugin/rpcplugin"
		)

		var failures int

		type T struct {}
		func (T) Errorf(format string, args ...interface{}) {
			fmt.Printf(format, args...)
			failures++
		}
		func (T) FailNow() {
			os.Exit(1)
		}

		func init() {
			if len(os.Args) > 0 && os.Args[0] == "exitImmediately" {
				os.Exit(0)
			}
		}

		func main() {
			t := &T{}

			pwd, err := os.Getwd()
			assert.NoError(t, err)
			assert.Equal(t, "/dir", pwd)

			assert.Equal(t, 0, os.Getgid(), "we should see ourselves as root")
			assert.Equal(t, 0, os.Getuid(), "we should see ourselves as root")

			f, err := ioutil.TempFile("", "")
			require.NoError(t, err, "we should be able to create temporary files")
			f.Close()

			_, err = os.Stat("ping.exe")
			assert.NoError(t, err, "we should be able to read files in the working directory")

			buf := make([]byte, 20)
			n, err := rand.Read(buf)
			assert.Equal(t, 20, n)
			assert.NoError(t, err, "we should be able to read from /dev/urandom")

			f, err = os.Create("/dev/zero")
			require.NoError(t, err, "we should be able to write to /dev/zero")
			defer f.Close()
			n, err = f.Write([]byte("foo"))
			assert.Equal(t, 3, n)
			require.NoError(t, err, "we should be able to write to /dev/zero")

			f, err = os.Create("/dir/foo")
			if f != nil {
				defer f.Close()
			}
			assert.Error(t, err, "we shouldn't be able to write to this read-only mount point")

			_, err = ioutil.ReadFile("/etc/resolv.conf")
			require.NoError(t, err, "we should be able to read /etc/resolv.conf")

			resp, err := http.Get("https://github.com")
			require.NoError(t, err, "we should be able to use the network")
			resp.Body.Close()

			status, err := ioutil.ReadFile("/proc/self/status")
			require.NoError(t, err, "we should be able to read from /proc")
			assert.Regexp(t, status, "CapEff:\\s+0000000000000000", "we should have no effective capabilities")

			require.NoError(t, os.MkdirAll("/tmp/dir2", 0755))
			err = syscall.Mount("/dir", "/tmp/dir2", "", syscall.MS_BIND, "")
			assert.Equal(t, syscall.EPERM, err, "we shouldn't be allowed to mount things")

			cmd := exec.Command("/proc/self/exe")
			cmd.Args = []string{"exitImmediately"}
			cmd.SysProcAttr = &syscall.SysProcAttr{
				Pdeathsig:  syscall.SIGTERM,
			}
			assert.NoError(t, cmd.Run(), "we should be able to re-exec ourself")

			cmd = exec.Command("/proc/self/exe")
			cmd.Args = []string{"exitImmediately"}
			cmd.SysProcAttr = &syscall.SysProcAttr{
				Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC | syscall.CLONE_NEWPID | syscall.CLONE_NEWUSER,
				Pdeathsig:  syscall.SIGTERM,
			}
			assert.Error(t, cmd.Run(), "we shouldn't be able to create new namespaces anymore")

			ipc, err := rpcplugin.InheritedProcessIPC()
			require.NoError(t, err)
			defer ipc.Close()
			_, err = ipc.Write([]byte("ping"))
			require.NoError(t, err)

			if failures > 0 {
				os.Exit(1)
			}
		}
	`, ping)

	p, ipc, err := NewProcess(context.Background(), &Configuration{
		MountPoints: []*MountPoint{
			{
				Source:      dir,
				Destination: "/dir",
				ReadOnly:    true,
			},
		},
		WorkingDirectory: "/dir",
	}, "/dir/ping.exe")
	require.NoError(t, err)
	defer ipc.Close()
	b := make([]byte, 10)
	n, err := ipc.Read(b)
	require.NoError(t, err)
	assert.Equal(t, 4, n)
	assert.Equal(t, "ping", string(b[:4]))
	require.NoError(t, p.Wait())
}
