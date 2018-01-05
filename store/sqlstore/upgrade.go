// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"os"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	VERSION_4_6_0            = "4.6.0"
	VERSION_4_5_0            = "4.5.0"
	VERSION_4_4_0            = "4.4.0"
	VERSION_4_3_0            = "4.3.0"
	VERSION_4_2_0            = "4.2.0"
	VERSION_4_1_0            = "4.1.0"
	VERSION_4_0_0            = "4.0.0"
	VERSION_3_10_0           = "3.10.0"
	VERSION_3_9_0            = "3.9.0"
	VERSION_3_8_0            = "3.8.0"
	VERSION_3_7_0            = "3.7.0"
	VERSION_3_6_0            = "3.6.0"
	VERSION_3_5_0            = "3.5.0"
	VERSION_3_4_0            = "3.4.0"
	VERSION_3_3_0            = "3.3.0"
	VERSION_3_2_0            = "3.2.0"
	VERSION_3_1_0            = "3.1.0"
	VERSION_3_0_0            = "3.0.0"
	OLDEST_SUPPORTED_VERSION = VERSION_3_0_0
)

const (
	EXIT_VERSION_SAVE_MISSING = 1001
	EXIT_TOO_OLD              = 1002
	EXIT_VERSION_SAVE         = 1003
	EXIT_THEME_MIGRATION      = 1004
)

func UpgradeDatabase(sqlStore SqlStore) {

	UpgradeDatabaseToVersion31(sqlStore)
	UpgradeDatabaseToVersion32(sqlStore)
	UpgradeDatabaseToVersion33(sqlStore)
	UpgradeDatabaseToVersion34(sqlStore)
	UpgradeDatabaseToVersion35(sqlStore)
	UpgradeDatabaseToVersion36(sqlStore)
	UpgradeDatabaseToVersion37(sqlStore)
	UpgradeDatabaseToVersion38(sqlStore)
	UpgradeDatabaseToVersion39(sqlStore)
	UpgradeDatabaseToVersion310(sqlStore)
	UpgradeDatabaseToVersion40(sqlStore)
	UpgradeDatabaseToVersion41(sqlStore)
	UpgradeDatabaseToVersion42(sqlStore)
	UpgradeDatabaseToVersion43(sqlStore)
	UpgradeDatabaseToVersion44(sqlStore)
	UpgradeDatabaseToVersion45(sqlStore)
	UpgradeDatabaseToVersion46(sqlStore)

	// If the SchemaVersion is empty this this is the first time it has ran
	// so lets set it to the current version.
	if sqlStore.GetCurrentSchemaVersion() == "" {
		if result := <-sqlStore.System().SaveOrUpdate(&model.System{Name: "Version", Value: model.CurrentVersion}); result.Err != nil {
			l4g.Critical(result.Err.Error())
			time.Sleep(time.Second)
			os.Exit(EXIT_VERSION_SAVE_MISSING)
		}

		l4g.Info(utils.T("store.sql.schema_set.info"), model.CurrentVersion)
	}

	// If we're not on the current version then it's too old to be upgraded
	if sqlStore.GetCurrentSchemaVersion() != model.CurrentVersion {
		l4g.Critical(utils.T("store.sql.schema_version.critical"), sqlStore.GetCurrentSchemaVersion(), OLDEST_SUPPORTED_VERSION, model.CurrentVersion, OLDEST_SUPPORTED_VERSION)
		time.Sleep(time.Second)
		os.Exit(EXIT_TOO_OLD)
	}
}

func saveSchemaVersion(sqlStore SqlStore, version string) {
	if result := <-sqlStore.System().Update(&model.System{Name: "Version", Value: version}); result.Err != nil {
		l4g.Critical(result.Err.Error())
		time.Sleep(time.Second)
		os.Exit(EXIT_VERSION_SAVE)
	}

	l4g.Warn(utils.T("store.sql.upgraded.warn"), version)
}

func shouldPerformUpgrade(sqlStore SqlStore, currentSchemaVersion string, expectedSchemaVersion string) bool {
	if sqlStore.GetCurrentSchemaVersion() == currentSchemaVersion {
		l4g.Warn(utils.T("store.sql.schema_out_of_date.warn"), currentSchemaVersion)
		l4g.Warn(utils.T("store.sql.schema_upgrade_attempt.warn"), expectedSchemaVersion)

		return true
	}

	return false
}

func UpgradeDatabaseToVersion31(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_0_0, VERSION_3_1_0) {
		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "ContentType", "varchar(128)", "varchar(128)", "")
		saveSchemaVersion(sqlStore, VERSION_3_1_0)
	}
}

func UpgradeDatabaseToVersion32(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_1_0, VERSION_3_2_0) {
		sqlStore.CreateColumnIfNotExists("TeamMembers", "DeleteAt", "bigint(20)", "bigint", "0")

		saveSchemaVersion(sqlStore, VERSION_3_2_0)
	}
}

