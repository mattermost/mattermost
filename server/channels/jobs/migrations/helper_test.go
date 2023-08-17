// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func Setup(tb testing.TB) store.Store {
	store := mainHelper.GetStore()
	store.DropAllTables()
	return store
}

func deleteAllJobsByTypeAndMigrationKey(t *testing.T, store store.Store, jobType string, migrationKey string) {
	ctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t, true))
	jobs, err := store.Job().GetAllByType(ctx, model.JobTypeMigrations)
	require.NoError(t, err)

	for _, job := range jobs {
		if key, ok := job.Data[JobDataKeyMigration]; ok && key == migrationKey {
			_, err = store.Job().Delete(job.Id)
			require.NoError(t, err)
		}
	}
}
