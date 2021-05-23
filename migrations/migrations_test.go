// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestGetMigrationState(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	th := Setup()
	defer th.TearDown()

	migrationKey := model.NewId()

	th.DeleteAllJobsByTypeAndMigrationKey(model.JOB_TYPE_MIGRATIONS, migrationKey)

	// Test with no job yet.
	state, job, err := GetMigrationState(migrationKey, th.App.Srv().Store)
	assert.Nil(t, err)
	assert.Nil(t, job)
	assert.Equal(t, "unscheduled", state)

	// Test with the system table showing the migration as done.
	system := model.System{
		Name:  migrationKey,
		Value: "true",
	}
	nErr := th.App.Srv().Store.System().Save(&system)
	assert.NoError(t, nErr)

	state, job, err = GetMigrationState(migrationKey, th.App.Srv().Store)
	assert.Nil(t, err)
	assert.Nil(t, job)
	assert.Equal(t, "completed", state)

	_, nErr = th.App.Srv().Store.System().PermanentDeleteByName(migrationKey)
	assert.NoError(t, nErr)

	// Test with a job scheduled in "pending" state.
	j1 := &model.Job{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Data: map[string]string{
			JobDataKeyMigration: migrationKey,
		},
		Status: model.JOB_STATUS_PENDING,
		Type:   model.JOB_TYPE_MIGRATIONS,
	}

	j1, nErr = th.App.Srv().Store.Job().Save(j1)
	require.NoError(t, nErr)

	state, job, err = GetMigrationState(migrationKey, th.App.Srv().Store)
	assert.Nil(t, err)
	assert.Equal(t, j1.Id, job.Id)
	assert.Equal(t, "in_progress", state)

	// Test with a job scheduled in "in progress" state.
	j2 := &model.Job{
		Id:       model.NewId(),
		CreateAt: j1.CreateAt + 1,
		Data: map[string]string{
			JobDataKeyMigration: migrationKey,
		},
		Status: model.JOB_STATUS_IN_PROGRESS,
		Type:   model.JOB_TYPE_MIGRATIONS,
	}

	j2, nErr = th.App.Srv().Store.Job().Save(j2)
	require.NoError(t, nErr)

	state, job, err = GetMigrationState(migrationKey, th.App.Srv().Store)
	assert.Nil(t, err)
	assert.Equal(t, j2.Id, job.Id)
	assert.Equal(t, "in_progress", state)

	// Test with a job scheduled in "error" state.
	j3 := &model.Job{
		Id:       model.NewId(),
		CreateAt: j2.CreateAt + 1,
		Data: map[string]string{
			JobDataKeyMigration: migrationKey,
		},
		Status: model.JOB_STATUS_ERROR,
		Type:   model.JOB_TYPE_MIGRATIONS,
	}

	j3, nErr = th.App.Srv().Store.Job().Save(j3)
	require.NoError(t, nErr)

	state, job, err = GetMigrationState(migrationKey, th.App.Srv().Store)
	assert.Nil(t, err)
	assert.Equal(t, j3.Id, job.Id)
	assert.Equal(t, "unscheduled", state)
}
