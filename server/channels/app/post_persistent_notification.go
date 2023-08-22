// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

// ResolvePersistentNotification stops the persistent notifications, if a loggedInUserID(except the post owner) reacts, reply or ack on the post.
// Post-owner can only delete the original post to stop the notifications.
func (a *App) ResolvePersistentNotification(c request.CTX, post *model.Post, loggedInUserID string) *model.AppError {
	// Ignore the post owner's actions to their own post
	if loggedInUserID == post.UserId {
		return nil
	}

	if !a.IsPersistentNotificationsEnabled() {
		return nil
	}

	_, err := a.Srv().Store().PostPersistentNotification().GetSingle(post.Id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			// Either the notification post is already deleted or was never a notification post
			return nil
		default:
			return model.NewAppError("ResolvePersistentNotification", "app.post_priority.delete_persistent_notification_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if !*a.Config().ServiceSettings.AllowPersistentNotificationsForGuests {
		user, nErr := a.Srv().Store().User().Get(context.Background(), loggedInUserID)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return model.NewAppError("ResolvePersistentNotification", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
			default:
				return model.NewAppError("ResolvePersistentNotification", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
		if user.IsGuest() {
			return nil
		}
	}

	stopNotifications := false
	if err := a.forEachPersistentNotificationPost([]*model.Post{post}, func(_ *model.Post, _ *model.Channel, _ *model.Team, mentions *ExplicitMentions, _ model.UserMap, _ map[string]map[string]model.StringMap) error {
		if mentions.isUserMentioned(loggedInUserID) {
			stopNotifications = true
		}
		return nil
	}); err != nil {
		return model.NewAppError("ResolvePersistentNotification", "app.post_priority.delete_persistent_notification_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Only mentioned users can stop the notifications
	if !stopNotifications {
		return nil
	}

	if err := a.Srv().Store().PostPersistentNotification().Delete([]string{post.Id}); err != nil {
		return model.NewAppError("ResolvePersistentNotification", "app.post_priority.delete_persistent_notification_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// DeletePersistentNotification stops the persistent notifications.
func (a *App) DeletePersistentNotification(c request.CTX, post *model.Post) *model.AppError {
	if !a.IsPersistentNotificationsEnabled() {
		return nil
	}

	_, err := a.Srv().Store().PostPersistentNotification().GetSingle(post.Id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			// Either the notification post is already deleted or was never a notification post
			return nil
		default:
			return model.NewAppError("DeletePersistentNotification", "app.post_priority.delete_persistent_notification_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if err := a.Srv().Store().PostPersistentNotification().Delete([]string{post.Id}); err != nil {
		return model.NewAppError("DeletePersistentNotification", "app.post_priority.delete_persistent_notification_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) SendPersistentNotifications() error {
	notificationInterval := time.Duration(*a.Config().ServiceSettings.PersistentNotificationIntervalMinutes) * time.Minute
	notificationMaxCount := int16(*a.Config().ServiceSettings.PersistentNotificationMaxCount)

	// fetch posts for which the "notificationInterval duration" has passed
	maxTime := time.Now().Add(-notificationInterval).UnixMilli()

	// Pagination loop
	for {
		notificationPosts, err := a.Srv().Store().PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxTime:      maxTime,
			MaxSentCount: notificationMaxCount,
			PerPage:      500,
		})
		if err != nil {
			return errors.Wrap(err, "failed to get posts for persistent notifications")
		}

		// No posts left to send persistent notifications
		if len(notificationPosts) == 0 {
			break
		}

		postIds := make([]string, 0, len(notificationPosts))
		for _, p := range notificationPosts {
			postIds = append(postIds, p.PostId)
		}
		posts, err := a.Srv().Store().Post().GetPostsByIds(postIds)
		if err != nil {
			return errors.Wrap(err, "failed to get posts by IDs")
		}

		// Send notifications
		if err := a.forEachPersistentNotificationPost(posts, a.sendPersistentNotifications); err != nil {
			return err
		}

		if err := a.Srv().Store().PostPersistentNotification().UpdateLastActivity(postIds); err != nil {
			return errors.Wrapf(err, "failed to update lastActivity for notifications: %v", postIds)
		}
	}

	if err := a.Srv().Store().PostPersistentNotification().DeleteExpired(notificationMaxCount); err != nil {
		return errors.Wrap(err, "failed to delete expired notifications")
	}

	return nil
}

func (a *App) forEachPersistentNotificationPost(posts []*model.Post, fn func(post *model.Post, channel *model.Channel, team *model.Team, mentions *ExplicitMentions, profileMap model.UserMap, channelNotifyProps map[string]map[string]model.StringMap) error) error {
	channelsMap, teamsMap, err := a.channelTeamMapsForPosts(posts)
	if err != nil {
		return err
	}

	channelGroupMap, channelProfileMap, channelKeywords, channelNotifyProps, err := a.persistentNotificationsAuxiliaryData(channelsMap, teamsMap)
	if err != nil {
		return err
	}

	for _, post := range posts {
		channel := channelsMap[post.ChannelId]
		team := teamsMap[channel.TeamId]
		// GMs and DMs don't belong to any team
		if channel.IsGroupOrDirect() {
			team = &model.Team{}
		}
		profileMap := channelProfileMap[channel.Id]

		mentions := &ExplicitMentions{}
		// In DMs, only the "other" user can be mentioned
		if channel.Type == model.ChannelTypeDirect {
			otherUserId := channel.GetOtherUserIdForDM(post.UserId)
			if _, ok := profileMap[otherUserId]; ok {
				mentions.addMention(otherUserId, DMMention)
			}
		} else {
			keywords := channelKeywords[channel.Id]
			mentions = getExplicitMentions(post, keywords, channelGroupMap[channel.Id])
			for _, group := range mentions.GroupMentions {
				_, err := a.insertGroupMentions(group, channel, profileMap, mentions)
				if err != nil {
					return errors.Wrapf(err, "failed to include mentions from group - %s for channel - %s", group.Id, channel.Id)
				}
			}
		}

		if err := fn(post, channel, team, mentions, profileMap, channelNotifyProps); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) persistentNotificationsAuxiliaryData(channelsMap map[string]*model.Channel, teamsMap map[string]*model.Team) (map[string]map[string]*model.Group, map[string]model.UserMap, map[string]map[string][]string, map[string]map[string]model.StringMap, error) {
	channelGroupMap := make(map[string]map[string]*model.Group, len(channelsMap))
	channelProfileMap := make(map[string]model.UserMap, len(channelsMap))
	channelKeywords := make(map[string]map[string][]string, len(channelsMap))
	channelNotifyProps := make(map[string]map[string]model.StringMap, len(channelsMap))
	for _, c := range channelsMap {
		// In DM, notifications can't be send to any 3rd person.
		if c.Type != model.ChannelTypeDirect {
			groups, err := a.getGroupsAllowedForReferenceInChannel(c, teamsMap[c.TeamId])
			if err != nil {
				return nil, nil, nil, nil, errors.Wrapf(err, "failed to get profiles for channel %s", c.Id)
			}
			channelGroupMap[c.Id] = make(map[string]*model.Group, len(groups))
			for k, v := range groups {
				channelGroupMap[c.Id][k] = v
			}
			props, err := a.Srv().Store().Channel().GetAllChannelMembersNotifyPropsForChannel(c.Id, true)
			if err != nil {
				return nil, nil, nil, nil, errors.Wrapf(err, "failed to get profiles for channel %s", c.Id)
			}
			channelNotifyProps[c.Id] = props
		}

		profileMap, err := a.Srv().Store().User().GetAllProfilesInChannel(context.Background(), c.Id, true)
		if err != nil {
			return nil, nil, nil, nil, errors.Wrapf(err, "failed to get profiles for channel %s", c.Id)
		}

		channelKeywords[c.Id] = make(map[string][]string, len(profileMap))
		validProfileMap := make(map[string]*model.User, len(profileMap))
		for k, v := range profileMap {
			if v.IsBot {
				continue
			}
			validProfileMap[k] = v
			channelKeywords[c.Id]["@"+v.Username] = []string{k}
		}
		channelProfileMap[c.Id] = validProfileMap
	}
	return channelGroupMap, channelProfileMap, channelKeywords, channelNotifyProps, nil
}

func (a *App) channelTeamMapsForPosts(posts []*model.Post) (map[string]*model.Channel, map[string]*model.Team, error) {
	channelIds := make(model.StringSet)
	for _, p := range posts {
		channelIds.Add(p.ChannelId)
	}
	channels, err := a.Srv().Store().Channel().GetChannelsByIds(channelIds.Val(), false)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to get teams by IDs")
	}
	channelsMap := make(map[string]*model.Channel, len(channels))
	for _, c := range channels {
		channelsMap[c.Id] = c
	}

	teamIds := make(model.StringSet)
	for _, c := range channels {
		if c.TeamId != "" {
			teamIds.Add(c.TeamId)
		}
	}
	teams := make([]*model.Team, 0, len(teamIds))
	if len(teamIds) > 0 {
		teams, err = a.Srv().Store().Team().GetMany(teamIds.Val())
		if err != nil {
			return nil, nil, errors.Wrap(err, "failed to get teams by IDs")
		}
	}
	teamsMap := make(map[string]*model.Team, len(teams))
	for _, t := range teams {
		teamsMap[t.Id] = t
	}
	return channelsMap, teamsMap, nil
}

func (a *App) sendPersistentNotifications(post *model.Post, channel *model.Channel, team *model.Team, mentions *ExplicitMentions, profileMap model.UserMap, channelNotifyProps map[string]map[string]model.StringMap) error {
	mentionedUsersList := make(model.StringArray, 0, len(mentions.Mentions))
	for id := range mentions.Mentions {
		// Don't send notification to post owner
		if id != post.UserId {
			mentionedUsersList = append(mentionedUsersList, id)
		}
	}

	sender := profileMap[post.UserId]
	notification := &PostNotification{
		Post:       post,
		Channel:    channel,
		ProfileMap: profileMap,
		Sender:     sender,
	}

	if int64(len(mentionedUsersList)) > *a.Config().TeamSettings.MaxNotificationsPerChannel {
		return errors.Errorf("mentioned users: %d are more than allowed users: %d", len(mentionedUsersList), *a.Config().TeamSettings.MaxNotificationsPerChannel)
	}

	if a.canSendPushNotifications() {
		for _, userID := range mentionedUsersList {
			user := profileMap[userID]
			if user == nil {
				continue
			}

			status, err := a.GetStatus(userID)
			if err != nil {
				mlog.Warn("Unable to fetch online status", mlog.String("user_id", userID), mlog.Err(err))
				status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
			}

			if ShouldSendPushNotification(profileMap[userID], channelNotifyProps[channel.Id][userID], true, status, post) {
				a.sendPushNotification(
					notification,
					user,
					true,
					false,
					"",
					false,
				)
			} else {
				// register that a notification was not sent
				a.NotificationsLog().Debug("Persistent Notification not sent",
					mlog.String("ackId", ""),
					mlog.String("type", model.PushTypeMessage),
					mlog.String("userId", userID),
					mlog.String("postId", post.Id),
					mlog.String("status", model.PushNotSent),
				)
			}
		}
	}

	desktopUsers := make([]string, 0, len(mentionedUsersList))
	for _, id := range mentionedUsersList {
		user := profileMap[id]
		if user == nil {
			continue
		}

		if user.NotifyProps[model.DesktopNotifyProp] != model.UserNotifyNone && a.persistentNotificationsAllowedForStatus(id) {
			desktopUsers = append(desktopUsers, id)
		}
	}

	if len(desktopUsers) != 0 {
		post = a.PreparePostForClient(request.EmptyContext(a.Log()), post, false, false, true)
		postJSON, jsonErr := post.ToJSON()
		if jsonErr != nil {
			return errors.Wrapf(jsonErr, "failed to encode post to JSON")
		}

		for _, u := range desktopUsers {
			message := model.NewWebSocketEvent(model.WebsocketEventPersistentNotificationTriggered, team.Id, post.ChannelId, u, nil, "")

			message.Add("post", postJSON)
			message.Add("channel_type", channel.Type)
			message.Add("channel_display_name", notification.GetChannelName(model.ShowUsername, ""))
			message.Add("channel_name", channel.Name)
			message.Add("sender_name", notification.GetSenderName(model.ShowUsername, *a.Config().ServiceSettings.EnablePostUsernameOverride))
			message.Add("team_id", team.Id)

			if len(post.FileIds) != 0 {
				message.Add("otherFile", "true")

				infos, err := a.Srv().Store().FileInfo().GetForPost(post.Id, false, false, true)
				if err != nil {
					mlog.Warn("Unable to get fileInfo for push notifications.", mlog.String("post_id", post.Id), mlog.Err(err))
				}

				for _, info := range infos {
					if info.IsImage() {
						message.Add("image", "true")
						break
					}
				}
			}

			message.Add("mentions", model.ArrayToJSON(desktopUsers))
			a.Publish(message)
		}
	}

	return nil
}

func (a *App) persistentNotificationsAllowedForStatus(userID string) bool {
	var status *model.Status
	var err *model.AppError
	if status, err = a.GetStatus(userID); err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	return status.Status != model.StatusDnd && status.Status != model.StatusOutOfOffice
}

func (a *App) IsPersistentNotificationsEnabled() bool {
	return a.IsPostPriorityEnabled() && *a.Config().ServiceSettings.AllowPersistentNotifications
}
