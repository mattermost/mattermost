// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/manualtesting"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/web"
	"github.com/mattermost/mattermost-server/wsapi"
	"github.com/spf13/cobra"
)

const (
	SESSIONS_CLEANUP_BATCH_SIZE = 1000
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
	config, err := command.Flags().GetString("config")
	if err != nil {
		return err
	}

	disableConfigWatch, _ := command.Flags().GetBool("disableconfigwatch")
	usedPlatform, _ := command.Flags().GetBool("platform")

	interruptChan := make(chan os.Signal, 1)
	return runServer(config, disableConfigWatch, usedPlatform, interruptChan)
}

func runServer(configFileLocation string, disableConfigWatch bool, usedPlatform bool, interruptChan chan os.Signal) error {
	options := []app.Option{app.ConfigFile(configFileLocation)}
	if disableConfigWatch {
		options = append(options, app.DisableConfigWatch)
	}
	server, err := app.NewServer(options...)
	if err != nil {
		mlog.Critical(err.Error())
		return err
	}
	defer server.Shutdown()

	a := server.FakeApp()

	if usedPlatform {
		mlog.Error("The platform binary has been deprecated, please switch to using the mattermost binary.")
	}

	serverErr := a.StartServer()
	if serverErr != nil {
		mlog.Critical(serverErr.Error())
		return serverErr
	}

	api := api4.Init(server, server.AppOptions, server.Router)
	wsapi.Init(a, server.WebSocketRouter)
	web.New(server, server.AppOptions, server.Router)

	// If we allow testing then listen for manual testing URL hits
	if a.Config().ServiceSettings.EnableTesting {
		manualtesting.Init(api)
	}

	a.Srv.Go(func() {
		runSecurityJob(a)
	})
	a.Srv.Go(func() {
		runDiagnosticsJob(a)
	})
	a.Srv.Go(func() {
		runSessionCleanupJob(a)
	})
	a.Srv.Go(func() {
		runTokenCleanupJob(a)
	})
	a.Srv.Go(func() {
		runCommandWebhookCleanupJob(a)
	})

	if complianceI := a.Compliance; complianceI != nil {
		complianceI.StartComplianceDailyJob()
	}

	if a.Cluster != nil {
		a.RegisterAllClusterMessageHandlers()
		a.Cluster.StartInterNodeCommunication()
	}

	if a.Metrics != nil {
		a.Metrics.StartServer()
	}

	if a.Elasticsearch != nil {
		a.StartElasticsearch()
	}

	if *a.Config().JobSettings.RunJobs {
		a.Srv.Jobs.StartWorkers()
		defer a.Srv.Jobs.StopWorkers()
	}
	if *a.Config().JobSettings.RunScheduler {
		a.Srv.Jobs.StartSchedulers()
		defer a.Srv.Jobs.StopSchedulers()
	}

	notifyReady()

	// wait for kill signal before attempting to gracefully shutdown
	// the running service
	signal.Notify(interruptChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-interruptChan

	if a.Cluster != nil {
		a.Cluster.StopInterNodeCommunication()
	}

	if a.Metrics != nil {
		a.Metrics.StopServer()
	}

	return nil
}

func runSecurityJob(a *app.App) {
	doSecurity(a)
	model.CreateRecurringTask("Security", func() {
		doSecurity(a)
	}, time.Hour*4)
}

func runDiagnosticsJob(a *app.App) {
	doDiagnostics(a)
	model.CreateRecurringTask("Diagnostics", func() {
		doDiagnostics(a)
	}, time.Hour*24)
}

func runTokenCleanupJob(a *app.App) {
	doTokenCleanup(a)
	model.CreateRecurringTask("Token Cleanup", func() {
		doTokenCleanup(a)
	}, time.Hour*1)
}

func runCommandWebhookCleanupJob(a *app.App) {
	doCommandWebhookCleanup(a)
	model.CreateRecurringTask("Command Hook Cleanup", func() {
		doCommandWebhookCleanup(a)
	}, time.Hour*1)
}

func runSessionCleanupJob(a *app.App) {
	doSessionCleanup(a)
	model.CreateRecurringTask("Session Cleanup", func() {
		doSessionCleanup(a)
	}, time.Hour*24)
}

func doSecurity(a *app.App) {
	a.DoSecurityUpdateCheck()
}

func doDiagnostics(a *app.App) {
	if *a.Config().LogSettings.EnableDiagnostics {
		a.SendDailyDiagnostics()
	}
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

func doTokenCleanup(a *app.App) {
	a.Srv.Store.Token().Cleanup()
}

func doCommandWebhookCleanup(a *app.App) {
	a.Srv.Store.CommandWebhook().Cleanup()
}

func doSessionCleanup(a *app.App) {
	a.Srv.Store.Session().Cleanup(model.GetMillis(), SESSIONS_CLEANUP_BATCH_SIZE)
}
