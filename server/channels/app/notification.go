// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/markdown"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/telemetry"
)

func (a *App) canSendPushNotifications() bool {
	if !*a.Config().EmailSettings.SendPushNotifications {
		a.NotificationsLog().Debug("Push notifications are disabled - server config",
			mlog.String("status", model.NotificationStatusNotSent),
			mlog.String("reason", "push_disabled"),
		)
		return false
	}

	pushServer := *a.Config().EmailSettings.PushNotificationServer
	if license := a.Srv().License(); pushServer == model.MHPNS && (license == nil || !*license.Features.MHPNS) {
		a.NotificationsLog().Warn("Push notifications are disabled - license missing",
			mlog.String("status", model.NotificationStatusNotSent),
			mlog.String("reason", "push_disabled_license"),
		)
		mlog.Warn("Push notifications have been disabled. Update your license or go to System Console > Environment > Push Notification Server to use a different server")
		return false
	}

	return true
}

func (a *App) SendNotifications(c request.CTX, post *model.Post, team *model.Team, channel *model.Channel, sender *model.User, parentPostList *model.PostList, setOnline bool) ([]string, error) {
	// Do not send notifications in archived channels
	if channel.DeleteAt > 0 {
		return []string{}, nil
	}

	isCRTAllowed := *a.Config().ServiceSettings.CollapsedThreads != model.CollapsedThreadsDisabled

	pchan := make(chan store.StoreResult[map[string]*model.User], 1)
	go func() {
		props, err := a.Srv().Store().User().GetAllProfilesInChannel(context.Background(), channel.Id, true)
		pchan <- store.StoreResult[map[string]*model.User]{Data: props, NErr: err}
		close(pchan)
	}()

	cmnchan := make(chan store.StoreResult[map[string]model.StringMap], 1)
	go func() {
		props, err := a.Srv().Store().Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
		cmnchan <- store.StoreResult[map[string]model.StringMap]{Data: props, NErr: err}
		close(cmnchan)
	}()

	var gchan chan store.StoreResult[map[string]*model.Group]
	if a.allowGroupMentions(c, post) {
		gchan = make(chan store.StoreResult[map[string]*model.Group], 1)
		go func() {
			groupsMap, err := a.getGroupsAllowedForReferenceInChannel(channel, team)
			gchan <- store.StoreResult[map[string]*model.Group]{Data: groupsMap, NErr: err}
			close(gchan)
		}()
	}

	var fchan chan store.StoreResult[[]*model.FileInfo]
	if len(post.FileIds) != 0 {
		fchan = make(chan store.StoreResult[[]*model.FileInfo], 1)
		go func() {
			fileInfos, err := a.Srv().Store().FileInfo().GetForPost(post.Id, true, false, true)
			fchan <- store.StoreResult[[]*model.FileInfo]{Data: fileInfos, NErr: err}
			close(fchan)
		}()
	}

	var tchan chan store.StoreResult[[]string]
	if isCRTAllowed && post.RootId != "" {
		tchan = make(chan store.StoreResult[[]string], 1)
		go func() {
			followers, err := a.Srv().Store().Thread().GetThreadFollowers(post.RootId, true)
			tchan <- store.StoreResult[[]string]{Data: followers, NErr: err}
			close(tchan)
		}()
	}

	pResult := <-pchan
	if pResult.NErr != nil {
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeAll, model.NotificationReasonFetchError, model.NotificationNoPlatform)
		a.NotificationsLog().Error("Error fetching profiles",
			mlog.String("sender_id", sender.Id),
			mlog.String("post_id", post.Id),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonFetchError),
			mlog.Err(pResult.NErr),
		)
		return nil, pResult.NErr
	}
	profileMap := pResult.Data

	cmnResult := <-cmnchan
	if cmnResult.NErr != nil {
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeAll, model.NotificationReasonFetchError, model.NotificationNoPlatform)
		a.NotificationsLog().Error("Error fetching notify props",
			mlog.String("sender_id", sender.Id),
			mlog.String("post_id", post.Id),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonFetchError),
			mlog.Err(cmnResult.NErr),
		)
		return nil, cmnResult.NErr
	}
	channelMemberNotifyPropsMap := cmnResult.Data

	followers := make(model.StringSet, 0)
	if tchan != nil {
		tResult := <-tchan
		if tResult.NErr != nil {
			a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeAll, model.NotificationReasonFetchError, model.NotificationNoPlatform)
			a.NotificationsLog().Error("Error fetching thread followers",
				mlog.String("sender_id", sender.Id),
				mlog.String("post_id", post.Id),
				mlog.String("status", model.NotificationStatusError),
				mlog.String("reason", model.NotificationReasonFetchError),
				mlog.Err(tResult.NErr),
			)
			return nil, tResult.NErr
		}
		for _, v := range tResult.Data {
			followers.Add(v)
		}
	}

	groups := make(map[string]*model.Group)
	if gchan != nil {
		gResult := <-gchan
		if gResult.NErr != nil {
			a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeAll, model.NotificationReasonFetchError, model.NotificationNoPlatform)
			a.NotificationsLog().Error("Error fetching group mentions",
				mlog.String("sender_id", sender.Id),
				mlog.String("post_id", post.Id),
				mlog.String("status", model.NotificationStatusError),
				mlog.String("reason", model.NotificationReasonFetchError),
				mlog.Err(gResult.NErr),
			)
			return nil, gResult.NErr
		}
		groups = gResult.Data
	}

	a.NotificationsLog().Trace("Successfully fetched all profiles",
		mlog.String("sender_id", sender.Id),
		mlog.String("post_id", post.Id),
	)

	mentions, keywords := a.getExplicitMentionsAndKeywords(c, post, channel, profileMap, groups, channelMemberNotifyPropsMap, parentPostList)

	var allActivityPushUserIds []string
	if channel.Type != model.ChannelTypeDirect {
		// Iterate through all groups that were mentioned and insert group members into the list of mentions or potential mentions
		for groupID := range mentions.GroupMentions {
			group := groups[groupID]
			anyUsersMentionedByGroup, err := a.insertGroupMentions(sender.Id, group, channel, profileMap, mentions)
			if err != nil {
				a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeAll, model.NotificationReasonFetchError, model.NotificationNoPlatform)
				a.NotificationsLog().Error("Failed to populate group mentions",
					mlog.String("sender_id", sender.Id),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusError),
					mlog.String("reason", model.NotificationReasonFetchError),
					mlog.Err(err),
				)
				return nil, err
			}

			if !anyUsersMentionedByGroup {
				a.sendNoUsersNotifiedByGroupInChannel(c, sender, post, channel, groups[groupID])
			}
		}

		go func() {
			_, err := a.sendOutOfChannelMentions(c, sender, post, channel, mentions.OtherPotentialMentions)
			if err != nil {
				a.NotificationsLog().Warn("Failed to send warning for out of channel mentions",
					mlog.String("sender_id", sender.Id),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusError),
					mlog.String("reason", "failed_to_send_out_of_channel"),
					mlog.Err(err),
				)
				c.Logger().Error("Failed to send warning for out of channel mentions", mlog.String("user_id", sender.Id), mlog.String("post_id", post.Id), mlog.Err(err))
			}
		}()

		// find which users in the channel are set up to always receive mobile notifications
		// excludes CRT users since those should be added in notificationsForCRT
		for _, profile := range profileMap {
			if (profile.NotifyProps[model.PushNotifyProp] == model.UserNotifyAll ||
				channelMemberNotifyPropsMap[profile.Id][model.PushNotifyProp] == model.ChannelNotifyAll) &&
				(post.UserId != profile.Id || post.GetProp("from_webhook") == "true") &&
				!post.IsSystemMessage() &&
				!(a.IsCRTEnabledForUser(c, profile.Id) && post.RootId != "") {
				allActivityPushUserIds = append(allActivityPushUserIds, profile.Id)
			}
		}
	}

	mentionedUsersList := make(model.StringArray, 0, len(mentions.Mentions))
	mentionAutofollowChans := []chan *model.AppError{}
	threadParticipants := map[string]bool{post.UserId: true}
	newParticipants := map[string]bool{}
	participantMemberships := map[string]*model.ThreadMembership{}
	membershipsMutex := &sync.Mutex{}
	followersMutex := &sync.Mutex{}
	if *a.Config().ServiceSettings.ThreadAutoFollow && post.RootId != "" {
		var rootMentions *MentionResults
		if parentPostList != nil {
			rootPost := parentPostList.Posts[parentPostList.Order[0]]
			if rootPost.GetProp("from_webhook") != "true" {
				threadParticipants[rootPost.UserId] = true
			}
			if channel.Type != model.ChannelTypeDirect {
				rootMentions = getExplicitMentions(rootPost, keywords)
				for id := range rootMentions.Mentions {
					threadParticipants[id] = true
				}
			}
		}
		for id := range mentions.Mentions {
			threadParticipants[id] = true
		}

		if channel.Type != model.ChannelTypeDirect {
			for id, propsMap := range channelMemberNotifyPropsMap {
				if ok := followers.Has(id); !ok && propsMap[model.ChannelAutoFollowThreads] == model.ChannelAutoFollowThreadsOn {
					threadParticipants[id] = true
				}
			}
		}

		// sema is a counting semaphore to throttle the number of concurrent DB requests.
		// A concurrency of 8 should be sufficient.
		// We don't want to set a higher limit which can bring down the DB.
		sema := make(chan struct{}, 8)
		// for each mention, make sure to update thread autofollow (if enabled) and update increment mention count
		for id := range threadParticipants {
			mac := make(chan *model.AppError, 1)
			// Get token.
			sema <- struct{}{}
			go func(userID string) {
				defer func() {
					close(mac)
					// Release token.
					<-sema
				}()
				mentionType, incrementMentions := mentions.Mentions[userID]
				// if the user was not explicitly mentioned, check if they explicitly unfollowed the thread
				if !incrementMentions {
					membership, err := a.Srv().Store().Thread().GetMembershipForUser(userID, post.RootId)
					var nfErr *store.ErrNotFound

					if err != nil && !errors.As(err, &nfErr) {
						mac <- model.NewAppError("SendNotifications", "app.channel.autofollow.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
						return
					}

					if membership != nil && !membership.Following {
						return
					}
				}

				updateFollowing := *a.Config().ServiceSettings.ThreadAutoFollow
				if mentionType == ThreadMention || mentionType == CommentMention {
					incrementMentions = false
					updateFollowing = false
				}
				opts := store.ThreadMembershipOpts{
					Following:             true,
					IncrementMentions:     incrementMentions,
					UpdateFollowing:       updateFollowing,
					UpdateViewedTimestamp: false,
					UpdateParticipants:    userID == post.UserId,
				}
				threadMembership, err := a.Srv().Store().Thread().MaintainMembership(userID, post.RootId, opts)
				if err != nil {
					mac <- model.NewAppError("SendNotifications", "app.channel.autofollow.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
					return
				}

				followersMutex.Lock()
				// add new followers to existing followers
				if ok := followers.Has(userID); !ok && threadMembership.Following {
					followers.Add(userID)
					newParticipants[userID] = true
				}
				followersMutex.Unlock()

				membershipsMutex.Lock()
				participantMemberships[userID] = threadMembership
				membershipsMutex.Unlock()

				mac <- nil
			}(id)
			mentionAutofollowChans = append(mentionAutofollowChans, mac)
		}
	}
	for id := range mentions.Mentions {
		mentionedUsersList = append(mentionedUsersList, id)
	}

	nErr := a.Srv().Store().Channel().IncrementMentionCount(post.ChannelId, mentionedUsersList, post.RootId == "", post.IsUrgent())

	if nErr != nil {
		c.Logger().Warn(
			"Failed to update mention count",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
			mlog.Err(nErr),
		)
	}

	a.NotificationsLog().Trace("Finished processing mentions",
		mlog.String("sender_id", sender.Id),
		mlog.String("post_id", post.Id),
	)

	// Log the problems that might have occurred while auto following the thread
	for _, mac := range mentionAutofollowChans {
		if err := <-mac; err != nil {
			c.Logger().Warn(
				"Failed to update thread autofollow from mention",
				mlog.String("post_id", post.Id),
				mlog.String("channel_id", post.ChannelId),
				mlog.Err(err),
			)
		}
	}

	notificationsForCRT := &CRTNotifiers{}
	if isCRTAllowed && post.RootId != "" {
		for uid := range followers {
			profile := profileMap[uid]
			if profile == nil || !a.IsCRTEnabledForUser(c, uid) {
				continue
			}

			if post.GetProp("from_webhook") != "true" && uid == post.UserId {
				continue
			}

			// add user id to notificationsForCRT depending on threads notify props
			notificationsForCRT.addFollowerToNotify(profile, mentions, channelMemberNotifyPropsMap[profile.Id], channel)
		}
	}

	notification := &PostNotification{
		Post:       post.Clone(),
		Channel:    channel,
		ProfileMap: profileMap,
		Sender:     sender,
	}

	if *a.Config().EmailSettings.SendEmailNotifications {
		a.NotificationsLog().Trace("Begin sending email notifications",
			mlog.String("type", model.NotificationTypeEmail),
			mlog.String("sender_id", sender.Id),
			mlog.String("post_id", post.Id),
		)
		emailRecipients := append(mentionedUsersList, notificationsForCRT.Email...)
		emailRecipients = model.RemoveDuplicateStrings(emailRecipients)

		for _, id := range emailRecipients {
			if profileMap[id] == nil {
				a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeEmail, model.NotificationReasonMissingProfile, model.NotificationNoPlatform)
				a.NotificationsLog().Error("Missing profile",
					mlog.String("type", model.NotificationTypeEmail),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusNotSent),
					mlog.String("reason", model.NotificationReasonMissingProfile),
					mlog.String("sender_id", sender.Id),
					mlog.String("receiver_id", id),
				)
				continue
			}

			// If email verification is required and user email is not verified don't send email.
			if *a.Config().EmailSettings.RequireEmailVerification && !profileMap[id].EmailVerified {
				a.CountNotificationReason(model.NotificationStatusNotSent, model.NotificationTypeEmail, model.NotificationReasonEmailNotVerified, model.NotificationNoPlatform)
				a.NotificationsLog().Debug("Email not verified",
					mlog.String("type", model.NotificationTypeEmail),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusNotSent),
					mlog.String("reason", model.NotificationReasonEmailNotVerified),
					mlog.String("sender_id", sender.Id),
					mlog.String("receiver_id", id),
				)
				c.Logger().Debug("Skipped sending notification email, address not verified.", mlog.String("user_email", profileMap[id].Email), mlog.String("user_id", id))
				continue
			}

			if a.userAllowsEmail(c, profileMap[id], channelMemberNotifyPropsMap[id], post) {
				senderProfileImage, _, err := a.GetProfileImage(sender)
				if err != nil {
					c.Logger().Warn("Unable to get the sender user profile image.", mlog.String("user_id", sender.Id), mlog.Err(err))
				}
				if err := a.sendNotificationEmail(c, notification, profileMap[id], team, senderProfileImage); err != nil {
					a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeEmail, model.NotificationReasonEmailSendError, model.NotificationNoPlatform)
					a.NotificationsLog().Error("Error sending email notification",
						mlog.String("type", model.NotificationTypeEmail),
						mlog.String("post_id", post.Id),
						mlog.String("status", model.NotificationStatusError),
						mlog.String("reason", model.NotificationReasonEmailSendError),
						mlog.String("sender_id", sender.Id),
						mlog.String("receiver_id", id),
						mlog.Err(err),
					)
					c.Logger().Warn("Unable to send notification email.", mlog.Err(err))
				}
			} else {
				a.NotificationsLog().Debug("Email disallowed by user",
					mlog.String("type", model.NotificationTypeEmail),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusNotSent),
					mlog.String("reason", "email_disallowed_by_user"),
					mlog.String("sender_id", sender.Id),
					mlog.String("receiver_id", id),
				)
			}
		}

		a.NotificationsLog().Trace("Finished sending email notifications",
			mlog.String("type", model.NotificationTypeEmail),
			mlog.String("sender_id", sender.Id),
			mlog.String("post_id", post.Id),
		)
	}

	// Check for channel-wide mentions in channels that have too many members for those to work
	if int64(len(profileMap)) > *a.Config().TeamSettings.MaxNotificationsPerChannel {
		a.CountNotificationReason(model.NotificationStatusNotSent, model.NotificationTypeAll, model.NotificationReasonTooManyUsersInChannel, model.NotificationNoPlatform)
		a.NotificationsLog().Debug("Too many users to notify - will send ephemeral message",
			mlog.String("sender_id", sender.Id),
			mlog.String("post_id", post.Id),
			mlog.String("status", model.NotificationStatusNotSent),
			mlog.String("reason", model.NotificationReasonTooManyUsersInChannel),
		)

		T := i18n.GetUserTranslations(sender.Locale)

		if mentions.HereMentioned {
			a.SendEphemeralPost(
				c,
				post.UserId,
				&model.Post{
					ChannelId: post.ChannelId,
					Message:   T("api.post.disabled_here", map[string]any{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
					CreateAt:  post.CreateAt + 1,
				},
			)
		}

		if mentions.ChannelMentioned {
			a.SendEphemeralPost(
				c,
				post.UserId,
				&model.Post{
					ChannelId: post.ChannelId,
					Message:   T("api.post.disabled_channel", map[string]any{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
					CreateAt:  post.CreateAt + 1,
				},
			)
		}

		if mentions.AllMentioned {
			a.SendEphemeralPost(
				c,
				post.UserId,
				&model.Post{
					ChannelId: post.ChannelId,
					Message:   T("api.post.disabled_all", map[string]any{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
					CreateAt:  post.CreateAt + 1,
				},
			)
		}
	}

	if a.canSendPushNotifications() {
		a.NotificationsLog().Trace("Begin sending push notifications",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("sender_id", sender.Id),
			mlog.String("post_id", post.Id),
		)

		for _, id := range mentionedUsersList {
			if profileMap[id] == nil {
				a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, model.NotificationReasonMissingProfile, model.NotificationNoPlatform)
				a.NotificationsLog().Error("Missing profile",
					mlog.String("type", model.NotificationTypePush),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusNotSent),
					mlog.String("reason", model.NotificationReasonMissingProfile),
					mlog.String("sender_id", sender.Id),
					mlog.String("receiver_id", id),
				)
				continue
			}

			if notificationsForCRT.Push.Contains(id) {
				a.NotificationsLog().Trace("Skipped direct push notification - will send as CRT notification",
					mlog.String("type", model.NotificationTypePush),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusNotSent),
					mlog.String("sender_id", sender.Id),
				)
				continue
			}

			var status *model.Status
			var err *model.AppError
			if status, err = a.GetStatus(id); err != nil {
				status = &model.Status{UserId: id, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
			}

			isExplicitlyMentioned := mentions.Mentions[id] > GMMention
			isGM := channel.Type == model.ChannelTypeGroup
			if a.ShouldSendPushNotification(profileMap[id], channelMemberNotifyPropsMap[id], isExplicitlyMentioned, status, post, isGM) {
				mentionType := mentions.Mentions[id]

				replyToThreadType := ""
				if mentionType == ThreadMention {
					replyToThreadType = model.CommentsNotifyAny
				} else if mentionType == CommentMention {
					replyToThreadType = model.CommentsNotifyRoot
				}

				a.sendPushNotification(
					notification,
					profileMap[id],
					mentionType == KeywordMention || mentionType == ChannelMention || mentionType == DMMention,
					mentionType == ChannelMention,
					replyToThreadType,
				)
			}
		}

		for _, id := range allActivityPushUserIds {
			if profileMap[id] == nil {
				a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, model.NotificationReasonMissingProfile, model.NotificationNoPlatform)
				a.NotificationsLog().Error("Missing profile",
					mlog.String("type", model.NotificationTypePush),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusError),
					mlog.String("reason", model.NotificationReasonMissingProfile),
					mlog.String("sender_id", sender.Id),
					mlog.String("receiver_id", id),
				)
				continue
			}

			if notificationsForCRT.Push.Contains(id) {
				a.NotificationsLog().Trace("Skipped direct push notification - will send as CRT notification",
					mlog.String("type", model.NotificationTypePush),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusNotSent),
					mlog.String("sender_id", sender.Id),
				)
				continue
			}

			if _, ok := mentions.Mentions[id]; !ok {
				var status *model.Status
				var err *model.AppError
				if status, err = a.GetStatus(id); err != nil {
					status = &model.Status{UserId: id, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
				}

				isGM := channel.Type == model.ChannelTypeGroup
				if a.ShouldSendPushNotification(profileMap[id], channelMemberNotifyPropsMap[id], false, status, post, isGM) {
					a.sendPushNotification(
						notification,
						profileMap[id],
						false,
						false,
						"",
					)
				}
			}
		}

		for _, id := range notificationsForCRT.Push {
			if profileMap[id] == nil {
				a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, model.NotificationReasonMissingProfile, model.NotificationNoPlatform)
				a.NotificationsLog().Error("Missing profile",
					mlog.String("type", model.NotificationTypePush),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusError),
					mlog.String("reason", model.NotificationReasonMissingProfile),
					mlog.String("sender_id", sender.Id),
					mlog.String("receiver_id", id),
				)
				continue
			}

			var status *model.Status
			var err *model.AppError
			if status, err = a.GetStatus(id); err != nil {
				status = &model.Status{UserId: id, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
			}

			if statusReason := doesStatusAllowPushNotification(profileMap[id].NotifyProps, status, post.ChannelId, true); statusReason == "" {
				a.sendPushNotification(
					notification,
					profileMap[id],
					false,
					false,
					model.CommentsNotifyCRT,
				)
			} else {
				a.CountNotificationReason(model.NotificationStatusNotSent, model.NotificationTypePush, statusReason, model.NotificationNoPlatform)
				a.NotificationsLog().Debug("Notification not sent - status",
					mlog.String("type", model.NotificationTypePush),
					mlog.String("post_id", post.Id),
					mlog.String("status", model.NotificationStatusNotSent),
					mlog.String("reason", statusReason),
					mlog.String("status_reason", statusReason),
					mlog.String("sender_id", post.UserId),
					mlog.String("receiver_id", id),
					mlog.String("receiver_status", status.Status),
				)
			}
		}

		a.NotificationsLog().Trace("Finished sending push notifications",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("sender_id", sender.Id),
			mlog.String("post_id", post.Id),
		)
	}

	a.NotificationsLog().Trace("Begin sending websocket notifications",
		mlog.String("type", model.NotificationTypeWebsocket),
		mlog.String("sender_id", sender.Id),
		mlog.String("post_id", post.Id),
	)

	message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", post.ChannelId, "", nil, "")

	message.Add("channel_type", channel.Type)
	message.Add("channel_display_name", notification.GetChannelName(model.ShowUsername, ""))
	message.Add("channel_name", channel.Name)
	message.Add("sender_name", notification.GetSenderName(model.ShowUsername, *a.Config().ServiceSettings.EnablePostUsernameOverride))
	message.Add("team_id", team.Id)
	message.Add("set_online", setOnline)

	if len(post.FileIds) != 0 && fchan != nil {
		message.Add("otherFile", "true")

		var infos []*model.FileInfo
		if fResult := <-fchan; fResult.NErr != nil {
			c.Logger().Warn("Unable to get fileInfo for push notifications.", mlog.String("post_id", post.Id), mlog.Err(fResult.NErr))
		} else {
			infos = fResult.Data
		}

		for _, info := range infos {
			if info.IsImage() {
				message.Add("image", "true")
				break
			}
		}
	}

	if len(mentionedUsersList) > 0 {
		useAddMentionsHook(message, mentionedUsersList)
	}

	if len(notificationsForCRT.Desktop) > 0 {
		useAddFollowersHook(message, notificationsForCRT.Desktop)
	}

	// Collect user IDs of whom we want to acknowledge the websocket event for notification metrics
	usersToAck := []string{}
	for id, profile := range profileMap {
		userNotificationLevel := profile.NotifyProps[model.DesktopNotifyProp]
		channelNotificationLevel := channelMemberNotifyPropsMap[id][model.DesktopNotifyProp]

		if shouldAckWebsocketNotification(channel.Type, userNotificationLevel, channelNotificationLevel) {
			usersToAck = append(usersToAck, id)
		}
	}
	usePostedAckHook(message, post.UserId, channel.Type, usersToAck)

	appErr := a.publishWebsocketEventForPost(c, post, message)
	if appErr != nil {
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonFetchError, model.NotificationNoPlatform)
		a.NotificationsLog().Error("Couldn't send websocket notification for permalink post",
			mlog.String("type", model.NotificationTypeWebsocket),
			mlog.String("post_id", post.Id),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonFetchError),
			mlog.String("sender_id", sender.Id),
			mlog.Err(appErr),
		)
		return nil, appErr
	}

	// If this is a reply in a thread, notify participants
	if isCRTAllowed && post.RootId != "" {
		for uid := range followers {
			// A user following a thread but had left the channel won't get a notification
			// https://mattermost.atlassian.net/browse/MM-36769
			if profileMap[uid] == nil {
				// This also sometimes happens when bots, which will never show up in the map, reply to threads
				// Their own post goes through this and they get "notified", which we don't need to count as an error if they can't
				if uid != post.UserId {
					a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonMissingProfile, model.NotificationNoPlatform)
					a.NotificationsLog().Error("Missing profile",
						mlog.String("type", model.NotificationTypeWebsocket),
						mlog.String("post_id", post.Id),
						mlog.String("status", model.NotificationStatusError),
						mlog.String("reason", model.NotificationReasonMissingProfile),
						mlog.String("sender_id", sender.Id),
						mlog.String("receiver_id", uid),
					)
				}
				continue
			}
			if a.IsCRTEnabledForUser(c, uid) {
				message := model.NewWebSocketEvent(model.WebsocketEventThreadUpdated, team.Id, "", uid, nil, "")
				threadMembership := participantMemberships[uid]
				if threadMembership == nil {
					tm, err := a.Srv().Store().Thread().GetMembershipForUser(uid, post.RootId)
					if err != nil {
						a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonFetchError, model.NotificationNoPlatform)
						a.NotificationsLog().Error("Missing thread membership",
							mlog.String("type", model.NotificationTypeWebsocket),
							mlog.String("post_id", post.Id),
							mlog.String("status", model.NotificationStatusError),
							mlog.String("reason", model.NotificationReasonFetchError),
							mlog.String("sender_id", sender.Id),
							mlog.String("receiver_id", uid),
							mlog.Err(err),
						)
						return nil, errors.Wrapf(err, "Missing thread membership for participant in notifications. user_id=%q thread_id=%q", uid, post.RootId)
					}
					if tm == nil {
						a.CountNotificationReason(model.NotificationStatusNotSent, model.NotificationTypeWebsocket, model.NotificationReasonMissingThreadMembership, model.NotificationNoPlatform)
						a.NotificationsLog().Warn("Missing thread membership",
							mlog.String("type", model.NotificationTypeWebsocket),
							mlog.String("post_id", post.Id),
							mlog.String("status", model.NotificationStatusNotSent),
							mlog.String("reason", model.NotificationReasonMissingThreadMembership),
							mlog.String("sender_id", sender.Id),
							mlog.String("receiver_id", uid),
						)
						continue
					}
					threadMembership = tm
				}
				userThread, err := a.Srv().Store().Thread().GetThreadForUser(threadMembership, true, a.IsPostPriorityEnabled())
				if err != nil {
					a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonFetchError, model.NotificationNoPlatform)
					a.NotificationsLog().Error("Missing thread",
						mlog.String("type", model.NotificationTypeWebsocket),
						mlog.String("post_id", post.Id),
						mlog.String("status", model.NotificationStatusError),
						mlog.String("reason", model.NotificationReasonFetchError),
						mlog.String("sender_id", sender.Id),
						mlog.String("receiver_id", uid),
						mlog.Err(err),
					)
					return nil, errors.Wrapf(err, "cannot get thread %q for user %q", post.RootId, uid)
				}
				if userThread != nil {
					previousUnreadMentions := int64(0)
					previousUnreadReplies := int64(0)

					// if it's not a newly followed thread, calculate previous unread values.
					if !newParticipants[uid] {
						previousUnreadMentions = userThread.UnreadMentions
						previousUnreadReplies = max(userThread.UnreadReplies-1, 0)

						if mentions.isUserMentioned(uid) {
							previousUnreadMentions = max(userThread.UnreadMentions-1, 0)
						}
					}

					// set LastViewed to now for commenter
					if uid == post.UserId {
						opts := store.ThreadMembershipOpts{
							UpdateViewedTimestamp: true,
						}
						// should set unread mentions, and unread replies to 0
						_, err = a.Srv().Store().Thread().MaintainMembership(uid, post.RootId, opts)
						if err != nil {
							a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonFetchError, model.NotificationNoPlatform)
							a.NotificationsLog().Error("Failed to update thread membership",
								mlog.String("type", model.NotificationTypeWebsocket),
								mlog.String("post_id", post.Id),
								mlog.String("status", model.NotificationStatusError),
								mlog.String("reason", model.NotificationReasonFetchError),
								mlog.String("sender_id", sender.Id),
								mlog.String("receiver_id", uid),
								mlog.Err(err),
							)
							return nil, errors.Wrapf(err, "cannot maintain thread membership %q for user %q", post.RootId, uid)
						}
						userThread.UnreadMentions = 0
						userThread.UnreadReplies = 0
					}
					a.sanitizeProfiles(userThread.Participants, false)
					userThread.Post.SanitizeProps()

					sanitizedPost, err := a.SanitizePostMetadataForUser(c, userThread.Post, uid)
					if err != nil {
						a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonParseError, model.NotificationNoPlatform)
						a.NotificationsLog().Error("Failed to sanitize metadata",
							mlog.String("type", model.NotificationTypeWebsocket),
							mlog.String("post_id", post.Id),
							mlog.String("status", model.NotificationStatusError),
							mlog.String("reason", model.NotificationReasonParseError),
							mlog.String("sender_id", sender.Id),
							mlog.String("receiver_id", uid),
							mlog.Err(err),
						)
						return nil, err
					}
					userThread.Post = sanitizedPost

					payload, jsonErr := json.Marshal(userThread)
					if jsonErr != nil {
						c.Logger().Warn("Failed to encode thread to JSON")
					}
					message.Add("thread", string(payload))
					message.Add("previous_unread_mentions", previousUnreadMentions)
					message.Add("previous_unread_replies", previousUnreadReplies)

					a.Publish(message)
				}
			}
		}
	}

	a.NotificationsLog().Trace("Finish sending websocket notifications",
		mlog.String("type", model.NotificationTypeWebsocket),
		mlog.String("sender_id", sender.Id),
		mlog.String("post_id", post.Id),
	)

	for id, reason := range mentions.Mentions {
		user, ok := profileMap[id]
		if !ok {
			continue
		}
		if user.IsGuest() {
			if reason == KeywordMention {
				a.Srv().telemetryService.SendTelemetryForFeature(
					telemetry.TrackGuestFeature,
					"post_mentioned_guest",
					map[string]any{telemetry.TrackPropertyUser: user.Id, telemetry.TrackPropertyPostAuthor: sender.Id},
				)
			} else if reason == DMMention {
				a.Srv().telemetryService.SendTelemetryForFeature(
					telemetry.TrackGuestFeature,
					"direct_message_to_guest",
					map[string]any{telemetry.TrackPropertyUser: user.Id, telemetry.TrackPropertyPostAuthor: sender.Id},
				)
			}
		}
		if user.IsRemote() {
			a.Srv().telemetryService.SendTelemetryForFeature(telemetry.TrackSharedChannelsFeature, "mentioned_remote_user", map[string]any{telemetry.TrackPropertyUser: user.Id, telemetry.TrackPropertyPostAuthor: sender.Id})
		}
	}
	for groupId := range mentions.GroupMentions {
		a.Srv().telemetryService.SendTelemetryForFeature(telemetry.TrackGroupsFeature, "post_mentioned_custom_group", map[string]any{telemetry.TrackPropertyUser: sender.Id, telemetry.TrackPropertyGroup: groupId, "group_size": groups[groupId].MemberCount})
	}
	return mentionedUsersList, nil
}

