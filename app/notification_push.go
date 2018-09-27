// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"hash/fnv"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/nicksnyder/go-i18n/i18n"
)

type NotificationType string

const NOTIFICATION_TYPE_CLEAR NotificationType = "clear"
const NOTIFICATION_TYPE_MESSAGE NotificationType = "message"

const PUSH_NOTIFICATION_HUB_WORKERS = 1000
const PUSH_NOTIFICATIONS_HUB_BUFFER_PER_WORKER = 50

type PushNotificationsHub struct {
	Channels []chan PushNotification
}

type PushNotification struct {
	notificationType   NotificationType
	userId             string
	channelId          string
	post               *model.Post
	user               *model.User
	channel            *model.Channel
	senderName         string
	channelName        string
	explicitMention    bool
	channelWideMention bool
	replyToThreadType  string
}

func (hub *PushNotificationsHub) GetGoChannelFromUserId(userId string) chan PushNotification {
	h := fnv.New32a()
	h.Write([]byte(userId))
	chanIdx := h.Sum32() % PUSH_NOTIFICATION_HUB_WORKERS
	return hub.Channels[chanIdx]
}

func (a *App) sendPushNotificationSync(post *model.Post, user *model.User, channel *model.Channel, channelName string, senderName string,
	explicitMention, channelWideMention bool, replyToThreadType string) *model.AppError {
	cfg := a.Config()

	sessions, err := a.getMobileAppSessions(user.Id)
	if err != nil {
		return err
	}

	msg := model.PushNotification{}
	if badge := <-a.Srv.Store.User().GetUnreadCount(user.Id); badge.Err != nil {
		msg.Badge = 1
		mlog.Error(fmt.Sprint("We could not get the unread message count for the user", user.Id, badge.Err), mlog.String("user_id", user.Id))
	} else {
		msg.Badge = int(badge.Data.(int64))
	}

	msg.Category = model.CATEGORY_CAN_REPLY
	msg.Version = model.PUSH_MESSAGE_V2
	msg.Type = model.PUSH_TYPE_MESSAGE
	msg.TeamId = channel.TeamId
	msg.ChannelId = channel.Id
	msg.PostId = post.Id
	msg.RootId = post.RootId
	msg.SenderId = post.UserId

	contentsConfig := *cfg.EmailSettings.PushNotificationContents
	if contentsConfig != model.GENERIC_NO_CHANNEL_NOTIFICATION || channel.Type == model.CHANNEL_DIRECT {
		msg.ChannelName = channelName
	}

	if ou, ok := post.Props["override_username"].(string); ok && cfg.ServiceSettings.EnablePostUsernameOverride {
		msg.OverrideUsername = ou
	}

	if oi, ok := post.Props["override_icon_url"].(string); ok && cfg.ServiceSettings.EnablePostIconOverride {
		msg.OverrideIconUrl = oi
	}

	if fw, ok := post.Props["from_webhook"].(string); ok {
		msg.FromWebhook = fw
	}

	userLocale := utils.GetUserTranslations(user.Locale)
	hasFiles := post.FileIds != nil && len(post.FileIds) > 0

	msg.Message = a.getPushNotificationMessage(post.Message, explicitMention, channelWideMention, hasFiles, senderName, channelName, channel.Type, replyToThreadType, userLocale)

	for _, session := range sessions {

		if session.IsExpired() {
			continue
		}

		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)

		mlog.Debug(fmt.Sprintf("Sending push notification to device %v for user %v with msg of '%v'", tmpMessage.DeviceId, user.Id, msg.Message), mlog.String("user_id", user.Id))

		a.sendToPushProxy(tmpMessage, session)

		if a.Metrics != nil {
			a.Metrics.IncrementPostSentPush()
		}
	}

	return nil
}

