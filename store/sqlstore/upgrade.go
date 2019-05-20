// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/timezones"
)

const (
	VERSION_5_11_0           = "5.11.0"
	VERSION_5_10_0           = "5.10.0"
	VERSION_5_9_0            = "5.9.0"
	VERSION_5_8_0            = "5.8.0"
	VERSION_5_7_0            = "5.7.0"
	VERSION_5_6_0            = "5.6.0"
	VERSION_5_5_0            = "5.5.0"
	VERSION_5_4_0            = "5.4.0"
	VERSION_5_3_0            = "5.3.0"
	VERSION_5_2_0            = "5.2.0"
	VERSION_5_1_0            = "5.1.0"
	VERSION_5_0_0            = "5.0.0"
	VERSION_4_10_0           = "4.10.0"
	VERSION_4_9_0            = "4.9.0"
	VERSION_4_8_1            = "4.8.1"
	VERSION_4_8_0            = "4.8.0"
	VERSION_4_7_2            = "4.7.2"
	VERSION_4_7_1            = "4.7.1"
	VERSION_4_7_0            = "4.7.0"
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
	EXIT_VERSION_SAVE                   = 1003
	EXIT_THEME_MIGRATION                = 1004
	EXIT_TEAM_INVITEID_MIGRATION_FAILED = 1006
)

// UpgradeDatabase attempts to migrate the schema to the latest supported version.
// The value of model.CurrentVersion is accepted as a parameter for unit testing, but it is not
// used to stop migrations at that version.
func UpgradeDatabase(sqlStore SqlStore, currentModelVersionString string) error {
	currentModelVersion, err := semver.Parse(currentModelVersionString)
	if err != nil {
		return errors.Wrapf(err, "failed to parse current model version %s", currentModelVersionString)
	}

	nextUnsupportedMajorVersion := semver.Version{
		Major: currentModelVersion.Major + 1,
	}

	oldestSupportedVersion, err := semver.Parse(OLDEST_SUPPORTED_VERSION)
	if err != nil {
		return errors.Wrapf(err, "failed to parse oldest supported version %s", OLDEST_SUPPORTED_VERSION)
	}

	var currentSchemaVersion *semver.Version
	currentSchemaVersionString := sqlStore.GetCurrentSchemaVersion()
	if currentSchemaVersionString != "" {
		currentSchemaVersion, err = semver.New(currentSchemaVersionString)
		if err != nil {
			return errors.Wrapf(err, "failed to parse database schema version %s", currentSchemaVersionString)
		}
	}

	// Assume a fresh database if no schema version has been recorded.
	if currentSchemaVersion == nil {
		if result := <-sqlStore.System().SaveOrUpdate(&model.System{Name: "Version", Value: currentModelVersion.String()}); result.Err != nil {
			return errors.Wrap(err, "failed to initialize schema version for fresh database")
		}

		currentSchemaVersion = &currentModelVersion
		mlog.Info(fmt.Sprintf("The database schema has been set to version %s", *currentSchemaVersion))
		return nil
	}

	// Upgrades prior to the oldest supported version are not supported.
	if currentSchemaVersion.LT(oldestSupportedVersion) {
		return errors.Errorf("Database schema version %s is no longer supported. This Mattermost server supports automatic upgrades from schema version %s through schema version %s. Please manually upgrade to at least version %s before continuing.", *currentSchemaVersion, oldestSupportedVersion, currentModelVersion, oldestSupportedVersion)
	}

	// Allow forwards compatibility only within the same major version.
	if currentSchemaVersion.GTE(nextUnsupportedMajorVersion) {
		return errors.Errorf("Database schema version %s is not supported. This Mattermost server supports only >=%s, <%s. Please upgrade to at least version %s before continuing.", *currentSchemaVersion, currentModelVersion, nextUnsupportedMajorVersion, nextUnsupportedMajorVersion)
	} else if currentSchemaVersion.GT(currentModelVersion) {
		mlog.Warn(fmt.Sprintf("The database schema with version %s is newer than Mattermost version %s.", currentSchemaVersion, currentModelVersion))
	}

	// Otherwise, apply any necessary migrations. Note that these methods currently invoke
	// os.Exit instead of returning an error.
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
	UpgradeDatabaseToVersion47(sqlStore)
	UpgradeDatabaseToVersion471(sqlStore)
	UpgradeDatabaseToVersion472(sqlStore)
	UpgradeDatabaseToVersion48(sqlStore)
	UpgradeDatabaseToVersion481(sqlStore)
	UpgradeDatabaseToVersion49(sqlStore)
	UpgradeDatabaseToVersion410(sqlStore)
	UpgradeDatabaseToVersion50(sqlStore)
	UpgradeDatabaseToVersion51(sqlStore)
	UpgradeDatabaseToVersion52(sqlStore)
	UpgradeDatabaseToVersion53(sqlStore)
	UpgradeDatabaseToVersion54(sqlStore)
	UpgradeDatabaseToVersion55(sqlStore)
	UpgradeDatabaseToVersion56(sqlStore)
	UpgradeDatabaseToVersion57(sqlStore)
	UpgradeDatabaseToVersion58(sqlStore)
	UpgradeDatabaseToVersion59(sqlStore)
	UpgradeDatabaseToVersion510(sqlStore)
	UpgradeDatabaseToVersion511(sqlStore)
	UpgradeDatabaseToVersion512(sqlStore)

	return nil
}

