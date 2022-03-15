// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/blang/semver"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	CurrentSchemaVersion   = Version640
	Version640             = "6.4.0"
	Version630             = "6.3.0"
	Version620             = "6.2.0"
	Version610             = "6.1.0"
	Version600             = "6.0.0"
	Version5390            = "5.39.0"
	Version5380            = "5.38.0"
	Version5370            = "5.37.0"
	Version5360            = "5.36.0"
	Version5350            = "5.35.0"
	Version5340            = "5.34.0"
	Version5330            = "5.33.0"
	Version5320            = "5.32.0"
	Version5310            = "5.31.0"
	Version5300            = "5.30.0"
	Version5291            = "5.29.1"
	Version5290            = "5.29.0"
	Version5281            = "5.28.1"
	Version5280            = "5.28.0"
	Version5270            = "5.27.0"
	Version5260            = "5.26.0"
	Version5250            = "5.25.0"
	Version5240            = "5.24.0"
	Version5230            = "5.23.0"
	Version5220            = "5.22.0"
	Version5210            = "5.21.0"
	Version5200            = "5.20.0"
	Version5190            = "5.19.0"
	Version5180            = "5.18.0"
	Version5170            = "5.17.0"
	Version5160            = "5.16.0"
	Version5150            = "5.15.0"
	Version5140            = "5.14.0"
	Version5130            = "5.13.0"
	Version5120            = "5.12.0"
	Version5110            = "5.11.0"
	Version5100            = "5.10.0"
	Version590             = "5.9.0"
	Version580             = "5.8.0"
	Version570             = "5.7.0"
	Version560             = "5.6.0"
	Version550             = "5.5.0"
	Version540             = "5.4.0"
	Version530             = "5.3.0"
	Version520             = "5.2.0"
	Version510             = "5.1.0"
	Version500             = "5.0.0"
	Version4100            = "4.10.0"
	Version490             = "4.9.0"
	Version481             = "4.8.1"
	Version480             = "4.8.0"
	Version472             = "4.7.2"
	Version471             = "4.7.1"
	Version470             = "4.7.0"
	Version460             = "4.6.0"
	Version450             = "4.5.0"
	Version440             = "4.4.0"
	Version430             = "4.3.0"
	Version420             = "4.2.0"
	Version410             = "4.1.0"
	Version400             = "4.0.0"
	Version3100            = "3.10.0"
	Version390             = "3.9.0"
	Version380             = "3.8.0"
	Version370             = "3.7.0"
	Version360             = "3.6.0"
	Version350             = "3.5.0"
	Version340             = "3.4.0"
	Version330             = "3.3.0"
	Version320             = "3.2.0"
	Version310             = "3.1.0"
	Version300             = "3.0.0"
	OldestSupportedVersion = Version300
)

const (
	ExitVersionSave                 = 1003
	ExitThemeMigration              = 1004
	ExitTeamInviteIDMigrationFailed = 1006
)

// upgradeDatabase attempts to migrate the schema to the latest supported version.
// The value of model.CurrentVersion is accepted as a parameter for unit testing, but it is not
// used to stop migrations at that version.
func upgradeDatabase(sqlStore *SqlStore, currentModelVersionString string) error {
	currentModelVersion, err := semver.Parse(currentModelVersionString)
	if err != nil {
		return errors.Wrapf(err, "failed to parse current model version %s", currentModelVersionString)
	}

	nextUnsupportedMajorVersion := semver.Version{
		Major: currentModelVersion.Major + 1,
	}

	oldestSupportedVersion, err := semver.Parse(OldestSupportedVersion)
	if err != nil {
		return errors.Wrapf(err, "failed to parse oldest supported version %s", OldestSupportedVersion)
	}

	currentSchemaVersionString, err := sqlStore.getCurrentSchemaVersion()
	if err != nil {
		mlog.Warn("could not receive the schema version from systems table", mlog.Err(err))
	}

	var currentSchemaVersion *semver.Version
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
	upgradeDatabaseToVersion5291(sqlStore)
	upgradeDatabaseToVersion530(sqlStore)
	upgradeDatabaseToVersion531(sqlStore)
	upgradeDatabaseToVersion532(sqlStore)
	upgradeDatabaseToVersion533(sqlStore)
	upgradeDatabaseToVersion534(sqlStore)
	upgradeDatabaseToVersion535(sqlStore)
	upgradeDatabaseToVersion536(sqlStore)
	upgradeDatabaseToVersion537(sqlStore)
	upgradeDatabaseToVersion538(sqlStore)
	upgradeDatabaseToVersion539(sqlStore)
	upgradeDatabaseToVersion600(sqlStore)
	upgradeDatabaseToVersion610(sqlStore)
	upgradeDatabaseToVersion620(sqlStore)
	upgradeDatabaseToVersion630(sqlStore)
	upgradeDatabaseToVersion640(sqlStore)

	return nil
}

