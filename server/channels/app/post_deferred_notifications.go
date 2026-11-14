// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

// DeliverPostNotifications runs the notification pipeline for a post after it was created.
//
// With nil options, it releases a post created with deferred notifications: the post stops
// being silent, counts as a new unread message in its channel and thread as of now, and
// notifies the channel against its current content exactly as if it had just been posted.
// Releasing is conditional on the post still being deferred, so it happens at most once
// across concurrent callers and cluster nodes; for a post that is not deferred, or that is in
// an archived channel, this is a no-op. An error returned after the release may mean the
// channel was only partly notified; the post is no longer deferred either way.
//
// With options.UserIDs, it notifies only those users, as if each were explicitly mentioned,
// and leaves the post's deferred state and the channel's message totals untouched. Users
// who are not active members of the channel, and the post's author, are skipped. This is
// additive: a later release notifies the channel, including these users, as usual.
func (a *App) DeliverPostNotifications(rctx request.CTX, postID string, options *model.DeliverPostNotificationsOptions) *model.AppError {
	if !model.IsValidId(postID) {
		return model.NewAppError("DeliverPostNotifications", "api.context.invalid_param.app_error", map[string]any{"Name": "post_id"}, "", http.StatusBadRequest)
	}

	var userIDs []string
	if options != nil {
		if len(options.UserIDs) == 0 {
			return model.NewAppError("DeliverPostNotifications", "api.context.invalid_param.app_error", map[string]any{"Name": "user_ids"}, "", http.StatusBadRequest)
		}
		for _, userID := range options.UserIDs {
			if !model.IsValidId(userID) {
				return model.NewAppError("DeliverPostNotifications", "api.context.invalid_param.app_error", map[string]any{"Name": "user_ids"}, "", http.StatusBadRequest)
			}
		}
		userIDs = options.UserIDs
	}

	// A plugin typically delivers right after its last update, which a replica may not have
	// caught up with.
	masterCtx := sqlstore.RequestContextWithMaster(rctx)

	post, err := a.Srv().Store().Post().GetSingle(masterCtx, postID, false)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return model.NewAppError("DeliverPostNotifications", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeliverPostNotifications", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// The store releases only posts carrying both markers; a post with just one of them
	// was counted and notified, or not, when it was saved.
	if userIDs == nil && (!post.HasDeferredNotification() || !post.HasSilentNotification()) {
		return nil
	}

	// The channel, author and thread are looked up before releasing, so that a failed lookup
	// leaves the post deferred for the caller to retry.
	channel, appErr := a.GetChannel(rctx, post.ChannelId)
	if appErr != nil {
		return appErr
	}

	// Notifications are never sent in archived channels, and releasing would only count the
	// post as unread there; the post stays deferred until the channel is restored.
	if channel.DeleteAt > 0 {
		rctx.Logger().Debug("Not delivering post notifications in an archived channel", mlog.String("post_id", post.Id), mlog.String("channel_id", channel.Id))
		return nil
	}

	sender, err := a.Srv().Store().User().Get(rctx, post.UserId)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return model.NewAppError("DeliverPostNotifications", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeliverPostNotifications", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var parentPostList *model.PostList
	if post.RootId != "" {
		parentPostList, err = a.Srv().Store().Post().Get(masterCtx, post.RootId, model.GetPostsOptions{}, "", a.Config().GetSanitizeOptions())
		if err != nil {
			return model.NewAppError("DeliverPostNotifications", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if userIDs == nil {
		// The released row carries the content as it is now, which may have changed since
		// the post was read above.
		released, err := a.Srv().Store().Post().ReleaseDeferredNotification(rctx, post.Id, model.GetMillis())
		if err != nil {
			return model.NewAppError("DeliverPostNotifications", "app.post.deliver_notifications.release.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if released == nil {
			rctx.Logger().Debug("Deferred post notifications were already delivered", mlog.String("post_id", post.Id))
			return nil
		}
		a.invalidateCacheForChannelPosts(channel.Id)
		post = released
	} else {
		post.DelProp(model.PostPropsDeferredNotification)
		post.DelProp(model.PostPropsSilentNotification)
	}

	// The metadata and plugin rewrites CreatePost applies before notifying.
	post = a.PreparePostForClientWithEmbedsAndImages(rctx, post, &model.PreparePostForClientOpts{IsEditPost: true, IncludePriority: true})
	post.IsFollowing = nil
	a.applyPostWillBeConsumedHook(rctx, &post)

	if _, err := a.notifyAboutPost(rctx, post, sender, channel, parentPostList, false, userIDs); err != nil {
		if sendErr, ok := errors.AsType[*model.AppError](err); ok {
			return sendErr
		}
		return model.NewAppError("DeliverPostNotifications", "app.post.deliver_notifications.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}
