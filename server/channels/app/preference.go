// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GetPreferencesForUser(c request.CTX, userID string) (model.Preferences, *model.AppError) {
	preferences, err := a.Srv().Store().Preference().GetAll(userID)
	if err != nil {
		return nil, model.NewAppError("GetPreferencesForUser", "app.preference.get_all.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	return preferences, nil
}

func (a *App) GetPreferenceByCategoryForUser(c request.CTX, userID string, category string) (model.Preferences, *model.AppError) {
	preferences, err := a.Srv().Store().Preference().GetCategory(userID, category)
	if err != nil {
		return nil, model.NewAppError("GetPreferenceByCategoryForUser", "app.preference.get_category.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	if len(preferences) == 0 {
		err := model.NewAppError("GetPreferenceByCategoryForUser", "api.preference.preferences_category.get.app_error", nil, "", http.StatusNotFound)
		return nil, err
	}
	return preferences, nil
}

func (a *App) GetPreferenceByCategoryAndNameForUser(c request.CTX, userID string, category string, preferenceName string) (*model.Preference, *model.AppError) {
	res, err := a.Srv().Store().Preference().Get(userID, category, preferenceName)
	if err != nil {
		return nil, model.NewAppError("GetPreferenceByCategoryAndNameForUser", "app.preference.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	return res, nil
}

func (a *App) UpdatePreferences(c request.CTX, userID string, preferences model.Preferences) *model.AppError {
	for _, preference := range preferences {
		if userID != preference.UserId {
			return model.NewAppError("savePreferences", "api.preference.update_preferences.set.app_error", nil,
				"userId="+userID+", preference.UserId="+preference.UserId, http.StatusForbidden)
		}
	}

	if err := a.Srv().Store().Preference().Save(preferences); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return appErr
		default:
			return model.NewAppError("UpdatePreferences", "app.preference.save.updating.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	if err := a.Srv().Store().Channel().UpdateSidebarChannelsByPreferences(preferences); err != nil {
		return model.NewAppError("UpdatePreferences", "api.preference.update_preferences.update_sidebar.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventSidebarCategoryUpdated, "", "", userID, nil, "")
	// TODO this needs to be updated to include information on which categories changed
	a.Publish(message)

	message = model.NewWebSocketEvent(model.WebsocketEventPreferencesChanged, "", "", userID, nil, "")
	prefsJSON, jsonErr := json.Marshal(preferences)
	if jsonErr != nil {
		return model.NewAppError("UpdatePreferences", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("preferences", string(prefsJSON))
	a.Publish(message)

	pluginContext := pluginContext(c)
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.PreferencesHaveChanged(pluginContext, preferences)
			return true
		}, plugin.PreferencesHaveChangedID)
	})

	return nil
}

func (a *App) DeletePreferences(c request.CTX, userID string, preferences model.Preferences) *model.AppError {
	for _, preference := range preferences {
		if userID != preference.UserId {
			err := model.NewAppError("DeletePreferences", "api.preference.delete_preferences.delete.app_error", nil,
				"userId="+userID+", preference.UserId="+preference.UserId, http.StatusForbidden)
			return err
		}
	}

	for _, preference := range preferences {
		if err := a.Srv().Store().Preference().Delete(userID, preference.Category, preference.Name); err != nil {
			return model.NewAppError("DeletePreferences", "app.preference.delete.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	if err := a.Srv().Store().Channel().DeleteSidebarChannelsByPreferences(preferences); err != nil {
		return model.NewAppError("DeletePreferences", "api.preference.delete_preferences.update_sidebar.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventSidebarCategoryUpdated, "", "", userID, nil, "")
	// TODO this needs to be updated to include information on which categories changed
	a.Publish(message)

	message = model.NewWebSocketEvent(model.WebsocketEventPreferencesDeleted, "", "", userID, nil, "")
	prefsJSON, jsonErr := json.Marshal(preferences)
	if jsonErr != nil {
		return model.NewAppError("DeletePreferences", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("preferences", string(prefsJSON))
	a.Publish(message)

	return nil
}
