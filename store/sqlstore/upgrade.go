// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/timezones"
)

const (
	CURRENT_SCHEMA_VERSION   = VERSION_5_28_1
	VERSION_5_29_0           = "5.29.0"
	VERSION_5_28_1           = "5.28.1"
	VERSION_5_28_0           = "5.28.0"
	VERSION_5_27_0           = "5.27.0"
	VERSION_5_26_0           = "5.26.0"
	VERSION_5_25_0           = "5.25.0"
	VERSION_5_24_0           = "5.24.0"
	VERSION_5_23_0           = "5.23.0"
	VERSION_5_22_0           = "5.22.0"
	VERSION_5_21_0           = "5.21.0"
	VERSION_5_20_0           = "5.20.0"
	VERSION_5_19_0           = "5.19.0"
	VERSION_5_18_0           = "5.18.0"
	VERSION_5_17_0           = "5.17.0"
	VERSION_5_16_0           = "5.16.0"
	VERSION_5_15_0           = "5.15.0"
	VERSION_5_14_0           = "5.14.0"
	VERSION_5_13_0           = "5.13.0"
	VERSION_5_12_0           = "5.12.0"
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

// upgradeDatabase attempts to migrate the schema to the latest supported version.
// The value of model.CurrentVersion is accepted as a parameter for unit testing, but it is not
// used to stop migrations at that version.
func upgradeDatabase(sqlStore SqlStore, currentModelVersionString string) error {
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
		if err := sqlStore.System().SaveOrUpdate(&model.System{Name: "Version", Value: currentModelVersion.String()}); err != nil {
			return errors.Wrap(err, "failed to initialize schema version for fresh database")
		}

		currentSchemaVersion = &currentModelVersion
		mlog.Info("The database schema version has been set", mlog.String("version", currentSchemaVersion.String()))
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
		mlog.Warn("The database schema version and model versions do not match", mlog.String("schema_version", currentSchemaVersion.String()), mlog.String("model_version", currentModelVersion.String()))
	}

	// Otherwise, apply any necessary migrations. Note that these methods currently invoke
	// os.Exit instead of returning an error.
	upgradeDatabaseToVersion31(sqlStore)
	upgradeDatabaseToVersion32(sqlStore)
	upgradeDatabaseToVersion33(sqlStore)
	upgradeDatabaseToVersion34(sqlStore)
	upgradeDatabaseToVersion35(sqlStore)
	upgradeDatabaseToVersion36(sqlStore)
	upgradeDatabaseToVersion37(sqlStore)
	upgradeDatabaseToVersion38(sqlStore)
	upgradeDatabaseToVersion39(sqlStore)
	upgradeDatabaseToVersion310(sqlStore)
	upgradeDatabaseToVersion40(sqlStore)
	upgradeDatabaseToVersion41(sqlStore)
	upgradeDatabaseToVersion42(sqlStore)
	upgradeDatabaseToVersion43(sqlStore)
	upgradeDatabaseToVersion44(sqlStore)
	upgradeDatabaseToVersion45(sqlStore)
	upgradeDatabaseToVersion46(sqlStore)
	upgradeDatabaseToVersion47(sqlStore)
	upgradeDatabaseToVersion471(sqlStore)
	upgradeDatabaseToVersion472(sqlStore)
	upgradeDatabaseToVersion48(sqlStore)
	upgradeDatabaseToVersion481(sqlStore)
	upgradeDatabaseToVersion49(sqlStore)
	upgradeDatabaseToVersion410(sqlStore)
	upgradeDatabaseToVersion50(sqlStore)
	upgradeDatabaseToVersion51(sqlStore)
	upgradeDatabaseToVersion52(sqlStore)
	upgradeDatabaseToVersion53(sqlStore)
	upgradeDatabaseToVersion54(sqlStore)
	upgradeDatabaseToVersion55(sqlStore)
	upgradeDatabaseToVersion56(sqlStore)
	upgradeDatabaseToVersion57(sqlStore)
	upgradeDatabaseToVersion58(sqlStore)
	upgradeDatabaseToVersion59(sqlStore)
	upgradeDatabaseToVersion510(sqlStore)
	upgradeDatabaseToVersion511(sqlStore)
	upgradeDatabaseToVersion512(sqlStore)
	upgradeDatabaseToVersion513(sqlStore)
	upgradeDatabaseToVersion514(sqlStore)
	upgradeDatabaseToVersion515(sqlStore)
	upgradeDatabaseToVersion516(sqlStore)
	upgradeDatabaseToVersion517(sqlStore)
	upgradeDatabaseToVersion518(sqlStore)
	upgradeDatabaseToVersion519(sqlStore)
	upgradeDatabaseToVersion520(sqlStore)
	upgradeDatabaseToVersion521(sqlStore)
	upgradeDatabaseToVersion522(sqlStore)
	upgradeDatabaseToVersion523(sqlStore)
	upgradeDatabaseToVersion524(sqlStore)
	upgradeDatabaseToVersion525(sqlStore)
	upgradeDatabaseToVersion526(sqlStore)
	upgradeDatabaseToVersion527(sqlStore)
	upgradeDatabaseToVersion528(sqlStore)
	upgradeDatabaseToVersion5281(sqlStore)
	upgradeDatabaseToVersion529(sqlStore)

	return nil
}

