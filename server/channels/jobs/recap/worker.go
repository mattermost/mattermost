// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package recap

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type AppIface interface {
	ProcessRecapChannel(rctx request.CTX, recapID, channelID, userID, agentID string) (*model.RecapChannelResult, *model.AppError)
	Publish(message *model.WebSocketEvent)
}

func MakeWorker(jobServer *jobs.JobServer, storeInstance store.Store, appInstance AppIface) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return cfg.FeatureFlags.EnableAIRecaps
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)
		return processRecapJob(logger, job, storeInstance, appInstance, func(progress int64) {
			_ = jobServer.SetJobProgress(job, progress)
		})
	}

	return jobs.NewSimpleWorker("Recap", jobServer, execute, isEnabled)
}

func processRecapJob(logger mlog.LoggerIFace, job *model.Job, storeInstance store.Store, appInstance AppIface, setProgress func(int64)) error {
	recapID := job.Data["recap_id"]
	userID := job.Data["user_id"]
	channelIDs := strings.Split(job.Data["channel_ids"], ",")
	agentID := job.Data["agent_id"]

	logger.Info("Starting recap job",
		mlog.String("recap_id", recapID),
		mlog.String("agent_id", agentID),
		mlog.Int("channel_count", len(channelIDs)))

	// Update status to processing
	_ = storeInstance.Recap().UpdateRecapStatus(recapID, model.RecapStatusProcessing)
	publishRecapUpdate(appInstance, recapID, userID)

	totalMessages := 0
	successfulChannels := []string{}
	failedChannels := []string{}

	for i, channelID := range channelIDs {
		// Update progress
		progress := int64((i * 100) / len(channelIDs))
		if setProgress != nil {
			setProgress(progress)
		}

		// Process the channel
		result, err := appInstance.ProcessRecapChannel(request.EmptyContext(logger), recapID, channelID, userID, agentID)
		if err != nil {
			logger.Warn("Failed to process channel",
				mlog.String("channel_id", channelID),
				mlog.Err(err))
			failedChannels = append(failedChannels, channelID)
			continue
		}

		if !result.Success {
			logger.Warn("Channel processing unsuccessful", mlog.String("channel_id", channelID))
			failedChannels = append(failedChannels, channelID)
			continue
		}

		totalMessages += result.MessageCount
		successfulChannels = append(successfulChannels, channelID)
	}

	// Update recap with final data (title is already set by user in CreateRecap)
	recap, _ := storeInstance.Recap().GetRecap(recapID)
	recap.TotalMessageCount = totalMessages
	recap.UpdateAt = model.GetMillis()

	if len(failedChannels) > 0 && len(successfulChannels) == 0 {
		recap.Status = model.RecapStatusFailed
		_, err := storeInstance.Recap().UpdateRecap(recap)
		if err != nil {
			logger.Error("Failed to update recap", mlog.Err(err))
			return fmt.Errorf("failed to update recap: %w", err)
		}
		publishRecapUpdate(appInstance, recapID, userID)
		return fmt.Errorf("all channels failed to process")
	} else if len(failedChannels) > 0 {
		recap.Status = model.RecapStatusCompleted
		_, err := storeInstance.Recap().UpdateRecap(recap)
		if err != nil {
			logger.Error("Failed to update recap", mlog.Err(err))
			return fmt.Errorf("failed to update recap: %w", err)
		}
		publishRecapUpdate(appInstance, recapID, userID)
		logger.Warn("Some channels failed", mlog.Int("failed_count", len(failedChannels)))
		// Job succeeds with warning
	} else {
		recap.Status = model.RecapStatusCompleted
		_, err := storeInstance.Recap().UpdateRecap(recap)
		if err != nil {
			logger.Error("Failed to update recap", mlog.Err(err))
			return fmt.Errorf("failed to update recap: %w", err)
		}
		publishRecapUpdate(appInstance, recapID, userID)
	}

	logger.Info("Recap job completed",
		mlog.String("recap_id", recapID),
		mlog.Int("successful_channels", len(successfulChannels)),
		mlog.Int("failed_channels", len(failedChannels)))

	return nil
}

func publishRecapUpdate(appInstance AppIface, recapID, userID string) {
	message := model.NewWebSocketEvent(model.WebsocketEventRecapUpdated, "", "", userID, nil, "")
	message.Add("recap_id", recapID)
	appInstance.Publish(message)
}
