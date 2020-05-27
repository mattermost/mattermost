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
	StepCategories ProgressStep = "populateSidebarCategories"
	StepFavorites  ProgressStep = "migrateFavoriteChannelToSidebarChannels"
	StepEnd        ProgressStep = "endMigration"
)

type Progress struct {
	CurrentStep   ProgressStep `json:"current_state"`
	LastTeamId    string       `json:"last_team_id"`
	LastChannelId string       `json:"last_channel_id"`
	LastUserId    string       `json:"last_user"`
	LastSortOrder int64        `json:"last_sort_order"`
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
	case StepCategories, StepFavorites:
		return true
	default:
		return false
	}
}

func newProgress(step ProgressStep) *Progress {
	progress := new(Progress)
	progress.CurrentStep = step
	progress.LastChannelId = strings.Repeat("0", 26)
	progress.LastTeamId = strings.Repeat("0", 26)
	progress.LastUserId = strings.Repeat("0", 26)
	progress.LastSortOrder = 0
	return progress
}

func (worker *Worker) runSidebarCategoriesPhase2Migration(lastDone string) (bool, string, *model.AppError) {
	var progress *Progress
	if len(lastDone) == 0 {
		progress = newProgress(StepCategories)
	} else {
		progress = ProgressFromJson(strings.NewReader(lastDone))
		if !progress.IsValid() {
			return false, "", model.NewAppError("MigrationsWorker.runSidebarCategoriesPhase2Migration", "migrations.worker.run_sidebar_categories_phase_2_migration.invalid_progress", map[string]interface{}{"progress": progress.ToJson()}, "", http.StatusInternalServerError)
		}
	}

	var result map[string]interface{}
	var err *model.AppError
	var nextStep ProgressStep
	switch progress.CurrentStep {
	case StepCategories:
		result, err = worker.app.Srv().Store.Channel().MigrateSidebarCategories(progress.LastTeamId, progress.LastUserId)
		nextStep = StepFavorites
	case StepFavorites:
		result, err = worker.app.Srv().Store.Channel().MigrateFavoritesToSidebarChannels(progress.LastUserId, progress.LastSortOrder)
		nextStep = StepEnd
	default:
		return false, "", model.NewAppError("MigrationsWorker.runSidebarCategoriesPhase2Migration", "migrations.worker.run_sidebar_categories_phase_2_migration.invalid_progress", map[string]interface{}{"progress": progress.ToJson()}, "", http.StatusInternalServerError)
	}

	if err != nil {
		return false, progress.ToJson(), err
	}

	if result == nil {
		// We haven't progressed. That means that we've reached the end of this stage of the migration, and should now advance to the next stage or stop
		if nextStep != StepEnd {
			progress = newProgress(nextStep)
			return false, progress.ToJson(), nil
		}
		return true, progress.ToJson(), nil
	}

	progress.LastChannelId = strings.Repeat("0", 26)
	progress.LastTeamId = strings.Repeat("0", 26)
	progress.LastUserId = strings.Repeat("0", 26)
	progress.LastSortOrder = 0
	if val, ok := result["UserId"].(string); ok {
		progress.LastUserId = val
	}
	if val, ok := result["TeamId"].(string); ok {
		progress.LastTeamId = val
	}
	if val, ok := result["ChannelId"].(string); ok {
		progress.LastChannelId = val
	}
	if val, ok := result["SortOrder"].(int64); ok {
		progress.LastSortOrder = val
	}
	return false, progress.ToJson(), nil
}