func saveSchemaVersion(sqlStore SqlStore, version string) {
	if err := sqlStore.System().SaveOrUpdate(&model.System{Name: "Version", Value: version}); err != nil {
		mlog.Critical(err.Error())
		time.Sleep(time.Second)
		os.Exit(EXIT_VERSION_SAVE)
	}

	mlog.Warn("The database schema version has been upgraded", mlog.String("version", version))
}

func shouldPerformUpgrade(sqlStore SqlStore, currentSchemaVersion string, expectedSchemaVersion string) bool {
	if sqlStore.GetCurrentSchemaVersion() == currentSchemaVersion {
		mlog.Warn("Attempting to upgrade the database schema version", mlog.String("current_version", currentSchemaVersion), mlog.String("new_version", expectedSchemaVersion))

		return true
	}

	return false
}

func upgradeDatabaseToVersion31(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_0_0, VERSION_3_1_0) {
		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "ContentType", "varchar(128)", "varchar(128)", "")
		saveSchemaVersion(sqlStore, VERSION_3_1_0)
	}
}

func upgradeDatabaseToVersion32(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_1_0, VERSION_3_2_0) {
		sqlStore.CreateColumnIfNotExists("TeamMembers", "DeleteAt", "bigint(20)", "bigint", "0")

		saveSchemaVersion(sqlStore, VERSION_3_2_0)
	}
}

func themeMigrationFailed(err error) {
	mlog.Critical("Failed to migrate User.ThemeProps to Preferences table", mlog.Err(err))
	time.Sleep(time.Second)
	os.Exit(EXIT_THEME_MIGRATION)
}

func upgradeDatabaseToVersion33(sqlStore SqlStore) {
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

func upgradeDatabaseToVersion34(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_3_0, VERSION_3_4_0) {
		sqlStore.CreateColumnIfNotExists("Status", "Manual", "BOOLEAN", "BOOLEAN", "0")
		sqlStore.CreateColumnIfNotExists("Status", "ActiveChannel", "varchar(26)", "varchar(26)", "")

		saveSchemaVersion(sqlStore, VERSION_3_4_0)
	}
}

func upgradeDatabaseToVersion35(sqlStore SqlStore) {
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

func upgradeDatabaseToVersion36(sqlStore SqlStore) {
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

func upgradeDatabaseToVersion37(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_6_0, VERSION_3_7_0) {
		// Add EditAt column to Posts
		sqlStore.CreateColumnIfNotExists("Posts", "EditAt", " bigint", " bigint", "0")

		saveSchemaVersion(sqlStore, VERSION_3_7_0)
	}
}

func upgradeDatabaseToVersion38(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_7_0, VERSION_3_8_0) {
		// Add the IsPinned column to posts.
		sqlStore.CreateColumnIfNotExists("Posts", "IsPinned", "boolean", "boolean", "0")

		saveSchemaVersion(sqlStore, VERSION_3_8_0)
	}
}

