// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"bufio"
	"flag"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"runtime/pprof"
	"strconv"
	"strings"
	"syscall"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/manualtesting"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/web"

	// Plugins
	_ "github.com/mattermost/platform/model/gitlab"

	// Enterprise Deps
	_ "github.com/dgryski/dgoogauth"
	_ "github.com/go-ldap/ldap"
	_ "github.com/mattermost/rsc/qr"
)

//ENTERPRISE_IMPORTS

var flagCmdUpdateDb30 bool
var flagCmdCreateTeam bool
var flagCmdCreateUser bool
var flagCmdInviteUser bool
var flagCmdAssignRole bool
var flagCmdCreateChannel bool
var flagCmdJoinChannel bool
var flagCmdLeaveChannel bool
var flagCmdListChannels bool
var flagCmdRestoreChannel bool
var flagCmdJoinTeam bool
var flagCmdLeaveTeam bool
var flagCmdVersion bool
var flagCmdRunWebClientTests bool
var flagCmdRunJavascriptClientTests bool
var flagCmdResetPassword bool
var flagCmdResetMfa bool
var flagCmdPermanentDeleteUser bool
var flagCmdPermanentDeleteTeam bool
var flagCmdPermanentDeleteAllUsers bool
var flagCmdResetDatabase bool
var flagCmdRunLdapSync bool
var flagCmdMigrateAccounts bool
var flagCmdActivateUser bool
var flagCmdSlackImport bool
var flagUsername string
var flagCmdUploadLicense bool
var flagConfigFile string
var flagLicenseFile string
var flagEmail string
var flagPassword string
var flagTeamName string
var flagChannelName string
var flagConfirmBackup string
var flagRole string
var flagRunCmds bool
var flagFromAuth string
var flagToAuth string
var flagMatchField string
var flagChannelType string
var flagChannelHeader string
var flagChannelPurpose string
var flagUserSetInactive bool
var flagImportArchive string
var flagCpuProfile bool
var flagMemProfile bool
var flagBlockProfile bool
var flagHttpProfiler bool

func doLoadConfig(filename string) (err string) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Sprintf("%v", r)
		}
	}()
	utils.TranslationsPreInit()
	utils.LoadConfig(filename)
	return ""
}

func main() {
	parseCmds()

	if errstr := doLoadConfig(flagConfigFile); errstr != "" {
		l4g.Exit("Unable to load mattermost configuration file: ", errstr)
		return
	}

	if flagRunCmds {
		utils.ConfigureCmdLineLog()
	}
	utils.InitTranslations(utils.Cfg.LocalizationSettings)
	utils.TestConnection(utils.Cfg)

	pwd, _ := os.Getwd()
	l4g.Info(utils.T("mattermost.current_version"), model.CurrentVersion, model.BuildNumber, model.BuildDate, model.BuildHash, model.BuildHashEnterprise)
	l4g.Info(utils.T("mattermost.entreprise_enabled"), model.BuildEnterpriseReady)
	l4g.Info(utils.T("mattermost.working_dir"), pwd)
	l4g.Info(utils.T("mattermost.config_file"), utils.FindConfigFile(flagConfigFile))

	// Enable developer settings if this is a "dev" build
	if model.BuildNumber == "dev" {
		*utils.Cfg.ServiceSettings.EnableDeveloper = true
	}

	cmdUpdateDb30()

	if flagCpuProfile {
		f, err := os.Create(utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation) + ".cpu.prof")
		if err != nil {
			l4g.Error("Error creating cpu profile log: " + err.Error())
		}

		l4g.Info("CPU Profiler is logging to " + utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation) + ".cpu.prof")
		pprof.StartCPUProfile(f)
	}

	if flagBlockProfile {
		l4g.Info("Block Profiler is logging to " + utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation) + ".blk.prof")
		runtime.SetBlockProfileRate(1)
	}

	if flagMemProfile {
		l4g.Info("Memory Profiler is logging to " + utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation) + ".mem.prof")
	}

	api.NewServer(flagHttpProfiler)
	api.InitApi()
	web.InitWeb()

	if model.BuildEnterpriseReady == "true" {
		api.LoadLicense()
	}

	if !utils.IsLicensed && len(utils.Cfg.SqlSettings.DataSourceReplicas) > 1 {
		l4g.Critical(utils.T("store.sql.read_replicas_not_licensed.critical"))
		return
	}

	if flagRunCmds {
		runCmds()
	} else {
		resetStatuses()

		api.StartServer()

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

		// wait for kill signal before attempting to gracefully shutdown
		// the running service
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
		<-c

		if einterfaces.GetClusterInterface() != nil {
			einterfaces.GetClusterInterface().StopInterNodeCommunication()
		}

		api.StopServer()

		if flagCpuProfile {
			l4g.Info("Closing CPU Profiler")
			pprof.StopCPUProfile()
		}

		if flagBlockProfile {
			f, err := os.Create(utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation) + ".blk.prof")
			if err != nil {
				l4g.Error("Error creating block profile log: " + err.Error())
			}

			l4g.Info("Writing Block Profiler to: " + utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation) + ".blk.prof")
			pprof.Lookup("block").WriteTo(f, 0)
			f.Close()
			runtime.SetBlockProfileRate(0)
		}

		if flagMemProfile {
			f, err := os.Create(utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation) + ".mem.prof")
			if err != nil {
				l4g.Error("Error creating memory profile file: " + err.Error())
			}

			l4g.Info("Writing Memory Profiler to: " + utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation) + ".mem.prof")
			runtime.GC()
			if err := pprof.WriteHeapProfile(f); err != nil {
				l4g.Error("Error creating memory profile: " + err.Error())
			}
			f.Close()
		}
	}
}

