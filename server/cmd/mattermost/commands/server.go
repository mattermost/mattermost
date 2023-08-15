// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"net"
	"os"
	"os/signal"
	"runtime/debug"
	"runtime/pprof"
	"syscall"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/manualtesting"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/web"
	"github.com/mattermost/mattermost/server/v8/channels/wsapi"
	"github.com/mattermost/mattermost/server/v8/config"
)

var serverCmd = &cobra.Command{
	Use:          "server",
	Short:        "Run the Mattermost server",
	RunE:         serverCmdF,
	SilenceUsage: true,
}

func init() {
	RootCmd.AddCommand(serverCmd)
	RootCmd.RunE = serverCmdF
}

func serverCmdF(command *cobra.Command, args []string) error {
	interruptChan := make(chan os.Signal, 1)

	if err := utils.TranslationsPreInit(); err != nil {
		return errors.Wrap(err, "unable to load Mattermost translation files")
	}

	customDefaults, err := loadCustomDefaults()
	if err != nil {
		mlog.Warn("Error loading custom configuration defaults: " + err.Error())
	}

	configStore, err := config.NewStoreFromDSN(getConfigDSN(command, config.GetEnvironment()), false, customDefaults, true)
	if err != nil {
		return errors.Wrap(err, "failed to load configuration")
	}
	defer configStore.Close()

	return runServer(configStore, interruptChan)
}

func runServer(configStore *config.Store, interruptChan chan os.Signal) error {
	// Setting the highest traceback level from the code.
	// This is done to print goroutines from all threads (see golang.org/issue/13161)
	// and also preserve a crash dump for later investigation.
	debug.SetTraceback("crash")

	options := []app.Option{
		// The option order is important as app.Config option reads app.StartMetrics option.
		app.StartMetrics,
		app.ConfigStore(configStore),
		app.RunEssentialJobs,
		app.JoinCluster,
	}
	server, err := app.NewServer(options...)
	if err != nil {
		mlog.Error(err.Error())
		return err
	}
	defer server.Shutdown()
	// We add this after shutdown so that it can be called
	// before server shutdown happens as it can close
	// the advanced logger and prevent the mlog call from working properly.
	defer func() {
		// A panic pass-through layer which just logs it
		// and sends it upwards.
		if x := recover(); x != nil {
			var buf bytes.Buffer
			pprof.Lookup("goroutine").WriteTo(&buf, 2)
			mlog.Error("A panic occurred",
				mlog.Any("error", x),
				mlog.String("stack", buf.String()))
			panic(x)
		}
	}()

	api, err := api4.Init(server)
	if err != nil {
		mlog.Error(err.Error())
		return err
	}
	wsapi.Init(server)
	web.New(server)

	err = server.Start()
	if err != nil {
		mlog.Error(err.Error())
		return err
	}

	// If we allow testing then listen for manual testing URL hits
	if *server.Config().ServiceSettings.EnableTesting {
		manualtesting.Init(api)
	}

	notifyReady()

	// wait for kill signal before attempting to gracefully shutdown
	// the running service
	signal.Notify(interruptChan, syscall.SIGINT, syscall.SIGTERM)
	<-interruptChan

	return nil
}

func notifyReady() {
	// If the environment vars provide a systemd notification socket,
	// notify systemd that the server is ready.
	systemdSocket := os.Getenv("NOTIFY_SOCKET")
	if systemdSocket != "" {
		mlog.Info("Sending systemd READY notification.")

		err := sendSystemdReadyNotification(systemdSocket)
		if err != nil {
			mlog.Error(err.Error())
		}
	}
}

func sendSystemdReadyNotification(socketPath string) error {
	msg := "READY=1"
	addr := &net.UnixAddr{
		Name: socketPath,
		Net:  "unixgram",
	}
	conn, err := net.DialUnix(addr.Net, nil, addr)
	if err != nil {
		return err
	}
	defer conn.Close()
	_, err = conn.Write([]byte(msg))
	return err
}