func saveSchemaVersion(sqlStore SqlStore, version string) {
	if result := <-sqlStore.System().SaveOrUpdate(&model.System{Name: "Version", Value: version}); result.Err != nil {
		mlog.Critical(result.Err.Error())
		time.Sleep(time.Second)
		os.Exit(EXIT_VERSION_SAVE)
	}

	mlog.Warn(fmt.Sprintf("The database schema has been upgraded to version %v", version))
}

func shouldPerformUpgrade(sqlStore SqlStore, currentSchemaVersion string, expectedSchemaVersion string) bool {
	if sqlStore.GetCurrentSchemaVersion() == currentSchemaVersion {
		mlog.Warn(fmt.Sprintf("Attempting to upgrade the database schema version from %s to %v", currentSchemaVersion, expectedSchemaVersion))

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
	mlog.Critical(fmt.Sprintf("Failed to migrate User.ThemeProps to Preferences table %v", err))
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
			defer finalizeTransaction(transaction)

			// increase size of Value column of Preferences table to match the size of the ThemeProps column
			if sqlStore.DriverName() == model.DATABASE_DRIVER_POSTGRES {
				if _, err := transaction.Exec("ALTER TABLE Preferences ALTER COLUMN Value TYPE varchar(2000)"); err != nil {
					themeMigrationFailed(err)
					return
				}
			} else if sqlStore.DriverName() == model.DATABASE_DRIVER_MYSQL {
				if _, err := transaction.Exec("ALTER TABLE Preferences MODIFY Value text"); err != nil {
					themeMigrationFailed(err)
					return
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
				return
			}

			// delete old data
			if _, err := transaction.Exec("ALTER TABLE Users DROP COLUMN ThemeProps"); err != nil {
				themeMigrationFailed(err)
				return
			}

			if err := transaction.Commit(); err != nil {
				themeMigrationFailed(err)
				return
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

func UpgradeDatabaseToVersion45(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_4_0, VERSION_4_5_0) {
		saveSchemaVersion(sqlStore, VERSION_4_5_0)
	}
}

func UpgradeDatabaseToVersion46(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_5_0, VERSION_4_6_0) {
		sqlStore.CreateColumnIfNotExists("IncomingWebhooks", "Username", "varchar(64)", "varchar(64)", "")
		sqlStore.CreateColumnIfNotExists("IncomingWebhooks", "IconURL", "varchar(1024)", "varchar(1024)", "")
		saveSchemaVersion(sqlStore, VERSION_4_6_0)
	}
}

func UpgradeDatabaseToVersion47(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_6_0, VERSION_4_7_0) {
		sqlStore.AlterColumnTypeIfExists("Users", "Position", "varchar(128)", "varchar(128)")
		sqlStore.AlterColumnTypeIfExists("OAuthAuthData", "State", "varchar(1024)", "varchar(1024)")
		sqlStore.RemoveColumnIfExists("ChannelMemberHistory", "Email")
		sqlStore.RemoveColumnIfExists("ChannelMemberHistory", "Username")
		saveSchemaVersion(sqlStore, VERSION_4_7_0)
	}
}

// If any new instances started with 4.7, they would have the bad Email column on the
// ChannelMemberHistory table. So for those cases we need to do an upgrade between
// 4.7.0 and 4.7.1
func UpgradeDatabaseToVersion471(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_7_0, VERSION_4_7_1) {
		sqlStore.RemoveColumnIfExists("ChannelMemberHistory", "Email")
		saveSchemaVersion(sqlStore, VERSION_4_7_1)
	}
}

