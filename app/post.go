// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/services/cache"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	PendingPostIDsCacheSize = 25000
	PendingPostIDsCacheTTL  = 30 * time.Second
	PageDefault             = 0
)

func (a *App) CreatePostAsUser(post *model.Post, currentSessionId string, setOnline bool) (*model.Post, *model.AppError) {
	// Check that channel has not been deleted
	channel, errCh := a.Srv().Store.Channel().Get(post.ChannelId, true)
	if errCh != nil {
		err := model.NewAppError("CreatePostAsUser", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "post.channel_id"}, errCh.Error(), http.StatusBadRequest)
		return nil, err
	}

	if strings.HasPrefix(post.Type, model.POST_SYSTEM_MESSAGE_PREFIX) {
		err := model.NewAppError("CreatePostAsUser", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "post.type"}, "", http.StatusBadRequest)
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err := model.NewAppError("createPost", "api.post.create_post.can_not_post_to_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	rp, err := a.CreatePost(post, channel, true, setOnline)
	if err != nil {
		if err.Id == "api.post.create_post.root_id.app_error" ||
			err.Id == "api.post.create_post.channel_root_id.app_error" ||
			err.Id == "api.post.create_post.parent_id.app_error" {
			err.StatusCode = http.StatusBadRequest
		}

		if err.Id == "api.post.create_post.town_square_read_only" {
			user, nErr := a.Srv().Store.User().Get(post.UserId)
			if nErr != nil {
				var nfErr *store.ErrNotFound
				switch {
				case errors.As(nErr, &nfErr):
					return nil, model.NewAppError("CreatePostAsUser", MissingAccountError, nil, nfErr.Error(), http.StatusNotFound)
				default:
					return nil, model.NewAppError("CreatePostAsUser", "app.user.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
				}
			}

			T := utils.GetUserTranslations(user.Locale)
			a.SendEphemeralPost(
				post.UserId,
				&model.Post{
					ChannelId: channel.Id,
					ParentId:  post.ParentId,
					RootId:    post.RootId,
					UserId:    post.UserId,
					Message:   T("api.post.create_post.town_square_read_only"),
					CreateAt:  model.GetMillis() + 1,
				},
			)
		}
		return nil, err
	}

	// Update the LastViewAt only if the post does not have from_webhook prop set (e.g. Zapier app),
	// or if it does not have from_bot set (e.g. from discovering the user is a bot within CreatePost).
	_, fromWebhook := post.GetProps()["from_webhook"]
	_, fromBot := post.GetProps()["from_bot"]
	if !fromWebhook && !fromBot {
		if _, err := a.MarkChannelsAsViewed([]string{post.ChannelId}, post.UserId, currentSessionId); err != nil {
			mlog.Warn(
				"Encountered error updating last viewed",
				mlog.String("channel_id", post.ChannelId),
				mlog.String("user_id", post.UserId),
				mlog.Err(err),
			)
		}
	}

	return rp, nil
}

func (a *App) CreatePostMissingChannel(post *model.Post, triggerWebhooks bool) (*model.Post, *model.AppError) {
	channel, err := a.Srv().Store.Channel().Get(post.ChannelId, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("CreatePostMissingChannel", "app.channel.get.existing.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("CreatePostMissingChannel", "app.channel.get.find.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return a.CreatePost(post, channel, triggerWebhooks, true)
}

// deduplicateCreatePost attempts to make posting idempotent within a caching window.
func (a *App) deduplicateCreatePost(post *model.Post) (foundPost *model.Post, err *model.AppError) {
	// We rely on the client sending the pending post id across "duplicate" requests. If there
	// isn't one, we can't deduplicate, so allow creation normally.
	if post.PendingPostId == "" {
		return nil, nil
	}

	const unknownPostId = ""

	// Query the cache atomically for the given pending post id, saving a record if
	// it hasn't previously been seen.
	var postId string
	nErr := a.Srv().seenPendingPostIdsCache.Get(post.PendingPostId, &postId)
	if nErr == cache.ErrKeyNotFound {
		a.Srv().seenPendingPostIdsCache.SetWithExpiry(post.PendingPostId, unknownPostId, PendingPostIDsCacheTTL)
		return nil, nil
	}

	if nErr != nil {
		return nil, model.NewAppError("errorGetPostId", "api.post.error_get_post_id.pending", nil, "", http.StatusInternalServerError)
	}

	// If another thread saved the cache record, but hasn't yet updated it with the actual post
	// id (because it's still saving), notify the client with an error. Ideally, we'd wait
	// for the other thread, but coordinating that adds complexity to the happy path.
	if postId == unknownPostId {
		return nil, model.NewAppError("deduplicateCreatePost", "api.post.deduplicate_create_post.pending", nil, "", http.StatusInternalServerError)
	}

	// If the other thread finished creating the post, return the created post back to the
	// client, making the API call feel idempotent.
	actualPost, err := a.GetSinglePost(postId)
	if err != nil {
		return nil, model.NewAppError("deduplicateCreatePost", "api.post.deduplicate_create_post.failed_to_get", nil, err.Error(), http.StatusInternalServerError)
	}

	mlog.Debug("Deduplicated create post", mlog.String("post_id", actualPost.Id), mlog.String("pending_post_id", post.PendingPostId))

	return actualPost, nil
}

func (a *App) CreatePost(post *model.Post, channel *model.Channel, triggerWebhooks, setOnline bool) (savedPost *model.Post, err *model.AppError) {
	foundPost, err := a.deduplicateCreatePost(post)
	if err != nil {
		return nil, err
	}
	if foundPost != nil {
		return foundPost, nil
	}

	// If we get this far, we've recorded the client-provided pending post id to the cache.
	// Remove it if we fail below, allowing a proper retry by the client.
	defer func() {
		if post.PendingPostId == "" {
			return
		}

		if err != nil {
			a.Srv().seenPendingPostIdsCache.Remove(post.PendingPostId)
			return
		}

		a.Srv().seenPendingPostIdsCache.SetWithExpiry(post.PendingPostId, savedPost.Id, PendingPostIDsCacheTTL)
	}()

	post.SanitizeProps()

	var pchan chan store.StoreResult
	if post.RootId != "" {
		pchan = make(chan store.StoreResult, 1)
		go func() {
			r, pErr := a.Srv().Store.Post().Get(post.RootId, false, false, false)
			pchan <- store.StoreResult{Data: r, NErr: pErr}
			close(pchan)
		}()
	}

	user, nErr := a.Srv().Store.User().Get(post.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreatePost", MissingAccountError, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("CreatePost", "app.user.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	if user.IsBot {
		post.AddProp("from_bot", "true")
	}

	if a.Srv().License() != nil && *a.Config().TeamSettings.ExperimentalTownSquareIsReadOnly &&
		!post.IsSystemMessage() &&
		channel.Name == model.DEFAULT_CHANNEL &&
		!a.RolesGrantPermission(user.GetRoles(), model.PERMISSION_MANAGE_SYSTEM.Id) {
		return nil, model.NewAppError("createPost", "api.post.create_post.town_square_read_only", nil, "", http.StatusForbidden)
	}

	var ephemeralPost *model.Post
	if post.Type == "" && !a.HasPermissionToChannel(user.Id, channel.Id, model.PERMISSION_USE_CHANNEL_MENTIONS) {
		mention := post.DisableMentionHighlights()
		if mention != "" {
			T := utils.GetUserTranslations(user.Locale)
			ephemeralPost = &model.Post{
				UserId:    user.Id,
				RootId:    post.RootId,
				ParentId:  post.ParentId,
				ChannelId: channel.Id,
				Message:   T("model.post.channel_notifications_disabled_in_channel.message", model.StringInterface{"ChannelName": channel.Name, "Mention": mention}),
				Props:     model.StringInterface{model.POST_PROPS_MENTION_HIGHLIGHT_DISABLED: true},
			}
		}
	}

	// Verify the parent/child relationships are correct
	var parentPostList *model.PostList
	if pchan != nil {
		result := <-pchan
		if result.NErr != nil {
			return nil, model.NewAppError("createPost", "api.post.create_post.root_id.app_error", nil, "", http.StatusBadRequest)
		}
		parentPostList = result.Data.(*model.PostList)
		if len(parentPostList.Posts) == 0 || !parentPostList.IsChannelId(post.ChannelId) {
			return nil, model.NewAppError("createPost", "api.post.create_post.channel_root_id.app_error", nil, "", http.StatusInternalServerError)
		}

		rootPost := parentPostList.Posts[post.RootId]
		if rootPost.RootId != "" {
			return nil, model.NewAppError("createPost", "api.post.create_post.root_id.app_error", nil, "", http.StatusBadRequest)
		}

		if post.ParentId == "" {
			post.ParentId = post.RootId
		}

		if post.RootId != post.ParentId {
			parent := parentPostList.Posts[post.ParentId]
			if parent == nil {
				return nil, model.NewAppError("createPost", "api.post.create_post.parent_id.app_error", nil, "", http.StatusInternalServerError)
			}
		}
	}

	post.Hashtags, _ = model.ParseHashtags(post.Message)

	if err = a.FillInPostProps(post, channel); err != nil {
		return nil, err
	}

	// Temporary fix so old plugins don't clobber new fields in SlackAttachment struct, see MM-13088
	if attachments, ok := post.GetProp("attachments").([]*model.SlackAttachment); ok {
		jsonAttachments, err := json.Marshal(attachments)
		if err == nil {
			attachmentsInterface := []interface{}{}
			err = json.Unmarshal(jsonAttachments, &attachmentsInterface)
			post.AddProp("attachments", attachmentsInterface)
		}
		if err != nil {
			mlog.Warn("Could not convert post attachments to map interface.", mlog.Err(err))
		}
	}

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		var rejectionError *model.AppError
		pluginContext := a.PluginContext()
		pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
			replacementPost, rejectionReason := hooks.MessageWillBePosted(pluginContext, post)
			if rejectionReason != "" {
				id := "Post rejected by plugin. " + rejectionReason
				if rejectionReason == plugin.DismissPostError {
					id = plugin.DismissPostError
				}
				rejectionError = model.NewAppError("createPost", id, nil, "", http.StatusBadRequest)
				return false
			}
			if replacementPost != nil {
				post = replacementPost
			}

			return true
		}, plugin.MessageWillBePostedId)

		if rejectionError != nil {
			return nil, rejectionError
		}
	}

	rpost, nErr := a.Srv().Store.Post().Save(post)
	if nErr != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("CreatePost", "app.post.save.existing.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("CreatePost", "app.post.save.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	// Update the mapping from pending post id to the actual post id, for any clients that
	// might be duplicating requests.
	a.Srv().seenPendingPostIdsCache.SetWithExpiry(post.PendingPostId, rpost.Id, PendingPostIDsCacheTTL)

	// We make a copy of the post for the plugin hook to avoid a race condition.
	rPostCopy := rpost.Clone()
	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		a.Srv().Go(func() {
			pluginContext := a.PluginContext()
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.MessageHasBeenPosted(pluginContext, rPostCopy)
				return true
			}, plugin.MessageHasBeenPostedId)
		})
	}

	if a.Metrics() != nil {
		a.Metrics().IncrementPostCreate()
	}

	if len(post.FileIds) > 0 {
		if err = a.attachFilesToPost(post); err != nil {
			mlog.Warn("Encountered error attaching files to post", mlog.String("post_id", post.Id), mlog.Any("file_ids", post.FileIds), mlog.Err(err))
		}

		if a.Metrics() != nil {
			a.Metrics().IncrementPostFileAttachment(len(post.FileIds))
		}
	}

	// Normally, we would let the API layer call PreparePostForClient, but we do it here since it also needs
	// to be done when we send the post over the websocket in handlePostEvents
	rpost = a.PreparePostForClient(rpost, true, false)

	if err := a.handlePostEvents(rpost, user, channel, triggerWebhooks, parentPostList, setOnline); err != nil {
		mlog.Warn("Failed to handle post events", mlog.Err(err))
	}

	// Send any ephemeral posts after the post is created to ensure it shows up after the latest post created
	if ephemeralPost != nil {
		a.SendEphemeralPost(post.UserId, ephemeralPost)
	}

	return rpost, nil
}