func resetStatuses() {
	if result := <-api.Srv.Store.Status().ResetAll(); result.Err != nil {
		l4g.Error(utils.T("mattermost.reset_status.error"), result.Err.Error())
	}
}

func setDiagnosticId() {
	if result := <-api.Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)

		id := props[model.SYSTEM_DIAGNOSTIC_ID]
		if len(id) == 0 {
			id = model.NewId()
			systemId := &model.System{Name: model.SYSTEM_DIAGNOSTIC_ID, Value: id}
			<-api.Srv.Store.System().Save(systemId)
		}

		utils.CfgDiagnosticId = id
	}
}

func doSecurityAndDiagnostics() {
	if *utils.Cfg.ServiceSettings.EnableSecurityFixAlert {
		if result := <-api.Srv.Store.System().Get(); result.Err == nil {
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
					<-api.Srv.Store.System().Save(systemSecurityLastTime)
				} else {
					<-api.Srv.Store.System().Update(systemSecurityLastTime)
				}

				if ucr := <-api.Srv.Store.User().GetTotalUsersCount(); ucr.Err == nil {
					v.Set(utils.PROP_DIAGNOSTIC_USER_COUNT, strconv.FormatInt(ucr.Data.(int64), 10))
				}

				if ucr := <-api.Srv.Store.Status().GetTotalActiveUsersCount(); ucr.Err == nil {
					v.Set(utils.PROP_DIAGNOSTIC_ACTIVE_USER_COUNT, strconv.FormatInt(ucr.Data.(int64), 10))
				}

				if tcr := <-api.Srv.Store.Team().AnalyticsTeamCount(); tcr.Err == nil {
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
							if results := <-api.Srv.Store.User().GetSystemAdminProfiles(); results.Err != nil {
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
							<-api.Srv.Store.System().Save(bulletinSeen)
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

	if ucr := <-api.Srv.Store.User().GetTotalUsersCount(); ucr.Err == nil {
		userCount = ucr.Data.(int64)
	}

	if ucr := <-api.Srv.Store.Status().GetTotalActiveUsersCount(); ucr.Err == nil {
		activeUserCount = ucr.Data.(int64)
	}

	if tcr := <-api.Srv.Store.Team().AnalyticsTeamCount(); tcr.Err == nil {
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

func runSecurityAndDiagnosticsJob() {
	doSecurityAndDiagnostics()
	model.CreateRecurringTask("Security and Diagnostics", doSecurityAndDiagnostics, time.Hour*4)
}

func parseCmds() {
	flag.Usage = func() {
		fmt.Fprintln(os.Stderr, usage)
	}

	flag.StringVar(&flagConfigFile, "config", "config.json", "")
	flag.StringVar(&flagUsername, "username", "", "")
	flag.StringVar(&flagLicenseFile, "license", "", "")
	flag.StringVar(&flagEmail, "email", "", "")
	flag.StringVar(&flagPassword, "password", "", "")
	flag.StringVar(&flagTeamName, "team_name", "", "")
	flag.StringVar(&flagChannelName, "channel_name", "", "")
	flag.StringVar(&flagConfirmBackup, "confirm_backup", "", "")
	flag.StringVar(&flagFromAuth, "from_auth", "", "")
	flag.StringVar(&flagToAuth, "to_auth", "", "")
	flag.StringVar(&flagMatchField, "match_field", "email", "")
	flag.StringVar(&flagRole, "role", "", "")
	flag.StringVar(&flagChannelType, "channel_type", "O", "")
	flag.StringVar(&flagChannelHeader, "channel_header", "", "")
	flag.StringVar(&flagChannelPurpose, "channel_purpose", "", "")
	flag.StringVar(&flagImportArchive, "import_archive", "", "")

	flag.BoolVar(&flagCmdUpdateDb30, "upgrade_db_30", false, "")
	flag.BoolVar(&flagCmdCreateTeam, "create_team", false, "")
	flag.BoolVar(&flagCmdCreateUser, "create_user", false, "")
	flag.BoolVar(&flagCmdInviteUser, "invite_user", false, "")
	flag.BoolVar(&flagCmdAssignRole, "assign_role", false, "")
	flag.BoolVar(&flagCmdCreateChannel, "create_channel", false, "")
	flag.BoolVar(&flagCmdJoinChannel, "join_channel", false, "")
	flag.BoolVar(&flagCmdLeaveChannel, "leave_channel", false, "")
	flag.BoolVar(&flagCmdListChannels, "list_channels", false, "")
	flag.BoolVar(&flagCmdRestoreChannel, "restore_channel", false, "")
	flag.BoolVar(&flagCmdJoinTeam, "join_team", false, "")
	flag.BoolVar(&flagCmdLeaveTeam, "leave_team", false, "")
	flag.BoolVar(&flagCmdVersion, "version", false, "")
	flag.BoolVar(&flagCmdRunWebClientTests, "run_web_client_tests", false, "")
	flag.BoolVar(&flagCmdRunJavascriptClientTests, "run_javascript_client_tests", false, "")
	flag.BoolVar(&flagCmdResetPassword, "reset_password", false, "")
	flag.BoolVar(&flagCmdResetMfa, "reset_mfa", false, "")
	flag.BoolVar(&flagCmdPermanentDeleteUser, "permanent_delete_user", false, "")
	flag.BoolVar(&flagCmdPermanentDeleteTeam, "permanent_delete_team", false, "")
	flag.BoolVar(&flagCmdPermanentDeleteAllUsers, "permanent_delete_all_users", false, "")
	flag.BoolVar(&flagCmdResetDatabase, "reset_database", false, "")
	flag.BoolVar(&flagCmdRunLdapSync, "ldap_sync", false, "")
	flag.BoolVar(&flagCmdMigrateAccounts, "migrate_accounts", false, "")
	flag.BoolVar(&flagCmdUploadLicense, "upload_license", false, "")
	flag.BoolVar(&flagCmdActivateUser, "activate_user", false, "")
	flag.BoolVar(&flagCmdSlackImport, "slack_import", false, "")
	flag.BoolVar(&flagUserSetInactive, "inactive", false, "")
	flag.BoolVar(&flagCpuProfile, "cpuprofile", false, "")
	flag.BoolVar(&flagMemProfile, "memprofile", false, "")
	flag.BoolVar(&flagBlockProfile, "blkprofile", false, "")
	flag.BoolVar(&flagHttpProfiler, "httpprofiler", false, "")

	flag.Parse()

	flagRunCmds = (flagCmdCreateTeam ||
		flagCmdCreateUser ||
		flagCmdInviteUser ||
		flagCmdLeaveTeam ||
		flagCmdAssignRole ||
		flagCmdCreateChannel ||
		flagCmdJoinChannel ||
		flagCmdLeaveChannel ||
		flagCmdListChannels ||
		flagCmdRestoreChannel ||
		flagCmdJoinTeam ||
		flagCmdResetPassword ||
		flagCmdResetMfa ||
		flagCmdVersion ||
		flagCmdRunWebClientTests ||
		flagCmdRunJavascriptClientTests ||
		flagCmdPermanentDeleteUser ||
		flagCmdPermanentDeleteTeam ||
		flagCmdPermanentDeleteAllUsers ||
		flagCmdResetDatabase ||
		flagCmdRunLdapSync ||
		flagCmdMigrateAccounts ||
		flagCmdUploadLicense ||
		flagCmdActivateUser ||
		flagCmdSlackImport)
}

func runCmds() {
	cmdVersion()
	cmdRunClientTests()
	cmdCreateTeam()
	cmdCreateUser()
	cmdInviteUser()
	cmdLeaveTeam()
	cmdAssignRole()
	cmdCreateChannel()
	cmdJoinChannel()
	cmdLeaveChannel()
	cmdListChannels()
	cmdRestoreChannel()
	cmdJoinTeam()
	cmdResetPassword()
	cmdResetMfa()
	cmdPermDeleteUser()
	cmdPermDeleteTeam()
	cmdPermDeleteAllUsers()
	cmdResetDatabase()
	cmdUploadLicense()
	cmdRunLdapSync()
	cmdRunMigrateAccounts()
	cmdActivateUser()
	cmdSlackImport()
}

type TeamForUpgrade struct {
	Id   string
	Name string
}

func setupClientTests() {
	*utils.Cfg.TeamSettings.EnableOpenServer = true
	*utils.Cfg.ServiceSettings.EnableCommands = false
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false
	*utils.Cfg.ServiceSettings.EnableCustomEmoji = true
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = false
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = false
	utils.SetDefaultRolesBasedOnConfig()
}

func executeTestCommand(cmd *exec.Cmd) {
	cmdOutPipe, err := cmd.StdoutPipe()
	if err != nil {
		l4g.Error("Failed to run tests")
		os.Exit(1)
	}

	cmdOutReader := bufio.NewScanner(cmdOutPipe)
	go func() {
		for cmdOutReader.Scan() {
			fmt.Println(cmdOutReader.Text())
		}
	}()

	if err := cmd.Run(); err != nil {
		l4g.Error("Client Tests failed")
		os.Exit(1)
	}
}

func runWebClientTests() {
	os.Chdir("webapp")
	cmd := exec.Command("npm", "test")
	executeTestCommand(cmd)
}

func cmdRunClientTests() {
	if flagCmdRunWebClientTests {
		setupClientTests()
		api.StartServer()
		runWebClientTests()
		api.StopServer()
	}
}

func cmdUpdateDb30() {
	if flagCmdUpdateDb30 {
		// This command is a no-op for backwards compatibility
		flushLogAndExit(0)
	}
}

func cmdCreateTeam() {
	if flagCmdCreateTeam {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		c := getMockContext()

		team := &model.Team{}
		team.DisplayName = flagTeamName
		team.Name = flagTeamName
		team.Email = flagEmail
		team.Type = model.TEAM_OPEN

		api.CreateTeam(c, team)
		if c.Err != nil {
			if c.Err.Id != "store.sql_team.save.domain_exists.app_error" {
				l4g.Error("%v", c.Err)
				flushLogAndExit(1)
			}
		}

		os.Exit(0)
	}
}

func cmdCreateUser() {
	if flagCmdCreateUser {
		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagPassword) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -password")
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		user := &model.User{}
		user.Email = flagEmail
		user.Password = flagPassword

		if len(flagUsername) == 0 {
			splits := strings.Split(strings.Replace(flagEmail, "@", " ", -1), " ")
			user.Username = splits[0]
		} else {
			user.Username = flagUsername
		}

		if len(flagTeamName) > 0 {
			if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
				l4g.Error("%v", result.Err)
				flushLogAndExit(1)
			} else {
				team = result.Data.(*model.Team)
			}
		}

		ruser, err := api.CreateUser(user)
		if err != nil {
			if err.Id != "store.sql_user.save.email_exists.app_error" {
				l4g.Error("%v", err)
				flushLogAndExit(1)
			}
		}

		if team != nil {
			err = api.JoinUserToTeam(team, ruser)
			if err != nil {
				l4g.Error("%v", err)
				flushLogAndExit(1)
			}
		}

		os.Exit(0)
	}
}

func cmdInviteUser() {
	if flagCmdInviteUser {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		if len(*utils.Cfg.ServiceSettings.SiteURL) == 0 {
			fmt.Fprintln(os.Stderr, "SiteURL must be specified in config.json")
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(team.Email); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		invites := []string{flagEmail}
		c := getMockContext()
		api.InviteMembers(c, team, user, invites)

		os.Exit(0)
	}
}

func cmdVersion() {
	if flagCmdVersion {
		fmt.Fprintln(os.Stderr, "Version: "+model.CurrentVersion)
		fmt.Fprintln(os.Stderr, "Build Number: "+model.BuildNumber)
		fmt.Fprintln(os.Stderr, "Build Date: "+model.BuildDate)
		fmt.Fprintln(os.Stderr, "Build Hash: "+model.BuildHash)
		fmt.Fprintln(os.Stderr, "Build Enterprise Ready: "+model.BuildEnterpriseReady)
		fmt.Fprintln(os.Stderr, "DB Version: "+api.Srv.Store.(*store.SqlStore).SchemaVersion)

		os.Exit(0)
	}
}

func cmdAssignRole() {
	if flagCmdAssignRole {
		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		// Do some conversions
		if flagRole == "system_admin" {
			flagRole = "system_user system_admin"
		}

		if flagRole == "" {
			flagRole = "system_user"
		}

		if !model.IsValidUserRoles(flagRole) {
			fmt.Fprintln(os.Stderr, "flag invalid argument: -role")
			flag.Usage()
			os.Exit(1)
		}

		c := getMockContext()

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		if !user.IsInRole(flagRole) {
			api.UpdateUserRoles(c, user, flagRole)
		}

		os.Exit(0)
	}
}

func cmdCreateChannel() {
	if flagCmdCreateChannel {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagChannelName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -channel_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		if flagChannelType != "O" && flagChannelType != "P" {
			fmt.Fprintln(os.Stderr, "flag channel_type must have on of the following values: O or P")
			flag.Usage()
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v %v", utils.T(result.Err.Message), result.Err.DetailedError)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v %v", utils.T(result.Err.Message), result.Err.DetailedError)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		c := getMockContext()
		c.Session.UserId = user.Id

		channel := &model.Channel{}
		channel.DisplayName = flagChannelName
		channel.CreatorId = user.Id
		channel.Name = flagChannelName
		channel.TeamId = team.Id
		channel.Type = flagChannelType
		channel.Header = flagChannelHeader
		channel.Purpose = flagChannelPurpose

		if _, err := api.CreateChannel(c, channel, true); err != nil {
			l4g.Error("%v %v", utils.T(err.Message), err.DetailedError)
			flushLogAndExit(1)
		}

		os.Exit(0)
	}
}

func cmdJoinChannel() {
	if flagCmdJoinChannel {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagChannelName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -channel_name")
			flag.Usage()
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		var channel *model.Channel
		if result := <-api.Srv.Store.Channel().GetByName(team.Id, flagChannelName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			channel = result.Data.(*model.Channel)
		}

		_, err := api.AddUserToChannel(user, channel)
		if err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		}

		os.Exit(0)
	}
}

func cmdLeaveChannel() {
	if flagCmdLeaveChannel {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagChannelName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -channel_name")
			flag.Usage()
			os.Exit(1)
		}

		if flagChannelName == model.DEFAULT_CHANNEL {
			fmt.Fprintln(os.Stderr, "flag has invalid argument: -channel_name (cannot leave town-square)")
			flag.Usage()
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		var channel *model.Channel
		if result := <-api.Srv.Store.Channel().GetByName(team.Id, flagChannelName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			channel = result.Data.(*model.Channel)
		}

		err := api.RemoveUserFromChannel(user.Id, user.Id, channel)
		if err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		}

		os.Exit(0)
	}
}

func cmdListChannels() {
	if flagCmdListChannels {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		if result := <-api.Srv.Store.Channel().GetAll(team.Id); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			channels := result.Data.([]*model.Channel)

			for _, channel := range channels {

				if channel.DeleteAt > 0 {
					fmt.Fprintln(os.Stdout, channel.Name+" (archived)")
				} else {
					fmt.Fprintln(os.Stdout, channel.Name)
				}
			}
		}

		os.Exit(0)
	}
}

func cmdRestoreChannel() {
	if flagCmdRestoreChannel {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagChannelName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -channel_name")
			flag.Usage()
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var channel *model.Channel
		if result := <-api.Srv.Store.Channel().GetAll(team.Id); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			channels := result.Data.([]*model.Channel)

			for _, ctemp := range channels {
				if ctemp.Name == flagChannelName {
					channel = ctemp
					break
				}
			}
		}

		if result := <-api.Srv.Store.Channel().SetDeleteAt(channel.Id, 0, model.GetMillis()); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		}

		os.Exit(0)
	}
}

