// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"syscall"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/api4"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/manualtesting"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/web"
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
	runServer(config)
	return nil
}

func runServer(configFileLocation string) {
	if errstr := doLoadConfig(configFileLocation); errstr != "" {
		l4g.Exit("Unable to load mattermost configuration file: ", errstr)
		return
	}

	utils.InitTranslations(utils.Cfg.LocalizationSettings)
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

	cmdUpdateDb30()

	app.NewServer()
	app.InitStores()
	api.InitRouter()
	api4.InitApi(false)
	api.InitApi()
	web.InitWeb()

	if model.BuildEnterpriseReady == "true" {
		api.LoadLicense()
	}

	if !utils.IsLicensed && len(utils.Cfg.SqlSettings.DataSourceReplicas) > 1 {
		l4g.Warn(utils.T("store.sql.read_replicas_not_licensed.critical"))
		utils.Cfg.SqlSettings.DataSourceReplicas = utils.Cfg.SqlSettings.DataSourceReplicas[:1]
	}

	if !utils.IsLicensed {
		utils.Cfg.TeamSettings.MaxNotificationsPerChannel = &MaxNotificationsPerChannelDefault
	}

	resetStatuses()

	app.StartServer()

	// If we allow testing then listen for manual testing URL hits
	if utils.Cfg.ServiceSettings.EnableTesting {
		manualtesting.InitManualTesting()
	}

	setDiagnosticId()
	go runSecurityAndDiagnosticsJob()

	if complianceI := einterfaces.GetComplianceInterface(); complianceI != nil {
		complianceI.StartComplianceDailyJob()
	}

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().StartInterNodeCommunication()
	}

	if einterfaces.GetMetricsInterface() != nil {
		einterfaces.GetMetricsInterface().StartServer()
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

	app.StopServer()
}