func saveSchemaVersion(sqlStore *SqlStore, version string) {
	if err := sqlStore.System().SaveOrUpdate(&model.System{Name: "Version", Value: version}); err != nil {
		mlog.Fatal(err.Error())
	}

	mlog.Warn("The database schema version has been upgraded", mlog.String("version", version))
}

func shouldPerformUpgrade(sqlStore *SqlStore, currentSchemaVersion string, expectedSchemaVersion string) bool {
	storedSchemaVersion, err := sqlStore.getCurrentSchemaVersion()
	if err != nil {
		mlog.Error("could not receive the schema version from systems table", mlog.Err(err))
		return false
	}

	storedVersion, err := semver.Parse(storedSchemaVersion)
	if err != nil {
		mlog.Error("Error parsing stored schema version", mlog.Err(err))
		return false
	}

	currentVersion, err := semver.Parse(currentSchemaVersion)
	if err != nil {
		mlog.Error("Error parsing current schema version", mlog.Err(err))
		return false
	}

	if storedVersion.Major == currentVersion.Major && storedVersion.Minor == currentVersion.Minor {
		mlog.Warn("Attempting to upgrade the database schema version",
			mlog.String("stored_version", storedSchemaVersion), mlog.String("current_version", currentSchemaVersion), mlog.String("new_version", expectedSchemaVersion))
		return true
	}

	return false
}

func upgradeDatabaseToVersion31(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version300, Version310) {
		saveSchemaVersion(sqlStore, Version310)
	}
}

func upgradeDatabaseToVersion32(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version310, Version320) {
		saveSchemaVersion(sqlStore, Version320)
	}
}

func themeMigrationFailed(err error) {
	mlog.Fatal("Failed to migrate User.ThemeProps to Preferences table", mlog.Err(err))
}

func upgradeDatabaseToVersion33(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version320, Version330) {
		if sqlStore.DoesColumnExist("Users", "ThemeProps") {
			transaction, err := sqlStore.GetMasterX().Beginx()
			if err != nil {
				themeMigrationFailed(err)
			}
			defer finalizeTransactionX(transaction)

			// copy data across
			if _, err := transaction.ExecNoTimeout(
				`INSERT INTO
					Preferences(UserId, Category, Name, Value)
				SELECT
					Id, '` + model.PreferenceCategoryTheme + `', '', ThemeProps
				FROM
					Users
				WHERE
					Users.ThemeProps != 'null'`); err != nil {
				themeMigrationFailed(err)
				return
			}

			// delete old data
			if _, err := transaction.ExecNoTimeout("ALTER TABLE Users DROP COLUMN ThemeProps"); err != nil {
				themeMigrationFailed(err)
				return
			}

			if err := transaction.Commit(); err != nil {
				themeMigrationFailed(err)
				return
			}
		}

		saveSchemaVersion(sqlStore, Version330)
	}
}

func upgradeDatabaseToVersion34(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version330, Version340) {
		saveSchemaVersion(sqlStore, Version340)
	}
}

