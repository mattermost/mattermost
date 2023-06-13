// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/morph"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type MigrationMapping struct {
	Name                 string
	LegacyMigrationIndex int
	MorphMigrationLimit  int
}

var migrationsMapping = []MigrationMapping{
	{
		Name:                 "0.0.0 > 0.0.1",
		LegacyMigrationIndex: 0,
		MorphMigrationLimit:  4, // 000001 <> 000004
	},
	{
		Name:                 "0.2.0 > 0.3.0",
		LegacyMigrationIndex: 2,
		MorphMigrationLimit:  1, // 000005
	},
	{
		Name:                 "0.3.0 > 0.4.0",
		LegacyMigrationIndex: 3,
		MorphMigrationLimit:  4, // 000006 <> 000009
	},
	{
		Name:                 "0.4.0 > 0.5.0",
		LegacyMigrationIndex: 4,
		MorphMigrationLimit:  4, // 000010 <> 000013
	},
	{
		Name:                 "0.5.0 > 0.6.0",
		LegacyMigrationIndex: 5,
		MorphMigrationLimit:  2, // 000014 <> 000015
	},
	{
		Name:                 "0.6.0 > 0.7.0",
		LegacyMigrationIndex: 6,
		MorphMigrationLimit:  1, // 000016
	},
	{
		Name:                 "0.7.0 > 0.8.0",
		LegacyMigrationIndex: 7,
		MorphMigrationLimit:  1, // 000017
	},
	{
		Name:                 "0.8.0 > 0.9.0",
		LegacyMigrationIndex: 8,
		MorphMigrationLimit:  3, // 000018 <> 000020
	},
	{
		Name:                 "0.9.0 > 0.10.0",
		LegacyMigrationIndex: 9,
		MorphMigrationLimit:  3, // 000021 <> 000023
	},
	{
		Name:                 "0.11.0 > 0.12.0",
		LegacyMigrationIndex: 11,
		MorphMigrationLimit:  4, // 000024 <> 000027
	},
	{
		Name:                 "0.12.0 > 0.13.0",
		LegacyMigrationIndex: 12,
		MorphMigrationLimit:  3, // 000028 <> 000030
	},

	{
		Name:                 "0.13.0 > 0.14.0",
		LegacyMigrationIndex: 13,
		MorphMigrationLimit:  2, // 000031 <> 000032
	},
	{
		Name:                 "0.14.0 > 0.15.0",
		LegacyMigrationIndex: 14,
		MorphMigrationLimit:  1, // 000033
	},
	{
		Name:                 "0.15.0 > 0.16.0",
		LegacyMigrationIndex: 15,
		MorphMigrationLimit:  4, // 000034-000037
	},
	{
		Name:                 "0.16.0 > 0.17.0",
		LegacyMigrationIndex: 16,
		MorphMigrationLimit:  1, // 000038
	},
	{
		Name:                 "0.17.0 > 0.18.0",
		LegacyMigrationIndex: 17,
		MorphMigrationLimit:  3, // 000039-000041
	},
	{
		Name:                 "0.18.0 > 0.19.0",
		LegacyMigrationIndex: 18,
		MorphMigrationLimit:  1, // 000042
	},
	{
		Name:                 "0.19.0 > 0.20.0",
		LegacyMigrationIndex: 19,
		MorphMigrationLimit:  3, // 000043-00045
	},
	{
		Name:                 "0.20.0 > 0.21.0",
		LegacyMigrationIndex: 20,
		MorphMigrationLimit:  3, // 000046-00048
	},
	{
		Name:                 "0.21.0 > 0.22.0",
		LegacyMigrationIndex: 21,
		MorphMigrationLimit:  1, // 000049
	},
	{
		Name:                 "0.22.0 > 0.23.0",
		LegacyMigrationIndex: 22,
		MorphMigrationLimit:  2, // 000050-000051
	},
	{
		Name:                 "0.23.0 > 0.24.0",
		LegacyMigrationIndex: 23,
		MorphMigrationLimit:  2, // 000052-000053
	},
	{
		Name:                 "0.24.0 > 0.25.0",
		LegacyMigrationIndex: 24,
		MorphMigrationLimit:  4, // 000054-000057
	},
	{
		Name:                 "0.25.0 > 0.26.0",
		LegacyMigrationIndex: 25,
		MorphMigrationLimit:  2, // 000058-000059
	},
	{
		Name:                 "0.26.0 > 0.27.0",
		LegacyMigrationIndex: 26,
		MorphMigrationLimit:  2, // 000060-000061
	},
	{
		Name:                 "0.27.0 > 0.28.0",
		LegacyMigrationIndex: 27,
		MorphMigrationLimit:  1, // 000062
	},
	{
		Name:                 "0.28.0 > 0.29.0",
		LegacyMigrationIndex: 28,
		MorphMigrationLimit:  1, // 000063
	},
	{
		Name:                 "0.29.0 > 0.30.0",
		LegacyMigrationIndex: 29,
		MorphMigrationLimit:  6, // 000064-000069
	},
	{
		Name:                 "0.30.0 > 0.31.0",
		LegacyMigrationIndex: 30,
		MorphMigrationLimit:  1, // 000070
	},
	{
		Name:                 "0.31.0 > 0.32.0",
		LegacyMigrationIndex: 31,
		MorphMigrationLimit:  1, // 000071
	},
	{
		Name:                 "0.32.0 > 0.33.0",
		LegacyMigrationIndex: 32,
		MorphMigrationLimit:  4, // 000072-000075
	},
	{
		Name:                 "0.33.0 > 0.34.0",
		LegacyMigrationIndex: 33,
		MorphMigrationLimit:  1, // 000076
	},
	{
		Name:                 "0.34.0 > 0.35.0",
		LegacyMigrationIndex: 34,
		MorphMigrationLimit:  1, // 000077
	},
	{
		Name:                 "0.35.0 > 0.36.0",
		LegacyMigrationIndex: 35,
		MorphMigrationLimit:  2, // 000078-000079
	},
}

