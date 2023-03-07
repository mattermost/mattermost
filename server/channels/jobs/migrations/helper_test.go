// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

func Setup(tb testing.TB) store.Store {
	store := mainHelper.GetStore()
	store.DropAllTables()
	return store
}

func deleteAllJobsByTypeAndMigrationKey(store store.Store, jobType string, migrationKey string) {
	jobs, err := store.Job().GetAllByType(model.JobTypeMigrations)
	if err != nil {
		panic(err)
	}

	for _, job := range jobs {
		if key, ok := job.Data[JobDataKeyMigration]; ok && key == migrationKey {
			if _, err = store.Job().Delete(job.Id); err != nil {
				panic(err)
			}
		}
	}
}