func upgradeDatabaseToVersion39(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_8_0, VERSION_3_9_0) {
		sqlStore.CreateColumnIfNotExists("OAuthAccessData", "Scope", "varchar(128)", "varchar(128)", model.DEFAULT_SCOPE)
		sqlStore.RemoveTableIfExists("PasswordRecovery")

		saveSchemaVersion(sqlStore, VERSION_3_9_0)
	}
}

func upgradeDatabaseToVersion310(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_9_0, VERSION_3_10_0) {
		saveSchemaVersion(sqlStore, VERSION_3_10_0)
	}
}

func upgradeDatabaseToVersion40(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_10_0, VERSION_4_0_0) {
		saveSchemaVersion(sqlStore, VERSION_4_0_0)
	}
}

func upgradeDatabaseToVersion41(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_0_0, VERSION_4_1_0) {
		// Increase maximum length of the Users table Roles column.
		if sqlStore.GetMaxLengthOfColumnIfExists("Users", "Roles") != "256" {
			sqlStore.AlterColumnTypeIfExists("Users", "Roles", "varchar(256)", "varchar(256)")
		}

		sqlStore.RemoveTableIfExists("JobStatuses")

		saveSchemaVersion(sqlStore, VERSION_4_1_0)
	}
}

func upgradeDatabaseToVersion42(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_1_0, VERSION_4_2_0) {
		saveSchemaVersion(sqlStore, VERSION_4_2_0)
	}
}

func upgradeDatabaseToVersion43(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_2_0, VERSION_4_3_0) {
		saveSchemaVersion(sqlStore, VERSION_4_3_0)
	}
}

func upgradeDatabaseToVersion44(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_3_0, VERSION_4_4_0) {
		// Add the IsActive column to UserAccessToken.
		sqlStore.CreateColumnIfNotExists("UserAccessTokens", "IsActive", "boolean", "boolean", "1")

		saveSchemaVersion(sqlStore, VERSION_4_4_0)
	}
}

func upgradeDatabaseToVersion45(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_4_0, VERSION_4_5_0) {
		saveSchemaVersion(sqlStore, VERSION_4_5_0)
	}
}

func upgradeDatabaseToVersion46(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_5_0, VERSION_4_6_0) {
		sqlStore.CreateColumnIfNotExists("IncomingWebhooks", "Username", "varchar(64)", "varchar(64)", "")
		sqlStore.CreateColumnIfNotExists("IncomingWebhooks", "IconURL", "varchar(1024)", "varchar(1024)", "")
		saveSchemaVersion(sqlStore, VERSION_4_6_0)
	}
}

func upgradeDatabaseToVersion47(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_6_0, VERSION_4_7_0) {
		sqlStore.AlterColumnTypeIfExists("Users", "Position", "varchar(128)", "varchar(128)")
		sqlStore.AlterColumnTypeIfExists("OAuthAuthData", "State", "varchar(1024)", "varchar(1024)")
		sqlStore.RemoveColumnIfExists("ChannelMemberHistory", "Email")
		sqlStore.RemoveColumnIfExists("ChannelMemberHistory", "Username")
		saveSchemaVersion(sqlStore, VERSION_4_7_0)
	}
}

func upgradeDatabaseToVersion471(sqlStore SqlStore) {
	// If any new instances started with 4.7, they would have the bad Email column on the
	// ChannelMemberHistory table. So for those cases we need to do an upgrade between
	// 4.7.0 and 4.7.1
	if shouldPerformUpgrade(sqlStore, VERSION_4_7_0, VERSION_4_7_1) {
		sqlStore.RemoveColumnIfExists("ChannelMemberHistory", "Email")
		saveSchemaVersion(sqlStore, VERSION_4_7_1)
	}
}

func upgradeDatabaseToVersion472(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_7_1, VERSION_4_7_2) {
		sqlStore.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlStore, VERSION_4_7_2)
	}
}

func upgradeDatabaseToVersion48(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_7_2, VERSION_4_8_0) {
		saveSchemaVersion(sqlStore, VERSION_4_8_0)
	}
}

func upgradeDatabaseToVersion481(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_8_0, VERSION_4_8_1) {
		sqlStore.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlStore, VERSION_4_8_1)
	}
}