func TestDBSchema(t *testing.T) {
	driverName := getDriverName()
	tableInfoList, indexInfoList, constraintInfo := dbInfoAfterEachLegacyMigration(t, driverName, migrationsMapping)

	// create database for morph migration
	db := setupTestDB(t)
	store := setupTables(t, db)

	engine, err := store.createMorphEngine()
	require.NoError(t, err)
	defer engine.Close()

	for i, migration := range migrationsMapping {
		t.Run(fmt.Sprintf("validate migration up: %s", migration.Name), func(t *testing.T) {
			runMigrationUp(t, store, engine, migration.MorphMigrationLimit)
			// compare table schemas
			dbSchemaMorph, err := getDBSchemaInfo(store)
			require.NoError(t, err)
			// this way it's easier to find out why test fails
			for j := range dbSchemaMorph {
				require.Equal(t, tableInfoList[i+1][j], dbSchemaMorph[j], driverName)
			}

			// compare indexes
			dbIndexesMorph, err := getDBIndexesInfo(store)
			require.NoError(t, err)
			require.Equal(t, indexInfoList[i+1], dbIndexesMorph, driverName)

			// compare constraints
			dbConstraintsMorph, err := getDBConstraintsInfo(store)
			require.NoError(t, err)
			require.Equal(t, constraintInfo[i+1], dbConstraintsMorph, driverName)
		})
	}

	for i := range migrationsMapping {
		migrationIndex := len(migrationsMapping) - i - 1
		migration := migrationsMapping[migrationIndex]
		t.Run(fmt.Sprintf("validate migration down: %s", migration.Name), func(t *testing.T) {
			runMigrationDown(t, store, engine, migration.MorphMigrationLimit)
			// compare table schemas
			dbSchemaMorph, err := getDBSchemaInfo(store)
			require.NoError(t, err)

			// this way it's easier to find out why test fails
			for j := range dbSchemaMorph {
				require.Equal(t, tableInfoList[migrationIndex][j], dbSchemaMorph[j], driverName)
			}

			// compare indexes
			dbIndexesMorph, err := getDBIndexesInfo(store)
			require.NoError(t, err)
			require.Equal(t, indexInfoList[migrationIndex], dbIndexesMorph, driverName)

			// compare constraints
			dbConstraintsMorph, err := getDBConstraintsInfo(store)
			require.NoError(t, err)
			require.Equal(t, constraintInfo[migrationIndex], dbConstraintsMorph, driverName)
		})
	}
}

