// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"os"
	"os/signal"
	"syscall"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/manualtesting"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/web"
	"github.com/mattermost/mattermost-server/wsapi"
	"github.com/spf13/cobra"
)

var MaxNotificationsPerChannelDefault int64 = 1000000

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Run the Mattermost server",
	RunE:  runServerCmd,
}

func runServerCmd(cmd *cobra.Command, args []string) error {
	config, err := cmd.Flags().GetString("config")
	if err != nil {
		return err
	}

	utils.CfgDisableConfigWatch, _ = cmd.Flags().GetBool("disableconfigwatch")

	runServer(config)
	return nil
}

func runServer(configFileLocation string) {
	if err := utils.InitAndLoadConfig(configFileLocation); err != nil {
		l4g.Exit("Unable to load Mattermost configuration file: ", err)
		return
	}

	if err := utils.InitTranslations(utils.Cfg.LocalizationSettings); err != nil {
		l4g.Exit("Unable to load Mattermost translation files: %v", err)
		return
	}

	utils.TestConnection(utils.Cfg)

	pwd, _ := os.Getwd()
	l4g.Info(utils.T("mattermost.current_version"), model.CurrentVersion, model.BuildNumber, model.BuildDate, model.BuildHash, model.BuildHashEnterprise)
	l4g.Info(utils.T("mattermost.entreprise_enabled"), model.BuildEnterpriseReady)
	l4g.Info(utils.T("mattermost.working_dir"), pwd)
	l4g.Info(utils.T("mattermost.config_file"), utils.FindConfigFile(configFileLocation))

	a := app.New(app.ConfigFile(configFileLocation))
	defer a.Shutdown()

	backend, err := a.FileBackend()
	if err == nil {
		err = backend.TestConnection()
	}
	if err != nil {
		l4g.Error("Problem with file storage settings: " + err.Error())
	}

	if model.BuildEnterpriseReady == "true" {
		a.LoadLicense()
	}

	a.InitPlugins(*a.Config().PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory, nil)
	utils.AddConfigListener(func(prevCfg, cfg *model.Config) {
		if *cfg.PluginSettings.Enable {
			a.InitPlugins(*cfg.PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory, nil)
		} else {
			a.ShutDownPlugins()
		}
	})

	a.StartServer()
	api4.Init(a, a.Srv.Router, false)
	api3 := api.Init(a, a.Srv.Router)
	wsapi.Init(a, a.Srv.WebSocketRouter)
	web.Init(api3)

	if !utils.IsLicensed() && len(a.Config().SqlSettings.DataSourceReplicas) > 1 {
		l4g.Warn(utils.T("store.sql.read_replicas_not_licensed.critical"))
		a.UpdateConfig(func(cfg *model.Config) {
			cfg.SqlSettings.DataSourceReplicas = cfg.SqlSettings.DataSourceReplicas[:1]
		})
	}

	if !utils.IsLicensed() {
		a.UpdateConfig(func(cfg *model.Config) {
			cfg.TeamSettings.MaxNotificationsPerChannel = &MaxNotificationsPerChannelDefault
		})
	}

	a.ReloadConfig()

	// Enable developer settings if this is a "dev" build
	if model.BuildNumber == "dev" {
		a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })
	}

	resetStatuses(a)

	// If we allow testing then listen for manual testing URL hits
	if a.Config().ServiceSettings.EnableTesting {
		manualtesting.Init(api3)
	}

	setDiagnosticId(a)
	utils.RegenerateClientConfig()
	go runSecurityJob(a)
	go runDiagnosticsJob(a)

	go runTokenCleanupJob(a)
	go runCommandWebhookCleanupJob(a)

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
		a.Go(func() {
			if err := a.Elasticsearch.Start(); err != nil {
				l4g.Error(err.Error())
			}
		})
	}

	if *a.Config().JobSettings.RunJobs {
		a.Jobs.StartWorkers()
	}
	if *a.Config().JobSettings.RunScheduler {
		a.Jobs.StartSchedulers()
	}

	// wait for kill signal before attempting to gracefully shutdown
	// the running service
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-c

	if a.Cluster != nil {
		a.Cluster.StopInterNodeCommunication()
	}

	if a.Metrics != nil {
		a.Metrics.StopServer()
	}

	a.Jobs.StopSchedulers()
	a.Jobs.StopWorkers()
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

func resetStatuses(a *app.App) {
	if result := <-a.Srv.Store.Status().ResetAll(); result.Err != nil {
		l4g.Error(utils.T("mattermost.reset_status.error"), result.Err.Error())
	}
}

func setDiagnosticId(a *app.App) {
	if result := <-a.Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)

		id := props[model.SYSTEM_DIAGNOSTIC_ID]
		if len(id) == 0 {
			id = model.NewId()
			systemId := &model.System{Name: model.SYSTEM_DIAGNOSTIC_ID, Value: id}
			<-a.Srv.Store.System().Save(systemId)
		}

		utils.CfgDiagnosticId = id
	}
}

func doSecurity(a *app.App) {
	a.DoSecurityUpdateCheck()
}

func doDiagnostics(a *app.App) {
	if *utils.Cfg.LogSettings.EnableDiagnostics {
		a.SendDailyDiagnostics()
	}
}

func doTokenCleanup(a *app.App) {
	a.Srv.Store.Token().Cleanup()
}

func doCommandWebhookCleanup(a *app.App) {
	a.Srv.Store.CommandWebhook().Cleanup()
}
