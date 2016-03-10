// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/manualtesting"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/web"

	// Plugins
	_ "github.com/mattermost/platform/model/gitlab"

	// Enterprise Deps
	_ "github.com/go-ldap/ldap"
)

//ENTERPRISE_IMPORTS

var flagCmdCreateTeam bool
var flagCmdCreateUser bool
var flagCmdAssignRole bool
var flagCmdVersion bool
var flagCmdResetPassword bool
var flagCmdPermanentDeleteUser bool
var flagCmdPermanentDeleteTeam bool
var flagConfigFile string
var flagEmail string
var flagPassword string
var flagTeamName string
var flagRole string
var flagRunCmds bool

func main() {

	parseCmds()

	utils.InitTranslations()
	utils.LoadConfig(flagConfigFile)

	if flagRunCmds {
		utils.ConfigureCmdLineLog()
	}

	pwd, _ := os.Getwd()
	l4g.Info(utils.T("mattermost.current_version"), model.CurrentVersion, model.BuildNumber, model.BuildDate, model.BuildHash)
	l4g.Info(utils.T("mattermost.entreprise_enabled"), model.BuildEnterpriseReady)
	l4g.Info(utils.T("mattermost.working_dir"), pwd)
	l4g.Info(utils.T("mattermost.config_file"), utils.FindConfigFile(flagConfigFile))

	api.NewServer()
	api.InitApi()
	web.InitWeb()

	if model.BuildEnterpriseReady == "true" {
		loadLicense()
	}

	if !utils.IsLicensed && len(utils.Cfg.SqlSettings.DataSourceReplicas) > 1 {
		l4g.Critical(utils.T("store.sql.read_replicas_not_licensed.critical"))
		time.Sleep(time.Second)
		panic(fmt.Sprintf(utils.T("store.sql.read_replicas_not_licensed.critical")))
	}

	if flagRunCmds {
		runCmds()
	} else {
		api.StartServer()

		// If we allow testing then listen for manual testing URL hits
		if utils.Cfg.ServiceSettings.EnableTesting {
			manualtesting.InitManualTesting()
		}

		setDiagnosticId()
		runSecurityAndDiagnosticsJobAndForget()

		// wait for kill signal before attempting to gracefully shutdown
		// the running service
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
		<-c

		api.StopServer()
	}
}

func loadLicense() {
	licenseId := ""
	if result := <-api.Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		licenseId = props[model.SYSTEM_ACTIVE_LICENSE_ID]
	}

	if len(licenseId) != 26 {
		l4g.Warn(utils.T("mattermost.load_license.find.warn"))
		return
	}

	if result := <-api.Srv.Store.License().Get(licenseId); result.Err == nil {
		record := result.Data.(*model.LicenseRecord)
		utils.LoadLicense([]byte(record.Bytes))
	} else {
		l4g.Warn(utils.T("mattermost.load_license.find.warn"))
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

func runSecurityAndDiagnosticsJobAndForget() {
	go func() {
		for {
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

						if ucr := <-api.Srv.Store.User().GetTotalActiveUsersCount(); ucr.Err == nil {
							v.Set(utils.PROP_DIAGNOSTIC_ACTIVE_USER_COUNT, strconv.FormatInt(ucr.Data.(int64), 10))
						}

						res, err := http.Get(utils.DIAGNOSTIC_URL + "/security?" + v.Encode())
						if err != nil {
							l4g.Error(utils.T("mattermost.security_info.error"))
							return
						}

						bulletins := model.SecurityBulletinsFromJson(res.Body)

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

			time.Sleep(time.Hour * 4)
		}
	}()
}

func parseCmds() {
	flag.Usage = func() {
		fmt.Fprintln(os.Stderr, usage)
	}

	flag.StringVar(&flagConfigFile, "config", "config.json", "")
	flag.StringVar(&flagEmail, "email", "", "")
	flag.StringVar(&flagPassword, "password", "", "")
	flag.StringVar(&flagTeamName, "team_name", "", "")
	flag.StringVar(&flagRole, "role", "", "")

	flag.BoolVar(&flagCmdCreateTeam, "create_team", false, "")
	flag.BoolVar(&flagCmdCreateUser, "create_user", false, "")
	flag.BoolVar(&flagCmdAssignRole, "assign_role", false, "")
	flag.BoolVar(&flagCmdVersion, "version", false, "")
	flag.BoolVar(&flagCmdResetPassword, "reset_password", false, "")
	flag.BoolVar(&flagCmdPermanentDeleteUser, "permanent_delete_user", false, "")
	flag.BoolVar(&flagCmdPermanentDeleteTeam, "permanent_delete_team", false, "")

	flag.Parse()

	flagRunCmds = (flagCmdCreateTeam ||
		flagCmdCreateUser ||
		flagCmdAssignRole ||
		flagCmdResetPassword ||
		flagCmdVersion ||
		flagCmdPermanentDeleteUser ||
		flagCmdPermanentDeleteTeam)
}

func runCmds() {
	cmdVersion()
	cmdCreateTeam()
	cmdCreateUser()
	cmdAssignRole()
	cmdResetPassword()
	cmdPermDeleteUser()
	cmdPermDeleteTeam()
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

		if len(flagPassword) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -password")
			flag.Usage()
			os.Exit(1)
		}

		var team *model.Team
		user := &model.User{}
		user.Email = flagEmail
		user.Password = flagPassword
		splits := strings.Split(strings.Replace(flagEmail, "@", " ", -1), " ")
		user.Username = splits[0]

		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
			user.TeamId = team.Id
		}

		_, err := api.CreateUser(team, user)
		if err != nil {
			if err.Id != "store.sql_user.save.email_exists.app_error" {
				l4g.Error("%v", err)
				flushLogAndExit(1)
			}
		}

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

		os.Exit(0)
	}
}