func TestMigration_000005(t *testing.T) {
	testData := []struct {
		Name          string
		ActiveStage   int
		ChecklistJSON string
	}{
		{
			Name:          "0",
			ActiveStage:   0,
			ChecklistJSON: "{][",
		},
		{
			Name:          "1",
			ActiveStage:   0,
			ChecklistJSON: "{}",
		},
		{
			Name:          "2",
			ActiveStage:   0,
			ChecklistJSON: "\"key\"",
		},
		{
			Name:          "3",
			ActiveStage:   -1,
			ChecklistJSON: "[]",
		},
		{
			Name:          "4",
			ActiveStage:   0,
			ChecklistJSON: "",
		},
		{
			Name:          "5",
			ActiveStage:   1,
			ChecklistJSON: `[{"title":"title50"}, {"title":"title51"}, {"title":"title52"}]`,
		},
		{
			Name:          "6",
			ActiveStage:   3,
			ChecklistJSON: `[{"title":"title60"}, {"title":"title61"}, {"title":"title62"}]`,
		},
		{
			Name:          "7",
			ActiveStage:   2,
			ChecklistJSON: `[{"title":"title70"}, {"title":"title71"}, {"title":"title72"}]`,
		},
	}

	insertData := func(store *SQLStore) int {
		numRuns := 0
		for _, d := range testData {
			err := InsertRun(store, NewRunMapBuilder().
				WithName(d.Name).
				WithActiveStage(d.ActiveStage).
				WithChecklists(d.ChecklistJSON).ToRunAsMap())
			if err == nil {
				numRuns++
			}
		}

		return numRuns
	}

	type Run struct {
		ID               string
		Name             string
		ChecklistsJSON   string
		ActiveStage      int
		ActiveStageTitle string
	}

	validateAfter := func(t *testing.T, store *SQLStore, numRuns int) {
		var runs []Run
		err := store.selectBuilder(store.db, &runs, store.builder.
			Select("ID", "Name", "ChecklistsJSON", "ActiveStage", "ActiveStageTitle").
			From("IR_Incident"))

		require.NoError(t, err)
		require.Len(t, runs, numRuns)
		expectedStageTitles := map[string]string{
			"5": "title51",
			"7": "title72",
		}
		for _, r := range runs {
			require.Equal(t, expectedStageTitles[r.Name], r.ActiveStageTitle)
		}
	}

	validateBefore := func(t *testing.T, store *SQLStore, numRuns int) {
		activeStageTitleExist, err := columnExists(store, "IR_Incident", "ActiveStageTitle")
		require.NoError(t, err)
		require.False(t, activeStageTitleExist)
	}

	t.Run("run migration up", func(t *testing.T) {
		db := setupTestDB(t)
		store := setupTables(t, db)
		engine, err := store.createMorphEngine()
		require.NoError(t, err)
		defer engine.Close()

		runMigrationUp(t, store, engine, 4)
		numRuns := insertData(store)
		runMigrationUp(t, store, engine, 1)
		validateAfter(t, store, numRuns)
	})

	t.Run("run migration down", func(t *testing.T) {
		db := setupTestDB(t)
		store := setupTables(t, db)
		engine, err := store.createMorphEngine()
		require.NoError(t, err)
		defer engine.Close()

		runMigrationUp(t, store, engine, 4)
		numRuns := insertData(store)
		runMigrationUp(t, store, engine, 1)
		validateAfter(t, store, numRuns)
		runMigrationDown(t, store, engine, 1)
		validateBefore(t, store, numRuns)
	})
}