func cmdJoinTeam() {
	if flagCmdJoinTeam {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		err := api.JoinUserToTeam(team, user)
		if err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		}

		os.Exit(0)
	}
}

func cmdLeaveTeam() {
	if flagCmdLeaveTeam {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		err := api.LeaveTeam(team, user)

		if err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		}

		os.Exit(0)
	}
}

func cmdResetPassword() {
	if flagCmdResetPassword {
		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagPassword) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -password")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagPassword) < 5 {
			fmt.Fprintln(os.Stderr, "flag invalid argument needs to be more than 4 characters: -password")
			flag.Usage()
			os.Exit(1)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		if result := <-api.Srv.Store.User().UpdatePassword(user.Id, model.HashPassword(flagPassword)); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		}

		os.Exit(0)
	}
}

func cmdResetMfa() {
	if flagCmdResetMfa {
		if len(flagEmail) == 0 && len(flagUsername) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email OR -username")
			flag.Usage()
			os.Exit(1)
		}

		var user *model.User
		if len(flagEmail) > 0 {
			if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
				l4g.Error("%v", result.Err)
				flushLogAndExit(1)
			} else {
				user = result.Data.(*model.User)
			}
		} else {
			if result := <-api.Srv.Store.User().GetByUsername(flagUsername); result.Err != nil {
				l4g.Error("%v", result.Err)
				flushLogAndExit(1)
			} else {
				user = result.Data.(*model.User)
			}
		}

		if err := api.DeactivateMfa(user.Id); err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		}

		os.Exit(0)
	}
}