func (a *App) attachFilesToPost(post *model.Post) *model.AppError {
	var attachedIds []string
	for _, fileId := range post.FileIds {
		err := a.Srv().Store.FileInfo().AttachToPost(fileId, post.Id, post.UserId)
		if err != nil {
			mlog.Warn("Failed to attach file to post", mlog.String("file_id", fileId), mlog.String("post_id", post.Id), mlog.Err(err))
			continue
		}

		attachedIds = append(attachedIds, fileId)
	}

	if len(post.FileIds) != len(attachedIds) {
		// We couldn't attach all files to the post, so ensure that post.FileIds reflects what was actually attached
		post.FileIds = attachedIds

		if _, err := a.Srv().Store.Post().Overwrite(post); err != nil {
			return model.NewAppError("attachFilesToPost", "app.post.overwrite.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

// FillInPostProps should be invoked before saving posts to fill in properties such as
// channel_mentions.
//
// If channel is nil, FillInPostProps will look up the channel corresponding to the post.
func (a *App) FillInPostProps(post *model.Post, channel *model.Channel) *model.AppError {
	channelMentions := post.ChannelMentions()
	channelMentionsProp := make(map[string]interface{})

	if len(channelMentions) > 0 {
		if channel == nil {
			postChannel, err := a.Srv().Store.Channel().GetForPost(post.Id)
			if err != nil {
				return model.NewAppError("FillInPostProps", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "post.channel_id"}, err.Error(), http.StatusBadRequest)
			}
			channel = postChannel
		}

		mentionedChannels, err := a.GetChannelsByNames(channelMentions, channel.TeamId)
		if err != nil {
			return err
		}

		for _, mentioned := range mentionedChannels {
			if mentioned.Type == model.CHANNEL_OPEN {
				team, err := a.Srv().Store.Team().Get(mentioned.TeamId)
				if err != nil {
					mlog.Warn("Failed to get team of the channel mention", mlog.String("team_id", channel.TeamId), mlog.String("channel_id", channel.Id), mlog.Err(err))
					continue
				}
				channelMentionsProp[mentioned.Name] = map[string]interface{}{
					"display_name": mentioned.DisplayName,
					"team_name":    team.Name,
				}
			}
		}
	}

	if len(channelMentionsProp) > 0 {
		post.AddProp("channel_mentions", channelMentionsProp)
	} else if post.GetProps() != nil {
		post.DelProp("channel_mentions")
	}

	matched := model.AT_MENTION_PATTEN.MatchString(post.Message)
	if a.Srv().License() != nil && *a.Srv().License().Features.LDAPGroups && matched && !a.HasPermissionToChannel(post.UserId, post.ChannelId, model.PERMISSION_USE_GROUP_MENTIONS) {
		post.AddProp(model.POST_PROPS_GROUP_HIGHLIGHT_DISABLED, true)
	}

	return nil
}

func (a *App) handlePostEvents(post *model.Post, user *model.User, channel *model.Channel, triggerWebhooks bool, parentPostList *model.PostList, setOnline bool) error {
	var team *model.Team
	if channel.TeamId != "" {
		t, err := a.Srv().Store.Team().Get(channel.TeamId)
		if err != nil {
			return err
		}
		team = t
	} else {
		// Blank team for DMs
		team = &model.Team{}
	}

	a.invalidateCacheForChannel(channel)
	a.invalidateCacheForChannelPosts(channel.Id)

	if _, err := a.SendNotifications(post, team, channel, user, parentPostList, setOnline); err != nil {
		return err
	}

	if *a.Config().ServiceSettings.ThreadAutoFollow && post.RootId != "" {
		if err := a.Srv().Store.Thread().CreateMembershipIfNeeded(post.UserId, post.RootId, true, false, true); err != nil {
			return err
		}
	}

	if post.Type != model.POST_AUTO_RESPONDER { // don't respond to an auto-responder
		a.Srv().Go(func() {
			_, err := a.SendAutoResponseIfNecessary(channel, user, post)
			if err != nil {
				mlog.Error("Failed to send auto response", mlog.String("user_id", user.Id), mlog.String("post_id", post.Id), mlog.Err(err))
			}
		})
	}

	if triggerWebhooks {
		a.Srv().Go(func() {
			if err := a.handleWebhookEvents(post, team, channel, user); err != nil {
				mlog.Error(err.Error())
			}
		})
	}

	return nil
}

func (a *App) SendEphemeralPost(userId string, post *model.Post) *model.Post {
	post.Type = model.POST_EPHEMERAL

	// fill in fields which haven't been specified which have sensible defaults
	if post.Id == "" {
		post.Id = model.NewId()
	}
	if post.CreateAt == 0 {
		post.CreateAt = model.GetMillis()
	}
	if post.GetProps() == nil {
		post.SetProps(make(model.StringInterface))
	}

	post.GenerateActionIds()
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_EPHEMERAL_MESSAGE, "", post.ChannelId, userId, nil)
	post = a.PreparePostForClient(post, true, false)
	post = model.AddPostActionCookies(post, a.PostActionCookieSecret())
	message.Add("post", post.ToJson())
	a.Publish(message)

	return post
}

func (a *App) UpdateEphemeralPost(userId string, post *model.Post) *model.Post {
	post.Type = model.POST_EPHEMERAL

	post.UpdateAt = model.GetMillis()
	if post.GetProps() == nil {
		post.SetProps(make(model.StringInterface))
	}

	post.GenerateActionIds()
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_EDITED, "", post.ChannelId, userId, nil)
	post = a.PreparePostForClient(post, true, false)
	post = model.AddPostActionCookies(post, a.PostActionCookieSecret())
	message.Add("post", post.ToJson())
	a.Publish(message)

	return post
}

func (a *App) DeleteEphemeralPost(userId, postId string) {
	post := &model.Post{
		Id:       postId,
		UserId:   userId,
		Type:     model.POST_EPHEMERAL,
		DeleteAt: model.GetMillis(),
		UpdateAt: model.GetMillis(),
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_DELETED, "", "", userId, nil)
	message.Add("post", post.ToJson())
	a.Publish(message)
}

func (a *App) UpdatePost(post *model.Post, safeUpdate bool) (*model.Post, *model.AppError) {
	post.SanitizeProps()

	postLists, nErr := a.Srv().Store.Post().Get(post.Id, false, false, false)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("UpdatePost", "app.post.get.app_error", nil, invErr.Error(), http.StatusBadRequest)
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("UpdatePost", "app.post.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("UpdatePost", "app.post.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}
	oldPost := postLists.Posts[post.Id]

	var err *model.AppError
	if oldPost == nil {
		err = model.NewAppError("UpdatePost", "api.post.update_post.find.app_error", nil, "id="+post.Id, http.StatusBadRequest)
		return nil, err
	}

	if oldPost.DeleteAt != 0 {
		err = model.NewAppError("UpdatePost", "api.post.update_post.permissions_details.app_error", map[string]interface{}{"PostId": post.Id}, "", http.StatusBadRequest)
		return nil, err
	}

	if oldPost.IsSystemMessage() {
		err = model.NewAppError("UpdatePost", "api.post.update_post.system_message.app_error", nil, "id="+post.Id, http.StatusBadRequest)
		return nil, err
	}

	if a.Srv().License() != nil {
		if *a.Config().ServiceSettings.PostEditTimeLimit != -1 && model.GetMillis() > oldPost.CreateAt+int64(*a.Config().ServiceSettings.PostEditTimeLimit*1000) && post.Message != oldPost.Message {
			err = model.NewAppError("UpdatePost", "api.post.update_post.permissions_time_limit.app_error", map[string]interface{}{"timeLimit": *a.Config().ServiceSettings.PostEditTimeLimit}, "", http.StatusBadRequest)
			return nil, err
		}
	}

	channel, err := a.GetChannel(oldPost.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("UpdatePost", "api.post.update_post.can_not_update_post_in_deleted.error", nil, "", http.StatusBadRequest)
	}

	newPost := &model.Post{}
	newPost = oldPost.Clone()

	if newPost.Message != post.Message {
		newPost.Message = post.Message
		newPost.EditAt = model.GetMillis()
		newPost.Hashtags, _ = model.ParseHashtags(post.Message)
	}

	if !safeUpdate {
		newPost.IsPinned = post.IsPinned
		newPost.HasReactions = post.HasReactions
		newPost.FileIds = post.FileIds
		newPost.SetProps(post.GetProps())
	}

	// Avoid deep-equal checks if EditAt was already modified through message change
	if newPost.EditAt == oldPost.EditAt && (!oldPost.FileIds.Equals(newPost.FileIds) || !oldPost.AttachmentsEqual(newPost)) {
		newPost.EditAt = model.GetMillis()
	}

	if err = a.FillInPostProps(post, nil); err != nil {
		return nil, err
	}

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		var rejectionReason string
		pluginContext := a.PluginContext()
		pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
			newPost, rejectionReason = hooks.MessageWillBeUpdated(pluginContext, newPost, oldPost)
			return post != nil
		}, plugin.MessageWillBeUpdatedId)
		if newPost == nil {
			return nil, model.NewAppError("UpdatePost", "Post rejected by plugin. "+rejectionReason, nil, "", http.StatusBadRequest)
		}
	}

	rpost, nErr := a.Srv().Store.Post().Update(newPost, oldPost)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UpdatePost", "app.post.update.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		a.Srv().Go(func() {
			pluginContext := a.PluginContext()
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.MessageHasBeenUpdated(pluginContext, newPost, oldPost)
				return true
			}, plugin.MessageHasBeenUpdatedId)
		})
	}

	rpost = a.PreparePostForClient(rpost, false, true)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_EDITED, "", rpost.ChannelId, "", nil)
	message.Add("post", rpost.ToJson())
	a.Publish(message)

	a.invalidateCacheForChannelPosts(rpost.ChannelId)

	return rpost, nil
}