func (a *App) RemoveNotifications(c request.CTX, post *model.Post, channel *model.Channel) error {
	isCRTAllowed := *a.Config().ServiceSettings.CollapsedThreads != model.CollapsedThreadsDisabled

	// CRT is the main issue in this case as notifications indicator are not updated when accessing threads from the sidebar.
	if isCRTAllowed && post.RootId != "" {
		var team *model.Team
		if channel.TeamId != "" {
			t, err1 := a.Srv().Store().Team().Get(channel.TeamId)
			if err1 != nil {
				return model.NewAppError("RemoveNotifications", "app.post.delete_post.get_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err1)
			}
			team = t
		} else {
			// Blank team for DMs
			team = &model.Team{}
		}

		pCh := make(chan store.StoreResult[map[string]*model.User], 1)
		go func() {
			props, err := a.Srv().Store().User().GetAllProfilesInChannel(context.Background(), channel.Id, true)
			pCh <- store.StoreResult[map[string]*model.User]{Data: props, NErr: err}
			close(pCh)
		}()

		cmnCh := make(chan store.StoreResult[map[string]model.StringMap], 1)
		go func() {
			props, err := a.Srv().Store().Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
			cmnCh <- store.StoreResult[map[string]model.StringMap]{Data: props, NErr: err}
			close(cmnCh)
		}()

		var gCh chan store.StoreResult[map[string]*model.Group]
		if a.allowGroupMentions(c, post) {
			gCh = make(chan store.StoreResult[map[string]*model.Group], 1)
			go func() {
				groupsMap, err := a.getGroupsAllowedForReferenceInChannel(channel, team)
				gCh <- store.StoreResult[map[string]*model.Group]{Data: groupsMap, NErr: err}
				close(gCh)
			}()
		}

		resultP := <-pCh
		if resultP.NErr != nil {
			return resultP.NErr
		}
		profileMap := resultP.Data

		resultCmn := <-cmnCh
		if resultCmn.NErr != nil {
			return resultCmn.NErr
		}
		channelMemberNotifyPropsMap := resultCmn.Data

		groups := make(map[string]*model.Group)
		if gCh != nil {
			resultG := <-gCh
			if resultG.NErr != nil {
				return resultG.NErr
			}
			groups = resultG.Data
		}

		mentions, _ := a.getExplicitMentionsAndKeywords(c, post, channel, profileMap, groups, channelMemberNotifyPropsMap, nil)

		userIDs := []string{}
		for groupID := range mentions.GroupMentions {
			for page := 0; ; page++ {
				groupMemberPage, count, appErr := a.GetGroupMemberUsersPage(groupID, page, 100, &model.ViewUsersRestrictions{Channels: []string{channel.Id}})
				if appErr != nil {
					return appErr
				}

				for _, user := range groupMemberPage {
					userIDs = append(userIDs, user.Id)
				}

				// count is the total number of users that match the filter criteria.
				// When we've processed `count` number of users, we know there aren't
				// any more users left to query and we can break the loop
				if len(userIDs) == count {
					break
				}
			}
		}

		for userID := range mentions.Mentions {
			userIDs = append(userIDs, userID)
		}

		for _, userID := range userIDs {
			threadMembership, appErr := a.GetThreadMembershipForUser(userID, post.RootId)
			if appErr != nil {
				return appErr
			}

			// If the user has viewed the thread or there are no unread mentions, skip.
			if threadMembership.LastViewed > post.CreateAt || threadMembership.UnreadMentions == 0 {
				continue
			}

			threadMembership.UnreadMentions -= 1
			if _, err := a.Srv().Store().Thread().UpdateMembership(threadMembership); err != nil {
				return err
			}

			userThread, err := a.Srv().Store().Thread().GetThreadForUser(threadMembership, true, a.IsPostPriorityEnabled())
			if err != nil {
				return err
			}

			if userThread != nil {
				previousUnreadMentions := int64(0)
				previousUnreadReplies := int64(0)

				a.sanitizeProfiles(userThread.Participants, false)
				userThread.Post.SanitizeProps()

				sanitizedPost, err1 := a.SanitizePostMetadataForUser(c, userThread.Post, userID)
				if err1 != nil {
					return err1
				}
				userThread.Post = sanitizedPost

				payload, jsonErr := json.Marshal(userThread)
				if jsonErr != nil {
					c.Logger().Warn("Failed to encode thread to JSON")
				}

				message := model.NewWebSocketEvent(model.WebsocketEventThreadUpdated, team.Id, "", userID, nil, "")
				message.Add("thread", string(payload))
				message.Add("previous_unread_mentions", previousUnreadMentions)
				message.Add("previous_unread_replies", previousUnreadReplies)

				a.Publish(message)
			}
		}
	}

	return nil
}

func (a *App) getExplicitMentionsAndKeywords(c request.CTX, post *model.Post, channel *model.Channel, profileMap map[string]*model.User, groups map[string]*model.Group, channelMemberNotifyPropsMap map[string]model.StringMap, parentPostList *model.PostList) (*MentionResults, MentionKeywords) {
	mentions := &MentionResults{}
	var allowChannelMentions bool
	var keywords MentionKeywords

	if channel.Type == model.ChannelTypeDirect {
		isWebhook := post.GetProp("from_webhook") == "true"

		// A bot can post in a DM where it doesn't belong to.
		// Therefore, we cannot "guess" who is the other user,
		// so we add the mention to any user that is not the
		// poster unless the post comes from a webhook.
		user1, user2 := channel.GetBothUsersForDM()
		if (post.UserId != user1) || isWebhook {
			if _, ok := profileMap[user1]; ok {
				mentions.addMention(user1, DMMention)
			} else {
				a.Log().Debug("missing profile: DM user not in profiles", mlog.String("userId", user1), mlog.String("channelId", channel.Id))
			}
		}

		if user2 != "" {
			if (post.UserId != user2) || isWebhook {
				if _, ok := profileMap[user2]; ok {
					mentions.addMention(user2, DMMention)
				} else {
					a.Log().Debug("missing profile: DM user not in profiles", mlog.String("userId", user2), mlog.String("channelId", channel.Id))
				}
			}
		}
	} else {
		allowChannelMentions = a.allowChannelMentions(c, post, len(profileMap))
		keywords = a.getMentionKeywordsInChannel(profileMap, allowChannelMentions, channelMemberNotifyPropsMap, groups)

		mentions = getExplicitMentions(post, keywords)

		// Add a GM mention to all members of a GM channel
		if channel.Type == model.ChannelTypeGroup {
			for id := range channelMemberNotifyPropsMap {
				if _, ok := profileMap[id]; ok {
					mentions.addMention(id, GMMention)
				} else {
					a.Log().Debug("missing profile: GM user not in profiles", mlog.String("userId", id), mlog.String("channelId", channel.Id))
				}
			}
		}

		// Add an implicit mention when a user is added to a channel
		// even if the user has set 'username mentions' to false in account settings.
		if post.Type == model.PostTypeAddToChannel {
			if addedUserId, ok := post.GetProp(model.PostPropsAddedUserId).(string); ok {
				if _, ok := profileMap[addedUserId]; ok {
					mentions.addMention(addedUserId, KeywordMention)
				} else {
					a.Log().Debug("missing profile: user added to channel not in profiles", mlog.String("userId", addedUserId), mlog.String("channelId", channel.Id))
				}
			}
		}

		// Get users that have comment thread mentions enabled
		if post.RootId != "" && parentPostList != nil {
			for _, threadPost := range parentPostList.Posts {
				profile := profileMap[threadPost.UserId]
				if profile == nil {
					// Not logging missing profile since this is relatively expected
					continue
				}

				// If this is the root post and it was posted by an OAuth bot, don't notify the user
				if threadPost.Id == parentPostList.Order[0] && threadPost.IsFromOAuthBot() {
					continue
				}
				if a.IsCRTEnabledForUser(c, profile.Id) {
					continue
				}
				if profile.NotifyProps[model.CommentsNotifyProp] == model.CommentsNotifyAny || (profile.NotifyProps[model.CommentsNotifyProp] == model.CommentsNotifyRoot && threadPost.Id == parentPostList.Order[0]) {
					mentionType := ThreadMention
					if threadPost.Id == parentPostList.Order[0] {
						mentionType = CommentMention
					}

					mentions.addMention(threadPost.UserId, mentionType)
				}
			}
		}

		// Prevent the user from mentioning themselves
		if post.GetProp("from_webhook") != "true" {
			mentions.removeMention(post.UserId)
		}
	}

	return mentions, keywords
}

func (a *App) userAllowsEmail(c request.CTX, user *model.User, channelMemberNotificationProps model.StringMap, post *model.Post) bool {
	// if user is a bot account or remote, then we do not send email
	if user.IsBot || user.IsRemote() {
		return false
	}

	userAllowsEmails := user.NotifyProps[model.EmailNotifyProp] != "false"

	// if CRT is ON for user and the post is a reply disregard the channelEmail setting
	if channelEmail, ok := channelMemberNotificationProps[model.EmailNotifyProp]; ok && !(a.IsCRTEnabledForUser(c, user.Id) && post.RootId != "") {
		if channelEmail != model.ChannelNotifyDefault {
			userAllowsEmails = channelEmail != "false"
		}
	}

	// Remove the user as recipient when the user has muted the channel.
	if channelMuted, ok := channelMemberNotificationProps[model.MarkUnreadNotifyProp]; ok {
		if channelMuted == model.ChannelMarkUnreadMention {
			c.Logger().Debug("Channel muted for user", mlog.String("user_id", user.Id), mlog.String("channel_mute", channelMuted))
			userAllowsEmails = false
		}
	}

	var status *model.Status
	var err *model.AppError
	if status, err = a.GetStatus(user.Id); err != nil {
		status = &model.Status{
			UserId:         user.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: 0,
			ActiveChannel:  "",
		}
	}

	autoResponderRelated := status.Status == model.StatusOutOfOffice || post.Type == model.PostTypeAutoResponder
	emailNotificationsAllowedForStatus := status.Status != model.StatusOnline && status.Status != model.StatusDnd

	return userAllowsEmails && emailNotificationsAllowedForStatus && user.DeleteAt == 0 && !autoResponderRelated
}

func (a *App) sendNoUsersNotifiedByGroupInChannel(c request.CTX, sender *model.User, post *model.Post, channel *model.Channel, group *model.Group) {
	T := i18n.GetUserTranslations(sender.Locale)
	ephemeralPost := &model.Post{
		UserId:    sender.Id,
		RootId:    post.RootId,
		ChannelId: channel.Id,
		Message:   T("api.post.check_for_out_of_channel_group_users.message.none", model.StringInterface{"GroupName": group.Name}),
	}
	a.SendEphemeralPost(c, post.UserId, ephemeralPost)
}

// sendOutOfChannelMentions sends an ephemeral post to the sender of a post if any of the given potential mentions
// are outside of the post's channel. Returns whether or not an ephemeral post was sent.
func (a *App) sendOutOfChannelMentions(c request.CTX, sender *model.User, post *model.Post, channel *model.Channel, potentialMentions []string) (bool, error) {
	outOfTeamUsers, outOfChannelUsers, outOfGroupsUsers, err := a.filterOutOfChannelMentions(c, sender, post, channel, potentialMentions)
	if err != nil {
		return false, err
	}

	if len(outOfTeamUsers) == 0 && len(outOfChannelUsers) == 0 && len(outOfGroupsUsers) == 0 {
		return false, nil
	}

	if len(outOfChannelUsers) != 0 || len(outOfGroupsUsers) != 0 {
		a.SendEphemeralPost(c, post.UserId, makeOutOfChannelMentionPost(sender, post, outOfChannelUsers, outOfGroupsUsers))
	}
	if len(outOfTeamUsers) != 0 {
		a.SendEphemeralPost(c, post.UserId, makeOutOfTeamMentionPost(sender, post, outOfTeamUsers))
	}
	return true, nil
}

func (a *App) FilterUsersByVisible(c request.CTX, viewer *model.User, otherUsers []*model.User) ([]*model.User, *model.AppError) {
	result := []*model.User{}
	for _, user := range otherUsers {
		canSee, err := a.UserCanSeeOtherUser(c, viewer.Id, user.Id)
		if err != nil {
			return nil, err
		}
		if canSee {
			result = append(result, user)
		}
	}
	return result, nil
}

func (a *App) filterOutOfChannelMentions(c request.CTX, sender *model.User, post *model.Post, channel *model.Channel, potentialMentions []string) ([]*model.User, []*model.User, []*model.User, error) {
	if post.IsSystemMessage() {
		return nil, nil, nil, nil
	}

	if channel.TeamId == "" || channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return nil, nil, nil, nil
	}

	if len(potentialMentions) == 0 {
		return nil, nil, nil, nil
	}

	mentionedUsersInTheTeam, err := a.Srv().Store().User().GetProfilesByUsernames(potentialMentions, &model.ViewUsersRestrictions{Teams: []string{channel.TeamId}})
	if err != nil {
		return nil, nil, nil, err
	}

	// Filter out inactive users and bots
	teamUsers := model.UserSlice(mentionedUsersInTheTeam).FilterByActive(true)
	teamUsers = teamUsers.FilterWithoutBots()
	teamUsers, appErr := a.FilterUsersByVisible(c, sender, teamUsers)
	if appErr != nil {
		return nil, nil, nil, appErr
	}

	allMentionedUsers, err := a.Srv().Store().User().GetProfilesByUsernames(potentialMentions, nil)
	if err != nil {
		return nil, nil, nil, err
	}

	outOfTeamUsers := model.UserSlice(allMentionedUsers).FilterWithoutID(teamUsers.IDs())
	outOfTeamUsers = outOfTeamUsers.FilterByActive(true)
	outOfTeamUsers = outOfTeamUsers.FilterWithoutBots()
	outOfTeamUsers, appErr = a.FilterUsersByVisible(c, sender, outOfTeamUsers)
	if appErr != nil {
		return nil, nil, nil, appErr
	}

	if len(teamUsers) == 0 {
		return outOfTeamUsers, nil, nil, nil
	}

	// Differentiate between mentionedUsersInTheTeam who can and can't be added to the channel
	var outOfChannelUsers model.UserSlice
	var outOfGroupsUsers model.UserSlice
	if channel.IsGroupConstrained() {
		nonMemberIDs, err := a.FilterNonGroupChannelMembers(teamUsers.IDs(), channel)
		if err != nil {
			return nil, nil, nil, err
		}

		outOfChannelUsers = teamUsers.FilterWithoutID(nonMemberIDs)
		outOfGroupsUsers = teamUsers.FilterByID(nonMemberIDs)
	} else {
		outOfChannelUsers = teamUsers
	}

	return outOfTeamUsers, outOfChannelUsers, outOfGroupsUsers, nil
}

