// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import "github.com/mattermost/platform/utils"

var store Store

func Setup() {
	if store == nil {
		utils.TranslationsPreInit()
		utils.LoadConfig("config.json")
		utils.InitTranslations(utils.Cfg.LocalizationSettings)
		store = NewLayeredStore()

		store.MarkSystemRanUnitTests()
	}
}

/*
func TestSqlStore1(t *testing.T) {
	utils.TranslationsPreInit()
	utils.LoadConfig("config.json")
	utils.Cfg.SqlSettings.Trace = true

	store := NewSqlStore()
	store.Close()

	utils.Cfg.SqlSettings.DataSourceReplicas = []string{utils.Cfg.SqlSettings.DataSource}

	store = NewSqlStore()
	store.TotalMasterDbConnections()
	store.TotalReadDbConnections()
	store.Close()

	utils.LoadConfig("config.json")
}

func TestAlertDbCmds(t *testing.T) {
	Setup()

	sqlStore := store.(SqlStore)

	if !sqlStore.DoesTableExist("Systems") {
		t.Fatal("Failed table exists")
	}

	if sqlStore.DoesColumnExist("Systems", "Test") {
		t.Fatal("Column should not exist")
	}

	if !sqlStore.CreateColumnIfNotExists("Systems", "Test", "VARCHAR(50)", "VARCHAR(50)", "") {
		t.Fatal("Failed to create column")
	}

	maxLen := sqlStore.GetMaxLengthOfColumnIfExists("Systems", "Test")

	if maxLen != "50" {
		t.Fatal("Failed to get max length found " + maxLen)
	}

	if !sqlStore.AlterColumnTypeIfExists("Systems", "Test", "VARCHAR(25)", "VARCHAR(25)") {
		t.Fatal("failed to alter column size")
	}

	maxLen2 := sqlStore.GetMaxLengthOfColumnIfExists("Systems", "Test")

	if maxLen2 != "25" {
		t.Fatal("Failed to get max length")
	}

	if !sqlStore.RenameColumnIfExists("Systems", "Test", "Test1", "VARCHAR(25)") {
		t.Fatal("Failed to rename column")
	}

	if sqlStore.DoesColumnExist("Systems", "Test") {
		t.Fatal("Column should not exist")
	}

	if !sqlStore.DoesColumnExist("Systems", "Test1") {
		t.Fatal("Column should exist")
	}

	sqlStore.CreateIndexIfNotExists("idx_systems_test1", "Systems", "Test1")
	sqlStore.RemoveIndexIfExists("idx_systems_test1", "Systems")

	sqlStore.CreateFullTextIndexIfNotExists("idx_systems_test1", "Systems", "Test1")
	sqlStore.RemoveIndexIfExists("idx_systems_test1", "Systems")

	if !sqlStore.RemoveColumnIfExists("Systems", "Test1") {
		t.Fatal("Failed to remove columns")
	}

	if sqlStore.DoesColumnExist("Systems", "Test1") {
		t.Fatal("Column should not exist")
	}
}

func TestCreateIndexIfNotExists(t *testing.T) {
	Setup()

	sqlStore := store.(SqlStore)

	defer sqlStore.RemoveColumnIfExists("Systems", "Test")
	if !sqlStore.CreateColumnIfNotExists("Systems", "Test", "VARCHAR(50)", "VARCHAR(50)", "") {
		t.Fatal("Failed to create test column")
	}

	defer sqlStore.RemoveIndexIfExists("idx_systems_create_index_test", "Systems")
	if !sqlStore.CreateIndexIfNotExists("idx_systems_create_index_test", "Systems", "Test") {
		t.Fatal("Should've created test index")
	}

	if sqlStore.CreateIndexIfNotExists("idx_systems_create_index_test", "Systems", "Test") {
		t.Fatal("Shouldn't have created index that already exists")
	}
}

func TestRemoveIndexIfExists(t *testing.T) {
	Setup()

	sqlStore := store.(SqlStore)

	defer sqlStore.RemoveColumnIfExists("Systems", "Test")
	if !sqlStore.CreateColumnIfNotExists("Systems", "Test", "VARCHAR(50)", "VARCHAR(50)", "") {
		t.Fatal("Failed to create test column")
	}

	if sqlStore.RemoveIndexIfExists("idx_systems_remove_index_test", "Systems") {
		t.Fatal("Should've failed to remove index that doesn't exist")
	}

	defer sqlStore.RemoveIndexIfExists("idx_systems_remove_index_test", "Systems")
	if !sqlStore.CreateIndexIfNotExists("idx_systems_remove_index_test", "Systems", "Test") {
		t.Fatal("Should've created test index")
	}

	if !sqlStore.RemoveIndexIfExists("idx_systems_remove_index_test", "Systems") {
		t.Fatal("Should've removed index that exists")
	}

	if sqlStore.RemoveIndexIfExists("idx_systems_remove_index_test", "Systems") {
		t.Fatal("Should've failed to remove index that was already removed")
	}
}
*/
