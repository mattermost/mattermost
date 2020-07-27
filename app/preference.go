// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) GetPreferencesForUser(userId string) (model.Preferences, *model.AppError) {
	preferences, err := a.Srv().Store.Preference().GetAll(userId)
	if err != nil {
		return nil, model.NewAppError("GetPreferencesForUser", "app.preference.get_all.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	return preferences, nil
}

func (a *App) GetPreferenceByCategoryForUser(userId string, category string) (model.Preferences, *model.AppError) {
	preferences, err := a.Srv().Store.Preference().GetCategory(userId, category)
	if err != nil {
		return nil, model.NewAppError("GetPreferenceByCategoryForUser", "app.preference.get_category.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	if len(preferences) == 0 {
		err := model.NewAppError("GetPreferenceByCategoryForUser", "api.preference.preferences_category.get.app_error", nil, "", http.StatusNotFound)
		return nil, err
	}
	return preferences, nil
}

func (a *App) GetPreferenceByCategoryAndNameForUser(userId string, category string, preferenceName string) (*model.Preference, *model.AppError) {
	res, err := a.Srv().Store.Preference().Get(userId, category, preferenceName)
	if err != nil {
		return nil, model.NewAppError("GetPreferenceByCategoryAndNameForUser", "app.preference.get.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	return res, nil
}

func (a *App) UpdatePreferences(userId string, preferences model.Preferences) *model.AppError {
	for _, preference := range preferences {
		if userId != preference.UserId {
			return model.NewAppError("savePreferences", "api.preference.update_preferences.set.app_error", nil,
				"userId="+userId+", preference.UserId="+preference.UserId, http.StatusForbidden)
		}
	}

	if err := a.Srv().Store.Preference().Save(&preferences); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return appErr
		default:
			return model.NewAppError("UpdatePreferences", "app.preference.save.updating.app_error", nil, err.Error(), http.StatusBadRequest)
		}
	}

	if err := a.Srv().Store.Channel().UpdateSidebarChannelsByPreferences(&preferences); err != nil {
		return model.NewAppError("UpdatePreferences", "api.preference.update_preferences.update_sidebar.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_SIDEBAR_CATEGORY_UPDATED, "", "", userId, nil)
	// TODO this needs to be updated to include information on which categories changed
	a.Publish(message)

	message = model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PREFERENCES_CHANGED, "", "", userId, nil)
	message.Add("preferences", preferences.ToJson())
	a.Publish(message)

	return nil
}

func (a *App) DeletePreferences(userId string, preferences model.Preferences) *model.AppError {
	for _, preference := range preferences {
		if userId != preference.UserId {
			err := model.NewAppError("DeletePreferences", "api.preference.delete_preferences.delete.app_error", nil,
				"userId="+userId+", preference.UserId="+preference.UserId, http.StatusForbidden)
			return err
		}
	}

	for _, preference := range preferences {
		if err := a.Srv().Store.Preference().Delete(userId, preference.Category, preference.Name); err != nil {
			return model.NewAppError("DeletePreferences", "app.preference.delete.app_error", nil, err.Error(), http.StatusBadRequest)
		}
	}

	if err := a.Srv().Store.Channel().DeleteSidebarChannelsByPreferences(&preferences); err != nil {
		return model.NewAppError("DeletePreferences", "api.preference.delete_preferences.update_sidebar.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_SIDEBAR_CATEGORY_UPDATED, "", "", userId, nil)
	// TODO this needs to be updated to include information on which categories changed
	a.Publish(message)

	message = model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PREFERENCES_DELETED, "", "", userId, nil)
	message.Add("preferences", preferences.ToJson())
	a.Publish(message)

	return nil
}