func upgradeDatabaseToVersion35(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version340, Version350) {
		sqlStore.GetMasterX().Exec("UPDATE TeamMembers SET Roles = 'team_user' WHERE Roles = ''")
		sqlStore.GetMasterX().Exec("UPDATE TeamMembers SET Roles = 'team_user team_admin' WHERE Roles = 'admin'")
		sqlStore.GetMasterX().Exec("UPDATE ChannelMembers SET Roles = 'channel_user' WHERE Roles = ''")
		sqlStore.GetMasterX().Exec("UPDATE ChannelMembers SET Roles = 'channel_user channel_admin' WHERE Roles = 'admin'")

		// The rest of the migration from Filenames -> FileIds is done lazily in api.GetFileInfosForPost
		sqlStore.CreateColumnIfNotExists("Posts", "FileIds", "varchar(150)", "varchar(150)", "[]")

		sqlStore.Session().RemoveAllSessions()

		saveSchemaVersion(sqlStore, Version350)
	}
}

func upgradeDatabaseToVersion36(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version350, Version360) {
		saveSchemaVersion(sqlStore, Version360)
	}
}

func upgradeDatabaseToVersion37(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version360, Version370) {
		saveSchemaVersion(sqlStore, Version370)
	}
}

func upgradeDatabaseToVersion38(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version370, Version380) {
		saveSchemaVersion(sqlStore, Version380)
	}
}

func upgradeDatabaseToVersion39(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version380, Version390) {
		sqlStore.RemoveTableIfExists("PasswordRecovery")

		saveSchemaVersion(sqlStore, Version390)
	}
}

func upgradeDatabaseToVersion310(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version390, Version3100) {
		saveSchemaVersion(sqlStore, Version3100)
	}
}

func upgradeDatabaseToVersion40(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version3100, Version400) {
		saveSchemaVersion(sqlStore, Version400)
	}
}

func upgradeDatabaseToVersion41(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version400, Version410) {
		sqlStore.RemoveTableIfExists("JobStatuses")

		saveSchemaVersion(sqlStore, Version410)
	}
}

func upgradeDatabaseToVersion42(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version410, Version420) {
		saveSchemaVersion(sqlStore, Version420)
	}
}

func upgradeDatabaseToVersion43(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version420, Version430) {
		saveSchemaVersion(sqlStore, Version430)
	}
}

func upgradeDatabaseToVersion44(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version430, Version440) {
		saveSchemaVersion(sqlStore, Version440)
	}
}

func upgradeDatabaseToVersion45(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version440, Version450) {
		saveSchemaVersion(sqlStore, Version450)
	}
}

func upgradeDatabaseToVersion46(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version450, Version460) {
		saveSchemaVersion(sqlStore, Version460)
	}
}

func upgradeDatabaseToVersion47(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version460, Version470) {
		saveSchemaVersion(sqlStore, Version470)
	}
}

func upgradeDatabaseToVersion471(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version470, Version471) {
		saveSchemaVersion(sqlStore, Version471)
	}
}

func upgradeDatabaseToVersion472(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version471, Version472) {
		saveSchemaVersion(sqlStore, Version472)
	}
}

func upgradeDatabaseToVersion48(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version472, Version480) {
		saveSchemaVersion(sqlStore, Version480)
	}
}

func upgradeDatabaseToVersion481(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version480, Version481) {
		saveSchemaVersion(sqlStore, Version481)
	}
}

func upgradeDatabaseToVersion49(sqlStore *SqlStore) {
	// This version of Mattermost includes an App-Layer migration which migrates from hard-coded roles configured by
	// a number of parameters in `config.json` to a `Roles` table in the database. The migration code can be seen
	// in the file `app/app.go` in the function `DoAdvancedPermissionsMigration()`.

	if shouldPerformUpgrade(sqlStore, Version481, Version490) {
		saveSchemaVersion(sqlStore, Version490)
	}
}

func upgradeDatabaseToVersion410(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version490, Version4100) {
		saveSchemaVersion(sqlStore, Version4100)
	}
}

func upgradeDatabaseToVersion50(sqlStore *SqlStore) {
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

	if shouldPerformUpgrade(sqlStore, Version4100, Version500) {
		saveSchemaVersion(sqlStore, Version500)
	}
}