func upgradeDatabaseToVersion49(sqlStore SqlStore) {
	// This version of Mattermost includes an App-Layer migration which migrates from hard-coded roles configured by
	// a number of parameters in `config.json` to a `Roles` table in the database. The migration code can be seen
	// in the file `app/app.go` in the function `DoAdvancedPermissionsMigration()`.

	if shouldPerformUpgrade(sqlStore, VERSION_4_8_1, VERSION_4_9_0) {
		sqlStore.CreateColumnIfNotExists("Teams", "LastTeamIconUpdate", "bigint", "bigint", "0")
		defaultTimezone := timezones.DefaultUserTimezone()
		defaultTimezoneValue, err := json.Marshal(defaultTimezone)
		if err != nil {
			mlog.Critical(err.Error())
		}
		sqlStore.CreateColumnIfNotExists("Users", "Timezone", "varchar(256)", "varchar(256)", string(defaultTimezoneValue))
		sqlStore.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlStore, VERSION_4_9_0)
	}
}

func upgradeDatabaseToVersion410(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_4_9_0, VERSION_4_10_0) {

		sqlStore.RemoveIndexIfExists("Name_2", "Channels")
		sqlStore.RemoveIndexIfExists("Name_2", "Emoji")
		sqlStore.RemoveIndexIfExists("ClientId_2", "OAuthAccessData")

		saveSchemaVersion(sqlStore, VERSION_4_10_0)
		sqlStore.GetMaster().Exec("UPDATE Users SET AuthData=LOWER(AuthData) WHERE AuthService = 'saml'")
	}
}

func upgradeDatabaseToVersion50(sqlStore SqlStore) {
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

func upgradeDatabaseToVersion51(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_0_0, VERSION_5_1_0) {
		saveSchemaVersion(sqlStore, VERSION_5_1_0)
	}
}

func upgradeDatabaseToVersion52(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_1_0, VERSION_5_2_0) {
		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "Username", "varchar(64)", "varchar(64)", "")
		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "IconURL", "varchar(1024)", "varchar(1024)", "")
		saveSchemaVersion(sqlStore, VERSION_5_2_0)
	}
}

func upgradeDatabaseToVersion53(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_2_0, VERSION_5_3_0) {
		saveSchemaVersion(sqlStore, VERSION_5_3_0)
	}
}

func upgradeDatabaseToVersion54(sqlStore SqlStore) {
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

func upgradeDatabaseToVersion55(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_4_0, VERSION_5_5_0) {
		saveSchemaVersion(sqlStore, VERSION_5_5_0)
	}
}

func upgradeDatabaseToVersion56(sqlStore SqlStore) {
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

func upgradeDatabaseToVersion57(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_6_0, VERSION_5_7_0) {
		saveSchemaVersion(sqlStore, VERSION_5_7_0)
	}
}

func upgradeDatabaseToVersion58(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_7_0, VERSION_5_8_0) {
		// idx_channels_txt was removed in `upgradeDatabaseToVersion50`, but merged as part of
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

func upgradeDatabaseToVersion59(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_8_0, VERSION_5_9_0) {
		saveSchemaVersion(sqlStore, VERSION_5_9_0)
	}
}

func upgradeDatabaseToVersion510(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_9_0, VERSION_5_10_0) {
		sqlStore.CreateColumnIfNotExistsNoDefault("Channels", "GroupConstrained", "tinyint(4)", "boolean")
		sqlStore.CreateColumnIfNotExistsNoDefault("Teams", "GroupConstrained", "tinyint(4)", "boolean")

		sqlStore.CreateIndexIfNotExists("idx_groupteams_teamid", "GroupTeams", "TeamId")
		sqlStore.CreateIndexIfNotExists("idx_groupchannels_channelid", "GroupChannels", "ChannelId")

		saveSchemaVersion(sqlStore, VERSION_5_10_0)
	}
}

func upgradeDatabaseToVersion511(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_10_0, VERSION_5_11_0) {
		// Enforce all teams have an InviteID set
		var teams []*model.Team
		if _, err := sqlStore.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE InviteId = ''"); err != nil {
			mlog.Error("Error fetching Teams without InviteID", mlog.Err(err))
		} else {
			for _, team := range teams {
				team.InviteId = model.NewId()
				if _, err := sqlStore.Team().Update(team); err != nil {
					mlog.Error("Error updating Team InviteIDs", mlog.String("team_id", team.Id), mlog.Err(err))
				}
			}
		}

		saveSchemaVersion(sqlStore, VERSION_5_11_0)
	}
}