func TestMigration_000014(t *testing.T) {
	insertData := func(t *testing.T, store *SQLStore) {
		err := InsertRun(store, NewRunMapBuilder().WithName("0").ToRunAsMap())
		require.NoError(t, err)
		err = InsertRun(store, NewRunMapBuilder().WithName("1").WithEndAt(100000000000).ToRunAsMap())
		require.NoError(t, err)
		err = InsertRun(store, NewRunMapBuilder().WithName("2").WithEndAt(0).ToRunAsMap())
		require.NoError(t, err)
		err = InsertRun(store, NewRunMapBuilder().WithName("3").WithEndAt(123861298332).ToRunAsMap())
		require.NoError(t, err)
	}

	type Run struct {
		Name          string
		CurrentStatus string
		EndAt         int64
	}

	validateAfter := func(t *testing.T, store *SQLStore) {
		var runs []Run
		err := store.selectBuilder(store.db, &runs, store.builder.
			Select("Name", "CurrentStatus", "EndAt").
			From("IR_Incident"))

		require.NoError(t, err)
		require.Len(t, runs, 4)

		runsStatuses := map[string]string{
			"0": "Active",
			"2": "Active",
			"1": "Resolved",
			"3": "Resolved",
		}
		for _, r := range runs {
			require.Equal(t, runsStatuses[r.Name], r.CurrentStatus)
		}
	}

	t.Run("run migration up", func(t *testing.T) {
		db := setupTestDB(t)
		store := setupTables(t, db)
		engine, err := store.createMorphEngine()
		require.NoError(t, err)
		defer engine.Close()

		runMigrationUp(t, store, engine, 13)
		insertData(t, store)
		runMigrationUp(t, store, engine, 1)
		validateAfter(t, store)
	})
}

func TestMigration_000049(t *testing.T) {
	numRuns := 5
	numPosts := 10

	getPostCreatedAtByIndex := func(i int) int64 { return int64(100000000 + i*100) }

	db := setupTestDB(t)
	store := setupTables(t, db)
	engine, err := store.createMorphEngine()
	require.NoError(t, err)
	defer engine.Close()

	runMigrationUp(t, store, engine, 48)

	// insert test data
	runsIDs := []string{}
	postsIDs := []string{}
	for i := 0; i < numRuns; i++ {
		run := NewRunMapBuilder().WithName(fmt.Sprintf("run %d", i)).ToRunAsMap()
		err = InsertRun(store, run)
		require.NoError(t, err)
		runsIDs = append(runsIDs, run["ID"].(string))
	}

	for i := 0; i < numPosts; i++ {
		postsIDs = append(postsIDs, model.NewId())
		err = InsertPost(store, postsIDs[i], getPostCreatedAtByIndex(i))
		require.NoError(t, err)
	}

	_ = InsertStatusPost(store, runsIDs[0], postsIDs[2])
	_ = InsertStatusPost(store, runsIDs[0], postsIDs[3])
	_ = InsertStatusPost(store, runsIDs[0], postsIDs[0])
	_ = InsertStatusPost(store, runsIDs[0], postsIDs[1])

	_ = InsertStatusPost(store, runsIDs[1], postsIDs[4])
	_ = InsertStatusPost(store, runsIDs[1], postsIDs[5])

	_ = InsertStatusPost(store, runsIDs[2], postsIDs[7])
	_ = InsertStatusPost(store, runsIDs[2], postsIDs[6])

	runMigrationUp(t, store, engine, 1)

	// validate migration
	type Run struct {
		ID                 string
		Name               string
		CreateAt           int64
		LastStatusUpdateAt int64
	}

	var runs []Run
	err = store.selectBuilder(store.db, &runs, store.builder.
		Select("ID", "Name", "CreateAt", "LastStatusUpdateAt").
		From("IR_Incident").
		OrderBy("Name ASC"))

	require.NoError(t, err)
	require.Len(t, runs, numRuns)

	require.Equal(t, getPostCreatedAtByIndex(3), runs[0].LastStatusUpdateAt)
	require.Equal(t, getPostCreatedAtByIndex(5), runs[1].LastStatusUpdateAt)
	require.Equal(t, getPostCreatedAtByIndex(7), runs[2].LastStatusUpdateAt)
	require.Equal(t, runs[3].CreateAt, runs[3].LastStatusUpdateAt)
	require.Equal(t, runs[4].CreateAt, runs[4].LastStatusUpdateAt)
}

