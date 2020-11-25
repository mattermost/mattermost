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
	CURRENT_SCHEMA_VERSION   = VERSION_5_29_0
	VERSION_5_30_0           = "5.30.0"
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
func upgradeDatabase(sqlSupplier *SqlSupplier, currentModelVersionString string) error {
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
	currentSchemaVersionString := sqlSupplier.GetCurrentSchemaVersion()
	if currentSchemaVersionString != "" {
		currentSchemaVersion, err = semver.New(currentSchemaVersionString)
		if err != nil {
			return errors.Wrapf(err, "failed to parse database schema version %s", currentSchemaVersionString)
		}
	}

	// Assume a fresh database if no schema version has been recorded.
	if currentSchemaVersion == nil {
		if err := sqlSupplier.System().SaveOrUpdate(&model.System{Name: "Version", Value: currentModelVersion.String()}); err != nil {
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
	upgradeDatabaseToVersion31(sqlSupplier)
	upgradeDatabaseToVersion32(sqlSupplier)
	upgradeDatabaseToVersion33(sqlSupplier)
	upgradeDatabaseToVersion34(sqlSupplier)
	upgradeDatabaseToVersion35(sqlSupplier)
	upgradeDatabaseToVersion36(sqlSupplier)
	upgradeDatabaseToVersion37(sqlSupplier)
	upgradeDatabaseToVersion38(sqlSupplier)
	upgradeDatabaseToVersion39(sqlSupplier)
	upgradeDatabaseToVersion310(sqlSupplier)
	upgradeDatabaseToVersion40(sqlSupplier)
	upgradeDatabaseToVersion41(sqlSupplier)
	upgradeDatabaseToVersion42(sqlSupplier)
	upgradeDatabaseToVersion43(sqlSupplier)
	upgradeDatabaseToVersion44(sqlSupplier)
	upgradeDatabaseToVersion45(sqlSupplier)
	upgradeDatabaseToVersion46(sqlSupplier)
	upgradeDatabaseToVersion47(sqlSupplier)
	upgradeDatabaseToVersion471(sqlSupplier)
	upgradeDatabaseToVersion472(sqlSupplier)
	upgradeDatabaseToVersion48(sqlSupplier)
	upgradeDatabaseToVersion481(sqlSupplier)
	upgradeDatabaseToVersion49(sqlSupplier)
	upgradeDatabaseToVersion410(sqlSupplier)
	upgradeDatabaseToVersion50(sqlSupplier)
	upgradeDatabaseToVersion51(sqlSupplier)
	upgradeDatabaseToVersion52(sqlSupplier)
	upgradeDatabaseToVersion53(sqlSupplier)
	upgradeDatabaseToVersion54(sqlSupplier)
	upgradeDatabaseToVersion55(sqlSupplier)
	upgradeDatabaseToVersion56(sqlSupplier)
	upgradeDatabaseToVersion57(sqlSupplier)
	upgradeDatabaseToVersion58(sqlSupplier)
	upgradeDatabaseToVersion59(sqlSupplier)
	upgradeDatabaseToVersion510(sqlSupplier)
	upgradeDatabaseToVersion511(sqlSupplier)
	upgradeDatabaseToVersion512(sqlSupplier)
	upgradeDatabaseToVersion513(sqlSupplier)
	upgradeDatabaseToVersion514(sqlSupplier)
	upgradeDatabaseToVersion515(sqlSupplier)
	upgradeDatabaseToVersion516(sqlSupplier)
	upgradeDatabaseToVersion517(sqlSupplier)
	upgradeDatabaseToVersion518(sqlSupplier)
	upgradeDatabaseToVersion519(sqlSupplier)
	upgradeDatabaseToVersion520(sqlSupplier)
	upgradeDatabaseToVersion521(sqlSupplier)
	upgradeDatabaseToVersion522(sqlSupplier)
	upgradeDatabaseToVersion523(sqlSupplier)
	upgradeDatabaseToVersion524(sqlSupplier)
	upgradeDatabaseToVersion525(sqlSupplier)
	upgradeDatabaseToVersion526(sqlSupplier)
	upgradeDatabaseToVersion527(sqlSupplier)
	upgradeDatabaseToVersion528(sqlSupplier)
	upgradeDatabaseToVersion5281(sqlSupplier)
	upgradeDatabaseToVersion529(sqlSupplier)
	upgradeDatabaseToVersion530(sqlSupplier)

	return nil
}

func saveSchemaVersion(sqlSupplier *SqlSupplier, version string) {
	if err := sqlSupplier.System().SaveOrUpdate(&model.System{Name: "Version", Value: version}); err != nil {
		mlog.Critical(err.Error())
		time.Sleep(time.Second)
		os.Exit(EXIT_VERSION_SAVE)
	}

	mlog.Warn("The database schema version has been upgraded", mlog.String("version", version))
}

func shouldPerformUpgrade(sqlSupplier *SqlSupplier, currentSchemaVersion string, expectedSchemaVersion string) bool {
	if sqlSupplier.GetCurrentSchemaVersion() == currentSchemaVersion {
		mlog.Warn("Attempting to upgrade the database schema version", mlog.String("current_version", currentSchemaVersion), mlog.String("new_version", expectedSchemaVersion))

		return true
	}

	return false
}

func upgradeDatabaseToVersion31(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_0_0, VERSION_3_1_0) {
		sqlSupplier.CreateColumnIfNotExists("OutgoingWebhooks", "ContentType", "varchar(128)", "varchar(128)", "")
		saveSchemaVersion(sqlSupplier, VERSION_3_1_0)
	}
}

func upgradeDatabaseToVersion32(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_1_0, VERSION_3_2_0) {
		sqlSupplier.CreateColumnIfNotExists("TeamMembers", "DeleteAt", "bigint(20)", "bigint", "0")

		saveSchemaVersion(sqlSupplier, VERSION_3_2_0)
	}
}

