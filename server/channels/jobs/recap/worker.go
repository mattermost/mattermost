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
	GetChannel(rctx request.CTX, channelID string) (*model.Channel, *model.AppError)
	GetTeam(teamID string) (*model.Team, *model.AppError)
	GetUser(userID string) (*model.User, *model.AppError)
	GetPostsSince(rctx request.CTX, options model.GetPostsSinceOptions) (*model.PostList, *model.AppError)
	SummarizePosts(rctx request.CTX, userID string, posts []*model.Post, channelName, teamName string, agentID string) (*model.AISummaryResponse, *model.AppError)
	Publish(message *model.WebSocketEvent)
}

func MakeWorker(jobServer *jobs.JobServer, storeInstance store.Store, appInstance AppIface) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return true // Always enabled
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

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
			_ = jobServer.SetJobProgress(job, progress)

			// Get channel info
			channel, err := appInstance.GetChannel(request.EmptyContext(logger), channelID)
			if err != nil {
				logger.Warn("Failed to get channel", mlog.String("channel_id", channelID), mlog.Err(err))
				failedChannels = append(failedChannels, channelID)
				continue
			}

			// Get user's last viewed timestamp
			lastViewedAt, lastViewedErr := storeInstance.Channel().GetMemberLastViewedAt(request.EmptyContext(logger), channelID, userID)
			if lastViewedErr != nil {
				logger.Warn("Failed to get last viewed", mlog.Err(lastViewedErr))
				failedChannels = append(failedChannels, channelID)
				continue
			}

			// Fetch last 15 unread posts + 5 context posts (20 total)
			posts, postsErr := fetchPostsForRecap(appInstance, logger, channelID, lastViewedAt, 1000)
			if postsErr != nil {
				logger.Warn("Failed to fetch posts", mlog.Err(postsErr))
				failedChannels = append(failedChannels, channelID)
				continue
			}

			if len(posts) == 0 {
				logger.Debug("No posts to summarize", mlog.String("channel_id", channelID))
				continue
			}

			// Get team info for permalink generation
			team, teamErr := appInstance.GetTeam(channel.TeamId)
			if teamErr != nil {
				logger.Warn("Failed to get team", mlog.String("team_id", channel.TeamId), mlog.Err(teamErr))
				failedChannels = append(failedChannels, channelID)
				continue
			}

			// Summarize posts
			summary, err := appInstance.SummarizePosts(request.EmptyContext(logger), userID, posts, channel.DisplayName, team.Name, agentID)
			if err != nil {
				logger.Error("Failed to summarize posts", mlog.Err(err))
				failedChannels = append(failedChannels, channelID)
				continue
			}

			// Save recap channel
			recapChannel := &model.RecapChannel{
				Id:            model.NewId(),
				RecapId:       recapID,
				ChannelId:     channelID,
				ChannelName:   channel.DisplayName,
				Highlights:    summary.Highlights,
				ActionItems:   summary.ActionItems,
				SourcePostIds: extractPostIDs(posts),
				CreateAt:      model.GetMillis(),
			}

			if err := storeInstance.Recap().SaveRecapChannel(recapChannel); err != nil {
				logger.Error("Failed to save recap channel", mlog.Err(err))
				failedChannels = append(failedChannels, channelID)
				continue
			}

			totalMessages += len(posts)
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

	return jobs.NewSimpleWorker("Recap", jobServer, execute, isEnabled)
}

func fetchPostsForRecap(appInstance AppIface, logger mlog.LoggerIFace, channelID string, lastViewedAt int64, limit int) ([]*model.Post, error) {
	// Get posts after lastViewedAt
	options := model.GetPostsSinceOptions{
		ChannelId: channelID,
		Time:      lastViewedAt,
	}

	postList, err := appInstance.GetPostsSince(request.EmptyContext(logger), options)
	if err != nil {
		return nil, err
	}

	// Convert to slice and limit
	posts := make([]*model.Post, 0, len(postList.Posts))
	for _, postID := range postList.Order {
		if post, ok := postList.Posts[postID]; ok {
			posts = append(posts, post)
			if len(posts) >= limit {
				break
			}
		}
	}

	// Enrich with usernames
	for _, post := range posts {
		user, _ := appInstance.GetUser(post.UserId)
		if user != nil {
			if post.Props == nil {
				post.Props = make(model.StringInterface)
			}
			post.AddProp("username", user.Username)
		}
	}

	return posts, nil
}

func extractPostIDs(posts []*model.Post) []string {
	ids := make([]string, len(posts))
	for i, post := range posts {
		ids[i] = post.Id
	}
	return ids
}

func publishRecapUpdate(appInstance AppIface, recapID, userID string) {
	message := model.NewWebSocketEvent(model.WebsocketEventRecapUpdated, "", "", userID, nil, "")
	message.Add("recap_id", recapID)
	appInstance.Publish(message)
}
