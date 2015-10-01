// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/manualtesting"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/web"
)

var flagCmdCreateTeam bool
var flagCmdCreateUser bool
var flagCmdAssignRole bool
var flagCmdVersion bool
var flagCmdResetPassword bool
var flagConfigFile string
var flagEmail string
var flagPassword string
var flagTeamName string
var flagRole string
var flagRunCmds bool

func main() {

	parseCmds()

	utils.LoadConfig(flagConfigFile)

	if flagRunCmds {
		utils.ConfigureCmdLineLog()
	}

	pwd, _ := os.Getwd()
	l4g.Info("Current version is %v (%v/%v/%v)", model.CurrentVersion, model.BuildNumber, model.BuildDate, model.BuildHash)
	l4g.Info("Current working directory is %v", pwd)
	l4g.Info("Loaded config file from %v", utils.FindConfigFile(flagConfigFile))

	api.NewServer()
	api.InitApi()
	web.InitWeb()

	if flagRunCmds {
		runCmds()
	} else {
		api.StartServer()

		// If we allow testing then listen for manual testing URL hits
		if utils.Cfg.ServiceSettings.EnableTesting {
			manualtesting.InitManualTesting()
		}

		diagnosticsJob()

		// wait for kill signal before attempting to gracefully shutdown
		// the running service
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
		<-c

		api.StopServer()
	}
}

func diagnosticsJob() {
	go func() {
		for {
			if utils.Cfg.PrivacySettings.EnableDiagnostic && model.BuildNumber != "_BUILD_NUMBER_" {
				if result := <-api.Srv.Store.System().Get(); result.Err == nil {
					props := result.Data.(model.StringMap)
					lastTime, _ := strconv.ParseInt(props["LastDiagnosticTime"], 10, 0)
					currentTime := model.GetMillis()

					if (currentTime - lastTime) > 1000*60*60*24*7 {
						l4g.Info("Sending error and diagnostic information to mattermost")

						id := props["DiagnosticId"]
						if len(id) == 0 {
							id = model.NewId()
							systemId := &model.System{Name: "DiagnosticId", Value: id}
							<-api.Srv.Store.System().Save(systemId)
						}

						systemLastTime := &model.System{Name: "LastDiagnosticTime", Value: strconv.FormatInt(currentTime, 10)}
						if lastTime == 0 {
							<-api.Srv.Store.System().Save(systemLastTime)
						} else {
							<-api.Srv.Store.System().Update(systemLastTime)
						}

						m := make(map[string]string)
						m[utils.PROP_DIAGNOSTIC_ID] = id
						m[utils.PROP_DIAGNOSTIC_BUILD] = model.CurrentVersion + "." + model.BuildNumber
						m[utils.PROP_DIAGNOSTIC_DATABASE] = utils.Cfg.SqlSettings.DriverName
						m[utils.PROP_DIAGNOSTIC_OS] = runtime.GOOS
						m[utils.PROP_DIAGNOSTIC_CATEGORY] = utils.VAL_DIAGNOSTIC_CATEGORY_DEFALUT

						if ucr := <-api.Srv.Store.User().GetTotalUsersCount(); ucr.Err == nil {
							m[utils.PROP_DIAGNOSTIC_USER_COUNT] = strconv.FormatInt(ucr.Data.(int64), 10)
						}

						utils.SendDiagnostic(m)
					}
				}
			}

			time.Sleep(time.Hour * 24)
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

	flag.Parse()

	flagRunCmds = flagCmdCreateTeam || flagCmdCreateUser || flagCmdAssignRole || flagCmdResetPassword || flagCmdVersion
}

func runCmds() {
	cmdVersion()
	cmdCreateTeam()
	cmdCreateUser()
	cmdAssignRole()
	cmdResetPassword()
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

		c := &api.Context{}
		c.RequestId = model.NewId()
		c.IpAddress = "cmd_line"

		team := &model.Team{}
		team.DisplayName = flagTeamName
		team.Name = flagTeamName
		team.Email = flagEmail
		team.Type = model.TEAM_INVITE

		api.CreateTeam(c, team)
		if c.Err != nil {
			if c.Err.Message != "A team with that domain already exists" {
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

		c := &api.Context{}
		c.RequestId = model.NewId()
		c.IpAddress = "cmd_line"

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

		api.CreateUser(c, team, user)
		if c.Err != nil {
			if c.Err.Message != "An account with that email already exists." {
				l4g.Error("%v", c.Err)
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

		c := &api.Context{}
		c.RequestId = model.NewId()
		c.IpAddress = "cmd_line"

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

		c := &api.Context{}
		c.RequestId = model.NewId()
		c.IpAddress = "cmd_line"

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

func flushLogAndExit(code int) {
	l4g.Close()
	time.Sleep(time.Second)
	os.Exit(code)
}

var usage = `Mattermost commands to help configure the system
Usage:

    platform [options]

    -version                          Display the current version

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
                                           and configuration settings.  This
                                           role can only be created on the
                                           team named "admin"

    -create_team                      Creates a team.  It requires the -team_name
                                      and -email flag to create a team.
        Example:
            platform -create_team -team_name="name" -email="user@example.com"

    -create_user                      Creates a user.  It requires the -team_name,
                                      -email and -password flag to create a user.
        Example:
            platform -create_user -team_name="name" -email="user@example.com" -password="mypassword"

    -assign_role                      Assigns role to a user.  It requires the -role,
                                      -email and -team_name flag.  You may need to logout
                                      of your current sessions for the new role to be
                                      applied.
        Example:
            platform -assign_role -team_name="name" -email="user@example.com" -role="admin"

    -reset_password                   Resets the password for a user.  It requires the
                                      -team_name, -email and -password flag.
        Example:
            platform -reset_password -team_name="name" -email="user@example.com" -paossword="newpassword"


`