func themeMigrationFailed(err error) {
	mlog.Critical("Failed to migrate User.ThemeProps to Preferences table", mlog.Err(err))
	time.Sleep(time.Second)
	os.Exit(EXIT_THEME_MIGRATION)
}

func upgradeDatabaseToVersion33(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_2_0, VERSION_3_3_0) {
		if sqlSupplier.DoesColumnExist("Users", "ThemeProps") {
			params := map[string]interface{}{
				"Category": model.PREFERENCE_CATEGORY_THEME,
				"Name":     "",
			}

			transaction, err := sqlSupplier.GetMaster().Begin()
			if err != nil {
				themeMigrationFailed(err)
			}
			defer finalizeTransaction(transaction)

			// increase size of Value column of Preferences table to match the size of the ThemeProps column
			if sqlSupplier.DriverName() == model.DATABASE_DRIVER_POSTGRES || sqlSupplier.DriverName() == model.DATABASE_DRIVER_COCKROACH {
				if _, err := transaction.Exec("ALTER TABLE Preferences ALTER COLUMN Value TYPE varchar(2000)"); err != nil {
					themeMigrationFailed(err)
					return
				}
			} else if sqlSupplier.DriverName() == model.DATABASE_DRIVER_MYSQL {
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
			if _, err := sqlSupplier.GetMaster().Select(&data, "SELECT * FROM Preferences WHERE Category = '"+model.PREFERENCE_CATEGORY_THEME+"' AND Value LIKE '%solarized_%'"); err == nil {
				for i := range data {
					data[i].Value = strings.Replace(data[i].Value, "solarized_", "solarized-", -1)
				}

				sqlSupplier.Preference().Save(&data)
			}
		}

		sqlSupplier.CreateColumnIfNotExists("OAuthApps", "IsTrusted", "tinyint(1)", "boolean", "0")
		sqlSupplier.CreateColumnIfNotExists("OAuthApps", "IconURL", "varchar(512)", "varchar(512)", "")
		sqlSupplier.CreateColumnIfNotExists("OAuthAccessData", "ClientId", "varchar(26)", "varchar(26)", "")
		sqlSupplier.CreateColumnIfNotExists("OAuthAccessData", "UserId", "varchar(26)", "varchar(26)", "")
		sqlSupplier.CreateColumnIfNotExists("OAuthAccessData", "ExpiresAt", "bigint", "bigint", "0")

		if sqlSupplier.DoesColumnExist("OAuthAccessData", "AuthCode") {
			sqlSupplier.RemoveIndexIfExists("idx_oauthaccessdata_auth_code", "OAuthAccessData")
			sqlSupplier.RemoveColumnIfExists("OAuthAccessData", "AuthCode")
		}

		sqlSupplier.RemoveColumnIfExists("Users", "LastActivityAt")
		sqlSupplier.RemoveColumnIfExists("Users", "LastPingAt")

		sqlSupplier.CreateColumnIfNotExists("OutgoingWebhooks", "TriggerWhen", "tinyint", "integer", "0")

		saveSchemaVersion(sqlSupplier, VERSION_3_3_0)
	}
}

func upgradeDatabaseToVersion34(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_3_0, VERSION_3_4_0) {
		sqlSupplier.CreateColumnIfNotExists("Status", "Manual", "BOOLEAN", "BOOLEAN", "0")
		sqlSupplier.CreateColumnIfNotExists("Status", "ActiveChannel", "varchar(26)", "varchar(26)", "")

		saveSchemaVersion(sqlSupplier, VERSION_3_4_0)
	}
}