func cmdPermDeleteUser() {
	if flagCmdPermanentDeleteUser {
		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		c := getMockContext()

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		if len(flagConfirmBackup) == 0 {
			fmt.Print("Have you performed a database backup? (YES/NO): ")
			fmt.Scanln(&flagConfirmBackup)
		}

		if flagConfirmBackup != "YES" {
			fmt.Print("ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		var confirm string
		fmt.Printf("Are you sure you want to delete the user %v?  All data will be permanently deleted? (YES/NO): ", user.Email)
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			fmt.Print("ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		if err := api.PermanentDeleteUser(c, user); err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		} else {
			fmt.Print("SUCCESS: User deleted.")
			flushLogAndExit(0)
		}
	}
}

func cmdPermDeleteTeam() {
	if flagCmdPermanentDeleteTeam {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		c := getMockContext()

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		if len(flagConfirmBackup) == 0 {
			fmt.Print("Have you performed a database backup? (YES/NO): ")
			fmt.Scanln(&flagConfirmBackup)
		}

		if flagConfirmBackup != "YES" {
			fmt.Print("ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		var confirm string
		fmt.Printf("Are you sure you want to delete the team %v?  All data will be permanently deleted? (YES/NO): ", team.Name)
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			fmt.Print("ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		if err := api.PermanentDeleteTeam(c, team); err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		} else {
			fmt.Print("SUCCESS: Team deleted.")
			flushLogAndExit(0)
		}
	}
}

func cmdPermDeleteAllUsers() {
	if flagCmdPermanentDeleteAllUsers {
		c := getMockContext()

		if len(flagConfirmBackup) == 0 {
			fmt.Print("Have you performed a database backup? (YES/NO): ")
			fmt.Scanln(&flagConfirmBackup)
		}

		if flagConfirmBackup != "YES" {
			fmt.Print("ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		var confirm string
		fmt.Printf("Are you sure you want to delete all the users?  All data will be permanently deleted? (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			fmt.Print("ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		if err := api.PermanentDeleteAllUsers(c); err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		} else {
			fmt.Print("SUCCESS: All users deleted.")
			flushLogAndExit(0)
		}
	}
}

func cmdResetDatabase() {
	if flagCmdResetDatabase {

		if len(flagConfirmBackup) == 0 {
			fmt.Print("Have you performed a database backup? (YES/NO): ")
			fmt.Scanln(&flagConfirmBackup)
		}

		if flagConfirmBackup != "YES" {
			fmt.Print("ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		var confirm string
		fmt.Printf("Are you sure you want to delete everything?  ALL data will be permanently deleted? (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			fmt.Print("ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		api.Srv.Store.DropAllTables()
		fmt.Print("SUCCESS: Database reset.")
		flushLogAndExit(0)
	}

}

func cmdRunLdapSync() {
	if flagCmdRunLdapSync {
		if ldapI := einterfaces.GetLdapInterface(); ldapI != nil {
			if err := ldapI.Syncronize(); err != nil {
				fmt.Println("ERROR: AD/LDAP Syncronization Failed")
				l4g.Error("%v", err.Error())
				flushLogAndExit(1)
			} else {
				fmt.Println("SUCCESS: AD/LDAP Syncronization Complete")
				flushLogAndExit(0)
			}
		}
	}
}

func cmdRunMigrateAccounts() {
	if flagCmdMigrateAccounts {
		if len(flagFromAuth) == 0 || (flagFromAuth != "email" && flagFromAuth != "gitlab" && flagFromAuth != "saml") {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -from_auth")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagToAuth) == 0 || flagToAuth != "ldap" {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -from_auth")
			flag.Usage()
			os.Exit(1)
		}

		// Email auth in Mattermost system is represented by ""
		if flagFromAuth == "email" {
			flagFromAuth = ""
		}

		if len(flagMatchField) == 0 || (flagMatchField != "email" && flagMatchField != "username") {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -match_field")
			flag.Usage()
			os.Exit(1)
		}

		if migrate := einterfaces.GetAccountMigrationInterface(); migrate != nil {
			if err := migrate.MigrateToLdap(flagFromAuth, flagMatchField); err != nil {
				fmt.Println("ERROR: Account migration failed.")
				l4g.Error("%v", err.Error())
				flushLogAndExit(1)
			} else {
				fmt.Println("SUCCESS: Account migration complete.")
				flushLogAndExit(0)
			}
		}
	}
}

func cmdUploadLicense() {
	if flagCmdUploadLicense {
		if model.BuildEnterpriseReady != "true" {
			fmt.Fprintln(os.Stderr, "build must be enterprise ready")
			os.Exit(1)
		}

		if len(flagLicenseFile) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		var fileBytes []byte
		var err error
		if fileBytes, err = ioutil.ReadFile(flagLicenseFile); err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		}

		if _, err := api.SaveLicense(fileBytes); err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		} else {
			flushLogAndExit(0)
		}

		flushLogAndExit(0)
	}
}

func cmdActivateUser() {
	if flagCmdActivateUser {
		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			flag.Usage()
			os.Exit(1)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		if user.IsLDAPUser() {
			l4g.Error("%v", utils.T("api.user.update_active.no_deactivate_ldap.app_error"))
		}

		if _, err := api.UpdateActive(user, !flagUserSetInactive); err != nil {
			l4g.Error("%v", err)
		}

		os.Exit(0)
	}
}

func cmdSlackImport() {
	if flagCmdSlackImport {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			flag.Usage()
			os.Exit(1)
		}

		if len(flagImportArchive) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -import_archive")
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		fileReader, err := os.Open(flagImportArchive)
		if err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		}
		defer fileReader.Close()

		fileInfo, err := fileReader.Stat()
		if err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		}

		fmt.Fprintln(os.Stdout, "Running Slack Import. This may take a long time for large teams or teams with many messages.")

		api.SlackImport(fileReader, fileInfo.Size(), team.Id)

		flushLogAndExit(0)
	}
}

func flushLogAndExit(code int) {
	l4g.Close()
	time.Sleep(time.Second)
	os.Exit(code)
}

func getMockContext() *api.Context {
	c := &api.Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	c.T = utils.TfuncWithFallback(model.DEFAULT_LOCALE)
	c.Locale = model.DEFAULT_LOCALE
	return c
}

var usage = `Mattermost commands to help configure the system

NAME:
    platform -- platform configuation tool

USAGE:
    platform [options]

FLAGS:
    -config="config.json"             Path to the config file

    -username="someuser"              Username used in other commands

    -license="ex.mattermost-license"  Path to your license file

    -email="user@example.com"         Email address used in other commands

    -password="mypassword"            Password used in other commands

    -team_name="name"                 The team name used in other commands

    -channel_name="name"	      The channel name used in other commands

    -channel_header="string"	      The channel header used in other commands

    -channel_purpose="string"	      The channel purpose used in other commands

    -channel_type="type"	      The channel type used in other commands
     				      valid values are
     				        "O" - public channel
     				        "P" - private group

    -role="system_admin"              The role used in other commands
                                      valid values are
                                        "system_user" - Is basic user
                                           permissions
                                        "system_admin" - Represents a system
                                           admin who has access to all teams
                                           and configuration settings.

    -import_archive="export.zip"      The path to the archive to import used in other commands

COMMANDS:
    -activate_user		      Set a user as active or inactive. It requies
    				      the -email flag.

        Examples:
            platform -activate_user -email="user@example.com"
            platform -activate_user -inactive -email="user@example.com"

    -create_team                      Creates a team.  It requires the -team_name
                                      and -email flag to create a team.
        Example:
            platform -create_team -team_name="name" -email="user@example.com"

    -create_user                      Creates a user.  It requires the -email and -password flag
                                      and -team_name and -username are optional to create a user.
        Example:
            platform -create_user -team_name="name" -email="user@example.com" -password="mypassword" -username="user"

    -invite_user                      Invites a user to a team by email. It requires the -team_name
                                      and -email flags.
        Example:
	    platform -invite_user -team_name="name" -email="user@example.com"

    -leave_team                       Removes a user from a team.  It requires the -team_name
                                      and -email.
        Example:
	    platform -remove_user_from_team -team_name="name" -email="user@example.com"

    -join_team                        Joins a user to the team.  It required the -email and
                                      -team_name.  You may need to logout of your current session
                                      for the new team to be applied.
        Example:
            platform -join_team -email="user@example.com" -team_name="name"

    -assign_role                      Assigns role to a user.  It requires the -role and
                                      -email flag.  You may need to log out
                                      of your current sessions for the new role to be
                                      applied. For system admin use "system_admin". For Regular user just use "system_user".
        Example:
            platform -assign_role -email="user@example.com" -role="system_admin"

    -create_channel		       Create a new channel in the specified team. It requires the -email,
    					-team_name, -channel_name, -channel_type flags. Optional you can set
    					the -channel_header and -channel_purpose.

	Example:
            platform -create_channel -email="user@example.com" -team_name="name" -channel_name="channel_name" -channel_type="O"

    -join_channel                      Joins a user to the channel.  It requires the -email, channel_name and
                                       -team_name flags.  You may need to logout of your current session
                                       for the new channel to be applied.  Requires an enterprise license.
        Example:
            platform -join_channel -email="user@example.com" -team_name="name" -channel_name="channel_name"

    -leave_channel                     Removes a user from the channel.  It requires the -email, channel_name and
                                       -team_name flags.  You may need to logout of your current session
                                       for the channel to be removed.  Requires an enterprise license.
        Example:
            platform -leave_channel -email="user@example.com" -team_name="name" -channel_name="channel_name"

    -list_channels                     Lists all public channels and private groups for a given team.
                                       It will append ' (archived)' to the channel name if archived.  It requires the 
                                       -team_name flag.  Requires an enterprise license.
        Example:
            platform -list_channels -team_name="name"

    -restore_channel                   Restores a previously deleted channel.
                                       It requires the -channel_name and
                                       -team_name flags.  Requires an enterprise license.
        Example:
            platform -restore_channel -team_name="name" -channel_name="channel_name"

    -reset_password                   Resets the password for a user.  It requires the
                                      -email and -password flag.
        Example:
            platform -reset_password -email="user@example.com" -password="newpassword"

    -reset_mfa                        Turns off multi-factor authentication for a user.  It requires the
                                      -email or -username flag.
        Example:
            platform -reset_mfa -username="someuser"

    -reset_database                   Completely erases the database causing the loss of all data. This 
                                      will reset Mattermost to it's initial state. (note this will not 
                                      erase your configuration.)

        Example:
            platform -reset_database

    -permanent_delete_user            Permanently deletes a user and all related information
                                      including posts from the database.  It requires the 
                                      -email flag.  You may need to restart the
                                      server to invalidate the cache
        Example:
            platform -permanent_delete_user -email="user@example.com"

    -permanent_delete_all_users       Permanently deletes all users and all related information
                                      including posts from the database.  It requires the 
                                      -team_name, and -email flag.  You may need to restart the
                                      server to invalidate the cache
        Example:
            platform -permanent_delete_all_users -team_name="name" -email="user@example.com"

    -permanent_delete_team            Permanently deletes a team allong with
                                      all related information including posts from the database.
                                      It requires the -team_name flag.  You may need to restart
                                      the server to invalidate the cache.
        Example:
            platform -permanent_delete_team -team_name="name"

    -upload_license                   Uploads a license to the server. Requires the -license flag.

        Example:
            platform -upload_license -license="/path/to/license/example.mattermost-license"

	-migrate_accounts				  Migrates accounts from one authentication provider to anouther. Requires -from_auth -to_auth and -match_field flags. Supported options for -from_auth: email, gitlab, saml. Supported options for -to_auth ldap. Supported options for -match_field email, username. Will display any accounts that are not migrated succesfully.

        Example:
            platform -migrate_accounts -from_auth email -to_auth ldap -match_field username

    -slack_import                    Imports a Slack team export zip file. It requires the -team_name
                                     and -import_archive flags.

        Example:
            platform -slack_import -team_name="name" -import_archive="/path/to/slack_export.zip"

    -upgrade_db_30                   Upgrades the database from a version 2.x schema to version 3 see
                                      http://www.mattermost.org/upgrading-to-mattermost-3-0/

        Example:
            platform -upgrade_db_30

    -version                          Display the current of the Mattermost platform 

    -help                             Displays this help page`