func cmdAssignRole() {
	if flagCmdAssignRole {
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

		if !model.IsValidRoles(flagRole) {
			fmt.Fprintln(os.Stderr, "flag invalid argument: -role")
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

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(team.Id, flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		if !user.IsInRole(flagRole) {
			api.UpdateRoles(c, user, flagRole)
		}

		os.Exit(0)
	}
}

func cmdResetPassword() {
	if flagCmdResetPassword {
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

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(team.Id, flagEmail); result.Err != nil {
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

func cmdPermDeleteUser() {
	if flagCmdPermanentDeleteUser {
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

		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(flagTeamName); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			team = result.Data.(*model.Team)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(team.Id, flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		var confirmBackup string
		fmt.Print("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirmBackup)
		if confirmBackup != "YES" {
			flushLogAndExit(1)
		}

		var confirm string
		fmt.Printf("Are you sure you want to delete the user %v?  All data will be permanently deleted? (YES/NO): ", user.Email)
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			flushLogAndExit(1)
		}

		if err := api.PermanentDeleteUser(c, user); err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		} else {
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

		var confirmBackup string
		fmt.Print("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirmBackup)
		if confirmBackup != "YES" {
			flushLogAndExit(1)
		}

		var confirm string
		fmt.Printf("Are you sure you want to delete the team %v?  All data will be permanently deleted? (YES/NO): ", team.Name)
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			flushLogAndExit(1)
		}

		if err := api.PermanentDeleteTeam(c, team); err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
		} else {
			flushLogAndExit(0)
		}
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

    -email="user@example.com"         Email address used in other commands

    -password="mypassword"            Password used in other commands

    -team_name="name"                 The team name used in other commands

    -role="admin"                     The role used in other commands
                                      valid values are
                                        "" - The empty role is basic user
                                           permissions
                                        "admin" - Represents a team admin and
                                           is used to help administer one team.
                                        "system_admin" - Represents a system
                                           admin who has access to all teams
                                           and configuration settings.
COMMANDS: 
    -create_team                      Creates a team.  It requires the -team_name
                                      and -email flag to create a team.
        Example:
            platform -create_team -team_name="name" -email="user@example.com"

    -create_user                      Creates a user.  It requires the -team_name,
                                      -email and -password flag to create a user.
        Example:
            platform -create_user -team_name="name" -email="user@example.com" -password="mypassword"

    -assign_role                      Assigns role to a user.  It requires the -role,
                                      -email and -team_name flag.  You may need to log out
                                      of your current sessions for the new role to be
                                      applied.
        Example:
            platform -assign_role -team_name="name" -email="user@example.com" -role="admin"

    -reset_password                   Resets the password for a user.  It requires the
                                      -team_name, -email and -password flag.
        Example:
            platform -reset_password -team_name="name" -email="user@example.com" -password="newpassword"

    -permanent_delete_user            Permanently deletes a user and all related information
                                      including posts from the database.  It requires the 
                                      -team_name, and -email flag.  You may need to restart the
                                      server to invalidate the cache
        Example:
            platform -permanent_delete_user -team_name="name" -email="user@example.com"

    -permanent_delete_team            Permanently deletes a team and all users along with
                                      all related information including posts from the database.
                                      It requires the -team_name flag.  You may need to restart
                                      the server to invalidate the cache.
        Example:
            platform -permanent_delete_team -team_name="name"

    -version                          Display the current of the Mattermost platform 

    -help                             Displays this help page`