func upgradeDatabaseToVersion35(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_4_0, VERSION_3_5_0) {
		sqlSupplier.GetMaster().Exec("UPDATE Users SET Roles = 'system_user' WHERE Roles = ''")
		sqlSupplier.GetMaster().Exec("UPDATE Users SET Roles = 'system_user system_admin' WHERE Roles = 'system_admin'")
		sqlSupplier.GetMaster().Exec("UPDATE TeamMembers SET Roles = 'team_user' WHERE Roles = ''")
		sqlSupplier.GetMaster().Exec("UPDATE TeamMembers SET Roles = 'team_user team_admin' WHERE Roles = 'admin'")
		sqlSupplier.GetMaster().Exec("UPDATE ChannelMembers SET Roles = 'channel_user' WHERE Roles = ''")
		sqlSupplier.GetMaster().Exec("UPDATE ChannelMembers SET Roles = 'channel_user channel_admin' WHERE Roles = 'admin'")

		// The rest of the migration from Filenames -> FileIds is done lazily in api.GetFileInfosForPost
		sqlSupplier.CreateColumnIfNotExists("Posts", "FileIds", "varchar(150)", "varchar(150)", "[]")

		// Increase maximum length of the Channel table Purpose column.
		if sqlSupplier.GetMaxLengthOfColumnIfExists("Channels", "Purpose") != "250" {
			sqlSupplier.AlterColumnTypeIfExists("Channels", "Purpose", "varchar(250)", "varchar(250)")
		}

		sqlSupplier.Session().RemoveAllSessions()

		saveSchemaVersion(sqlSupplier, VERSION_3_5_0)
	}
}

func upgradeDatabaseToVersion36(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_5_0, VERSION_3_6_0) {
		sqlSupplier.CreateColumnIfNotExists("Posts", "HasReactions", "tinyint", "boolean", "0")

		// Create Team Description column
		sqlSupplier.CreateColumnIfNotExists("Teams", "Description", "varchar(255)", "varchar(255)", "")

		// Add a Position column to users.
		sqlSupplier.CreateColumnIfNotExists("Users", "Position", "varchar(64)", "varchar(64)", "")

		// Remove ActiveChannel column from Status
		sqlSupplier.RemoveColumnIfExists("Status", "ActiveChannel")

		saveSchemaVersion(sqlSupplier, VERSION_3_6_0)
	}
}

func upgradeDatabaseToVersion37(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_6_0, VERSION_3_7_0) {
		// Add EditAt column to Posts
		sqlSupplier.CreateColumnIfNotExists("Posts", "EditAt", " bigint", " bigint", "0")

		saveSchemaVersion(sqlSupplier, VERSION_3_7_0)
	}
}

func upgradeDatabaseToVersion38(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_7_0, VERSION_3_8_0) {
		// Add the IsPinned column to posts.
		sqlSupplier.CreateColumnIfNotExists("Posts", "IsPinned", "boolean", "boolean", "0")

		saveSchemaVersion(sqlSupplier, VERSION_3_8_0)
	}
}

func upgradeDatabaseToVersion39(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_8_0, VERSION_3_9_0) {
		sqlSupplier.CreateColumnIfNotExists("OAuthAccessData", "Scope", "varchar(128)", "varchar(128)", model.DEFAULT_SCOPE)
		sqlSupplier.RemoveTableIfExists("PasswordRecovery")

		saveSchemaVersion(sqlSupplier, VERSION_3_9_0)
	}
}

func upgradeDatabaseToVersion310(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_9_0, VERSION_3_10_0) {
		saveSchemaVersion(sqlSupplier, VERSION_3_10_0)
	}
}

func upgradeDatabaseToVersion40(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_3_10_0, VERSION_4_0_0) {
		saveSchemaVersion(sqlSupplier, VERSION_4_0_0)
	}
}

func upgradeDatabaseToVersion41(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_0_0, VERSION_4_1_0) {
		// Increase maximum length of the Users table Roles column.
		if sqlSupplier.GetMaxLengthOfColumnIfExists("Users", "Roles") != "256" {
			sqlSupplier.AlterColumnTypeIfExists("Users", "Roles", "varchar(256)", "varchar(256)")
		}

		sqlSupplier.RemoveTableIfExists("JobStatuses")

		saveSchemaVersion(sqlSupplier, VERSION_4_1_0)
	}
}

func upgradeDatabaseToVersion42(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_1_0, VERSION_4_2_0) {
		saveSchemaVersion(sqlSupplier, VERSION_4_2_0)
	}
}

func upgradeDatabaseToVersion43(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_2_0, VERSION_4_3_0) {
		saveSchemaVersion(sqlSupplier, VERSION_4_3_0)
	}
}