func makeOutOfChannelMentionPost(sender *model.User, post *model.Post, outOfChannelUsers, outOfGroupsUsers []*model.User) *model.Post {
	allUsers := model.UserSlice(append(outOfChannelUsers, outOfGroupsUsers...))

	ocUsers := model.UserSlice(outOfChannelUsers)
	ocUsernames := ocUsers.Usernames()
	ocUserIDs := ocUsers.IDs()

	ogUsers := model.UserSlice(outOfGroupsUsers)
	ogUsernames := ogUsers.Usernames()

	T := i18n.GetUserTranslations(sender.Locale)

	ephemeralPostId := model.NewId()
	var message string
	if len(outOfChannelUsers) == 1 {
		message = T("api.post.check_for_out_of_channel_mentions.message.one", map[string]any{
			"Username": ocUsernames[0],
		})
	} else if len(outOfChannelUsers) > 1 {
		preliminary, final := splitAtFinal(ocUsernames)

		message = T("api.post.check_for_out_of_channel_mentions.message.multiple", map[string]any{
			"Usernames":    strings.Join(preliminary, ", @"),
			"LastUsername": final,
		})
	}

	if len(outOfGroupsUsers) == 1 {
		if message != "" {
			message += "\n"
		}

		message += T("api.post.check_for_out_of_channel_groups_mentions.message.one", map[string]any{
			"Username": ogUsernames[0],
		})
	} else if len(outOfGroupsUsers) > 1 {
		preliminary, final := splitAtFinal(ogUsernames)

		if message != "" {
			message += "\n"
		}

		message += T("api.post.check_for_out_of_channel_groups_mentions.message.multiple", map[string]any{
			"Usernames":    strings.Join(preliminary, ", @"),
			"LastUsername": final,
		})
	}

	props := model.StringInterface{
		model.PropsAddChannelMember: model.StringInterface{
			"post_id": ephemeralPostId,

			"usernames":                allUsers.Usernames(), // Kept for backwards compatibility of mobile app.
			"not_in_channel_usernames": ocUsernames,

			"user_ids":                allUsers.IDs(), // Kept for backwards compatibility of mobile app.
			"not_in_channel_user_ids": ocUserIDs,

			"not_in_groups_usernames": ogUsernames,
			"not_in_groups_user_ids":  ogUsers.IDs(),
		},
	}

	return &model.Post{
		Id:        ephemeralPostId,
		RootId:    post.RootId,
		ChannelId: post.ChannelId,
		Message:   message,
		CreateAt:  post.CreateAt + 1,
		Props:     props,
	}
}

