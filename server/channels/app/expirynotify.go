// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const (
	OneHourMillis = 60 * 60 * 1000
)

// NotifySessionsExpired is called periodically from the job server to notify any mobile sessions that have expired.
func (a *App) NotifySessionsExpired() error {
	if !a.canSendPushNotifications() {
		return nil
	}

	// Get all mobile sessions that expired within the last hour.
	sessions, err := a.ch.srv.Store().Session().GetSessionsExpired(OneHourMillis, true, true)
	if err != nil {
		return model.NewAppError("NotifySessionsExpired", "app.session.analytics_session_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	msg := &model.PushNotification{
		Version: model.PushMessageV2,
		Type:    model.PushTypeSession,
	}

	for _, session := range sessions {
		tmpMessage := msg.DeepCopy()
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		tmpMessage.AckId = model.NewId()
		tmpMessage.Message = a.getSessionExpiredPushMessage(session)

		errPush := a.sendToPushProxy(tmpMessage, session)
		if errPush != nil {
			a.NotificationsLog().Error("Notification error",
				mlog.String("ackId", tmpMessage.AckId),
				mlog.String("type", tmpMessage.Type),
				mlog.String("userId", session.UserId),
				mlog.String("deviceId", tmpMessage.DeviceId),
				mlog.String("status", errPush.Error()),
			)
			continue
		}

		a.NotificationsLog().Info("Notification sent",
			mlog.String("ackId", tmpMessage.AckId),
			mlog.String("type", tmpMessage.Type),
			mlog.String("userId", session.UserId),
			mlog.String("deviceId", tmpMessage.DeviceId),
			mlog.String("status", model.PushSendSuccess),
		)

		if a.Metrics() != nil {
			a.Metrics().IncrementPostSentPush()
		}

		err = a.ch.srv.Store().Session().UpdateExpiredNotify(session.Id, true)
		if err != nil {
			mlog.Error("Failed to update ExpiredNotify flag", mlog.String("sessionid", session.Id), mlog.Err(err))
		}
	}
	return nil
}

func (a *App) getSessionExpiredPushMessage(session *model.Session) string {
	locale := model.DefaultLocale
	user, err := a.GetUser(session.UserId)
	if err == nil {
		locale = user.Locale
	}
	T := i18n.GetUserTranslations(locale)

	siteName := *a.Config().TeamSettings.SiteName
	props := map[string]any{"siteName": siteName, "hoursCount": *a.Config().ServiceSettings.SessionLengthMobileInHours}

	return T("api.push_notifications.session.expired", props)
}
