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
		if len(options.UserIDs) > model.DeliverPostNotificationsMaxUserIDs {
			return model.NewAppError("DeliverPostNotifications", "app.post.deliver_notifications.too_many_users.app_error", map[string]any{"Max": model.DeliverPostNotificationsMaxUserIDs}, "", http.StatusBadRequest)
		}
		userIDs = model.RemoveDuplicateStringsNonSort(options.UserIDs)
		for _, userID := range userIDs {
			if !model.IsValidId(userID) {
				return model.NewAppError("DeliverPostNotifications", "api.context.invalid_param.app_error", map[string]any{"Name": "user_ids"}, "", http.StatusBadRequest)
			}
		}
	}

	post, appErr := a.getPostForNotificationDelivery(rctx, postID)
	if appErr != nil {
		return appErr
	}

	if userIDs == nil {
		return a.deliverDeferredPostNotifications(rctx, post)
	}

	return a.deliverPostNotificationsToUsers(rctx, post, userIDs)
}

// getPostForNotificationDelivery reads the post from master: a plugin typically delivers
// right after its last update, which a replica may not have caught up with.
func (a *App) getPostForNotificationDelivery(rctx request.CTX, postID string) (*model.Post, *model.AppError) {
	post, err := a.Srv().Store().Post().GetSingle(sqlstore.RequestContextWithMaster(rctx), postID, false)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, model.NewAppError("DeliverPostNotifications", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("DeliverPostNotifications", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return post, nil
}

func (a *App) deliverDeferredPostNotifications(rctx request.CTX, post *model.Post) *model.AppError {
	// The store releases only posts carrying both markers; a post with just one of them
	// was counted and notified, or not, when it was saved.
	if !post.HasDeferredNotification() || !post.HasSilentNotification() {
		return nil
	}

	// Everything the notification pipeline needs is looked up before releasing, so that
	// a failed lookup leaves the post deferred for the caller to retry.
	channel, appErr := a.GetChannel(rctx, post.ChannelId)
	if appErr != nil {
		return appErr
	}

	// SendNotifications never notifies in archived channels, and releasing would only
	// count the post as unread there; the post stays deferred until the channel is restored.
	if channel.DeleteAt > 0 {
		rctx.Logger().Debug("Not releasing deferred post notifications in an archived channel", mlog.String("post_id", post.Id), mlog.String("channel_id", channel.Id))
		return nil
	}

	team, sender, appErr := a.getPostNotificationContext(rctx, post, channel)
	if appErr != nil {
		return appErr
	}

	var parentPostList *model.PostList
	if post.RootId != "" {
		var err error
		parentPostList, err = a.Srv().Store().Post().Get(sqlstore.RequestContextWithMaster(rctx), post.RootId, model.GetPostsOptions{}, "", a.Config().GetSanitizeOptions())
		if err != nil {
			return model.NewAppError("DeliverPostNotifications", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

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

	a.Srv().Platform().InvalidateCacheForChannel(channel)
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)
	a.invalidateCacheForChannelPosts(channel.Id)

	post = a.preparePostForNotificationDelivery(rctx, released)

	if _, err := a.SendNotifications(rctx, post, team, channel, sender, parentPostList, false); err != nil {
		if sendErr, ok := errors.AsType[*model.AppError](err); ok {
			return sendErr
		}
		return model.NewAppError("DeliverPostNotifications", "app.post.deliver_notifications.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) deliverPostNotificationsToUsers(rctx request.CTX, post *model.Post, userIDs []string) *model.AppError {
	channel, appErr := a.GetChannel(rctx, post.ChannelId)
	if appErr != nil {
		return appErr
	}

	// Mirrors SendNotifications, which never notifies in archived channels.
	if channel.DeleteAt > 0 {
		return nil
	}

	team, sender, appErr := a.getPostNotificationContext(rctx, post, channel)
	if appErr != nil {
		return appErr
	}

	// A plugin typically notifies users it just added to the channel, which a replica or
	// cache may not reflect yet.
	masterCtx := sqlstore.RequestContextWithMaster(rctx)

	profiles, err := a.Srv().Store().User().GetProfileByIds(masterCtx, userIDs, nil, false)
	if err != nil {
		return model.NewAppError("DeliverPostNotifications", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	activeProfiles := make(map[string]*model.User, len(profiles))
	for _, profile := range profiles {
		if profile.DeleteAt == 0 {
			activeProfiles[profile.Id] = profile
		}
	}

	recipients := make(model.StringArray, 0, len(userIDs))
	profileMap := make(map[string]*model.User, len(userIDs))
	channelMemberNotifyPropsMap := make(map[string]model.StringMap, len(userIDs))
	for _, userID := range userIDs {
		if userID == post.UserId {
			rctx.Logger().Debug("Skipping post notification for the post's author", mlog.String("post_id", post.Id), mlog.String("user_id", userID))
			continue
		}
		profile := activeProfiles[userID]
		if profile == nil {
			rctx.Logger().Debug("Skipping post notification for a user who is not active", mlog.String("post_id", post.Id), mlog.String("user_id", userID))
			continue
		}
		member, memberErr := a.Srv().Store().Channel().GetMember(masterCtx, channel.Id, userID)
		if memberErr != nil {
			if _, ok := errors.AsType[*store.ErrNotFound](memberErr); ok {
				rctx.Logger().Debug("Skipping post notification for a user who is not a channel member", mlog.String("post_id", post.Id), mlog.String("channel_id", channel.Id), mlog.String("user_id", userID))
				continue
			}
			return model.NewAppError("DeliverPostNotifications", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(memberErr)
		}
		recipients = append(recipients, userID)
		profileMap[userID] = profile
		channelMemberNotifyPropsMap[userID] = member.NotifyProps
	}
	if len(recipients) == 0 {
		return nil
	}

	// A group message's channel name lists all of its members.
	notificationProfileMap := profileMap
	if channel.Type == model.ChannelTypeGroup {
		notificationProfileMap, err = a.Srv().Store().User().GetAllProfilesInChannel(rctx, channel.Id, true)
		if err != nil {
			return model.NewAppError("DeliverPostNotifications", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	post = a.preparePostForNotificationDelivery(rctx, post)
	post.DelProp(model.PostPropsDeferredNotification)
	post.DelProp(model.PostPropsSilentNotification)

	mentions := &MentionResults{
		Mentions:      make(map[string]MentionType, len(recipients)),
		GroupMentions: make(map[string]MentionType),
	}
	for _, userID := range recipients {
		mentions.Mentions[userID] = KeywordMention
	}

	if err := a.Srv().Store().Channel().IncrementMentionCount(post.ChannelId, recipients, post.RootId == "", post.IsUrgent()); err != nil {
		rctx.Logger().Warn("Failed to update mention count", mlog.String("post_id", post.Id), mlog.String("channel_id", post.ChannelId), mlog.Err(err))
	}

	isCRTAllowed := *a.Config().ServiceSettings.CollapsedThreads != model.CollapsedThreadsDisabled
	followers := make(model.StringSet)
	newParticipants := map[string]bool{}
	participantMemberships := map[string]*model.ThreadMembership{}
	if post.RootId != "" {
		if isCRTAllowed {
			for _, userID := range recipients {
				membership, err := a.Srv().Store().Thread().GetMembershipForUser(userID, post.RootId)
				if err != nil {
					if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
						continue
					}
					return model.NewAppError("DeliverPostNotifications", "app.channel.autofollow.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
				if membership.Following {
					followers.Add(userID)
				}
			}
		}

		// Mirrors SendNotifications, which only follows threads on mention when auto-follow is on.
		if *a.Config().ServiceSettings.ThreadAutoFollow {
			for _, userID := range recipients {
				membership, err := a.Srv().Store().Thread().MaintainMembership(userID, post.RootId, store.ThreadMembershipOpts{
					Following:         true,
					IncrementMentions: true,
					UpdateFollowing:   true,
				})
				if err != nil {
					rctx.Logger().Warn("Failed to update thread autofollow from mention", mlog.String("post_id", post.Id), mlog.String("user_id", userID), mlog.Err(err))
					continue
				}
				participantMemberships[userID] = membership
				if !followers.Has(userID) && membership.Following {
					followers.Add(userID)
					newParticipants[userID] = true
				}
			}
		}
	}

	notificationsForCRT := &CRTNotifiers{}
	if isCRTAllowed && post.RootId != "" {
		for userID := range followers {
			if a.IsCRTEnabledForUser(rctx, userID) {
				notificationsForCRT.addFollowerToNotify(profileMap[userID], mentions, channelMemberNotifyPropsMap[userID], channel)
			}
		}
	}

	notification := &PostNotification{
		Post:       post.Clone(),
		Channel:    channel,
		ProfileMap: notificationProfileMap,
		Sender:     sender,
	}

	a.sendPostNotificationEmails(rctx, notification, team, recipients, notificationsForCRT, channelMemberNotifyPropsMap)
	a.sendPostPushNotifications(rctx, notification, mentions, recipients, nil, notificationsForCRT, channelMemberNotifyPropsMap)

	var hasFiles, hasImage bool
	if len(post.FileIds) > 0 {
		hasFiles = true
		infos, err := a.Srv().Store().FileInfo().GetForPost(post.Id, true, false, true)
		if err != nil {
			rctx.Logger().Warn("Unable to get fileInfo for post notifications.", mlog.String("post_id", post.Id), mlog.Err(err))
		}
		for _, info := range infos {
			if info.IsImage() {
				hasImage = true
				break
			}
		}
	}

	for _, userID := range recipients {
		// Broadcast to the user alone: the rest of the channel already has the post, and only
		// this user's client should treat it as a new mention.
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", userID, nil, "")
		message.Add("channel_type", channel.Type)
		message.Add("channel_display_name", notification.GetChannelName(model.ShowUsername, ""))
		message.Add("channel_name", channel.Name)
		message.Add("sender_name", notification.GetSenderName(model.ShowUsername, *a.Config().ServiceSettings.EnablePostUsernameOverride))
		message.Add("team_id", team.Id)
		message.Add("set_online", false)
		// The post is not a new message in the channel: clients count the mention only.
		message.Add("notification_only", true)
		if hasFiles {
			message.Add("otherFile", "true")
		}
		if hasImage {
			message.Add("image", "true")
		}

		a.markPostDeliveryForBroadcast(rctx, message, post)
		useAddMentionsHook(message, model.StringArray{userID})
		if notificationsForCRT.Desktop.Contains(userID) {
			useAddFollowersHook(message, model.StringArray{userID})
		}
		if shouldAckWebsocketNotification(channel.Type, profileMap[userID].NotifyProps[model.DesktopNotifyProp], channelMemberNotifyPropsMap[userID][model.DesktopNotifyProp]) {
			usePostedAckHook(message, post.UserId, channel.Type, []string{userID})
		}

		// publishWebsocketEventForPost strips per-recipient metadata from the post it is given.
		if appErr := a.publishWebsocketEventForPost(rctx, post.Clone(), message); appErr != nil {
			return appErr
		}
	}

	if isCRTAllowed && post.RootId != "" {
		if err := a.publishThreadUpdatedEvents(rctx, post, team, sender, followers, profileMap, participantMemberships, newParticipants, mentions); err != nil {
			return model.NewAppError("DeliverPostNotifications", "app.post.deliver_notifications.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

// getPostNotificationContext returns the team (blank for direct and group messages) and the
// author the notification pipeline needs, the same way CreatePost provides them.
func (a *App) getPostNotificationContext(rctx request.CTX, post *model.Post, channel *model.Channel) (*model.Team, *model.User, *model.AppError) {
	team := &model.Team{}
	if channel.TeamId != "" {
		t, appErr := a.GetTeam(channel.TeamId)
		if appErr != nil {
			return nil, nil, appErr
		}
		team = t
	}

	sender, err := a.Srv().Store().User().Get(rctx, post.UserId)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, nil, model.NewAppError("DeliverPostNotifications", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, nil, model.NewAppError("DeliverPostNotifications", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return team, sender, nil
}

// preparePostForNotificationDelivery gives the post the metadata (files, embeds, priority)
// and plugin rewrites that CreatePost applies before notifying.
func (a *App) preparePostForNotificationDelivery(rctx request.CTX, post *model.Post) *model.Post {
	post = a.PreparePostForClientWithEmbedsAndImages(rctx, post, &model.PreparePostForClientOpts{IsEditPost: true, IncludePriority: true})
	post.IsFollowing = nil
	a.applyPostWillBeConsumedHook(rctx, &post)
	return post
}