func makeOutOfTeamMentionPost(sender *model.User, post *model.Post, outOfTeamUsers []*model.User) *model.Post {
	otUsers := model.UserSlice(outOfTeamUsers)
	otUsernames := otUsers.Usernames()

	T := i18n.GetUserTranslations(sender.Locale)

	ephemeralPostId := model.NewId()
	var message string

	if len(outOfTeamUsers) == 1 {
		message += T("api.post.check_for_out_of_team_mentions.message.one", map[string]any{
			"Username": otUsernames[0],
		})
	} else if len(outOfTeamUsers) > 1 {
		preliminary, final := splitAtFinal(otUsernames)

		message += T("api.post.check_for_out_of_team_mentions.message.multiple", map[string]any{
			"Usernames":    strings.Join(preliminary, ", @"),
			"LastUsername": final,
		})
	}

	return &model.Post{
		Id:        ephemeralPostId,
		RootId:    post.RootId,
		ChannelId: post.ChannelId,
		Message:   message,
		CreateAt:  post.CreateAt + 1,
	}
}

func splitAtFinal(items []string) (preliminary []string, final string) {
	if len(items) == 0 {
		return
	}
	preliminary = items[:len(items)-1]
	final = items[len(items)-1]
	return
}

// Given a message and a map mapping mention keywords to the users who use them, returns a map of mentioned
// users and a slice of potential mention users not in the channel and whether or not @here was mentioned.
func getExplicitMentions(post *model.Post, keywords MentionKeywords) *MentionResults {
	parser := makeStandardMentionParser(keywords)

	buf := ""
	mentionsEnabledFields := getMentionsEnabledFields(post)
	for _, message := range mentionsEnabledFields {
		// Parse the text as Markdown, combining adjacent Text nodes into a single string for processing
		markdown.Inspect(message, func(node any) bool {
			text, ok := node.(*markdown.Text)
			if !ok {
				// This node isn't a string so process any accumulated text in the buffer
				if buf != "" {
					parser.ProcessText(buf)
				}

				buf = ""
				return true
			}

			// This node is a string, so add it to buf and continue onto the next node to see if it's more text
			buf += text.Text
			return false
		})
	}

	// Process any left over text
	if buf != "" {
		parser.ProcessText(buf)
	}

	return parser.Results()
}

