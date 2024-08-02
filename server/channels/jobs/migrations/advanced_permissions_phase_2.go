// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type AdvancedPermissionsPhase2Progress struct {
	CurrentTable  string `json:"current_table"`
	LastTeamID    string `json:"last_team_id"`
	LastChannelID string `json:"last_channel_id"`
	LastUserID    string `json:"last_user"`
}

func (p *AdvancedPermissionsPhase2Progress) ToJSON() string {
	b, _ := json.Marshal(p)
	return string(b)
}

func AdvancedPermissionsPhase2ProgressFromJSON(data io.Reader) *AdvancedPermissionsPhase2Progress {
	var o *AdvancedPermissionsPhase2Progress
	err := json.NewDecoder(data).Decode(&o)
	if err != nil {
		mlog.Warn("Error decoding advanced permissions phase 2 progress", mlog.Err(err))
	}
	return o
}

func (p *AdvancedPermissionsPhase2Progress) IsValid() bool {
	if !model.IsValidId(p.LastChannelID) {
		return false
	}

	if !model.IsValidId(p.LastTeamID) {
		return false
	}

	if !model.IsValidId(p.LastUserID) {
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

func (worker *Worker) runAdvancedPermissionsPhase2Migration(lastDone string) (bool, string, *model.AppError) {
	var progress *AdvancedPermissionsPhase2Progress
	if lastDone == "" {
		// Haven't started the migration yet.
		progress = &AdvancedPermissionsPhase2Progress{
			CurrentTable:  "TeamMembers",
			LastChannelID: strings.Repeat("0", 26),
			LastTeamID:    strings.Repeat("0", 26),
			LastUserID:    strings.Repeat("0", 26),
		}
	} else {
		err := json.NewDecoder(strings.NewReader(lastDone)).Decode(&progress)
		if err != nil {
			return false, "", model.NewAppError("MigrationsWorker.runAdvancedPermissionsPhase2Migration", "migrations.worker.run_advanced_permissions_phase_2_migration.invalid_progress", map[string]any{"lastDone": lastDone}, "", http.StatusInternalServerError).Wrap(err)
		}
		if !progress.IsValid() {
			return false, "", model.NewAppError("MigrationsWorker.runAdvancedPermissionsPhase2Migration", "migrations.worker.run_advanced_permissions_phase_2_migration.invalid_progress", map[string]any{"progress": progress.ToJSON()}, "", http.StatusInternalServerError)
		}
	}

	if progress.CurrentTable == "TeamMembers" {
		// Run a TeamMembers migration batch.
		result, err := worker.store.Team().MigrateTeamMembers(progress.LastTeamID, progress.LastUserID)
		if err != nil {
			return false, progress.ToJSON(), model.NewAppError("MigrationsWorker.runAdvancedPermissionsPhase2Migration", "app.team.migrate_team_members.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if result == nil {
			// We haven't progressed. That means that we've reached the end of this stage of the migration, and should now advance to the next stage.
			progress.LastUserID = strings.Repeat("0", 26)
			progress.CurrentTable = "ChannelMembers"
			return false, progress.ToJSON(), nil
		}

		progress.LastTeamID = result["TeamId"]
		progress.LastUserID = result["UserId"]
	} else if progress.CurrentTable == "ChannelMembers" {
		// Run a ChannelMembers migration batch.
		data, err := worker.store.Channel().MigrateChannelMembers(progress.LastChannelID, progress.LastUserID)
		if err != nil {
			return false, progress.ToJSON(), model.NewAppError("MigrationsWorker.runAdvancedPermissionsPhase2Migration", "app.channel.migrate_channel_members.select.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if data == nil {
			// We haven't progressed. That means we've reached the end of this final stage of the migration.

			return true, progress.ToJSON(), nil
		}

		progress.LastChannelID = data["ChannelId"]
		progress.LastUserID = data["UserId"]
	}

	return false, progress.ToJSON(), nil
}
