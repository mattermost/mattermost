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
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/jobs"
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

	if err := utils.TestFileConnection(); err != nil {
		l4g.Error("Problem with file storage settings: " + err.Error())
	}

	a := app.Global()
	a.NewServer()
	a.InitStores()
	a.Srv.Router = api.NewRouter()

	if model.BuildEnterpriseReady == "true" {
		a.LoadLicense()
	}

	if webappDir, ok := utils.FindDir(model.CLIENT_DIR); ok {
		a.InitPlugins("plugins", webappDir+"/plugins")
	} else {
		l4g.Error("Unable to find webapp directory, could not initialize plugins")
	}

	wsapi.InitRouter()
	api4.InitApi(a.Srv.Router, false)
	api.InitApi(a.Srv.Router)
	wsapi.InitApi()
	web.InitWeb()

	if !utils.IsLicensed() && len(utils.Cfg.SqlSettings.DataSourceReplicas) > 1 {
		l4g.Warn(utils.T("store.sql.read_replicas_not_licensed.critical"))
		utils.Cfg.SqlSettings.DataSourceReplicas = utils.Cfg.SqlSettings.DataSourceReplicas[:1]
	}

	if !utils.IsLicensed() {
		utils.Cfg.TeamSettings.MaxNotificationsPerChannel = &MaxNotificationsPerChannelDefault
	}

	app.ReloadConfig()

	// Enable developer settings if this is a "dev" build
	if model.BuildNumber == "dev" {
		*utils.Cfg.ServiceSettings.EnableDeveloper = true
	}

	resetStatuses(a)

	a.StartServer()

	// If we allow testing then listen for manual testing URL hits
	if utils.Cfg.ServiceSettings.EnableTesting {
		manualtesting.InitManualTesting()
	}

	setDiagnosticId(a)
	utils.RegenerateClientConfig()
	go runSecurityJob(a)
	go runDiagnosticsJob(a)

	go runTokenCleanupJob(a)
	go runCommandWebhookCleanupJob(a)

	if complianceI := einterfaces.GetComplianceInterface(); complianceI != nil {
		complianceI.StartComplianceDailyJob()
	}

	if einterfaces.GetClusterInterface() != nil {
		a.RegisterAllClusterMessageHandlers()
		einterfaces.GetClusterInterface().StartInterNodeCommunication()
	}

	if einterfaces.GetMetricsInterface() != nil {
		einterfaces.GetMetricsInterface().StartServer()
	}

	if einterfaces.GetElasticsearchInterface() != nil {
		if err := einterfaces.GetElasticsearchInterface().Start(); err != nil {
			l4g.Error(err.Error())
		}
	}

	jobs.Srv.Store = a.Srv.Store
	if *utils.Cfg.JobSettings.RunJobs {
		jobs.Srv.StartWorkers()
	}
	if *utils.Cfg.JobSettings.RunScheduler {
		jobs.Srv.StartSchedulers()
	}

	// wait for kill signal before attempting to gracefully shutdown
	// the running service
	c := make(chan os.Signal)
	signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-c

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().StopInterNodeCommunication()
	}

	if einterfaces.GetMetricsInterface() != nil {
		einterfaces.GetMetricsInterface().StopServer()
	}

	jobs.Srv.StopSchedulers()
	jobs.Srv.StopWorkers()

	a.StopServer()
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