func runSecurityAndDiagnosticsJob() {
	doSecurityAndDiagnostics()
	model.CreateRecurringTask("Security and Diagnostics", doSecurityAndDiagnostics, time.Hour*4)
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

func doSecurityAndDiagnostics() {
	if *utils.Cfg.ServiceSettings.EnableSecurityFixAlert {
		if result := <-app.Srv.Store.System().Get(); result.Err == nil {
			props := result.Data.(model.StringMap)
			lastSecurityTime, _ := strconv.ParseInt(props[model.SYSTEM_LAST_SECURITY_TIME], 10, 0)
			currentTime := model.GetMillis()

			if (currentTime - lastSecurityTime) > 1000*60*60*24*1 {
				l4g.Debug(utils.T("mattermost.security_checks.debug"))

				v := url.Values{}

				v.Set(utils.PROP_DIAGNOSTIC_ID, utils.CfgDiagnosticId)
				v.Set(utils.PROP_DIAGNOSTIC_BUILD, model.CurrentVersion+"."+model.BuildNumber)
				v.Set(utils.PROP_DIAGNOSTIC_ENTERPRISE_READY, model.BuildEnterpriseReady)
				v.Set(utils.PROP_DIAGNOSTIC_DATABASE, utils.Cfg.SqlSettings.DriverName)
				v.Set(utils.PROP_DIAGNOSTIC_OS, runtime.GOOS)
				v.Set(utils.PROP_DIAGNOSTIC_CATEGORY, utils.VAL_DIAGNOSTIC_CATEGORY_DEFAULT)

				if len(props[model.SYSTEM_RAN_UNIT_TESTS]) > 0 {
					v.Set(utils.PROP_DIAGNOSTIC_UNIT_TESTS, "1")
				} else {
					v.Set(utils.PROP_DIAGNOSTIC_UNIT_TESTS, "0")
				}

				systemSecurityLastTime := &model.System{Name: model.SYSTEM_LAST_SECURITY_TIME, Value: strconv.FormatInt(currentTime, 10)}
				if lastSecurityTime == 0 {
					<-app.Srv.Store.System().Save(systemSecurityLastTime)
				} else {
					<-app.Srv.Store.System().Update(systemSecurityLastTime)
				}

				if ucr := <-app.Srv.Store.User().GetTotalUsersCount(); ucr.Err == nil {
					v.Set(utils.PROP_DIAGNOSTIC_USER_COUNT, strconv.FormatInt(ucr.Data.(int64), 10))
				}

				if ucr := <-app.Srv.Store.Status().GetTotalActiveUsersCount(); ucr.Err == nil {
					v.Set(utils.PROP_DIAGNOSTIC_ACTIVE_USER_COUNT, strconv.FormatInt(ucr.Data.(int64), 10))
				}

				if tcr := <-app.Srv.Store.Team().AnalyticsTeamCount(); tcr.Err == nil {
					v.Set(utils.PROP_DIAGNOSTIC_TEAM_COUNT, strconv.FormatInt(tcr.Data.(int64), 10))
				}

				res, err := http.Get(utils.DIAGNOSTIC_URL + "/security?" + v.Encode())
				if err != nil {
					l4g.Error(utils.T("mattermost.security_info.error"))
					return
				}

				bulletins := model.SecurityBulletinsFromJson(res.Body)
				ioutil.ReadAll(res.Body)
				res.Body.Close()

				for _, bulletin := range bulletins {
					if bulletin.AppliesToVersion == model.CurrentVersion {
						if props["SecurityBulletin_"+bulletin.Id] == "" {
							if results := <-app.Srv.Store.User().GetSystemAdminProfiles(); results.Err != nil {
								l4g.Error(utils.T("mattermost.system_admins.error"))
								return
							} else {
								users := results.Data.(map[string]*model.User)

								resBody, err := http.Get(utils.DIAGNOSTIC_URL + "/bulletins/" + bulletin.Id)
								if err != nil {
									l4g.Error(utils.T("mattermost.security_bulletin.error"))
									return
								}

								body, err := ioutil.ReadAll(resBody.Body)
								res.Body.Close()
								if err != nil || resBody.StatusCode != 200 {
									l4g.Error(utils.T("mattermost.security_bulletin_read.error"))
									return
								}

								for _, user := range users {
									l4g.Info(utils.T("mattermost.send_bulletin.info"), bulletin.Id, user.Email)
									utils.SendMail(user.Email, utils.T("mattermost.bulletin.subject"), string(body))
								}
							}

							bulletinSeen := &model.System{Name: "SecurityBulletin_" + bulletin.Id, Value: bulletin.Id}
							<-app.Srv.Store.System().Save(bulletinSeen)
						}
					}
				}
			}
		}
	}

	if *utils.Cfg.LogSettings.EnableDiagnostics {
		utils.SendGeneralDiagnostics()
		sendServerDiagnostics()
	}
}

func sendServerDiagnostics() {
	var userCount int64
	var activeUserCount int64
	var teamCount int64

	if ucr := <-app.Srv.Store.User().GetTotalUsersCount(); ucr.Err == nil {
		userCount = ucr.Data.(int64)
	}

	if ucr := <-app.Srv.Store.Status().GetTotalActiveUsersCount(); ucr.Err == nil {
		activeUserCount = ucr.Data.(int64)
	}

	if tcr := <-app.Srv.Store.Team().AnalyticsTeamCount(); tcr.Err == nil {
		teamCount = tcr.Data.(int64)
	}

	utils.SendDiagnostic(utils.TRACK_ACTIVITY, map[string]interface{}{
		"registered_users": userCount,
		"active_users":     activeUserCount,
		"teams":            teamCount,
	})

	edition := model.BuildEnterpriseReady
	version := model.CurrentVersion
	database := utils.Cfg.SqlSettings.DriverName
	operatingSystem := runtime.GOOS

	utils.SendDiagnostic(utils.TRACK_VERSION, map[string]interface{}{
		"edition":          edition,
		"version":          version,
		"database":         database,
		"operating_system": operatingSystem,
	})
}
