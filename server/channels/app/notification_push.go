// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
	"sync"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mattermost/mattermost/server/public/plugin"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

type notificationType string

type pushJWTClaims struct {
	AckId    string `json:"ack_id"`
	DeviceId string `json:"device_id"`
	jwt.RegisteredClaims
}

const (
	notificationTypeClear       notificationType = "clear"
	notificationTypeMessage     notificationType = "message"
	notificationTypeUpdateBadge notificationType = "update_badge"
	notificationTypeDummy       notificationType = "dummy"

	notificationErrorRemoveDevice = "device was reported as removed"
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
	userID             string
	channelID          string
	rootID             string
	post               *model.Post
	user               *model.User
	channel            *model.Channel
	senderName         string
	channelName        string
	explicitMention    bool
	channelWideMention bool
	replyToThreadType  string
}

func (a *App) sendPushNotificationSync(c request.CTX, post *model.Post, user *model.User, channel *model.Channel, channelName string, senderName string,
	explicitMention bool, channelWideMention bool, replyToThreadType string,
) *model.AppError {
	cfg := a.Config()
	msg, appErr := a.BuildPushNotificationMessage(
		c,
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
	if appErr != nil {
		return appErr
	}

	return a.sendPushNotificationToAllSessions(c, msg, user.Id, "")
}

func (a *App) sendPushNotificationToAllSessions(rctx request.CTX, msg *model.PushNotification, userID string, skipSessionId string) *model.AppError {
	rejectionReason := ""
	a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
		var replacementNotification *model.PushNotification
		replacementNotification, rejectionReason = hooks.NotificationWillBePushed(msg, userID)
		if rejectionReason != "" {
			rctx.Logger().Info("Notification cancelled by plugin.", mlog.String("rejection reason", rejectionReason))
			return false
		}
		if replacementNotification != nil {
			msg = replacementNotification
		}
		return true
	}, plugin.NotificationWillBePushedID)

	if rejectionReason != "" {
		// Notifications rejected by a plugin should not be considered errors
		// This is likely normal operation so no need for metrics here
		a.NotificationsLog().Debug("Notification rejected by plugin",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("status", model.NotificationStatusNotSent),
			mlog.String("reason", model.NotificationReasonRejectedByPlugin),
			mlog.String("rejection_reason", rejectionReason),
			mlog.String("user_id", userID),
		)
		return nil
	}

	sessions, appErr := a.getMobileAppSessions(userID)
	if appErr != nil {
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, model.NotificationReasonFetchError, model.NotificationNoPlatform)
		a.NotificationsLog().Error("Failed to send mobile app sessions",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonFetchError),
			mlog.String("user_id", userID),
			mlog.Err(appErr),
		)
		return appErr
	}

	if msg == nil {
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, model.NotificationReasonParseError, model.NotificationNoPlatform)
		a.NotificationsLog().Error("Failed to parse push notification",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonParseError),
			mlog.String("user_id", userID),
		)
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
			a.CountNotificationReason(model.NotificationStatusNotSent, model.NotificationTypePush, model.NotificationReasonSessionExpired, model.NotificationNoPlatform)
			a.NotificationsLog().Debug("Session expired or skipped",
				mlog.String("type", model.NotificationTypePush),
				mlog.String("status", model.NotificationStatusNotSent),
				mlog.String("reason", model.NotificationReasonSessionExpired),
				mlog.String("user_id", session.UserId),
				mlog.String("session_id", session.Id),
			)
			continue
		}

		// We made a copy to avoid decoding and parsing all the time
		tmpMessage := msg.DeepCopy()
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		tmpMessage.AckId = model.NewId()
		signature, err := jwt.NewWithClaims(jwt.SigningMethodES256, pushJWTClaims{
			AckId:    tmpMessage.AckId,
			DeviceId: tmpMessage.DeviceId,
		}).SignedString(a.AsymmetricSigningKey())
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
		tmpMessage.Signature = signature

		err = a.sendToPushProxy(tmpMessage, session)
		if err != nil {
			reason := model.NotificationReasonPushProxySendError
			if err.Error() == notificationErrorRemoveDevice {
				reason = model.NotificationReasonPushProxyRemoveDevice
			}
			a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, reason, tmpMessage.Platform)
			a.NotificationsLog().Error("Failed to send to push proxy",
				mlog.String("type", model.NotificationTypePush),
				mlog.String("status", model.NotificationStatusNotSent),
				mlog.String("reason", reason),
				mlog.String("ack_id", tmpMessage.AckId),
				mlog.String("push_type", tmpMessage.Type),
				mlog.String("user_id", session.UserId),
				mlog.String("device_id", tmpMessage.DeviceId),
				mlog.Err(err),
			)
			continue
		}

		a.NotificationsLog().Trace("Notification sent to push proxy",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("ack_id", tmpMessage.AckId),
			mlog.String("push_type", tmpMessage.Type),
			mlog.String("user_id", session.UserId),
			mlog.String("device_id", tmpMessage.DeviceId),
			mlog.String("status", model.PushSendSuccess),
		)

		if a.Metrics() != nil {
			a.Metrics().IncrementPostSentPush()
		}

		if msg.Type == model.PushTypeMessage {
			// If we are ignoring the ack, we don't count the send
			if session.Props[model.SessionPropDeviceNotificationDisabled] != "true" {
				a.CountNotification(model.NotificationTypePush, tmpMessage.Platform)
			}
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

func (a *App) getPushNotificationMessage(contentsConfig, postMessage string, explicitMention, channelWideMention,
	hasFiles bool, senderName string, channelType model.ChannelType, replyToThreadType string, userLocale i18n.TranslateFunc,
) string {
	// If the post only has images then push an appropriate message
	if postMessage == "" && hasFiles {
		if channelType == model.ChannelTypeDirect {
			return strings.Trim(userLocale("api.post.send_notifications_and_forget.push_image_only"), " ")
		}
		return senderName + userLocale("api.post.send_notifications_and_forget.push_image_only")
	}

	if contentsConfig == model.FullNotification {
		if channelType == model.ChannelTypeDirect && replyToThreadType != model.CommentsNotifyCRT {
			return model.ClearMentionTags(postMessage)
		}
		return senderName + ": " + model.ClearMentionTags(postMessage)
	}

	if channelType == model.ChannelTypeDirect {
		if replyToThreadType == model.CommentsNotifyCRT {
			if contentsConfig == model.GenericNoChannelNotification {
				return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_crt_thread")
			}
			return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_crt_thread_dm")
		}
		return userLocale("api.post.send_notifications_and_forget.push_message")
	}

	if replyToThreadType == model.CommentsNotifyCRT {
		return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_crt_thread")
	}

	if channelWideMention {
		return senderName + userLocale("api.post.send_notification_and_forget.push_channel_mention")
	}

	if explicitMention {
		return senderName + userLocale("api.post.send_notifications_and_forget.push_explicit_mention")
	}

	if replyToThreadType == model.CommentsNotifyRoot {
		return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_post")
	}

	if replyToThreadType == model.CommentsNotifyAny {
		return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_thread")
	}

	if replyToThreadType == model.UserNotifyAll {
		return senderName + userLocale("api.post.send_notification_and_forget.push_comment_on_crt_thread")
	}

	return senderName + userLocale("api.post.send_notifications_and_forget.push_general_message")
}

func (a *App) getUserBadgeCount(userID string, isCRTEnabled bool) (int, *model.AppError) {
	unreadCount, err := a.Srv().Store().User().GetUnreadCount(userID, isCRTEnabled)
	if err != nil {
		return 0, model.NewAppError("getUserBadgeCount", "app.user.get_unread_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	badgeCount := int(unreadCount)

	if isCRTEnabled {
		threadUnreadMentions, err := a.Srv().Store().Thread().GetTotalUnreadMentions(userID, "", model.GetUserThreadsOpts{})
		if err != nil {
			return 0, model.NewAppError("getUserBadgeCount", "app.user.get_thread_count_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		badgeCount += int(threadUnreadMentions)
	}

	return badgeCount, nil
}

func (a *App) clearPushNotificationSync(c request.CTX, currentSessionId, userID, channelID, rootID string) *model.AppError {
	isCRTEnabled := a.IsCRTEnabledForUser(c, userID)

	badgeCount, err := a.getUserBadgeCount(userID, isCRTEnabled)
	if err != nil {
		return model.NewAppError("clearPushNotificationSync", "app.user.get_badge_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	msg := &model.PushNotification{
		Type:             model.PushTypeClear,
		Version:          model.PushMessageV2,
		ChannelId:        channelID,
		RootId:           rootID,
		ContentAvailable: 1,
		Badge:            badgeCount,
		IsCRTEnabled:     isCRTEnabled,
	}

	return a.sendPushNotificationToAllSessions(c, msg, userID, currentSessionId)
}

func (a *App) clearPushNotification(currentSessionId, userID, channelID, rootID string) {
	select {
	case a.Srv().PushNotificationsHub.notificationsChan <- PushNotification{
		notificationType: notificationTypeClear,
		currentSessionId: currentSessionId,
		userID:           userID,
		channelID:        channelID,
		rootID:           rootID,
	}:
	case <-a.Srv().PushNotificationsHub.stopChan:
		return
	}
}

func (a *App) updateMobileAppBadgeSync(c request.CTX, userID string) *model.AppError {
	badgeCount, err := a.getUserBadgeCount(userID, a.IsCRTEnabledForUser(c, userID))
	if err != nil {
		return model.NewAppError("updateMobileAppBadgeSync", "app.user.get_badge_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	msg := &model.PushNotification{
		Type:             model.PushTypeUpdateBadge,
		Version:          model.PushMessageV2,
		Sound:            "none",
		ContentAvailable: 1,
		Badge:            badgeCount,
	}
	return a.sendPushNotificationToAllSessions(c, msg, userID, "")
}

func (a *App) UpdateMobileAppBadge(userID string) {
	select {
	case a.Srv().PushNotificationsHub.notificationsChan <- PushNotification{
		notificationType: notificationTypeUpdateBadge,
		userID:           userID,
	}:
	case <-a.Srv().PushNotificationsHub.stopChan:
		return
	}
}

func (s *Server) createPushNotificationsHub(c request.CTX) {
	buffer := *s.platform.Config().EmailSettings.PushNotificationBuffer
	hub := PushNotificationsHub{
		notificationsChan: make(chan PushNotification, buffer),
		app:               New(ServerConnector(s.Channels())),
		wg:                new(sync.WaitGroup),
		semaWg:            new(sync.WaitGroup),
		sema:              make(chan struct{}, runtime.NumCPU()*8), // numCPU * 8 is a good amount of concurrency.
		stopChan:          make(chan struct{}),
		buffer:            buffer,
	}
	go hub.start(c)
	s.PushNotificationsHub = hub
}

func (hub *PushNotificationsHub) start(c request.CTX) {
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
					err = hub.app.clearPushNotificationSync(c, notification.currentSessionId, notification.userID, notification.channelID, notification.rootID)
				case notificationTypeMessage:
					err = hub.app.sendPushNotificationSync(
						c,
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
					err = hub.app.updateMobileAppBadgeSync(c, notification.userID)
				default:
					c.Logger().Debug("Invalid notification type", mlog.String("notification_type", notification.notificationType))
				}

				if err != nil {
					c.Logger().Error("Unable to send push notification", mlog.String("notification_type", notification.notificationType), mlog.Err(err))
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

func (a *App) rawSendToPushProxy(msg *model.PushNotification) (model.PushResponse, error) {
	msgJSON, err := json.Marshal(msg)
	if err != nil {
		return nil, fmt.Errorf("failed to encode to JSON: %w", err)
	}

	url := strings.TrimRight(*a.Config().EmailSettings.PushNotificationServer, "/") + model.APIURLSuffixV1 + "/send_push"
	request, err := http.NewRequest("POST", url, bytes.NewReader(msgJSON))
	if err != nil {
		return nil, err
	}

	resp, err := a.Srv().pushNotificationClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("response returned error code: %d", resp.StatusCode)
	}

	var pushResponse model.PushResponse
	if err := json.NewDecoder(resp.Body).Decode(&pushResponse); err != nil {
		return nil, fmt.Errorf("failed to decode from JSON: %w", err)
	}

	return pushResponse, nil
}

func (a *App) sendToPushProxy(msg *model.PushNotification, session *model.Session) error {
	msg.ServerId = a.TelemetryId()

	a.NotificationsLog().Trace("Notification will be sent",
		mlog.String("type", model.NotificationTypePush),
		mlog.String("ack_id", msg.AckId),
		mlog.String("push_type", msg.Type),
		mlog.String("user_id", session.UserId),
		mlog.String("post_id", msg.PostId),
		mlog.String("status", model.PushSendPrepare),
	)

	pushResponse, err := a.rawSendToPushProxy(msg)
	if err != nil {
		return err
	}

	switch pushResponse[model.PushStatus] {
	case model.PushStatusRemove:
		appErr := a.SetExtraSessionProps(session, map[string]string{
			model.SessionPropLastRemovedDeviceId: session.DeviceId,
		})
		if appErr != nil {
			return fmt.Errorf("Failed to set extra session properties: %w", appErr)
		}
		a.ClearSessionCacheForUser(session.UserId)
		return errors.New(notificationErrorRemoveDevice)
	case model.PushStatusFail:
		return errors.New(pushResponse[model.PushStatusErrorMsg])
	}
	return nil
}

func (a *App) SendAckToPushProxy(ack *model.PushNotificationAck) error {
	if ack == nil {
		return nil
	}

	a.NotificationsLog().Trace("Notification successfully received",
		mlog.String("type", model.NotificationTypePush),
		mlog.String("ack_id", ack.Id),
		mlog.String("push_type", ack.NotificationType),
		mlog.String("post_id", ack.PostId),
		mlog.String("ack_type", ack.NotificationType),
		mlog.String("device_type", ack.ClientPlatform),
		mlog.Int("received_at", ack.ClientReceivedAt),
		mlog.String("status", model.PushReceived),
	)

	ackJSON, err := json.Marshal(ack)
	if err != nil {
		return fmt.Errorf("failed to encode to JSON: %w", err)
	}

	request, err := http.NewRequest(
		"POST",
		strings.TrimRight(*a.Config().EmailSettings.PushNotificationServer, "/")+model.APIURLSuffixV1+"/ack",
		bytes.NewReader(ackJSON),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := a.Srv().pushNotificationClient.Do(request)
	if err != nil {
		return fmt.Errorf("failed to send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("response returned error code: %d", resp.StatusCode)
	}

	// Reading the body to completion.
	_, err = io.Copy(io.Discard, resp.Body)
	return err
}

func (a *App) getMobileAppSessions(userID string) ([]*model.Session, *model.AppError) {
	sessions, err := a.Srv().Store().Session().GetSessionsWithActiveDeviceIds(userID)
	if err != nil {
		return nil, model.NewAppError("getMobileAppSessions", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return sessions, nil
}

func (a *App) ShouldSendPushNotification(user *model.User, channelNotifyProps model.StringMap, wasMentioned bool, status *model.Status, post *model.Post, isGM bool) bool {
	if prop := post.GetProp(model.PostPropsForceNotification); prop != nil && prop != "" {
		return true
	}

	if notifyPropsAllowedReason := doesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, wasMentioned, isGM); notifyPropsAllowedReason != "" {
		a.CountNotificationReason(model.NotificationStatusNotSent, model.NotificationTypePush, notifyPropsAllowedReason, model.NotificationNoPlatform)
		a.NotificationsLog().Debug("Notification not sent - notify props",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("post_id", post.Id),
			mlog.String("status", model.NotificationStatusNotSent),
			mlog.String("reason", notifyPropsAllowedReason),
			mlog.String("sender_id", post.UserId),
			mlog.String("receiver_id", user.Id),
		)
		return false
	}

	if statusAllowedReason := doesStatusAllowPushNotification(user.NotifyProps, status, post.ChannelId, false); statusAllowedReason != "" {
		a.CountNotificationReason(model.NotificationStatusNotSent, model.NotificationTypePush, statusAllowedReason, model.NotificationNoPlatform)
		a.NotificationsLog().Debug("Notification not sent - status",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("post_id", post.Id),
			mlog.String("status", model.NotificationStatusNotSent),
			mlog.String("reason", statusAllowedReason),
			mlog.String("sender_id", post.UserId),
			mlog.String("receiver_id", user.Id),
			mlog.String("receiver_status", status.Status),
		)
		return false
	}

	return true
}

func doesNotifyPropsAllowPushNotification(user *model.User, channelNotifyProps model.StringMap, post *model.Post, wasMentioned, isGM bool) model.NotificationReason {
	userNotifyProps := user.NotifyProps
	userNotify := userNotifyProps[model.PushNotifyProp]
	channelNotify, ok := channelNotifyProps[model.PushNotifyProp]
	if !ok || channelNotify == "" {
		channelNotify = model.ChannelNotifyDefault
	}

	notify := channelNotify
	if channelNotify == model.ChannelNotifyDefault {
		notify = userNotify
		if isGM && userNotify == model.UserNotifyMention {
			notify = model.ChannelNotifyAll
		}
	}

	// If the channel is muted do not send push notifications
	if channelNotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention {
		return model.NotificationReasonChannelMuted
	}

	if post.IsSystemMessage() {
		return model.NotificationReasonSystemMessage
	}

	if notify == model.ChannelNotifyNone {
		return model.NotificationReasonLevelSetToNone
	}

	if notify == model.ChannelNotifyMention && !wasMentioned {
		return model.NotificationReasonNotMentioned
	}

	if (notify == model.ChannelNotifyAll) &&
		(post.UserId != user.Id || post.GetProp("from_webhook") == "true") {
		return ""
	}

	return ""
}

func doesStatusAllowPushNotification(userNotifyProps model.StringMap, status *model.Status, channelID string, isCRT bool) model.NotificationReason {
	// If User status is DND or OOO return false right away
	if status.Status == model.StatusDnd || status.Status == model.StatusOutOfOffice {
		return model.NotificationReasonUserStatus
	}

	pushStatus, ok := userNotifyProps[model.PushStatusNotifyProp]
	sendOnlineNotification := status.ActiveChannel != channelID || // We are in a different channel
		model.GetMillis()-status.LastActivityAt > model.StatusChannelTimeout || // It has been a while since we were last active on this channel
		isCRT // Is CRT, so being active in a channel doesn't mean you are seeing thread activity

	if (pushStatus == model.StatusOnline || !ok) && sendOnlineNotification {
		return ""
	}

	if pushStatus == model.StatusAway && (status.Status == model.StatusAway || status.Status == model.StatusOffline) {
		return ""
	}

	if pushStatus == model.StatusOffline && status.Status == model.StatusOffline {
		return ""
	}

	return model.NotificationReasonUserIsActive
}

func (a *App) BuildPushNotificationMessage(c request.CTX, contentsConfig string, post *model.Post, user *model.User, channel *model.Channel, channelName string, senderName string,
	explicitMention bool, channelWideMention bool, replyToThreadType string,
) (*model.PushNotification, *model.AppError) {
	var msg *model.PushNotification

	notificationInterface := a.ch.Notification
	if (notificationInterface == nil || notificationInterface.CheckLicense() != nil) && contentsConfig == model.IdLoadedNotification {
		contentsConfig = model.GenericNotification
	}

	if contentsConfig == model.IdLoadedNotification {
		msg = a.buildIdLoadedPushNotificationMessage(c, channel, post, user)
	} else {
		msg = a.buildFullPushNotificationMessage(c, contentsConfig, post, user, channel, channelName, senderName, explicitMention, channelWideMention, replyToThreadType)
	}

	badgeCount, err := a.getUserBadgeCount(user.Id, a.IsCRTEnabledForUser(c, user.Id))
	if err != nil {
		return nil, model.NewAppError("BuildPushNotificationMessage", "app.user.get_badge_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	msg.Badge = badgeCount

	// Add post and channel types for plugins to use in the NotificationWillBePushed hook
	msg.PostType = post.Type
	msg.ChannelType = channel.Type

	return msg, nil
}

func (a *App) SendTestPushNotification(deviceID string) string {
	if !a.canSendPushNotifications() {
		return "false"
	}

	msg := &model.PushNotification{
		Version:  "2",
		Type:     model.PushTypeTest,
		ServerId: a.TelemetryId(),
		Badge:    -1,
	}
	msg.SetDeviceIdAndPlatform(deviceID)

	pushResponse, err := a.rawSendToPushProxy(msg)
	if err != nil {
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, model.NotificationReasonPushProxySendError, msg.Platform)
		a.NotificationsLog().Error("Failed to send test notification to push proxy",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("push_type", msg.Type),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonPushProxySendError),
			mlog.String("device_id", msg.DeviceId),
			mlog.Err(err),
		)
		return "unknown"
	}

	switch pushResponse[model.PushStatus] {
	case model.PushStatusRemove:
		return "false"
	case model.PushStatusFail:
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypePush, model.NotificationReasonPushProxyError, msg.Platform)
		a.NotificationsLog().Error("Push proxy failed to send test notification",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("push_type", msg.Type),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonPushProxyError),
			mlog.String("device_id", msg.DeviceId),
			mlog.Err(errors.New(pushResponse[model.PushStatusErrorMsg])),
		)
		return "unknown"
	}

	return "true"
}

func (a *App) buildIdLoadedPushNotificationMessage(c request.CTX, channel *model.Channel, post *model.Post, user *model.User) *model.PushNotification {
	userLocale := i18n.GetUserTranslations(user.Locale)
	msg := &model.PushNotification{
		PostId:       post.Id,
		ChannelId:    post.ChannelId,
		RootId:       post.RootId,
		IsCRTEnabled: a.IsCRTEnabledForUser(c, user.Id),
		Category:     model.CategoryCanReply,
		Version:      model.PushMessageV2,
		TeamId:       channel.TeamId,
		Type:         model.PushTypeMessage,
		IsIdLoaded:   true,
		SenderId:     user.Id,
		Message:      userLocale("api.push_notification.id_loaded.default_message"),
	}

	return msg
}

func (a *App) buildFullPushNotificationMessage(c request.CTX, contentsConfig string, post *model.Post, user *model.User, channel *model.Channel, channelName string, senderName string,
	explicitMention bool, channelWideMention bool, replyToThreadType string,
) *model.PushNotification {
	msg := &model.PushNotification{
		Category:     model.CategoryCanReply,
		Version:      model.PushMessageV2,
		Type:         model.PushTypeMessage,
		TeamId:       channel.TeamId,
		ChannelId:    channel.Id,
		PostId:       post.Id,
		RootId:       post.RootId,
		SenderId:     post.UserId,
		IsCRTEnabled: false,
		IsIdLoaded:   false,
	}

	userLocale := i18n.GetUserTranslations(user.Locale)
	cfg := a.Config()
	if contentsConfig != model.GenericNoChannelNotification || channel.Type == model.ChannelTypeDirect {
		msg.ChannelName = channelName
	}

	if a.IsCRTEnabledForUser(c, user.Id) {
		msg.IsCRTEnabled = true
		if post.RootId != "" {
			if contentsConfig != model.GenericNoChannelNotification {
				props := map[string]any{"channelName": channelName}
				msg.ChannelName = userLocale("api.push_notification.title.collapsed_threads", props)

				if channel.Type == model.ChannelTypeDirect {
					msg.ChannelName = userLocale("api.push_notification.title.collapsed_threads_dm")
				}
			}
		}
	}

	msg.SenderName = senderName
	if ou, ok := post.GetProp("override_username").(string); ok && *cfg.ServiceSettings.EnablePostUsernameOverride {
		msg.OverrideUsername = ou
		msg.SenderName = ou
	}

	if oi, ok := post.GetProp("override_icon_url").(string); ok && *cfg.ServiceSettings.EnablePostIconOverride {
		msg.OverrideIconURL = oi
	}

	if fw, ok := post.GetProp("from_webhook").(string); ok {
		msg.FromWebhook = fw
	}

	postMessage := post.Message
	stripped, err := utils.StripMarkdown(postMessage)
	if err != nil {
		c.Logger().Warn("Failed parse to markdown", mlog.String("post_id", post.Id), mlog.Err(err))
	} else {
		postMessage = stripped
	}
	for _, attachment := range post.Attachments() {
		if attachment.Fallback != "" {
			postMessage += "\n" + attachment.Fallback
		}
	}

	hasFiles := post.FileIds != nil && len(post.FileIds) > 0

	msg.Message = a.getPushNotificationMessage(
		contentsConfig,
		postMessage,
		explicitMention,
		channelWideMention,
		hasFiles,
		msg.SenderName,
		channel.Type,
		replyToThreadType,
		userLocale,
	)

	return msg
}