func UpgradeDatabaseToVersion472(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_7_1, VERSION_4_7_2) {
		sqlStore.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlStore, VERSION_4_7_2)
	}
}

func UpgradeDatabaseToVersion48(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_7_2, VERSION_4_8_0) {
		saveSchemaVersion(sqlStore, VERSION_4_8_0)
	}
}

func UpgradeDatabaseToVersion481(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_8_0, VERSION_4_8_1) {
		sqlStore.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlStore, VERSION_4_8_1)
	}
}

func UpgradeDatabaseToVersion49(sqlStore SqlStore) {
	// This version of Mattermost includes an App-Layer migration which migrates from hard-coded roles configured by
	// a number of parameters in `config.json` to a `Roles` table in the database. The migration code can be seen
	// in the file `app/app.go` in the function `DoAdvancedPermissionsMigration()`.

	if shouldPerformUpgrade(sqlStore, VERSION_4_8_1, VERSION_4_9_0) {
		sqlStore.CreateColumnIfNotExists("Teams", "LastTeamIconUpdate", "bigint", "bigint", "0")
		defaultTimezone := timezones.DefaultUserTimezone()
		defaultTimezoneValue, err := json.Marshal(defaultTimezone)
		if err != nil {
			mlog.Critical(fmt.Sprint(err))
		}
		sqlStore.CreateColumnIfNotExists("Users", "Timezone", "varchar(256)", "varchar(256)", string(defaultTimezoneValue))
		sqlStore.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlStore, VERSION_4_9_0)
	}
}

func UpgradeDatabaseToVersion410(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_9_0, VERSION_4_10_0) {

		sqlStore.RemoveIndexIfExists("Name_2", "Channels")
		sqlStore.RemoveIndexIfExists("Name_2", "Emoji")
		sqlStore.RemoveIndexIfExists("ClientId_2", "OAuthAccessData")

		saveSchemaVersion(sqlStore, VERSION_4_10_0)
		sqlStore.GetMaster().Exec("UPDATE Users SET AuthData=LOWER(AuthData) WHERE AuthService = 'saml'")
	}
}

func UpgradeDatabaseToVersion50(sqlStore SqlStore) {
	// This version of Mattermost includes an App-Layer migration which migrates from hard-coded emojis configured
	// in `config.json` to a `Permission` in the database. The migration code can be seen
	// in the file `app/app.go` in the function `DoEmojisPermissionsMigration()`.

	// This version of Mattermost also includes a online-migration which migrates some roles from the `Roles` columns of
	// TeamMember and ChannelMember rows to the new SchemeAdmin and SchemeUser columns. If you need to downgrade to a
	// version of Mattermost prior to 5.0, you should take your server offline and run the following SQL statements
	// prior to launching the downgraded version:
	//
	//    UPDATE Teams SET SchemeId = NULL;
	//    UPDATE Channels SET SchemeId = NULL;
	//    UPDATE TeamMembers SET Roles = CONCAT(Roles, ' team_user'), SchemeUser = NULL where SchemeUser = 1;
	//    UPDATE TeamMembers SET Roles = CONCAT(Roles, ' team_admin'), SchemeAdmin = NULL where SchemeAdmin = 1;
	//    UPDATE ChannelMembers SET Roles = CONCAT(Roles, ' channel_user'), SchemeUser = NULL where SchemeUser = 1;
	//    UPDATE ChannelMembers SET Roles = CONCAT(Roles, ' channel_admin'), SchemeAdmin = NULL where SchemeAdmin = 1;
	//    DELETE from Systems WHERE Name = 'migration_advanced_permissions_phase_2';

	if shouldPerformUpgrade(sqlStore, VERSION_4_10_0, VERSION_5_0_0) {

		sqlStore.CreateColumnIfNotExistsNoDefault("Teams", "SchemeId", "varchar(26)", "varchar(26)")
		sqlStore.CreateColumnIfNotExistsNoDefault("Channels", "SchemeId", "varchar(26)", "varchar(26)")

		sqlStore.CreateColumnIfNotExistsNoDefault("TeamMembers", "SchemeUser", "boolean", "boolean")
		sqlStore.CreateColumnIfNotExistsNoDefault("TeamMembers", "SchemeAdmin", "boolean", "boolean")
		sqlStore.CreateColumnIfNotExistsNoDefault("ChannelMembers", "SchemeUser", "boolean", "boolean")
		sqlStore.CreateColumnIfNotExistsNoDefault("ChannelMembers", "SchemeAdmin", "boolean", "boolean")

		sqlStore.CreateColumnIfNotExists("Roles", "BuiltIn", "boolean", "boolean", "0")
		sqlStore.GetMaster().Exec("UPDATE Roles SET BuiltIn=true")
		sqlStore.GetMaster().Exec("UPDATE Roles SET SchemeManaged=false WHERE Name NOT IN ('system_user', 'system_admin', 'team_user', 'team_admin', 'channel_user', 'channel_admin')")
		sqlStore.CreateColumnIfNotExists("IncomingWebhooks", "ChannelLocked", "boolean", "boolean", "0")

		sqlStore.RemoveIndexIfExists("idx_channels_txt", "Channels")

		saveSchemaVersion(sqlStore, VERSION_5_0_0)
	}
}

