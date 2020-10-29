// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"io/ioutil"
	"net"
	"os"
	"syscall"
	"testing"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/stretchr/testify/require"
)

const (
	UnitTestListeningPort = ":0"
)

type ServerTestHelper struct {
	disableConfigWatch bool
	interruptChan      chan os.Signal
	originalInterval   int
}

func SetupServerTest(t testing.TB) *ServerTestHelper {
	if testing.Short() {
		t.SkipNow()
	}
	// Build a channel that will be used by the server to receive system signals...
	interruptChan := make(chan os.Signal, 1)
	// ...and sent it immediately a SIGINT value.
	// This will make the server loop stop as soon as it started successfully.
	interruptChan <- syscall.SIGINT

	// Let jobs poll for termination every 0.2s (instead of every 15s by default)
	// Otherwise we would have to wait the whole polling duration before the test
	// terminates.
	originalInterval := jobs.DEFAULT_WATCHER_POLLING_INTERVAL
	jobs.DEFAULT_WATCHER_POLLING_INTERVAL = 200

	th := &ServerTestHelper{
		disableConfigWatch: true,
		interruptChan:      interruptChan,
		originalInterval:   originalInterval,
	}
	return th
}

func (th *ServerTestHelper) TearDownServerTest() {
	jobs.DEFAULT_WATCHER_POLLING_INTERVAL = th.originalInterval
}

func TestRunServerSuccess(t *testing.T) {
	th := SetupServerTest(t)
	defer th.TearDownServerTest()

	configStore := config.NewTestMemoryStore()

	// Use non-default listening port in case another server instance is already running.
	*configStore.Get().ServiceSettings.ListenAddress = UnitTestListeningPort

	err := runServer(configStore, th.disableConfigWatch, false, th.interruptChan)
	require.NoError(t, err)
}

func TestRunServerSystemdNotification(t *testing.T) {
	th := SetupServerTest(t)
	defer th.TearDownServerTest()

	// Get a random temporary filename for using as a mock systemd socket
	socketFile, err := ioutil.TempFile("", "mattermost-systemd-mock-socket-")
	if err != nil {
		panic(err)
	}
	socketPath := socketFile.Name()
	os.Remove(socketPath)

	// Set the socket path in the process environment
	originalSocket := os.Getenv("NOTIFY_SOCKET")
	os.Setenv("NOTIFY_SOCKET", socketPath)
	defer os.Setenv("NOTIFY_SOCKET", originalSocket)

	// Open the socket connection
	addr := &net.UnixAddr{
		Name: socketPath,
		Net:  "unixgram",
	}
	connection, err := net.ListenUnixgram("unixgram", addr)
	if err != nil {
		panic(err)
	}
	defer connection.Close()
	defer os.Remove(socketPath)

	// Listen for socket data
	socketReader := make(chan string)
	go func(ch chan string) {
		buffer := make([]byte, 512)
		count, readErr := connection.Read(buffer)
		if readErr != nil {
			panic(readErr)
		}
		data := buffer[0:count]
		ch <- string(data)
	}(socketReader)

	configStore := config.NewTestMemoryStore()

	// Use non-default listening port in case another server instance is already running.
	*configStore.Get().ServiceSettings.ListenAddress = UnitTestListeningPort

	// Start and stop the server
	err = runServer(configStore, th.disableConfigWatch, false, th.interruptChan)
	require.NoError(t, err)

	// Ensure the notification has been sent on the socket and is correct
	notification := <-socketReader
	require.Equal(t, notification, "READY=1")
}

func TestRunServerNoSystemd(t *testing.T) {
	th := SetupServerTest(t)
	defer th.TearDownServerTest()

	// Temporarily remove any Systemd socket defined in the environment
	originalSocket := os.Getenv("NOTIFY_SOCKET")
	os.Unsetenv("NOTIFY_SOCKET")
	defer os.Setenv("NOTIFY_SOCKET", originalSocket)

	configStore := config.NewTestMemoryStore()

	// Use non-default listening port in case another server instance is already running.
	*configStore.Get().ServiceSettings.ListenAddress = UnitTestListeningPort

	err := runServer(configStore, th.disableConfigWatch, false, th.interruptChan)
	require.NoError(t, err)
}