func upgradeDatabaseToVersion44(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_3_0, VERSION_4_4_0) {
		// Add the IsActive column to UserAccessToken.
		sqlSupplier.CreateColumnIfNotExists("UserAccessTokens", "IsActive", "boolean", "boolean", "1")

		saveSchemaVersion(sqlSupplier, VERSION_4_4_0)
	}
}

func upgradeDatabaseToVersion45(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_4_0, VERSION_4_5_0) {
		saveSchemaVersion(sqlSupplier, VERSION_4_5_0)
	}
}

func upgradeDatabaseToVersion46(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_5_0, VERSION_4_6_0) {
		sqlSupplier.CreateColumnIfNotExists("IncomingWebhooks", "Username", "varchar(64)", "varchar(64)", "")
		sqlSupplier.CreateColumnIfNotExists("IncomingWebhooks", "IconURL", "varchar(1024)", "varchar(1024)", "")
		saveSchemaVersion(sqlSupplier, VERSION_4_6_0)
	}
}

func upgradeDatabaseToVersion47(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_6_0, VERSION_4_7_0) {
		sqlSupplier.AlterColumnTypeIfExists("Users", "Position", "varchar(128)", "varchar(128)")
		sqlSupplier.AlterColumnTypeIfExists("OAuthAuthData", "State", "varchar(1024)", "varchar(1024)")
		sqlSupplier.RemoveColumnIfExists("ChannelMemberHistory", "Email")
		sqlSupplier.RemoveColumnIfExists("ChannelMemberHistory", "Username")
		saveSchemaVersion(sqlSupplier, VERSION_4_7_0)
	}
}

func upgradeDatabaseToVersion471(sqlSupplier *SqlSupplier) {
	// If any new instances started with 4.7, they would have the bad Email column on the
	// ChannelMemberHistory table. So for those cases we need to do an upgrade between
	// 4.7.0 and 4.7.1
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_7_0, VERSION_4_7_1) {
		sqlSupplier.RemoveColumnIfExists("ChannelMemberHistory", "Email")
		saveSchemaVersion(sqlSupplier, VERSION_4_7_1)
	}
}

func upgradeDatabaseToVersion472(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_7_1, VERSION_4_7_2) {
		sqlSupplier.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlSupplier, VERSION_4_7_2)
	}
}

func upgradeDatabaseToVersion48(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_7_2, VERSION_4_8_0) {
		saveSchemaVersion(sqlSupplier, VERSION_4_8_0)
	}
}

func upgradeDatabaseToVersion481(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_8_0, VERSION_4_8_1) {
		sqlSupplier.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlSupplier, VERSION_4_8_1)
	}
}

func upgradeDatabaseToVersion49(sqlSupplier *SqlSupplier) {
	// This version of Mattermost includes an App-Layer migration which migrates from hard-coded roles configured by
	// a number of parameters in `config.json` to a `Roles` table in the database. The migration code can be seen
	// in the file `app/app.go` in the function `DoAdvancedPermissionsMigration()`.

	if shouldPerformUpgrade(sqlSupplier, VERSION_4_8_1, VERSION_4_9_0) {
		sqlSupplier.CreateColumnIfNotExists("Teams", "LastTeamIconUpdate", "bigint", "bigint", "0")
		defaultTimezone := timezones.DefaultUserTimezone()
		defaultTimezoneValue, err := json.Marshal(defaultTimezone)
		if err != nil {
			mlog.Critical(err.Error())
		}
		sqlSupplier.CreateColumnIfNotExists("Users", "Timezone", "varchar(256)", "varchar(256)", string(defaultTimezoneValue))
		sqlSupplier.RemoveIndexIfExists("idx_channels_displayname", "Channels")
		saveSchemaVersion(sqlSupplier, VERSION_4_9_0)
	}
}

func upgradeDatabaseToVersion410(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_4_9_0, VERSION_4_10_0) {

		sqlSupplier.RemoveIndexIfExists("Name_2", "Channels")
		sqlSupplier.RemoveIndexIfExists("Name_2", "Emoji")
		sqlSupplier.RemoveIndexIfExists("ClientId_2", "OAuthAccessData")

		saveSchemaVersion(sqlSupplier, VERSION_4_10_0)
		sqlSupplier.GetMaster().Exec("UPDATE Users SET AuthData=LOWER(AuthData) WHERE AuthService = 'saml'")
	}
}

