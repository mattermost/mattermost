// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package migrations

import (
	"flag"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

func TestMain(m *testing.M) {
	flag.Parse()

	// Setup a global logger to catch tests logging outside of app context
	// The global logger will be stomped by apps initalizing but that's fine for testing. Ideally this won't happen.
	mlog.InitGlobalLogger(mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	}))

	utils.TranslationsPreInit()

	// In the case where a dev just wants to run a single test, it's faster to just use the default
	// store.
	if filter := flag.Lookup("test.run").Value.String(); filter != "" && filter != "." {
		mlog.Info("-test.run used, not creating temporary containers")
		os.Exit(m.Run())
	}

	status := 0

	container, settings, err := storetest.NewMySQLContainer()
	if err != nil {
		panic(err)
	}

	UseTestStore(container, settings)

	defer func() {
		StopTestStore()
		os.Exit(status)
	}()

	status = m.Run()
}

func TestGetMigrationState(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	migrationKey := model.NewId()

	th.DeleteAllJobsByTypeAndMigrationKey(model.JOB_TYPE_MIGRATIONS, migrationKey)

	// Test with no job yet.
	state, job, err := GetMigrationState(migrationKey, th.App.Srv.Store)
	assert.Nil(t, err)
	assert.Nil(t, job)
	assert.Equal(t, "unscheduled", state)

	// Test with the system table showing the migration as done.
	system := model.System{
		Name:  migrationKey,
		Value: "true",
	}
	res1 := <-th.App.Srv.Store.System().Save(&system)
	assert.Nil(t, res1.Err)

	state, job, err = GetMigrationState(migrationKey, th.App.Srv.Store)
	assert.Nil(t, err)
	assert.Nil(t, job)
	assert.Equal(t, "completed", state)

	res2 := <-th.App.Srv.Store.System().PermanentDeleteByName(migrationKey)
	assert.Nil(t, res2.Err)

	// Test with a job scheduled in "pending" state.
	j1 := &model.Job{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Data: map[string]string{
			JOB_DATA_KEY_MIGRATION: migrationKey,
		},
		Status: model.JOB_STATUS_PENDING,
		Type:   model.JOB_TYPE_MIGRATIONS,
	}

	j1 = (<-th.App.Srv.Store.Job().Save(j1)).Data.(*model.Job)

	state, job, err = GetMigrationState(migrationKey, th.App.Srv.Store)
	assert.Nil(t, err)
	assert.Equal(t, j1.Id, job.Id)
	assert.Equal(t, "in_progress", state)

	// Test with a job scheduled in "in progress" state.
	j2 := &model.Job{
		Id:       model.NewId(),
		CreateAt: j1.CreateAt + 1,
		Data: map[string]string{
			JOB_DATA_KEY_MIGRATION: migrationKey,
		},
		Status: model.JOB_STATUS_IN_PROGRESS,
		Type:   model.JOB_TYPE_MIGRATIONS,
	}

	j2 = (<-th.App.Srv.Store.Job().Save(j2)).Data.(*model.Job)

	state, job, err = GetMigrationState(migrationKey, th.App.Srv.Store)
	assert.Nil(t, err)
	assert.Equal(t, j2.Id, job.Id)
	assert.Equal(t, "in_progress", state)

	// Test with a job scheduled in "error" state.
	j3 := &model.Job{
		Id:       model.NewId(),
		CreateAt: j2.CreateAt + 1,
		Data: map[string]string{
			JOB_DATA_KEY_MIGRATION: migrationKey,
		},
		Status: model.JOB_STATUS_ERROR,
		Type:   model.JOB_TYPE_MIGRATIONS,
	}

	j3 = (<-th.App.Srv.Store.Job().Save(j3)).Data.(*model.Job)

	state, job, err = GetMigrationState(migrationKey, th.App.Srv.Store)
	assert.Nil(t, err)
	assert.Equal(t, j3.Id, job.Id)
	assert.Equal(t, "unscheduled", state)
}
