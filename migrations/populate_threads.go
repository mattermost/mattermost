// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
)

const MAX_NUMBER_OF_POSTS_TO_INDEX = 10000
const CHANNELS_PER_CHUNK = 10

/*
Populate Threads migration strategy
1. Store start timestamp
2. Split all channels into chunks (max CHANNELS_PER_CHUNK)
	2.1 For each channel, collect last MAX_NUMBER_OF_POSTS_TO_INDEX posts
	2.2 For each channel, take all memberships
		For each membership (userid/channelid pair) - find all threads where that user is mentioned and create ThreadMembership/Thread
3. Once all is done
	3.1 Store new start timestamp
	3.2 If there are new posts since previous start timestamp, process the channel in which that post was created by running 2.2
4. Re-run 3 maybe?
5. Recalculate total_msg_count_root, msg_count_root, mention_count_root for Channels/ChannelMembers
*/

type PopulateThreadsProgress struct {
	Timestamp     time.Time `json:"start_time"`
	Stage         string    `json:"stage"`
	LastChannelId string    `json:"last_channel_id"`
}

func (p *PopulateThreadsProgress) ToJson() string {
	b, _ := json.Marshal(p)
	return string(b)
}

func PopulateThreadsProgressFromJson(data io.Reader) *PopulateThreadsProgress {
	var o *PopulateThreadsProgress
	json.NewDecoder(data).Decode(&o)
	return o
}

func (p *PopulateThreadsProgress) IsValid() bool {
	if !model.IsValidId(p.LastChannelId) {
		return false
	}

	switch p.Stage {
	case "Channels":
	case "Cleanup":
	case "Recalc":
	default:
		return false
	}

	return true
}

func (worker *Worker) MigrateChunk(lastChannelId string) (string, error) {
	channels, err := worker.srv.Store.Channel().GetAllChannelsForExportAfter(CHANNELS_PER_CHUNK, lastChannelId)
	if len(channels) < 1 {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return channels[len(channels)-1].Id, nil
}

func (worker *Worker) runPopulateThreadsMigration(lastDone string) (bool, string, *model.AppError) {
	var progress *PopulateThreadsProgress
	if lastDone == "" {
		// Haven't started the migration yet.
		progress = new(PopulateThreadsProgress)
		progress.Stage = "Channels"
		progress.LastChannelId = strings.Repeat("0", 26)
	} else {
		progress = PopulateThreadsProgressFromJson(strings.NewReader(lastDone))
		if !progress.IsValid() {
			return false, "", model.NewAppError("MigrationsWorker.runPopulateThreadsMigration", "migrations.worker.runPopulateThreadsMigration.invalid_progress", map[string]interface{}{"progress": progress.ToJson()}, "", http.StatusInternalServerError)
		}
	}

	if progress.Stage == "Channels" {
		// Run a TeamMembers migration batch.
		result, err := worker.MigrateChunk(progress.LastChannelId)
		if err != nil {
			return false, progress.ToJson(), model.NewAppError("MigrationsWorker.runPopulateThreadsMigration", "app.team.migrate_team_members.update.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if result == "" {
			// We haven't progressed. That means that we've reached the end of this stage of the migration, and should now advance to the next stage.
			progress.LastChannelId = strings.Repeat("0", 26)
			progress.Stage = "Cleanup"
			return false, progress.ToJson(), nil
		}

		progress.LastChannelId = result
	} else if progress.Stage == "Cleanup" {
		progress.Stage = "Recalc"
		return false, progress.ToJson(), nil
	} else if progress.Stage == "Recalc" {
		worker.srv.Store.Thread().RootCountMigration()
		return true, progress.ToJson(), nil
	}

	return false, progress.ToJson(), nil
}