func upgradeDatabaseToVersion50(sqlSupplier *SqlSupplier) {
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

	if shouldPerformUpgrade(sqlSupplier, VERSION_4_10_0, VERSION_5_0_0) {

		sqlSupplier.CreateColumnIfNotExistsNoDefault("Teams", "SchemeId", "varchar(26)", "varchar(26)")
		sqlSupplier.CreateColumnIfNotExistsNoDefault("Channels", "SchemeId", "varchar(26)", "varchar(26)")

		sqlSupplier.CreateColumnIfNotExistsNoDefault("TeamMembers", "SchemeUser", "boolean", "boolean")
		sqlSupplier.CreateColumnIfNotExistsNoDefault("TeamMembers", "SchemeAdmin", "boolean", "boolean")
		sqlSupplier.CreateColumnIfNotExistsNoDefault("ChannelMembers", "SchemeUser", "boolean", "boolean")
		sqlSupplier.CreateColumnIfNotExistsNoDefault("ChannelMembers", "SchemeAdmin", "boolean", "boolean")

		sqlSupplier.CreateColumnIfNotExists("Roles", "BuiltIn", "boolean", "boolean", "0")
		sqlSupplier.GetMaster().Exec("UPDATE Roles SET BuiltIn=true")
		sqlSupplier.GetMaster().Exec("UPDATE Roles SET SchemeManaged=false WHERE Name NOT IN ('system_user', 'system_admin', 'team_user', 'team_admin', 'channel_user', 'channel_admin')")
		sqlSupplier.CreateColumnIfNotExists("IncomingWebhooks", "ChannelLocked", "boolean", "boolean", "0")

		sqlSupplier.RemoveIndexIfExists("idx_channels_txt", "Channels")

		saveSchemaVersion(sqlSupplier, VERSION_5_0_0)
	}
}

func upgradeDatabaseToVersion51(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_0_0, VERSION_5_1_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_1_0)
	}
}

func upgradeDatabaseToVersion52(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_1_0, VERSION_5_2_0) {
		sqlSupplier.CreateColumnIfNotExists("OutgoingWebhooks", "Username", "varchar(64)", "varchar(64)", "")
		sqlSupplier.CreateColumnIfNotExists("OutgoingWebhooks", "IconURL", "varchar(1024)", "varchar(1024)", "")
		saveSchemaVersion(sqlSupplier, VERSION_5_2_0)
	}
}

func upgradeDatabaseToVersion53(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_2_0, VERSION_5_3_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_3_0)
	}
}

func upgradeDatabaseToVersion54(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_3_0, VERSION_5_4_0) {
		sqlSupplier.AlterColumnTypeIfExists("OutgoingWebhooks", "Description", "varchar(500)", "varchar(500)")
		sqlSupplier.AlterColumnTypeIfExists("IncomingWebhooks", "Description", "varchar(500)", "varchar(500)")
		if err := sqlSupplier.Channel().MigratePublicChannels(); err != nil {
			mlog.Critical("Failed to migrate PublicChannels table", mlog.Err(err))
			time.Sleep(time.Second)
			os.Exit(EXIT_GENERIC_FAILURE)
		}
		saveSchemaVersion(sqlSupplier, VERSION_5_4_0)
	}
}

func upgradeDatabaseToVersion55(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_4_0, VERSION_5_5_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_5_0)
	}
}

func upgradeDatabaseToVersion56(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_5_0, VERSION_5_6_0) {
		sqlSupplier.CreateColumnIfNotExists("PluginKeyValueStore", "ExpireAt", "bigint(20)", "bigint", "0")

		// migrating user's accepted terms of service data into the new table
		sqlSupplier.GetMaster().Exec("INSERT INTO UserTermsOfService SELECT Id, AcceptedTermsOfServiceId as TermsOfServiceId, :CreateAt FROM Users WHERE AcceptedTermsOfServiceId != \"\" AND AcceptedTermsOfServiceId IS NOT NULL", map[string]interface{}{"CreateAt": model.GetMillis()})

		if sqlSupplier.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			sqlSupplier.RemoveIndexIfExists("idx_users_email_lower", "lower(Email)")
			sqlSupplier.RemoveIndexIfExists("idx_users_username_lower", "lower(Username)")
			sqlSupplier.RemoveIndexIfExists("idx_users_nickname_lower", "lower(Nickname)")
			sqlSupplier.RemoveIndexIfExists("idx_users_firstname_lower", "lower(FirstName)")
			sqlSupplier.RemoveIndexIfExists("idx_users_lastname_lower", "lower(LastName)")
		}

		saveSchemaVersion(sqlSupplier, VERSION_5_6_0)
	}

}

func upgradeDatabaseToVersion57(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_6_0, VERSION_5_7_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_7_0)
	}
}