func UpgradeDatabaseToVersion51(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_0_0, VERSION_5_1_0) {
		saveSchemaVersion(sqlStore, VERSION_5_1_0)
	}
}

func UpgradeDatabaseToVersion52(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_1_0, VERSION_5_2_0) {
		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "Username", "varchar(64)", "varchar(64)", "")
		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "IconURL", "varchar(1024)", "varchar(1024)", "")
		saveSchemaVersion(sqlStore, VERSION_5_2_0)
	}
}

func UpgradeDatabaseToVersion53(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_2_0, VERSION_5_3_0) {
		saveSchemaVersion(sqlStore, VERSION_5_3_0)
	}
}

func UpgradeDatabaseToVersion54(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_3_0, VERSION_5_4_0) {
		sqlStore.AlterColumnTypeIfExists("OutgoingWebhooks", "Description", "varchar(500)", "varchar(500)")
		sqlStore.AlterColumnTypeIfExists("IncomingWebhooks", "Description", "varchar(500)", "varchar(500)")
		if err := sqlStore.Channel().MigratePublicChannels(); err != nil {
			mlog.Critical("Failed to migrate PublicChannels table", mlog.Err(err))
			time.Sleep(time.Second)
			os.Exit(EXIT_GENERIC_FAILURE)
		}
		saveSchemaVersion(sqlStore, VERSION_5_4_0)
	}
}

func UpgradeDatabaseToVersion55(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_4_0, VERSION_5_5_0) {
		saveSchemaVersion(sqlStore, VERSION_5_5_0)
	}
}

func UpgradeDatabaseToVersion56(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_5_0, VERSION_5_6_0) {
		sqlStore.CreateColumnIfNotExists("PluginKeyValueStore", "ExpireAt", "bigint(20)", "bigint", "0")

		// migrating user's accepted terms of service data into the new table
		sqlStore.GetMaster().Exec("INSERT INTO UserTermsOfService SELECT Id, AcceptedTermsOfServiceId as TermsOfServiceId, :CreateAt FROM Users WHERE AcceptedTermsOfServiceId != \"\" AND AcceptedTermsOfServiceId IS NOT NULL", map[string]interface{}{"CreateAt": model.GetMillis()})

		if sqlStore.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			sqlStore.RemoveIndexIfExists("idx_users_email_lower", "lower(Email)")
			sqlStore.RemoveIndexIfExists("idx_users_username_lower", "lower(Username)")
			sqlStore.RemoveIndexIfExists("idx_users_nickname_lower", "lower(Nickname)")
			sqlStore.RemoveIndexIfExists("idx_users_firstname_lower", "lower(FirstName)")
			sqlStore.RemoveIndexIfExists("idx_users_lastname_lower", "lower(LastName)")
		}

		saveSchemaVersion(sqlStore, VERSION_5_6_0)
	}

}

func UpgradeDatabaseToVersion57(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_6_0, VERSION_5_7_0) {
		saveSchemaVersion(sqlStore, VERSION_5_7_0)
	}
}

func getRole(sqlStore SqlStore, name string) (*model.Role, error) {
	var dbRole Role

	if err := sqlStore.GetReplica().SelectOne(&dbRole, "SELECT * from Roles WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.Wrapf(err, "failed to find role %s", name)
		} else {
			return nil, errors.Wrapf(err, "failed to query role %s", name)
		}
	}

	return dbRole.ToModel(), nil
}