// Given a post returns the values of the fields in which mentions are possible.
// post.message, preText and text in the attachment are enabled.
func getMentionsEnabledFields(post *model.Post) model.StringArray {
	ret := []string{}

	ret = append(ret, post.Message)
	for _, attachment := range post.Attachments() {
		if attachment.Pretext != "" {
			ret = append(ret, attachment.Pretext)
		}
		if attachment.Text != "" {
			ret = append(ret, attachment.Text)
		}

		for _, field := range attachment.Fields {
			if valueString, ok := field.Value.(string); ok && valueString != "" {
				ret = append(ret, valueString)
			}
		}
	}
	return ret
}

// allowChannelMentions returns whether or not the channel mentions are allowed for the given post.
func (a *App) allowChannelMentions(c request.CTX, post *model.Post, numProfiles int) bool {
	if !a.HasPermissionToChannel(c, post.UserId, post.ChannelId, model.PermissionUseChannelMentions) {
		return false
	}

	if post.Type == model.PostTypeHeaderChange || post.Type == model.PostTypePurposeChange {
		return false
	}

	if int64(numProfiles) >= *a.Config().TeamSettings.MaxNotificationsPerChannel {
		return false
	}

	return true
}

// allowGroupMentions returns whether or not the group mentions are allowed for the given post.
func (a *App) allowGroupMentions(c request.CTX, post *model.Post) bool {
	if license := a.Srv().License(); license == nil || (license.SkuShortName != model.LicenseShortSkuProfessional && license.SkuShortName != model.LicenseShortSkuEnterprise) {
		return false
	}

	if !a.HasPermissionToChannel(c, post.UserId, post.ChannelId, model.PermissionUseGroupMentions) {
		return false
	}

	if post.Type == model.PostTypeHeaderChange || post.Type == model.PostTypePurposeChange {
		return false
	}

	return true
}

