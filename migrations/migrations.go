// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package migrations

import (
	"github.com/mattermost/mattermost-server/app"
	tjobs "github.com/mattermost/mattermost-server/jobs/interfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

const (
	MIGRATION_STATE_UNSCHEDULED = "unscheduled"
	MIGRATION_STATE_IN_PROGRESS = "in_progress"
	MIGRATION_STATE_COMPLETED   = "completed"

	JOB_DATA_KEY_MIGRATION           = "migration_key"
	JOB_DATA_KEY_MIGRATION_LAST_DONE = "last_done"
)

type MigrationsJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterJobsMigrationsJobInterface(func(a *app.App) tjobs.MigrationsJobInterface {
		return &MigrationsJobInterfaceImpl{a}
	})
}

func MakeMigrationsList() []string {
	return []string{
		model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2,
	}
}

func GetMigrationState(migration string, store store.Store) (string, *model.Job, *model.AppError) {
	if result := <-store.System().GetByName(migration); result.Err == nil {
		return MIGRATION_STATE_COMPLETED, nil, nil
	}

	if result := <-store.Job().GetAllByType(model.JOB_TYPE_MIGRATIONS); result.Err != nil {
		return "", nil, result.Err
	} else {
		for _, job := range result.Data.([]*model.Job) {
			if key, ok := job.Data[JOB_DATA_KEY_MIGRATION]; ok {
				if key != migration {
					continue
				}

				switch job.Status {
				case model.JOB_STATUS_IN_PROGRESS, model.JOB_STATUS_PENDING:
					return MIGRATION_STATE_IN_PROGRESS, job, nil
				default:
					return MIGRATION_STATE_UNSCHEDULED, job, nil
				}
			}
		}
	}

	return MIGRATION_STATE_UNSCHEDULED, nil, nil
}