func upgradeDatabaseToVersion51(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version500, Version510) {
		saveSchemaVersion(sqlStore, Version510)
	}
}

func upgradeDatabaseToVersion52(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version510, Version520) {
		saveSchemaVersion(sqlStore, Version520)
	}
}

func upgradeDatabaseToVersion53(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version520, Version530) {
		saveSchemaVersion(sqlStore, Version530)
	}
}

func upgradeDatabaseToVersion54(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version530, Version540) {
		saveSchemaVersion(sqlStore, Version540)
	}
}

func upgradeDatabaseToVersion55(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version540, Version550) {
		saveSchemaVersion(sqlStore, Version550)
	}
}

func upgradeDatabaseToVersion56(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version550, Version560) {
		saveSchemaVersion(sqlStore, Version560)
	}

}

func upgradeDatabaseToVersion57(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version560, Version570) {
		saveSchemaVersion(sqlStore, Version570)
	}
}

func upgradeDatabaseToVersion58(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version570, Version580) {
		saveSchemaVersion(sqlStore, Version580)
	}
}

func upgradeDatabaseToVersion59(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version580, Version590) {
		saveSchemaVersion(sqlStore, Version590)
	}
}

func upgradeDatabaseToVersion510(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version590, Version5100) {
		saveSchemaVersion(sqlStore, Version5100)
	}
}

func upgradeDatabaseToVersion511(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5100, Version5110) {
		// Enforce all teams have an InviteID set
		teams := []*model.Team{}
		if err := sqlStore.GetReplicaX().Select(&teams, "SELECT * FROM Teams WHERE InviteId = ''"); err != nil {
			mlog.Error("Error fetching Teams without InviteID", mlog.Err(err))
		} else {
			for _, team := range teams {
				team.InviteId = model.NewId()
				if _, err := sqlStore.Team().Update(team); err != nil {
					mlog.Error("Error updating Team InviteIDs", mlog.String("team_id", team.Id), mlog.Err(err))
				}
			}
		}

		saveSchemaVersion(sqlStore, Version5110)
	}
}

func upgradeDatabaseToVersion512(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5110, Version5120) {
		saveSchemaVersion(sqlStore, Version5120)
	}
}

func upgradeDatabaseToVersion513(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5120, Version5130) {
		saveSchemaVersion(sqlStore, Version5130)
	}
}

func upgradeDatabaseToVersion514(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5130, Version5140) {
		saveSchemaVersion(sqlStore, Version5140)
	}
}

func upgradeDatabaseToVersion515(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5140, Version5150) {
		saveSchemaVersion(sqlStore, Version5150)
	}
}

func upgradeDatabaseToVersion516(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5150, Version5160) {
		// One known mismatch remains: ChannelMembers.SchemeGuest. The requisite migration
		// is left here for posterity, but we're avoiding fix this given the corresponding
		// table rewrite in most MySQL and Postgres instances.
		// sqlStore.AlterColumnTypeIfExists("ChannelMembers", "SchemeGuest", "tinyint(4)", "boolean")
		saveSchemaVersion(sqlStore, Version5160)
	}
}

func upgradeDatabaseToVersion517(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5160, Version5170) {
		saveSchemaVersion(sqlStore, Version5170)
	}
}

func upgradeDatabaseToVersion518(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5170, Version5180) {
		saveSchemaVersion(sqlStore, Version5180)
	}
}

func upgradeDatabaseToVersion519(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5180, Version5190) {
		saveSchemaVersion(sqlStore, Version5190)
	}
}

func upgradeDatabaseToVersion520(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5190, Version5200) {
		saveSchemaVersion(sqlStore, Version5200)
	}
}

func upgradeDatabaseToVersion521(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5200, Version5210) {
		saveSchemaVersion(sqlStore, Version5210)
	}
}

func upgradeDatabaseToVersion522(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5210, Version5220) {
		saveSchemaVersion(sqlStore, Version5220)
	}
}

func upgradeDatabaseToVersion523(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5220, Version5230) {
		saveSchemaVersion(sqlStore, Version5230)
	}
}