// getGroupsAllowedForReferenceInChannel returns a map of groups allowed for reference in a given channel and team.
func (a *App) getGroupsAllowedForReferenceInChannel(channel *model.Channel, team *model.Team) (map[string]*model.Group, error) {
	var err error
	groupsMap := make(map[string]*model.Group)
	opts := model.GroupSearchOpts{FilterAllowReference: true, IncludeMemberCount: true}

	if channel.IsGroupConstrained() || (team != nil && team.IsGroupConstrained()) {
		var groups []*model.GroupWithSchemeAdmin
		if channel.IsGroupConstrained() {
			groups, err = a.Srv().Store().Group().GetGroupsByChannel(channel.Id, opts)
		} else {
			groups, err = a.Srv().Store().Group().GetGroupsByTeam(team.Id, opts)
		}
		if err != nil {
			return nil, errors.Wrap(err, "unable to get groups")
		}
		for _, group := range groups {
			if group.Group.Name != nil {
				groupsMap[group.Id] = &group.Group
			}
		}

		opts.Source = model.GroupSourceCustom
		var customgroups []*model.Group
		customgroups, err = a.Srv().Store().Group().GetGroups(0, 0, opts, nil)
		if err != nil {
			return nil, errors.Wrap(err, "unable to get custom groups")
		}
		for _, group := range customgroups {
			if group.Name != nil {
				groupsMap[group.Id] = group
			}
		}
		return groupsMap, nil
	}

	groups, err := a.Srv().Store().Group().GetGroups(0, 0, opts, nil)
	if err != nil {
		return nil, errors.Wrap(err, "unable to get groups")
	}
	for _, group := range groups {
		if group.Name != nil {
			groupsMap[group.Id] = group
		}
	}

	return groupsMap, nil
}

