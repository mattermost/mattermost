// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) SaveReactionForPost(c request.CTX, reaction *model.Reaction) (*model.Reaction, *model.AppError) {
	post, err := a.GetSinglePost(reaction.PostId, false)
	if err != nil {
		return nil, err
	}

	// Check whether this is a valid emoji
	if _, ok := model.GetSystemEmojiId(reaction.EmojiName); !ok {
		if _, emojiErr := a.GetEmojiByName(c, reaction.EmojiName); emojiErr != nil {
			return nil, emojiErr
		}
	}

	existing, dErr := a.Srv().Store().Reaction().ExistsOnPost(reaction.PostId, reaction.EmojiName)
	if dErr != nil {
		return nil, model.NewAppError("SaveReactionForPost", "app.reaction.save.save.app_error", nil, "", http.StatusInternalServerError).Wrap(dErr)
	}

	// If it exists already, we don't need to check for the limit
	if !existing {
		count, dErr := a.Srv().Store().Reaction().GetUniqueCountForPost(reaction.PostId)
		if dErr != nil {
			return nil, model.NewAppError("SaveReactionForPost", "app.reaction.save.save.app_error", nil, "", http.StatusInternalServerError).Wrap(dErr)
		}

		if count >= *a.Config().ServiceSettings.UniqueEmojiReactionLimitPerPost {
			return nil, model.NewAppError("SaveReactionForPost", "app.reaction.save.save.too_many_reactions", nil, "", http.StatusBadRequest)
		}
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("SaveReactionForPost", "api.reaction.save.archived_channel.app_error", nil, "", http.StatusForbidden)
	}
	// Pre-populating the channelID to save a DB call in store.
	reaction.ChannelId = post.ChannelId
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
		if appErr := a.ResolvePersistentNotification(c, post, reaction.UserId); appErr != nil {
			a.NotificationsLog().Error("Error resolving persistent notification",
				mlog.String("sender_id", reaction.UserId),
				mlog.String("post_id", post.RootId),
				mlog.String("status", model.StatusServerError),
				mlog.String("reason", model.ReasonFetchError),
				mlog.Err(appErr),
			)
			return nil, appErr
		}
	}

	// The post is always modified since the UpdateAt always changes
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)

	pluginContext := pluginContext(c)
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.ReactionHasBeenAdded(pluginContext, reaction)
			return true
		}, plugin.ReactionHasBeenAddedID)
	})

	a.sendReactionEvent(model.WebsocketEventReactionAdded, reaction, post)

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

func (a *App) DeleteReactionForPost(c request.CTX, reaction *model.Reaction) *model.AppError {
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
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)

	pluginContext := pluginContext(c)
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.ReactionHasBeenRemoved(pluginContext, reaction)
			return true
		}, plugin.ReactionHasBeenRemovedID)
	})

	a.sendReactionEvent(model.WebsocketEventReactionRemoved, reaction, post)

	return nil
}

func (a *App) sendReactionEvent(event model.WebsocketEventType, reaction *model.Reaction, post *model.Post) {
	// send out that a reaction has been added/removed
	message := model.NewWebSocketEvent(event, "", post.ChannelId, "", nil, "")
	reactionJSON, err := json.Marshal(reaction)
	if err != nil {
		a.Log().Warn("Failed to encode reaction to JSON", mlog.Err(err))
	}
	message.Add("reaction", string(reactionJSON))
	a.Publish(message)
}
