// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GetPlatformNotificationsForUser(rctx request.CTX, userID string) ([]*model.PlatformNotification, *model.AppError) {
	notifications, err := a.Srv().Store().PlatformNotification().GetForUser(userID)
	if err != nil {
		return nil, model.NewAppError("GetPlatformNotificationsForUser", "app.platform_notification.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return notifications, nil
}

func (a *App) UpsertPlatformNotification(rctx request.CTX, notification *model.PlatformNotification, connectionID string) (*model.PlatformNotification, *model.AppError) {
	saved, err := a.Srv().Store().PlatformNotification().Upsert(notification)
	if err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("UpsertPlatformNotification", "app.platform_notification.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishPlatformNotificationEvent(model.WebsocketEventPlatformNotificationUpserted, saved.UserId, saved, connectionID)
	return saved, nil
}

func (a *App) ReplacePlatformNotificationsForUser(rctx request.CTX, userID string, notifications []*model.PlatformNotification, connectionID string) ([]*model.PlatformNotification, *model.AppError) {
	for _, notification := range notifications {
		notification.UserId = userID
	}

	if err := a.Srv().Store().PlatformNotification().ReplaceAllForUser(userID, notifications); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("ReplacePlatformNotificationsForUser", "app.platform_notification.replace.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	saved, err := a.Srv().Store().PlatformNotification().GetForUser(userID)
	if err != nil {
		return nil, model.NewAppError("ReplacePlatformNotificationsForUser", "app.platform_notification.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishPlatformNotificationEvent(model.WebsocketEventPlatformNotificationsReplaced, userID, nil, connectionID)
	return saved, nil
}

func (a *App) DeletePlatformNotification(rctx request.CTX, userID, id, connectionID string) *model.AppError {
	if err := a.Srv().Store().PlatformNotification().Delete(userID, id); err != nil {
		return model.NewAppError("DeletePlatformNotification", "app.platform_notification.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPlatformNotificationDeleted, "", "", userID, nil, connectionID)
	message.Add("id", id)
	a.Publish(message)
	return nil
}

func (a *App) ClearPlatformNotificationsForUser(rctx request.CTX, userID, connectionID string) *model.AppError {
	if err := a.Srv().Store().PlatformNotification().DeleteAllForUser(userID); err != nil {
		return model.NewAppError("ClearPlatformNotificationsForUser", "app.platform_notification.clear.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishPlatformNotificationEvent(model.WebsocketEventPlatformNotificationsCleared, userID, nil, connectionID)
	return nil
}

func (a *App) publishPlatformNotificationEvent(event model.WebsocketEventType, userID string, notification *model.PlatformNotification, connectionID string) {
	message := model.NewWebSocketEvent(event, "", "", userID, nil, connectionID)
	if notification != nil {
		notificationJSON, jsonErr := json.Marshal(notification)
		if jsonErr != nil {
			mlog.Warn("Failed to encode platform notification to JSON", mlog.Err(jsonErr))
			return
		}
		message.Add("notification", string(notificationJSON))
	}
	a.Publish(message)
}