func upgradeDatabaseToVersion58(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_7_0, VERSION_5_8_0) {
		// idx_channels_txt was removed in `upgradeDatabaseToVersion50`, but merged as part of
		// v5.1, so the migration wouldn't apply to anyone upgrading from v5.0. Remove it again to
		// bring the upgraded (from v5.0) and fresh install schemas back in sync.
		sqlSupplier.RemoveIndexIfExists("idx_channels_txt", "Channels")

		// Fix column types and defaults where gorp converged on a different schema value than the
		// original migration.
		sqlSupplier.AlterColumnTypeIfExists("OutgoingWebhooks", "Description", "text", "VARCHAR(500)")
		sqlSupplier.AlterColumnTypeIfExists("IncomingWebhooks", "Description", "text", "VARCHAR(500)")
		sqlSupplier.AlterColumnTypeIfExists("OutgoingWebhooks", "IconURL", "text", "VARCHAR(1024)")
		sqlSupplier.AlterColumnDefaultIfExists("OutgoingWebhooks", "Username", model.NewString("NULL"), model.NewString(""))
		sqlSupplier.AlterColumnDefaultIfExists("OutgoingWebhooks", "IconURL", nil, model.NewString(""))
		sqlSupplier.AlterColumnDefaultIfExists("PluginKeyValueStore", "ExpireAt", model.NewString("NULL"), model.NewString("NULL"))

		saveSchemaVersion(sqlSupplier, VERSION_5_8_0)
	}
}

func upgradeDatabaseToVersion59(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_8_0, VERSION_5_9_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_9_0)
	}
}

func upgradeDatabaseToVersion510(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_9_0, VERSION_5_10_0) {
		sqlSupplier.CreateColumnIfNotExistsNoDefault("Channels", "GroupConstrained", "tinyint(4)", "boolean")
		sqlSupplier.CreateColumnIfNotExistsNoDefault("Teams", "GroupConstrained", "tinyint(4)", "boolean")

		sqlSupplier.CreateIndexIfNotExists("idx_groupteams_teamid", "GroupTeams", "TeamId")
		sqlSupplier.CreateIndexIfNotExists("idx_groupchannels_channelid", "GroupChannels", "ChannelId")

		saveSchemaVersion(sqlSupplier, VERSION_5_10_0)
	}
}

func upgradeDatabaseToVersion511(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_10_0, VERSION_5_11_0) {
		// Enforce all teams have an InviteID set
		var teams []*model.Team
		if _, err := sqlSupplier.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE InviteId = ''"); err != nil {
			mlog.Error("Error fetching Teams without InviteID", mlog.Err(err))
		} else {
			for _, team := range teams {
				team.InviteId = model.NewId()
				if _, err := sqlSupplier.Team().Update(team); err != nil {
					mlog.Error("Error updating Team InviteIDs", mlog.String("team_id", team.Id), mlog.Err(err))
				}
			}
		}

		saveSchemaVersion(sqlSupplier, VERSION_5_11_0)
	}
}

func upgradeDatabaseToVersion512(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_11_0, VERSION_5_12_0) {
		sqlSupplier.CreateColumnIfNotExistsNoDefault("TeamMembers", "SchemeGuest", "boolean", "boolean")
		sqlSupplier.CreateColumnIfNotExistsNoDefault("ChannelMembers", "SchemeGuest", "boolean", "boolean")
		sqlSupplier.CreateColumnIfNotExistsNoDefault("Schemes", "DefaultTeamGuestRole", "text", "VARCHAR(64)")
		sqlSupplier.CreateColumnIfNotExistsNoDefault("Schemes", "DefaultChannelGuestRole", "text", "VARCHAR(64)")

		sqlSupplier.GetMaster().Exec("UPDATE Schemes SET DefaultTeamGuestRole = '', DefaultChannelGuestRole = ''")

		// Saturday, January 24, 2065 5:20:00 AM GMT. To remove all personal access token sessions.
		sqlSupplier.GetMaster().Exec("DELETE FROM Sessions WHERE ExpiresAt > 3000000000000")

		saveSchemaVersion(sqlSupplier, VERSION_5_12_0)
	}
}

func upgradeDatabaseToVersion513(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_12_0, VERSION_5_13_0) {
		// The previous jobs ran once per minute, cluttering the Jobs table with somewhat useless entries. Clean that up.
		sqlSupplier.GetMaster().Exec("DELETE FROM Jobs WHERE Type = 'plugins'")

		saveSchemaVersion(sqlSupplier, VERSION_5_13_0)
	}
}

func upgradeDatabaseToVersion514(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_13_0, VERSION_5_14_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_14_0)
	}
}

func upgradeDatabaseToVersion515(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_14_0, VERSION_5_15_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_15_0)
	}
}