func TestMigration_000058(t *testing.T) {
	db := setupTestDB(t)
	store := setupTables(t, db)
	engine, err := store.createMorphEngine()
	require.NoError(t, err)
	defer engine.Close()

	runMigrationUp(t, store, engine, 57)

	// insert test data
	_ = InsertPlaybook(store, NewPBMapBuilder().WithTitle("pb0").WithCategorizeChannelEnabled(true).ToRunAsMap())
	_ = InsertPlaybook(store, NewPBMapBuilder().WithTitle("pb1").WithCategorizeChannelEnabled(false).ToRunAsMap())
	_ = InsertPlaybook(store, NewPBMapBuilder().WithTitle("pb2").ToRunAsMap())

	runMigrationUp(t, store, engine, 1)

	// validate migration
	type Playbook struct {
		ID                       string
		Title                    string
		CategorizeChannelEnabled bool
		CategoryName             *string
	}

	var playbooks []Playbook
	err = store.selectBuilder(store.db, &playbooks, store.builder.
		Select("ID", "Title", "CategorizeChannelEnabled", "CategoryName").
		From("IR_Playbook").
		OrderBy("Title ASC"))

	require.NoError(t, err)
	require.Len(t, playbooks, 3)
	require.True(t, playbooks[0].CategorizeChannelEnabled)
	require.False(t, playbooks[1].CategorizeChannelEnabled)
	require.False(t, playbooks[2].CategorizeChannelEnabled)
	require.Equal(t, "Playbook Runs", *playbooks[0].CategoryName)
	require.True(t, playbooks[1].CategoryName == nil || *playbooks[1].CategoryName == "")
	require.True(t, playbooks[2].CategoryName == nil || *playbooks[2].CategoryName == "")
}

func TestMigration_000059(t *testing.T) {
	db := setupTestDB(t)
	store := setupTables(t, db)
	engine, err := store.createMorphEngine()
	require.NoError(t, err)
	defer engine.Close()

	runMigrationUp(t, store, engine, 58)

	// insert test data
	_ = InsertRun(store, NewRunMapBuilder().WithName("run0").WithCategorizeChannelEnabled(true).ToRunAsMap())
	_ = InsertRun(store, NewRunMapBuilder().WithName("run1").WithCategorizeChannelEnabled(false).ToRunAsMap())
	_ = InsertRun(store, NewRunMapBuilder().WithName("run2").ToRunAsMap())

	runMigrationUp(t, store, engine, 1)

	// validate migration
	type Run struct {
		ID                       string
		Name                     string
		CategorizeChannelEnabled bool
		CategoryName             *string
	}

	var runs []Run
	err = store.selectBuilder(store.db, &runs, store.builder.
		Select("ID", "Name", "CategorizeChannelEnabled", "CategoryName").
		From("IR_Incident").
		OrderBy("Name ASC"))

	require.NoError(t, err)
	require.Len(t, runs, 3)
	require.True(t, runs[0].CategorizeChannelEnabled)
	require.False(t, runs[1].CategorizeChannelEnabled)
	require.False(t, runs[2].CategorizeChannelEnabled)
	require.Equal(t, "Playbook Runs", *runs[0].CategoryName)
	require.True(t, runs[1].CategoryName == nil || *runs[1].CategoryName == "")
	require.True(t, runs[2].CategoryName == nil || *runs[2].CategoryName == "")
}

