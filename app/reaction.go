// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) SaveReactionForPost(c *request.Context, reaction *model.Reaction) (*model.Reaction, *model.AppError) {
	post, err := a.GetSinglePost(reaction.PostId, false)
	if err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("SaveReactionForPost", "api.reaction.save.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	reaction, nErr := a.Srv().Store().Reaction().Save(reaction)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SaveReactionForPost", "app.reaction.save.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if post.RootId == "" {
		if appErr := a.DeletePersistentNotificationsPost(c, post, reaction.UserId, true); appErr != nil {
			return nil, appErr
		}
	}

	// The post is always modified since the UpdateAt always changes
	a.invalidateCacheForChannelPosts(post.ChannelId)

	pluginContext := pluginContext(c)
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.ReactionHasBeenAdded(pluginContext, reaction)
			return true
		}, plugin.ReactionHasBeenAddedID)
	})

	a.Srv().Go(func() {
		a.sendReactionEvent(model.WebsocketEventReactionAdded, reaction, post)
	})

	return reaction, nil
}

func (a *App) GetReactionsForPost(postID string) ([]*model.Reaction, *model.AppError) {
	reactions, err := a.Srv().Store().Reaction().GetForPost(postID, true)
	if err != nil {
		return nil, model.NewAppError("GetReactionsForPost", "app.reaction.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return reactions, nil
}

func (a *App) GetBulkReactionsForPosts(postIDs []string) (map[string][]*model.Reaction, *model.AppError) {
	reactions := make(map[string][]*model.Reaction)

	allReactions, err := a.Srv().Store().Reaction().BulkGetForPosts(postIDs)
	if err != nil {
		return nil, model.NewAppError("GetBulkReactionsForPosts", "app.reaction.bulk_get_for_post_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, reaction := range allReactions {
		reactionsForPost := reactions[reaction.PostId]
		reactionsForPost = append(reactionsForPost, reaction)

		reactions[reaction.PostId] = reactionsForPost
	}

	reactions = populateEmptyReactions(postIDs, reactions)
	return reactions, nil
}

func populateEmptyReactions(postIDs []string, reactions map[string][]*model.Reaction) map[string][]*model.Reaction {
	for _, postID := range postIDs {
		if _, present := reactions[postID]; !present {
			reactions[postID] = []*model.Reaction{}
		}
	}
	return reactions
}

func (a *App) GetTopReactionsForTeamSince(teamID string, userID string, opts *model.InsightsOpts) (*model.TopReactionList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopReactionsForTeamSince", "api.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	topReactionList, err := a.Srv().Store().Reaction().GetTopForTeamSince(teamID, userID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopReactionsForTeamSince", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topReactionList, nil
}

func (a *App) GetTopReactionsForUserSince(userID string, teamID string, opts *model.InsightsOpts) (*model.TopReactionList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopReactionsForUserSince", "api.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	topReactionList, err := a.Srv().Store().Reaction().GetTopForUserSince(userID, teamID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopReactionsForUserSince", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topReactionList, nil
}

func (a *App) DeleteReactionForPost(c *request.Context, reaction *model.Reaction) *model.AppError {
	post, err := a.GetSinglePost(reaction.PostId, false)
	if err != nil {
		return err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return err
	}

	if channel.DeleteAt > 0 {
		return model.NewAppError("DeleteReactionForPost", "api.reaction.delete.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	if _, err := a.Srv().Store().Reaction().Delete(reaction); err != nil {
		return model.NewAppError("DeleteReactionForPost", "app.reaction.delete_all_with_emoji_name.get_reactions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// The post is always modified since the UpdateAt always changes
	a.invalidateCacheForChannelPosts(post.ChannelId)

	pluginContext := pluginContext(c)
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.ReactionHasBeenRemoved(pluginContext, reaction)
			return true
		}, plugin.ReactionHasBeenRemovedID)
	})

	a.Srv().Go(func() {
		a.sendReactionEvent(model.WebsocketEventReactionRemoved, reaction, post)
	})

	return nil
}

func (a *App) sendReactionEvent(event string, reaction *model.Reaction, post *model.Post) {
	// send out that a reaction has been added/removed
	message := model.NewWebSocketEvent(event, "", post.ChannelId, "", nil, "")
	reactionJSON, err := json.Marshal(reaction)
	if err != nil {
		a.Log().Warn("Failed to encode reaction to JSON", mlog.Err(err))
	}
	message.Add("reaction", string(reactionJSON))
	a.Publish(message)
}
