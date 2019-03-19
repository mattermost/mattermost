// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/markdown"
)

const (
	THREAD_ANY  = "any"
	THREAD_ROOT = "root"
)

func (a *App) SendNotifications(post *model.Post, team *model.Team, channel *model.Channel, sender *model.User, parentPostList *model.PostList) ([]string, *model.AppError) {
	// Do not send notifications in archived channels
	if channel.DeleteAt > 0 {
		return []string{}, nil
	}

	pchan := a.Srv.Store.User().GetAllProfilesInChannel(channel.Id, true)
	cmnchan := a.Srv.Store.Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
	var fchan store.StoreChannel

	if len(post.FileIds) != 0 {
		fchan = a.Srv.Store.FileInfo().GetForPost(post.Id, true, true)
	}

	result := <-pchan
	if result.Err != nil {
		return nil, result.Err
	}
	profileMap := result.Data.(map[string]*model.User)

	result = <-cmnchan
	if result.Err != nil {
		return nil, result.Err
	}
	channelMemberNotifyPropsMap := result.Data.(map[string]model.StringMap)

	mentionedUserIds := make(map[string]bool)
	threadMentionedUserIds := make(map[string]string)
	allActivityPushUserIds := []string{}
	hereNotification := false
	channelNotification := false
	allNotification := false
	updateMentionChans := []store.StoreChannel{}

	if channel.Type == model.CHANNEL_DIRECT {
		var otherUserId string

		userIds := strings.Split(channel.Name, "__")

		if userIds[0] != userIds[1] {
			if userIds[0] == post.UserId {
				otherUserId = userIds[1]
			} else {
				otherUserId = userIds[0]
			}
		}

		otherUser, ok := profileMap[otherUserId]
		if ok {
			mentionedUserIds[otherUserId] = true
		}

		if post.Props["from_webhook"] == "true" {
			mentionedUserIds[post.UserId] = true
		}

		if post.Type != model.POST_AUTO_RESPONDER {
			a.Srv.Go(func() {
				a.SendAutoResponse(channel, otherUser)
			})
		}

	} else {
		keywords := a.GetMentionKeywordsInChannel(profileMap, post.Type != model.POST_HEADER_CHANGE && post.Type != model.POST_PURPOSE_CHANGE, channelMemberNotifyPropsMap)

		m := GetExplicitMentions(post, keywords)

		// Add an implicit mention when a user is added to a channel
		// even if the user has set 'username mentions' to false in account settings.
		if post.Type == model.POST_ADD_TO_CHANNEL {
			val := post.Props[model.POST_PROPS_ADDED_USER_ID]
			if val != nil {
				uid := val.(string)
				m.MentionedUserIds[uid] = true
			}
		}

		mentionedUserIds, hereNotification, channelNotification, allNotification = m.MentionedUserIds, m.HereMentioned, m.ChannelMentioned, m.AllMentioned

		// get users that have comment thread mentions enabled
		if len(post.RootId) > 0 && parentPostList != nil {
			for _, threadPost := range parentPostList.Posts {
				profile := profileMap[threadPost.UserId]
				if profile != nil && (profile.NotifyProps[model.COMMENTS_NOTIFY_PROP] == THREAD_ANY || (profile.NotifyProps[model.COMMENTS_NOTIFY_PROP] == THREAD_ROOT && threadPost.Id == parentPostList.Order[0])) {
					if threadPost.Id == parentPostList.Order[0] {
						threadMentionedUserIds[threadPost.UserId] = THREAD_ROOT
					} else {
						threadMentionedUserIds[threadPost.UserId] = THREAD_ANY
					}

					if _, ok := mentionedUserIds[threadPost.UserId]; !ok {
						mentionedUserIds[threadPost.UserId] = false
					}
				}
			}
		}

		// prevent the user from mentioning themselves
		if post.Props["from_webhook"] != "true" {
			delete(mentionedUserIds, post.UserId)
		}

		if len(m.OtherPotentialMentions) > 0 && !post.IsSystemMessage() {
			if result := <-a.Srv.Store.User().GetProfilesByUsernames(m.OtherPotentialMentions, &model.ViewUsersRestrictions{Teams: []string{team.Id}}); result.Err == nil {
				outOfChannelMentions := result.Data.([]*model.User)
				if channel.Type != model.CHANNEL_GROUP {
					a.Srv.Go(func() {
						a.sendOutOfChannelMentions(sender, post, outOfChannelMentions)
					})
				}
			}
		}

		// find which users in the channel are set up to always receive mobile notifications
		for _, profile := range profileMap {
			if (profile.NotifyProps[model.PUSH_NOTIFY_PROP] == model.USER_NOTIFY_ALL ||
				channelMemberNotifyPropsMap[profile.Id][model.PUSH_NOTIFY_PROP] == model.CHANNEL_NOTIFY_ALL) &&
				(post.UserId != profile.Id || post.Props["from_webhook"] == "true") &&
				!post.IsSystemMessage() {
				allActivityPushUserIds = append(allActivityPushUserIds, profile.Id)
			}
		}
	}

	mentionedUsersList := make([]string, 0, len(mentionedUserIds))
	for id := range mentionedUserIds {
		mentionedUsersList = append(mentionedUsersList, id)
		updateMentionChans = append(updateMentionChans, a.Srv.Store.Channel().IncrementMentionCount(post.ChannelId, id))
	}

	notification := &postNotification{
		post:       post,
		channel:    channel,
		profileMap: profileMap,
		sender:     sender,
	}

	if *a.Config().EmailSettings.SendEmailNotifications {
		for _, id := range mentionedUsersList {
			if profileMap[id] == nil {
				continue
			}

			userAllowsEmails := profileMap[id].NotifyProps[model.EMAIL_NOTIFY_PROP] != "false"
			if channelEmail, ok := channelMemberNotifyPropsMap[id][model.EMAIL_NOTIFY_PROP]; ok {
				if channelEmail != model.CHANNEL_NOTIFY_DEFAULT {
					userAllowsEmails = channelEmail != "false"
				}
			}

			// Remove the user as recipient when the user has muted the channel.
			if channelMuted, ok := channelMemberNotifyPropsMap[id][model.MARK_UNREAD_NOTIFY_PROP]; ok {
				if channelMuted == model.CHANNEL_MARK_UNREAD_MENTION {
					mlog.Debug(fmt.Sprintf("Channel muted for user_id %v, channel_mute %v", id, channelMuted))
					userAllowsEmails = false
				}
			}

			//If email verification is required and user email is not verified don't send email.
			if *a.Config().EmailSettings.RequireEmailVerification && !profileMap[id].EmailVerified {
				mlog.Error(fmt.Sprintf("Skipped sending notification email to %v, address not verified. [details: user_id=%v]", profileMap[id].Email, id))
				continue
			}

			var status *model.Status
			var err *model.AppError
			if status, err = a.GetStatus(id); err != nil {
				status = &model.Status{
					UserId:         id,
					Status:         model.STATUS_OFFLINE,
					Manual:         false,
					LastActivityAt: 0,
					ActiveChannel:  "",
				}
			}

			autoResponderRelated := status.Status == model.STATUS_OUT_OF_OFFICE || post.Type == model.POST_AUTO_RESPONDER

			if userAllowsEmails && status.Status != model.STATUS_ONLINE && profileMap[id].DeleteAt == 0 && !autoResponderRelated {
				a.sendNotificationEmail(notification, profileMap[id], team)
			}
		}
	}

	T := utils.GetUserTranslations(sender.Locale)

	// If the channel has more than 1K users then @here is disabled
	if hereNotification && int64(len(profileMap)) > *a.Config().TeamSettings.MaxNotificationsPerChannel {
		hereNotification = false
		a.SendEphemeralPost(
			post.UserId,
			&model.Post{
				ChannelId: post.ChannelId,
				Message:   T("api.post.disabled_here", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
				CreateAt:  post.CreateAt + 1,
			},
		)
	}

	// If the channel has more than 1K users then @channel is disabled
	if channelNotification && int64(len(profileMap)) > *a.Config().TeamSettings.MaxNotificationsPerChannel {
		a.SendEphemeralPost(
			post.UserId,
			&model.Post{
				ChannelId: post.ChannelId,
				Message:   T("api.post.disabled_channel", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
				CreateAt:  post.CreateAt + 1,
			},
		)
	}

	// If the channel has more than 1K users then @all is disabled
	if allNotification && int64(len(profileMap)) > *a.Config().TeamSettings.MaxNotificationsPerChannel {
		a.SendEphemeralPost(
			post.UserId,
			&model.Post{
				ChannelId: post.ChannelId,
				Message:   T("api.post.disabled_all", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel}),
				CreateAt:  post.CreateAt + 1,
			},
		)
	}

	// Make sure all mention updates are complete to prevent race
	// Probably better to batch these DB updates in the future
	// MUST be completed before push notifications send
	for _, uchan := range updateMentionChans {
		if result := <-uchan; result.Err != nil {
			mlog.Warn(fmt.Sprintf("Failed to update mention count, post_id=%v channel_id=%v err=%v", post.Id, post.ChannelId, result.Err), mlog.String("post_id", post.Id))
		}
	}

	sendPushNotifications := false
	if *a.Config().EmailSettings.SendPushNotifications {
		pushServer := *a.Config().EmailSettings.PushNotificationServer
		if license := a.License(); pushServer == model.MHPNS && (license == nil || !*license.Features.MHPNS) {
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
				replyToThreadType := ""
				if value, ok := threadMentionedUserIds[id]; ok {
					replyToThreadType = value
				}

				a.sendPushNotification(
					notification,
					profileMap[id],
					mentionedUserIds[id],
					(channelNotification || hereNotification || allNotification),
					replyToThreadType,
				)
			}
		}

		for _, id := range allActivityPushUserIds {
			if profileMap[id] == nil {
				continue
			}

			if _, ok := mentionedUserIds[id]; !ok {
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

	if len(post.FileIds) != 0 && fchan != nil {
		message.Add("otherFile", "true")

		var infos []*model.FileInfo
		if result := <-fchan; result.Err != nil {
			mlog.Warn(fmt.Sprint("Unable to get fileInfo for push notifications.", post.Id, result.Err), mlog.String("post_id", post.Id))
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

func (a *App) sendOutOfChannelMentions(sender *model.User, post *model.Post, users []*model.User) *model.AppError {
	if len(users) == 0 {
		return nil
	}

	var usernames []string
	for _, user := range users {
		usernames = append(usernames, user.Username)
	}
	sort.Strings(usernames)

	var userIds []string
	for _, user := range users {
		userIds = append(userIds, user.Id)
	}

	T := utils.GetUserTranslations(sender.Locale)

	ephemeralPostId := model.NewId()
	var message string
	if len(users) == 1 {
		message = T("api.post.check_for_out_of_channel_mentions.message.one", map[string]interface{}{
			"Username": usernames[0],
		})
	} else {
		message = T("api.post.check_for_out_of_channel_mentions.message.multiple", map[string]interface{}{
			"Usernames":    strings.Join(usernames[:len(usernames)-1], ", @"),
			"LastUsername": usernames[len(usernames)-1],
		})
	}

	props := model.StringInterface{
		model.PROPS_ADD_CHANNEL_MEMBER: model.StringInterface{
			"post_id":   ephemeralPostId,
			"usernames": usernames,
			"user_ids":  userIds,
		},
	}

	a.SendEphemeralPost(
		post.UserId,
		&model.Post{
			Id:        ephemeralPostId,
			RootId:    post.RootId,
			ChannelId: post.ChannelId,
			Message:   message,
			CreateAt:  post.CreateAt + 1,
			Props:     props,
		},
	)

	return nil
}

type ExplicitMentions struct {
	// MentionedUserIds contains a key for each user mentioned by keyword.
	MentionedUserIds map[string]bool

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

// Given a message and a map mapping mention keywords to the users who use them, returns a map of mentioned
// users and a slice of potential mention users not in the channel and whether or not @here was mentioned.
func GetExplicitMentions(post *model.Post, keywords map[string][]string) *ExplicitMentions {
	ret := &ExplicitMentions{
		MentionedUserIds: make(map[string]bool),
	}
	systemMentions := map[string]bool{"@here": true, "@channel": true, "@all": true}

	addMentionedUsers := func(ids []string) {
		for _, id := range ids {
			ret.MentionedUserIds[id] = true
		}
	}
	checkForMention := func(word string) bool {
		isMention := false

		if strings.ToLower(word) == "@here" {
			ret.HereMentioned = true
		}

		if strings.ToLower(word) == "@channel" {
			ret.ChannelMentioned = true
		}

		if strings.ToLower(word) == "@all" {
			ret.AllMentioned = true
		}

		// Non-case-sensitive check for regular keys
		if ids, match := keywords[strings.ToLower(word)]; match {
			addMentionedUsers(ids)
			isMention = true
		}

		// Case-sensitive check for first name
		if ids, match := keywords[word]; match {
			addMentionedUsers(ids)
			isMention = true
		}

		return isMention
	}

	var multibyteKeywords []string
	for keyword := range keywords {
		if len(keyword) != utf8.RuneCountInString(keyword) {
			multibyteKeywords = append(multibyteKeywords, keyword)
		}
	}

	processText := func(text string) {
		for _, word := range strings.FieldsFunc(text, func(c rune) bool {
			// Split on any whitespace or punctuation that can't be part of an at mention or emoji pattern
			return !(c == ':' || c == '.' || c == '-' || c == '_' || c == '@' || unicode.IsLetter(c) || unicode.IsNumber(c))
		}) {
			// skip word with format ':word:' with an assumption that it is an emoji format only
			if word[0] == ':' && word[len(word)-1] == ':' {
				continue
			}

			word = strings.TrimLeft(word, ":.-_")

			if checkForMention(word) {
				continue
			}

			foundWithoutSuffix := false
			wordWithoutSuffix := word
			for len(wordWithoutSuffix) > 0 && strings.LastIndexAny(wordWithoutSuffix, ".-:_") == (len(wordWithoutSuffix)-1) {
				wordWithoutSuffix = wordWithoutSuffix[0 : len(wordWithoutSuffix)-1]

				if checkForMention(wordWithoutSuffix) {
					foundWithoutSuffix = true
					break
				}
			}

			if foundWithoutSuffix {
				continue
			}

			if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
				ret.OtherPotentialMentions = append(ret.OtherPotentialMentions, word[1:])
			} else if strings.ContainsAny(word, ".-:") {
				// This word contains a character that may be the end of a sentence, so split further
				splitWords := strings.FieldsFunc(word, func(c rune) bool {
					return c == '.' || c == '-' || c == ':'
				})

				for _, splitWord := range splitWords {
					if checkForMention(splitWord) {
						continue
					}
					if _, ok := systemMentions[splitWord]; !ok && strings.HasPrefix(splitWord, "@") {
						ret.OtherPotentialMentions = append(ret.OtherPotentialMentions, splitWord[1:])
					}
				}
			}

			// If word contains a multibyte character, check if it contains a multibyte keyword
			if len(word) != utf8.RuneCountInString(word) {
				for _, key := range multibyteKeywords {
					if strings.Contains(word, key) {
						if ids, match := keywords[key]; match {
							addMentionedUsers(ids)
						}
					}
				}
			}
		}
	}

	buf := ""
	mentionsEnabledFields := GetMentionsEnabledFields(post)
	for _, message := range mentionsEnabledFields {
		markdown.Inspect(message, func(node interface{}) bool {
			text, ok := node.(*markdown.Text)
			if !ok {
				processText(buf)
				buf = ""
				return true
			}
			buf += text.Text
			return false
		})
	}
	processText(buf)

	return ret
}

// Given a post returns the values of the fields in which mentions are possible.
// post.message, preText and text in the attachment are enabled.
func GetMentionsEnabledFields(post *model.Post) model.StringArray {
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

// Given a map of user IDs to profiles, returns a list of mention
// keywords for all users in the channel.
func (a *App) GetMentionKeywordsInChannel(profiles map[string]*model.User, lookForSpecialMentions bool, channelMemberNotifyPropsMap map[string]model.StringMap) map[string][]string {
	keywords := make(map[string][]string)

	for id, profile := range profiles {
		userMention := "@" + strings.ToLower(profile.Username)
		keywords[userMention] = append(keywords[userMention], id)

		if len(profile.NotifyProps[model.MENTION_KEYS_NOTIFY_PROP]) > 0 {
			// Add all the user's mention keys
			splitKeys := strings.Split(profile.NotifyProps[model.MENTION_KEYS_NOTIFY_PROP], ",")
			for _, k := range splitKeys {
				// note that these are made lower case so that we can do a case insensitive check for them
				key := strings.ToLower(k)
				keywords[key] = append(keywords[key], id)
			}
		}

		// If turned on, add the user's case sensitive first name
		if profile.NotifyProps[model.FIRST_NAME_NOTIFY_PROP] == "true" {
			keywords[profile.FirstName] = append(keywords[profile.FirstName], profile.Id)
		}

		ignoreChannelMentions := false
		if ignoreChannelMentionsNotifyProp, ok := channelMemberNotifyPropsMap[profile.Id][model.IGNORE_CHANNEL_MENTIONS_NOTIFY_PROP]; ok {
			if ignoreChannelMentionsNotifyProp == model.IGNORE_CHANNEL_MENTIONS_ON {
				ignoreChannelMentions = true
			}
		}

		// Add @channel and @all to keywords if user has them turned on
		if lookForSpecialMentions {
			if int64(len(profiles)) <= *a.Config().TeamSettings.MaxNotificationsPerChannel && profile.NotifyProps[model.CHANNEL_MENTIONS_NOTIFY_PROP] == "true" && !ignoreChannelMentions {
				keywords["@channel"] = append(keywords["@channel"], profile.Id)
				keywords["@all"] = append(keywords["@all"], profile.Id)

				status := GetStatusFromCache(profile.Id)
				if status != nil && status.Status == model.STATUS_ONLINE {
					keywords["@here"] = append(keywords["@here"], profile.Id)
				}
			}
		}
	}

	return keywords
}

// Represents either an email or push notification and contains the fields required to send it to any user.
type postNotification struct {
	channel    *model.Channel
	post       *model.Post
	profileMap map[string]*model.User
	sender     *model.User
}

// Returns the name of the channel for this notification. For direct messages, this is the sender's name
// preceeded by an at sign. For group messages, this is a comma-separated list of the members of the
// channel, with an option to exclude the recipient of the message from that list.
func (n *postNotification) GetChannelName(userNameFormat string, excludeId string) string {
	switch n.channel.Type {
	case model.CHANNEL_DIRECT:
		return fmt.Sprintf("@%s", n.sender.GetDisplayName(userNameFormat))
	case model.CHANNEL_GROUP:
		names := []string{}
		for _, user := range n.profileMap {
			if user.Id != excludeId {
				names = append(names, user.GetDisplayName(userNameFormat))
			}
		}

		sort.Strings(names)

		return strings.Join(names, ", ")
	default:
		return n.channel.DisplayName
	}
}

// Returns the name of the sender of this notification, accounting for things like system messages
// and whether or not the username has been overridden by an integration.
func (n *postNotification) GetSenderName(userNameFormat string, overridesAllowed bool) string {
	if n.post.IsSystemMessage() {
		return utils.T("system.message.name")
	}

	if overridesAllowed && n.channel.Type != model.CHANNEL_DIRECT {
		if value, ok := n.post.Props["override_username"]; ok && n.post.Props["from_webhook"] == "true" {
			return value.(string)
		}
	}

	return n.sender.GetDisplayName(userNameFormat)
}
