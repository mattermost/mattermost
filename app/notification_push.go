// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/nicksnyder/go-i18n/i18n"
)

func (a *App) sendPushNotification(post *model.Post, user *model.User, channel *model.Channel, channelName string, sender *model.User, senderName string,
	explicitMention, channelWideMention bool, replyToThreadType string) *model.AppError {
	cfg := a.Config()
	contentsConfig := *cfg.EmailSettings.PushNotificationContents
	teammateNameConfig := *cfg.TeamSettings.TeammateNameDisplay
	sessions, err := a.getMobileAppSessions(user.Id)
	sentBySystem := senderName == utils.T("system.message.name")
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

	if !sentBySystem {
		senderName = sender.GetDisplayName(teammateNameConfig)
		preference, prefError := a.GetPreferenceByCategoryAndNameForUser(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "name_format")
		if prefError == nil && preference.Value != teammateNameConfig {
			senderName = sender.GetDisplayName(preference.Value)
		}
	}

	if channel.Type == model.CHANNEL_DIRECT {
		channelName = fmt.Sprintf("@%v", senderName)
	}

	if contentsConfig != model.GENERIC_NO_CHANNEL_NOTIFICATION || channel.Type == model.CHANNEL_DIRECT {
		msg.ChannelName = channelName
	}

	if ou, ok := post.Props["override_username"].(string); ok && cfg.ServiceSettings.EnablePostUsernameOverride {
		msg.OverrideUsername = ou
		senderName = ou
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

	if resp, err := a.HTTPService.MakeClient(true).Do(request); err != nil {
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