func upgradeDatabaseToVersion516(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_15_0, VERSION_5_16_0) {
		if sqlSupplier.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			sqlSupplier.GetMaster().Exec("ALTER TABLE Tokens ALTER COLUMN Extra TYPE varchar(2048)")
		} else if sqlSupplier.DriverName() == model.DATABASE_DRIVER_MYSQL {
			sqlSupplier.GetMaster().Exec("ALTER TABLE Tokens MODIFY Extra text")
		}
		saveSchemaVersion(sqlSupplier, VERSION_5_16_0)

		// Fix mismatches between the canonical and migrated schemas.
		sqlSupplier.AlterColumnTypeIfExists("TeamMembers", "SchemeGuest", "tinyint(4)", "boolean")
		sqlSupplier.AlterColumnTypeIfExists("Schemes", "DefaultTeamGuestRole", "varchar(64)", "VARCHAR(64)")
		sqlSupplier.AlterColumnTypeIfExists("Schemes", "DefaultChannelGuestRole", "varchar(64)", "VARCHAR(64)")
		sqlSupplier.AlterColumnTypeIfExists("Teams", "AllowedDomains", "text", "VARCHAR(1000)")
		sqlSupplier.AlterColumnTypeIfExists("Channels", "GroupConstrained", "tinyint(1)", "boolean")
		sqlSupplier.AlterColumnTypeIfExists("Teams", "GroupConstrained", "tinyint(1)", "boolean")

		// One known mismatch remains: ChannelMembers.SchemeGuest. The requisite migration
		// is left here for posterity, but we're avoiding fix this given the corresponding
		// table rewrite in most MySQL and Postgres instances.
		// sqlSupplier.AlterColumnTypeIfExists("ChannelMembers", "SchemeGuest", "tinyint(4)", "boolean")

		sqlSupplier.CreateIndexIfNotExists("idx_groupteams_teamid", "GroupTeams", "TeamId")
		sqlSupplier.CreateIndexIfNotExists("idx_groupchannels_channelid", "GroupChannels", "ChannelId")
	}
}

func upgradeDatabaseToVersion517(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_16_0, VERSION_5_17_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_17_0)
	}
}

func upgradeDatabaseToVersion518(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_17_0, VERSION_5_18_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_18_0)
	}
}

func upgradeDatabaseToVersion519(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_18_0, VERSION_5_19_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_19_0)
	}
}

func upgradeDatabaseToVersion520(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_19_0, VERSION_5_20_0) {
		sqlSupplier.CreateColumnIfNotExistsNoDefault("Bots", "LastIconUpdate", "bigint", "bigint")

		sqlSupplier.CreateColumnIfNotExists("GroupTeams", "SchemeAdmin", "boolean", "boolean", "0")
		sqlSupplier.CreateIndexIfNotExists("idx_groupteams_schemeadmin", "GroupTeams", "SchemeAdmin")

		sqlSupplier.CreateColumnIfNotExists("GroupChannels", "SchemeAdmin", "boolean", "boolean", "0")
		sqlSupplier.CreateIndexIfNotExists("idx_groupchannels_schemeadmin", "GroupChannels", "SchemeAdmin")

		saveSchemaVersion(sqlSupplier, VERSION_5_20_0)
	}
}

func upgradeDatabaseToVersion521(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_20_0, VERSION_5_21_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_21_0)
	}
}

func upgradeDatabaseToVersion522(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_21_0, VERSION_5_22_0) {
		sqlSupplier.CreateIndexIfNotExists("idx_teams_scheme_id", "Teams", "SchemeId")
		sqlSupplier.CreateIndexIfNotExists("idx_channels_scheme_id", "Channels", "SchemeId")
		sqlSupplier.CreateIndexIfNotExists("idx_channels_scheme_id", "Channels", "SchemeId")
		sqlSupplier.CreateIndexIfNotExists("idx_schemes_channel_guest_role", "Schemes", "DefaultChannelGuestRole")
		sqlSupplier.CreateIndexIfNotExists("idx_schemes_channel_user_role", "Schemes", "DefaultChannelUserRole")
		sqlSupplier.CreateIndexIfNotExists("idx_schemes_channel_admin_role", "Schemes", "DefaultChannelAdminRole")

		saveSchemaVersion(sqlSupplier, VERSION_5_22_0)
	}
}

func upgradeDatabaseToVersion523(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_22_0, VERSION_5_23_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_23_0)
	}
}

func upgradeDatabaseToVersion524(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_23_0, VERSION_5_24_0) {
		sqlSupplier.CreateColumnIfNotExists("UserGroups", "AllowReference", "boolean", "boolean", "0")
		sqlSupplier.GetMaster().Exec("UPDATE UserGroups SET Name = null, AllowReference = false")
		sqlSupplier.AlterPrimaryKey("Reactions", []string{"PostId", "UserId", "EmojiName"})

		saveSchemaVersion(sqlSupplier, VERSION_5_24_0)
	}
}

func upgradeDatabaseToVersion525(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_24_0, VERSION_5_25_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_25_0)
	}
}

func upgradeDatabaseToVersion526(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_25_0, VERSION_5_26_0) {
		sqlSupplier.CreateColumnIfNotExists("Sessions", "ExpiredNotify", "boolean", "boolean", "0")

		saveSchemaVersion(sqlSupplier, VERSION_5_26_0)
	}
}

