// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	PERCENT_THRESHOLD float64 = 0.10
)

func (a *App) NotifyImpendingSessionExpiry() *model.AppError {
	sessionLengthMillis := *a.Config().ServiceSettings.SessionLengthMobileInDays * 24 * 60 * 60 * 1000
	threshold := int64(float64(sessionLengthMillis) * PERCENT_THRESHOLD)

	if *a.Config().EmailSettings.SendPushNotifications {
		pushServer := *a.Config().EmailSettings.PushNotificationServer
		if license := a.License(); pushServer == model.MHPNS && (license == nil || !*license.Features.MHPNS) {
			mlog.Warn("Push notifications are disabled. Go to System Console > Notifications > Mobile Push to enable them.")
			return nil
		}
	}

	sessions, err := a.srv.Store.Session().GetSessionsAboutToExpire(threshold, true)
	if err != nil {
		return err
	}

	msg := &model.PushNotification{
		Category: model.CATEGORY_CAN_REPLY,
		Version:  model.PUSH_MESSAGE_V2,
		Type:     model.PUSH_TYPE_SESSION,
	}

	for _, session := range sessions {
		tmpMessage := msg.DeepCopy()
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		tmpMessage.AckId = model.NewId()
		tmpMessage.Message = a.getSessionExpirePushMessage(session)

		errPush := a.sendToPushProxy(tmpMessage, session)
		if errPush != nil {
			a.NotificationsLog().Error("Notification error",
				mlog.String("ackId", tmpMessage.AckId),
				mlog.String("type", tmpMessage.Type),
				mlog.String("userId", session.UserId),
				mlog.String("deviceId", tmpMessage.DeviceId),
				mlog.String("status", err.Error()),
			)
			continue
		}

		a.NotificationsLog().Info("Notification sent",
			mlog.String("ackId", tmpMessage.AckId),
			mlog.String("type", tmpMessage.Type),
			mlog.String("userId", session.UserId),
			mlog.String("deviceId", tmpMessage.DeviceId),
			mlog.String("status", model.PUSH_SEND_SUCCESS),
		)

		if a.Metrics() != nil {
			a.Metrics().IncrementPostSentPush()
		}
	}
	return nil
}

func (a *App) getSessionExpirePushMessage(session *model.Session) string {
	locale := model.DEFAULT_LOCALE
	user, err := a.GetUser(session.UserId)
	if err == nil {
		locale = user.Locale
	}
	T := utils.GetUserTranslations(locale)

	siteName := *a.Config().TeamSettings.SiteName
	props := map[string]interface{}{"siteName": siteName}

	if session.IsExpired() {
		props["daysCount"] = *a.Config().ServiceSettings.SessionLengthMobileInDays
		return T("api.push_notifications.session.expired", props)
	}

	expiresIn := session.ExpiresAt - model.GetMillis()
	dur := time.Millisecond * time.Duration(expiresIn)
	if dur.Hours() > 48 {
		props["daysCount"] = int(dur.Hours() / 24)
		return T("api.push_notifications.session.expiring_days", props)
	}
	props["daysCount"] = int(dur.Hours())
	return T("api.push_notifications.session.expiring_hours", props)
}