func upgradeDatabaseToVersion524(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5230, Version5240) {
		saveSchemaVersion(sqlStore, Version5240)
	}
}

func upgradeDatabaseToVersion525(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5240, Version5250) {
		saveSchemaVersion(sqlStore, Version5250)
	}
}

func upgradeDatabaseToVersion526(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5250, Version5260) {
		saveSchemaVersion(sqlStore, Version5260)
	}
}

func upgradeDatabaseToVersion527(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5260, Version5270) {
		saveSchemaVersion(sqlStore, Version5270)
	}
}

func upgradeDatabaseToVersion528(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5270, Version5280) {
		if err := precheckMigrationToVersion528(sqlStore); err != nil {
			mlog.Fatal("Error upgrading DB schema to 5.28.0", mlog.Err(err))
		}

		saveSchemaVersion(sqlStore, Version5280)
	}
}

func upgradeDatabaseToVersion5281(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5280, Version5281) {
		saveSchemaVersion(sqlStore, Version5281)
	}
}

func precheckMigrationToVersion528(sqlStore *SqlStore) error {
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

	var schemeIDWrong, typeWrong int
	row := sqlStore.GetMasterX().QueryRow(teamsQuery)
	if err = row.Scan(&schemeIDWrong, &typeWrong); err != nil && err != sql.ErrNoRows {
		return err
	} else if err == nil && schemeIDWrong > 0 {
		return errors.New("Migration failure: " +
			"Teams column SchemeId has data larger that 26 characters")
	} else if err == nil && typeWrong > 0 {
		return errors.New("Migration failure: " +
			"Teams column Type has data larger that 255 characters")
	}

	return nil
}

func upgradeDatabaseToVersion529(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5281, Version5290) {
		saveSchemaVersion(sqlStore, Version5290)
	}
}

func upgradeDatabaseToVersion5291(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5290, Version5291) {
		saveSchemaVersion(sqlStore, Version5291)
	}
}

func upgradeDatabaseToVersion530(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5291, Version5300) {
		saveSchemaVersion(sqlStore, Version5300)
	}
}

func upgradeDatabaseToVersion531(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5300, Version5310) {
		saveSchemaVersion(sqlStore, Version5310)
	}
}

const RemoteClusterSiteURLUniqueIndex = "remote_clusters_site_url_unique"

func upgradeDatabaseToVersion532(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5310, Version5320) {
		saveSchemaVersion(sqlStore, Version5320)
	}
}

func upgradeDatabaseToVersion533(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5320, Version5330) {
		saveSchemaVersion(sqlStore, Version5330)
	}
}

func upgradeDatabaseToVersion534(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5330, Version5340) {
		saveSchemaVersion(sqlStore, Version5340)
	}
}

func upgradeDatabaseToVersion535(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5340, Version5350) {
		saveSchemaVersion(sqlStore, Version5350)
	}
}

func upgradeDatabaseToVersion536(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5350, Version5360) {
		saveSchemaVersion(sqlStore, Version5360)
	}
}

func upgradeDatabaseToVersion537(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5360, Version5370) {
		saveSchemaVersion(sqlStore, Version5370)
	}
}

func upgradeDatabaseToVersion538(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5370, Version5380) {
		saveSchemaVersion(sqlStore, Version5380)
	}
}

func upgradeDatabaseToVersion539(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5380, Version5390) {
		saveSchemaVersion(sqlStore, Version5390)
	}
}

func upgradeDatabaseToVersion600(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version5390, Version600) {
		saveSchemaVersion(sqlStore, Version600)
	}
}

func upgradeDatabaseToVersion610(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version600, Version610) {
		saveSchemaVersion(sqlStore, Version610)
	}
}

func upgradeDatabaseToVersion620(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version610, Version620) {
		saveSchemaVersion(sqlStore, Version620)
	}
}

func upgradeDatabaseToVersion630(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version620, Version630) {
		saveSchemaVersion(sqlStore, Version630)
	}
}

func upgradeDatabaseToVersion640(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, Version630, Version640) {
		saveSchemaVersion(sqlStore, Version640)
	}
}