func TestMigration_000063(t *testing.T) {
	driverName := getDriverName()
	if driverName != model.DatabaseDriverMysql {
		t.Skip("TestMigration_000063 is for MySQL only")
	}

	encodingQuery := `
		SELECT TABLE_COLLATION FROM information_schema.TABLES
		WHERE table_name = 'IR_System'
		AND table_schema = DATABASE();
	`

	// run legacy migrations and get IR_System table encoding
	db := setupTestDB(t)
	store := setupTables(t, db)

	for i := 0; i <= 28; i++ {
		runLegacyMigration(t, store, 0)
	}
	var encodingExpected []string
	err := store.db.Select(&encodingExpected, encodingQuery)
	require.NoError(t, err)

	// run morph migrations on new db and get IR_System table encoding
	db = setupTestDB(t)
	store = setupTables(t, db)
	engine, err := store.createMorphEngine()
	require.NoError(t, err)
	defer engine.Close()

	runMigrationUp(t, store, engine, 63)
	var encodingActual []string
	err = store.db.Select(&encodingActual, encodingQuery)
	require.NoError(t, err)
	require.Equal(t, encodingExpected, encodingActual)
}

func TestMigration_000070(t *testing.T) {
	db := setupTestDB(t)
	store := setupTables(t, db)
	engine, err := store.createMorphEngine()
	require.NoError(t, err)
	defer engine.Close()

	runMigrationUp(t, store, engine, 69)

	// insert test data
	rows := [][]string{{"1", "com.mattermost.plugin-incident-management"}, {"1", "playbooks"}, {"2", "com.mattermost.plugin-incident-management"}, {"3", "playbooks"}}
	for i := range rows {
		_, err = store.execBuilder(store.db, sq.
			Insert("PluginKeyValueStore").
			SetMap(
				map[string]interface{}{
					"PKey":     rows[i][0],
					"PluginId": rows[i][1],
				},
			))
		require.NoError(t, err)
	}

	runMigrationUp(t, store, engine, 1)

	// validate migration
	type Data struct {
		PKey     string
		PluginID string
	}

	var res []Data
	err = store.selectBuilder(store.db, &res, store.builder.
		Select("PKey", "PluginId as PluginID").
		From("PluginKeyValueStore").
		OrderBy("PKey ASC").
		OrderBy("PluginId ASC"))

	require.NoError(t, err)
	require.Len(t, res, 4)
	require.Equal(t, "com.mattermost.plugin-incident-management", res[0].PluginID)
	require.Equal(t, "playbooks", res[1].PluginID)
	require.Equal(t, "playbooks", res[2].PluginID)
	require.Equal(t, "playbooks", res[3].PluginID)

	// roll back migration
	runMigrationDown(t, store, engine, 1)
	res = nil
	err = store.selectBuilder(store.db, &res, store.builder.
		Select("PKey", "PluginId as PluginID").
		From("PluginKeyValueStore").
		OrderBy("PKey ASC").
		OrderBy("PluginId ASC"))

	require.NoError(t, err)
	require.Len(t, res, 4)
	require.Equal(t, "com.mattermost.plugin-incident-management", res[0].PluginID)
	require.Equal(t, "playbooks", res[1].PluginID)
	require.Equal(t, "com.mattermost.plugin-incident-management", res[2].PluginID)
	require.Equal(t, "com.mattermost.plugin-incident-management", res[3].PluginID)
}

func runMigrationUp(t *testing.T, store *SQLStore, engine *morph.Morph, limit int) {
	applied, err := engine.Apply(limit)
	require.NoError(t, err)
	require.Equal(t, applied, limit)
}

func runMigrationDown(t *testing.T, store *SQLStore, engine *morph.Morph, limit int) {
	applied, err := engine.ApplyDown(limit)
	require.NoError(t, err)
	require.Equal(t, applied, limit)
}

func runLegacyMigration(t *testing.T, store *SQLStore, index int) {
	err := store.migrate(migrations[index])
	require.NoError(t, err)
}

