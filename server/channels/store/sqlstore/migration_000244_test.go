// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

// TestMigrationJobsConcurrencyKey reverts migrations 000243 to 000246 on a database holding
// duplicate in-flight singleton jobs, as an affected HA cluster would, and verifies that
// re-applying them keeps one job per key in each state before creating the unique indexes.
func TestMigrationJobsConcurrencyKey(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}
	defer storetest.CleanupSqlSettings(settings)

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	exec := func(filename string) {
		t.Helper()
		_, err := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, filename))
		require.NoError(t, err, filename)
	}

	for _, filename := range []string{
		"000246_create_jobs_concurrency_pending_index.down.sql",
		"000245_create_jobs_concurrency_running_index.down.sql",
		"000244_backfill_jobs_concurrencykey.down.sql",
		"000243_add_concurrencykey_to_jobs.down.sql",
	} {
		exec(filename)
	}

	var columns int
	require.NoError(t, store.GetMaster().Get(&columns, "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'concurrencykey'"))
	require.Equal(t, 0, columns)

	insert := func(jobType, status string, createAt, lastActivityAt int64) string {
		t.Helper()
		id := model.NewId()
		_, err := store.GetMaster().Exec("INSERT INTO Jobs (Id, Type, Priority, CreateAt, StartAt, LastActivityAt, Status, Progress, Data) VALUES ($1, $2, 0, $3, 0, $4, $5, 0, $6)",
			id, jobType, createAt, lastActivityAt, status, `{"key":"value"}`)
		require.NoError(t, err)
		return id
	}

	oldPendingRetention := insert(model.JobTypeDataRetention, model.JobStatusPending, 100, 100)
	newPendingRetention := insert(model.JobTypeDataRetention, model.JobStatusPending, 200, 200)
	staleRunningLdap := insert(model.JobTypeLdapSync, model.JobStatusInProgress, 100, 150)
	activeRunningLdap := insert(model.JobTypeLdapSync, model.JobStatusCancelRequested, 100, 300)
	otherRunningLdap := insert(model.JobTypeLdapSync, model.JobStatusInProgress, 100, 250)
	pendingLdap := insert(model.JobTypeLdapSync, model.JobStatusPending, 400, 400)
	finishedRetention := insert(model.JobTypeDataRetention, model.JobStatusSuccess, 50, 50)
	pendingImport1 := insert(model.JobTypeImportProcess, model.JobStatusPending, 100, 100)
	pendingImport2 := insert(model.JobTypeImportProcess, model.JobStatusPending, 200, 200)

	for _, filename := range []string{
		"000243_add_concurrencykey_to_jobs.up.sql",
		"000244_backfill_jobs_concurrencykey.up.sql",
		"000245_create_jobs_concurrency_running_index.up.sql",
		"000246_create_jobs_concurrency_pending_index.up.sql",
	} {
		exec(filename)
	}

	expected := map[string]struct {
		status string
		key    string
	}{
		oldPendingRetention: {model.JobStatusCanceled, model.JobTypeDataRetention},
		newPendingRetention: {model.JobStatusPending, model.JobTypeDataRetention},
		staleRunningLdap:    {model.JobStatusError, model.JobTypeLdapSync},
		activeRunningLdap:   {model.JobStatusCancelRequested, model.JobTypeLdapSync},
		otherRunningLdap:    {model.JobStatusError, model.JobTypeLdapSync},
		pendingLdap:         {model.JobStatusPending, model.JobTypeLdapSync},
		finishedRetention:   {model.JobStatusSuccess, ""},
		pendingImport1:      {model.JobStatusPending, ""},
		pendingImport2:      {model.JobStatusPending, ""},
	}
	for id, want := range expected {
		job, err := store.Job().Get(request.TestContext(t), id)
		require.NoError(t, err)
		assert.Equal(t, want.status, job.Status, id)
		assert.Equal(t, want.key, job.ConcurrencyKey, id)
		assert.Equal(t, "value", job.Data["key"], id)
	}

	job, err := store.Job().Get(request.TestContext(t), staleRunningLdap)
	require.NoError(t, err)
	assert.NotEmpty(t, job.Data["error"])

	_, err = store.Job().Save(&model.Job{Id: model.NewId(), Type: model.JobTypeDataRetention, Status: model.JobStatusPending, ConcurrencyKey: model.JobTypeDataRetention})
	require.Error(t, err, "the pending index should reject a second pending job")
}
