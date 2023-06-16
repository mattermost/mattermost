// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/channels/product"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const (
	PendingPostIDsCacheSize = 25000
	PendingPostIDsCacheTTL  = 30 * time.Second
	PageDefault             = 0
)

var atMentionPattern = regexp.MustCompile(`\B@`)

// Ensure post service wrapper implements `product.PostService`
var _ product.PostService = (*postServiceWrapper)(nil)

// postServiceWrapper provides an implementation of `product.PostService` for use by products.
type postServiceWrapper struct {
	app AppIface
}

func (s *postServiceWrapper) CreatePost(ctx *request.Context, post *model.Post) (*model.Post, *model.AppError) {
	return s.app.CreatePostMissingChannel(ctx, post, true, true)
}

func (s *postServiceWrapper) GetPostsByIds(postIDs []string) ([]*model.Post, int64, *model.AppError) {
	return s.app.GetPostsByIds(postIDs)
}

func (s *postServiceWrapper) SendEphemeralPost(ctx *request.Context, userID string, post *model.Post) *model.Post {
	return s.app.SendEphemeralPost(ctx, userID, post)
}

func (s *postServiceWrapper) GetPost(postID string) (*model.Post, *model.AppError) {
	return s.app.GetSinglePost(postID, false)
}

func (s *postServiceWrapper) DeletePost(ctx *request.Context, postID, productID string) (*model.Post, *model.AppError) {
	return s.app.DeletePost(ctx, postID, productID)
}

func (s *postServiceWrapper) UpdatePost(ctx *request.Context, post *model.Post, safeUpdate bool) (*model.Post, *model.AppError) {
	return s.app.UpdatePost(ctx, post, false)
}

