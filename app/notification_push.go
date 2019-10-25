// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"hash/fnv"
	"net/http"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
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
	id                 string
	notificationType   NotificationType
	currentSessionId   string
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
	explicitMention bool, channelWideMention bool, replyToThreadType string) *model.AppError {

	sessions, err := a.getMobileAppSessions(user.Id)
	if err != nil {
		return err
	}

	msg := a.BuildPushNotificationMessage(post, user, channel, channelName, senderName, explicitMention, channelWideMention, replyToThreadType)

	for _, session := range sessions {
		if session.IsExpired() {
			continue
		}

		tmpMessage := model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		tmpMessage.AckId = model.NewId()

		err := a.sendToPushProxy(*tmpMessage, session)
		if err != nil {
			a.NotificationsLog.Error("Notification error",
				mlog.String("ackId", tmpMessage.AckId),
				mlog.String("type", tmpMessage.Type),
				mlog.String("userId", session.UserId),
				mlog.String("postId", tmpMessage.PostId),
				mlog.String("channelId", tmpMessage.ChannelId),
				mlog.String("deviceId", tmpMessage.DeviceId),
				mlog.String("status", err.Error()),
			)

			continue
		}

		a.NotificationsLog.Info("Notification sent",
			mlog.String("ackId", tmpMessage.AckId),
			mlog.String("type", tmpMessage.Type),
			mlog.String("userId", session.UserId),
			mlog.String("postId", tmpMessage.PostId),
			mlog.String("channelId", tmpMessage.ChannelId),
			mlog.String("deviceId", tmpMessage.DeviceId),
			mlog.String("status", model.PUSH_SEND_SUCCESS),
		)

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

	nameFormat := a.GetNotificationNameFormat(user)

	channelName := notification.GetChannelName(nameFormat, user.Id)
	senderName := notification.GetSenderName(nameFormat, *cfg.ServiceSettings.EnablePostUsernameOverride)

	c := a.Srv.PushNotificationsHub.GetGoChannelFromUserId(user.Id)
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
		return senderName + userLocale("api.post.send_notifications_and_forget.push_image_only")
	}

	contentsConfig := *a.Config().EmailSettings.PushNotificationContents

	if contentsConfig == model.FULL_NOTIFICATION {
		if channelType == model.CHANNEL_DIRECT {
			return model.ClearMentionTags(postMessage)
		}
		return senderName + ": " + model.ClearMentionTags(postMessage)
	}

	if channelType == model.CHANNEL_DIRECT {
		return userLocale("api.post.send_notifications_and_forget.push_message")
	}

	if channelWideMention {
		return senderName + userLocale("api.post.send_notification_and_forget.push_channel_mention")
	}

	if explicitMention {
		return senderName + userLocale("api.post.send_notifications_and_forget.push_explicit_mention")
	}

	if replyToThreadType == THREAD_ROOT {
		return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_post")
	}

	if replyToThreadType == THREAD_ANY {
		return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_thread")
	}

	return senderName + userLocale("api.post.send_notifications_and_forget.push_general_message")
}

func (a *App) ClearPushNotificationSync(currentSessionId, userId, channelId string) {
	sessions, err := a.getMobileAppSessions(userId)
	if err != nil {
		mlog.Error("error getting mobile app sessions", mlog.Err(err))
		return
	}

	msg := model.PushNotification{
		Type:             model.PUSH_TYPE_CLEAR,
		Version:          model.PUSH_MESSAGE_V2,
		ChannelId:        channelId,
		ContentAvailable: 1,
	}

	if unreadCount, err := a.Srv.Store.User().GetUnreadCount(userId); err != nil {
		msg.Badge = 0
		mlog.Error("We could not get the unread message count for", mlog.String("user_id", userId), mlog.Err(err))
	} else {
		msg.Badge = int(unreadCount)
	}

	for _, session := range sessions {
		if currentSessionId != session.Id {
			tmpMessage := model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
			tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
			tmpMessage.AckId = model.NewId()

			err := a.sendToPushProxy(*tmpMessage, session)
			if err != nil {
				a.NotificationsLog.Error("Notification error",
					mlog.String("ackId", tmpMessage.AckId),
					mlog.String("type", tmpMessage.Type),
					mlog.String("userId", session.UserId),
					mlog.String("postId", tmpMessage.PostId),
					mlog.String("channelId", tmpMessage.ChannelId),
					mlog.String("deviceId", tmpMessage.DeviceId),
					mlog.String("status", err.Error()),
				)

				continue
			}

			a.NotificationsLog.Info("Notification sent",
				mlog.String("ackId", tmpMessage.AckId),
				mlog.String("type", tmpMessage.Type),
				mlog.String("userId", session.UserId),
				mlog.String("postId", tmpMessage.PostId),
				mlog.String("channelId", tmpMessage.ChannelId),
				mlog.String("deviceId", tmpMessage.DeviceId),
				mlog.String("status", model.PUSH_SEND_SUCCESS),
			)

			if a.Metrics != nil {
				a.Metrics.IncrementPostSentPush()
			}
		}
	}
}

