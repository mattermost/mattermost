// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/app"
	tjobs "github.com/mattermost/mattermost-server/v5/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	MigrationStateUnscheduled = "unscheduled"
	MigrationStateInProgress  = "in_progress"
	MigrationStateCompleted   = "completed"

	JobDataKeyMigration           = "migration_key"
	JobDataKeyMigration_LAST_DONE = "last_done"
)

type MigrationsJobInterfaceImpl struct {
	srv *app.Server
}

func init() {
	app.RegisterJobsMigrationsJobInterface(func(s *app.Server) tjobs.MigrationsJobInterface {
		return &MigrationsJobInterfaceImpl{s}
	})
}

func MakeMigrationsList() []string {
	return []string{
		model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2,
	}
}

func GetMigrationState(migration string, store store.Store) (string, *model.Job, *model.AppError) {
	if _, err := store.System().GetByName(migration); err == nil {
		return MigrationStateCompleted, nil, nil
	}

	jobs, err := store.Job().GetAllByType(model.JOB_TYPE_MIGRATIONS)
	if err != nil {
		return "", nil, model.NewAppError("GetMigrationState", "app.job.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, job := range jobs {
		if key, ok := job.Data[JobDataKeyMigration]; ok {
			if key != migration {
				continue
			}

			switch job.Status {
			case model.JOB_STATUS_IN_PROGRESS, model.JOB_STATUS_PENDING:
				return MigrationStateInProgress, job, nil
			default:
				return MigrationStateUnscheduled, job, nil
			}
		}
	}

	return MigrationStateUnscheduled, nil, nil
}
