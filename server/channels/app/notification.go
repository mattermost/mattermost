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
	"unicode"
	"unicode/utf8"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/i18n"
	"github.com/mattermost/mattermost-server/server/public/shared/markdown"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
)

func (a *App) canSendPushNotifications() bool {
	if !*a.Config().EmailSettings.SendPushNotifications {
		return false
	}

	pushServer := *a.Config().EmailSettings.PushNotificationServer
	if license := a.Srv().License(); pushServer == model.MHPNS && (license == nil || !*license.Features.MHPNS) {
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

	pchan := make(chan store.StoreResult, 1)
	go func() {
		props, err := a.Srv().Store().User().GetAllProfilesInChannel(context.Background(), channel.Id, true)
		pchan <- store.StoreResult{Data: props, NErr: err}
		close(pchan)
	}()

	cmnchan := make(chan store.StoreResult, 1)
	go func() {
		props, err := a.Srv().Store().Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
		cmnchan <- store.StoreResult{Data: props, NErr: err}
		close(cmnchan)
	}()

	var gchan chan store.StoreResult
	if a.allowGroupMentions(c, post) {
		gchan = make(chan store.StoreResult, 1)
		go func() {
			groupsMap, err := a.getGroupsAllowedForReferenceInChannel(channel, team)
			gchan <- store.StoreResult{Data: groupsMap, NErr: err}
			close(gchan)
		}()
	}

	var fchan chan store.StoreResult
	if len(post.FileIds) != 0 {
		fchan = make(chan store.StoreResult, 1)
		go func() {
			fileInfos, err := a.Srv().Store().FileInfo().GetForPost(post.Id, true, false, true)
			fchan <- store.StoreResult{Data: fileInfos, NErr: err}
			close(fchan)
		}()
	}

	var tchan chan store.StoreResult
	if isCRTAllowed && post.RootId != "" {
		tchan = make(chan store.StoreResult, 1)
		go func() {
			followers, err := a.Srv().Store().Thread().GetThreadFollowers(post.RootId, true)
			tchan <- store.StoreResult{Data: followers, NErr: err}
			close(tchan)
		}()
	}

	result := <-pchan
	if result.NErr != nil {
		return nil, result.NErr
	}
	profileMap := result.Data.(map[string]*model.User)

	result = <-cmnchan
	if result.NErr != nil {
		return nil, result.NErr
	}
	channelMemberNotifyPropsMap := result.Data.(map[string]model.StringMap)

	followers := make(model.StringSet, 0)
	if tchan != nil {
		result = <-tchan
		if result.NErr != nil {
			return nil, result.NErr
		}
		for _, v := range result.Data.([]string) {
			followers.Add(v)
		}
	}

	groups := make(map[string]*model.Group)
	if gchan != nil {
		result = <-gchan
		if result.NErr != nil {
			return nil, result.NErr
		}
		groups = result.Data.(map[string]*model.Group)
	}

	mentions, keywords := a.getExplicitMentionsAndKeywords(c, post, channel, profileMap, groups, channelMemberNotifyPropsMap, parentPostList)

	var allActivityPushUserIds []string
	if channel.Type != model.ChannelTypeDirect {
		// Iterate through all groups that were mentioned and insert group members into the list of mentions or potential mentions
		for _, group := range mentions.GroupMentions {
			anyUsersMentionedByGroup, err := a.insertGroupMentions(group, channel, profileMap, mentions)
			if err != nil {
				return nil, err
			}

			if !anyUsersMentionedByGroup {
				a.sendNoUsersNotifiedByGroupInChannel(c, sender, post, channel, group)
			}
		}

		go func() {
			_, err := a.sendOutOfChannelMentions(c, sender, post, channel, mentions.OtherPotentialMentions)
			if err != nil {
				mlog.Error("Failed to send warning for out of channel mentions", mlog.String("user_id", sender.Id), mlog.String("post_id", post.Id), mlog.Err(err))
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
		var rootMentions *ExplicitMentions
		if parentPostList != nil {
			rootPost := parentPostList.Posts[parentPostList.Order[0]]
			if rootPost.GetProp("from_webhook") != "true" {
				threadParticipants[rootPost.UserId] = true
			}
			if channel.Type != model.ChannelTypeDirect {
				rootMentions = getExplicitMentions(rootPost, keywords, groups)
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
		mlog.Warn(
			"Failed to update mention count",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
			mlog.Err(nErr),
		)
	}

	// Log the problems that might have occurred while auto following the thread
	for _, mac := range mentionAutofollowChans {
		if err := <-mac; err != nil {
			mlog.Warn(
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
		emailRecipients := append(mentionedUsersList, notificationsForCRT.Email...)
		emailRecipients = model.RemoveDuplicateStrings(emailRecipients)

		for _, id := range emailRecipients {
			if profileMap[id] == nil {
				continue
			}

			//If email verification is required and user email is not verified don't send email.
			if *a.Config().EmailSettings.RequireEmailVerification && !profileMap[id].EmailVerified {
				mlog.Debug("Skipped sending notification email, address not verified.", mlog.String("user_email", profileMap[id].Email), mlog.String("user_id", id))
				continue
			}

			if a.userAllowsEmail(c, profileMap[id], channelMemberNotifyPropsMap[id], post) {
				senderProfileImage, _, err := a.GetProfileImage(sender)
				if err != nil {
					a.Log().Warn("Unable to get the sender user profile image.", mlog.String("user_id", sender.Id), mlog.Err(err))
				}
				if err := a.sendNotificationEmail(c, notification, profileMap[id], team, senderProfileImage); err != nil {
					mlog.Warn("Unable to send notification email.", mlog.Err(err))
				}
			}
		}
	}

	// Check for channel-wide mentions in channels that have too many members for those to work
	if int64(len(profileMap)) > *a.Config().TeamSettings.MaxNotificationsPerChannel {
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
		for _, id := range mentionedUsersList {
			if profileMap[id] == nil || notificationsForCRT.Push.Contains(id) {
				continue
			}

			var status *model.Status
			var err *model.AppError
			if status, err = a.GetStatus(id); err != nil {
				status = &model.Status{UserId: id, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
			}

			if ShouldSendPushNotification(profileMap[id], channelMemberNotifyPropsMap[id], true, status, post) {
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
			} else {
				// register that a notification was not sent
				a.NotificationsLog().Debug("Notification not sent",
					mlog.String("ackId", ""),
					mlog.String("type", model.PushTypeMessage),
					mlog.String("userId", id),
					mlog.String("postId", post.Id),
					mlog.String("status", model.PushNotSent),
				)
			}
		}

		for _, id := range allActivityPushUserIds {
			if profileMap[id] == nil || notificationsForCRT.Push.Contains(id) {
				continue
			}

			if _, ok := mentions.Mentions[id]; !ok {
				var status *model.Status
				var err *model.AppError
				if status, err = a.GetStatus(id); err != nil {
					status = &model.Status{UserId: id, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
				}

				if ShouldSendPushNotification(profileMap[id], channelMemberNotifyPropsMap[id], false, status, post) {
					a.sendPushNotification(
						notification,
						profileMap[id],
						false,
						false,
						"",
					)
				} else {
					// register that a notification was not sent
					a.NotificationsLog().Debug("Notification not sent",
						mlog.String("ackId", ""),
						mlog.String("type", model.PushTypeMessage),
						mlog.String("userId", id),
						mlog.String("postId", post.Id),
						mlog.String("status", model.PushNotSent),
					)
				}
			}
		}

		for _, id := range notificationsForCRT.Push {
			if profileMap[id] == nil {
				continue
			}

			var status *model.Status
			var err *model.AppError
			if status, err = a.GetStatus(id); err != nil {
				status = &model.Status{UserId: id, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
			}

			if DoesStatusAllowPushNotification(profileMap[id].NotifyProps, status, post.ChannelId) {
				a.sendPushNotification(
					notification,
					profileMap[id],
					false,
					false,
					model.CommentsNotifyCRT,
				)
			} else {
				// register that a notification was not sent
				a.NotificationsLog().Debug("Notification not sent",
					mlog.String("ackId", ""),
					mlog.String("type", model.PushTypeMessage),
					mlog.String("userId", id),
					mlog.String("postId", post.Id),
					mlog.String("status", model.PushNotSent),
				)
			}
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", post.ChannelId, "", nil, "")

	// Note that PreparePostForClient should've already been called by this point
	postJSON, jsonErr := post.ToJSON()
	if jsonErr != nil {
		return nil, errors.Wrapf(jsonErr, "failed to encode post to JSON")
	}
	message.Add("post", postJSON)

	message.Add("channel_type", channel.Type)
	message.Add("channel_display_name", notification.GetChannelName(model.ShowUsername, ""))
	message.Add("channel_name", channel.Name)
	message.Add("sender_name", notification.GetSenderName(model.ShowUsername, *a.Config().ServiceSettings.EnablePostUsernameOverride))
	message.Add("team_id", team.Id)
	message.Add("set_online", setOnline)

	if len(post.FileIds) != 0 && fchan != nil {
		message.Add("otherFile", "true")

		var infos []*model.FileInfo
		if result := <-fchan; result.NErr != nil {
			mlog.Warn("Unable to get fileInfo for push notifications.", mlog.String("post_id", post.Id), mlog.Err(result.NErr))
		} else {
			infos = result.Data.([]*model.FileInfo)
		}

		for _, info := range infos {
			if info.IsImage() {
				message.Add("image", "true")
				break
			}
		}
	}

	if len(mentionedUsersList) != 0 {
		message.Add("mentions", model.ArrayToJSON(mentionedUsersList))
	}

	if len(notificationsForCRT.Desktop) != 0 {
		message.Add("followers", model.ArrayToJSON(notificationsForCRT.Desktop))
	}

	published, err := a.publishWebsocketEventForPermalinkPost(c, post, message)
	if err != nil {
		return nil, err
	}
	if !published {
		a.Publish(message)
	}

	// If this is a reply in a thread, notify participants
	if isCRTAllowed && post.RootId != "" {
		for uid := range followers {
			// A user following a thread but had left the channel won't get a notification
			// https://mattermost.atlassian.net/browse/MM-36769
			if profileMap[uid] == nil {
				continue
			}
			if a.IsCRTEnabledForUser(c, uid) {
				message := model.NewWebSocketEvent(model.WebsocketEventThreadUpdated, team.Id, "", uid, nil, "")
				threadMembership := participantMemberships[uid]
				if threadMembership == nil {
					tm, err := a.Srv().Store().Thread().GetMembershipForUser(uid, post.RootId)
					if err != nil {
						return nil, errors.Wrapf(err, "Missing thread membership for participant in notifications. user_id=%q thread_id=%q", uid, post.RootId)
					}
					if tm == nil {
						continue
					}
					threadMembership = tm
				}
				userThread, err := a.Srv().Store().Thread().GetThreadForUser(threadMembership, true, a.IsPostPriorityEnabled())
				if err != nil {
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
							return nil, errors.Wrapf(err, "cannot maintain thread membership %q for user %q", post.RootId, uid)
						}
						userThread.UnreadMentions = 0
						userThread.UnreadReplies = 0
					}
					a.sanitizeProfiles(userThread.Participants, false)
					userThread.Post.SanitizeProps()

					sanitizedPost, err := a.SanitizePostMetadataForUser(c, userThread.Post, uid)
					if err != nil {
						return nil, err
					}
					userThread.Post = sanitizedPost

					payload, jsonErr := json.Marshal(userThread)
					if jsonErr != nil {
						mlog.Warn("Failed to encode thread to JSON")
					}
					message.Add("thread", string(payload))
					message.Add("previous_unread_mentions", previousUnreadMentions)
					message.Add("previous_unread_replies", previousUnreadReplies)

					a.Publish(message)
				}
			}
		}
	}
	return mentionedUsersList, nil
}

func (a *App) RemoveNotifications(c request.CTX, post *model.Post, channel *model.Channel, team *model.Team) error {
	isCRTAllowed := *a.Config().ServiceSettings.CollapsedThreads != model.CollapsedThreadsDisabled

	// CRT is the main issue in this case as notifications indicator are not updated when accessing threads from the sidebar.
	if isCRTAllowed && post.RootId != "" {
		pCh := make(chan store.StoreResult, 1)
		go func() {
			props, err := a.Srv().Store().User().GetAllProfilesInChannel(context.Background(), channel.Id, true)
			pCh <- store.StoreResult{Data: props, NErr: err}
			close(pCh)
		}()

		cmnCh := make(chan store.StoreResult, 1)
		go func() {
			props, err := a.Srv().Store().Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
			cmnCh <- store.StoreResult{Data: props, NErr: err}
			close(cmnCh)
		}()

		var gCh chan store.StoreResult
		if a.allowGroupMentions(c, post) {
			gCh = make(chan store.StoreResult, 1)
			go func() {
				groupsMap, err := a.getGroupsAllowedForReferenceInChannel(channel, team)
				gCh <- store.StoreResult{Data: groupsMap, NErr: err}
				close(gCh)
			}()
		}

		result := <-pCh
		if result.NErr != nil {
			return result.NErr
		}
		profileMap := result.Data.(map[string]*model.User)

		result = <-cmnCh
		if result.NErr != nil {
			return result.NErr
		}
		channelMemberNotifyPropsMap := result.Data.(map[string]model.StringMap)

		groups := make(map[string]*model.Group)
		if gCh != nil {
			result = <-gCh
			if result.NErr != nil {
				return result.NErr
			}
			groups = result.Data.(map[string]*model.Group)
		}

		mentions, _ := a.getExplicitMentionsAndKeywords(c, post, channel, profileMap, groups, channelMemberNotifyPropsMap, nil)

		for userID := range mentions.Mentions {
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
					mlog.Warn("Failed to encode thread to JSON")
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

func (a *App) getExplicitMentionsAndKeywords(c request.CTX, post *model.Post, channel *model.Channel, profileMap map[string]*model.User, groups map[string]*model.Group, channelMemberNotifyPropsMap map[string]model.StringMap, parentPostList *model.PostList) (*ExplicitMentions, map[string][]string) {
	mentions := &ExplicitMentions{}
	var allowChannelMentions bool
	var keywords map[string][]string

	if channel.Type == model.ChannelTypeDirect {
		otherUserId := channel.GetOtherUserIdForDM(post.UserId)

		_, ok := profileMap[otherUserId]
		if ok {
			mentions.addMention(otherUserId, DMMention)
		}

		if post.GetProp("from_webhook") == "true" {
			mentions.addMention(post.UserId, DMMention)
		}
	} else {
		allowChannelMentions = a.allowChannelMentions(c, post, len(profileMap))
		keywords = a.getMentionKeywordsInChannel(profileMap, allowChannelMentions, channelMemberNotifyPropsMap)

		mentions = getExplicitMentions(post, keywords, groups)
		// Add an implicit mention when a user is added to a channel
		// even if the user has set 'username mentions' to false in account settings.
		if post.Type == model.PostTypeAddToChannel {
			addedUserId, ok := post.GetProp(model.PostPropsAddedUserId).(string)
			if ok {
				mentions.addMention(addedUserId, KeywordMention)
			}
		}

		// Get users that have comment thread mentions enabled
		if post.RootId != "" && parentPostList != nil {
			for _, threadPost := range parentPostList.Posts {
				profile := profileMap[threadPost.UserId]
				if profile == nil {
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

func max(a, b int64) int64 {
	if a < b {
		return b
	}
	return a
}

func (a *App) userAllowsEmail(c request.CTX, user *model.User, channelMemberNotificationProps model.StringMap, post *model.Post) bool {
	// if user is a bot account, then we do not send email
	if user.IsBot {
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
			mlog.Debug("Channel muted for user", mlog.String("user_id", user.Id), mlog.String("channel_mute", channelMuted))
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
	outOfChannelUsers, outOfGroupsUsers, err := a.filterOutOfChannelMentions(sender, post, channel, potentialMentions)
	if err != nil {
		return false, err
	}

	if len(outOfChannelUsers) == 0 && len(outOfGroupsUsers) == 0 {
		return false, nil
	}

	a.SendEphemeralPost(c, post.UserId, makeOutOfChannelMentionPost(sender, post, outOfChannelUsers, outOfGroupsUsers))

	return true, nil
}

func (a *App) FilterUsersByVisible(viewer *model.User, otherUsers []*model.User) ([]*model.User, *model.AppError) {
	result := []*model.User{}
	for _, user := range otherUsers {
		canSee, err := a.UserCanSeeOtherUser(viewer.Id, user.Id)
		if err != nil {
			return nil, err
		}
		if canSee {
			result = append(result, user)
		}
	}
	return result, nil
}

func (a *App) filterOutOfChannelMentions(sender *model.User, post *model.Post, channel *model.Channel, potentialMentions []string) ([]*model.User, []*model.User, error) {
	if post.IsSystemMessage() {
		return nil, nil, nil
	}

	if channel.TeamId == "" || channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return nil, nil, nil
	}

	if len(potentialMentions) == 0 {
		return nil, nil, nil
	}

	users, err := a.Srv().Store().User().GetProfilesByUsernames(potentialMentions, &model.ViewUsersRestrictions{Teams: []string{channel.TeamId}})
	if err != nil {
		return nil, nil, err
	}

	// Filter out inactive users and bots
	allUsers := model.UserSlice(users).FilterByActive(true)
	allUsers = allUsers.FilterWithoutBots()
	allUsers, appErr := a.FilterUsersByVisible(sender, allUsers)
	if appErr != nil {
		return nil, nil, appErr
	}

	if len(allUsers) == 0 {
		return nil, nil, nil
	}

	// Differentiate between users who can and can't be added to the channel
	var outOfChannelUsers model.UserSlice
	var outOfGroupsUsers model.UserSlice
	if channel.IsGroupConstrained() {
		nonMemberIDs, err := a.FilterNonGroupChannelMembers(allUsers.IDs(), channel)
		if err != nil {
			return nil, nil, err
		}

		outOfChannelUsers = allUsers.FilterWithoutID(nonMemberIDs)
		outOfGroupsUsers = allUsers.FilterByID(nonMemberIDs)
	} else {
		outOfChannelUsers = allUsers
	}

	return outOfChannelUsers, outOfGroupsUsers, nil
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

func splitAtFinal(items []string) (preliminary []string, final string) {
	if len(items) == 0 {
		return
	}
	preliminary = items[:len(items)-1]
	final = items[len(items)-1]
	return
}

type ExplicitMentions struct {
	// Mentions contains the ID of each user that was mentioned and how they were mentioned.
	Mentions map[string]MentionType

	// Contains a map of groups that were mentioned
	GroupMentions map[string]*model.Group

	// OtherPotentialMentions contains a list of strings that looked like mentions, but didn't have
	// a corresponding keyword.
	OtherPotentialMentions []string

	// HereMentioned is true if the message contained @here.
	HereMentioned bool

	// AllMentioned is true if the message contained @all.
	AllMentioned bool

	// ChannelMentioned is true if the message contained @channel.
	ChannelMentioned bool
}

type MentionType int

const (
	// Different types of mentions ordered by their priority from lowest to highest

	// A placeholder that should never be used in practice
	NoMention MentionType = iota

	// The post is in a thread that the user has commented on
	ThreadMention

	// The post is a comment on a thread started by the user
	CommentMention

	// The post contains an at-channel, at-all, or at-here
	ChannelMention

	// The post is a DM
	DMMention

	// The post contains an at-mention for the user
	KeywordMention

	// The post contains a group mention for the user
	GroupMention
)

func (m *ExplicitMentions) isUserMentioned(userID string) bool {
	if _, ok := m.Mentions[userID]; ok {
		return true
	}

	if _, ok := m.GroupMentions[userID]; ok {
		return true
	}

	return m.HereMentioned || m.AllMentioned || m.ChannelMentioned
}

func (m *ExplicitMentions) addMention(userID string, mentionType MentionType) {
	if m.Mentions == nil {
		m.Mentions = make(map[string]MentionType)
	}

	if currentType, ok := m.Mentions[userID]; ok && currentType >= mentionType {
		return
	}

	m.Mentions[userID] = mentionType
}

func (m *ExplicitMentions) addGroupMention(word string, groups map[string]*model.Group) bool {
	if strings.HasPrefix(word, "@") {
		word = word[1:]
	} else {
		// Only allow group mentions when mentioned directly with @group-name
		return false
	}

	group, groupFound := groups[word]
	if !groupFound {
		group = groups[strings.ToLower(word)]
	}

	if group == nil {
		return false
	}

	if m.GroupMentions == nil {
		m.GroupMentions = make(map[string]*model.Group)
	}

	if group.Name != nil {
		m.GroupMentions[*group.Name] = group
	}

	return true
}

func (m *ExplicitMentions) addMentions(userIDs []string, mentionType MentionType) {
	for _, userID := range userIDs {
		m.addMention(userID, mentionType)
	}
}

func (m *ExplicitMentions) removeMention(userID string) {
	delete(m.Mentions, userID)
}

// Given a message and a map mapping mention keywords to the users who use them, returns a map of mentioned
// users and a slice of potential mention users not in the channel and whether or not @here was mentioned.
func getExplicitMentions(post *model.Post, keywords map[string][]string, groups map[string]*model.Group) *ExplicitMentions {
	ret := &ExplicitMentions{}

	buf := ""
	mentionsEnabledFields := getMentionsEnabledFields(post)
	for _, message := range mentionsEnabledFields {
		markdown.Inspect(message, func(node any) bool {
			text, ok := node.(*markdown.Text)
			if !ok {
				ret.processText(buf, keywords, groups)
				buf = ""
				return true
			}
			buf += text.Text
			return false
		})
	}
	ret.processText(buf, keywords, groups)

	return ret
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
				groupsMap[*group.Group.Name] = &group.Group
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
			groupsMap[*group.Name] = group
		}
	}

	return groupsMap, nil
}

// Given a map of user IDs to profiles, returns a list of mention
// keywords for all users in the channel.
func (a *App) getMentionKeywordsInChannel(profiles map[string]*model.User, allowChannelMentions bool, channelMemberNotifyPropsMap map[string]model.StringMap) map[string][]string {
	keywords := make(map[string][]string)

	for _, profile := range profiles {
		addMentionKeywordsForUser(
			keywords,
			profile,
			channelMemberNotifyPropsMap[profile.Id],
			a.GetStatusFromCache(profile.Id),
			allowChannelMentions,
		)
	}

	return keywords
}

// insertGroupMentions adds group members in the channel to Mentions, adds group members not in the channel to OtherPotentialMentions
// returns false if no group members present in the team that the channel belongs to
func (a *App) insertGroupMentions(group *model.Group, channel *model.Channel, profileMap map[string]*model.User, mentions *ExplicitMentions) (bool, *model.AppError) {
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
		if _, ok := profileMap[member.Id]; ok {
			mentions.Mentions[member.Id] = GroupMention
		} else {
			outOfChannelGroupMembers = append(outOfChannelGroupMembers, member)
		}
	}

	potentialGroupMembersMentioned := []string{}
	for _, user := range outOfChannelGroupMembers {
		potentialGroupMembersMentioned = append(potentialGroupMembersMentioned, user.Username)
	}
	if mentions.OtherPotentialMentions == nil {
		mentions.OtherPotentialMentions = potentialGroupMembersMentioned
	} else {
		mentions.OtherPotentialMentions = append(mentions.OtherPotentialMentions, potentialGroupMembersMentioned...)
	}

	return isGroupOrDirect || len(groupMembers) > 0, nil
}

// addMentionKeywordsForUser adds the mention keywords for a given user to the given keyword map. Returns the provided keyword map.
func addMentionKeywordsForUser(keywords map[string][]string, profile *model.User, channelNotifyProps map[string]string, status *model.Status, allowChannelMentions bool) map[string][]string {
	userMention := "@" + strings.ToLower(profile.Username)
	keywords[userMention] = append(keywords[userMention], profile.Id)

	// Add all the user's mention keys
	for _, k := range profile.GetMentionKeys() {
		// note that these are made lower case so that we can do a case insensitive check for them
		key := strings.ToLower(k)

		if key != "" {
			keywords[key] = append(keywords[key], profile.Id)
		}
	}

	// If turned on, add the user's case sensitive first name
	if profile.NotifyProps[model.FirstNameNotifyProp] == "true" && profile.FirstName != "" {
		keywords[profile.FirstName] = append(keywords[profile.FirstName], profile.Id)
	}

	// Add @channel and @all to keywords if user has them turned on and the server allows them
	if allowChannelMentions {
		// Ignore channel mentions if channel is muted and channel mention setting is default
		ignoreChannelMentions := channelNotifyProps[model.IgnoreChannelMentionsNotifyProp] == model.IgnoreChannelMentionsOn || (channelNotifyProps[model.MarkUnreadNotifyProp] == model.UserNotifyMention && channelNotifyProps[model.IgnoreChannelMentionsNotifyProp] == model.IgnoreChannelMentionsDefault)

		if profile.NotifyProps[model.ChannelMentionsNotifyProp] == "true" && !ignoreChannelMentions {
			keywords["@channel"] = append(keywords["@channel"], profile.Id)
			keywords["@all"] = append(keywords["@all"], profile.Id)

			if status != nil && status.Status == model.StatusOnline {
				keywords["@here"] = append(keywords["@here"], profile.Id)
			}
		}
	}

	return keywords
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

// checkForMention checks if there is a mention to a specific user or to the keywords here / channel / all
func (m *ExplicitMentions) checkForMention(word string, keywords map[string][]string, groups map[string]*model.Group) bool {
	var mentionType MentionType

	switch strings.ToLower(word) {
	case "@here":
		m.HereMentioned = true
		mentionType = ChannelMention
	case "@channel":
		m.ChannelMentioned = true
		mentionType = ChannelMention
	case "@all":
		m.AllMentioned = true
		mentionType = ChannelMention
	default:
		mentionType = KeywordMention
	}

	m.addGroupMention(word, groups)

	if ids, match := keywords[strings.ToLower(word)]; match {
		m.addMentions(ids, mentionType)
		return true
	}

	// Case-sensitive check for first name
	if ids, match := keywords[word]; match {
		m.addMentions(ids, mentionType)
		return true
	}

	return false
}

// isKeywordMultibyte checks if a word containing a multibyte character contains a multibyte keyword
func isKeywordMultibyte(keywords map[string][]string, word string) ([]string, bool) {
	ids := []string{}
	match := false
	var multibyteKeywords []string
	for keyword := range keywords {
		if len(keyword) != utf8.RuneCountInString(keyword) {
			multibyteKeywords = append(multibyteKeywords, keyword)
		}
	}

	if len(word) != utf8.RuneCountInString(word) {
		for _, key := range multibyteKeywords {
			if strings.Contains(word, key) {
				ids, match = keywords[key]
			}
		}
	}
	return ids, match
}

// Processes text to filter mentioned users and other potential mentions
func (m *ExplicitMentions) processText(text string, keywords map[string][]string, groups map[string]*model.Group) {
	systemMentions := map[string]bool{"@here": true, "@channel": true, "@all": true}

	for _, word := range strings.FieldsFunc(text, func(c rune) bool {
		// Split on any whitespace or punctuation that can't be part of an at mention or emoji pattern
		return !(c == ':' || c == '.' || c == '-' || c == '_' || c == '@' || unicode.IsLetter(c) || unicode.IsNumber(c))
	}) {
		// skip word with format ':word:' with an assumption that it is an emoji format only
		if word[0] == ':' && word[len(word)-1] == ':' {
			continue
		}

		word = strings.TrimLeft(word, ":.-_")

		if m.checkForMention(word, keywords, groups) {
			continue
		}

		foundWithoutSuffix := false
		wordWithoutSuffix := word

		for wordWithoutSuffix != "" && strings.LastIndexAny(wordWithoutSuffix, ".-:_") == (len(wordWithoutSuffix)-1) {
			wordWithoutSuffix = wordWithoutSuffix[0 : len(wordWithoutSuffix)-1]

			if m.checkForMention(wordWithoutSuffix, keywords, groups) {
				foundWithoutSuffix = true
				break
			}
		}

		if foundWithoutSuffix {
			continue
		}

		if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
			// No need to bother about unicode as we are looking for ASCII characters.
			last := word[len(word)-1]
			switch last {
			// If the word is possibly at the end of a sentence, remove that character.
			case '.', '-', ':':
				word = word[:len(word)-1]
			}
			m.OtherPotentialMentions = append(m.OtherPotentialMentions, word[1:])
		} else if strings.ContainsAny(word, ".-:") {
			// This word contains a character that may be the end of a sentence, so split further
			splitWords := strings.FieldsFunc(word, func(c rune) bool {
				return c == '.' || c == '-' || c == ':'
			})

			for _, splitWord := range splitWords {
				if m.checkForMention(splitWord, keywords, groups) {
					continue
				}
				if _, ok := systemMentions[splitWord]; !ok && strings.HasPrefix(splitWord, "@") {
					m.OtherPotentialMentions = append(m.OtherPotentialMentions, splitWord[1:])
				}
			}
		}

		if ids, match := isKeywordMultibyte(keywords, word); match {
			m.addMentions(ids, KeywordMention)
		}
	}
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

func (c *CRTNotifiers) addFollowerToNotify(user *model.User, mentions *ExplicitMentions, channelMemberNotificationProps model.StringMap, channel *model.Channel) {
	_, userWasMentioned := mentions.Mentions[user.Id]
	notifyDesktop, notifyPush, notifyEmail := shouldUserNotifyCRT(user, userWasMentioned)
	notifyChannelDesktop, notifyChannelPush := shouldChannelMemberNotifyCRT(channelMemberNotificationProps, userWasMentioned)

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
func shouldChannelMemberNotifyCRT(notifyProps model.StringMap, isMentioned bool) (notifyDesktop, notifyPush bool) {
	notifyDesktop = false
	notifyPush = false

	desktop := notifyProps[model.DesktopNotifyProp]
	push := notifyProps[model.PushNotifyProp]

	desktopThreads := notifyProps[model.DesktopThreadsNotifyProp]
	pushThreads := notifyProps[model.PushThreadsNotifyProp]

	// user should be notified via desktop notification in the case the notify prop is not set as no notify or default
	// and either the user was mentioned or the CRT notify prop for desktop is set to all
	if desktop != model.ChannelNotifyDefault && desktop != model.ChannelNotifyNone && (isMentioned || desktopThreads == model.ChannelNotifyAll || desktop == model.ChannelNotifyAll) {
		notifyDesktop = true
	}

	// user should be notified via push in the case the notify prop is not set as no notify or default
	// and either the user was mentioned or the CRT push notify prop is set to all
	if push != model.ChannelNotifyDefault && push != model.ChannelNotifyNone && (isMentioned || pushThreads == model.ChannelNotifyAll || push == model.ChannelNotifyAll) {
		notifyPush = true
	}

	return
}