func (a *App) ClearPushNotification(currentSessionId, userId, channelId string) {
	channel := a.Srv.PushNotificationsHub.GetGoChannelFromUserId(userId)
	channel <- PushNotification{
		notificationType: NOTIFICATION_TYPE_CLEAR,
		currentSessionId: currentSessionId,
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
	a.Srv.PushNotificationsHub = hub
}

func (a *App) pushNotificationWorker(notifications chan PushNotification) {
	for notification := range notifications {
		switch notification.notificationType {
		case NOTIFICATION_TYPE_CLEAR:
			a.ClearPushNotificationSync(notification.currentSessionId, notification.userId, notification.channelId)
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
			mlog.Error("Invalid notification type", mlog.String("notification_type", string(notification.notificationType)))
		}
	}
}

func (a *App) StartPushNotificationsHubWorkers() {
	for x := 0; x < PUSH_NOTIFICATION_HUB_WORKERS; x++ {
		channel := a.Srv.PushNotificationsHub.Channels[x]
		a.Srv.Go(func() { a.pushNotificationWorker(channel) })
	}
}

func (a *App) StopPushNotificationsHubWorkers() {
	for _, channel := range a.Srv.PushNotificationsHub.Channels {
		close(channel)
	}
}

func (a *App) sendToPushProxy(msg model.PushNotification, session *model.Session) error {
	msg.ServerId = a.DiagnosticId()

	a.NotificationsLog.Info("Notification will be sent",
		mlog.String("ackId", msg.AckId),
		mlog.String("type", msg.Type),
		mlog.String("userId", session.UserId),
		mlog.String("postId", msg.PostId),
		mlog.String("status", model.PUSH_SEND_PREPARE),
	)

	request, err := http.NewRequest("POST", strings.TrimRight(*a.Config().EmailSettings.PushNotificationServer, "/")+model.API_URL_SUFFIX_V1+"/send_push", strings.NewReader(msg.ToJson()))
	if err != nil {
		return err
	}

	resp, err := a.HTTPService.MakeClient(true).Do(request)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	pushResponse := model.PushResponseFromJson(resp.Body)

	if pushResponse[model.PUSH_STATUS] == model.PUSH_STATUS_REMOVE {
		a.AttachDeviceId(session.Id, "", session.ExpiresAt)
		a.ClearSessionCacheForUser(session.UserId)
		return errors.New("Device was reported as removed")
	}

	if pushResponse[model.PUSH_STATUS] == model.PUSH_STATUS_FAIL {
		return errors.New(pushResponse[model.PUSH_STATUS_ERROR_MSG])
	}

	return nil
}

func (a *App) SendAckToPushProxy(ack *model.PushNotificationAck) error {
	if ack == nil {
		return nil
	}

	a.NotificationsLog.Info("Notification received",
		mlog.String("ackId", ack.Id),
		mlog.String("type", ack.NotificationType),
		mlog.String("deviceType", ack.ClientPlatform),
		mlog.Int64("receivedAt", ack.ClientReceivedAt),
		mlog.String("status", model.PUSH_RECEIVED),
	)

	request, err := http.NewRequest(
		"POST",
		strings.TrimRight(*a.Config().EmailSettings.PushNotificationServer, "/")+model.API_URL_SUFFIX_V1+"/ack",
		strings.NewReader(ack.ToJson()),
	)

	if err != nil {
		return err
	}

	resp, err := a.HTTPService.MakeClient(true).Do(request)
	if err != nil {
		return err
	}

	resp.Body.Close()
	return nil

}

func (a *App) getMobileAppSessions(userId string) ([]*model.Session, *model.AppError) {
	return a.Srv.Store.Session().GetSessionsWithActiveDeviceIds(userId)
}

func ShouldSendPushNotification(user *model.User, channelNotifyProps model.StringMap, wasMentioned bool, status *model.Status, post *model.Post) bool {
	return DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, wasMentioned) &&
		DoesStatusAllowPushNotification(user.NotifyProps, status, post.ChannelId)
}

