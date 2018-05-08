// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package migrations

import (
	"encoding/json"
	"io"

	"github.com/mattermost/mattermost-server/app"
	tjobs "github.com/mattermost/mattermost-server/jobs/interfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

const (
	MIGRATION_STATE_UNSCHEDULED = "unscheduled"
	MIGRATION_STATE_IN_PROGRESS = "in_progress"
	MIGRATION_STATE_COMPLETED   = "completed"

	MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2 = "migration_advanced_permissions_phase_2"

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
		MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2,
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

type AdvancedPermissionsPhase2Progress struct {
	CurrentTable  string `json:"current_table"`
	LastTeamId    string `json:"last_team_id"`
	LastChannelId string `json:"last_channel_id"`
	LastUserId    string `json:"last_user"`
}

func (p *AdvancedPermissionsPhase2Progress) ToJson() string {
	b, _ := json.Marshal(p)
	return string(b)
}

func AdvancedPermissionsPhase2ProgressFromJson(data io.Reader) *AdvancedPermissionsPhase2Progress {
	var o *AdvancedPermissionsPhase2Progress
	json.NewDecoder(data).Decode(&o)
	return o
}

func (p *AdvancedPermissionsPhase2Progress) IsValid() bool {
	if len(p.LastChannelId) != 26 {
		return false
	}

	if len(p.LastTeamId) != 26 {
		return false
	}

	if len(p.LastUserId) != 26 {
		return false
	}

	switch p.CurrentTable {
	case "TeamMembers":
	case "ChannelMembers":
	default:
		return false
	}

	return true
}
