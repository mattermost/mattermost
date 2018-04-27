// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"hash/fnv"
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/nicksnyder/go-i18n/i18n"
)

const PUSH_NOTIFICATION_HUB_WORKERS = 1000
const PUSH_NOTIFICATIONS_HUB_BUFFER_PER_WORKER = 50

type PushNotificationsHub struct {
	Channels []chan PushNotification
}

type PushNotification struct {
	notificationType string
	userId           string
	channelId        string
	post             *model.Post
	user             *model.User
	channel          *model.Channel
	senderName       string
	channelName      string
	wasMentioned     bool
}

func (a *App) sendPushNotificationSync(post *model.Post, user *model.User, channel *model.Channel, senderName, channelName string, wasMentioned bool) *model.AppError {
	sessions, err := a.getMobileAppSessions(user.Id)
	if err != nil {
		return err
	}

	if channel.Type == model.CHANNEL_DIRECT {
		channelName = senderName
	}

	msg := model.PushNotification{}
	if badge := <-a.Srv.Store.User().GetUnreadCountFromMaster(user.Id); badge.Err != nil {
		msg.Badge = 1
		l4g.Error("We could not get the unread message count for the user", user.Id, badge.Err)
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

	msg.Message, msg.Category = a.getPushNotificationMessage(post.Message, wasMentioned, hasFiles, senderName, channelName, channel.Type, userLocale)

	for _, session := range sessions {
		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)

		l4g.Debug("Sending push notification to device %v for user %v with msg of '%v'", tmpMessage.DeviceId, user.Id, msg.Message)

		a.sendToPushProxy(tmpMessage, session)

		if a.Metrics != nil {
			a.Metrics.IncrementPostSentPush()
		}
	}

	return nil
}

func (a *App) getChannelFromUserId(userId string) chan PushNotification {
	h := fnv.New32a()
	h.Write([]byte(userId))
	chanIdx := h.Sum32() % PUSH_NOTIFICATION_HUB_WORKERS
	return a.PushNotificationsHub.Channels[chanIdx]
}

func (a *App) sendPushNotification(post *model.Post, user *model.User, channel *model.Channel, senderName, channelName string, wasMentioned bool) {
	c := a.getChannelFromUserId(user.Id)
	c <- PushNotification{
		notificationType: "message",
		post:             post,
		user:             user,
		channel:          channel,
		senderName:       senderName,
		channelName:      channelName,
		wasMentioned:     wasMentioned,
	}
}

func (a *App) getPushNotificationMessage(postMessage string, wasMentioned bool, hasFiles bool, senderName string, channelName string, channelType string, userLocale i18n.TranslateFunc) (string, string) {
	message := ""
	category := ""

	contentsConfig := *a.Config().EmailSettings.PushNotificationContents

	if contentsConfig == model.FULL_NOTIFICATION {
		category = model.CATEGORY_CAN_REPLY

		if channelType == model.CHANNEL_DIRECT {
			message = senderName + ": " + model.ClearMentionTags(postMessage)
		} else {
			message = senderName + userLocale("api.post.send_notifications_and_forget.push_in") + channelName + ": " + model.ClearMentionTags(postMessage)
		}
	} else if contentsConfig == model.GENERIC_NO_CHANNEL_NOTIFICATION {
		if channelType == model.CHANNEL_DIRECT {
			category = model.CATEGORY_CAN_REPLY

			message = senderName + userLocale("api.post.send_notifications_and_forget.push_message")
		} else if wasMentioned {
			message = senderName + userLocale("api.post.send_notifications_and_forget.push_mention_no_channel")
		} else {
			message = senderName + userLocale("api.post.send_notifications_and_forget.push_non_mention_no_channel")
		}
	} else {
		if channelType == model.CHANNEL_DIRECT {
			category = model.CATEGORY_CAN_REPLY

			message = senderName + userLocale("api.post.send_notifications_and_forget.push_message")
		} else if wasMentioned {
			category = model.CATEGORY_CAN_REPLY

			message = senderName + userLocale("api.post.send_notifications_and_forget.push_mention") + channelName
		} else {
			message = senderName + userLocale("api.post.send_notifications_and_forget.push_non_mention") + channelName
		}
	}

	// If the post only has images then push an appropriate message
	if len(postMessage) == 0 && hasFiles {
		if channelType == model.CHANNEL_DIRECT {
			message = senderName + userLocale("api.post.send_notifications_and_forget.push_image_only_dm")
		} else if contentsConfig == model.GENERIC_NO_CHANNEL_NOTIFICATION {
			message = senderName + userLocale("api.post.send_notifications_and_forget.push_image_only_no_channel")
		} else {
			message = senderName + userLocale("api.post.send_notifications_and_forget.push_image_only") + channelName
		}
	}

	return message, category
}

func (a *App) ClearPushNotificationSync(userId string, channelId string) {
	sessions, err := a.getMobileAppSessions(userId)
	if err != nil {
		l4g.Error(err.Error())
		return
	}

	msg := model.PushNotification{}
	msg.Type = model.PUSH_TYPE_CLEAR
	msg.ChannelId = channelId
	msg.ContentAvailable = 0
	if badge := <-a.Srv.Store.User().GetUnreadCountFromMaster(userId); badge.Err != nil {
		msg.Badge = 0
		l4g.Error("We could not get the unread message count for the user", userId, badge.Err)
	} else {
		msg.Badge = int(badge.Data.(int64))
	}

	l4g.Debug("Clearing push notification to %v with channel_id %v", msg.DeviceId, msg.ChannelId)

	for _, session := range sessions {
		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		a.sendToPushProxy(tmpMessage, session)
	}
}

func (a *App) ClearPushNotification(userId string, channelId string) {
	channel := a.getChannelFromUserId(userId)
	channel <- PushNotification{
		notificationType: "clear",
		userId:           userId,
		channelId:        channelId,
	}
}

func (a *App) CreatePushNotificationsHub() {
	hub := PushNotificationsHub{
		Channels: []chan PushNotification{},
	}
	for x := 0; x < PUSH_NOTIFICATION_HUB_WORKERS; x++ {
		hub.Channels = append(hub.Channels, make(chan PushNotification, PUSH_NOTIFICATIONS_HUB_BUFFER_PER_WORKER))
	}
	a.PushNotificationsHub = hub
}

func (a *App) pushNotificationWorker(notifications chan PushNotification) {
	for notification := range notifications {
		switch notification.notificationType {
		case "clear":
			a.ClearPushNotificationSync(notification.userId, notification.channelId)
		case "message":
			a.sendPushNotificationSync(
				notification.post,
				notification.user,
				notification.channel,
				notification.senderName,
				notification.channelName,
				notification.wasMentioned,
			)
		default:
			l4g.Error("Invalid notification type %v", notification.notificationType)
		}
	}
}

func (a *App) StartPushNotificationsHubWorkers() {
	for x := 0; x < PUSH_NOTIFICATION_HUB_WORKERS; x++ {
		channel := a.PushNotificationsHub.Channels[x]
		a.Go(func() { a.pushNotificationWorker(channel) })
	}
}
func (a *App) StopPushNotificationsHubWorkers() {
	for _, channel := range a.PushNotificationsHub.Channels {
		close(channel)
	}
}

func (a *App) sendToPushProxy(msg model.PushNotification, session *model.Session) {
	msg.ServerId = a.DiagnosticId()

	request, _ := http.NewRequest("POST", strings.TrimRight(*a.Config().EmailSettings.PushNotificationServer, "/")+model.API_URL_SUFFIX_V1+"/send_push", strings.NewReader(msg.ToJson()))

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