func (a *App) CreatePostAsUser(c request.CTX, post *model.Post, currentSessionId string, setOnline bool) (*model.Post, *model.AppError) {
	// Check that channel has not been deleted
	channel, errCh := a.Srv().Store().Channel().Get(post.ChannelId, true)
	if errCh != nil {
		err := model.NewAppError("CreatePostAsUser", "api.context.invalid_param.app_error", map[string]any{"Name": "post.channel_id"}, "", http.StatusBadRequest).Wrap(errCh)
		return nil, err
	}

	if strings.HasPrefix(post.Type, model.PostSystemMessagePrefix) {
		err := model.NewAppError("CreatePostAsUser", "api.context.invalid_param.app_error", map[string]any{"Name": "post.type"}, "", http.StatusBadRequest)
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err := model.NewAppError("createPost", "api.post.create_post.can_not_post_to_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	rp, err := a.CreatePost(c, post, channel, true, setOnline)
	if err != nil {
		if err.Id == "api.post.create_post.root_id.app_error" ||
			err.Id == "api.post.create_post.channel_root_id.app_error" {
			err.StatusCode = http.StatusBadRequest
		}

		return nil, err
	}

	// Update the Channel LastViewAt only if:
	// the post does NOT have from_webhook prop set (e.g. Zapier app), and
	// the post does NOT have from_bot set (e.g. from discovering the user is a bot within CreatePost), and
	// the post is NOT a reply post with CRT enabled
	_, fromWebhook := post.GetProps()["from_webhook"]
	_, fromBot := post.GetProps()["from_bot"]
	isCRTReply := post.RootId != "" && a.IsCRTEnabledForUser(c, post.UserId)
	if !fromWebhook && !fromBot && !isCRTReply {
		if _, err := a.MarkChannelsAsViewed(c, []string{post.ChannelId}, post.UserId, currentSessionId, true); err != nil {
			c.Logger().Warn(
				"Encountered error updating last viewed",
				mlog.String("channel_id", post.ChannelId),
				mlog.String("user_id", post.UserId),
				mlog.Err(err),
			)
		}
	}

	return rp, nil
}

func (a *App) CreatePostMissingChannel(c request.CTX, post *model.Post, triggerWebhooks bool, setOnline bool) (*model.Post, *model.AppError) {
	channel, err := a.Srv().Store().Channel().Get(post.ChannelId, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("CreatePostMissingChannel", "app.channel.get.existing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("CreatePostMissingChannel", "app.channel.get.find.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return a.CreatePost(c, post, channel, triggerWebhooks, setOnline)
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
	var postID string
	nErr := a.Srv().seenPendingPostIdsCache.Get(post.PendingPostId, &postID)
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
	if postID == unknownPostId {
		return nil, model.NewAppError("deduplicateCreatePost", "api.post.deduplicate_create_post.pending", nil, "", http.StatusInternalServerError)
	}

	// If the other thread finished creating the post, return the created post back to the
	// client, making the API call feel idempotent.
	actualPost, err := a.GetSinglePost(postID, false)
	if err != nil {
		return nil, model.NewAppError("deduplicateCreatePost", "api.post.deduplicate_create_post.failed_to_get", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	mlog.Debug("Deduplicated create post", mlog.String("post_id", actualPost.Id), mlog.String("pending_post_id", post.PendingPostId))

	return actualPost, nil
}

func (a *App) CreatePost(c request.CTX, post *model.Post, channel *model.Channel, triggerWebhooks, setOnline bool) (savedPost *model.Post, err *model.AppError) {
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

	// Validate recipients counts in case it's not DM
	if persistentNotification := post.GetPersistentNotification(); persistentNotification != nil && *persistentNotification && channel.Type != model.ChannelTypeDirect {
		err := a.forEachPersistentNotificationPost([]*model.Post{post}, func(_ *model.Post, _ *model.Channel, _ *model.Team, mentions *ExplicitMentions, _ model.UserMap, _ map[string]map[string]model.StringMap) error {
			if maxRecipients := *a.Config().ServiceSettings.PersistentNotificationMaxRecipients; len(mentions.Mentions) > maxRecipients {
				return model.NewAppError("CreatePost", "api.post.post_priority.max_recipients_persistent_notification_post.request_error", map[string]any{"MaxRecipients": maxRecipients}, "", http.StatusBadRequest)
			} else if len(mentions.Mentions) == 0 {
				return model.NewAppError("CreatePost", "api.post.post_priority.min_recipients_persistent_notification_post.request_error", nil, "", http.StatusBadRequest)
			}
			return nil
		})
		if err != nil {
			return nil, model.NewAppError("CreatePost", "api.post.post_priority.persistent_notification_validation_error.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	post.SanitizeProps()

	var pchan chan store.StoreResult
	if post.RootId != "" {
		pchan = make(chan store.StoreResult, 1)
		go func() {
			r, pErr := a.Srv().Store().Post().Get(sqlstore.WithMaster(context.Background()), post.RootId, model.GetPostsOptions{}, "", a.Config().GetSanitizeOptions())
			pchan <- store.StoreResult{Data: r, NErr: pErr}
			close(pchan)
		}()
	}

	user, nErr := a.Srv().Store().User().Get(context.Background(), post.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreatePost", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("CreatePost", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if user.IsBot {
		post.AddProp("from_bot", "true")
	}

	if c.Session().IsOAuth {
		post.AddProp("from_oauth_app", "true")
	}

	var ephemeralPost *model.Post
	if post.Type == "" && !a.HasPermissionToChannel(c, user.Id, channel.Id, model.PermissionUseChannelMentions) {
		mention := post.DisableMentionHighlights()
		if mention != "" {
			T := i18n.GetUserTranslations(user.Locale)
			ephemeralPost = &model.Post{
				UserId:    user.Id,
				RootId:    post.RootId,
				ChannelId: channel.Id,
				Message:   T("model.post.channel_notifications_disabled_in_channel.message", model.StringInterface{"ChannelName": channel.Name, "Mention": mention}),
				Props:     model.StringInterface{model.PostPropsMentionHighlightDisabled: true},
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
	}

	post.Hashtags, _ = model.ParseHashtags(post.Message)

	if err = a.FillInPostProps(c, post, channel); err != nil {
		return nil, err
	}

	// Temporary fix so old plugins don't clobber new fields in SlackAttachment struct, see MM-13088
	if attachments, ok := post.GetProp("attachments").([]*model.SlackAttachment); ok {
		jsonAttachments, err := json.Marshal(attachments)
		if err == nil {
			attachmentsInterface := []any{}
			err = json.Unmarshal(jsonAttachments, &attachmentsInterface)
			post.AddProp("attachments", attachmentsInterface)
		}
		if err != nil {
			c.Logger().Warn("Could not convert post attachments to map interface.", mlog.Err(err))
		}
	}

	var metadata *model.PostMetadata
	if post.Metadata != nil {
		metadata = post.Metadata.Copy()
	}
	var rejectionError *model.AppError
	pluginContext := pluginContext(c)
	a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
		replacementPost, rejectionReason := hooks.MessageWillBePosted(pluginContext, post.ForPlugin())
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
			if post.Metadata != nil && metadata != nil {
				post.Metadata.Priority = metadata.Priority
			} else {
				post.Metadata = metadata
			}
		}

		return true
	}, plugin.MessageWillBePostedID)

	if rejectionError != nil {
		return nil, rejectionError
	}

	// Pre-fill the CreateAt field for link previews to get the correct timestamp.
	if post.CreateAt == 0 {
		post.CreateAt = model.GetMillis()
	}

	post = a.getEmbedsAndImages(c, post, true)
	previewPost := post.GetPreviewPost()
	if previewPost != nil {
		post.AddProp(model.PostPropsPreviewedPost, previewPost.PostID)
	}

	rpost, nErr := a.Srv().Store().Post().Save(post)
	if nErr != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("CreatePost", "app.post.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		default:
			return nil, model.NewAppError("CreatePost", "app.post.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	// Update the mapping from pending post id to the actual post id, for any clients that
	// might be duplicating requests.
	a.Srv().seenPendingPostIdsCache.SetWithExpiry(post.PendingPostId, rpost.Id, PendingPostIDsCacheTTL)

	// We make a copy of the post for the plugin hook to avoid a race condition,
	// and to remove the non-GOB-encodable Metadata from it.
	pluginPost := rpost.ForPlugin()
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.MessageHasBeenPosted(pluginContext, pluginPost)
			return true
		}, plugin.MessageHasBeenPostedID)
	})

	if a.Metrics() != nil {
		a.Metrics().IncrementPostCreate()
	}

	if len(post.FileIds) > 0 {
		if err = a.attachFilesToPost(post); err != nil {
			c.Logger().Warn("Encountered error attaching files to post", mlog.String("post_id", post.Id), mlog.Any("file_ids", post.FileIds), mlog.Err(err))
		}

		if a.Metrics() != nil {
			a.Metrics().IncrementPostFileAttachment(len(post.FileIds))
		}
	}

	// Normally, we would let the API layer call PreparePostForClient, but we do it here since it also needs
	// to be done when we send the post over the websocket in handlePostEvents
	// PS: we don't want to include PostPriority from the db to avoid the replica lag,
	// so we just return the one that was passed with post
	rpost = a.PreparePostForClient(c, rpost, true, false, false)

	if rpost.RootId != "" {
		if appErr := a.ResolvePersistentNotification(c, parentPostList.Posts[post.RootId], rpost.UserId); appErr != nil {
			return nil, appErr
		}
	}

	// Make sure poster is following the thread
	if *a.Config().ServiceSettings.ThreadAutoFollow && rpost.RootId != "" {
		_, err := a.Srv().Store().Thread().MaintainMembership(user.Id, rpost.RootId, store.ThreadMembershipOpts{
			Following:       true,
			UpdateFollowing: true,
		})
		if err != nil {
			c.Logger().Warn("Failed to update thread membership", mlog.Err(err))
		}
	}

	if err := a.handlePostEvents(c, rpost, user, channel, triggerWebhooks, parentPostList, setOnline); err != nil {
		c.Logger().Warn("Failed to handle post events", mlog.Err(err))
	}

	// Send any ephemeral posts after the post is created to ensure it shows up after the latest post created
	if ephemeralPost != nil {
		a.SendEphemeralPost(c, post.UserId, ephemeralPost)
	}

	rpost, err = a.SanitizePostMetadataForUser(c, rpost, c.Session().UserId)
	if err != nil {
		return nil, err
	}

	return rpost, nil
}

func (a *App) addPostPreviewProp(post *model.Post) (*model.Post, error) {
	previewPost := post.GetPreviewPost()
	if previewPost != nil {
		updatedPost := post.Clone()
		updatedPost.AddProp(model.PostPropsPreviewedPost, previewPost.PostID)
		updatedPost, err := a.Srv().Store().Post().Update(updatedPost, post)
		return updatedPost, err
	}
	return post, nil
}

func (a *App) attachFilesToPost(post *model.Post) *model.AppError {
	var attachedIds []string
	for _, fileID := range post.FileIds {
		err := a.Srv().Store().FileInfo().AttachToPost(fileID, post.Id, post.ChannelId, post.UserId)
		if err != nil {
			mlog.Warn("Failed to attach file to post", mlog.String("file_id", fileID), mlog.String("post_id", post.Id), mlog.Err(err))
			continue
		}

		attachedIds = append(attachedIds, fileID)
	}

	if len(post.FileIds) != len(attachedIds) {
		// We couldn't attach all files to the post, so ensure that post.FileIds reflects what was actually attached
		post.FileIds = attachedIds

		if _, err := a.Srv().Store().Post().Overwrite(post); err != nil {
			return model.NewAppError("attachFilesToPost", "app.post.overwrite.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

// FillInPostProps should be invoked before saving posts to fill in properties such as
// channel_mentions.
//
// If channel is nil, FillInPostProps will look up the channel corresponding to the post.
func (a *App) FillInPostProps(c request.CTX, post *model.Post, channel *model.Channel) *model.AppError {
	channelMentions := post.ChannelMentions()
	channelMentionsProp := make(map[string]any)

	if len(channelMentions) > 0 {
		if channel == nil {
			postChannel, err := a.Srv().Store().Channel().GetForPost(post.Id)
			if err != nil {
				return model.NewAppError("FillInPostProps", "api.context.invalid_param.app_error", map[string]any{"Name": "post.channel_id"}, "", http.StatusBadRequest).Wrap(err)
			}
			channel = postChannel
		}

		mentionedChannels, err := a.GetChannelsByNames(c, channelMentions, channel.TeamId)
		if err != nil {
			return err
		}

		for _, mentioned := range mentionedChannels {
			if mentioned.Type == model.ChannelTypeOpen {
				team, err := a.Srv().Store().Team().Get(mentioned.TeamId)
				if err != nil {
					mlog.Warn("Failed to get team of the channel mention", mlog.String("team_id", channel.TeamId), mlog.String("channel_id", channel.Id), mlog.Err(err))
					continue
				}
				channelMentionsProp[mentioned.Name] = map[string]any{
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

	matched := atMentionPattern.MatchString(post.Message)
	if a.Srv().License() != nil && *a.Srv().License().Features.LDAPGroups && matched && !a.HasPermissionToChannel(c, post.UserId, post.ChannelId, model.PermissionUseGroupMentions) {
		post.AddProp(model.PostPropsGroupHighlightDisabled, true)
	}

	return nil
}

func (a *App) handlePostEvents(c request.CTX, post *model.Post, user *model.User, channel *model.Channel, triggerWebhooks bool, parentPostList *model.PostList, setOnline bool) error {
	var team *model.Team
	if channel.TeamId != "" {
		t, err := a.Srv().Store().Team().Get(channel.TeamId)
		if err != nil {
			return err
		}
		team = t
	} else {
		// Blank team for DMs
		team = &model.Team{}
	}

	a.Srv().Platform().InvalidateCacheForChannel(channel)
	a.invalidateCacheForChannelPosts(channel.Id)

	if _, err := a.SendNotifications(c, post, team, channel, user, parentPostList, setOnline); err != nil {
		return err
	}

	if post.Type != model.PostTypeAutoResponder { // don't respond to an auto-responder
		a.Srv().Go(func() {
			_, err := a.SendAutoResponseIfNecessary(c, channel, user, post)
			if err != nil {
				mlog.Error("Failed to send auto response", mlog.String("user_id", user.Id), mlog.String("post_id", post.Id), mlog.Err(err))
			}
		})
	}

	if triggerWebhooks {
		a.Srv().Go(func() {
			if err := a.handleWebhookEvents(c, post, team, channel, user); err != nil {
				mlog.Error(err.Error())
			}
		})
	}

	return nil
}

func (a *App) SendEphemeralPost(c request.CTX, userID string, post *model.Post) *model.Post {
	post.Type = model.PostTypeEphemeral

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
	message := model.NewWebSocketEvent(model.WebsocketEventEphemeralMessage, "", post.ChannelId, userID, nil, "")
	post = a.PreparePostForClientWithEmbedsAndImages(c, post, true, false, true)
	post = model.AddPostActionCookies(post, a.PostActionCookieSecret())

	sanitizedPost, appErr := a.SanitizePostMetadataForUser(c, post, userID)
	if appErr != nil {
		mlog.Error("Failed to sanitize post metadata for user", mlog.String("user_id", userID), mlog.Err(appErr))

		// If we failed to sanitize the post, we still want to remove the metadata.
		sanitizedPost = post.Clone()
		sanitizedPost.Metadata = nil
	}
	post = sanitizedPost

	postJSON, jsonErr := post.ToJSON()
	if jsonErr != nil {
		mlog.Warn("Failed to encode post to JSON", mlog.Err(jsonErr))
	}
	message.Add("post", postJSON)
	a.Publish(message)

	return post
}

func (a *App) UpdateEphemeralPost(c request.CTX, userID string, post *model.Post) *model.Post {
	post.Type = model.PostTypeEphemeral

	post.UpdateAt = model.GetMillis()
	if post.GetProps() == nil {
		post.SetProps(make(model.StringInterface))
	}

	post.GenerateActionIds()
	message := model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", post.ChannelId, userID, nil, "")
	post = a.PreparePostForClientWithEmbedsAndImages(c, post, true, false, true)
	post = model.AddPostActionCookies(post, a.PostActionCookieSecret())
	postJSON, jsonErr := post.ToJSON()
	if jsonErr != nil {
		mlog.Warn("Failed to encode post to JSON", mlog.Err(jsonErr))
	}
	message.Add("post", postJSON)
	a.Publish(message)

	return post
}

func (a *App) DeleteEphemeralPost(userID, postID string) {
	post := &model.Post{
		Id:       postID,
		UserId:   userID,
		Type:     model.PostTypeEphemeral,
		DeleteAt: model.GetMillis(),
		UpdateAt: model.GetMillis(),
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPostDeleted, "", "", userID, nil, "")
	postJSON, jsonErr := post.ToJSON()
	if jsonErr != nil {
		mlog.Warn("Failed to encode post to JSON", mlog.Err(jsonErr))
	}
	message.Add("post", postJSON)
	a.Publish(message)
}

func (a *App) UpdatePost(c *request.Context, post *model.Post, safeUpdate bool) (*model.Post, *model.AppError) {
	post.SanitizeProps()

	postLists, nErr := a.Srv().Store().Post().Get(context.Background(), post.Id, model.GetPostsOptions{}, "", a.Config().GetSanitizeOptions())
	if nErr != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("UpdatePost", "app.post.get.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("UpdatePost", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("UpdatePost", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}
	oldPost := postLists.Posts[post.Id]

	var err *model.AppError
	if oldPost == nil {
		err = model.NewAppError("UpdatePost", "api.post.update_post.find.app_error", nil, "id="+post.Id, http.StatusBadRequest)
		return nil, err
	}

	if oldPost.DeleteAt != 0 {
		err = model.NewAppError("UpdatePost", "api.post.update_post.permissions_details.app_error", map[string]any{"PostId": post.Id}, "", http.StatusBadRequest)
		return nil, err
	}

	if oldPost.IsSystemMessage() {
		err = model.NewAppError("UpdatePost", "api.post.update_post.system_message.app_error", nil, "id="+post.Id, http.StatusBadRequest)
		return nil, err
	}

	channel, err := a.GetChannel(c, oldPost.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("UpdatePost", "api.post.update_post.can_not_update_post_in_deleted.error", nil, "", http.StatusBadRequest)
	}

	newPost := oldPost.Clone()

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

	if err = a.FillInPostProps(c, post, nil); err != nil {
		return nil, err
	}

	if post.IsRemote() {
		oldPost.RemoteId = model.NewString(*post.RemoteId)
	}

	var rejectionReason string
	pluginContext := pluginContext(c)
	a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
		newPost, rejectionReason = hooks.MessageWillBeUpdated(pluginContext, newPost.ForPlugin(), oldPost.ForPlugin())
		return post != nil
	}, plugin.MessageWillBeUpdatedID)
	if newPost == nil {
		return nil, model.NewAppError("UpdatePost", "Post rejected by plugin. "+rejectionReason, nil, "", http.StatusBadRequest)
	}
	// Restore the post metadata that was stripped by the plugin. Set it to
	// the last known good.
	newPost.Metadata = oldPost.Metadata

	rpost, nErr := a.Srv().Store().Post().Update(newPost, oldPost)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UpdatePost", "app.post.update.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	pluginOldPost := oldPost.ForPlugin()
	pluginNewPost := newPost.ForPlugin()
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.MessageHasBeenUpdated(pluginContext, pluginNewPost, pluginOldPost)
			return true
		}, plugin.MessageHasBeenUpdatedID)
	})

	rpost = a.PreparePostForClientWithEmbedsAndImages(c, rpost, false, true, true)

	// Ensure IsFollowing is nil since this updated post will be broadcast to all users
	// and we don't want to have to populate it for every single user and broadcast to each
	// individually.
	rpost.IsFollowing = nil

	rpost, nErr = a.addPostPreviewProp(rpost)
	if nErr != nil {
		return nil, model.NewAppError("UpdatePost", "app.post.update.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", rpost.ChannelId, "", nil, "")
	postJSON, jsonErr := rpost.ToJSON()
	if jsonErr != nil {
		return nil, model.NewAppError("UpdatePost", "app.post.marshal.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("post", postJSON)

	published, err := a.publishWebsocketEventForPermalinkPost(c, rpost, message)
	if err != nil {
		return nil, err
	}
	if !published {
		a.Publish(message)
	}

	a.invalidateCacheForChannelPosts(rpost.ChannelId)

	return rpost, nil
}

func (a *App) publishWebsocketEventForPermalinkPost(c request.CTX, post *model.Post, message *model.WebSocketEvent) (published bool, err *model.AppError) {
	var previewedPostID string
	if val, ok := post.GetProp(model.PostPropsPreviewedPost).(string); ok {
		previewedPostID = val
	} else {
		return false, nil
	}

	if !model.IsValidId(previewedPostID) {
		mlog.Warn("invalid post prop value", mlog.String("prop_key", model.PostPropsPreviewedPost), mlog.String("prop_value", previewedPostID))
		return false, nil
	}

	previewedPost, err := a.GetSinglePost(previewedPostID, false)
	if err != nil {
		if err.StatusCode == http.StatusNotFound {
			mlog.Warn("permalinked post not found", mlog.String("referenced_post_id", previewedPostID))
			return false, nil
		}
		return false, err
	}

	channelMembers, err := a.GetChannelMembersPage(c, post.ChannelId, 0, 10000000)
	if err != nil {
		return false, err
	}

	permalinkPreviewedChannel, err := a.GetChannel(c, previewedPost.ChannelId)
	if err != nil {
		if err.StatusCode == http.StatusNotFound {
			mlog.Warn("channel containing permalinked post not found", mlog.String("referenced_channel_id", previewedPost.ChannelId))
			return false, nil
		}
		return false, err
	}

	permalinkPreviewedPost := post.GetPreviewPost()
	for _, cm := range channelMembers {
		if permalinkPreviewedPost != nil {
			post.Metadata.Embeds[0].Data = permalinkPreviewedPost
		}

		postForUser := a.sanitizePostMetadataForUserAndChannel(c, post, permalinkPreviewedPost, permalinkPreviewedChannel, cm.UserId)

		// Using DeepCopy here to avoid a race condition
		// between publishing the event and setting the "post" data value below.
		messageCopy := message.DeepCopy()
		broadcastCopy := messageCopy.GetBroadcast()
		broadcastCopy.UserId = cm.UserId
		messageCopy.SetBroadcast(broadcastCopy)

		postJSON, jsonErr := postForUser.ToJSON()
		if jsonErr != nil {
			mlog.Warn("Failed to encode post to JSON", mlog.Err(jsonErr))
		}
		messageCopy.Add("post", postJSON)
		a.Publish(messageCopy)
	}

	return true, nil
}

func (a *App) PatchPost(c *request.Context, postID string, patch *model.PostPatch) (*model.Post, *model.AppError) {
	post, err := a.GetSinglePost(postID, false)
	if err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err = model.NewAppError("PatchPost", "api.post.patch_post.can_not_update_post_in_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	if !a.HasPermissionToChannel(c, post.UserId, post.ChannelId, model.PermissionUseChannelMentions) {
		patch.DisableMentionHighlights()
	}

	post.Patch(patch)

	updatedPost, err := a.UpdatePost(c, post, false)
	if err != nil {
		return nil, err
	}

	return updatedPost, nil
}

func (a *App) GetPostsPage(options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Post().GetPosts(options, false, a.Config().GetSanitizeOptions())
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostsPage", "app.post.get_posts.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPostsPage", "app.post.get_root_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// The postList is sorted as only rootPosts Order is included
	if appErr := a.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: true}); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetPosts(channelID string, offset int, limit int) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Post().GetPosts(model.GetPostsOptions{ChannelId: channelID, Page: offset, PerPage: limit}, true, a.Config().GetSanitizeOptions())
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPosts", "app.post.get_posts.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPosts", "app.post.get_root_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if appErr := a.filterInaccessiblePosts(postList, filterPostOptions{}); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetPostsEtag(channelID string, collapsedThreads bool) string {
	return a.Srv().Store().Post().GetEtag(channelID, true, collapsedThreads)
}

func (a *App) GetPostsSince(options model.GetPostsSinceOptions) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Post().GetPostsSince(options, true, a.Config().GetSanitizeOptions())
	if err != nil {
		return nil, model.NewAppError("GetPostsSince", "app.post.get_posts_since.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr := a.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: true}); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetSinglePost(postID string, includeDeleted bool) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Post().GetSingle(postID, includeDeleted)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSinglePost", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetSinglePost", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	firstInaccessiblePostTime, appErr := a.isInaccessiblePost(post)
	if appErr != nil {
		return nil, appErr
	}
	if firstInaccessiblePostTime != 0 {
		return nil, model.NewAppError("GetSinglePost", "app.post.cloud.get.app_error", nil, "", http.StatusForbidden)
	}

	return post, nil
}

func (a *App) GetPostThread(postID string, opts model.GetPostsOptions, userID string) (*model.PostList, *model.AppError) {
	posts, err := a.Srv().Store().Post().Get(context.Background(), postID, opts, userID, a.Config().GetSanitizeOptions())
	if err != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostThread", "app.post.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetPostThread", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetPostThread", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Get inserts the requested post first in the list, then adds the sorted threadPosts.
	// So, the whole postList.Order is not sorted.
	// The fully sorted list comes only when the CollapsedThreads is true and the Directions is not empty.
	filterOptions := filterPostOptions{}
	if opts.CollapsedThreads && opts.Direction != "" {
		filterOptions.assumeSortedCreatedAt = true
	}

	if appErr := a.filterInaccessiblePosts(posts, filterOptions); appErr != nil {
		return nil, appErr
	}

	return posts, nil
}

func (a *App) GetFlaggedPosts(userID string, offset int, limit int) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Post().GetFlaggedPosts(userID, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetFlaggedPosts", "app.post.get_flagged_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr := a.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: true}); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetFlaggedPostsForTeam(userID, teamID string, offset int, limit int) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Post().GetFlaggedPostsForTeam(userID, teamID, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetFlaggedPostsForTeam", "app.post.get_flagged_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr := a.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: true}); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetFlaggedPostsForChannel(userID, channelID string, offset int, limit int) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Post().GetFlaggedPostsForChannel(userID, channelID, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetFlaggedPostsForChannel", "app.post.get_flagged_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr := a.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: true}); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetPermalinkPost(c request.CTX, postID string, userID string) (*model.PostList, *model.AppError) {
	list, nErr := a.Srv().Store().Post().Get(context.Background(), postID, model.GetPostsOptions{}, userID, a.Config().GetSanitizeOptions())
	if nErr != nil {
		var nfErr *store.ErrNotFound
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("GetPermalinkPost", "app.post.get.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("GetPermalinkPost", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("GetPermalinkPost", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if len(list.Order) != 1 {
		return nil, model.NewAppError("getPermalinkTmp", "api.post_get_post_by_id.get.app_error", nil, "", http.StatusNotFound)
	}
	post := list.Posts[list.Order[0]]

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if err = a.JoinChannel(c, channel, userID); err != nil {
		return nil, err
	}

	if appErr := a.filterInaccessiblePosts(list, filterPostOptions{assumeSortedCreatedAt: true}); appErr != nil {
		return nil, appErr
	}

	return list, nil
}

func (a *App) GetPostsBeforePost(options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Post().GetPostsBefore(options, a.Config().GetSanitizeOptions())
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostsBeforePost", "app.post.get_posts_around.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPostsBeforePost", "app.post.get_posts_around.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// GetPostsBefore orders by channel id and deleted at,
	// before sorting based on created at.
	// but the deleted at is only ever where deleted at = 0,
	// and channel id may or may not be empty (all channels) or defined (single channel),
	// so we can still optimize if the search is for a single channel
	filterOptions := filterPostOptions{}
	if options.ChannelId != "" {
		filterOptions.assumeSortedCreatedAt = true
	}
	if appErr := a.filterInaccessiblePosts(postList, filterOptions); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetPostsAfterPost(options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	postList, err := a.Srv().Store().Post().GetPostsAfter(options, a.Config().GetSanitizeOptions())
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostsAfterPost", "app.post.get_posts_around.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPostsAfterPost", "app.post.get_posts_around.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// GetPostsAfter orders by channel id and deleted at,
	// before sorting based on created at.
	// but the deleted at is only ever where deleted at = 0,
	// and channel id may or may not be empty (all channels) or defined (single channel),
	// so we can still optimize if the search is for a single channel
	filterOptions := filterPostOptions{}
	if options.ChannelId != "" {
		filterOptions.assumeSortedCreatedAt = true
	}
	if appErr := a.filterInaccessiblePosts(postList, filterOptions); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetPostsAroundPost(before bool, options model.GetPostsOptions) (*model.PostList, *model.AppError) {
	var postList *model.PostList
	var err error
	sanitize := a.Config().GetSanitizeOptions()
	if before {
		postList, err = a.Srv().Store().Post().GetPostsBefore(options, sanitize)
	} else {
		postList, err = a.Srv().Store().Post().GetPostsAfter(options, sanitize)
	}

	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetPostsAroundPost", "app.post.get_posts_around.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetPostsAroundPost", "app.post.get_posts_around.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// GetPostsBefore and GetPostsAfter order by channel id and deleted at,
	// before sorting based on created at.
	// but the deleted at is only ever where deleted at = 0,
	// and channel id may or may not be empty (all channels) or defined (single channel),
	// so we can still optimize if the search is for a single channel
	filterOptions := filterPostOptions{}
	if options.ChannelId != "" {
		filterOptions.assumeSortedCreatedAt = true
	}
	if appErr := a.filterInaccessiblePosts(postList, filterOptions); appErr != nil {
		return nil, appErr
	}

	return postList, nil
}

func (a *App) GetPostAfterTime(channelID string, time int64, collapsedThreads bool) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Post().GetPostAfterTime(channelID, time, collapsedThreads)
	if err != nil {
		return nil, model.NewAppError("GetPostAfterTime", "app.post.get_post_after_time.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return post, nil
}

func (a *App) GetPostIdAfterTime(channelID string, time int64, collapsedThreads bool) (string, *model.AppError) {
	postID, err := a.Srv().Store().Post().GetPostIdAfterTime(channelID, time, collapsedThreads)
	if err != nil {
		return "", model.NewAppError("GetPostIdAfterTime", "app.post.get_post_id_around.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return postID, nil
}

func (a *App) GetPostIdBeforeTime(channelID string, time int64, collapsedThreads bool) (string, *model.AppError) {
	postID, err := a.Srv().Store().Post().GetPostIdBeforeTime(channelID, time, collapsedThreads)
	if err != nil {
		return "", model.NewAppError("GetPostIdBeforeTime", "app.post.get_post_id_around.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return postID, nil
}

func (a *App) GetNextPostIdFromPostList(postList *model.PostList, collapsedThreads bool) string {
	if len(postList.Order) > 0 {
		firstPostId := postList.Order[0]
		firstPost := postList.Posts[firstPostId]
		nextPostId, err := a.GetPostIdAfterTime(firstPost.ChannelId, firstPost.CreateAt, collapsedThreads)
		if err != nil {
			mlog.Warn("GetNextPostIdFromPostList: failed in getting next post", mlog.Err(err))
		}

		return nextPostId
	}

	return ""
}

func (a *App) GetPrevPostIdFromPostList(postList *model.PostList, collapsedThreads bool) string {
	if len(postList.Order) > 0 {
		lastPostId := postList.Order[len(postList.Order)-1]
		lastPost := postList.Posts[lastPostId]
		previousPostId, err := a.GetPostIdBeforeTime(lastPost.ChannelId, lastPost.CreateAt, collapsedThreads)
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
func (a *App) AddCursorIdsForPostList(originalList *model.PostList, afterPost, beforePost string, since int64, page, perPage int, collapsedThreads bool) {
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
		nextPostId = a.GetNextPostIdFromPostList(originalList, collapsedThreads)
	}

	if !prevPostIdSet {
		prevPostId = a.GetPrevPostIdFromPostList(originalList, collapsedThreads)
	}

	originalList.NextPostId = nextPostId
	originalList.PrevPostId = prevPostId
}
func (a *App) GetPostsForChannelAroundLastUnread(c request.CTX, channelID, userID string, limitBefore, limitAfter int, skipFetchThreads bool, collapsedThreads, collapsedThreadsExtended bool) (*model.PostList, *model.AppError) {
	var member *model.ChannelMember
	var err *model.AppError
	if member, err = a.GetChannelMember(c, channelID, userID); err != nil {
		return nil, err
	} else if member.LastViewedAt == 0 {
		return model.NewPostList(), nil
	}

	lastUnreadPostId, err := a.GetPostIdAfterTime(channelID, member.LastViewedAt, collapsedThreads)
	if err != nil {
		return nil, err
	} else if lastUnreadPostId == "" {
		return model.NewPostList(), nil
	}

	opts := model.GetPostsOptions{
		SkipFetchThreads:         skipFetchThreads,
		CollapsedThreads:         collapsedThreads,
		CollapsedThreadsExtended: collapsedThreadsExtended,
	}
	postList, err := a.GetPostThread(lastUnreadPostId, opts, userID)
	if err != nil {
		return nil, err
	}
	// Reset order to only include the last unread post: if the thread appears in the centre
	// channel organically, those replies will be added below.
	postList.Order = []string{}
	// Add lastUnreadPostId in order, only if it hasn't been filtered as per the cloud plan's limit
	if _, ok := postList.Posts[lastUnreadPostId]; ok {
		postList.Order = []string{lastUnreadPostId}

		// BeforePosts will only be accessible if the lastUnreadPostId is itself accessible
		if postListBefore, err := a.GetPostsBeforePost(model.GetPostsOptions{ChannelId: channelID, PostId: lastUnreadPostId, Page: PageDefault, PerPage: limitBefore, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: userID}); err != nil {
			return nil, err
		} else if postListBefore != nil {
			postList.Extend(postListBefore)
		}
	}

	if postListAfter, err := a.GetPostsAfterPost(model.GetPostsOptions{ChannelId: channelID, PostId: lastUnreadPostId, Page: PageDefault, PerPage: limitAfter - 1, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: userID}); err != nil {
		return nil, err
	} else if postListAfter != nil {
		postList.Extend(postListAfter)
	}

	postList.SortByCreateAt()
	return postList, nil
}

func (a *App) DeletePost(c request.CTX, postID, deleteByID string) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Post().GetSingle(postID, false)
	if err != nil {
		return nil, model.NewAppError("DeletePost", "app.post.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	channel, appErr := a.GetChannel(c, post.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	if channel.DeleteAt != 0 {
		appErr := model.NewAppError("DeletePost", "api.post.delete_post.can_not_delete_post_in_deleted.error", nil, "", http.StatusBadRequest)
		return nil, appErr
	}

	err = a.Srv().Store().Post().Delete(postID, model.GetMillis(), deleteByID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeletePost", "app.post.delete.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("DeletePost", "app.post.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if post.RootId == "" {
		if appErr := a.DeletePersistentNotification(c, post); appErr != nil {
			return nil, appErr
		}
	}

	postJSON, err := json.Marshal(post)
	if err != nil {
		return nil, model.NewAppError("DeletePost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	userMessage := model.NewWebSocketEvent(model.WebsocketEventPostDeleted, "", post.ChannelId, "", nil, "")
	userMessage.Add("post", string(postJSON))
	userMessage.GetBroadcast().ContainsSanitizedData = true
	a.Publish(userMessage)

	adminMessage := model.NewWebSocketEvent(model.WebsocketEventPostDeleted, "", post.ChannelId, "", nil, "")
	adminMessage.Add("post", string(postJSON))
	adminMessage.Add("delete_by", deleteByID)
	adminMessage.GetBroadcast().ContainsSensitiveData = true
	a.Publish(adminMessage)

	if len(post.FileIds) > 0 {
		a.Srv().Go(func() {
			a.deletePostFiles(post.Id)
		})
		a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(postID, true)
		a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(postID, false)
	}
	a.Srv().Go(func() {
		a.deleteFlaggedPosts(post.Id)
	})

	a.Srv().Go(func() {
		if err = a.RemoveNotifications(c, post, channel); err != nil {
			a.Log().Error("DeletePost failed to delete notification", mlog.Err(err))
		}
	})

	a.invalidateCacheForChannelPosts(post.ChannelId)

	return post, nil
}

func (a *App) deleteFlaggedPosts(postID string) {
	if err := a.Srv().Store().Preference().DeleteCategoryAndName(model.PreferenceCategoryFlaggedPost, postID); err != nil {
		a.Log().Warn("Unable to delete flagged post preference when deleting post.", mlog.Err(err))
		return
	}
}

func (a *App) deletePostFiles(postID string) {
	if _, err := a.Srv().Store().FileInfo().DeleteForPost(postID); err != nil {
		a.Log().Warn("Encountered error when deleting files for post", mlog.String("post_id", postID), mlog.Err(err))
	}
}

func (a *App) parseAndFetchChannelIdByNameFromInFilter(c *request.Context, channelName, userID, teamID string, includeDeleted bool) (*model.Channel, error) {
	if strings.HasPrefix(channelName, "@") && strings.Contains(channelName, ",") {
		var userIDs []string
		users, err := a.GetUsersByUsernames(strings.Split(channelName[1:], ","), false, nil)
		if err != nil {
			return nil, err
		}
		for _, user := range users {
			userIDs = append(userIDs, user.Id)
		}

		channel, err := a.GetGroupChannel(c, userIDs)
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
		channel, err := a.GetOrCreateDirectChannel(c, userID, user.Id)
		if err != nil {
			return nil, err
		}
		return channel, nil
	}

	channel, err := a.GetChannelByName(c, channelName, teamID, includeDeleted)
	if err != nil {
		return nil, err
	}
	return channel, nil
}

func (a *App) searchPostsInTeam(teamID string, userID string, paramsList []*model.SearchParams, modifierFun func(*model.SearchParams)) (*model.PostList, *model.AppError) {
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
			postList, err := a.Srv().Store().Post().Search(teamID, userID, params)
			pchan <- store.StoreResult{Data: postList, NErr: err}
		}(params)
	}

	wg.Wait()
	close(pchan)

	posts := model.NewPostList()

	for result := range pchan {
		if result.NErr != nil {
			return nil, model.NewAppError("searchPostsInTeam", "app.post.search.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
		data := result.Data.(*model.PostList)
		posts.Extend(data)
	}

	posts.SortByCreateAt()

	a.filterInaccessiblePosts(posts, filterPostOptions{assumeSortedCreatedAt: true})

	return posts, nil
}

func (a *App) convertChannelNamesToChannelIds(c *request.Context, channels []string, userID string, teamID string, includeDeletedChannels bool) []string {
	for idx, channelName := range channels {
		channel, err := a.parseAndFetchChannelIdByNameFromInFilter(c, channelName, userID, teamID, includeDeletedChannels)
		if err != nil {
			a.Log().Warn("error getting channel id by name from in filter", mlog.Err(err))
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
			a.Log().Warn("error getting user by username", mlog.String("user_name", username), mlog.Err(err))
			continue
		}
		usernames[idx] = user.Id
	}
	return usernames
}

// GetLastAccessiblePostTime returns CreateAt time(from cache) of the last accessible post as per the cloud limit
func (a *App) GetLastAccessiblePostTime() (int64, *model.AppError) {
	license := a.Srv().License()
	if license == nil || !license.IsCloud() {
		return 0, nil
	}

	system, err := a.Srv().Store().System().GetByName(model.SystemLastAccessiblePostTime)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			// All posts are accessible
			return 0, nil
		default:
			return 0, model.NewAppError("GetLastAccessiblePostTime", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	lastAccessiblePostTime, err := strconv.ParseInt(system.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("GetLastAccessiblePostTime", "common.parse_error_int64", map[string]interface{}{"Value": system.Value}, "", http.StatusInternalServerError).Wrap(err)
	}

	return lastAccessiblePostTime, nil
}

// ComputeLastAccessiblePostTime updates cache with CreateAt time of the last accessible post as per the cloud plan's limit.
// Use GetLastAccessiblePostTime() to access the result.
func (a *App) ComputeLastAccessiblePostTime() error {
	limit, appErr := a.getCloudMessagesHistoryLimit()
	if appErr != nil {
		return appErr
	}

	if limit == 0 {
		// All posts are accessible - we must check if a previous value was set so we can clear it
		systemValue, err := a.Srv().Store().System().GetByName(model.SystemLastAccessiblePostTime)
		if err != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				// There was no previous value, nothing to do
				return nil
			default:
				return model.NewAppError("ComputeLastAccessiblePostTime", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		if systemValue != nil {
			// Previous value was set, so we must clear it
			if _, err = a.Srv().Store().System().PermanentDeleteByName(model.SystemLastAccessiblePostTime); err != nil {
				return model.NewAppError("ComputeLastAccessiblePostTime", "app.system.permanent_delete_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		// Cloud limit is not applicable
		return nil
	}

	createdAt, err := a.Srv().GetStore().Post().GetNthRecentPostTime(limit)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return model.NewAppError("ComputeLastAccessiblePostTime", "app.last_accessible_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Update Cache
	err = a.Srv().Store().System().SaveOrUpdate(&model.System{
		Name:  model.SystemLastAccessiblePostTime,
		Value: strconv.FormatInt(createdAt, 10),
	})
	if err != nil {
		return model.NewAppError("ComputeLastAccessiblePostTime", "app.system.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) getCloudMessagesHistoryLimit() (int64, *model.AppError) {
	license := a.Srv().License()
	if license == nil || !license.IsCloud() {
		return 0, nil
	}

	limits, err := a.Cloud().GetCloudLimits("")
	if err != nil {
		return 0, model.NewAppError("getCloudMessagesHistoryLimit", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if limits == nil || limits.Messages == nil || limits.Messages.History == nil {
		// Cloud limit is not applicable
		return 0, nil
	}

	return int64(*limits.Messages.History), nil
}

func (a *App) SearchPostsInTeam(teamID string, paramsList []*model.SearchParams) (*model.PostList, *model.AppError) {
	if !*a.Config().ServiceSettings.EnablePostSearch {
		return nil, model.NewAppError("SearchPostsInTeam", "store.sql_post.search.disabled", nil, fmt.Sprintf("teamId=%v", teamID), http.StatusNotImplemented)
	}

	return a.searchPostsInTeam(teamID, "", paramsList, func(params *model.SearchParams) {
		params.SearchWithoutUserId = true
	})
}

func (a *App) SearchPostsForUser(c *request.Context, terms string, userID string, teamID string, isOrSearch bool, includeDeletedChannels bool, timeZoneOffset int, page, perPage int, modifier string) (*model.PostSearchResults, *model.AppError) {
	var postSearchResults *model.PostSearchResults
	paramsList := model.ParseSearchParams(strings.TrimSpace(terms), timeZoneOffset)
	includeDeleted := includeDeletedChannels && *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	if !*a.Config().ServiceSettings.EnablePostSearch {
		return nil, model.NewAppError("SearchPostsForUser", "store.sql_post.search.disabled", nil, fmt.Sprintf("teamId=%v userId=%v", teamID, userID), http.StatusNotImplemented)
	}

	finalParamsList := []*model.SearchParams{}

	for _, params := range paramsList {
		params.Modifier = modifier
		params.OrTerms = isOrSearch
		params.IncludeDeletedChannels = includeDeleted
		// Don't allow users to search for "*"
		if params.Terms != "*" {
			// TODO: we have to send channel ids
			// from the front-end. Otherwise it's not possible to distinguish
			// from just the channel name at a cross-team level.
			// Convert channel names to channel IDs
			params.InChannels = a.convertChannelNamesToChannelIds(c, params.InChannels, userID, teamID, includeDeletedChannels)
			params.ExcludedChannels = a.convertChannelNamesToChannelIds(c, params.ExcludedChannels, userID, teamID, includeDeletedChannels)

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

	postSearchResults, err := a.Srv().Store().Post().SearchPostsForUser(finalParamsList, userID, teamID, page, perPage)
	if err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SearchPostsForUser", "app.post.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if appErr := a.filterInaccessiblePosts(postSearchResults.PostList, filterPostOptions{assumeSortedCreatedAt: true}); appErr != nil {
		return nil, appErr
	}

	return postSearchResults, nil
}

func (a *App) GetRecentSearchesForUser(userID string) ([]*model.SearchParams, *model.AppError) {
	searchParams, err := a.Srv().Store().Post().GetRecentSearchesForUser(userID)
	if err != nil {
		return nil, model.NewAppError("GetRecentSearchesForUser", "app.recent_searches.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return searchParams, nil
}

func (a *App) GetFileInfosForPostWithMigration(postID string, includeDeleted bool) ([]*model.FileInfo, *model.AppError) {

	pchan := make(chan store.StoreResult, 1)
	go func() {
		post, err := a.Srv().Store().Post().GetSingle(postID, includeDeleted)
		pchan <- store.StoreResult{Data: post, NErr: err}
		close(pchan)
	}()

	infos, firstInaccessibleFileTime, err := a.GetFileInfosForPost(postID, false, includeDeleted)
	if err != nil {
		return nil, err
	}

	if len(infos) == 0 && firstInaccessibleFileTime == 0 {
		// No FileInfos were returned so check if they need to be created for this post
		result := <-pchan
		if result.NErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(result.NErr, &nfErr):
				return nil, model.NewAppError("GetFileInfosForPostWithMigration", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(result.NErr)
			default:
				return nil, model.NewAppError("GetFileInfosForPostWithMigration", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
			}
		}
		post := result.Data.(*model.Post)

		if len(post.Filenames) > 0 {
			a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(postID, false)
			a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(postID, true)
			// The post has Filenames that need to be replaced with FileInfos
			infos = a.MigrateFilenamesToFileInfos(post)
		}
	}

	return infos, nil
}

// GetFileInfosForPost also returns firstInaccessibleFileTime based on cloud plan's limit.
func (a *App) GetFileInfosForPost(postID string, fromMaster bool, includeDeleted bool) ([]*model.FileInfo, int64, *model.AppError) {
	fileInfos, err := a.Srv().Store().FileInfo().GetForPost(postID, fromMaster, includeDeleted, true)
	if err != nil {
		return nil, 0, model.NewAppError("GetFileInfosForPost", "app.file_info.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	firstInaccessibleFileTime, appErr := a.removeInaccessibleContentFromFilesSlice(fileInfos)
	if appErr != nil {
		return nil, 0, appErr
	}

	a.generateMiniPreviewForInfos(fileInfos)

	return fileInfos, firstInaccessibleFileTime, nil
}

func (a *App) getFileInfosForPostIgnoreCloudLimit(postID string, fromMaster bool, includeDeleted bool) ([]*model.FileInfo, *model.AppError) {
	fileInfos, err := a.Srv().Store().FileInfo().GetForPost(postID, fromMaster, includeDeleted, true)
	if err != nil {
		return nil, model.NewAppError("getFileInfosForPostIgnoreCloudLimit", "app.file_info.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		return a.ImageProxy().GetProxiedImageURL(url)
	}
}

func (a *App) ImageProxyRemover() (f func(string) string) {
	if !*a.Config().ImageProxySettings.Enable {
		return nil
	}

	return func(url string) string {
		return a.ImageProxy().GetUnproxiedImageURL(url)
	}
}

func (a *App) MaxPostSize() int {
	return a.Srv().Platform().MaxPostSize()
}

// countThreadMentions returns the number of times the user is mentioned in a specified thread after the timestamp.
func (a *App) countThreadMentions(c request.CTX, user *model.User, post *model.Post, teamID string, timestamp int64) (int64, *model.AppError) {
	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return 0, err
	}

	keywords := addMentionKeywordsForUser(
		map[string][]string{},
		user,
		map[string]string{},
		&model.Status{Status: model.StatusOnline}, // Assume the user is online since they would've triggered this
		true, // Assume channel mentions are always allowed for simplicity
	)

	posts, nErr := a.Srv().Store().Post().GetPostsByThread(post.Id, timestamp)
	if nErr != nil {
		return 0, model.NewAppError("countThreadMentions", "app.channel.count_posts_since.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	count := 0

	if channel.Type == model.ChannelTypeDirect {
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
	if teamID != "" {
		team, err = a.GetTeam(teamID)
		if err != nil {
			return 0, err
		}
	}

	groups, nErr := a.getGroupsAllowedForReferenceInChannel(channel, team)
	if nErr != nil {
		return 0, model.NewAppError("countThreadMentions", "app.channel.count_posts_since.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	for _, p := range posts {
		if p.CreateAt >= timestamp {
			mentions := getExplicitMentions(p, keywords, groups)
			if _, ok := mentions.Mentions[user.Id]; ok {
				count += 1
			}
		}
	}

	return int64(count), nil
}

// countMentionsFromPost returns the number of posts in the post's channel that mention the user after and including the
// given post.
func (a *App) countMentionsFromPost(c request.CTX, user *model.User, post *model.Post) (int, int, int, *model.AppError) {
	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return 0, 0, 0, err
	}

	if channel.Type == model.ChannelTypeDirect {
		// In a DM channel, every post made by the other user is a mention
		count, countRoot, nErr := a.Srv().Store().Channel().CountPostsAfter(post.ChannelId, post.CreateAt-1, channel.GetOtherUserIdForDM(user.Id))
		if nErr != nil {
			return 0, 0, 0, model.NewAppError("countMentionsFromPost", "app.channel.count_posts_since.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}

		var urgentCount int
		if a.IsPostPriorityEnabled() {
			urgentCount, nErr = a.Srv().Store().Channel().CountUrgentPostsAfter(post.ChannelId, post.CreateAt-1, channel.GetOtherUserIdForDM(user.Id))
			if nErr != nil {
				return 0, 0, 0, model.NewAppError("countMentionsFromPost", "app.channel.count_urgent_posts_since.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}

		return count, countRoot, urgentCount, nil
	}

	channelMember, err := a.GetChannelMember(c, channel.Id, user.Id)
	if err != nil {
		return 0, 0, 0, err
	}

	keywords := addMentionKeywordsForUser(
		map[string][]string{},
		user,
		channelMember.NotifyProps,
		&model.Status{Status: model.StatusOnline}, // Assume the user is online since they would've triggered this
		true, // Assume channel mentions are always allowed for simplicity
	)
	commentMentions := user.NotifyProps[model.CommentsNotifyProp]
	checkForCommentMentions := commentMentions == model.CommentsNotifyRoot || commentMentions == model.CommentsNotifyAny

	// A mapping of thread root IDs to whether or not a post in that thread mentions the user
	mentionedByThread := make(map[string]bool)

	thread, err := a.GetPostThread(post.Id, model.GetPostsOptions{}, user.Id)
	if err != nil {
		return 0, 0, 0, err
	}

	count := 0
	countRoot := 0
	urgentCount := 0
	if isPostMention(user, post, keywords, thread.Posts, mentionedByThread, checkForCommentMentions) {
		count += 1
		if post.RootId == "" {
			countRoot += 1
			if a.IsPostPriorityEnabled() {
				priority, err := a.GetPriorityForPost(post.Id)
				if err != nil {
					return 0, 0, 0, err
				}
				if priority != nil && *priority.Priority == model.PostPriorityUrgent {
					urgentCount += 1
				}
			}
		}
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
			return 0, 0, 0, err
		}

		mentionPostIds := make([]string, 0)
		for _, postID := range postList.Order {
			if isPostMention(user, postList.Posts[postID], keywords, postList.Posts, mentionedByThread, checkForCommentMentions) {
				count += 1
				if postList.Posts[postID].RootId == "" {
					mentionPostIds = append(mentionPostIds, postID)
					countRoot += 1
				}
			}
		}

		if a.IsPostPriorityEnabled() {
			priorityList, nErr := a.Srv().Store().PostPriority().GetForPosts(mentionPostIds)
			if nErr != nil {
				return 0, 0, 0, model.NewAppError("countMentionsFromPost", "app.channel.get_priority_for_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
			for _, priority := range priorityList {
				if *priority.Priority == model.PostPriorityUrgent {
					urgentCount += 1
				}
			}
		}

		if len(postList.Order) < perPage {
			break
		}

		page += 1
	}

	return count, countRoot, urgentCount, nil
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

	if _, ok := otherPosts[post.RootId]; !ok {
		mlog.Warn("Can't determine the comment mentions as the rootPost is past the cloud plan's limit", mlog.String("rootPostID", post.RootId), mlog.String("commentID", post.Id))

		return false
	}

	// Whether or not the user was mentioned because they started the thread
	mentioned := otherPosts[post.RootId].UserId == user.Id

	// Or because they commented on it before this post
	if !mentioned && user.NotifyProps[model.CommentsNotifyProp] == model.CommentsNotifyAny {
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
	if post.Type == model.PostTypeAddToChannel {
		if addedUserId, ok := post.GetProp(model.PostPropsAddedUserId).(string); ok && addedUserId == user.Id {
			return true
		}
	}

	// Check for comment mentions
	if checkForCommentMentions && isCommentMention(user, post, otherPosts, mentionedByThread) {
		return true
	}

	return false
}

func (a *App) GetThreadMembershipsForUser(userID, teamID string) ([]*model.ThreadMembership, error) {
	return a.Srv().Store().Thread().GetMembershipsForUser(userID, teamID)
}

func (a *App) GetPostIfAuthorized(c request.CTX, postID string, session *model.Session, includeDeleted bool) (*model.Post, *model.AppError) {
	post, err := a.GetSinglePost(postID, includeDeleted)
	if err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if !a.SessionHasPermissionToChannel(c, *session, channel.Id, model.PermissionReadChannel) {
		if channel.Type == model.ChannelTypeOpen {
			if !a.SessionHasPermissionToTeam(*session, channel.TeamId, model.PermissionReadPublicChannel) {
				return nil, a.MakePermissionError(session, []*model.Permission{model.PermissionReadPublicChannel})
			}
		} else {
			return nil, a.MakePermissionError(session, []*model.Permission{model.PermissionReadChannel})
		}
	}

	return post, nil
}

// GetPostsByIds response bool value indicates, if the post is inaccessible due to cloud plan's limit.
func (a *App) GetPostsByIds(postIDs []string) ([]*model.Post, int64, *model.AppError) {
	posts, err := a.Srv().Store().Post().GetPostsByIds(postIDs)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, 0, model.NewAppError("GetPostsByIds", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, 0, model.NewAppError("GetPostsByIds", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	posts, firstInaccessiblePostTime, appErr := a.getFilteredAccessiblePosts(posts, filterPostOptions{assumeSortedCreatedAt: true})
	if appErr != nil {
		return nil, 0, appErr
	}

	return posts, firstInaccessiblePostTime, nil
}

func (a *App) GetEditHistoryForPost(postID string) ([]*model.Post, *model.AppError) {
	posts, err := a.Srv().Store().Post().GetEditHistoryForPost(postID)

	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetEditHistoryForPost", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetEditHistoryForPost", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return posts, nil
}

func (a *App) GetTopThreadsForTeamSince(c request.CTX, teamID, userID string, opts *model.InsightsOpts) (*model.TopThreadList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopChannelsForTeamSince", "app.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	topThreads, err := a.Srv().Store().Thread().GetTopThreadsForTeamSince(teamID, userID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopChannelsForTeamSince", "app.post.get_top_threads_for_team_since.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	topThreadsWithEmbedAndImage, err := includeEmbedsAndImages(a, c, topThreads, userID)
	if err != nil {
		return nil, model.NewAppError("GetTopChannelsForTeamSince", "app.post.get_top_threads_for_team_since.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topThreadsWithEmbedAndImage, nil
}

func (a *App) GetTopThreadsForUserSince(c request.CTX, teamID, userID string, opts *model.InsightsOpts) (*model.TopThreadList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopChannelsForTeamSince", "app.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	topThreads, err := a.Srv().Store().Thread().GetTopThreadsForUserSince(teamID, userID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopChannelsForTeamSince", "app.post.get_top_threads_for_team_since.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	topThreadsWithEmbedAndImage, err := includeEmbedsAndImages(a, c, topThreads, userID)
	if err != nil {
		return nil, model.NewAppError("GetTopChannelsForUserSince", "app.post.get_top_threads_for_user_since.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topThreadsWithEmbedAndImage, nil
}

func (a *App) GetTopDMsForUserSince(userID string, opts *model.InsightsOpts) (*model.TopDMList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopDMsForUserSince", "app.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}
	topDMs, err := a.Srv().Store().Post().GetTopDMsForUserSince(userID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopDMsForUserSince", "app.post.get_top_dms_for_user_since.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return topDMs, nil
}

func (a *App) SetPostReminder(postID, userID string, targetTime int64) *model.AppError {
	// Store the reminder in the DB
	reminder := &model.PostReminder{
		PostId:     postID,
		UserId:     userID,
		TargetTime: targetTime,
	}
	err := a.Srv().Store().Post().SetPostReminder(reminder)
	if err != nil {
		return model.NewAppError("SetPostReminder", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	metadata, err := a.Srv().Store().Post().GetPostReminderMetadata(postID)
	if err != nil {
		return model.NewAppError("SetPostReminder", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	parsedTime := time.Unix(targetTime, 0).UTC().Format(time.RFC822)
	siteURL := *a.Config().ServiceSettings.SiteURL

	var permalink string
	if metadata.TeamName == "" {
		permalink = fmt.Sprintf("%s/pl/%s", siteURL, postID)
	} else {
		permalink = fmt.Sprintf("%s/%s/pl/%s", siteURL, metadata.TeamName, postID)
	}

	// Send an ack message.
	ephemeralPost := &model.Post{
		Type:      model.PostTypeEphemeral,
		Id:        model.NewId(),
		CreateAt:  model.GetMillis(),
		UserId:    userID,
		RootId:    postID,
		ChannelId: metadata.ChannelId,
		// It's okay to keep this non-translated. This is just a fallback.
		// The webapp will parse the timestamp and show that in user's local timezone.
		Message: fmt.Sprintf("You will be reminded about %s by @%s at %s", permalink, metadata.Username, parsedTime),
		Props: model.StringInterface{
			"target_time": targetTime,
			"team_name":   metadata.TeamName,
			"post_id":     postID,
			"username":    metadata.Username,
			"type":        model.PostTypeReminder,
		},
	}

	message := model.NewWebSocketEvent(model.WebsocketEventEphemeralMessage, "", ephemeralPost.ChannelId, userID, nil, "")
	ephemeralPost = a.PreparePostForClientWithEmbedsAndImages(request.EmptyContext(a.Log()), ephemeralPost, true, false, true)
	ephemeralPost = model.AddPostActionCookies(ephemeralPost, a.PostActionCookieSecret())

	postJSON, jsonErr := ephemeralPost.ToJSON()
	if jsonErr != nil {
		mlog.Warn("Failed to encode post to JSON", mlog.Err(jsonErr))
	}
	message.Add("post", postJSON)
	a.Publish(message)

	return nil
}

func (a *App) CheckPostReminders() {
	systemBot, appErr := a.GetSystemBot()
	if appErr != nil {
		mlog.Error("Failed to get system bot", mlog.Err(appErr))
		return
	}

	// This will return the reminders and also delete them from the DB.
	// In case, any of the next steps fail, those reminders would be lost.
	// Alternatively, if we delete those reminders _after_ it has been sent,
	// then in case of any temporary failure, they would get sent in the next batch.
	// MM-45595.
	reminders, err := a.Srv().Store().Post().GetPostReminders(time.Now().UTC().Unix())
	if err != nil {
		mlog.Error("Failed to get post reminders", mlog.Err(err))
		return
	}

	// We group multiple reminders for a single user.
	groupedReminders := make(map[string][]string)
	for _, r := range reminders {
		if groupedReminders[r.UserId] == nil {
			groupedReminders[r.UserId] = []string{r.PostId}
		} else {
			groupedReminders[r.UserId] = append(groupedReminders[r.UserId], r.PostId)
		}
	}

	siteURL := *a.Config().ServiceSettings.SiteURL
	for userID, postIDs := range groupedReminders {
		ch, appErr := a.GetOrCreateDirectChannel(request.EmptyContext(a.Log()), userID, systemBot.UserId)
		if appErr != nil {
			mlog.Error("Failed to get direct channel", mlog.Err(appErr))
			return
		}

		for _, postID := range postIDs {
			metadata, err := a.Srv().Store().Post().GetPostReminderMetadata(postID)
			if err != nil {
				mlog.Error("Failed to get post reminder metadata", mlog.Err(err), mlog.String("post_id", postID))
				continue
			}

			T := i18n.GetUserTranslations(metadata.UserLocale)
			dm := &model.Post{
				ChannelId: ch.Id,
				Message: T("app.post_reminder_dm", model.StringInterface{
					"SiteURL":  siteURL,
					"TeamName": metadata.TeamName,
					"PostId":   postID,
					"Username": metadata.Username,
				}),
				Type:   model.PostTypeReminder,
				UserId: systemBot.UserId,
				Props: model.StringInterface{
					"team_name": metadata.TeamName,
					"post_id":   postID,
					"username":  metadata.Username,
				},
			}

			if _, err := a.CreatePost(request.EmptyContext(a.Log()), dm, ch, false, true); err != nil {
				mlog.Error("Failed to post reminder message", mlog.Err(err))
			}
		}
	}

}

func (a *App) GetPostInfo(c request.CTX, postID string) (*model.PostInfo, *model.AppError) {
	userID := c.Session().UserId
	post, appErr := a.GetSinglePost(postID, false)
	if appErr != nil {
		return nil, appErr
	}

	channel, appErr := a.GetChannel(c, post.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	notFoundError := model.NewAppError("GetPostInfo", "app.post.get.app_error", nil, "", http.StatusNotFound)

	var team *model.Team
	hasPermissionToAccessTeam := false
	if channel.TeamId != "" {
		team, appErr = a.GetTeam(channel.TeamId)
		if appErr != nil {
			return nil, appErr
		}

		if team.Type == model.TeamOpen {
			hasPermissionToAccessTeam = a.HasPermissionToTeam(userID, team.Id, model.PermissionJoinPublicTeams)
		} else if team.Type == model.TeamInvite {
			hasPermissionToAccessTeam = a.HasPermissionToTeam(userID, team.Id, model.PermissionJoinPrivateTeams)
		}
	} else {
		// This happens in case of DMs and GMs.
		hasPermissionToAccessTeam = true
	}

	if !hasPermissionToAccessTeam {
		return nil, notFoundError
	}

	hasPermissionToAccessChannel := false
	if channel.Type == model.ChannelTypeOpen {
		hasPermissionToAccessChannel = true
	} else if channel.Type == model.ChannelTypePrivate {
		hasPermissionToAccessChannel = a.HasPermissionToChannel(c, userID, channel.Id, model.PermissionManagePrivateChannelMembers)
	} else if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		hasPermissionToAccessChannel = a.HasPermissionToChannel(c, userID, channel.Id, model.PermissionReadChannel)
	}

	if !hasPermissionToAccessChannel {
		return nil, notFoundError
	}

	_, channelMemberErr := a.GetChannelMember(c, channel.Id, userID)

	info := model.PostInfo{
		ChannelId:          channel.Id,
		ChannelType:        channel.Type,
		ChannelDisplayName: channel.DisplayName,
		HasJoinedChannel:   channelMemberErr == nil,
	}
	if team != nil {
		_, teamMemberErr := a.GetTeamMember(team.Id, userID)

		info.TeamId = team.Id
		info.TeamType = team.Type
		info.TeamDisplayName = team.DisplayName
		info.HasJoinedTeam = teamMemberErr == nil
	}
	return &info, nil
}

func includeEmbedsAndImages(a *App, c request.CTX, topThreadList *model.TopThreadList, userID string) (*model.TopThreadList, error) {
	for _, topThread := range topThreadList.Items {
		topThread.Post = a.PreparePostForClientWithEmbedsAndImages(c, topThread.Post, false, false, true)
		sanitizedPost, err := a.SanitizePostMetadataForUser(c, topThread.Post, userID)
		if err != nil {
			return nil, err
		}
		topThread.Post = sanitizedPost
	}
	return topThreadList, nil
}

func makePostLink(siteURL, teamName, postID string) string {
	return fmt.Sprintf("%s/%s/pl/%s", siteURL, teamName, postID)
}

// validateMoveOrCopy performs validation on a provided post list to determine
// if all permissions are in place to allow the for the posts to be moved or
// copied.
func (a *App) ValidateMoveOrCopy(c *request.Context, wpl *model.WranglerPostList, originalChannel *model.Channel, targetChannel *model.Channel, user *model.User) error {
	if wpl.NumPosts() == 0 {
		return errors.New("The wrangler post list contains no posts")
	}

	config := a.Config().WranglerSettings

	switch originalChannel.Type {
	case model.ChannelTypePrivate:
		if !*config.MoveThreadFromPrivateChannelEnable {
			return errors.New("Wrangler is currently configured to not allow moving posts from private channels")
		}
	case model.ChannelTypeDirect:
		if !*config.MoveThreadFromDirectMessageChannelEnable {
			return errors.New("Wrangler is currently configured to not allow moving posts from direct message channels")
		}
	case model.ChannelTypeGroup:
		if !*config.MoveThreadFromGroupMessageChannelEnable {
			return errors.New("Wrangler is currently configured to not allow moving posts from group message channels")
		}
	}

	if !originalChannel.IsGroupOrDirect() && !targetChannel.IsGroupOrDirect() {
		// DM and GM channels are "teamless" so it doesn't make sense to check
		// the MoveThreadToAnotherTeamEnable config when dealing with those.
		if !*config.MoveThreadToAnotherTeamEnable && targetChannel.TeamId != originalChannel.TeamId {
			return errors.New("Wrangler is currently configured to not allow moving messages to different teams")
		}
	}

	if *config.MoveThreadMaxCount != int64(0) && *config.MoveThreadMaxCount < int64(wpl.NumPosts()) {
		return fmt.Errorf("Error: the thread is %d posts long, but this command is configured to only move threads of up to %d posts", wpl.NumPosts(), config.MoveThreadMaxCount)
	}

	_, appErr := a.GetChannelMember(c, targetChannel.Id, user.Id)
	if appErr != nil {
		return fmt.Errorf("Error: channel with ID %s doesn't exist or you are not a member", targetChannel.Id)
	}

	return nil
}

func (a *App) CopyWranglerPostlist(c *request.Context, wpl *model.WranglerPostList, targetChannel *model.Channel) (*model.Post, *model.AppError) {
	var appErr *model.AppError
	var newRootPost *model.Post

	if wpl.ContainsFileAttachments() {
		// The thread contains at least one attachment. To properly move the
		// thread, the files will have to be re-uploaded. This is completed
		// before any messages are moved.
		// TODO: check number of files that need to be re-uploaded or file size?
		c.Logger().Info("Wrangler is re-uploading file attachments",
			mlog.String("file_count", fmt.Sprintf("%d", wpl.FileAttachmentCount)),
		)

		for _, post := range wpl.Posts {
			var newFileIDs []string
			var fileBytes []byte
			var oldFileInfo, newFileInfo *model.FileInfo
			for _, fileID := range post.FileIds {
				oldFileInfo, appErr = a.GetFileInfo(fileID)
				if appErr != nil {
					return nil, appErr
				}
				fileBytes, appErr = a.GetFile(fileID)
				if appErr != nil {
					return nil, appErr
				}
				newFileInfo, appErr = a.UploadFile(c, fileBytes, targetChannel.Id, oldFileInfo.Name)
				if appErr != nil {
					return nil, appErr
				}

				newFileIDs = append(newFileIDs, newFileInfo.Id)
			}

			post.FileIds = newFileIDs
		}
	}

	for i, post := range wpl.Posts {
		var reactions []*model.Reaction

		// Store reactions to be reapplied later.
		reactions, appErr = a.GetReactionsForPost(post.Id)
		if appErr != nil {
			// Reaction-based errors are logged, but do not cause the plugin to
			// abort the move thread process.
			c.Logger().Error("Failed to get reactions on original post")
		}

		newPost := post.Clone()
		newPost = newPost.CleanPost()
		newPost.ChannelId = targetChannel.Id

		if i == 0 {
			newPost, appErr = a.CreatePost(c, newPost, targetChannel, false, false)
			if appErr != nil {
				return nil, appErr
			}
			newRootPost = newPost.Clone()
		} else {
			newPost.RootId = newRootPost.Id
			newPost, appErr = a.CreatePost(c, newPost, targetChannel, false, false)
			if appErr != nil {
				return nil, appErr
			}
		}

		for _, reaction := range reactions {
			reaction.PostId = newPost.Id
			_, appErr = a.SaveReactionForPost(c, reaction)
			if appErr != nil {
				// Reaction-based errors are logged, but do not cause the plugin to
				// abort the move thread process.
				c.Logger().Error("Failed to reapply reactions to post")
			}
		}
	}

	return newRootPost, nil
}

func (a *App) MoveThread(c *request.Context, postID string, sourceChannelID, channelID string, user *model.User) *model.AppError {

	postListResponse, appErr := a.GetPostThread(postID, model.GetPostsOptions{}, user.Id)
	if appErr != nil {
		return model.NewAppError("getPostThread", "app.post.move_thread_command.error", nil, "postID="+postID+", "+"UserId="+user.Id+"", http.StatusBadRequest)
	}
	wpl := postListResponse.BuildWranglerPostList()

	originalChannel, appErr := a.GetChannel(c, sourceChannelID)
	if appErr != nil {
		return appErr
	}
	_, appErr = a.GetChannelMember(c, channelID, user.Id)
	if appErr != nil {
		return appErr
	}
	targetChannel, appErr := a.GetChannel(c, channelID)
	if appErr != nil {
		return appErr
	}

	err := a.ValidateMoveOrCopy(c, wpl, originalChannel, targetChannel, user)
	if err != nil {
		return model.NewAppError("validateMoveOrCopy", "app.post.move_thread_command.error", nil, err.Error(), http.StatusBadRequest)
	}

	var targetTeam *model.Team

	if targetChannel.IsGroupOrDirect() {
		if !originalChannel.IsGroupOrDirect() {
			targetTeam, appErr = a.GetTeam(originalChannel.TeamId)
		}
	} else {
		targetTeam, appErr = a.GetTeam(targetChannel.TeamId)
	}

	if appErr != nil || targetTeam == nil {
		return appErr
	}

	// Begin creating the new thread.
	c.Logger().Info("Wrangler is moving a thread", mlog.String("user_id", user.Id), mlog.String("original_post_id", wpl.RootPost().Id), mlog.String("original_channel_id", originalChannel.Id))

	// To simulate the move, we first copy the original messages(s) to the
	// new channel and later delete the original messages(s).
	newRootPost, appErr := a.CopyWranglerPostlist(c, wpl, targetChannel)
	if appErr != nil {
		return appErr
	}

	_, appErr = a.CreatePost(c, &model.Post{
		// TODO: Make this the System user, not the calling user.
		UserId:    user.Id,
		Type:      model.PostTypeWrangler,
		RootId:    newRootPost.Id,
		ChannelId: channelID,
		Message:   "This thread was moved from another channel",
	}, targetChannel, false, false)
	if appErr != nil {
		return appErr
	}
	// Cleanup is handled by simply deleting the root post. Any comments/replies
	// are automatically marked as deleted for us.
	_, appErr = a.DeletePost(c, wpl.RootPost().Id, user.Id)
	if appErr != nil {
		return appErr
	}

	c.Logger().Info("Wrangler thread move complete", mlog.String("user_id", user.Id), mlog.String("new_post_id", newRootPost.Id), mlog.String("channel_id", channelID))

	T := i18n.GetUserTranslations(user.Locale)

	msg := T("app.post.move_thread_command.direct_or_group.multiple_messages", model.StringInterface{"NumMessages": wpl.NumPosts()})
	if wpl.NumPosts() == 1 {
		msg = T("app.post.move_thread_command.direct_or_group.one_message")
	}

	if targetChannel.TeamId != "" {
		targetTeam, teamErr := a.GetTeam(targetChannel.TeamId)
		if teamErr != nil {
			return teamErr
		}
		targetName := targetTeam.Name
		newPostLink := makePostLink(*a.Config().ServiceSettings.SiteURL, targetName, newRootPost.Id)
		msg = T("app.post.move_thread_command.channel.multiple_messages", model.StringInterface{"NumMessages": wpl.NumPosts(), "Link": newPostLink})
		if wpl.NumPosts() == 1 {
			msg = T("app.post.move_thread_command.channel.one_message", model.StringInterface{"Link": newPostLink})
		}
	}

	// executor, execError := a.GetUser(user.Id)
	// if execError != nil {
	// 	return model.NewAppError("GetUser", "app.post.run_move_thread_command.request_error", nil, "UserID="+user.Id+"", http.StatusBadRequest)
	// }

	// if user.Id != wpl.RootPost().UserId {
	// The wrangled thread was not started by the user running the command.
	// Send a DM to the user who created the root message to let them know.

	// TODO: Implement
	// err := p.postMoveThreadBotDM(wpl.RootPost().UserId, newPostLink, executor.Username)
	// if err != nil {
	// 	p.API.LogError("Unable to send move-thread DM to user",
	// 		"error", err.Error(),
	// 		"user_id", wpl.RootPost().UserId,
	// 	)
	// }
	// }

	_, appErr = a.CreatePost(c, &model.Post{
		UserId:    user.Id,
		Type:      model.PostTypeWrangler,
		ChannelId: originalChannel.Id,
		Message:   msg,
	}, originalChannel, false, false)
	if appErr != nil {
		return appErr
	}

	c.Logger().Info(msg)
	return nil
}