func (a *App) sendPushNotification(notification *postNotification, user *model.User, explicitMention, channelWideMention bool, replyToThreadType string) {
	cfg := a.Config()
	channel := notification.channel
	post := notification.post

	var nameFormat string
	if result := <-a.Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_NAME_FORMAT); result.Err != nil {
		nameFormat = *a.Config().TeamSettings.TeammateNameDisplay
	} else {
		nameFormat = result.Data.(model.Preference).Value
	}

	channelName := notification.GetChannelName(nameFormat, user.Id)
	senderName := notification.GetSenderName(nameFormat, cfg.ServiceSettings.EnablePostUsernameOverride)

	c := a.PushNotificationsHub.GetGoChannelFromUserId(user.Id)
	c <- PushNotification{
		notificationType:   NOTIFICATION_TYPE_MESSAGE,
		post:               post,
		user:               user,
		channel:            channel,
		senderName:         senderName,
		channelName:        channelName,
		explicitMention:    explicitMention,
		channelWideMention: channelWideMention,
		replyToThreadType:  replyToThreadType,
	}
}

func (a *App) getPushNotificationMessage(postMessage string, explicitMention, channelWideMention, hasFiles bool,
	senderName, channelName, channelType, replyToThreadType string, userLocale i18n.TranslateFunc) string {

	// If the post only has images then push an appropriate message
	if len(postMessage) == 0 && hasFiles {
		if channelType == model.CHANNEL_DIRECT {
			return strings.Trim(userLocale("api.post.send_notifications_and_forget.push_image_only"), " ")
		}
		return "@" + senderName + userLocale("api.post.send_notifications_and_forget.push_image_only")
	}

	contentsConfig := *a.Config().EmailSettings.PushNotificationContents

	if contentsConfig == model.FULL_NOTIFICATION {
		if channelType == model.CHANNEL_DIRECT {
			return model.ClearMentionTags(postMessage)
		}
		return "@" + senderName + ": " + model.ClearMentionTags(postMessage)
	}

	if channelType == model.CHANNEL_DIRECT {
		return userLocale("api.post.send_notifications_and_forget.push_message")
	}

	if channelWideMention {
		return "@" + senderName + userLocale("api.post.send_notification_and_forget.push_channel_mention")
	}

	if explicitMention {
		return "@" + senderName + userLocale("api.post.send_notifications_and_forget.push_explicit_mention")
	}

	if replyToThreadType == THREAD_ROOT {
		return "@" + senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_post")
	}

	if replyToThreadType == THREAD_ANY {
		return "@" + senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_thread")
	}

	return "@" + senderName + userLocale("api.post.send_notifications_and_forget.push_general_message")
}

func (a *App) ClearPushNotificationSync(userId string, channelId string) {
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
		a.sendToPushProxy(tmpMessage, session)
	}
}

func (a *App) ClearPushNotification(userId string, channelId string) {
	channel := a.PushNotificationsHub.GetGoChannelFromUserId(userId)
	channel <- PushNotification{
		notificationType: NOTIFICATION_TYPE_CLEAR,
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
		case NOTIFICATION_TYPE_CLEAR:
			a.ClearPushNotificationSync(notification.userId, notification.channelId)
		case NOTIFICATION_TYPE_MESSAGE:
			a.sendPushNotificationSync(
				notification.post,
				notification.user,
				notification.channel,
				notification.channelName,
				notification.senderName,
				notification.explicitMention,
				notification.channelWideMention,
				notification.replyToThreadType,
			)
		default:
			mlog.Error(fmt.Sprintf("Invalid notification type %v", notification.notificationType))
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

	resp, err := a.HTTPService.MakeClient(true).Do(request)
	if err != nil {
		mlog.Error(fmt.Sprintf("Device push reported as error for UserId=%v SessionId=%v message=%v", session.UserId, session.Id, err.Error()), mlog.String("user_id", session.UserId))
		return
	}

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

func (a *App) getMobileAppSessions(userId string) ([]*model.Session, *model.AppError) {
	result := <-a.Srv.Store.Session().GetSessionsWithActiveDeviceIds(userId)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.Session), nil
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

	pushStatus, ok := userNotifyProps["push_status"]
	if (pushStatus == model.STATUS_ONLINE || !ok) && (status.ActiveChannel != channelId || model.GetMillis()-status.LastActivityAt > model.STATUS_CHANNEL_TIMEOUT) {
		return true
	}

	if pushStatus == model.STATUS_AWAY && (status.Status == model.STATUS_AWAY || status.Status == model.STATUS_OFFLINE) {
		return true
	}

	if pushStatus == model.STATUS_OFFLINE && status.Status == model.STATUS_OFFLINE {
		return true
	}

	return false
}
