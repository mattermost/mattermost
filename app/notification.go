// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/markdown"
)

func (a *App) SendNotifications(post *model.Post, team *model.Team, channel *model.Channel, sender *model.User, parentPostList *model.PostList, setOnline bool) ([]string, error) {
	// Do not send notifications in archived channels
	if channel.DeleteAt > 0 {
		return []string{}, nil
	}

	pchan := make(chan store.StoreResult, 1)
	go func() {
		props, err := a.Srv().Store.User().GetAllProfilesInChannel(channel.Id, true)
		pchan <- store.StoreResult{Data: props, NErr: err}
		close(pchan)
	}()

	cmnchan := make(chan store.StoreResult, 1)
	go func() {
		props, err := a.Srv().Store.Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
		cmnchan <- store.StoreResult{Data: props, NErr: err}
		close(cmnchan)
	}()

	var gchan chan store.StoreResult
	if a.allowGroupMentions(post) {
		gchan = make(chan store.StoreResult, 1)
		go func() {
			groupsMap, err := a.getGroupsAllowedForReferenceInChannel(channel, team)
			gchan <- store.StoreResult{Data: groupsMap, Err: err}
			close(gchan)
		}()
	}

	var fchan chan store.StoreResult
	if len(post.FileIds) != 0 {
		fchan = make(chan store.StoreResult, 1)
		go func() {
			fileInfos, err := a.Srv().Store.FileInfo().GetForPost(post.Id, true, false, true)
			fchan <- store.StoreResult{Data: fileInfos, NErr: err}
			close(fchan)
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

	groups := make(map[string]*model.Group)
	if gchan != nil {
		result = <-gchan
		if result.Err != nil {
			return nil, result.Err
		}
		groups = result.Data.(map[string]*model.Group)
	}

	mentions := &ExplicitMentions{}
	allActivityPushUserIds := []string{}

	if channel.Type == model.CHANNEL_DIRECT {
		otherUserId := channel.GetOtherUserIdForDM(post.UserId)

		_, ok := profileMap[otherUserId]
		if ok {
			mentions.addMention(otherUserId, DMMention)
		}

		if post.GetProp("from_webhook") == "true" {
			mentions.addMention(post.UserId, DMMention)
		}
	} else {
		allowChannelMentions := a.allowChannelMentions(post, len(profileMap))
		keywords := a.getMentionKeywordsInChannel(profileMap, allowChannelMentions, channelMemberNotifyPropsMap)

		mentions = getExplicitMentions(post, keywords, groups)

		// Add an implicit mention when a user is added to a channel
		// even if the user has set 'username mentions' to false in account settings.
		if post.Type == model.POST_ADD_TO_CHANNEL {
			addedUserId, ok := post.GetProp(model.POST_PROPS_ADDED_USER_ID).(string)
			if ok {
				mentions.addMention(addedUserId, KeywordMention)
			}
		}

		// Iterate through all groups that were mentioned and insert group members into the list of mentions or potential mentions
		for _, group := range mentions.GroupMentions {
			anyUsersMentionedByGroup, err := a.insertGroupMentions(group, channel, profileMap, mentions)
			if err != nil {
				return nil, err
			}

			if !anyUsersMentionedByGroup {
				a.sendNoUsersNotifiedByGroupInChannel(sender, post, channel, group)
			}
		}

		// get users that have comment thread mentions enabled
		if len(post.RootId) > 0 && parentPostList != nil {
			for _, threadPost := range parentPostList.Posts {
				profile := profileMap[threadPost.UserId]
				if profile != nil && (profile.NotifyProps[model.COMMENTS_NOTIFY_PROP] == model.COMMENTS_NOTIFY_ANY || (profile.NotifyProps[model.COMMENTS_NOTIFY_PROP] == model.COMMENTS_NOTIFY_ROOT && threadPost.Id == parentPostList.Order[0])) {
					mentionType := ThreadMention
					if threadPost.Id == parentPostList.Order[0] {
						mentionType = CommentMention
					}

					mentions.addMention(threadPost.UserId, mentionType)
				}
			}
		}

		// prevent the user from mentioning themselves
		if post.GetProp("from_webhook") != "true" {
			mentions.removeMention(post.UserId)
		}

		go func() {
			_, err := a.sendOutOfChannelMentions(sender, post, channel, mentions.OtherPotentialMentions)
			if err != nil {
				mlog.Error("Failed to send warning for out of channel mentions", mlog.String("user_id", sender.Id), mlog.String("post_id", post.Id), mlog.Err(err))
			}
		}()

		// find which users in the channel are set up to always receive mobile notifications
		for _, profile := range profileMap {
			if (profile.NotifyProps[model.PUSH_NOTIFY_PROP] == model.USER_NOTIFY_ALL ||
				channelMemberNotifyPropsMap[profile.Id][model.PUSH_NOTIFY_PROP] == model.CHANNEL_NOTIFY_ALL) &&
				(post.UserId != profile.Id || post.GetProp("from_webhook") == "true") &&
				!post.IsSystemMessage() {
				allActivityPushUserIds = append(allActivityPushUserIds, profile.Id)
			}
		}
	}

	mentionedUsersList := make([]string, 0, len(mentions.Mentions))
	updateMentionChans := []chan *model.AppError{}
	mentionAutofollowChans := []chan *model.AppError{}

	// for each mention, make sure to update thread autofollow
	for id := range mentions.Mentions {
		mac := make(chan *model.AppError, 1)
		go func(userId string) {
			defer close(mac)
			if *a.Config().ServiceSettings.ThreadAutoFollow && post.RootId != "" {
				nErr := a.Srv().Store.Thread().CreateMembershipIfNeeded(userId, post.RootId)
				if nErr != nil {
					mac <- model.NewAppError("SendNotifications", "app.channel.autofollow.app_error", nil, nErr.Error(), http.StatusInternalServerError)
					return
				}
			}
			mac <- nil
		}(id)
		mentionAutofollowChans = append(mentionAutofollowChans, mac)
	}

	for id := range mentions.Mentions {
		mentionedUsersList = append(mentionedUsersList, id)

		umc := make(chan *model.AppError, 1)
		go func(userId string) {
			defer close(umc)
			nErr := a.Srv().Store.Channel().IncrementMentionCount(post.ChannelId, userId, *a.Config().ServiceSettings.ThreadAutoFollow)
			if nErr != nil {
				umc <- model.NewAppError("SendNotifications", "app.channel.increment_mention_count.app_error", nil, nErr.Error(), http.StatusInternalServerError)
				return
			}
			umc <- nil
		}(id)
		updateMentionChans = append(updateMentionChans, umc)
	}

	notification := &PostNotification{
		Post:       post,
		Channel:    channel,
		ProfileMap: profileMap,
		Sender:     sender,
	}

	if *a.Config().EmailSettings.SendEmailNotifications {
		for _, id := range mentionedUsersList {
			if profileMap[id] == nil {
				continue
			}

			//If email verification is required and user email is not verified don't send email.
			if *a.Config().EmailSettings.RequireEmailVerification && !profileMap[id].EmailVerified {
				mlog.Error("Skipped sending notification email, address not verified.", mlog.String("user_email", profileMap[id].Email), mlog.String("user_id", id))
				continue
			}

			if a.userAllowsEmail(profileMap[id], channelMemberNotifyPropsMap[id], post) {
				a.sendNotificationEmail(notification, profileMap[id], team)
			}
		}
	}

	// Check for channel-wide mentions in channels that have too many members for those to work
	if int64(len(profileMap)) > *a.Config().TeamSettings.MaxNotificationsPerChannel {
		T := utils.GetUserTranslations(sender.Locale)

		if mentions.HereMentioned {
			a.SendEphemeralPost(
				post.UserId,
				&model.Post{
					ChannelId: post.ChannelId,
					Message:   T("api.post.disabled_here", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
					CreateAt:  post.CreateAt + 1,
				},
			)
		}

		if mentions.ChannelMentioned {
			a.SendEphemeralPost(
				post.UserId,
				&model.Post{
					ChannelId: post.ChannelId,
					Message:   T("api.post.disabled_channel", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
					CreateAt:  post.CreateAt + 1,
				},
			)
		}

		if mentions.AllMentioned {
			a.SendEphemeralPost(
				post.UserId,
				&model.Post{
					ChannelId: post.ChannelId,
					Message:   T("api.post.disabled_all", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
					CreateAt:  post.CreateAt + 1,
				},
			)
		}
	}

	// Make sure all mention updates are complete to prevent race
	// Probably better to batch these DB updates in the future
	// MUST be completed before push notifications send
	for _, umc := range updateMentionChans {
		if err := <-umc; err != nil {
			mlog.Warn(
				"Failed to update mention count",
				mlog.String("post_id", post.Id),
				mlog.String("channel_id", post.ChannelId),
				mlog.Err(err),
			)
		}
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
	sendPushNotifications := false
	if *a.Config().EmailSettings.SendPushNotifications {
		pushServer := *a.Config().EmailSettings.PushNotificationServer
		if license := a.Srv().License(); pushServer == model.MHPNS && (license == nil || !*license.Features.MHPNS) {
			mlog.Warn("Push notifications are disabled. Go to System Console > Notifications > Mobile Push to enable them.")
			sendPushNotifications = false
		} else {
			sendPushNotifications = true
		}
	}

	if sendPushNotifications {
		for _, id := range mentionedUsersList {
			if profileMap[id] == nil {
				continue
			}

			var status *model.Status
			var err *model.AppError
			if status, err = a.GetStatus(id); err != nil {
				status = &model.Status{UserId: id, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
			}

			if ShouldSendPushNotification(profileMap[id], channelMemberNotifyPropsMap[id], true, status, post) {
				mentionType := mentions.Mentions[id]

				replyToThreadType := ""
				if mentionType == ThreadMention {
					replyToThreadType = model.COMMENTS_NOTIFY_ANY
				} else if mentionType == CommentMention {
					replyToThreadType = model.COMMENTS_NOTIFY_ROOT
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
				a.NotificationsLog().Warn("Notification not sent",
					mlog.String("ackId", ""),
					mlog.String("type", model.PUSH_TYPE_MESSAGE),
					mlog.String("userId", id),
					mlog.String("postId", post.Id),
					mlog.String("status", model.PUSH_NOT_SENT),
				)
			}
		}

		for _, id := range allActivityPushUserIds {
			if profileMap[id] == nil {
				continue
			}

			if _, ok := mentions.Mentions[id]; !ok {
				var status *model.Status
				var err *model.AppError
				if status, err = a.GetStatus(id); err != nil {
					status = &model.Status{UserId: id, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
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
					a.NotificationsLog().Warn("Notification not sent",
						mlog.String("ackId", ""),
						mlog.String("type", model.PUSH_TYPE_MESSAGE),
						mlog.String("userId", id),
						mlog.String("postId", post.Id),
						mlog.String("status", model.PUSH_NOT_SENT),
					)
				}
			}
		}
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POSTED, "", post.ChannelId, "", nil)

	// Note that PreparePostForClient should've already been called by this point
	message.Add("post", post.ToJson())

	message.Add("channel_type", channel.Type)
	message.Add("channel_display_name", notification.GetChannelName(model.SHOW_USERNAME, ""))
	message.Add("channel_name", channel.Name)
	message.Add("sender_name", notification.GetSenderName(model.SHOW_USERNAME, *a.Config().ServiceSettings.EnablePostUsernameOverride))
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
		message.Add("mentions", model.ArrayToJson(mentionedUsersList))
	}

	a.Publish(message)
	return mentionedUsersList, nil
}

func (a *App) userAllowsEmail(user *model.User, channelMemberNotificationProps model.StringMap, post *model.Post) bool {
	userAllowsEmails := user.NotifyProps[model.EMAIL_NOTIFY_PROP] != "false"
	if channelEmail, ok := channelMemberNotificationProps[model.EMAIL_NOTIFY_PROP]; ok {
		if channelEmail != model.CHANNEL_NOTIFY_DEFAULT {
			userAllowsEmails = channelEmail != "false"
		}
	}

	// Remove the user as recipient when the user has muted the channel.
	if channelMuted, ok := channelMemberNotificationProps[model.MARK_UNREAD_NOTIFY_PROP]; ok {
		if channelMuted == model.CHANNEL_MARK_UNREAD_MENTION {
			mlog.Debug("Channel muted for user", mlog.String("user_id", user.Id), mlog.String("channel_mute", channelMuted))
			userAllowsEmails = false
		}
	}

	var status *model.Status
	var err *model.AppError
	if status, err = a.GetStatus(user.Id); err != nil {
		status = &model.Status{
			UserId:         user.Id,
			Status:         model.STATUS_OFFLINE,
			Manual:         false,
			LastActivityAt: 0,
			ActiveChannel:  "",
		}
	}

	autoResponderRelated := status.Status == model.STATUS_OUT_OF_OFFICE || post.Type == model.POST_AUTO_RESPONDER
	emailNotificationsAllowedForStatus := status.Status != model.STATUS_ONLINE && status.Status != model.STATUS_DND

	return userAllowsEmails && emailNotificationsAllowedForStatus && user.DeleteAt == 0 && !autoResponderRelated
}

func (a *App) sendNoUsersNotifiedByGroupInChannel(sender *model.User, post *model.Post, channel *model.Channel, group *model.Group) {
	T := utils.GetUserTranslations(sender.Locale)
	ephemeralPost := &model.Post{
		UserId:    sender.Id,
		RootId:    post.RootId,
		ParentId:  post.ParentId,
		ChannelId: channel.Id,
		Message:   T("api.post.check_for_out_of_channel_group_users.message.none", model.StringInterface{"GroupName": group.Name}),
	}
	a.SendEphemeralPost(post.UserId, ephemeralPost)
}

// sendOutOfChannelMentions sends an ephemeral post to the sender of a post if any of the given potential mentions
// are outside of the post's channel. Returns whether or not an ephemeral post was sent.
func (a *App) sendOutOfChannelMentions(sender *model.User, post *model.Post, channel *model.Channel, potentialMentions []string) (bool, error) {
	outOfChannelUsers, outOfGroupsUsers, err := a.filterOutOfChannelMentions(sender, post, channel, potentialMentions)
	if err != nil {
		return false, err
	}

	if len(outOfChannelUsers) == 0 && len(outOfGroupsUsers) == 0 {
		return false, nil
	}

	a.SendEphemeralPost(post.UserId, makeOutOfChannelMentionPost(sender, post, outOfChannelUsers, outOfGroupsUsers))

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

	if channel.TeamId == "" || channel.Type == model.CHANNEL_DIRECT || channel.Type == model.CHANNEL_GROUP {
		return nil, nil, nil
	}

	if len(potentialMentions) == 0 {
		return nil, nil, nil
	}

	users, err := a.Srv().Store.User().GetProfilesByUsernames(potentialMentions, &model.ViewUsersRestrictions{Teams: []string{channel.TeamId}})
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

	T := utils.GetUserTranslations(sender.Locale)

	ephemeralPostId := model.NewId()
	var message string
	if len(outOfChannelUsers) == 1 {
		message = T("api.post.check_for_out_of_channel_mentions.message.one", map[string]interface{}{
			"Username": ocUsernames[0],
		})
	} else if len(outOfChannelUsers) > 1 {
		preliminary, final := splitAtFinal(ocUsernames)

		message = T("api.post.check_for_out_of_channel_mentions.message.multiple", map[string]interface{}{
			"Usernames":    strings.Join(preliminary, ", @"),
			"LastUsername": final,
		})
	}

	if len(outOfGroupsUsers) == 1 {
		if len(message) > 0 {
			message += "\n"
		}

		message += T("api.post.check_for_out_of_channel_groups_mentions.message.one", map[string]interface{}{
			"Username": ogUsernames[0],
		})
	} else if len(outOfGroupsUsers) > 1 {
		preliminary, final := splitAtFinal(ogUsernames)

		if len(message) > 0 {
			message += "\n"
		}

		message += T("api.post.check_for_out_of_channel_groups_mentions.message.multiple", map[string]interface{}{
			"Usernames":    strings.Join(preliminary, ", @"),
			"LastUsername": final,
		})
	}

	props := model.StringInterface{
		model.PROPS_ADD_CHANNEL_MEMBER: model.StringInterface{
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

func (m *ExplicitMentions) addMention(userId string, mentionType MentionType) {
	if m.Mentions == nil {
		m.Mentions = make(map[string]MentionType)
	}

	if currentType, ok := m.Mentions[userId]; ok && currentType >= mentionType {
		return
	}

	m.Mentions[userId] = mentionType
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

func (m *ExplicitMentions) addMentions(userIds []string, mentionType MentionType) {
	for _, userId := range userIds {
		m.addMention(userId, mentionType)
	}
}

func (m *ExplicitMentions) removeMention(userId string) {
	delete(m.Mentions, userId)
}

// Given a message and a map mapping mention keywords to the users who use them, returns a map of mentioned
// users and a slice of potential mention users not in the channel and whether or not @here was mentioned.
func getExplicitMentions(post *model.Post, keywords map[string][]string, groups map[string]*model.Group) *ExplicitMentions {
	ret := &ExplicitMentions{}

	buf := ""
	mentionsEnabledFields := getMentionsEnabledFields(post)
	for _, message := range mentionsEnabledFields {
		markdown.Inspect(message, func(node interface{}) bool {
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

		if len(attachment.Pretext) != 0 {
			ret = append(ret, attachment.Pretext)
		}
		if len(attachment.Text) != 0 {
			ret = append(ret, attachment.Text)
		}
	}
	return ret
}

// allowChannelMentions returns whether or not the channel mentions are allowed for the given post.
func (a *App) allowChannelMentions(post *model.Post, numProfiles int) bool {
	if !a.HasPermissionToChannel(post.UserId, post.ChannelId, model.PERMISSION_USE_CHANNEL_MENTIONS) {
		return false
	}

	if post.Type == model.POST_HEADER_CHANGE || post.Type == model.POST_PURPOSE_CHANGE {
		return false
	}

	if int64(numProfiles) >= *a.Config().TeamSettings.MaxNotificationsPerChannel {
		return false
	}

	return true
}

// allowGroupMentions returns whether or not the group mentions are allowed for the given post.
func (a *App) allowGroupMentions(post *model.Post) bool {
	if license := a.Srv().License(); license == nil || !*license.Features.LDAPGroups {
		return false
	}

	if !a.HasPermissionToChannel(post.UserId, post.ChannelId, model.PERMISSION_USE_GROUP_MENTIONS) {
		return false
	}

	if post.Type == model.POST_HEADER_CHANGE || post.Type == model.POST_PURPOSE_CHANGE {
		return false
	}

	return true
}

// getGroupsAllowedForReferenceInChannel returns a map of groups allowed for reference in a given channel and team.
func (a *App) getGroupsAllowedForReferenceInChannel(channel *model.Channel, team *model.Team) (map[string]*model.Group, *model.AppError) {
	var err *model.AppError
	groupsMap := make(map[string]*model.Group)
	opts := model.GroupSearchOpts{FilterAllowReference: true}

	if channel.IsGroupConstrained() || team.IsGroupConstrained() {
		var groups []*model.GroupWithSchemeAdmin
		if channel.IsGroupConstrained() {
			groups, err = a.Srv().Store.Group().GetGroupsByChannel(channel.Id, opts)
		} else {
			groups, err = a.Srv().Store.Group().GetGroupsByTeam(team.Id, opts)
		}
		if err != nil {
			return nil, err
		}
		for _, group := range groups {
			if group.Group.Name != nil {
				groupsMap[*group.Group.Name] = &group.Group
			}
		}
		return groupsMap, nil
	}

	groups, err := a.Srv().Store.Group().GetGroups(0, 0, opts)
	if err != nil {
		return nil, err
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
	var err *model.AppError
	var groupMembers []*model.User
	outOfChannelGroupMembers := []*model.User{}
	isGroupOrDirect := channel.IsGroupOrDirect()

	if isGroupOrDirect {
		groupMembers, err = a.Srv().Store.Group().GetMemberUsers(group.Id)
	} else {
		groupMembers, err = a.Srv().Store.Group().GetMemberUsersInTeam(group.Id, channel.TeamId)
	}

	if err != nil {
		return false, err
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
	if profile.NotifyProps[model.FIRST_NAME_NOTIFY_PROP] == "true" && profile.FirstName != "" {
		keywords[profile.FirstName] = append(keywords[profile.FirstName], profile.Id)
	}

	// Add @channel and @all to keywords if user has them turned on and the server allows them
	if allowChannelMentions {
		ignoreChannelMentions := channelNotifyProps[model.IGNORE_CHANNEL_MENTIONS_NOTIFY_PROP] == model.IGNORE_CHANNEL_MENTIONS_ON

		if profile.NotifyProps[model.CHANNEL_MENTIONS_NOTIFY_PROP] == "true" && !ignoreChannelMentions {
			keywords["@channel"] = append(keywords["@channel"], profile.Id)
			keywords["@all"] = append(keywords["@all"], profile.Id)

			if status != nil && status.Status == model.STATUS_ONLINE {
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
	case model.CHANNEL_DIRECT:
		return n.Sender.GetDisplayNameWithPrefix(userNameFormat, "@")
	case model.CHANNEL_GROUP:
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
		return utils.T("system.message.name")
	}

	if overridesAllowed && n.Channel.Type != model.CHANNEL_DIRECT {
		if value, ok := n.Post.GetProps()["override_username"]; ok && n.Post.GetProp("from_webhook") == "true" {
			return value.(string)
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

		for len(wordWithoutSuffix) > 0 && strings.LastIndexAny(wordWithoutSuffix, ".-:_") == (len(wordWithoutSuffix)-1) {
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
		return model.SHOW_USERNAME
	}

	data, err := a.Srv().Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_NAME_FORMAT)
	if err != nil {
		return *a.Config().TeamSettings.TeammateNameDisplay
	}

	return data.Value
}