func upgradeDatabaseToVersion512(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_11_0, VERSION_5_12_0) {
		sqlStore.CreateColumnIfNotExistsNoDefault("TeamMembers", "SchemeGuest", "boolean", "boolean")
		sqlStore.CreateColumnIfNotExistsNoDefault("ChannelMembers", "SchemeGuest", "boolean", "boolean")
		sqlStore.CreateColumnIfNotExistsNoDefault("Schemes", "DefaultTeamGuestRole", "text", "VARCHAR(64)")
		sqlStore.CreateColumnIfNotExistsNoDefault("Schemes", "DefaultChannelGuestRole", "text", "VARCHAR(64)")

		sqlStore.GetMaster().Exec("UPDATE Schemes SET DefaultTeamGuestRole = '', DefaultChannelGuestRole = ''")

		// Saturday, January 24, 2065 5:20:00 AM GMT. To remove all personal access token sessions.
		sqlStore.GetMaster().Exec("DELETE FROM Sessions WHERE ExpiresAt > 3000000000000")

		saveSchemaVersion(sqlStore, VERSION_5_12_0)
	}
}

func upgradeDatabaseToVersion513(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_12_0, VERSION_5_13_0) {
		// The previous jobs ran once per minute, cluttering the Jobs table with somewhat useless entries. Clean that up.
		sqlStore.GetMaster().Exec("DELETE FROM Jobs WHERE Type = 'plugins'")

		saveSchemaVersion(sqlStore, VERSION_5_13_0)
	}
}

func upgradeDatabaseToVersion514(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_13_0, VERSION_5_14_0) {
		saveSchemaVersion(sqlStore, VERSION_5_14_0)
	}
}

func upgradeDatabaseToVersion515(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_14_0, VERSION_5_15_0) {
		saveSchemaVersion(sqlStore, VERSION_5_15_0)
	}
}

func upgradeDatabaseToVersion516(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_15_0, VERSION_5_16_0) {
		if sqlStore.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			sqlStore.GetMaster().Exec("ALTER TABLE Tokens ALTER COLUMN Extra TYPE varchar(2048)")
		} else if sqlStore.DriverName() == model.DATABASE_DRIVER_MYSQL {
			sqlStore.GetMaster().Exec("ALTER TABLE Tokens MODIFY Extra text")
		}
		saveSchemaVersion(sqlStore, VERSION_5_16_0)

		// Fix mismatches between the canonical and migrated schemas.
		sqlStore.AlterColumnTypeIfExists("TeamMembers", "SchemeGuest", "tinyint(4)", "boolean")
		sqlStore.AlterColumnTypeIfExists("Schemes", "DefaultTeamGuestRole", "varchar(64)", "VARCHAR(64)")
		sqlStore.AlterColumnTypeIfExists("Schemes", "DefaultChannelGuestRole", "varchar(64)", "VARCHAR(64)")
		sqlStore.AlterColumnTypeIfExists("Teams", "AllowedDomains", "text", "VARCHAR(1000)")
		sqlStore.AlterColumnTypeIfExists("Channels", "GroupConstrained", "tinyint(1)", "boolean")
		sqlStore.AlterColumnTypeIfExists("Teams", "GroupConstrained", "tinyint(1)", "boolean")

		// One known mismatch remains: ChannelMembers.SchemeGuest. The requisite migration
		// is left here for posterity, but we're avoiding fix this given the corresponding
		// table rewrite in most MySQL and Postgres instances.
		// sqlStore.AlterColumnTypeIfExists("ChannelMembers", "SchemeGuest", "tinyint(4)", "boolean")

		sqlStore.CreateIndexIfNotExists("idx_groupteams_teamid", "GroupTeams", "TeamId")
		sqlStore.CreateIndexIfNotExists("idx_groupchannels_channelid", "GroupChannels", "ChannelId")
	}
}

func upgradeDatabaseToVersion517(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_16_0, VERSION_5_17_0) {
		saveSchemaVersion(sqlStore, VERSION_5_17_0)
	}
}