func DoesNotifyPropsAllowPushNotification(user *model.User, channelNotifyProps model.StringMap, post *model.Post, wasMentioned bool) bool {
	userNotifyProps := user.NotifyProps
	userNotify := userNotifyProps[model.PUSH_NOTIFY_PROP]
	channelNotify, _ := channelNotifyProps[model.PUSH_NOTIFY_PROP]
	if channelNotify == "" {
		channelNotify = model.CHANNEL_NOTIFY_DEFAULT
	}

	// If the channel is muted do not send push notifications
	if channelNotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.CHANNEL_MARK_UNREAD_MENTION {
		return false
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

	if userNotify == model.USER_NOTIFY_MENTION && channelNotify == model.CHANNEL_NOTIFY_DEFAULT && !wasMentioned {
		return false
	}

	if (userNotify == model.USER_NOTIFY_ALL || channelNotify == model.CHANNEL_NOTIFY_ALL) &&
		(post.UserId != user.Id || post.Props["from_webhook"] == "true") {
		return true
	}

	if userNotify == model.USER_NOTIFY_NONE &&
		channelNotify == model.CHANNEL_NOTIFY_DEFAULT {
		return false
	}

	return true
}

func DoesStatusAllowPushNotification(userNotifyProps model.StringMap, status *model.Status, channelId string) bool {
	// If User status is DND or OOO return false right away
	if status.Status == model.STATUS_DND || status.Status == model.STATUS_OUT_OF_OFFICE {
		return false
	}

	pushStatus, ok := userNotifyProps[model.PUSH_STATUS_NOTIFY_PROP]
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

func (a *App) BuildPushNotificationMessage(post *model.Post, user *model.User, channel *model.Channel, channelName string, senderName string,
	explicitMention bool, channelWideMention bool, replyToThreadType string) model.PushNotification {

	msg := model.PushNotification{
		Category:  model.CATEGORY_CAN_REPLY,
		Version:   model.PUSH_MESSAGE_V2,
		Type:      model.PUSH_TYPE_MESSAGE,
		TeamId:    channel.TeamId,
		ChannelId: channel.Id,
		PostId:    post.Id,
		RootId:    post.RootId,
		SenderId:  post.UserId,
	}

	if user.NotifyProps["push"] == "all" {
		if unreadCount, err := a.Srv.Store.User().GetAnyUnreadPostCountForChannel(user.Id, channel.Id); err != nil {
			msg.Badge = 1
			mlog.Error("We could not get the unread message count for the user", mlog.String("user_id", user.Id), mlog.Err(err))
		} else {
			msg.Badge = int(unreadCount)
		}
	} else {
		if unreadCount, err := a.Srv.Store.User().GetUnreadCount(user.Id); err != nil {
			msg.Badge = 1
			mlog.Error("We could not get the unread message count for the user", mlog.String("user_id", user.Id), mlog.Err(err))
		} else {
			msg.Badge = int(unreadCount)
		}
	}

	cfg := a.Config()
	contentsConfig := *cfg.EmailSettings.PushNotificationContents
	if contentsConfig != model.GENERIC_NO_CHANNEL_NOTIFICATION || channel.Type == model.CHANNEL_DIRECT {
		msg.ChannelName = channelName
	}

	msg.SenderName = senderName
	if ou, ok := post.Props["override_username"].(string); ok && *cfg.ServiceSettings.EnablePostUsernameOverride {
		msg.OverrideUsername = ou
		msg.SenderName = ou
	}

	if oi, ok := post.Props["override_icon_url"].(string); ok && *cfg.ServiceSettings.EnablePostIconOverride {
		msg.OverrideIconUrl = oi
	}

	if fw, ok := post.Props["from_webhook"].(string); ok {
		msg.FromWebhook = fw
	}

	userLocale := utils.GetUserTranslations(user.Locale)
	hasFiles := post.FileIds != nil && len(post.FileIds) > 0

	msg.Message = a.getPushNotificationMessage(post.Message, explicitMention, channelWideMention, hasFiles, msg.SenderName, channelName, channel.Type, replyToThreadType, userLocale)

	return msg
}
