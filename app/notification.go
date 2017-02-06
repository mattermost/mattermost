// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"crypto/tls"
	"fmt"
	"html"
	"html/template"
	"io/ioutil"
	"net/http"
	"net/url"
	"path/filepath"
	"sort"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/nicksnyder/go-i18n/i18n"
)

func SendNotifications(post *model.Post, team *model.Team, channel *model.Channel, sender *model.User) ([]string, *model.AppError) {
	pchan := Srv.Store.User().GetAllProfilesInChannel(channel.Id, true)
	fchan := Srv.Store.FileInfo().GetForPost(post.Id)

	var profileMap map[string]*model.User
	if result := <-pchan; result.Err != nil {
		return nil, result.Err
	} else {
		profileMap = result.Data.(map[string]*model.User)
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

		mentionedUserIds[otherUserId] = true
		if post.Props["from_webhook"] == "true" {
			mentionedUserIds[post.UserId] = true
		}
	} else {
		keywords := GetMentionKeywordsInChannel(profileMap)

		var potentialOtherMentions []string
		mentionedUserIds, potentialOtherMentions, hereNotification, channelNotification, allNotification = GetExplicitMentions(post.Message, keywords)

		// get users that have comment thread mentions enabled
		if len(post.RootId) > 0 {
			if result := <-Srv.Store.Post().Get(post.RootId); result.Err != nil {
				return nil, result.Err
			} else {
				list := result.Data.(*model.PostList)

				for _, threadPost := range list.Posts {
					profile := profileMap[threadPost.UserId]
					if profile.NotifyProps["comments"] == "any" || (profile.NotifyProps["comments"] == "root" && threadPost.Id == list.Order[0]) {
						mentionedUserIds[threadPost.UserId] = true
					}
				}
			}
		}

		// prevent the user from mentioning themselves
		if post.Props["from_webhook"] != "true" {
			delete(mentionedUserIds, post.UserId)
		}

		if len(potentialOtherMentions) > 0 {
			if result := <-Srv.Store.User().GetProfilesByUsernames(potentialOtherMentions, team.Id); result.Err == nil {
				outOfChannelMentions := result.Data.(map[string]*model.User)
				go sendOutOfChannelMentions(sender, post, team.Id, outOfChannelMentions)
			}
		}

		// find which users in the channel are set up to always receive mobile notifications
		for _, profile := range profileMap {
			if profile.NotifyProps["push"] == model.USER_NOTIFY_ALL &&
				(post.UserId != profile.Id || post.Props["from_webhook"] == "true") &&
				!post.IsSystemMessage() {
				allActivityPushUserIds = append(allActivityPushUserIds, profile.Id)
			}
		}
	}

	mentionedUsersList := make([]string, 0, len(mentionedUserIds))
	for id := range mentionedUserIds {
		mentionedUsersList = append(mentionedUsersList, id)
		updateMentionChans = append(updateMentionChans, Srv.Store.Channel().IncrementMentionCount(post.ChannelId, id))
	}

	senderName := make(map[string]string)
	for _, id := range mentionedUsersList {
		senderName[id] = ""
		if post.IsSystemMessage() {
			senderName[id] = utils.T("system.message.name")
		} else {
			if value, ok := post.Props["override_username"]; ok && post.Props["from_webhook"] == "true" {
				senderName[id] = value.(string)
			} else {
				// Get the Display name preference from the receiver
				if result := <-Srv.Store.Preference().Get(id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "name_format"); result.Err != nil {
					// Show default sender's name if user doesn't set display settings.
					senderName[id] = sender.Username
				} else {
					senderName[id] = sender.GetDisplayNameForPreference(result.Data.(model.Preference).Value)
				}
			}
		}
	}

	var senderUsername string
	if value, ok := post.Props["override_username"]; ok && post.Props["from_webhook"] == "true" {
		senderUsername = value.(string)
	} else {
		senderUsername = sender.Username
	}

	if utils.Cfg.EmailSettings.SendEmailNotifications {
		for _, id := range mentionedUsersList {
			userAllowsEmails := profileMap[id].NotifyProps["email"] != "false"

			var status *model.Status
			var err *model.AppError
			if status, err = GetStatus(id); err != nil {
				status = &model.Status{
					UserId:         id,
					Status:         model.STATUS_OFFLINE,
					Manual:         false,
					LastActivityAt: 0,
					ActiveChannel:  "",
				}
			}

			if userAllowsEmails && status.Status != model.STATUS_ONLINE && profileMap[id].DeleteAt == 0 {
				sendNotificationEmail(post, profileMap[id], channel, team, senderName[id], sender)
			}
		}
	}

	T := utils.GetUserTranslations(sender.Locale)

	// If the channel has more than 1K users then @here is disabled
	if hereNotification && int64(len(profileMap)) > *utils.Cfg.TeamSettings.MaxNotificationsPerChannel {
		hereNotification = false
		SendEphemeralPost(
			team.Id,
			post.UserId,
			&model.Post{
				ChannelId: post.ChannelId,
				Message:   T("api.post.disabled_here", map[string]interface{}{"Users": *utils.Cfg.TeamSettings.MaxNotificationsPerChannel}),
				CreateAt:  post.CreateAt + 1,
			},
		)
	}

	// If the channel has more than 1K users then @channel is disabled
	if channelNotification && int64(len(profileMap)) > *utils.Cfg.TeamSettings.MaxNotificationsPerChannel {
		SendEphemeralPost(
			team.Id,
			post.UserId,
			&model.Post{
				ChannelId: post.ChannelId,
				Message:   T("api.post.disabled_channel", map[string]interface{}{"Users": *utils.Cfg.TeamSettings.MaxNotificationsPerChannel}),
				CreateAt:  post.CreateAt + 1,
			},
		)
	}

	// If the channel has more than 1K users then @all is disabled
	if allNotification && int64(len(profileMap)) > *utils.Cfg.TeamSettings.MaxNotificationsPerChannel {
		SendEphemeralPost(
			team.Id,
			post.UserId,
			&model.Post{
				ChannelId: post.ChannelId,
				Message:   T("api.post.disabled_all", map[string]interface{}{"Users": *utils.Cfg.TeamSettings.MaxNotificationsPerChannel}),
				CreateAt:  post.CreateAt + 1,
			},
		)
	}

	if hereNotification {
		if result := <-Srv.Store.Status().GetOnline(); result.Err != nil {
			return nil, result.Err
		} else {
			statuses := result.Data.([]*model.Status)
			for _, status := range statuses {
				if status.UserId == post.UserId {
					continue
				}

				_, profileFound := profileMap[status.UserId]
				_, alreadyMentioned := mentionedUserIds[status.UserId]

				if status.Status == model.STATUS_ONLINE && profileFound && !alreadyMentioned {
					mentionedUsersList = append(mentionedUsersList, status.UserId)
					updateMentionChans = append(updateMentionChans, Srv.Store.Channel().IncrementMentionCount(post.ChannelId, status.UserId))
				}
			}
		}
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
	if *utils.Cfg.EmailSettings.SendPushNotifications {
		pushServer := *utils.Cfg.EmailSettings.PushNotificationServer
		if pushServer == model.MHPNS && (!utils.IsLicensed || !*utils.License.Features.MHPNS) {
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
			if status, err = GetStatus(id); err != nil {
				status = &model.Status{id, model.STATUS_OFFLINE, false, 0, ""}
			}

			if DoesStatusAllowPushNotification(profileMap[id], status, post.ChannelId) {
				sendPushNotification(post, profileMap[id], channel, senderName[id], true)
			}
		}

		for _, id := range allActivityPushUserIds {
			if _, ok := mentionedUserIds[id]; !ok {
				var status *model.Status
				var err *model.AppError
				if status, err = GetStatus(id); err != nil {
					status = &model.Status{id, model.STATUS_OFFLINE, false, 0, ""}
				}

				if DoesStatusAllowPushNotification(profileMap[id], status, post.ChannelId) {
					sendPushNotification(post, profileMap[id], channel, senderName[id], false)
				}
			}
		}
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POSTED, "", post.ChannelId, "", nil)
	message.Add("post", post.ToJson())
	message.Add("channel_type", channel.Type)
	message.Add("channel_display_name", channel.DisplayName)
	message.Add("channel_name", channel.Name)
	message.Add("sender_name", senderUsername)
	message.Add("team_id", team.Id)

	if len(post.FileIds) != 0 {
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

	Publish(message)
	return mentionedUsersList, nil
}

func sendNotificationEmail(post *model.Post, user *model.User, channel *model.Channel, team *model.Team, senderName string, sender *model.User) *model.AppError {
	if channel.Type == model.CHANNEL_DIRECT && channel.TeamId != team.Id {
		// this message is a cross-team DM so it we need to find a team that the recipient is on to use in the link
		if result := <-Srv.Store.Team().GetTeamsByUserId(user.Id); result.Err != nil {
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
				team = &model.Team{Name: "select_team", DisplayName: utils.Cfg.TeamSettings.SiteName}
			}
		}
	}
	if *utils.Cfg.EmailSettings.EnableEmailBatching {
		var sendBatched bool

		if result := <-Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL); result.Err != nil {
			// if the call fails, assume it hasn't been set and use the default
			sendBatched = false
		} else {
			// default to not using batching if the setting is set to immediate
			sendBatched = result.Data.(model.Preference).Value != model.PREFERENCE_DEFAULT_EMAIL_INTERVAL
		}

		if sendBatched {
			if err := AddNotificationEmailToBatch(user, post, team); err == nil {
				return nil
			}
		}

		// fall back to sending a single email if we can't batch it for some reason
	}

	var channelName string
	var bodyText string
	var subjectText string
	var mailTemplate string
	var mailParameters map[string]interface{}

	teamURL := utils.GetSiteURL() + "/" + team.Name
	tm := time.Unix(post.CreateAt/1000, 0)

	userLocale := utils.GetUserTranslations(user.Locale)
	month := userLocale(tm.Month().String())
	day := fmt.Sprintf("%d", tm.Day())
	year := fmt.Sprintf("%d", tm.Year())
	zone, _ := tm.Zone()

	if channel.Type == model.CHANNEL_DIRECT {
		bodyText = userLocale("api.post.send_notifications_and_forget.message_body")
		subjectText = userLocale("api.post.send_notifications_and_forget.message_subject")

		senderDisplayName := senderName

		mailTemplate = "api.templates.post_subject_in_direct_message"
		mailParameters = map[string]interface{}{"SubjectText": subjectText, "TeamDisplayName": team.DisplayName,
			"SenderDisplayName": senderDisplayName, "Month": month, "Day": day, "Year": year}
	} else {
		bodyText = userLocale("api.post.send_notifications_and_forget.mention_body")
		subjectText = userLocale("api.post.send_notifications_and_forget.mention_subject")
		channelName = channel.DisplayName
		mailTemplate = "api.templates.post_subject_in_channel"
		mailParameters = map[string]interface{}{"SubjectText": subjectText, "TeamDisplayName": team.DisplayName,
			"ChannelName": channelName, "Month": month, "Day": day, "Year": year}
	}

	subject := fmt.Sprintf("[%v] %v", utils.Cfg.TeamSettings.SiteName, userLocale(mailTemplate, mailParameters))

	bodyPage := utils.NewHTMLTemplate("post_body", user.Locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
	bodyPage.Props["PostMessage"] = GetMessageForNotification(post, userLocale)
	if team.Name != "select_team" {
		bodyPage.Props["TeamLink"] = teamURL + "/pl/" + post.Id
	} else {
		bodyPage.Props["TeamLink"] = teamURL
	}

	bodyPage.Props["BodyText"] = bodyText
	bodyPage.Props["Button"] = userLocale("api.templates.post_body.button")
	bodyPage.Html["Info"] = template.HTML(userLocale("api.templates.post_body.info",
		map[string]interface{}{"ChannelName": channelName, "SenderName": senderName,
			"Hour": fmt.Sprintf("%02d", tm.Hour()), "Minute": fmt.Sprintf("%02d", tm.Minute()),
			"TimeZone": zone, "Month": month, "Day": day}))

	go func() {
		if err := utils.SendMail(user.Email, html.UnescapeString(subject), bodyPage.Render()); err != nil {
			l4g.Error(utils.T("api.post.send_notifications_and_forget.send.error"), user.Email, err)
		}
	}()

	if einterfaces.GetMetricsInterface() != nil {
		einterfaces.GetMetricsInterface().IncrementPostSentEmail()
	}

	return nil
}

func GetMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string {
	if len(strings.TrimSpace(post.Message)) != 0 || len(post.FileIds) == 0 {
		return post.Message
	}

	// extract the filenames from their paths and determine what type of files are attached
	var infos []*model.FileInfo
	if result := <-Srv.Store.FileInfo().GetForPost(post.Id); result.Err != nil {
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

func sendPushNotification(post *model.Post, user *model.User, channel *model.Channel, senderName string, wasMentioned bool) *model.AppError {
	sessions, err := getMobileAppSessions(user.Id)
	if err != nil {
		return err
	}

	var channelName string

	if channel.Type == model.CHANNEL_DIRECT {
		channelName = senderName
	} else {
		channelName = channel.DisplayName
	}

	userLocale := utils.GetUserTranslations(user.Locale)

	msg := model.PushNotification{}
	if badge := <-Srv.Store.User().GetUnreadCount(user.Id); badge.Err != nil {
		msg.Badge = 1
		l4g.Error(utils.T("store.sql_user.get_unread_count.app_error"), user.Id, badge.Err)
	} else {
		msg.Badge = int(badge.Data.(int64))
	}
	msg.Type = model.PUSH_TYPE_MESSAGE
	msg.TeamId = channel.TeamId
	msg.ChannelId = channel.Id
	msg.ChannelName = channel.Name

	if *utils.Cfg.EmailSettings.PushNotificationContents == model.FULL_NOTIFICATION {
		if channel.Type == model.CHANNEL_DIRECT {
			msg.Category = model.CATEGORY_DM
			msg.Message = "@" + senderName + ": " + model.ClearMentionTags(post.Message)
		} else {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_in") + channelName + ": " + model.ClearMentionTags(post.Message)
		}
	} else {
		if channel.Type == model.CHANNEL_DIRECT {
			msg.Category = model.CATEGORY_DM
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_message")
		} else if wasMentioned {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_mention") + channelName
		} else {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_non_mention") + channelName
		}
	}

	l4g.Debug(utils.T("api.post.send_notifications_and_forget.push_notification.debug"), msg.DeviceId, msg.Message)

	for _, session := range sessions {
		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		go sendToPushProxy(tmpMessage)

		if einterfaces.GetMetricsInterface() != nil {
			einterfaces.GetMetricsInterface().IncrementPostSentPush()
		}
	}

	return nil
}

func ClearPushNotification(userId string, channelId string) *model.AppError {
	sessions, err := getMobileAppSessions(userId)
	if err != nil {
		return err
	}

	msg := model.PushNotification{}
	msg.Type = model.PUSH_TYPE_CLEAR
	msg.ChannelId = channelId
	msg.ContentAvailable = 0
	if badge := <-Srv.Store.User().GetUnreadCount(userId); badge.Err != nil {
		msg.Badge = 0
		l4g.Error(utils.T("store.sql_user.get_unread_count.app_error"), userId, badge.Err)
	} else {
		msg.Badge = int(badge.Data.(int64))
	}

	l4g.Debug(utils.T("api.post.send_notifications_and_forget.clear_push_notification.debug"), msg.DeviceId, msg.ChannelId)

	for _, session := range sessions {
		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		go sendToPushProxy(tmpMessage)
	}

	return nil
}

func sendToPushProxy(msg model.PushNotification) *model.AppError {
	msg.ServerId = utils.CfgDiagnosticId

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
	}
	httpClient := &http.Client{Transport: tr}
	request, _ := http.NewRequest("POST", *utils.Cfg.EmailSettings.PushNotificationServer+model.API_URL_SUFFIX_V1+"/send_push", strings.NewReader(msg.ToJson()))

	if resp, err := httpClient.Do(request); err != nil {
		return model.NewLocAppError("sendToPushProxy", "api.post.send_notifications_and_forget.push_notification.error", map[string]interface{}{"DeviceId": msg.DeviceId, "Error": err.Error()}, "")
	} else {
		ioutil.ReadAll(resp.Body)
		resp.Body.Close()
	}

	return nil
}

func getMobileAppSessions(userId string) ([]*model.Session, *model.AppError) {
	if result := <-Srv.Store.Session().GetSessionsWithActiveDeviceIds(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Session), nil
	}
}

func sendOutOfChannelMentions(sender *model.User, post *model.Post, teamId string, profiles map[string]*model.User) *model.AppError {
	if len(profiles) == 0 {
		return nil
	}

	var usernames []string
	for _, user := range profiles {
		usernames = append(usernames, user.Username)
	}
	sort.Strings(usernames)

	T := utils.GetUserTranslations(sender.Locale)

	var message string
	if len(usernames) == 1 {
		message = T("api.post.check_for_out_of_channel_mentions.message.one", map[string]interface{}{
			"Username": usernames[0],
		})
	} else {
		message = T("api.post.check_for_out_of_channel_mentions.message.multiple", map[string]interface{}{
			"Usernames":    strings.Join(usernames[:len(usernames)-1], ", "),
			"LastUsername": usernames[len(usernames)-1],
		})
	}

	SendEphemeralPost(
		teamId,
		post.UserId,
		&model.Post{
			ChannelId: post.ChannelId,
			Message:   message,
			CreateAt:  post.CreateAt + 1,
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

	for _, word := range strings.Fields(message) {
		isMention := false

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

		if !isMention {
			// No matches were found with the string split just on whitespace so try further splitting
			// the message on punctuation
			splitWords := strings.FieldsFunc(word, func(c rune) bool {
				return model.SplitRunes[c]
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
				} else if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
					username := word[1:len(splitWord)]
					potentialOthersMentioned = append(potentialOthersMentioned, username)
				}
			}
		}
	}

	return mentioned, potentialOthersMentioned, hereMentioned, channelMentioned, allMentioned
}

// Given a map of user IDs to profiles, returns a list of mention
// keywords for all users in the channel.
func GetMentionKeywordsInChannel(profiles map[string]*model.User) map[string][]string {
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
		if int64(len(profiles)) < *utils.Cfg.TeamSettings.MaxNotificationsPerChannel && profile.NotifyProps["channel"] == "true" {
			keywords["@channel"] = append(keywords["@channel"], profile.Id)
			keywords["@all"] = append(keywords["@all"], profile.Id)
		}
	}

	return keywords
}