func upgradeDatabaseToVersion518(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_17_0, VERSION_5_18_0) {
		saveSchemaVersion(sqlStore, VERSION_5_18_0)
	}
}

func upgradeDatabaseToVersion519(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_18_0, VERSION_5_19_0) {
		saveSchemaVersion(sqlStore, VERSION_5_19_0)
	}
}

func upgradeDatabaseToVersion520(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_19_0, VERSION_5_20_0) {
		sqlStore.CreateColumnIfNotExistsNoDefault("Bots", "LastIconUpdate", "bigint", "bigint")

		sqlStore.CreateColumnIfNotExists("GroupTeams", "SchemeAdmin", "boolean", "boolean", "0")
		sqlStore.CreateIndexIfNotExists("idx_groupteams_schemeadmin", "GroupTeams", "SchemeAdmin")

		sqlStore.CreateColumnIfNotExists("GroupChannels", "SchemeAdmin", "boolean", "boolean", "0")
		sqlStore.CreateIndexIfNotExists("idx_groupchannels_schemeadmin", "GroupChannels", "SchemeAdmin")

		saveSchemaVersion(sqlStore, VERSION_5_20_0)
	}
}

func upgradeDatabaseToVersion521(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_20_0, VERSION_5_21_0) {
		saveSchemaVersion(sqlStore, VERSION_5_21_0)
	}
}

func upgradeDatabaseToVersion522(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_21_0, VERSION_5_22_0) {
		sqlStore.CreateIndexIfNotExists("idx_teams_scheme_id", "Teams", "SchemeId")
		sqlStore.CreateIndexIfNotExists("idx_channels_scheme_id", "Channels", "SchemeId")
		sqlStore.CreateIndexIfNotExists("idx_channels_scheme_id", "Channels", "SchemeId")
		sqlStore.CreateIndexIfNotExists("idx_schemes_channel_guest_role", "Schemes", "DefaultChannelGuestRole")
		sqlStore.CreateIndexIfNotExists("idx_schemes_channel_user_role", "Schemes", "DefaultChannelUserRole")
		sqlStore.CreateIndexIfNotExists("idx_schemes_channel_admin_role", "Schemes", "DefaultChannelAdminRole")

		saveSchemaVersion(sqlStore, VERSION_5_22_0)
	}
}

func upgradeDatabaseToVersion523(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_22_0, VERSION_5_23_0) {
		saveSchemaVersion(sqlStore, VERSION_5_23_0)
	}
}

func upgradeDatabaseToVersion524(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_23_0, VERSION_5_24_0) {
		sqlStore.CreateColumnIfNotExists("UserGroups", "AllowReference", "boolean", "boolean", "0")
		sqlStore.GetMaster().Exec("UPDATE UserGroups SET Name = null, AllowReference = false")
		sqlStore.AlterPrimaryKey("Reactions", []string{"PostId", "UserId", "EmojiName"})

		saveSchemaVersion(sqlStore, VERSION_5_24_0)
	}
}

func upgradeDatabaseToVersion525(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_24_0, VERSION_5_25_0) {
		saveSchemaVersion(sqlStore, VERSION_5_25_0)
	}
}

func upgradeDatabaseToVersion526(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_25_0, VERSION_5_26_0) {
		sqlStore.CreateColumnIfNotExists("Sessions", "ExpiredNotify", "boolean", "boolean", "0")

		saveSchemaVersion(sqlStore, VERSION_5_26_0)
	}
}

func upgradeDatabaseToVersion527(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_26_0, VERSION_5_27_0) {
		saveSchemaVersion(sqlStore, VERSION_5_27_0)
	}
}

