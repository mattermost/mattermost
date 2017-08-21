// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"os"
	"os/signal"
	"syscall"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/api4"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/jobs"
	"github.com/mattermost/platform/manualtesting"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/web"
	"github.com/mattermost/platform/wsapi"
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

	// Enable developer settings if this is a "dev" build
	if model.BuildNumber == "dev" {
		*utils.Cfg.ServiceSettings.EnableDeveloper = true
	}

	if err := utils.TestFileConnection(); err != nil {
		l4g.Error("Problem with file storage settings: " + err.Error())
	}

	app.NewServer()
	app.InitStores()
	api.InitRouter()
	wsapi.InitRouter()
	api4.InitApi(false)
	api.InitApi()
	app.InitPlugins()
	wsapi.InitApi()
	web.InitWeb()

	if model.BuildEnterpriseReady == "true" {
		app.LoadLicense()
	}

	if !utils.IsLicensed() && len(utils.Cfg.SqlSettings.DataSourceReplicas) > 1 {
		l4g.Warn(utils.T("store.sql.read_replicas_not_licensed.critical"))
		utils.Cfg.SqlSettings.DataSourceReplicas = utils.Cfg.SqlSettings.DataSourceReplicas[:1]
	}

	if !utils.IsLicensed() {
		utils.Cfg.TeamSettings.MaxNotificationsPerChannel = &MaxNotificationsPerChannelDefault
	}

	app.ReloadConfig()

	resetStatuses()

	app.StartServer()

	// If we allow testing then listen for manual testing URL hits
	if utils.Cfg.ServiceSettings.EnableTesting {
		manualtesting.InitManualTesting()
	}

	setDiagnosticId()
	utils.RegenerateClientConfig()
	go runSecurityJob()
	go runDiagnosticsJob()

	go runTokenCleanupJob()
	go runCommandWebhookCleanupJob()

	if complianceI := einterfaces.GetComplianceInterface(); complianceI != nil {
		complianceI.StartComplianceDailyJob()
	}

	if einterfaces.GetClusterInterface() != nil {
		app.RegisterAllClusterMessageHandlers()
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

	jobs.Srv.Store = app.Srv.Store
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

	app.StopServer()
}

func runSecurityJob() {
	doSecurity()
	model.CreateRecurringTask("Security", doSecurity, time.Hour*4)
}

func runDiagnosticsJob() {
	doDiagnostics()
	model.CreateRecurringTask("Diagnostics", doDiagnostics, time.Hour*24)
}

func runTokenCleanupJob() {
	doTokenCleanup()
	model.CreateRecurringTask("Token Cleanup", doTokenCleanup, time.Hour*1)
}

func runCommandWebhookCleanupJob() {
	doCommandWebhookCleanup()
	model.CreateRecurringTask("Command Hook Cleanup", doCommandWebhookCleanup, time.Hour*1)
}

func resetStatuses() {
	if result := <-app.Srv.Store.Status().ResetAll(); result.Err != nil {
		l4g.Error(utils.T("mattermost.reset_status.error"), result.Err.Error())
	}
}

func setDiagnosticId() {
	if result := <-app.Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)

		id := props[model.SYSTEM_DIAGNOSTIC_ID]
		if len(id) == 0 {
			id = model.NewId()
			systemId := &model.System{Name: model.SYSTEM_DIAGNOSTIC_ID, Value: id}
			<-app.Srv.Store.System().Save(systemId)
		}

		utils.CfgDiagnosticId = id
	}
}

func doSecurity() {
	app.DoSecurityUpdateCheck()
}

func doDiagnostics() {
	if *utils.Cfg.LogSettings.EnableDiagnostics {
		app.SendDailyDiagnostics()
	}
}

func doTokenCleanup() {
	app.Srv.Store.Token().Cleanup()
}

func doCommandWebhookCleanup() {
	app.Srv.Store.CommandWebhook().Cleanup()
}
