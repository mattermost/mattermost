// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

type ProgressStep string

const (
	STEP_CATEGORIES ProgressStep = "populateSidebarCategories"
	STEP_FAVORITES  ProgressStep = "migrateFavoriteChannelToSidebarChannels"
	STEP_DMS        ProgressStep = "migrateDirectMessagesToSidebarChannels"
	STEP_CHANNELS   ProgressStep = "migrateChannelsToSidebarChannels"
	STEP_END        ProgressStep = "endMigration"
)

type Progress struct {
	CurrentStep   ProgressStep `json:"current_state"`
	LastTeamId    string       `json:"last_team_id"`
	LastChannelId string       `json:"last_channel_id"`
	LastUserId    string       `json:"last_user"`
}

func (p *Progress) ToJson() string {
	b, _ := json.Marshal(p)
	return string(b)
}

func ProgressFromJson(data io.Reader) *Progress {
	var o *Progress
	json.NewDecoder(data).Decode(&o)
	return o
}

func (p *Progress) IsValid() bool {
	if len(p.LastChannelId) != 26 {
		return false
	}

	if len(p.LastTeamId) != 26 {
		return false
	}

	if len(p.LastUserId) != 26 {
		return false
	}

	switch p.CurrentStep {
	case STEP_CATEGORIES, STEP_CHANNELS, STEP_DMS, STEP_FAVORITES:
	default:
		return false
	}

	return true
}

func newProgress(step ProgressStep) *Progress {
	progress := new(Progress)
	progress.CurrentStep = step
	progress.LastChannelId = strings.Repeat("0", 26)
	progress.LastTeamId = strings.Repeat("0", 26)
	progress.LastUserId = strings.Repeat("0", 26)
	return progress
}

func (worker *Worker) runSidebarCategoriesPhase1Migration(lastDone string) (bool, string, *model.AppError) {
	var progress *Progress
	if len(lastDone) == 0 {
		progress = newProgress(STEP_CATEGORIES)
	} else {
		progress = ProgressFromJson(strings.NewReader(lastDone))
		if !progress.IsValid() {
			return false, "", model.NewAppError("MigrationsWorker.runSidebarCategoriesPhase1Migration", "migrations.worker.run_sidebar_categories_phase_1_migration.invalid_progress", map[string]interface{}{"progress": progress.ToJson()}, "", http.StatusInternalServerError)
		}
	}

	var result map[string]string
	var err *model.AppError
	var nextStep ProgressStep
	switch progress.CurrentStep {
	case STEP_CATEGORIES:
		result, err = worker.app.Srv().Store.Channel().MigrateSidebarCategories(progress.LastTeamId, progress.LastUserId)
		nextStep = STEP_FAVORITES
	case STEP_CHANNELS:
		result, err = worker.app.Srv().Store.Channel().MigrateChannelsToSidebarChannels(progress.LastChannelId, progress.LastUserId)
		nextStep = STEP_FAVORITES
	case STEP_DMS:
		result, err = worker.app.Srv().Store.Channel().MigrateDirectGroupMessagesToSidebarChannels(progress.LastChannelId, progress.LastUserId)
		nextStep = STEP_FAVORITES
	case STEP_FAVORITES:
		result, err = worker.app.Srv().Store.Channel().MigrateFavoritesToSidebarChannels(progress.LastUserId)
		nextStep = STEP_END
	}

	if err != nil {
		return false, progress.ToJson(), err
	}

	if result == nil {
		// We haven't progressed. That means that we've reached the end of this stage of the migration, and should now advance to the next stage or stop
		if nextStep != STEP_END {
			progress = newProgress(nextStep)
			return false, progress.ToJson(), nil
		}
		return true, progress.ToJson(), nil
	}

	progress.LastTeamId = result["TeamId"]
	progress.LastUserId = result["UserId"]
	progress.LastChannelId = result["ChannelId"]

	return false, progress.ToJson(), nil
}