func upgradeDatabaseToVersion528(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_27_0, VERSION_5_28_0) {
		if err := precheckMigrationToVersion528(sqlStore); err != nil {
			mlog.Error("Error upgrading DB schema to 5.28.0", mlog.Err(err))
			os.Exit(EXIT_GENERIC_FAILURE)
		}

		sqlStore.CreateColumnIfNotExistsNoDefault("Commands", "PluginId", "VARCHAR(190)", "VARCHAR(190)")
		sqlStore.GetMaster().Exec("UPDATE Commands SET PluginId = '' WHERE PluginId IS NULL")

		sqlStore.AlterColumnTypeIfExists("Teams", "Type", "VARCHAR(255)", "VARCHAR(255)")
		sqlStore.AlterColumnTypeIfExists("Teams", "SchemeId", "VARCHAR(26)", "VARCHAR(26)")
		sqlStore.AlterColumnTypeIfExists("IncomingWebhooks", "Username", "varchar(255)", "varchar(255)")
		sqlStore.AlterColumnTypeIfExists("IncomingWebhooks", "IconURL", "text", "varchar(1024)")

		saveSchemaVersion(sqlStore, VERSION_5_28_0)
	}
}

func upgradeDatabaseToVersion5281(sqlStore SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_5_28_0, VERSION_5_28_1) {
		sqlStore.CreateColumnIfNotExistsNoDefault("FileInfo", "MiniPreview", "MEDIUMBLOB", "bytea")

		saveSchemaVersion(sqlStore, VERSION_5_28_1)
	}
}

func precheckMigrationToVersion528(sqlStore SqlStore) error {
	teamsQuery, _, err := sqlStore.getQueryBuilder().Select(`COALESCE(SUM(CASE
				WHEN CHAR_LENGTH(SchemeId) > 26 THEN 1
				ELSE 0
			END),0) as schemeidwrong,
			COALESCE(SUM(CASE
				WHEN CHAR_LENGTH(Type) > 255 THEN 1
				ELSE 0
			END),0) as typewrong`).
		From("Teams").ToSql()
	if err != nil {
		return err
	}
	webhooksQuery, _, err := sqlStore.getQueryBuilder().Select(`COALESCE(SUM(CASE
				WHEN CHAR_LENGTH(Username) > 255 THEN 1
				ELSE 0
			END),0) as usernamewrong,
			COALESCE(SUM(CASE
				WHEN CHAR_LENGTH(IconURL) > 1024 THEN 1
				ELSE 0
			END),0) as iconurlwrong`).
		From("IncomingWebhooks").ToSql()
	if err != nil {
		return err
	}

	var schemeIDWrong, typeWrong int
	row := sqlStore.GetMaster().Db.QueryRow(teamsQuery)
	if err = row.Scan(&schemeIDWrong, &typeWrong); err != nil && err != sql.ErrNoRows {
		return err
	} else if err == nil && schemeIDWrong > 0 {
		return errors.New("Migration failure: " +
			"Teams column SchemeId has data larger that 26 characters")
	} else if err == nil && typeWrong > 0 {
		return errors.New("Migration failure: " +
			"Teams column Type has data larger that 255 characters")
	}

	var usernameWrong, iconURLWrong int
	row = sqlStore.GetMaster().Db.QueryRow(webhooksQuery)
	if err = row.Scan(&usernameWrong, &iconURLWrong); err != nil && err != sql.ErrNoRows {
		mlog.Error("Error fetching IncomingWebhooks columns data", mlog.Err(err))
	} else if err == nil && usernameWrong > 0 {
		return errors.New("Migration failure: " +
			"IncomingWebhooks column Username has data larger that 255 characters")
	} else if err == nil && iconURLWrong > 0 {
		return errors.New("Migration failure: " +
			"IncomingWebhooks column IconURL has data larger that 1024 characters")
	}

	return nil
}

func upgradeDatabaseToVersion529(sqlStore SqlStore) {
	// if shouldPerformUpgrade(sqlStore, VERSION_5_28_0, VERSION_5_29_0) {

	sqlStore.AlterColumnTypeIfExists("SidebarCategories", "Id", "VARCHAR(128)", "VARCHAR(128)")
	sqlStore.AlterColumnDefaultIfExists("SidebarCategories", "Id", model.NewString(""), nil)
	sqlStore.AlterColumnTypeIfExists("SidebarChannels", "CategoryId", "VARCHAR(128)", "VARCHAR(128)")
	sqlStore.AlterColumnDefaultIfExists("SidebarChannels", "CategoryId", model.NewString(""), nil)

	// 	saveSchemaVersion(sqlStore, VERSION_5_29_0)
	// }
}