func themeMigrationFailed(err error) {
	l4g.Critical(utils.T("store.sql_user.migrate_theme.critical"), err)
	time.Sleep(time.Second)
	os.Exit(EXIT_THEME_MIGRATION)
}

func UpgradeDatabaseToVersion33(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_2_0, VERSION_3_3_0) {
		if sqlStore.DoesColumnExist("Users", "ThemeProps") {
			params := map[string]interface{}{
				"Category": model.PREFERENCE_CATEGORY_THEME,
				"Name":     "",
			}

			transaction, err := sqlStore.GetMaster().Begin()
			if err != nil {
				themeMigrationFailed(err)
			}

			// increase size of Value column of Preferences table to match the size of the ThemeProps column
			if sqlStore.DriverName() == model.DATABASE_DRIVER_POSTGRES {
				if _, err := transaction.Exec("ALTER TABLE Preferences ALTER COLUMN Value TYPE varchar(2000)"); err != nil {
					themeMigrationFailed(err)
				}
			} else if sqlStore.DriverName() == model.DATABASE_DRIVER_MYSQL {
				if _, err := transaction.Exec("ALTER TABLE Preferences MODIFY Value text"); err != nil {
					themeMigrationFailed(err)
				}
			}

			// copy data across
			if _, err := transaction.Exec(
				`INSERT INTO
					Preferences(UserId, Category, Name, Value)
				SELECT
					Id, '`+model.PREFERENCE_CATEGORY_THEME+`', '', ThemeProps
				FROM
					Users
				WHERE
					Users.ThemeProps != 'null'`, params); err != nil {
				themeMigrationFailed(err)
			}

			// delete old data
			if _, err := transaction.Exec("ALTER TABLE Users DROP COLUMN ThemeProps"); err != nil {
				themeMigrationFailed(err)
			}

			if err := transaction.Commit(); err != nil {
				themeMigrationFailed(err)
			}

			// rename solarized_* code themes to solarized-* to match client changes in 3.0
			var data model.Preferences
			if _, err := sqlStore.GetMaster().Select(&data, "SELECT * FROM Preferences WHERE Category = '"+model.PREFERENCE_CATEGORY_THEME+"' AND Value LIKE '%solarized_%'"); err == nil {
				for i := range data {
					data[i].Value = strings.Replace(data[i].Value, "solarized_", "solarized-", -1)
				}

				sqlStore.Preference().Save(&data)
			}
		}

		sqlStore.CreateColumnIfNotExists("OAuthApps", "IsTrusted", "tinyint(1)", "boolean", "0")
		sqlStore.CreateColumnIfNotExists("OAuthApps", "IconURL", "varchar(512)", "varchar(512)", "")
		sqlStore.CreateColumnIfNotExists("OAuthAccessData", "ClientId", "varchar(26)", "varchar(26)", "")
		sqlStore.CreateColumnIfNotExists("OAuthAccessData", "UserId", "varchar(26)", "varchar(26)", "")
		sqlStore.CreateColumnIfNotExists("OAuthAccessData", "ExpiresAt", "bigint", "bigint", "0")

		if sqlStore.DoesColumnExist("OAuthAccessData", "AuthCode") {
			sqlStore.RemoveIndexIfExists("idx_oauthaccessdata_auth_code", "OAuthAccessData")
			sqlStore.RemoveColumnIfExists("OAuthAccessData", "AuthCode")
		}

		sqlStore.RemoveColumnIfExists("Users", "LastActivityAt")
		sqlStore.RemoveColumnIfExists("Users", "LastPingAt")

		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "TriggerWhen", "tinyint", "integer", "0")

		saveSchemaVersion(sqlStore, VERSION_3_3_0)
	}
}

func UpgradeDatabaseToVersion34(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_3_0, VERSION_3_4_0) {
		sqlStore.CreateColumnIfNotExists("Status", "Manual", "BOOLEAN", "BOOLEAN", "0")
		sqlStore.CreateColumnIfNotExists("Status", "ActiveChannel", "varchar(26)", "varchar(26)", "")

		saveSchemaVersion(sqlStore, VERSION_3_4_0)
	}
}