// Given a map of user IDs to profiles, returns a list of mention
// keywords for all users in the channel.
func (a *App) getMentionKeywordsInChannel(profiles map[string]*model.User, allowChannelMentions bool, channelMemberNotifyPropsMap map[string]model.StringMap, groups map[string]*model.Group) MentionKeywords {
	keywords := make(MentionKeywords)

	for _, profile := range profiles {
		keywords.AddUser(
			profile,
			channelMemberNotifyPropsMap[profile.Id],
			a.GetStatusFromCache(profile.Id),
			allowChannelMentions,
		)
	}

	keywords.AddGroupsMap(groups)

	return keywords
}

// insertGroupMentions adds group members in the channel to Mentions, adds group members not in the channel to OtherPotentialMentions
// returns false if no group members present in the team that the channel belongs to
func (a *App) insertGroupMentions(senderID string, group *model.Group, channel *model.Channel, profileMap map[string]*model.User, mentions *MentionResults) (bool, *model.AppError) {
	var err error
	var groupMembers []*model.User
	outOfChannelGroupMembers := []*model.User{}
	isGroupOrDirect := channel.IsGroupOrDirect()

	if isGroupOrDirect {
		groupMembers, err = a.Srv().Store().Group().GetMemberUsers(group.Id)
	} else {
		groupMembers, err = a.Srv().Store().Group().GetMemberUsersInTeam(group.Id, channel.TeamId)
	}

	if err != nil {
		return false, model.NewAppError("insertGroupMentions", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if mentions.Mentions == nil {
		mentions.Mentions = make(map[string]MentionType)
	}

	for _, member := range groupMembers {
		if member.Id != senderID {
			if _, ok := profileMap[member.Id]; ok {
				mentions.Mentions[member.Id] = GroupMention
			} else {
				outOfChannelGroupMembers = append(outOfChannelGroupMembers, member)
			}
		}
	}

	potentialGroupMembersMentioned := []string{}
	for _, user := range outOfChannelGroupMembers {
		potentialGroupMembersMentioned = append(potentialGroupMembersMentioned, user.Username)
	}
	if len(potentialGroupMembersMentioned) != 0 {
		a.Srv().telemetryService.SendTelemetryForFeature(
			telemetry.TrackGroupsFeature,
			"invite_group_to_channel__post",
			map[string]any{telemetry.TrackPropertyUser: senderID, telemetry.TrackPropertyGroup: group.Id},
		)
	}
	if mentions.OtherPotentialMentions == nil {
		mentions.OtherPotentialMentions = potentialGroupMembersMentioned
	} else {
		mentions.OtherPotentialMentions = append(mentions.OtherPotentialMentions, potentialGroupMembersMentioned...)
	}

	return isGroupOrDirect || len(groupMembers) > 0, nil
}

// Represents either an email or push notification and contains the fields required to send it to any user.
type PostNotification struct {
	Channel    *model.Channel
	Post       *model.Post
	ProfileMap map[string]*model.User
	Sender     *model.User
}

// Returns the name of the channel for this notification. For direct messages, this is the sender's name
// preceded by an at sign. For group messages, this is a comma-separated list of the members of the
// channel, with an option to exclude the recipient of the message from that list.
func (n *PostNotification) GetChannelName(userNameFormat, excludeId string) string {
	switch n.Channel.Type {
	case model.ChannelTypeDirect:
		return n.Sender.GetDisplayNameWithPrefix(userNameFormat, "@")
	case model.ChannelTypeGroup:
		names := []string{}
		for _, user := range n.ProfileMap {
			if user.Id != excludeId {
				names = append(names, user.GetDisplayName(userNameFormat))
			}
		}

		sort.Strings(names)

		return strings.Join(names, ", ")
	default:
		return n.Channel.DisplayName
	}
}

// Returns the name of the sender of this notification, accounting for things like system messages
// and whether or not the username has been overridden by an integration.
func (n *PostNotification) GetSenderName(userNameFormat string, overridesAllowed bool) string {
	if n.Post.IsSystemMessage() {
		return i18n.T("system.message.name")
	}

	if overridesAllowed && n.Channel.Type != model.ChannelTypeDirect {
		if value := n.Post.GetProps()["override_username"]; value != nil && n.Post.GetProp("from_webhook") == "true" {
			if s, ok := value.(string); ok {
				return s
			}
		}
	}

	return n.Sender.GetDisplayNameWithPrefix(userNameFormat, "@")
}

func (a *App) GetNotificationNameFormat(user *model.User) string {
	if !*a.Config().PrivacySettings.ShowFullName {
		return model.ShowUsername
	}

	data, err := a.Srv().Store().Preference().Get(user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameNameFormat)
	if err != nil {
		return *a.Config().TeamSettings.TeammateNameDisplay
	}

	return data.Value
}

type CRTNotifiers struct {
	// Desktop contains the user IDs of thread followers to receive desktop notification
	Desktop model.StringArray

	// Email contains the user IDs of thread followers to receive email notification
	Email model.StringArray

	// Push contains the user IDs of thread followers to receive push notification
	Push model.StringArray
}

func (c *CRTNotifiers) addFollowerToNotify(user *model.User, mentions *MentionResults, channelMemberNotificationProps model.StringMap, channel *model.Channel) {
	_, userWasMentioned := mentions.Mentions[user.Id]
	notifyDesktop, notifyPush, notifyEmail := shouldUserNotifyCRT(user, userWasMentioned)
	notifyChannelDesktop, notifyChannelPush := shouldChannelMemberNotifyCRT(user.NotifyProps, channelMemberNotificationProps, userWasMentioned)

	// respect the user global notify props when there are no channel specific ones (default)
	// otherwise respect the channel member's notify props
	if (channelMemberNotificationProps[model.DesktopNotifyProp] == model.ChannelNotifyDefault && notifyDesktop) || notifyChannelDesktop {
		c.Desktop = append(c.Desktop, user.Id)
	}

	if notifyEmail {
		c.Email = append(c.Email, user.Id)
	}

	// respect the user global notify props when there are no channel specific ones (default)
	// otherwise respect the channel member's notify props
	if (channelMemberNotificationProps[model.PushNotifyProp] == model.ChannelNotifyDefault && notifyPush) || notifyChannelPush {
		c.Push = append(c.Push, user.Id)
	}
}

// user global settings check for desktop, email, and push notifications
func shouldUserNotifyCRT(user *model.User, isMentioned bool) (notifyDesktop, notifyPush, notifyEmail bool) {
	notifyDesktop = false
	notifyPush = false
	notifyEmail = false

	desktop := user.NotifyProps[model.DesktopNotifyProp]
	push := user.NotifyProps[model.PushNotifyProp]
	shouldEmail := user.NotifyProps[model.EmailNotifyProp] == "true"

	desktopThreads := user.NotifyProps[model.DesktopThreadsNotifyProp]
	emailThreads := user.NotifyProps[model.EmailThreadsNotifyProp]
	pushThreads := user.NotifyProps[model.PushThreadsNotifyProp]

	// user should be notified via desktop notification in the case the notify prop is not set as no notify
	// and either the user was mentioned or the CRT notify prop for desktop is set to all
	if desktop != model.UserNotifyNone && (isMentioned || desktopThreads == model.UserNotifyAll || desktop == model.UserNotifyAll) {
		notifyDesktop = true
	}

	// user should be notified via email when emailing is enabled and
	// either the user was mentioned, or the CRT notify prop for email is set to all
	if shouldEmail && (isMentioned || emailThreads == model.UserNotifyAll) {
		notifyEmail = true
	}

	// user should be notified via push in the case the notify prop is not set as no notify
	// and either the user was mentioned or the CRT push notify prop is set to all
	if push != model.UserNotifyNone && (isMentioned || pushThreads == model.UserNotifyAll || push == model.UserNotifyAll) {
		notifyPush = true
	}

	return
}

// channel specific settings check for desktop and push notifications
func shouldChannelMemberNotifyCRT(userNotifyProps model.StringMap, channelMemberNotifyProps model.StringMap, isMentioned bool) (notifyDesktop, notifyPush bool) {
	notifyDesktop = false
	notifyPush = false

	desktop := channelMemberNotifyProps[model.DesktopNotifyProp]
	push := channelMemberNotifyProps[model.PushNotifyProp]

	desktopThreads := channelMemberNotifyProps[model.DesktopThreadsNotifyProp]
	userDesktopThreads := userNotifyProps[model.DesktopThreadsNotifyProp]
	pushThreads := channelMemberNotifyProps[model.PushThreadsNotifyProp]

	// user should be notified via desktop notification in the case the notify prop is not set as no notify or default
	// and either the user was mentioned or the CRT notify prop for desktop is set to all
	if desktop != model.ChannelNotifyDefault && desktop != model.ChannelNotifyNone && (isMentioned || (desktopThreads == model.ChannelNotifyAll && userDesktopThreads != model.UserNotifyMention) || desktop == model.ChannelNotifyAll) {
		notifyDesktop = true
	}

	// user should be notified via push in the case the notify prop is not set as no notify or default
	// and either the user was mentioned or the CRT push notify prop is set to all
	if push != model.ChannelNotifyDefault && push != model.ChannelNotifyNone && (isMentioned || pushThreads == model.ChannelNotifyAll || push == model.ChannelNotifyAll) {
		notifyPush = true
	}

	return
}

func shouldAckWebsocketNotification(channelType model.ChannelType, userNotificationLevel, channelNotificationLevel string) bool {
	if channelNotificationLevel == model.ChannelNotifyAll {
		// Should ACK on if we notify for all messages in the channel
		return true
	} else if channelNotificationLevel == model.ChannelNotifyDefault && userNotificationLevel == model.UserNotifyAll {
		// Should ACK on if we notify for all messages and the channel settings are unchanged
		return true
	} else if channelType == model.ChannelTypeGroup &&
		((channelNotificationLevel == model.ChannelNotifyDefault && userNotificationLevel == model.UserNotifyMention) ||
			channelNotificationLevel == model.ChannelNotifyMention) {
		// Should ACK for group channels where default settings are in place (should be notified)
		return true
	}

	return false
}

func (a *App) CountNotification(notificationType model.NotificationType, platform string) {
	if a.notificationMetricsDisabled() {
		return
	}

	a.Metrics().IncrementNotificationCounter(notificationType, platform)
}

func (a *App) CountNotificationAck(notificationType model.NotificationType, platform string) {
	if a.notificationMetricsDisabled() {
		return
	}

	a.Metrics().IncrementNotificationAckCounter(notificationType, platform)
}

func (a *App) CountNotificationReason(
	notificationStatus model.NotificationStatus,
	notificationType model.NotificationType,
	notificationReason model.NotificationReason,
	platform string,
) {
	if a.notificationMetricsDisabled() {
		return
	}

	switch notificationStatus {
	case model.NotificationStatusSuccess:
		a.Metrics().IncrementNotificationSuccessCounter(notificationType, platform)
	case model.NotificationStatusError:
		a.Metrics().IncrementNotificationErrorCounter(notificationType, notificationReason, platform)
	case model.NotificationStatusNotSent:
		a.Metrics().IncrementNotificationNotSentCounter(notificationType, notificationReason, platform)
	case model.NotificationStatusUnsupported:
		a.Metrics().IncrementNotificationUnsupportedCounter(notificationType, notificationReason, platform)
	}
}

func (a *App) notificationMetricsDisabled() bool {
	if a.Metrics() == nil {
		return true
	}

	if a.Config().FeatureFlags.NotificationMonitoring && *a.Config().MetricsSettings.EnableNotificationMetrics {
		return false
	}

	return true
}
