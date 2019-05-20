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

// Represents either an email or push notification and contains the fields required to send it to any user.
type postNotification struct {
	channel    *model.Channel
	post       *model.Post
	profileMap map[string]*model.User
	sender     *model.User
}

// addMentionedUsers will add the mentioned user id in the struct's list for mentioned users
func (e *ExplicitMentions) addMentionedUsers(ids []string) {
	for _, id := range ids {
		e.MentionedUserIds[id] = true
	}
}

// checkForMention checks if there is a mention to a specific user or to the keywords here / channel / all
func (e *ExplicitMentions) checkForMention(word string, keywords map[string][]string) bool {
	isMention := false

	switch strings.ToLower(word) {
	case "@here":
		e.HereMentioned = true
	case "@channel":
		e.ChannelMentioned = true
	case "@all":
		e.AllMentioned = true
	}

	if ids, match := keywords[strings.ToLower(word)]; match {
		e.addMentionedUsers(ids)
		isMention = true
	}

	// Case-sensitive check for first name
	if ids, match := keywords[word]; match {
		e.addMentionedUsers(ids)
		isMention = true
	}

	return isMention
}

// isKeywordMultibyte if the word contains a multibyte character, check if it contains a multibyte keyword
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
func (e *ExplicitMentions) processText(text string, keywords map[string][]string) {
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

		if e.checkForMention(word, keywords) {
			continue
		}

		foundWithoutSuffix := false
		wordWithoutSuffix := word
		for len(wordWithoutSuffix) > 0 && strings.LastIndexAny(wordWithoutSuffix, ".-:_") == (len(wordWithoutSuffix)-1) {
			wordWithoutSuffix = wordWithoutSuffix[0 : len(wordWithoutSuffix)-1]

			if e.checkForMention(wordWithoutSuffix, keywords) {
				foundWithoutSuffix = true
				break
			}
		}

		if foundWithoutSuffix {
			continue
		}

		if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
			e.OtherPotentialMentions = append(e.OtherPotentialMentions, word[1:])
		} else if strings.ContainsAny(word, ".-:") {
			// This word contains a character that may be the end of a sentence, so split further
			splitWords := strings.FieldsFunc(word, func(c rune) bool {
				return c == '.' || c == '-' || c == ':'
			})

			for _, splitWord := range splitWords {
				if e.checkForMention(splitWord, keywords) {
					continue
				}
				if _, ok := systemMentions[splitWord]; !ok && strings.HasPrefix(splitWord, "@") {
					e.OtherPotentialMentions = append(e.OtherPotentialMentions, splitWord[1:])
				}
			}
		}
		if ids, match := isKeywordMultibyte(keywords, word); match {
			e.addMentionedUsers(ids)
		}
	}
}

// Create a message
func createNewPostEvent(a *App, post *model.Post, team *model.Team, channel *model.Channel, notification *postNotification, fchan store.StoreChannel, mentionedUsersList []string) *model.WebSocketEvent {
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
	return message
}

// Send or Register a notification as not sent based on user preference
func (a *App) sendOrRegisterNotification(id string, channelMemberNotifyPropsMap map[string]model.StringMap, wasMentioned bool, status *model.Status,
	post *model.Post, notification *postNotification, user *model.User, explicitMentions bool, channelWideMentions bool, replyToThreadType string) {

	if ShouldSendPushNotification(user, channelMemberNotifyPropsMap[id], wasMentioned, status, post) {
		a.sendPushNotification(
			notification,
			user,
			explicitMentions,
			channelWideMentions,
			replyToThreadType,
		)
	} else {
		// register that a notification was not sent
		a.NotificationsLog.Warn("Notification not sent",
			mlog.String("ackId", ""),
			mlog.String("type", model.PUSH_TYPE_MESSAGE),
			mlog.String("userId", id),
			mlog.String("postId", post.Id),
			mlog.String("status", model.PUSH_NOT_SENT),
		)
	}
}

func (a *App) getUserStatusOrDefault(id string) *model.Status {
	status, err := a.GetStatus(id)
	if err != nil {
		return &model.Status{UserId: id, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}
	return status
}

// Decide whether a user allows emails or not
func (a *App) shouldSendEmailNotificationToUser(id string, user *model.User, channelMemberNotifyPropsMap map[string]model.StringMap) bool {
	userAllowsEmails := user.NotifyProps[model.EMAIL_NOTIFY_PROP] != "false"
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
	if *a.Config().EmailSettings.RequireEmailVerification && !user.EmailVerified {
		mlog.Error(fmt.Sprintf("Skipped sending notification email to %v, address not verified. [details: user_id=%v]", user.Email, id))
		userAllowsEmails = false
	}
	return userAllowsEmails
}

// Notify the user that a system mentions wont be sent to the channel
func (a *App) sendChannelWideMentionsDisabledPost(sender *model.User, post *model.Post, hereNotification bool, channelNotification bool, allNotification bool) {

	T := utils.GetUserTranslations(sender.Locale)
	var message string
	if hereNotification {
		message = T("api.post.disabled_here", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel})
	} else if channelNotification {
		message = T("api.post.disabled_channel", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel})
	} else {
		message = T("api.post.disabled_all", map[string]interface{}{"Users": *a.Config().TeamSettings.MaxNotificationsPerChannel})
	}

	a.SendEphemeralPost(
		post.UserId,
		&model.Post{
			ChannelId: post.ChannelId,
			Message:   message,
			CreateAt:  post.CreateAt + 1,
		},
	)
}

