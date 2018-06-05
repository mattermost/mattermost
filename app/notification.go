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
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/markdown"
	"github.com/nicksnyder/go-i18n/i18n"
)

const (
	THREAD_ANY  = "any"
	THREAD_ROOT = "root"
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
			a.Go(func() {
				rootId := post.Id
				if post.RootId != "" && post.RootId != post.Id {
					rootId = post.RootId
				}
				a.SendAutoResponse(channel, otherUser, rootId)
			})
		}

	} else {
		keywords := a.GetMentionKeywordsInChannel(profileMap, post.Type != model.POST_HEADER_CHANGE && post.Type != model.POST_PURPOSE_CHANGE)

		m := GetExplicitMentions(post.Message, keywords)

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
				if profile != nil && (profile.NotifyProps["comments"] == THREAD_ANY || (profile.NotifyProps["comments"] == THREAD_ROOT && threadPost.Id == parentPostList.Order[0])) {
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
			if result := <-a.Srv.Store.User().GetProfilesByUsernames(m.OtherPotentialMentions, team.Id); result.Err == nil {
				outOfChannelMentions := result.Data.([]*model.User)
				if channel.Type != model.CHANNEL_GROUP {
					a.Go(func() {
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

	var senderUsername string
	senderName := ""
	channelName := ""
	if post.IsSystemMessage() {
		senderName = utils.T("system.message.name")
	} else {
		if value, ok := post.Props["override_username"]; ok && post.Props["from_webhook"] == "true" {
			senderName = value.(string)
			senderUsername = value.(string)
		} else {
			senderName = sender.Username
			senderUsername = sender.Username
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

	if a.Config().EmailSettings.SendEmailNotifications {
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
			if a.Config().EmailSettings.RequireEmailVerification && !profileMap[id].EmailVerified {
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
				a.sendNotificationEmail(post, profileMap[id], channel, team, channelName, senderName, sender)
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
			mlog.Warn("api.post.send_notifications_and_forget.push_notification.mhpnsWarn FIXME: NOT FOUND IN TRANSLATIONS FILE")
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
					post,
					profileMap[id],
					channel,
					channelName,
					sender,
					senderName,
					mentionedUserIds[id],
					(channelNotification || allNotification),
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
						post,
						profileMap[id],
						channel,
						channelName,
						sender,
						senderName,
						false,
						false,
						"",
					)
				}
			}
		}
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POSTED, "", post.ChannelId, "", nil)
	message.Add("post", a.PostWithProxyAddedToImageURLs(post).ToJson())
	message.Add("channel_type", channel.Type)
	message.Add("channel_display_name", channelName)
	message.Add("channel_name", channel.Name)
	message.Add("sender_name", senderUsername)
	message.Add("team_id", team.Id)

	if len(post.FileIds) != 0 && fchan != nil {
		message.Add("otherFile", "true")

		var infos []*model.FileInfo
		if result := <-fchan; result.Err != nil {
			mlog.Warn(fmt.Sprint("api.post.send_notifications.files.error FIXME: NOT FOUND IN TRANSLATIONS FILE", post.Id, result.Err), mlog.String("post_id", post.Id))
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

func (a *App) sendNotificationEmail(post *model.Post, user *model.User, channel *model.Channel, team *model.Team, channelName string, senderName string, sender *model.User) *model.AppError {
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

	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	if license := a.License(); license != nil && *license.Features.EmailNotificationContents {
		emailNotificationContentsType = *a.Config().EmailSettings.EmailNotificationContentsType
	}

	var subjectText string
	if channel.Type == model.CHANNEL_DIRECT {
		subjectText = getDirectMessageNotificationEmailSubject(post, translateFunc, a.Config().TeamSettings.SiteName, senderName)
	} else if channel.Type == model.CHANNEL_GROUP {
		subjectText = getGroupMessageNotificationEmailSubject(post, translateFunc, a.Config().TeamSettings.SiteName, channelName, emailNotificationContentsType)
	} else if *a.Config().EmailSettings.UseChannelInEmailNotifications {
		subjectText = getNotificationEmailSubject(post, translateFunc, a.Config().TeamSettings.SiteName, team.DisplayName+" ("+channel.DisplayName+")")
	} else {
		subjectText = getNotificationEmailSubject(post, translateFunc, a.Config().TeamSettings.SiteName, team.DisplayName)
	}

	teamURL := a.GetSiteURL() + "/" + team.Name
	var bodyText = a.getNotificationEmailBody(user, post, channel, channelName, senderName, team.Name, teamURL, emailNotificationContentsType, translateFunc)

	a.Go(func() {
		if err := a.SendMail(user.Email, html.UnescapeString(subjectText), bodyText); err != nil {
			mlog.Error(fmt.Sprint("api.post.send_notifications_and_forget.send.error FIXME: NOT FOUND IN TRANSLATIONS FILE", user.Email, err))
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
 * Computes the subject line for group email messages
 */
func getGroupMessageNotificationEmailSubject(post *model.Post, translateFunc i18n.TranslateFunc, siteName string, channelName string, emailNotificationContentsType string) string {
	t := getFormattedPostTime(post, translateFunc)
	var subjectText string
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		var subjectParameters = map[string]interface{}{
			"SiteName":    siteName,
			"ChannelName": channelName,
			"Month":       t.Month,
			"Day":         t.Day,
			"Year":        t.Year,
		}
		subjectText = translateFunc("app.notification.subject.group_message.full", subjectParameters)
	} else {
		var subjectParameters = map[string]interface{}{
			"SiteName": siteName,
			"Month":    t.Month,
			"Day":      t.Day,
			"Year":     t.Year,
		}
		subjectText = translateFunc("app.notification.subject.group_message.generic", subjectParameters)
	}
	return subjectText
}

/**
 * Computes the email body for notification messages
 */
func (a *App) getNotificationEmailBody(recipient *model.User, post *model.Post, channel *model.Channel, channelName string, senderName string, teamName string, teamURL string, emailNotificationContentsType string, translateFunc i18n.TranslateFunc) string {
	// only include message contents in notification email if email notification contents type is set to full
	var bodyPage *utils.HTMLTemplate
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		bodyPage = a.NewEmailTemplate("post_body_full", recipient.Locale)
		bodyPage.Props["PostMessage"] = a.GetMessageForNotification(post, translateFunc)
	} else {
		bodyPage = a.NewEmailTemplate("post_body_generic", recipient.Locale)
	}

	bodyPage.Props["SiteURL"] = a.GetSiteURL()
	if teamName != "select_team" {
		bodyPage.Props["TeamLink"] = teamURL + "/pl/" + post.Id
	} else {
		bodyPage.Props["TeamLink"] = teamURL
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
	} else if channel.Type == model.CHANNEL_GROUP {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			bodyText = translateFunc("app.notification.body.intro.group_message.full")
			info = utils.TranslateAsHtml(translateFunc, "app.notification.body.text.group_message.full",
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
			bodyText = translateFunc("app.notification.body.intro.group_message.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			info = utils.TranslateAsHtml(translateFunc, "app.notification.body.text.group_message.generic",
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
		mlog.Warn(fmt.Sprintf("Encountered error when getting files for notification message, post_id=%v, err=%v", post.Id, result.Err), mlog.String("post_id", post.Id))
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

func (a *App) sendPushNotification(post *model.Post, user *model.User, channel *model.Channel, channelName string, sender *model.User, senderName string,
	explicitMention, channelWideMention bool, replyToThreadType string) *model.AppError {
	contentsConfig := *a.Config().EmailSettings.PushNotificationContents
	sessions, err := a.getMobileAppSessions(user.Id)
	if err != nil {
		return err
	}

	if channel.Type == model.CHANNEL_DIRECT {
		if senderName == utils.T("system.message.name") {
			channelName = senderName
		} else {
			preference, prefError := a.GetPreferenceByCategoryAndNameForUser(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "name_format")
			if prefError != nil {
				channelName = fmt.Sprintf("@%v", senderName)
			} else {
				channelName = fmt.Sprintf("@%v", sender.GetDisplayName(preference.Value))
				senderName = channelName
			}
		}
	}

	msg := model.PushNotification{}
	if badge := <-a.Srv.Store.User().GetUnreadCount(user.Id); badge.Err != nil {
		msg.Badge = 1
		mlog.Error(fmt.Sprint("We could not get the unread message count for the user", user.Id, badge.Err), mlog.String("user_id", user.Id))
	} else {
		msg.Badge = int(badge.Data.(int64))
	}

	msg.Type = model.PUSH_TYPE_MESSAGE
	msg.TeamId = channel.TeamId
	msg.ChannelId = channel.Id
	msg.PostId = post.Id
	msg.RootId = post.RootId
	msg.SenderId = post.UserId

	if contentsConfig != model.GENERIC_NO_CHANNEL_NOTIFICATION || channel.Type == model.CHANNEL_DIRECT {
		msg.ChannelName = channelName
	}

	if ou, ok := post.Props["override_username"].(string); ok {
		msg.OverrideUsername = ou
	}

	if oi, ok := post.Props["override_icon_url"].(string); ok {
		msg.OverrideIconUrl = oi
	}

	if fw, ok := post.Props["from_webhook"].(string); ok {
		msg.FromWebhook = fw
	}

	userLocale := utils.GetUserTranslations(user.Locale)
	hasFiles := post.FileIds != nil && len(post.FileIds) > 0

	msg.Message = a.getPushNotificationMessage(post.Message, explicitMention, channelWideMention, hasFiles, senderName, channelName, channel.Type, replyToThreadType, userLocale)

	for _, session := range sessions {
		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)

		mlog.Debug(fmt.Sprintf("Sending push notification to device %v for user %v with msg of '%v'", tmpMessage.DeviceId, user.Id, msg.Message), mlog.String("user_id", user.Id))

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

func (a *App) getPushNotificationMessage(postMessage string, explicitMention, channelWideMention, hasFiles bool,
	senderName, channelName, channelType, replyToThreadType string, userLocale i18n.TranslateFunc) string {
	message := ""

	contentsConfig := *a.Config().EmailSettings.PushNotificationContents

	if contentsConfig == model.FULL_NOTIFICATION {
		if channelType == model.CHANNEL_DIRECT {
			message = model.ClearMentionTags(postMessage)
		} else {
			message = "@" + senderName + ": " + model.ClearMentionTags(postMessage)
		}
	} else {
		if channelType == model.CHANNEL_DIRECT {
			message = userLocale("api.post.send_notifications_and_forget.push_message")
		} else if channelWideMention {
			message = "@" + senderName + userLocale("api.post.send_notification_and_forget.push_channel_mention")
		} else if explicitMention {
			message = "@" + senderName + userLocale("api.post.send_notifications_and_forget.push_explicit_mention")
		} else if replyToThreadType == THREAD_ROOT {
			message = "@" + senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_post")
		} else if replyToThreadType == THREAD_ANY {
			message = "@" + senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_thread")
		} else {
			message = "@" + senderName + userLocale("api.post.send_notifications_and_forget.push_general_message")
		}
	}

	// If the post only has images then push an appropriate message
	if len(postMessage) == 0 && hasFiles {
		if channelType == model.CHANNEL_DIRECT {
			message = strings.Trim(userLocale("api.post.send_notifications_and_forget.push_image_only"), " ")
		} else {
			message = "@" + senderName + userLocale("api.post.send_notifications_and_forget.push_image_only")
		}
	}

	return message
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
			mlog.Error(err.Error())
			return
		}

		msg := model.PushNotification{}
		msg.Type = model.PUSH_TYPE_CLEAR
		msg.ChannelId = channelId
		msg.ContentAvailable = 0
		if badge := <-a.Srv.Store.User().GetUnreadCount(userId); badge.Err != nil {
			msg.Badge = 0
			mlog.Error(fmt.Sprint("We could not get the unread message count for the user", userId, badge.Err), mlog.String("user_id", userId))
		} else {
			msg.Badge = int(badge.Data.(int64))
		}

		mlog.Debug(fmt.Sprintf("Clearing push notification to %v with channel_id %v", msg.DeviceId, msg.ChannelId))

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
	msg.ServerId = a.DiagnosticId()

	request, _ := http.NewRequest("POST", strings.TrimRight(*a.Config().EmailSettings.PushNotificationServer, "/")+model.API_URL_SUFFIX_V1+"/send_push", strings.NewReader(msg.ToJson()))

	if resp, err := a.HTTPClient(true).Do(request); err != nil {
		mlog.Error(fmt.Sprintf("Device push reported as error for UserId=%v SessionId=%v message=%v", session.UserId, session.Id, err.Error()), mlog.String("user_id", session.UserId))
	} else {
		pushResponse := model.PushResponseFromJson(resp.Body)
		if resp.Body != nil {
			consumeAndClose(resp)
		}

		if pushResponse[model.PUSH_STATUS] == model.PUSH_STATUS_REMOVE {
			mlog.Info(fmt.Sprintf("Device was reported as removed for UserId=%v SessionId=%v removing push for this session", session.UserId, session.Id), mlog.String("user_id", session.UserId))
			a.AttachDeviceId(session.Id, "", session.ExpiresAt)
			a.ClearSessionCacheForUser(session.UserId)
		}

		if pushResponse[model.PUSH_STATUS] == model.PUSH_STATUS_FAIL {
			mlog.Error(fmt.Sprintf("Device push reported as error for UserId=%v SessionId=%v message=%v", session.UserId, session.Id, pushResponse[model.PUSH_STATUS_ERROR_MSG]), mlog.String("user_id", session.UserId))
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
func GetExplicitMentions(message string, keywords map[string][]string) *ExplicitMentions {
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
	processText := func(text string) {
		for _, word := range strings.FieldsFunc(text, func(c rune) bool {
			// Split on any whitespace or punctuation that can't be part of an at mention or emoji pattern
			return !(c == ':' || c == '.' || c == '-' || c == '_' || c == '@' || unicode.IsLetter(c) || unicode.IsNumber(c))
		}) {
			// skip word with format ':word:' with an assumption that it is an emoji format only
			if word[0] == ':' && word[len(word)-1] == ':' {
				continue
			}

			if checkForMention(word) {
				continue
			}

			// remove trailing '.', as that is the end of a sentence
			foundWithSuffix := false
			for _, suffixPunctuation := range []string{".", ":"} {
				for strings.HasSuffix(word, suffixPunctuation) {
					word = strings.TrimSuffix(word, suffixPunctuation)
					if checkForMention(word) {
						foundWithSuffix = true
						break
					}
				}
			}

			if foundWithSuffix {
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
		}
	}

	buf := ""
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
	processText(buf)

	return ret
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

	// If the channel is muted do not send push notifications
	if channelMuted, ok := channelNotifyProps[model.MARK_UNREAD_NOTIFY_PROP]; ok {
		if channelMuted == model.CHANNEL_MARK_UNREAD_MENTION {
			return false
		}
	}

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
	// If User status is DND or OOO return false right away
	if status.Status == model.STATUS_DND || status.Status == model.STATUS_OUT_OF_OFFICE {
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