func (a *App) PatchPost(postId string, patch *model.PostPatch) (*model.Post, *model.AppError) {
	post, err := a.GetSinglePost(postId)
	if err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err = model.NewAppError("PatchPost", "api.post.patch_post.can_not_update_post_in_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	if !a.HasPermissionToChannel(post.UserId, post.ChannelId, model.PERMISSION_USE_CHANNEL_MENTIONS) {
		patch.DisableMentionHighlights()
	}

	post.Patch(patch)

	updatedPost, err := a.UpdatePost(post, false)
	if err != nil {
		return nil, err
	}

	return updatedPost, nil
}

func (a *App) GetPostsPage(options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store.Post().GetPosts(options, false)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostsPage", "app.post.get_posts.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("GetPostsPage", "app.post.get_root_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return postList, nil
}

func (a *App) GetPosts(channelId string, offset int, limit int) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store.Post().GetPosts(model.GetPostsOptions{ChannelId: channelId, Page: offset, PerPage: limit}, true)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPosts", "app.post.get_posts.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("GetPosts", "app.post.get_root_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return postList, nil
}

func (a *App) GetPostsEtag(channelId string, collapsedThreads bool) string {
	return a.Srv().Store.Post().GetEtag(channelId, true, collapsedThreads)
}

func (a *App) GetPostsSince(options model.GetPostsSinceOptions) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store.Post().GetPostsSince(options, true)
	if err != nil {
		return nil, model.NewAppError("GetPostsSince", "app.post.get_posts_since.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return postList, nil
}

func (a *App) GetSinglePost(postId string) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store.Post().GetSingle(postId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSinglePost", "app.post.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetSinglePost", "app.post.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return post, nil
}

func (a *App) GetPostThread(postId string, skipFetchThreads, collapsedThreads, collapsedThreadsExtended bool) (*model.PostList, *model.AppError) {
	posts, err := a.Srv().Store.Post().Get(postId, skipFetchThreads, collapsedThreads, collapsedThreadsExtended)
	if err != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostThread", "app.post.get.app_error", nil, invErr.Error(), http.StatusBadRequest)
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetPostThread", "app.post.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetPostThread", "app.post.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return posts, nil
}

func (a *App) GetFlaggedPosts(userId string, offset int, limit int) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store.Post().GetFlaggedPosts(userId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetFlaggedPosts", "app.post.get_flagged_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return postList, nil
}

func (a *App) GetFlaggedPostsForTeam(userId, teamId string, offset int, limit int) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store.Post().GetFlaggedPostsForTeam(userId, teamId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetFlaggedPostsForTeam", "app.post.get_flagged_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return postList, nil
}

func (a *App) GetFlaggedPostsForChannel(userId, channelId string, offset int, limit int) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store.Post().GetFlaggedPostsForChannel(userId, channelId, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetFlaggedPostsForChannel", "app.post.get_flagged_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return postList, nil
}

func (a *App) GetPermalinkPost(postId string, userId string) (*model.PostList, *model.AppError) {
	list, nErr := a.Srv().Store.Post().Get(postId, false, false, false)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("GetPermalinkPost", "app.post.get.app_error", nil, invErr.Error(), http.StatusBadRequest)
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("GetPermalinkPost", "app.post.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetPermalinkPost", "app.post.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	if len(list.Order) != 1 {
		return nil, model.NewAppError("getPermalinkTmp", "api.post_get_post_by_id.get.app_error", nil, "", http.StatusNotFound)
	}
	post := list.Posts[list.Order[0]]

	channel, err := a.GetChannel(post.ChannelId)
	if err != nil {
		return nil, err
	}

	if err = a.JoinChannel(channel, userId); err != nil {
		return nil, err
	}

	return list, nil
}

func (a *App) GetPostsBeforePost(options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store.Post().GetPostsBefore(options)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostsBeforePost", "app.post.get_posts_around.get.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("GetPostsBeforePost", "app.post.get_posts_around.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return postList, nil
}

func (a *App) GetPostsAfterPost(options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store.Post().GetPostsAfter(options)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostsAfterPost", "app.post.get_posts_around.get.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("GetPostsAfterPost", "app.post.get_posts_around.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return postList, nil
}

func (a *App) GetPostsAroundPost(before bool, options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	var postList *model.PostList
	var err error
	if before {
		postList, err = a.Srv().Store.Post().GetPostsBefore(options)
	} else {
		postList, err = a.Srv().Store.Post().GetPostsAfter(options)
	}

	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostsAroundPost", "app.post.get_posts_around.get.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("GetPostsAroundPost", "app.post.get_posts_around.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return postList, nil
}

func (a *App) GetPostAfterTime(channelId string, time int64) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store.Post().GetPostAfterTime(channelId, time)
	if err != nil {
		return nil, model.NewAppError("GetPostAfterTime", "app.post.get_post_after_time.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return post, nil
}

func (a *App) GetPostIdAfterTime(channelId string, time int64) (string, *model.AppError) {
	postId, err := a.Srv().Store.Post().GetPostIdAfterTime(channelId, time)
	if err != nil {
		return "", model.NewAppError("GetPostIdAfterTime", "app.post.get_post_id_around.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return postId, nil
}

func (a *App) GetPostIdBeforeTime(channelId string, time int64) (string, *model.AppError) {
	postId, err := a.Srv().Store.Post().GetPostIdBeforeTime(channelId, time)
	if err != nil {
		return "", model.NewAppError("GetPostIdBeforeTime", "app.post.get_post_id_around.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return postId, nil
}

func (a *App) GetNextPostIdFromPostList(postList *model.PostList) string {
	if len(postList.Order) > 0 {
		firstPostId := postList.Order[0]
		firstPost := postList.Posts[firstPostId]
		nextPostId, err := a.GetPostIdAfterTime(firstPost.ChannelId, firstPost.CreateAt)
		if err != nil {
			mlog.Warn("GetNextPostIdFromPostList: failed in getting next post", mlog.Err(err))
		}

		return nextPostId
	}

	return ""
}

func (a *App) GetPrevPostIdFromPostList(postList *model.PostList) string {
	if len(postList.Order) > 0 {
		lastPostId := postList.Order[len(postList.Order)-1]
		lastPost := postList.Posts[lastPostId]
		previousPostId, err := a.GetPostIdBeforeTime(lastPost.ChannelId, lastPost.CreateAt)
		if err != nil {
			mlog.Warn("GetPrevPostIdFromPostList: failed in getting previous post", mlog.Err(err))
		}

		return previousPostId
	}

	return ""
}

// AddCursorIdsForPostList adds NextPostId and PrevPostId as cursor to the PostList.
// The conditional blocks ensure that it sets those cursor IDs immediately as afterPost, beforePost or empty,
// and only query to database whenever necessary.
func (a *App) AddCursorIdsForPostList(originalList *model.PostList, afterPost, beforePost string, since int64, page, perPage int) {
	prevPostIdSet := false
	prevPostId := ""
	nextPostIdSet := false
	nextPostId := ""

	if since > 0 { // "since" query to return empty NextPostId and PrevPostId
		nextPostIdSet = true
		prevPostIdSet = true
	} else if afterPost != "" {
		if page == 0 {
			prevPostId = afterPost
			prevPostIdSet = true
		}

		if len(originalList.Order) < perPage {
			nextPostIdSet = true
		}
	} else if beforePost != "" {
		if page == 0 {
			nextPostId = beforePost
			nextPostIdSet = true
		}

		if len(originalList.Order) < perPage {
			prevPostIdSet = true
		}
	}

	if !nextPostIdSet {
		nextPostId = a.GetNextPostIdFromPostList(originalList)
	}

	if !prevPostIdSet {
		prevPostId = a.GetPrevPostIdFromPostList(originalList)
	}

	originalList.NextPostId = nextPostId
	originalList.PrevPostId = prevPostId
}
func (a *App) GetPostsForChannelAroundLastUnread(channelId, userId string, limitBefore, limitAfter int, skipFetchThreads bool, collapsedThreads, collapsedThreadsExtended bool) (*model.PostList, *model.AppError) {
	var member *model.ChannelMember
	var err *model.AppError
	if member, err = a.GetChannelMember(channelId, userId); err != nil {
		return nil, err
	} else if member.LastViewedAt == 0 {
		return model.NewPostList(), nil
	}

	lastUnreadPostId, err := a.GetPostIdAfterTime(channelId, member.LastViewedAt)
	if err != nil {
		return nil, err
	} else if lastUnreadPostId == "" {
		return model.NewPostList(), nil
	}

	postList, err := a.GetPostThread(lastUnreadPostId, skipFetchThreads, collapsedThreads, collapsedThreadsExtended)
	if err != nil {
		return nil, err
	}
	// Reset order to only include the last unread post: if the thread appears in the centre
	// channel organically, those replies will be added below.
	postList.Order = []string{lastUnreadPostId}

	if postListBefore, err := a.GetPostsBeforePost(model.GetPostsOptions{ChannelId: channelId, PostId: lastUnreadPostId, Page: PageDefault, PerPage: limitBefore, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended}); err != nil {
		return nil, err
	} else if postListBefore != nil {
		postList.Extend(postListBefore)
	}

	if postListAfter, err := a.GetPostsAfterPost(model.GetPostsOptions{ChannelId: channelId, PostId: lastUnreadPostId, Page: PageDefault, PerPage: limitAfter - 1, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended}); err != nil {
		return nil, err
	} else if postListAfter != nil {
		postList.Extend(postListAfter)
	}

	postList.SortByCreateAt()
	return postList, nil
}

func (a *App) DeletePost(postId, deleteByID string) (*model.Post, *model.AppError) {
	post, nErr := a.Srv().Store.Post().GetSingle(postId)
	if nErr != nil {
		return nil, model.NewAppError("DeletePost", "app.post.get.app_error", nil, nErr.Error(), http.StatusBadRequest)
	}

	channel, err := a.GetChannel(post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err := model.NewAppError("DeletePost", "api.post.delete_post.can_not_delete_post_in_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	if err := a.Srv().Store.Post().Delete(postId, model.GetMillis(), deleteByID); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeletePost", "app.post.delete.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("DeletePost", "app.post.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	postData := a.PreparePostForClient(post, false, false).ToJson()

	userMessage := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_DELETED, "", post.ChannelId, "", nil)
	userMessage.Add("post", postData)
	userMessage.GetBroadcast().ContainsSanitizedData = true
	a.Publish(userMessage)

	adminMessage := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_DELETED, "", post.ChannelId, "", nil)
	adminMessage.Add("post", postData)
	adminMessage.Add("delete_by", deleteByID)
	adminMessage.GetBroadcast().ContainsSensitiveData = true
	a.Publish(adminMessage)

	a.Srv().Go(func() {
		a.DeletePostFiles(post)
	})
	a.Srv().Go(func() {
		a.DeleteFlaggedPosts(post.Id)
	})

	a.invalidateCacheForChannelPosts(post.ChannelId)

	return post, nil
}

func (a *App) DeleteFlaggedPosts(postId string) {
	if err := a.Srv().Store.Preference().DeleteCategoryAndName(model.PREFERENCE_CATEGORY_FLAGGED_POST, postId); err != nil {
		mlog.Warn("Unable to delete flagged post preference when deleting post.", mlog.Err(err))
		return
	}
}

func (a *App) DeletePostFiles(post *model.Post) {
	if len(post.FileIds) == 0 {
		return
	}

	if _, err := a.Srv().Store.FileInfo().DeleteForPost(post.Id); err != nil {
		mlog.Warn("Encountered error when deleting files for post", mlog.String("post_id", post.Id), mlog.Err(err))
	}
}

func (a *App) parseAndFetchChannelIdByNameFromInFilter(channelName, userId, teamId string, includeDeleted bool) (*model.Channel, error) {
	if strings.HasPrefix(channelName, "@") && strings.Contains(channelName, ",") {
		var userIds []string
		users, err := a.GetUsersByUsernames(strings.Split(channelName[1:], ","), false, nil)
		if err != nil {
			return nil, err
		}
		for _, user := range users {
			userIds = append(userIds, user.Id)
		}

		channel, err := a.GetGroupChannel(userIds)
		if err != nil {
			return nil, err
		}
		return channel, nil
	}

	if strings.HasPrefix(channelName, "@") && !strings.Contains(channelName, ",") {
		user, err := a.GetUserByUsername(channelName[1:])
		if err != nil {
			return nil, err
		}
		channel, err := a.GetOrCreateDirectChannel(userId, user.Id)
		if err != nil {
			return nil, err
		}
		return channel, nil
	}

	channel, err := a.GetChannelByName(channelName, teamId, includeDeleted)
	if err != nil {
		return nil, err
	}
	return channel, nil
}

func (a *App) searchPostsInTeam(teamId string, userId string, paramsList []*model.SearchParams, modifierFun func(*model.SearchParams)) (*model.PostList, *model.AppError) {
	var wg sync.WaitGroup

	pchan := make(chan store.StoreResult, len(paramsList))

	for _, params := range paramsList {
		// Don't allow users to search for everything.
		if params.Terms == "*" {
			continue
		}
		modifierFun(params)
		wg.Add(1)

		go func(params *model.SearchParams) {
			defer wg.Done()
			postList, err := a.Srv().Store.Post().Search(teamId, userId, params)
			pchan <- store.StoreResult{Data: postList, NErr: err}
		}(params)
	}

	wg.Wait()
	close(pchan)

	posts := model.NewPostList()

	for result := range pchan {
		if result.NErr != nil {
			return nil, model.NewAppError("searchPostsInTeam", "app.post.search.app_error", nil, result.NErr.Error(), http.StatusInternalServerError)
		}
		data := result.Data.(*model.PostList)
		posts.Extend(data)
	}

	posts.SortByCreateAt()
	return posts, nil
}

func (a *App) convertChannelNamesToChannelIds(channels []string, userId string, teamId string, includeDeletedChannels bool) []string {
	for idx, channelName := range channels {
		channel, err := a.parseAndFetchChannelIdByNameFromInFilter(channelName, userId, teamId, includeDeletedChannels)
		if err != nil {
			mlog.Warn("error getting channel id by name from in filter", mlog.Err(err))
			continue
		}
		channels[idx] = channel.Id
	}
	return channels
}

func (a *App) convertUserNameToUserIds(usernames []string) []string {
	for idx, username := range usernames {
		user, err := a.GetUserByUsername(username)
		if err != nil {
			mlog.Warn("error getting user by username", mlog.String("user_name", username), mlog.Err(err))
			continue
		}
		usernames[idx] = user.Id
	}
	return usernames
}

func (a *App) SearchPostsInTeam(teamId string, paramsList []*model.SearchParams) (*model.PostList, *model.AppError) {
	if !*a.Config().ServiceSettings.EnablePostSearch {
		return nil, model.NewAppError("SearchPostsInTeam", "store.sql_post.search.disabled", nil, fmt.Sprintf("teamId=%v", teamId), http.StatusNotImplemented)
	}
	return a.searchPostsInTeam(teamId, "", paramsList, func(params *model.SearchParams) {
		params.SearchWithoutUserId = true
	})
}

func (a *App) SearchPostsInTeamForUser(terms string, userId string, teamId string, isOrSearch bool, includeDeletedChannels bool, timeZoneOffset int, page, perPage int) (*model.PostSearchResults, *model.AppError) {
	var postSearchResults *model.PostSearchResults
	paramsList := model.ParseSearchParams(strings.TrimSpace(terms), timeZoneOffset)
	includeDeleted := includeDeletedChannels && *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	if !*a.Config().ServiceSettings.EnablePostSearch {
		return nil, model.NewAppError("SearchPostsInTeamForUser", "store.sql_post.search.disabled", nil, fmt.Sprintf("teamId=%v userId=%v", teamId, userId), http.StatusNotImplemented)
	}

	finalParamsList := []*model.SearchParams{}

	for _, params := range paramsList {
		params.OrTerms = isOrSearch
		params.IncludeDeletedChannels = includeDeleted
		// Don't allow users to search for "*"
		if params.Terms != "*" {
			// Convert channel names to channel IDs
			params.InChannels = a.convertChannelNamesToChannelIds(params.InChannels, userId, teamId, includeDeletedChannels)
			params.ExcludedChannels = a.convertChannelNamesToChannelIds(params.ExcludedChannels, userId, teamId, includeDeletedChannels)

			// Convert usernames to user IDs
			params.FromUsers = a.convertUserNameToUserIds(params.FromUsers)
			params.ExcludedUsers = a.convertUserNameToUserIds(params.ExcludedUsers)

			finalParamsList = append(finalParamsList, params)
		}
	}

	// If the processed search params are empty, return empty search results.
	if len(finalParamsList) == 0 {
		return model.MakePostSearchResults(model.NewPostList(), nil), nil
	}

	postSearchResults, nErr := a.Srv().Store.Post().SearchPostsInTeamForUser(finalParamsList, userId, teamId, page, perPage)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SearchPostsInTeamForUser", "app.post.search.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	return postSearchResults, nil
}

func (a *App) GetFileInfosForPostWithMigration(postId string) ([]*model.FileInfo, *model.AppError) {

	pchan := make(chan store.StoreResult, 1)
	go func() {
		post, err := a.Srv().Store.Post().GetSingle(postId)
		pchan <- store.StoreResult{Data: post, NErr: err}
		close(pchan)
	}()

	infos, err := a.GetFileInfosForPost(postId, false)
	if err != nil {
		return nil, err
	}

	if len(infos) == 0 {
		// No FileInfos were returned so check if they need to be created for this post
		result := <-pchan
		if result.NErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(result.NErr, &nfErr):
				return nil, model.NewAppError("GetFileInfosForPostWithMigration", "app.post.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
			default:
				return nil, model.NewAppError("GetFileInfosForPostWithMigration", "app.post.get.app_error", nil, result.NErr.Error(), http.StatusInternalServerError)
			}
		}
		post := result.Data.(*model.Post)

		if len(post.Filenames) > 0 {
			a.Srv().Store.FileInfo().InvalidateFileInfosForPostCache(postId, false)
			a.Srv().Store.FileInfo().InvalidateFileInfosForPostCache(postId, true)
			// The post has Filenames that need to be replaced with FileInfos
			infos = a.MigrateFilenamesToFileInfos(post)
		}
	}

	return infos, nil
}

func (a *App) GetFileInfosForPost(postId string, fromMaster bool) ([]*model.FileInfo, *model.AppError) {
	fileInfos, err := a.Srv().Store.FileInfo().GetForPost(postId, fromMaster, false, true)
	if err != nil {
		return nil, model.NewAppError("GetFileInfosForPost", "app.file_info.get_for_post.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.generateMiniPreviewForInfos(fileInfos)

	return fileInfos, nil
}

func (a *App) PostWithProxyAddedToImageURLs(post *model.Post) *model.Post {
	if f := a.ImageProxyAdder(); f != nil {
		return post.WithRewrittenImageURLs(f)
	}
	return post
}

func (a *App) PostWithProxyRemovedFromImageURLs(post *model.Post) *model.Post {
	if f := a.ImageProxyRemover(); f != nil {
		return post.WithRewrittenImageURLs(f)
	}
	return post
}

func (a *App) PostPatchWithProxyRemovedFromImageURLs(patch *model.PostPatch) *model.PostPatch {
	if f := a.ImageProxyRemover(); f != nil {
		return patch.WithRewrittenImageURLs(f)
	}
	return patch
}

func (a *App) ImageProxyAdder() func(string) string {
	if !*a.Config().ImageProxySettings.Enable {
		return nil
	}

	return func(url string) string {
		return a.Srv().ImageProxy.GetProxiedImageURL(url)
	}
}

func (a *App) ImageProxyRemover() (f func(string) string) {
	if !*a.Config().ImageProxySettings.Enable {
		return nil
	}

	return func(url string) string {
		return a.Srv().ImageProxy.GetUnproxiedImageURL(url)
	}
}

func (s *Server) MaxPostSize() int {
	maxPostSize := s.Store.Post().GetMaxPostSize()
	if maxPostSize == 0 {
		return model.POST_MESSAGE_MAX_RUNES_V1
	}

	return maxPostSize
}

func (a *App) MaxPostSize() int {
	return a.Srv().MaxPostSize()
}

// countThreadMentions returns the number of times the user is mentioned in a specified thread after the timestamp.
func (a *App) countThreadMentions(user *model.User, post *model.Post, teamId string, timestamp int64) (int64, *model.AppError) {
	channel, err := a.GetChannel(post.ChannelId)
	if err != nil {
		return 0, err
	}

	keywords := addMentionKeywordsForUser(
		map[string][]string{},
		user,
		map[string]string{},
		&model.Status{Status: model.STATUS_ONLINE}, // Assume the user is online since they would've triggered this
		true, // Assume channel mentions are always allowed for simplicity
	)

	posts, nErr := a.Srv().Store.Thread().GetPosts(post.Id, timestamp)
	if nErr != nil {
		return 0, model.NewAppError("countMentionsFromPost", "app.channel.count_posts_since.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	count := 0

	if channel.Type == model.CHANNEL_DIRECT {
		// In a DM channel, every post made by the other user is a mention
		otherId := channel.GetOtherUserIdForDM(user.Id)
		for _, p := range posts {
			if p.UserId == otherId {
				count++
			}
		}

		return int64(count), nil
	}

	var team *model.Team
	if teamId != "" {
		team, err = a.GetTeam(teamId)
		if err != nil {
			return 0, err
		}
	}

	groups, nErr := a.getGroupsAllowedForReferenceInChannel(channel, team)
	if nErr != nil {
		return 0, model.NewAppError("countMentionsFromPost", "app.channel.count_posts_since.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	mentions := getExplicitMentions(post, keywords, groups)
	if _, ok := mentions.Mentions[user.Id]; ok {
		count += 1
	}

	for _, p := range posts {
		mentions = getExplicitMentions(p, keywords, groups)
		if _, ok := mentions.Mentions[user.Id]; ok {
			count += 1
		}
	}

	return int64(count), nil
}

// countMentionsFromPost returns the number of posts in the post's channel that mention the user after and including the
// given post.
func (a *App) countMentionsFromPost(user *model.User, post *model.Post) (int, *model.AppError) {
	channel, err := a.GetChannel(post.ChannelId)
	if err != nil {
		return 0, err
	}

	if channel.Type == model.CHANNEL_DIRECT {
		// In a DM channel, every post made by the other user is a mention
		count, nErr := a.Srv().Store.Channel().CountPostsAfter(post.ChannelId, post.CreateAt-1, channel.GetOtherUserIdForDM(user.Id))
		if nErr != nil {
			return 0, model.NewAppError("countMentionsFromPost", "app.channel.count_posts_since.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}

		return count, nil
	}

	channelMember, err := a.GetChannelMember(channel.Id, user.Id)
	if err != nil {
		return 0, err
	}

	keywords := addMentionKeywordsForUser(
		map[string][]string{},
		user,
		channelMember.NotifyProps,
		&model.Status{Status: model.STATUS_ONLINE}, // Assume the user is online since they would've triggered this
		true, // Assume channel mentions are always allowed for simplicity
	)
	commentMentions := user.NotifyProps[model.COMMENTS_NOTIFY_PROP]
	checkForCommentMentions := commentMentions == model.COMMENTS_NOTIFY_ROOT || commentMentions == model.COMMENTS_NOTIFY_ANY

	// A mapping of thread root IDs to whether or not a post in that thread mentions the user
	mentionedByThread := make(map[string]bool)

	thread, err := a.GetPostThread(post.Id, false, false, false)
	if err != nil {
		return 0, err
	}

	count := 0

	if isPostMention(user, post, keywords, thread.Posts, mentionedByThread, checkForCommentMentions) {
		count += 1
	}

	page := 0
	perPage := 200
	for {
		postList, err := a.GetPostsAfterPost(model.GetPostsOptions{
			ChannelId: post.ChannelId,
			PostId:    post.Id,
			Page:      page,
			PerPage:   perPage,
		})
		if err != nil {
			return 0, err
		}

		for _, postId := range postList.Order {
			if isPostMention(user, postList.Posts[postId], keywords, postList.Posts, mentionedByThread, checkForCommentMentions) {
				count += 1
			}
		}

		if len(postList.Order) < perPage {
			break
		}

		page += 1
	}

	return count, nil
}

func isCommentMention(user *model.User, post *model.Post, otherPosts map[string]*model.Post, mentionedByThread map[string]bool) bool {
	if post.RootId == "" {
		// Not a comment
		return false
	}

	if mentioned, ok := mentionedByThread[post.RootId]; ok {
		// We've already figured out if the user was mentioned by this thread
		return mentioned
	}

	// Whether or not the user was mentioned because they started the thread
	mentioned := otherPosts[post.RootId].UserId == user.Id

	// Or because they commented on it before this post
	if !mentioned && user.NotifyProps[model.COMMENTS_NOTIFY_PROP] == model.COMMENTS_NOTIFY_ANY {
		for _, otherPost := range otherPosts {
			if otherPost.Id == post.Id {
				continue
			}

			if otherPost.RootId != post.RootId {
				continue
			}

			if otherPost.UserId == user.Id && otherPost.CreateAt < post.CreateAt {
				// Found a comment made by the user from before this post
				mentioned = true
				break
			}
		}
	}

	mentionedByThread[post.RootId] = mentioned
	return mentioned
}

func isPostMention(user *model.User, post *model.Post, keywords map[string][]string, otherPosts map[string]*model.Post, mentionedByThread map[string]bool, checkForCommentMentions bool) bool {
	// Prevent the user from mentioning themselves
	if post.UserId == user.Id && post.GetProp("from_webhook") != "true" {
		return false
	}

	// Check for keyword mentions
	mentions := getExplicitMentions(post, keywords, make(map[string]*model.Group))
	if _, ok := mentions.Mentions[user.Id]; ok {
		return true
	}

	// Check for mentions caused by being added to the channel
	if post.Type == model.POST_ADD_TO_CHANNEL {
		if addedUserId, ok := post.GetProp(model.POST_PROPS_ADDED_USER_ID).(string); ok && addedUserId == user.Id {
			return true
		}
	}

	// Check for comment mentions
	if checkForCommentMentions && isCommentMention(user, post, otherPosts, mentionedByThread) {
		return true
	}

	return false
}

func (a *App) GetThreadMembershipsForUser(userId, teamId string) ([]*model.ThreadMembership, error) {
	return a.Srv().Store.Thread().GetMembershipsForUser(userId, teamId)
}