// dbInfoAfterEachLegacyMigration runs legacy migrations, extracts database schema, indexes and constraints info after each migration
// and returns the list. The first and last elements in the list describe DB before and after running all migrations.
func dbInfoAfterEachLegacyMigration(t *testing.T, driverName string, migrationsToRun []MigrationMapping) ([][]TableInfo, [][]IndexInfo, [][]ConstraintsInfo) {
	// create database for legacy migration
	db := setupTestDB(t)
	store := setupTables(t, db)

	schemaInfo := make([][]TableInfo, len(migrationsToRun)+1)
	indexInfo := make([][]IndexInfo, len(migrationsToRun)+1)
	constraintInfo := make([][]ConstraintsInfo, len(migrationsToRun)+1)

	schema, err := getDBSchemaInfo(store)
	require.NoError(t, err)
	schemaInfo[0] = schema

	indexes, err := getDBIndexesInfo(store)
	require.NoError(t, err)
	indexInfo[0] = indexes

	constraints, err := getDBConstraintsInfo(store)
	require.NoError(t, err)
	constraintInfo[0] = constraints

	for i, mm := range migrationsToRun {
		runLegacyMigration(t, store, mm.LegacyMigrationIndex)

		schema, err = getDBSchemaInfo(store)
		require.NoError(t, err)
		schemaInfo[i+1] = schema

		indexes, err = getDBIndexesInfo(store)
		require.NoError(t, err)
		indexInfo[i+1] = indexes

		constraints, err = getDBConstraintsInfo(store)
		require.NoError(t, err)
		constraintInfo[i+1] = constraints
	}

	return schemaInfo, indexInfo, constraintInfo
}

type RunMapBuilder struct {
	runAsMap map[string]interface{}
}

func NewRunMapBuilder() *RunMapBuilder {
	return &RunMapBuilder{
		runAsMap: map[string]interface{}{
			"ID":              model.NewId(),
			"CreateAt":        model.GetMillis(),
			"Description":     "test description",
			"Name":            fmt.Sprintf("run- %v", model.GetMillis()),
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "[]",
		},
	}
}

func (b *RunMapBuilder) WithName(name string) *RunMapBuilder {
	b.runAsMap["Name"] = name
	return b
}

func (b *RunMapBuilder) WithActiveStage(activeStage int) *RunMapBuilder {
	b.runAsMap["ActiveStage"] = activeStage
	return b
}

func (b *RunMapBuilder) WithChecklists(checklistJSON string) *RunMapBuilder {
	b.runAsMap["ChecklistsJSON"] = checklistJSON
	return b
}

func (b *RunMapBuilder) WithEndAt(endAt int64) *RunMapBuilder {
	b.runAsMap["EndAt"] = endAt
	return b
}

func (b *RunMapBuilder) WithCategorizeChannelEnabled(enabled bool) *RunMapBuilder {
	b.runAsMap["CategorizeChannelEnabled"] = enabled
	return b
}

func (b *RunMapBuilder) ToRunAsMap() map[string]interface{} {
	return b.runAsMap
}

type PlaybookMapBuilder struct {
	playbookAsMap map[string]interface{}
}

func NewPBMapBuilder() *PlaybookMapBuilder {
	timeNow := model.GetMillis()
	return &PlaybookMapBuilder{
		playbookAsMap: map[string]interface{}{
			"ID":                                   model.NewId(),
			"Title":                                "base playbook",
			"Description":                          "",
			"TeamID":                               model.NewId(),
			"CreatePublicIncident":                 false,
			"CreateAt":                             model.GetMillis(),
			"UpdateAt":                             timeNow,
			"DeleteAt":                             0,
			"ChecklistsJSON":                       "{}",
			"NumStages":                            0,
			"NumSteps":                             0,
			"ReminderTimerDefaultSeconds":          0,
			"RetrospectiveReminderIntervalSeconds": 0,
			"ExportChannelOnFinishedEnabled":       false,
		},
	}
}

func (pb *PlaybookMapBuilder) WithCategorizeChannelEnabled(enabled bool) *PlaybookMapBuilder {
	pb.playbookAsMap["CategorizeChannelEnabled"] = enabled
	return pb
}

func (pb *PlaybookMapBuilder) WithTitle(name string) *PlaybookMapBuilder {
	pb.playbookAsMap["Title"] = name
	return pb
}

func (pb *PlaybookMapBuilder) ToRunAsMap() map[string]interface{} {
	return pb.playbookAsMap
}
