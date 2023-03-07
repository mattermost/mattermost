// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"net"
	"os"
	"syscall"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/channels/jobs"
	"github.com/mattermost/mattermost-server/server/v8/config"
)

const (
	unitTestListeningPort = ":0"
)

//nolint:golint,unused
type ServerTestHelper struct {
	disableConfigWatch bool
	interruptChan      chan os.Signal
	originalInterval   int
}

//nolint:golint,unused
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
	originalInterval := jobs.DefaultWatcherPollingInterval
	jobs.DefaultWatcherPollingInterval = 200

	th := &ServerTestHelper{
		disableConfigWatch: true,
		interruptChan:      interruptChan,
		originalInterval:   originalInterval,
	}
	return th
}

//nolint:golint,unused
func (th *ServerTestHelper) TearDownServerTest() {
	jobs.DefaultWatcherPollingInterval = th.originalInterval
}

func TestRunServerSuccess(t *testing.T) {
	th := SetupServerTest(t)
	defer th.TearDownServerTest()

	configStore := config.NewTestMemoryStore()

	// Use non-default listening port in case another server instance is already running.
	cfg := configStore.Get()
	*cfg.ServiceSettings.ListenAddress = unitTestListeningPort
	configStore.Set(cfg)

	err := runServer(configStore, th.interruptChan)
	require.NoError(t, err)
}

func TestRunServerSystemdNotification(t *testing.T) {
	th := SetupServerTest(t)
	defer th.TearDownServerTest()

	// Get a random temporary filename for using as a mock systemd socket
	socketFile, err := os.CreateTemp("", "mattermost-systemd-mock-socket-")
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
	cfg := configStore.Get()
	*cfg.ServiceSettings.ListenAddress = unitTestListeningPort
	configStore.Set(cfg)

	// Start and stop the server
	err = runServer(configStore, th.interruptChan)
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
	cfg := configStore.Get()
	*cfg.ServiceSettings.ListenAddress = unitTestListeningPort
	configStore.Set(cfg)

	err := runServer(configStore, th.interruptChan)
	require.NoError(t, err)
}