func UpgradeDatabaseToVersion35(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_4_0, VERSION_3_5_0) {
		sqlStore.GetMaster().Exec("UPDATE Users SET Roles = 'system_user' WHERE Roles = ''")
		sqlStore.GetMaster().Exec("UPDATE Users SET Roles = 'system_user system_admin' WHERE Roles = 'system_admin'")
		sqlStore.GetMaster().Exec("UPDATE TeamMembers SET Roles = 'team_user' WHERE Roles = ''")
		sqlStore.GetMaster().Exec("UPDATE TeamMembers SET Roles = 'team_user team_admin' WHERE Roles = 'admin'")
		sqlStore.GetMaster().Exec("UPDATE ChannelMembers SET Roles = 'channel_user' WHERE Roles = ''")
		sqlStore.GetMaster().Exec("UPDATE ChannelMembers SET Roles = 'channel_user channel_admin' WHERE Roles = 'admin'")

		// The rest of the migration from Filenames -> FileIds is done lazily in api.GetFileInfosForPost
		sqlStore.CreateColumnIfNotExists("Posts", "FileIds", "varchar(150)", "varchar(150)", "[]")

		// Increase maximum length of the Channel table Purpose column.
		if sqlStore.GetMaxLengthOfColumnIfExists("Channels", "Purpose") != "250" {
			sqlStore.AlterColumnTypeIfExists("Channels", "Purpose", "varchar(250)", "varchar(250)")
		}

		sqlStore.Session().RemoveAllSessions()

		saveSchemaVersion(sqlStore, VERSION_3_5_0)
	}
}

func UpgradeDatabaseToVersion36(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_5_0, VERSION_3_6_0) {
		sqlStore.CreateColumnIfNotExists("Posts", "HasReactions", "tinyint", "boolean", "0")

		// Create Team Description column
		sqlStore.CreateColumnIfNotExists("Teams", "Description", "varchar(255)", "varchar(255)", "")

		// Add a Position column to users.
		sqlStore.CreateColumnIfNotExists("Users", "Position", "varchar(64)", "varchar(64)", "")

		// Remove ActiveChannel column from Status
		sqlStore.RemoveColumnIfExists("Status", "ActiveChannel")

		saveSchemaVersion(sqlStore, VERSION_3_6_0)
	}
}

func UpgradeDatabaseToVersion37(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_6_0, VERSION_3_7_0) {
		// Add EditAt column to Posts
		sqlStore.CreateColumnIfNotExists("Posts", "EditAt", " bigint", " bigint", "0")

		saveSchemaVersion(sqlStore, VERSION_3_7_0)
	}
}

func UpgradeDatabaseToVersion38(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_7_0, VERSION_3_8_0) {
		// Add the IsPinned column to posts.
		sqlStore.CreateColumnIfNotExists("Posts", "IsPinned", "boolean", "boolean", "0")

		saveSchemaVersion(sqlStore, VERSION_3_8_0)
	}
}

func UpgradeDatabaseToVersion39(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_8_0, VERSION_3_9_0) {
		sqlStore.CreateColumnIfNotExists("OAuthAccessData", "Scope", "varchar(128)", "varchar(128)", model.DEFAULT_SCOPE)
		sqlStore.RemoveTableIfExists("PasswordRecovery")

		saveSchemaVersion(sqlStore, VERSION_3_9_0)
	}
}

func UpgradeDatabaseToVersion310(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_9_0, VERSION_3_10_0) {
		saveSchemaVersion(sqlStore, VERSION_3_10_0)
	}
}

func UpgradeDatabaseToVersion40(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_10_0, VERSION_4_0_0) {
		saveSchemaVersion(sqlStore, VERSION_4_0_0)
	}
}

func UpgradeDatabaseToVersion41(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_0_0, VERSION_4_1_0) {
		// Increase maximum length of the Users table Roles column.
		if sqlStore.GetMaxLengthOfColumnIfExists("Users", "Roles") != "256" {
			sqlStore.AlterColumnTypeIfExists("Users", "Roles", "varchar(256)", "varchar(256)")
		}

		sqlStore.RemoveTableIfExists("JobStatuses")

		saveSchemaVersion(sqlStore, VERSION_4_1_0)
	}
}

func UpgradeDatabaseToVersion42(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_1_0, VERSION_4_2_0) {
		saveSchemaVersion(sqlStore, VERSION_4_2_0)
	}
}

func UpgradeDatabaseToVersion43(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_2_0, VERSION_4_3_0) {
		saveSchemaVersion(sqlStore, VERSION_4_3_0)
	}
}

func UpgradeDatabaseToVersion44(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_3_0, VERSION_4_4_0) {
		// Add the IsActive column to UserAccessToken.
		sqlStore.CreateColumnIfNotExists("UserAccessTokens", "IsActive", "boolean", "boolean", "1")

		saveSchemaVersion(sqlStore, VERSION_4_4_0)
	}
}

func UpgradeDatabaseToVersion46(sqlStore SqlStore) {

	if shouldPerformUpgrade(sqlStore, VERSION_4_5_0, VERSION_4_6_0) {
		sqlStore.CreateColumnIfNotExists("IncomingWebhooks", "Username", "varchar(64)", "varchar(64)", "")
		sqlStore.CreateColumnIfNotExists("IncomingWebhooks", "IconURL", "varchar(1024)", "varchar(1024)", "")
		saveSchemaVersion(sqlStore, VERSION_4_6_0)
	}
}

func UpgradeDatabaseToVersion45(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_4_0, VERSION_4_5_0) {
		saveSchemaVersion(sqlStore, VERSION_4_5_0)
	}
}
