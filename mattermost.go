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
var flagCmdAssignRole bool
var flagCmdVersion bool
var flagCmdResetPassword bool
var flagCmdResetMfa bool
var flagCmdPermanentDeleteUser bool
var flagCmdPermanentDeleteTeam bool
var flagCmdPermanentDeleteAllUsers bool
var flagCmdResetDatabase bool
var flagUsername string
var flagCmdUploadLicense bool
var flagConfigFile string
var flagLicenseFile string
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

	// Speical case for upgrading the db to 3.0
	// ADDED for 3.0 REMOVE for 3.4
	cmdUpdateDb30()

	api.NewServer()
	api.InitApi()
	web.InitWeb()

	if model.BuildEnterpriseReady == "true" {
		api.LoadLicense()
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

		if einterfaces.GetComplianceInterface() != nil {
			einterfaces.GetComplianceInterface().StartComplianceDailyJob()
		}

		// wait for kill signal before attempting to gracefully shutdown
		// the running service
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
		<-c

		api.StopServer()
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
	flag.StringVar(&flagUsername, "username", "", "")
	flag.StringVar(&flagLicenseFile, "license", "", "")
	flag.StringVar(&flagEmail, "email", "", "")
	flag.StringVar(&flagPassword, "password", "", "")
	flag.StringVar(&flagTeamName, "team_name", "", "")
	flag.StringVar(&flagRole, "role", "", "")

	flag.BoolVar(&flagCmdUpdateDb30, "upgrade_db_30", false, "")
	flag.BoolVar(&flagCmdCreateTeam, "create_team", false, "")
	flag.BoolVar(&flagCmdCreateUser, "create_user", false, "")
	flag.BoolVar(&flagCmdAssignRole, "assign_role", false, "")
	flag.BoolVar(&flagCmdVersion, "version", false, "")
	flag.BoolVar(&flagCmdResetPassword, "reset_password", false, "")
	flag.BoolVar(&flagCmdResetMfa, "reset_mfa", false, "")
	flag.BoolVar(&flagCmdPermanentDeleteUser, "permanent_delete_user", false, "")
	flag.BoolVar(&flagCmdPermanentDeleteTeam, "permanent_delete_team", false, "")
	flag.BoolVar(&flagCmdPermanentDeleteAllUsers, "permanent_delete_all_users", false, "")
	flag.BoolVar(&flagCmdResetDatabase, "reset_database", false, "")
	flag.BoolVar(&flagCmdUploadLicense, "upload_license", false, "")

	flag.Parse()

	flagRunCmds = (flagCmdCreateTeam ||
		flagCmdCreateUser ||
		flagCmdAssignRole ||
		flagCmdResetPassword ||
		flagCmdResetMfa ||
		flagCmdVersion ||
		flagCmdPermanentDeleteUser ||
		flagCmdPermanentDeleteTeam ||
		flagCmdPermanentDeleteAllUsers ||
		flagCmdResetDatabase ||
		flagCmdUploadLicense)
}

func runCmds() {
	cmdVersion()
	cmdCreateTeam()
	cmdCreateUser()
	cmdAssignRole()
	cmdResetPassword()
	cmdResetMfa()
	cmdPermDeleteUser()
	cmdPermDeleteTeam()
	cmdPermDeleteAllUsers()
	cmdResetDatabase()
	cmdUploadLicense()
}

type TeamForUpgrade struct {
	Id   string
	Name string
}

