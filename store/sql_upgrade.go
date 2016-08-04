// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import ()

func UpgradeDatabase(sqlStore *SqlStore) {

	// check schme to make sure it's from an upgradedable version

	// // If the version is already set then we are potentially in an 'upgrade needed' state
	// if sqlStore.SchemaVersion != "" {
	// 	// Check to see if it's the most current database schema version
	// 	if !model.IsCurrentVersion(sqlStore.SchemaVersion) {
	// 		// If we are upgrading from the previous version then print a warning and continue
	// 		if model.IsPreviousVersionsSupported(sqlStore.SchemaVersion) {
	// 			l4g.Warn(utils.T("store.sql.schema_out_of_date.warn"), sqlStore.SchemaVersion)
	// 			l4g.Warn(utils.T("store.sql.schema_upgrade_attempt.warn"), model.CurrentVersion)
	// 		} else {
	// 			// If this is an 'upgrade needed' state but the user is attempting to skip a version then halt the world
	// 			l4g.Critical(utils.T("store.sql.schema_version.critical"), sqlStore.SchemaVersion)
	// 			time.Sleep(time.Second)
	// 			panic(fmt.Sprintf(utils.T("store.sql.schema_version.critical"), sqlStore.SchemaVersion))
	// 		}
	// 	}
	// }

	// // This is a special case for upgrading the schema to the 3.0 user model
	// // ADDED for 3.0 REMOVE for 3.4
	// if sqlStore.SchemaVersion == "2.2.0" ||
	// 	sqlStore.SchemaVersion == "2.1.0" ||
	// 	sqlStore.SchemaVersion == "2.0.0" {
	// 	l4g.Critical("The database version of %v cannot be automatically upgraded to 3.0 schema", sqlStore.SchemaVersion)
	// 	l4g.Critical("You will need to run the command line tool './platform -upgrade_db_30'")
	// 	l4g.Critical("Please see 'http://www.mattermost.org/upgrade-to-3-0/' for more information on how to upgrade.")
	// 	time.Sleep(time.Second)
	// 	os.Exit(1)
	// }

	UpgradeDatabaseToVersion31(sqlStore)
	UpgradeDatabaseToVersion32(sqlStore)
	UpgradeDatabaseToVersion33(sqlStore)
	UpgradeDatabaseToVersion34(sqlStore)

	// if model.IsPreviousVersionsSupported(sqlStore.SchemaVersion) && !model.IsCurrentVersion(sqlStore.SchemaVersion) {
	// 	sqlStore.system.Update(&model.System{Name: "Version", Value: model.CurrentVersion})
	// 	sqlStore.SchemaVersion = model.CurrentVersion
	// 	l4g.Warn(utils.T("store.sql.upgraded.warn"), model.CurrentVersion)
	// }

	// if sqlStore.SchemaVersion == "" {
	// 	sqlStore.system.Save(&model.System{Name: "Version", Value: model.CurrentVersion})
	// 	sqlStore.SchemaVersion = model.CurrentVersion
	// 	l4g.Info(utils.T("store.sql.schema_set.info"), model.CurrentVersion)
	// }
}

func UpgradeDatabaseToVersion31(sqlStore *SqlStore) {
	if sqlStore.SchemaVersion == "3.0.0" {
		// println info about upgrading

		// attempt to do upgrade

		// println info about upgrade completed

		// update SchemaVersion to next version
	}
}

func UpgradeDatabaseToVersion32(sqlStore *SqlStore) {
}

func UpgradeDatabaseToVersion33(sqlStore *SqlStore) {
}

func UpgradeDatabaseToVersion34(sqlStore *SqlStore) {
}