// Get a map of mentioned user in Direct channels
func (a *App) getMentionedUsersFromDirectChannel(mentionedUserIds map[string]bool, post *model.Post, channel *model.Channel, profileMap map[string]*model.User) map[string]bool {
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
	return mentionedUserIds
}

// Get a active and mentioned users from all channels
func (a *App) getMentionedUsersFromOtherChannels(post *model.Post, m *ExplicitMentions, profileMap map[string]*model.User, mentionedUserIds map[string]bool, team *model.Team,
	parentPostList *model.PostList, channel *model.Channel, sender *model.User, channelMemberNotifyPropsMap map[string]model.StringMap, allActivityPushUserIds []string) ([]string, map[string]bool, map[string]model.StringMap, error) {
	// Add an implicit mention when a user is added to a channel
	// even if the user has set 'username mentions' to false in account settings.
	var threadMentionedUserIds map[string]string

	if post.Type == model.POST_ADD_TO_CHANNEL {
		val := post.Props[model.POST_PROPS_ADDED_USER_ID]
		if val != nil {
			uid := val.(string)
			m.MentionedUserIds[uid] = true
		}
	}

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
			channelMentions := model.UserSlice(result.Data.([]*model.User)).FilterByActive(true)

			var outOfChannelMentions model.UserSlice
			var outOfGroupsMentions model.UserSlice

			if channel.IsGroupConstrained() {
				nonMemberIDs, err := a.FilterNonGroupChannelMembers(channelMentions.IDs(), channel)
				if err != nil {
					return nil, nil, nil, err
				}

				outOfChannelMentions = channelMentions.FilterWithoutID(nonMemberIDs)
				outOfGroupsMentions = channelMentions.FilterByID(nonMemberIDs)
			} else {
				outOfChannelMentions = channelMentions
			}

			if channel.Type != model.CHANNEL_GROUP {
				a.Srv.Go(func() {
					a.sendOutOfChannelMentions(sender, post, outOfChannelMentions, outOfGroupsMentions)
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
	return allActivityPushUserIds, mentionedUserIds, channelMemberNotifyPropsMap, nil
}

// Send Push Notifications based on mentioned or active users
func (a *App) sendPushNotifications(mentionedUsersList []string, profileMap map[string]*model.User, threadMentionedUserIds map[string]string, post *model.Post, notification *postNotification,
	mentionedUserIds map[string]bool, hereNotification bool, channelNotification bool, allNotification bool, channelMemberNotifyPropsMap map[string]model.StringMap, allActivityPushUserIds []string) {
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
			status := a.getUserStatusOrDefault(id)
			replyToThreadType := ""
			if value, ok := threadMentionedUserIds[id]; ok {
				replyToThreadType = value
			}
			a.sendOrRegisterNotification(
				id,
				channelMemberNotifyPropsMap,
				true,
				status,
				post,
				notification,
				profileMap[id],
				mentionedUserIds[id],
				(channelNotification || hereNotification || allNotification),
				replyToThreadType,
			)
		}

		for _, id := range allActivityPushUserIds {
			if profileMap[id] == nil {
				continue
			}

			if _, ok := mentionedUserIds[id]; !ok {
				status := a.getUserStatusOrDefault(id)
				a.sendOrRegisterNotification(
					id,
					channelMemberNotifyPropsMap,
					true,
					status,
					post,
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

// Send Email Notifications
func (a *App) sendEmailNotifications(mentionedUsersList []string, profileMap map[string]*model.User, channelMemberNotifyPropsMap map[string]model.StringMap, post *model.Post, notification *postNotification, team *model.Team) {
	for _, id := range mentionedUsersList {
		if profileMap[id] == nil {
			continue
		}
		shouldSendEmail := a.shouldSendEmailNotificationToUser(id, profileMap[id], channelMemberNotifyPropsMap)
		status := a.getUserStatusOrDefault(id)
		autoResponderRelated := status.Status == model.STATUS_OUT_OF_OFFICE || post.Type == model.POST_AUTO_RESPONDER

		if shouldSendEmail && status.Status != model.STATUS_ONLINE && profileMap[id].DeleteAt == 0 && !autoResponderRelated {
			a.sendNotificationEmail(notification, profileMap[id], team)
		}
	}
}

func (a *App) SendNotifications(post *model.Post, team *model.Team, channel *model.Channel, sender *model.User, parentPostList *model.PostList) ([]string, error) {
	// Do not send notifications in archived channels
	if channel.DeleteAt > 0 {
		return []string{}, nil
	}

	pchan := a.Srv.Store.User().GetAllProfilesInChannel(channel.Id, true)
	cmnchan := a.Srv.Store.Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
	var fchan store.StoreChannel

	if len(post.FileIds) != 0 {
		fchan = make(chan store.StoreResult, 1)
		go func() {
			fileInfos, err := a.Srv.Store.FileInfo().GetForPost(post.Id, true, true)
			fchan <- store.StoreResult{Data: fileInfos, Err: err}
			close(fchan)
		}()
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

		mentionedUserIds = a.getMentionedUsersFromDirectChannel(mentionedUserIds, post, channel, profileMap)

	} else {

		keywords := a.getMentionKeywordsInChannel(profileMap, post.Type != model.POST_HEADER_CHANGE && post.Type != model.POST_PURPOSE_CHANGE, channelMemberNotifyPropsMap)
		m := getExplicitMentions(post, keywords)
		mentionedUserIds, hereNotification, channelNotification, allNotification = m.MentionedUserIds, m.HereMentioned, m.ChannelMentioned, m.AllMentioned

		var err error
		allActivityPushUserIds, mentionedUserIds, channelMemberNotifyPropsMap, err = a.getMentionedUsersFromOtherChannels(post, m, profileMap, mentionedUserIds, team, parentPostList, channel, sender, channelMemberNotifyPropsMap, allActivityPushUserIds)
		if err != nil {
			return nil, err
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
		a.sendEmailNotifications(mentionedUsersList, profileMap, channelMemberNotifyPropsMap, post, notification, team)
	}
	// If the channel has more than 1K users then notify the user that the system notification wont be sent
	if int64(len(profileMap)) > *a.Config().TeamSettings.MaxNotificationsPerChannel {
		a.sendChannelWideMentionsDisabledPost(sender, post, hereNotification, channelNotification, allNotification)
	}

	// Make sure all mention updates are complete to prevent race
	// Probably better to batch these DB updates in the future
	// MUST be completed before push notifications send
	for _, uchan := range updateMentionChans {
		if result := <-uchan; result.Err != nil {
			mlog.Warn(fmt.Sprintf("Failed to update mention count, post_id=%v channel_id=%v err=%v", post.Id, post.ChannelId, result.Err), mlog.String("post_id", post.Id))
		}
	}

	// Decide whether a notification should be sent or should be registered as not sent
	a.sendPushNotifications(mentionedUsersList, profileMap, threadMentionedUserIds, post, notification, mentionedUserIds, hereNotification, channelNotification, allNotification, channelMemberNotifyPropsMap, allActivityPushUserIds)

	message := createNewPostEvent(a, post, team, channel, notification, fchan, mentionedUsersList)

	a.Publish(message)
	return mentionedUsersList, nil
}

func (a *App) sendOutOfChannelMentions(sender *model.User, post *model.Post, outOfChannelUsers, outOfGroupsUsers []*model.User) *model.AppError {
	if len(outOfChannelUsers) == 0 && len(outOfGroupsUsers) == 0 {
		return nil
	}

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
func getExplicitMentions(post *model.Post, keywords map[string][]string) *ExplicitMentions {
	ret := &ExplicitMentions{
		MentionedUserIds: make(map[string]bool),
	}

	buf := ""
	mentionsEnabledFields := getMentionsEnabledFields(post)
	for _, message := range mentionsEnabledFields {
		markdown.Inspect(message, func(node interface{}) bool {
			text, ok := node.(*markdown.Text)
			if !ok {
				ret.processText(buf, keywords)
				buf = ""
				return true
			}
			buf += text.Text
			return false
		})
	}
	ret.processText(buf, keywords)

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

// Given a map of user IDs to profiles, returns a list of mention
// keywords for all users in the channel.
func (a *App) getMentionKeywordsInChannel(profiles map[string]*model.User, lookForSpecialMentions bool, channelMemberNotifyPropsMap map[string]model.StringMap) map[string][]string {
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

// Returns the name of the channel for this notification. For direct messages, this is the sender's name
// preceeded by an at sign. For group messages, this is a comma-separated list of the members of the
// channel, with an option to exclude the recipient of the message from that list.
func (n *postNotification) GetChannelName(userNameFormat string, excludeId string) string {
	switch n.channel.Type {
	case model.CHANNEL_DIRECT:
		return n.sender.GetDisplayName(userNameFormat)
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
