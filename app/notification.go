// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"html"
	"html/template"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/nicksnyder/go-i18n/i18n"
)

func (a *App) SendNotifications(post *model.Post, team *model.Team, channel *model.Channel, sender *model.User, parentPostList *model.PostList) ([]string, *model.AppError) {
	pchan := a.Srv.Store.User().GetAllProfilesInChannel(channel.Id, true)
	cmnchan := a.Srv.Store.Channel().GetAllChannelMembersNotifyPropsForChannel(channel.Id, true)
	var fchan store.StoreChannel

	if len(post.FileIds) != 0 {
		fchan = a.Srv.Store.FileInfo().GetForPost(post.Id, true, true)
	}

	var profileMap map[string]*model.User
	if result := <-pchan; result.Err != nil {
		return nil, result.Err
	} else {
		profileMap = result.Data.(map[string]*model.User)
	}

	var channelMemberNotifyPropsMap map[string]model.StringMap
	if result := <-cmnchan; result.Err != nil {
		return nil, result.Err
	} else {
		channelMemberNotifyPropsMap = result.Data.(map[string]model.StringMap)
	}

	mentionedUserIds := make(map[string]bool)
	allActivityPushUserIds := []string{}
	hereNotification := false
	channelNotification := false
	allNotification := false
	updateMentionChans := []store.StoreChannel{}

	if channel.Type == model.CHANNEL_DIRECT {
		var otherUserId string
		if userIds := strings.Split(channel.Name, "__"); userIds[0] == post.UserId {
			otherUserId = userIds[1]
		} else {
			otherUserId = userIds[0]
		}

		if _, ok := profileMap[otherUserId]; ok {
			mentionedUserIds[otherUserId] = true
		}

		if post.Props["from_webhook"] == "true" {
			mentionedUserIds[post.UserId] = true
		}
	} else {
		keywords := a.GetMentionKeywordsInChannel(profileMap, post.Type != model.POST_HEADER_CHANGE && post.Type != model.POST_PURPOSE_CHANGE)

		var potentialOtherMentions []string
		mentionedUserIds, potentialOtherMentions, hereNotification, channelNotification, allNotification = GetExplicitMentions(post.Message, keywords)

		// get users that have comment thread mentions enabled
		if len(post.RootId) > 0 && parentPostList != nil {
			for _, threadPost := range parentPostList.Posts {
				profile := profileMap[threadPost.UserId]
				if profile != nil && (profile.NotifyProps["comments"] == "any" || (profile.NotifyProps["comments"] == "root" && threadPost.Id == parentPostList.Order[0])) {
					mentionedUserIds[threadPost.UserId] = true
				}
			}
		}

		// prevent the user from mentioning themselves
		if post.Props["from_webhook"] != "true" {
			delete(mentionedUserIds, post.UserId)
		}

		if len(potentialOtherMentions) > 0 {
			if result := <-a.Srv.Store.User().GetProfilesByUsernames(potentialOtherMentions, team.Id); result.Err == nil {
				outOfChannelMentions := result.Data.([]*model.User)
				if channel.Type != model.CHANNEL_GROUP {
					a.Go(func() {
						a.sendOutOfChannelMentions(sender, post, channel.Type, outOfChannelMentions)
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

	senderName := ""
	channelName := ""
	if post.IsSystemMessage() {
		senderName = utils.T("system.message.name")
	} else {
		if value, ok := post.Props["override_username"]; ok && post.Props["from_webhook"] == "true" {
			senderName = value.(string)
		} else {
			senderName = sender.Username
		}
	}

	if channel.Type == model.CHANNEL_GROUP {
		userList := []*model.User{}
		for _, u := range profileMap {
			if u.Id != sender.Id {
				userList = append(userList, u)
			}
		}
		userList = append(userList, sender)
		channelName = model.GetGroupDisplayNameFromUsers(userList, false)
	} else {
		channelName = channel.DisplayName
	}

	var senderUsername string
	if value, ok := post.Props["override_username"]; ok && post.Props["from_webhook"] == "true" {
		senderUsername = value.(string)
	} else {
		senderUsername = sender.Username
	}

	if a.Config().EmailSettings.SendEmailNotifications {
		for _, id := range mentionedUsersList {
			userAllowsEmails := profileMap[id].NotifyProps[model.EMAIL_NOTIFY_PROP] != "false"
			if channelEmail, ok := channelMemberNotifyPropsMap[id][model.EMAIL_NOTIFY_PROP]; ok {
				if channelEmail != model.CHANNEL_NOTIFY_DEFAULT {
					userAllowsEmails = channelEmail != "false"
				}
			}

			//If email verification is required and user email is not verified don't send email.
			if a.Config().EmailSettings.RequireEmailVerification && !profileMap[id].EmailVerified {
				l4g.Error("Skipped sending notification email to %v, address not verified. [details: user_id=%v]", profileMap[id].Email, id)
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

			if userAllowsEmails && status.Status != model.STATUS_ONLINE && profileMap[id].DeleteAt == 0 {
				a.sendNotificationEmail(post, profileMap[id], channel, team, senderName, sender)
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
			l4g.Warn(utils.T("api.post.update_mention_count_and_forget.update_error"), post.Id, post.ChannelId, result.Err)
		}
	}

	sendPushNotifications := false
	if *a.Config().EmailSettings.SendPushNotifications {
		pushServer := *a.Config().EmailSettings.PushNotificationServer
		if pushServer == model.MHPNS && (!utils.IsLicensed() || !*utils.License().Features.MHPNS) {
			l4g.Warn(utils.T("api.post.send_notifications_and_forget.push_notification.mhpnsWarn"))
			sendPushNotifications = false
		} else {
			sendPushNotifications = true
		}
	}

	if sendPushNotifications {
		for _, id := range mentionedUsersList {
			var status *model.Status
			var err *model.AppError
			if status, err = a.GetStatus(id); err != nil {
				status = &model.Status{UserId: id, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
			}

			if ShouldSendPushNotification(profileMap[id], channelMemberNotifyPropsMap[id], true, status, post) {
				a.sendPushNotification(post, profileMap[id], channel, senderName, channelName, true)
			}
		}

		for _, id := range allActivityPushUserIds {
			if _, ok := mentionedUserIds[id]; !ok {
				var status *model.Status
				var err *model.AppError
				if status, err = a.GetStatus(id); err != nil {
					status = &model.Status{UserId: id, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
				}

				if ShouldSendPushNotification(profileMap[id], channelMemberNotifyPropsMap[id], false, status, post) {
					a.sendPushNotification(post, profileMap[id], channel, senderName, channelName, false)
				}
			}
		}
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POSTED, "", post.ChannelId, "", nil)
	message.Add("post", post.ToJson())
	message.Add("channel_type", channel.Type)
	message.Add("channel_display_name", channelName)
	message.Add("channel_name", channel.Name)
	message.Add("sender_name", senderUsername)
	message.Add("team_id", team.Id)

	if len(post.FileIds) != 0 && fchan != nil {
		message.Add("otherFile", "true")

		var infos []*model.FileInfo
		if result := <-fchan; result.Err != nil {
			l4g.Warn(utils.T("api.post.send_notifications.files.error"), post.Id, result.Err)
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

func (a *App) sendNotificationEmail(post *model.Post, user *model.User, channel *model.Channel, team *model.Team, senderName string, sender *model.User) *model.AppError {
	if channel.IsGroupOrDirect() {
		if result := <-a.Srv.Store.Team().GetTeamsByUserId(user.Id); result.Err != nil {
			return result.Err
		} else {
			// if the recipient isn't in the current user's team, just pick one
			teams := result.Data.([]*model.Team)
			found := false

			for i := range teams {
				if teams[i].Id == team.Id {
					found = true
					break
				}
			}

			if !found && len(teams) > 0 {
				team = teams[0]
			} else {
				// in case the user hasn't joined any teams we send them to the select_team page
				team = &model.Team{Name: "select_team", DisplayName: a.Config().TeamSettings.SiteName}
			}
		}
	}
	if *a.Config().EmailSettings.EnableEmailBatching {
		var sendBatched bool
		if result := <-a.Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL); result.Err != nil {
			// if the call fails, assume that the interval has not been explicitly set and batch the notifications
			sendBatched = true
		} else {
			// if the user has chosen to receive notifications immediately, don't batch them
			sendBatched = result.Data.(model.Preference).Value != model.PREFERENCE_EMAIL_INTERVAL_NO_BATCHING_SECONDS
		}

		if sendBatched {
			if err := a.AddNotificationEmailToBatch(user, post, team); err == nil {
				return nil
			}
		}

		// fall back to sending a single email if we can't batch it for some reason
	}

	translateFunc := utils.GetUserTranslations(user.Locale)

	var subjectText string
	if channel.Type == model.CHANNEL_DIRECT {
		subjectText = getDirectMessageNotificationEmailSubject(post, translateFunc, a.Config().TeamSettings.SiteName, senderName)
	} else if *a.Config().EmailSettings.UseChannelInEmailNotifications {
		subjectText = getNotificationEmailSubject(post, translateFunc, a.Config().TeamSettings.SiteName, team.DisplayName+" ("+channel.DisplayName+")")
	} else {
		subjectText = getNotificationEmailSubject(post, translateFunc, a.Config().TeamSettings.SiteName, team.DisplayName)
	}

	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	if utils.IsLicensed() && *utils.License().Features.EmailNotificationContents {
		emailNotificationContentsType = *a.Config().EmailSettings.EmailNotificationContentsType
	}

	teamURL := utils.GetSiteURL() + "/" + team.Name
	var bodyText = a.getNotificationEmailBody(user, post, channel, senderName, team.Name, teamURL, emailNotificationContentsType, translateFunc)

	a.Go(func() {
		if err := a.SendMail(user.Email, html.UnescapeString(subjectText), bodyText); err != nil {
			l4g.Error(utils.T("api.post.send_notifications_and_forget.send.error"), user.Email, err)
		}
	})

	if a.Metrics != nil {
		a.Metrics.IncrementPostSentEmail()
	}

	return nil
}

/**
 * Computes the subject line for direct notification email messages
 */
func getDirectMessageNotificationEmailSubject(post *model.Post, translateFunc i18n.TranslateFunc, siteName string, senderName string) string {
	t := getFormattedPostTime(post, translateFunc)
	var subjectParameters = map[string]interface{}{
		"SiteName":          siteName,
		"SenderDisplayName": senderName,
		"Month":             t.Month,
		"Day":               t.Day,
		"Year":              t.Year,
	}
	return translateFunc("app.notification.subject.direct.full", subjectParameters)
}

/**
 * Computes the subject line for group, public, and private email messages
 */
func getNotificationEmailSubject(post *model.Post, translateFunc i18n.TranslateFunc, siteName string, teamName string) string {
	t := getFormattedPostTime(post, translateFunc)
	var subjectParameters = map[string]interface{}{
		"SiteName": siteName,
		"TeamName": teamName,
		"Month":    t.Month,
		"Day":      t.Day,
		"Year":     t.Year,
	}
	return translateFunc("app.notification.subject.notification.full", subjectParameters)
}

/**
 * Computes the email body for notification messages
 */
func (a *App) getNotificationEmailBody(recipient *model.User, post *model.Post, channel *model.Channel, senderName string, teamName string, teamURL string, emailNotificationContentsType string, translateFunc i18n.TranslateFunc) string {
	// only include message contents in notification email if email notification contents type is set to full
	var bodyPage *utils.HTMLTemplate
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		bodyPage = a.NewEmailTemplate("post_body_full", recipient.Locale)
		bodyPage.Props["PostMessage"] = a.GetMessageForNotification(post, translateFunc)
	} else {
		bodyPage = a.NewEmailTemplate("post_body_generic", recipient.Locale)
	}

	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
	if teamName != "select_team" {
		bodyPage.Props["TeamLink"] = teamURL + "/pl/" + post.Id
	} else {
		bodyPage.Props["TeamLink"] = teamURL
	}

	var channelName = channel.DisplayName
	if channel.Type == model.CHANNEL_GROUP {
		channelName = translateFunc("api.templates.channel_name.group")
	}
	t := getFormattedPostTime(post, translateFunc)

	var bodyText string
	var info template.HTML
	if channel.Type == model.CHANNEL_DIRECT {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			bodyText = translateFunc("app.notification.body.intro.direct.full")
			info = utils.TranslateAsHtml(translateFunc, "app.notification.body.text.direct.full",
				map[string]interface{}{
					"SenderName": senderName,
					"Hour":       t.Hour,
					"Minute":     t.Minute,
					"TimeZone":   t.TimeZone,
					"Month":      t.Month,
					"Day":        t.Day,
				})
		} else {
			bodyText = translateFunc("app.notification.body.intro.direct.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			info = utils.TranslateAsHtml(translateFunc, "app.notification.body.text.direct.generic",
				map[string]interface{}{
					"Hour":     t.Hour,
					"Minute":   t.Minute,
					"TimeZone": t.TimeZone,
					"Month":    t.Month,
					"Day":      t.Day,
				})
		}
	} else {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			bodyText = translateFunc("app.notification.body.intro.notification.full")
			info = utils.TranslateAsHtml(translateFunc, "app.notification.body.text.notification.full",
				map[string]interface{}{
					"ChannelName": channelName,
					"SenderName":  senderName,
					"Hour":        t.Hour,
					"Minute":      t.Minute,
					"TimeZone":    t.TimeZone,
					"Month":       t.Month,
					"Day":         t.Day,
				})
		} else {
			bodyText = translateFunc("app.notification.body.intro.notification.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			info = utils.TranslateAsHtml(translateFunc, "app.notification.body.text.notification.generic",
				map[string]interface{}{
					"Hour":     t.Hour,
					"Minute":   t.Minute,
					"TimeZone": t.TimeZone,
					"Month":    t.Month,
					"Day":      t.Day,
				})
		}
	}

	bodyPage.Props["BodyText"] = bodyText
	bodyPage.Html["Info"] = info
	bodyPage.Props["Button"] = translateFunc("api.templates.post_body.button")

	return bodyPage.Render()
}

type formattedPostTime struct {
	Time     time.Time
	Year     string
	Month    string
	Day      string
	Hour     string
	Minute   string
	TimeZone string
}

func getFormattedPostTime(post *model.Post, translateFunc i18n.TranslateFunc) formattedPostTime {
	tm := time.Unix(post.CreateAt/1000, 0)
	zone, _ := tm.Zone()

	return formattedPostTime{
		Time:     tm,
		Year:     fmt.Sprintf("%d", tm.Year()),
		Month:    translateFunc(tm.Month().String()),
		Day:      fmt.Sprintf("%d", tm.Day()),
		Hour:     fmt.Sprintf("%02d", tm.Hour()),
		Minute:   fmt.Sprintf("%02d", tm.Minute()),
		TimeZone: zone,
	}
}

func (a *App) GetMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string {
	if len(strings.TrimSpace(post.Message)) != 0 || len(post.FileIds) == 0 {
		return post.Message
	}

	// extract the filenames from their paths and determine what type of files are attached
	var infos []*model.FileInfo
	if result := <-a.Srv.Store.FileInfo().GetForPost(post.Id, true, true); result.Err != nil {
		l4g.Warn(utils.T("api.post.get_message_for_notification.get_files.error"), post.Id, result.Err)
	} else {
		infos = result.Data.([]*model.FileInfo)
	}

	filenames := make([]string, len(infos))
	onlyImages := true
	for i, info := range infos {
		if escaped, err := url.QueryUnescape(filepath.Base(info.Name)); err != nil {
			// this should never error since filepath was escaped using url.QueryEscape
			filenames[i] = escaped
		} else {
			filenames[i] = info.Name
		}

		onlyImages = onlyImages && info.IsImage()
	}

	props := map[string]interface{}{"Filenames": strings.Join(filenames, ", ")}

	if onlyImages {
		return translateFunc("api.post.get_message_for_notification.images_sent", len(filenames), props)
	} else {
		return translateFunc("api.post.get_message_for_notification.files_sent", len(filenames), props)
	}
}

func (a *App) sendPushNotification(post *model.Post, user *model.User, channel *model.Channel, senderName, channelName string, wasMentioned bool) *model.AppError {
	sessions, err := a.getMobileAppSessions(user.Id)
	if err != nil {
		return err
	}

	if channel.Type == model.CHANNEL_DIRECT {
		channelName = senderName
	}

	userLocale := utils.GetUserTranslations(user.Locale)

	msg := model.PushNotification{}
	if badge := <-a.Srv.Store.User().GetUnreadCount(user.Id); badge.Err != nil {
		msg.Badge = 1
		l4g.Error(utils.T("store.sql_user.get_unread_count.app_error"), user.Id, badge.Err)
	} else {
		msg.Badge = int(badge.Data.(int64))
	}

	msg.Type = model.PUSH_TYPE_MESSAGE
	msg.TeamId = channel.TeamId
	msg.ChannelId = channel.Id
	msg.PostId = post.Id
	msg.RootId = post.RootId
	msg.ChannelName = channel.Name
	msg.SenderId = post.UserId

	if ou, ok := post.Props["override_username"]; ok && ou != nil {
		msg.OverrideUsername = ou.(string)
	}

	if oi, ok := post.Props["override_icon_url"]; ok && oi != nil {
		msg.OverrideIconUrl = oi.(string)
	}

	if fw, ok := post.Props["from_webhook"]; ok && fw != nil {
		msg.FromWebhook = fw.(string)
	}

	if *a.Config().EmailSettings.PushNotificationContents == model.FULL_NOTIFICATION {
		msg.Category = model.CATEGORY_CAN_REPLY
		if channel.Type == model.CHANNEL_DIRECT {
			msg.Message = senderName + ": " + model.ClearMentionTags(post.Message)
		} else {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_in") + channelName + ": " + model.ClearMentionTags(post.Message)
		}
	} else if *a.Config().EmailSettings.PushNotificationContents == model.GENERIC_NO_CHANNEL_NOTIFICATION {
		if channel.Type == model.CHANNEL_DIRECT {
			msg.Category = model.CATEGORY_CAN_REPLY
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_message")
		} else if wasMentioned || channel.Type == model.CHANNEL_GROUP {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_mention_no_channel")
		} else {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_non_mention_no_channel")
		}
	} else {
		if channel.Type == model.CHANNEL_DIRECT {
			msg.Category = model.CATEGORY_CAN_REPLY
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_message")
		} else if wasMentioned || channel.Type == model.CHANNEL_GROUP {
			msg.Category = model.CATEGORY_CAN_REPLY
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_mention") + channelName
		} else {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_non_mention") + channelName
		}
	}

	// If the post only has images then push an appropriate message
	if len(post.Message) == 0 && post.FileIds != nil && len(post.FileIds) > 0 {
		if channel.Type == model.CHANNEL_DIRECT {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_image_only_dm")
		} else {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_image_only") + channelName
		}
	}

	//l4g.Debug("Sending push notification for user %v with msg of '%v'", user.Id, msg.Message)

	for _, session := range sessions {
		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)

		l4g.Debug("Sending push notification to device %v for user %v with msg of '%v'", tmpMessage.DeviceId, user.Id, msg.Message)

		a.Go(func(session *model.Session) func() {
			return func() {
				a.sendToPushProxy(tmpMessage, session)
			}
		}(session))

		if a.Metrics != nil {
			a.Metrics.IncrementPostSentPush()
		}
	}

	return nil
}

func (a *App) ClearPushNotification(userId string, channelId string) {
	a.Go(func() {
		// Sleep is to allow the read replicas a chance to fully sync
		// the unread count for sending an accurate count.
		// Delaying a little doesn't hurt anything and is cheaper than
		// attempting to read from master.
		time.Sleep(time.Second * 5)

		sessions, err := a.getMobileAppSessions(userId)
		if err != nil {
			l4g.Error(err.Error())
			return
		}

		msg := model.PushNotification{}
		msg.Type = model.PUSH_TYPE_CLEAR
		msg.ChannelId = channelId
		msg.ContentAvailable = 0
		if badge := <-a.Srv.Store.User().GetUnreadCount(userId); badge.Err != nil {
			msg.Badge = 0
			l4g.Error(utils.T("store.sql_user.get_unread_count.app_error"), userId, badge.Err)
		} else {
			msg.Badge = int(badge.Data.(int64))
		}

		l4g.Debug(utils.T("api.post.send_notifications_and_forget.clear_push_notification.debug"), msg.DeviceId, msg.ChannelId)

		for _, session := range sessions {
			tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
			tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
			a.Go(func() {
				a.sendToPushProxy(tmpMessage, session)
			})
		}
	})
}

func (a *App) sendToPushProxy(msg model.PushNotification, session *model.Session) {
	msg.ServerId = utils.CfgDiagnosticId

	request, _ := http.NewRequest("POST", *a.Config().EmailSettings.PushNotificationServer+model.API_URL_SUFFIX_V1+"/send_push", strings.NewReader(msg.ToJson()))

	if resp, err := a.HTTPClient(true).Do(request); err != nil {
		l4g.Error("Device push reported as error for UserId=%v SessionId=%v message=%v", session.UserId, session.Id, err.Error())
	} else {
		pushResponse := model.PushResponseFromJson(resp.Body)
		if resp.Body != nil {
			consumeAndClose(resp)
		}

		if pushResponse[model.PUSH_STATUS] == model.PUSH_STATUS_REMOVE {
			l4g.Info("Device was reported as removed for UserId=%v SessionId=%v removing push for this session", session.UserId, session.Id)
			a.AttachDeviceId(session.Id, "", session.ExpiresAt)
			a.ClearSessionCacheForUser(session.UserId)
		}

		if pushResponse[model.PUSH_STATUS] == model.PUSH_STATUS_FAIL {
			l4g.Error("Device push reported as error for UserId=%v SessionId=%v message=%v", session.UserId, session.Id, pushResponse[model.PUSH_STATUS_ERROR_MSG])
		}
	}
}

func (a *App) getMobileAppSessions(userId string) ([]*model.Session, *model.AppError) {
	if result := <-a.Srv.Store.Session().GetSessionsWithActiveDeviceIds(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Session), nil
	}
}

func (a *App) sendOutOfChannelMentions(sender *model.User, post *model.Post, channelType string, users []*model.User) *model.AppError {
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

	var localePhrase string
	if channelType == model.CHANNEL_OPEN {
		localePhrase = T("api.post.check_for_out_of_channel_mentions.link.public")
	} else if channelType == model.CHANNEL_PRIVATE {
		localePhrase = T("api.post.check_for_out_of_channel_mentions.link.private")
	}

	ephemeralPostId := model.NewId()
	var message string
	if len(users) == 1 {
		message = T("api.post.check_for_out_of_channel_mentions.message.one", map[string]interface{}{
			"Username": usernames[0],
			"Phrase":   localePhrase,
		})
	} else {
		message = T("api.post.check_for_out_of_channel_mentions.message.multiple", map[string]interface{}{
			"Usernames":    strings.Join(usernames[:len(usernames)-1], ", @"),
			"LastUsername": usernames[len(usernames)-1],
			"Phrase":       localePhrase,
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

// Given a message and a map mapping mention keywords to the users who use them, returns a map of mentioned
// users and a slice of potential mention users not in the channel and whether or not @here was mentioned.
func GetExplicitMentions(message string, keywords map[string][]string) (map[string]bool, []string, bool, bool, bool) {
	mentioned := make(map[string]bool)
	potentialOthersMentioned := make([]string, 0)
	systemMentions := map[string]bool{"@here": true, "@channel": true, "@all": true}
	hereMentioned := false
	allMentioned := false
	channelMentioned := false

	addMentionedUsers := func(ids []string) {
		for _, id := range ids {
			mentioned[id] = true
		}
	}

	message = removeCodeFromMessage(message)

	for _, word := range strings.FieldsFunc(message, func(c rune) bool {
		// Split on any whitespace or punctuation that can't be part of an at mention or emoji pattern
		return !(c == ':' || c == '.' || c == '-' || c == '_' || c == '@' || unicode.IsLetter(c) || unicode.IsNumber(c))
	}) {
		isMention := false

		// skip word with format ':word:' with an assumption that it is an emoji format only
		if word[0] == ':' && word[len(word)-1] == ':' {
			continue
		}

		if word == "@here" {
			hereMentioned = true
		}

		if word == "@channel" {
			channelMentioned = true
		}

		if word == "@all" {
			allMentioned = true
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

		if isMention {
			continue
		}

		if strings.ContainsAny(word, ".-:") {
			// This word contains a character that may be the end of a sentence, so split further
			splitWords := strings.FieldsFunc(word, func(c rune) bool {
				return c == '.' || c == '-' || c == ':'
			})

			for _, splitWord := range splitWords {
				if splitWord == "@here" {
					hereMentioned = true
				}

				if splitWord == "@all" {
					allMentioned = true
				}

				if splitWord == "@channel" {
					channelMentioned = true
				}

				// Non-case-sensitive check for regular keys
				if ids, match := keywords[strings.ToLower(splitWord)]; match {
					addMentionedUsers(ids)
				}

				// Case-sensitive check for first name
				if ids, match := keywords[splitWord]; match {
					addMentionedUsers(ids)
				} else if _, ok := systemMentions[splitWord]; !ok && strings.HasPrefix(splitWord, "@") {
					username := splitWord[1:]
					potentialOthersMentioned = append(potentialOthersMentioned, username)
				}
			}
		}

		if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
			username := word[1:]
			potentialOthersMentioned = append(potentialOthersMentioned, username)
		}
	}

	return mentioned, potentialOthersMentioned, hereMentioned, channelMentioned, allMentioned
}

// Matches a line containing only ``` and a potential language definition, any number of lines not containing ```,
// and then either a line containing only ``` or the end of the text
var codeBlockPattern = regexp.MustCompile("(?m)^[^\\S\n]*[\\`~]{3}.*$[\\s\\S]+?(^[^\\S\n]*[`~]{3}$|\\z)")

// Matches a backquote, either some text or any number of non-empty lines, and then a final backquote
var inlineCodePattern = regexp.MustCompile("(?m)\\`+(?:.+?|.*?\n(.*?\\S.*?\n)*.*?)\\`+")

// Strips pre-formatted text and code blocks from a Markdown string by replacing them with whitespace
func removeCodeFromMessage(message string) string {
	if strings.Contains(message, "```") || strings.Contains(message, "~~~") {
		message = codeBlockPattern.ReplaceAllString(message, "")
	}

	// Replace with a space to prevent cases like "user`code`name" from turning into "username"
	if strings.Contains(message, "`") {
		message = inlineCodePattern.ReplaceAllString(message, " ")
	}

	return message
}

// Given a map of user IDs to profiles, returns a list of mention
// keywords for all users in the channel.
func (a *App) GetMentionKeywordsInChannel(profiles map[string]*model.User, lookForSpecialMentions bool) map[string][]string {
	keywords := make(map[string][]string)

	for id, profile := range profiles {
		userMention := "@" + strings.ToLower(profile.Username)
		keywords[userMention] = append(keywords[userMention], id)

		if len(profile.NotifyProps["mention_keys"]) > 0 {
			// Add all the user's mention keys
			splitKeys := strings.Split(profile.NotifyProps["mention_keys"], ",")
			for _, k := range splitKeys {
				// note that these are made lower case so that we can do a case insensitive check for them
				key := strings.ToLower(k)
				keywords[key] = append(keywords[key], id)
			}
		}

		// If turned on, add the user's case sensitive first name
		if profile.NotifyProps["first_name"] == "true" {
			keywords[profile.FirstName] = append(keywords[profile.FirstName], profile.Id)
		}

		// Add @channel and @all to keywords if user has them turned on
		if lookForSpecialMentions {
			if int64(len(profiles)) <= *a.Config().TeamSettings.MaxNotificationsPerChannel && profile.NotifyProps["channel"] == "true" {
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

func ShouldSendPushNotification(user *model.User, channelNotifyProps model.StringMap, wasMentioned bool, status *model.Status, post *model.Post) bool {
	return DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, wasMentioned) &&
		DoesStatusAllowPushNotification(user.NotifyProps, status, post.ChannelId)
}

func DoesNotifyPropsAllowPushNotification(user *model.User, channelNotifyProps model.StringMap, post *model.Post, wasMentioned bool) bool {
	userNotifyProps := user.NotifyProps
	userNotify := userNotifyProps[model.PUSH_NOTIFY_PROP]
	channelNotify, ok := channelNotifyProps[model.PUSH_NOTIFY_PROP]

	if post.IsSystemMessage() {
		return false
	}

	if channelNotify == model.USER_NOTIFY_NONE {
		return false
	}

	if channelNotify == model.CHANNEL_NOTIFY_MENTION && !wasMentioned {
		return false
	}

	if userNotify == model.USER_NOTIFY_MENTION && (!ok || channelNotify == model.CHANNEL_NOTIFY_DEFAULT) && !wasMentioned {
		return false
	}

	if (userNotify == model.USER_NOTIFY_ALL || channelNotify == model.CHANNEL_NOTIFY_ALL) &&
		(post.UserId != user.Id || post.Props["from_webhook"] == "true") {
		return true
	}

	if userNotify == model.USER_NOTIFY_NONE &&
		(!ok || channelNotify == model.CHANNEL_NOTIFY_DEFAULT) {
		return false
	}

	return true
}

func DoesStatusAllowPushNotification(userNotifyProps model.StringMap, status *model.Status, channelId string) bool {
	// If User status is DND return false right away
	if status.Status == model.STATUS_DND {
		return false
	}

	if pushStatus, ok := userNotifyProps["push_status"]; (pushStatus == model.STATUS_ONLINE || !ok) && (status.ActiveChannel != channelId || model.GetMillis()-status.LastActivityAt > model.STATUS_CHANNEL_TIMEOUT) {
		return true
	} else if pushStatus == model.STATUS_AWAY && (status.Status == model.STATUS_AWAY || status.Status == model.STATUS_OFFLINE) {
		return true
	} else if pushStatus == model.STATUS_OFFLINE && status.Status == model.STATUS_OFFLINE {
		return true
	}

	return false
}