func upgradeDatabaseToVersion527(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_26_0, VERSION_5_27_0) {
		saveSchemaVersion(sqlSupplier, VERSION_5_27_0)
	}
}

func upgradeDatabaseToVersion528(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_27_0, VERSION_5_28_0) {
		if err := precheckMigrationToVersion528(sqlSupplier); err != nil {
			mlog.Error("Error upgrading DB schema to 5.28.0", mlog.Err(err))
			os.Exit(EXIT_GENERIC_FAILURE)
		}

		sqlSupplier.CreateColumnIfNotExistsNoDefault("Commands", "PluginId", "VARCHAR(190)", "VARCHAR(190)")
		sqlSupplier.GetMaster().Exec("UPDATE Commands SET PluginId = '' WHERE PluginId IS NULL")

		sqlSupplier.AlterColumnTypeIfExists("Teams", "Type", "VARCHAR(255)", "VARCHAR(255)")
		sqlSupplier.AlterColumnTypeIfExists("Teams", "SchemeId", "VARCHAR(26)", "VARCHAR(26)")
		sqlSupplier.AlterColumnTypeIfExists("IncomingWebhooks", "Username", "varchar(255)", "varchar(255)")
		sqlSupplier.AlterColumnTypeIfExists("IncomingWebhooks", "IconURL", "text", "varchar(1024)")

		saveSchemaVersion(sqlSupplier, VERSION_5_28_0)
	}
}

func upgradeDatabaseToVersion5281(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_28_0, VERSION_5_28_1) {
		sqlSupplier.CreateColumnIfNotExistsNoDefault("FileInfo", "MiniPreview", "MEDIUMBLOB", "bytea")

		saveSchemaVersion(sqlSupplier, VERSION_5_28_1)
	}
}

func precheckMigrationToVersion528(sqlSupplier *SqlSupplier) error {
	teamsQuery, _, err := sqlSupplier.getQueryBuilder().Select(`COALESCE(SUM(CASE
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
	webhooksQuery, _, err := sqlSupplier.getQueryBuilder().Select(`COALESCE(SUM(CASE
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
	row := sqlSupplier.GetMaster().Db.QueryRow(teamsQuery)
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
	row = sqlSupplier.GetMaster().Db.QueryRow(webhooksQuery)
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

func upgradeDatabaseToVersion529(sqlSupplier *SqlSupplier) {
	if shouldPerformUpgrade(sqlSupplier, VERSION_5_28_1, VERSION_5_29_0) {
		sqlSupplier.AlterColumnTypeIfExists("SidebarCategories", "Id", "VARCHAR(128)", "VARCHAR(128)")
		sqlSupplier.AlterColumnDefaultIfExists("SidebarCategories", "Id", model.NewString(""), nil)
		sqlSupplier.AlterColumnTypeIfExists("SidebarChannels", "CategoryId", "VARCHAR(128)", "VARCHAR(128)")
		sqlSupplier.AlterColumnDefaultIfExists("SidebarChannels", "CategoryId", model.NewString(""), nil)

		sqlSupplier.CreateColumnIfNotExistsNoDefault("Threads", "ChannelId", "VARCHAR(26)", "VARCHAR(26)")

		updateThreadChannelsQuery := "UPDATE Threads INNER JOIN Posts ON Posts.Id=Threads.PostId SET Threads.ChannelId=Posts.ChannelId WHERE Threads.ChannelId IS NULL"
<<<<<<< HEAD
		if sqlStore.DriverName() == model.DATABASE_DRIVER_POSTGRES || sqlStore.DriverName() == model.DATABASE_DRIVER_COCKROACH {
=======
		if sqlSupplier.DriverName() == model.DATABASE_DRIVER_POSTGRES {
>>>>>>> origin/master
			updateThreadChannelsQuery = "UPDATE Threads SET ChannelId=Posts.ChannelId FROM Posts WHERE Posts.Id=Threads.PostId AND Threads.ChannelId IS NULL"
		}
		if _, err := sqlSupplier.GetMaster().Exec(updateThreadChannelsQuery); err != nil {
			mlog.Error("Error updating ChannelId in Threads table", mlog.Err(err))
		}

		saveSchemaVersion(sqlSupplier, VERSION_5_29_0)
	}
}

func upgradeDatabaseToVersion530(sqlSupplier *SqlSupplier) {
	// if shouldPerformUpgrade(sqlSupplier, VERSION_5_29_0, VERSION_5_30_0) {

	sqlSupplier.CreateColumnIfNotExistsNoDefault("FileInfo", "Content", "longtext", "text")

	sqlSupplier.CreateColumnIfNotExists("SidebarCategories", "Muted", "tinyint(1)", "boolean", "0")

	// 	saveSchemaVersion(sqlSupplier, VERSION_5_30_0)
	// }
}