func saveRole(sqlStore SqlStore, role *model.Role) error {
	dbRole := NewRoleFromModel(role)

	dbRole.UpdateAt = model.GetMillis()
	if rowsChanged, err := sqlStore.GetMaster().Update(dbRole); err != nil {
		return errors.Wrap(err, "failed to update role")
	} else if rowsChanged != 1 {
		return errors.New("found no role to update")
	}

	return nil
}

func UpgradeDatabaseToVersion58(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_7_0, VERSION_5_8_0) {
		// idx_channels_txt was removed in `UpgradeDatabaseToVersion50`, but merged as part of
		// v5.1, so the migration wouldn't apply to anyone upgrading from v5.0. Remove it again to
		// bring the upgraded (from v5.0) and fresh install schemas back in sync.
		sqlStore.RemoveIndexIfExists("idx_channels_txt", "Channels")

		// Fix column types and defaults where gorp converged on a different schema value than the
		// original migration.
		sqlStore.AlterColumnTypeIfExists("OutgoingWebhooks", "Description", "text", "VARCHAR(500)")
		sqlStore.AlterColumnTypeIfExists("IncomingWebhooks", "Description", "text", "VARCHAR(500)")
		sqlStore.AlterColumnTypeIfExists("OutgoingWebhooks", "IconURL", "text", "VARCHAR(1024)")
		sqlStore.AlterColumnDefaultIfExists("OutgoingWebhooks", "Username", model.NewString("NULL"), model.NewString(""))
		sqlStore.AlterColumnDefaultIfExists("OutgoingWebhooks", "IconURL", nil, model.NewString(""))
		sqlStore.AlterColumnDefaultIfExists("PluginKeyValueStore", "ExpireAt", model.NewString("NULL"), model.NewString("NULL"))

		saveSchemaVersion(sqlStore, VERSION_5_8_0)
	}
}

func UpgradeDatabaseToVersion59(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_8_0, VERSION_5_9_0) {
		saveSchemaVersion(sqlStore, VERSION_5_9_0)
	}
}

func UpgradeDatabaseToVersion510(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_9_0, VERSION_5_10_0) {
		sqlStore.CreateColumnIfNotExistsNoDefault("Channels", "GroupConstrained", "tinyint(4)", "boolean")
		sqlStore.CreateColumnIfNotExistsNoDefault("Teams", "GroupConstrained", "tinyint(4)", "boolean")

		sqlStore.CreateIndexIfNotExists("idx_groupteams_teamid", "GroupTeams", "TeamId")
		sqlStore.CreateIndexIfNotExists("idx_groupchannels_channelid", "GroupChannels", "ChannelId")

		saveSchemaVersion(sqlStore, VERSION_5_10_0)
	}
}

func UpgradeDatabaseToVersion511(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_10_0, VERSION_5_11_0) {
		// Enforce all teams have an InviteID set
		var teams []*model.Team
		if _, err := sqlStore.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE InviteId = ''"); err != nil {
			mlog.Error("Error fetching Teams without InviteID: " + err.Error())
		} else {
			for _, team := range teams {
				team.InviteId = model.NewId()
				if _, err := sqlStore.Team().Update(team); err != nil {
					mlog.Error("Error updating Team InviteIDs: " + err.Error())
				}
			}
		}

		saveSchemaVersion(sqlStore, VERSION_5_11_0)
	}
}

func UpgradeDatabaseToVersion512(sqlStore SqlStore) {
	// TODO: Uncomment following condition when version 5.12.0 is released
	// if shouldPerformUpgrade(sqlStore, VERSION_5_11_0, VERSION_5_12_0) {
	sqlStore.CreateColumnIfNotExistsNoDefault("TeamMembers", "SchemeGuest", "boolean", "boolean")
	sqlStore.CreateColumnIfNotExistsNoDefault("ChannelMembers", "SchemeGuest", "boolean", "boolean")
	sqlStore.CreateColumnIfNotExistsNoDefault("Schemes", "DefaultTeamGuestRole", "text", "VARCHAR(64)")
	sqlStore.CreateColumnIfNotExistsNoDefault("Schemes", "DefaultChannelGuestRole", "text", "VARCHAR(64)")
	sqlStore.GetMaster().Exec("UPDATE Schemes SET DefaultTeamGuestRole = '', DefaultChannelGuestRole = ''")

	// saveSchemaVersion(sqlStore, VERSION_5_12_0)
	// }
}