// ADDED for 3.0 REMOVE for 3.4
func cmdUpdateDb30() {
	if flagCmdUpdateDb30 {
		api.Srv = &api.Server{}
		api.Srv.Store = store.NewSqlStoreForUpgrade30()
		store := api.Srv.Store.(*store.SqlStore)

		l4g.Info("Attempting to run speical upgrade of the database schema to version 3.0 for user model changes")
		time.Sleep(time.Second)

		if !store.DoesColumnExist("Users", "TeamId") {
			fmt.Println("**WARNING** the database schema appears to be upgraded to 3.0")
			flushLogAndExit(1)
		}

		if !(store.SchemaVersion == "2.2.0" ||
			store.SchemaVersion == "2.1.0" ||
			store.SchemaVersion == "2.0.0") {
			fmt.Println("**WARNING** the database schema needs to be version 2.2.0, 2.1.0 or 2.0.0 to upgrade")
			flushLogAndExit(1)
		}

		var confirmBackup string
		fmt.Println("\nPlease see http://www.mattermost.org/upgrade-to-3-0/")
		fmt.Println("**WARNING** This upgrade process will be irreversible.")
		fmt.Print("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirmBackup)
		if confirmBackup != "YES" {
			fmt.Fprintln(os.Stderr, "ABORTED: You did not answer YES exactly, in all capitals.")
			flushLogAndExit(1)
		}

		var flagTeamName string
		var teams []*TeamForUpgrade

		if _, err := store.GetMaster().Select(&teams, "SELECT Id, Name FROM Teams"); err != nil {
			l4g.Error("Failed to load all teams details=%v", err)
			flushLogAndExit(1)
		}

		fmt.Println(fmt.Sprintf("We found %v teams.", len(teams)))

		for _, team := range teams {
			fmt.Println(team.Name)
		}

		fmt.Print("Please pick a primary team from the list above: ")
		fmt.Scanln(&flagTeamName)

		var team *TeamForUpgrade
		for _, t := range teams {
			if t.Name == flagTeamName {
				team = t
				break
			}
		}

		if team == nil {
			l4g.Error("Failed to find primary team details")
			flushLogAndExit(1)
		}

		l4g.Info("Starting speical 3.0 database upgrade with performed_backup=YES team_name=%v", team.Name)
		l4g.Info("Primary team %v will be left unchanged", team.Name)
		l4g.Info("Upgrading primary team %v", team.Name)

		uniqueEmails := make(map[string]bool)
		uniqueUsernames := make(map[string]bool)
		primaryUsers := convertTeamTo30(team, uniqueEmails, uniqueUsernames)

		l4g.Info("Upgraded %v users", len(primaryUsers))

		for _, otherTeam := range teams {
			if otherTeam.Id != team.Id {
				l4g.Info("Upgrading team %v", otherTeam.Name)
				users := convertTeamTo30(otherTeam, uniqueEmails, uniqueUsernames)
				l4g.Info("Upgraded %v users", len(users))

			}
		}

		l4g.Info("Altering other scheme changes needed 3.0 for user model changes")

		if _, err := store.GetMaster().Exec(`
				UPDATE Channels 
				SET 
				    TeamId = ''
				WHERE
				    Type = 'D'
				`,
		); err != nil {
			l4g.Error("Failed to update direct channel types details=%v", err)
			flushLogAndExit(1)
		}

		extraLength := store.GetMaxLengthOfColumnIfExists("Audits", "ExtraInfo")
		if len(extraLength) > 0 && extraLength != "1024" {
			store.AlterColumnTypeIfExists("Audits", "ExtraInfo", "VARCHAR(1024)", "VARCHAR(1024)")
		}

		actionLength := store.GetMaxLengthOfColumnIfExists("Audits", "Action")
		if len(actionLength) > 0 && actionLength != "512" {
			store.AlterColumnTypeIfExists("Audits", "Action", "VARCHAR(512)", "VARCHAR(512)")
		}

		if store.DoesColumnExist("Sessions", "TeamId") {
			store.RemoveColumnIfExists("Sessions", "TeamId")
			store.GetMaster().Exec(`TRUNCATE Sessions`)
		}

		// ADDED for 2.2 REMOVE for 2.6
		store.CreateColumnIfNotExists("Users", "MfaActive", "tinyint(1)", "boolean", "0")
		store.CreateColumnIfNotExists("Users", "MfaSecret", "varchar(128)", "character varying(128)", "")

		// ADDED for 2.2 REMOVE for 2.6
		if store.DoesColumnExist("Users", "TeamId") {
			store.RemoveIndexIfExists("idx_users_team_id", "Users")
			store.CreateUniqueIndexIfNotExists("idx_users_email_unique", "Users", "Email")
			store.CreateUniqueIndexIfNotExists("idx_users_username_unique", "Users", "Username")
			store.RemoveColumnIfExists("Teams", "AllowTeamListing")
			store.RemoveColumnIfExists("Users", "TeamId")
		}

		l4g.Info("Finished running speical upgrade of the database schema to version 3.0 for user model changes")

		if result := <-store.System().Update(&model.System{Name: "Version", Value: model.CurrentVersion}); result.Err != nil {
			l4g.Error("Failed to update system schema version details=%v", result.Err)
			flushLogAndExit(1)
		}

		l4g.Info(utils.T("store.sql.upgraded.warn"), model.CurrentVersion)
		fmt.Println("**SUCCESS** with upgrade")

		flushLogAndExit(0)
	}
}

type UserForUpgrade struct {
	Id       string
	Username string
	Email    string
	Roles    string
	TeamId   string
}

func convertTeamTo30(team *TeamForUpgrade, uniqueEmails map[string]bool, uniqueUsernames map[string]bool) []*UserForUpgrade {
	store := api.Srv.Store.(*store.SqlStore)
	var users []*UserForUpgrade
	if _, err := store.GetMaster().Select(&users, "SELECT Users.Id, Users.Username, Users.Email, Users.Roles, Users.TeamId FROM Users WHERE Users.TeamId = :TeamId", map[string]interface{}{"TeamId": team.Id}); err != nil {
		l4g.Error("Failed to load profiles for team details=%v", err)
		flushLogAndExit(1)
	}

	var members []*model.TeamMember
	if result := <-api.Srv.Store.Team().GetMembers(team.Id); result.Err != nil {
		l4g.Error("Failed to load team membership details=%v", result.Err)
		flushLogAndExit(1)
	} else {
		members = result.Data.([]*model.TeamMember)
	}

	for _, user := range users {
		shouldUpdateUser := false
		previousRole := user.Roles
		previousEmail := user.Email
		previousUsername := user.Username

		member := &model.TeamMember{
			TeamId: team.Id,
			UserId: user.Id,
		}

		if model.IsInRole(user.Roles, model.ROLE_TEAM_ADMIN) {
			member.Roles = model.ROLE_TEAM_ADMIN
			user.Roles = ""
			shouldUpdateUser = true
		}

		exists := false
		for _, member := range members {
			if member.UserId == user.Id {
				exists = true
				break
			}
		}

		if !exists {
			if result := <-api.Srv.Store.Team().SaveMember(member); result.Err != nil {
				l4g.Error("Failed to save membership for %v details=%v", user.Email, result.Err)
				flushLogAndExit(1)
			}
		}

		if uniqueEmails[user.Email] {
			shouldUpdateUser = true
			emailParts := strings.Split(user.Email, "@")
			if len(emailParts) == 2 {
				user.Email = emailParts[0] + "+" + team.Name + "@" + emailParts[1]
			} else {
				user.Email = user.Email + "." + team.Name
			}
		}

		if uniqueUsernames[user.Username] {
			shouldUpdateUser = true
			user.Username = user.Username + "." + team.Name
		}

		if shouldUpdateUser {
			if _, err := store.GetMaster().Exec(`
				UPDATE Users 
				SET 
				    Email = :Email,
				    Username = :Username,
				    Roles = :Roles
				WHERE
				    Id = :Id
				`,
				map[string]interface{}{
					"Email":    user.Email,
					"Username": user.Username,
					"Roles":    user.Roles,
					"Id":       user.Id,
				},
			); err != nil {
				l4g.Error("Failed to update user %v details=%v", user.Email, err)
				flushLogAndExit(1)
			}

			l4g.Info("modified user_id=%v, changed email from=%v to=%v, changed username from=%v to %v changed roles from=%v to=%v", user.Id, previousEmail, user.Email, previousUsername, user.Username, previousRole, user.Roles)
		}

		uniqueEmails[user.Email] = true
		uniqueUsernames[user.Username] = true
	}

	return users
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
		}

		ruser, err := api.CreateUser(user)
		if err != nil {
			if err.Id != "store.sql_user.save.email_exists.app_error" {
				l4g.Error("%v", err)
				flushLogAndExit(1)
			}
		}

		err = api.JoinUserToTeam(team, ruser)
		if err != nil {
			l4g.Error("%v", err)
			flushLogAndExit(1)
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

		var confirmBackup string
		fmt.Print("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirmBackup)
		if confirmBackup != "YES" {
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

		var confirmBackup string
		fmt.Print("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirmBackup)
		if confirmBackup != "YES" {
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

		var confirmBackup string
		fmt.Print("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirmBackup)
		if confirmBackup != "YES" {
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
		var confirmBackup string
		fmt.Print("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirmBackup)
		if confirmBackup != "YES" {
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

    -reset_mfa                        Turns off multi-factor authentication for a user.  It requires the
                                      -email or -username flag.
        Example:
            platform -reset_mfa -username="someuser"

    -reset_database                   Completely erases the database causing the loss of all data. This 
									  will reset Mattermost to it's initial state. (note this will not 
									  erase your configuration.)

        Example:
            platform -reset_mfa -username="someuser"

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

    -version                          Display the current of the Mattermost platform 

    -help                             Displays this help page`
