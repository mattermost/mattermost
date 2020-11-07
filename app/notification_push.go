// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"io"
	"io/ioutil"
	"net/http"
	"runtime"
	"strings"
	"sync"

	"github.com/pkg/errors"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type notificationType string

const (
	notificationTypeClear       notificationType = "clear"
	notificationTypeMessage     notificationType = "message"
	notificationTypeUpdateBadge notificationType = "update_badge"
	notificationTypeDummy       notificationType = "dummy"
)

type PushNotificationsHub struct {
	notificationsChan chan PushNotification
	app               *App // XXX: This will go away once push notifications move to their own package.
	sema              chan struct{}
	stopChan          chan struct{}
	wg                *sync.WaitGroup
	semaWg            *sync.WaitGroup
	buffer            int
}

type PushNotification struct {
	notificationType   notificationType
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

func (a *App) sendPushNotificationSync(post *model.Post, user *model.User, channel *model.Channel, channelName string, senderName string,
	explicitMention bool, channelWideMention bool, replyToThreadType string) *model.AppError {
	cfg := a.Config()
	msg, err := a.BuildPushNotificationMessage(
		*cfg.EmailSettings.PushNotificationContents,
		post,
		user,
		channel,
		channelName,
		senderName,
		explicitMention,
		channelWideMention,
		replyToThreadType,
	)
	if err != nil {
		return err
	}

	return a.sendPushNotificationToAllSessions(msg, user.Id, "")
}

func (a *App) sendPushNotificationToAllSessions(msg *model.PushNotification, userId string, skipSessionId string) *model.AppError {
	sessions, err := a.getMobileAppSessions(userId)
	if err != nil {
		return err
	}

	if msg == nil {
		return model.NewAppError(
			"pushNotification",
			"api.push_notifications.message.parse.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
	}

	for _, session := range sessions {
		// Don't send notifications to this session if it's expired or we want to skip it
		if session.IsExpired() || (skipSessionId != "" && skipSessionId == session.Id) {
			continue
		}

		// We made a copy to avoid decoding and parsing all the time
		tmpMessage := msg.DeepCopy()
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		tmpMessage.AckId = model.NewId()

		err := a.sendToPushProxy(tmpMessage, session)
		if err != nil {
			a.NotificationsLog().Error("Notification error",
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

		a.NotificationsLog().Info("Notification sent",
			mlog.String("ackId", tmpMessage.AckId),
			mlog.String("type", tmpMessage.Type),
			mlog.String("userId", session.UserId),
			mlog.String("postId", tmpMessage.PostId),
			mlog.String("channelId", tmpMessage.ChannelId),
			mlog.String("deviceId", tmpMessage.DeviceId),
			mlog.String("status", model.PUSH_SEND_SUCCESS),
		)

		if a.Metrics() != nil {
			a.Metrics().IncrementPostSentPush()
		}
	}

	return nil
}

func (a *App) sendPushNotification(notification *PostNotification, user *model.User, explicitMention, channelWideMention bool, replyToThreadType string) {
	cfg := a.Config()
	channel := notification.Channel
	post := notification.Post

	nameFormat := a.GetNotificationNameFormat(user)

	channelName := notification.GetChannelName(nameFormat, user.Id)
	senderName := notification.GetSenderName(nameFormat, *cfg.ServiceSettings.EnablePostUsernameOverride)

	select {
	case a.Srv().PushNotificationsHub.notificationsChan <- PushNotification{
		notificationType:   notificationTypeMessage,
		post:               post,
		user:               user,
		channel:            channel,
		senderName:         senderName,
		channelName:        channelName,
		explicitMention:    explicitMention,
		channelWideMention: channelWideMention,
		replyToThreadType:  replyToThreadType,
	}:
	case <-a.Srv().PushNotificationsHub.stopChan:
		return
	}
}

func (a *App) getPushNotificationMessage(contentsConfig, postMessage string, explicitMention, channelWideMention, hasFiles bool,
	senderName, channelName, channelType, replyToThreadType string, userLocale i18n.TranslateFunc) string {

	// If the post only has images then push an appropriate message
	if postMessage == "" && hasFiles {
		if channelType == model.CHANNEL_DIRECT {
			return strings.Trim(userLocale("api.post.send_notifications_and_forget.push_image_only"), " ")
		}
		return senderName + userLocale("api.post.send_notifications_and_forget.push_image_only")
	}

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

	if replyToThreadType == model.COMMENTS_NOTIFY_ROOT {
		return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_post")
	}

	if replyToThreadType == model.COMMENTS_NOTIFY_ANY {
		return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_thread")
	}

	return senderName + userLocale("api.post.send_notifications_and_forget.push_general_message")
}

func (a *App) clearPushNotificationSync(currentSessionId, userId, channelId string) *model.AppError {
	msg := &model.PushNotification{
		Type:             model.PUSH_TYPE_CLEAR,
		Version:          model.PUSH_MESSAGE_V2,
		ChannelId:        channelId,
		ContentAvailable: 1,
	}

	unreadCount, err := a.Srv().Store.User().GetUnreadCount(userId)
	if err != nil {
		return model.NewAppError("clearPushNotificationSync", "app.user.get_unread_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	msg.Badge = int(unreadCount)

	return a.sendPushNotificationToAllSessions(msg, userId, currentSessionId)
}

func (a *App) clearPushNotification(currentSessionId, userId, channelId string) {
	select {
	case a.Srv().PushNotificationsHub.notificationsChan <- PushNotification{
		notificationType: notificationTypeClear,
		currentSessionId: currentSessionId,
		userId:           userId,
		channelId:        channelId,
	}:
	case <-a.Srv().PushNotificationsHub.stopChan:
		return
	}
}

func (a *App) updateMobileAppBadgeSync(userId string) *model.AppError {
	msg := &model.PushNotification{
		Type:             model.PUSH_TYPE_UPDATE_BADGE,
		Version:          model.PUSH_MESSAGE_V2,
		Sound:            "none",
		ContentAvailable: 1,
	}

	unreadCount, err := a.Srv().Store.User().GetUnreadCount(userId)
	if err != nil {
		return model.NewAppError("updateMobileAppBadgeSync", "app.user.get_unread_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	msg.Badge = int(unreadCount)

	return a.sendPushNotificationToAllSessions(msg, userId, "")
}

func (a *App) UpdateMobileAppBadge(userId string) {
	select {
	case a.Srv().PushNotificationsHub.notificationsChan <- PushNotification{
		notificationType: notificationTypeUpdateBadge,
		userId:           userId,
	}:
	case <-a.Srv().PushNotificationsHub.stopChan:
		return
	}
}

func (s *Server) createPushNotificationsHub() {
	buffer := *s.Config().EmailSettings.PushNotificationBuffer
	// XXX: This can be _almost_ removed except that there is a dependency with
	// a.ClearSessionCacheForUser(session.UserId) which invalidates caches,
	// which then takes to web_hub code. It's a bit complicated, so leaving as is for now.
	fakeApp := New(ServerConnector(s))
	hub := PushNotificationsHub{
		notificationsChan: make(chan PushNotification, buffer),
		app:               fakeApp,
		wg:                new(sync.WaitGroup),
		semaWg:            new(sync.WaitGroup),
		sema:              make(chan struct{}, runtime.NumCPU()*8), // numCPU * 8 is a good amount of concurrency.
		stopChan:          make(chan struct{}),
		buffer:            buffer,
	}
	go hub.start()
	s.PushNotificationsHub = hub
}

func (hub *PushNotificationsHub) start() {
	hub.wg.Add(1)
	defer hub.wg.Done()
	for {
		select {
		case notification := <-hub.notificationsChan:
			// We just ignore dummy notifications.
			// These are used to pump out any remaining notifications
			// before we stop the hub.
			if notification.notificationType == notificationTypeDummy {
				continue
			}
			// Adding to the waitgroup first.
			hub.semaWg.Add(1)
			// Get token.
			hub.sema <- struct{}{}
			go func(notification PushNotification) {
				defer func() {
					// Release token.
					<-hub.sema
					// Now marking waitgroup as done.
					hub.semaWg.Done()
				}()

				var err *model.AppError
				switch notification.notificationType {
				case notificationTypeClear:
					err = hub.app.clearPushNotificationSync(notification.currentSessionId, notification.userId, notification.channelId)
				case notificationTypeMessage:
					err = hub.app.sendPushNotificationSync(
						notification.post,
						notification.user,
						notification.channel,
						notification.channelName,
						notification.senderName,
						notification.explicitMention,
						notification.channelWideMention,
						notification.replyToThreadType,
					)
				case notificationTypeUpdateBadge:
					err = hub.app.updateMobileAppBadgeSync(notification.userId)
				default:
					mlog.Error("Invalid notification type", mlog.String("notification_type", string(notification.notificationType)))
				}

				if err != nil {
					mlog.Error("Unable to send push notification", mlog.String("notification_type", string(notification.notificationType)), mlog.Err(err))
				}
			}(notification)
		case <-hub.stopChan:
			return
		}
	}
}

func (hub *PushNotificationsHub) stop() {
	// Drain the channel.
	for i := 0; i < hub.buffer+1; i++ {
		hub.notificationsChan <- PushNotification{
			notificationType: notificationTypeDummy,
		}
	}
	close(hub.stopChan)
	// We need to wait for the outer for loop to exit first.
	// We cannot just send struct{}{} to stopChan because there are
	// other listeners to the channel. And sending just once
	// will cause a race.
	hub.wg.Wait()
	// And then we wait for the semaphore to finish.
	hub.semaWg.Wait()
}

func (s *Server) StopPushNotificationsHubWorkers() {
	s.PushNotificationsHub.stop()
}

func (a *App) sendToPushProxy(msg *model.PushNotification, session *model.Session) error {
	msg.ServerId = a.TelemetryId()

	a.NotificationsLog().Info("Notification will be sent",
		mlog.String("ackId", msg.AckId),
		mlog.String("type", msg.Type),
		mlog.String("userId", session.UserId),
		mlog.String("postId", msg.PostId),
		mlog.String("status", model.PUSH_SEND_PREPARE),
	)

	url := strings.TrimRight(*a.Config().EmailSettings.PushNotificationServer, "/") + model.API_URL_SUFFIX_V1 + "/send_push"
	request, err := http.NewRequest("POST", url, strings.NewReader(msg.ToJson()))
	if err != nil {
		return err
	}

	resp, err := a.Srv().pushNotificationClient.Do(request)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	pushResponse := model.PushResponseFromJson(resp.Body)

	switch pushResponse[model.PUSH_STATUS] {
	case model.PUSH_STATUS_REMOVE:
		a.AttachDeviceId(session.Id, "", session.ExpiresAt)
		a.ClearSessionCacheForUser(session.UserId)
		return errors.New("Device was reported as removed")
	case model.PUSH_STATUS_FAIL:
		return errors.New(pushResponse[model.PUSH_STATUS_ERROR_MSG])
	}
	return nil
}

func (a *App) SendAckToPushProxy(ack *model.PushNotificationAck) error {
	if ack == nil {
		return nil
	}

	a.NotificationsLog().Info("Notification received",
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

	resp, err := a.Srv().pushNotificationClient.Do(request)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	// Reading the body to completion.
	_, err = io.Copy(ioutil.Discard, resp.Body)
	if err != nil {
		return err
	}

	return nil
}

func (a *App) getMobileAppSessions(userId string) ([]*model.Session, *model.AppError) {
	sessions, err := a.Srv().Store.Session().GetSessionsWithActiveDeviceIds(userId)
	if err != nil {
		return nil, model.NewAppError("getMobileAppSessions", "app.session.get_sessions.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return sessions, nil
}

func ShouldSendPushNotification(user *model.User, channelNotifyProps model.StringMap, wasMentioned bool, status *model.Status, post *model.Post) bool {
	return DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, wasMentioned) &&
		DoesStatusAllowPushNotification(user.NotifyProps, status, post.ChannelId)
}

func DoesNotifyPropsAllowPushNotification(user *model.User, channelNotifyProps model.StringMap, post *model.Post, wasMentioned bool) bool {
	userNotifyProps := user.NotifyProps
	userNotify := userNotifyProps[model.PUSH_NOTIFY_PROP]
	channelNotify, ok := channelNotifyProps[model.PUSH_NOTIFY_PROP]
	if !ok || channelNotify == "" {
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
		(post.UserId != user.Id || post.GetProp("from_webhook") == "true") {
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

func (a *App) BuildPushNotificationMessage(contentsConfig string, post *model.Post, user *model.User, channel *model.Channel, channelName string, senderName string,
	explicitMention bool, channelWideMention bool, replyToThreadType string) (*model.PushNotification, *model.AppError) {

	var msg *model.PushNotification

	notificationInterface := a.Srv().Notification
	if (notificationInterface == nil || notificationInterface.CheckLicense() != nil) && contentsConfig == model.ID_LOADED_NOTIFICATION {
		contentsConfig = model.GENERIC_NOTIFICATION
	}

	if contentsConfig == model.ID_LOADED_NOTIFICATION {
		msg = a.buildIdLoadedPushNotificationMessage(post, user)
	} else {
		msg = a.buildFullPushNotificationMessage(contentsConfig, post, user, channel, channelName, senderName, explicitMention, channelWideMention, replyToThreadType)
	}

	unreadCount, err := a.Srv().Store.User().GetUnreadCount(user.Id)
	if err != nil {
		return nil, model.NewAppError("BuildPushNotificationMessage", "app.user.get_unread_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	msg.Badge = int(unreadCount)

	return msg, nil
}

func (a *App) buildIdLoadedPushNotificationMessage(post *model.Post, user *model.User) *model.PushNotification {
	userLocale := utils.GetUserTranslations(user.Locale)
	msg := &model.PushNotification{
		PostId:     post.Id,
		ChannelId:  post.ChannelId,
		Category:   model.CATEGORY_CAN_REPLY,
		Version:    model.PUSH_MESSAGE_V2,
		Type:       model.PUSH_TYPE_MESSAGE,
		IsIdLoaded: true,
		SenderId:   user.Id,
		Message:    userLocale("api.push_notification.id_loaded.default_message"),
	}

	return msg
}

func (a *App) buildFullPushNotificationMessage(contentsConfig string, post *model.Post, user *model.User, channel *model.Channel, channelName string, senderName string,
	explicitMention bool, channelWideMention bool, replyToThreadType string) *model.PushNotification {

	msg := &model.PushNotification{
		Category:   model.CATEGORY_CAN_REPLY,
		Version:    model.PUSH_MESSAGE_V2,
		Type:       model.PUSH_TYPE_MESSAGE,
		TeamId:     channel.TeamId,
		ChannelId:  channel.Id,
		PostId:     post.Id,
		RootId:     post.RootId,
		SenderId:   post.UserId,
		IsIdLoaded: false,
	}

	cfg := a.Config()
	if contentsConfig != model.GENERIC_NO_CHANNEL_NOTIFICATION || channel.Type == model.CHANNEL_DIRECT {
		msg.ChannelName = channelName
	}

	msg.SenderName = senderName
	if ou, ok := post.GetProp("override_username").(string); ok && *cfg.ServiceSettings.EnablePostUsernameOverride {
		msg.OverrideUsername = ou
		msg.SenderName = ou
	}

	if oi, ok := post.GetProp("override_icon_url").(string); ok && *cfg.ServiceSettings.EnablePostIconOverride {
		msg.OverrideIconUrl = oi
	}

	if fw, ok := post.GetProp("from_webhook").(string); ok {
		msg.FromWebhook = fw
	}

	for _, attachment := range post.Attachments() {
		post.Message += "\n" + attachment.Fallback
	}

	userLocale := utils.GetUserTranslations(user.Locale)
	hasFiles := post.FileIds != nil && len(post.FileIds) > 0

	msg.Message = a.getPushNotificationMessage(contentsConfig, post.Message, explicitMention, channelWideMention, hasFiles, msg.SenderName, channelName, channel.Type, replyToThreadType, userLocale)

	return msg
}
