// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/web"
)

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

func doLegacyCommands() {
	doLoadConfig(flagConfigFile)
	utils.InitTranslations(utils.Cfg.LocalizationSettings)
	utils.ConfigureCmdLineLog()
	api.NewServer()
	api.InitStores()
	api.InitRouter()
	api.InitApi()
	web.InitWeb()

	if model.BuildEnterpriseReady == "true" {
		api.LoadLicense()
	}

	runCmds()
}

func parseCmds() {
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
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
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
			os.Exit(1)
		}

		if len(flagPassword) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -password")
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
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
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
		api.InviteMembers(team, user.GetDisplayName(), invites)

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
			os.Exit(1)
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByEmail(flagEmail); result.Err != nil {
			l4g.Error("%v", result.Err)
			flushLogAndExit(1)
		} else {
			user = result.Data.(*model.User)
		}

		if !user.IsInRole(flagRole) {
			api.UpdateUserRoles(user, flagRole)
		}

		os.Exit(0)
	}
}

func cmdCreateChannel() {
	if flagCmdCreateChannel {
		if len(flagTeamName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -team_name")
			os.Exit(1)
		}

		if len(flagChannelName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -channel_name")
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			os.Exit(1)
		}

		if flagChannelType != "O" && flagChannelType != "P" {
			fmt.Fprintln(os.Stderr, "flag channel_type must have on of the following values: O or P")
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
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
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			os.Exit(1)
		}

		if len(flagChannelName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -channel_name")
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
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
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
			os.Exit(1)
		}

		if len(flagChannelName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -channel_name")
			os.Exit(1)
		}

		if flagChannelName == model.DEFAULT_CHANNEL {
			fmt.Fprintln(os.Stderr, "flag has invalid argument: -channel_name (cannot leave town-square)")
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
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
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
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
			os.Exit(1)
		}

		if len(flagChannelName) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -channel_name")
			os.Exit(1)
		}

		if !utils.IsLicensed {
			fmt.Fprintln(os.Stderr, utils.T("cli.license.critical"))
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
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
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
			os.Exit(1)
		}

		if len(flagEmail) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -email")
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
			os.Exit(1)
		}

		if len(flagPassword) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -password")
			os.Exit(1)
		}

		if len(flagPassword) < 5 {
			fmt.Fprintln(os.Stderr, "flag invalid argument needs to be more than 4 characters: -password")
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
			os.Exit(1)
		}

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

		if err := api.PermanentDeleteUser(user); err != nil {
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
			os.Exit(1)
		}

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

		if err := api.PermanentDeleteTeam(team); err != nil {
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

		if err := api.PermanentDeleteAllUsers(); err != nil {
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
			os.Exit(1)
		}

		if len(flagToAuth) == 0 || flagToAuth != "ldap" {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -from_auth")
			os.Exit(1)
		}

		// Email auth in Mattermost system is represented by ""
		if flagFromAuth == "email" {
			flagFromAuth = ""
		}

		if len(flagMatchField) == 0 || (flagMatchField != "email" && flagMatchField != "username") {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -match_field")
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
			os.Exit(1)
		}

		if len(flagImportArchive) == 0 {
			fmt.Fprintln(os.Stderr, "flag needs an argument: -import_archive")
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

	if *utils.Cfg.ServiceSettings.SiteURL != "" {
		c.SetSiteURL(*utils.Cfg.ServiceSettings.SiteURL)
	}

	return c
}
