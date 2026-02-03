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

func (a *App) GetPreferencesForUser(rctx request.CTX, userID string) (model.Preferences, *model.AppError) {
	preferences, err := a.Srv().Store().Preference().GetAll(userID)
	if err != nil {
		return nil, model.NewAppError("GetPreferencesForUser", "app.preference.get_all.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	return a.applyPreferenceOverrides(preferences), nil
}

// applyPreferenceOverrides applies admin-enforced preference overrides to the given preferences.
// This ensures users always see the admin-enforced values for overridden settings.
func (a *App) applyPreferenceOverrides(preferences model.Preferences) model.Preferences {
	overrides := a.Config().MattermostExtendedSettings.Preferences.Overrides
	if len(overrides) == 0 {
		return preferences
	}

	for i, pref := range preferences {
		key := pref.Category + ":" + pref.Name
		if enforcedValue, ok := overrides[key]; ok {
			preferences[i].Value = enforcedValue
		}
	}
	return preferences
}

// isPreferenceOverridden checks if a preference is admin-enforced.
func (a *App) isPreferenceOverridden(category, name string) bool {
	overrides := a.Config().MattermostExtendedSettings.Preferences.Overrides
	if len(overrides) == 0 {
		return false
	}
	key := category + ":" + name
	_, isOverridden := overrides[key]
	return isOverridden
}

func (a *App) GetPreferenceByCategoryForUser(rctx request.CTX, userID string, category string) (model.Preferences, *model.AppError) {
	preferences, err := a.Srv().Store().Preference().GetCategory(userID, category)
	if err != nil {
		return nil, model.NewAppError("GetPreferenceByCategoryForUser", "app.preference.get_category.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	if len(preferences) == 0 {
		err := model.NewAppError("GetPreferenceByCategoryForUser", "api.preference.preferences_category.get.app_error", nil, "", http.StatusNotFound)
		return nil, err
	}
	return a.applyPreferenceOverrides(preferences), nil
}

func (a *App) GetPreferenceByCategoryAndNameForUser(rctx request.CTX, userID string, category string, preferenceName string) (*model.Preference, *model.AppError) {
	res, err := a.Srv().Store().Preference().Get(userID, category, preferenceName)
	if err != nil {
		return nil, model.NewAppError("GetPreferenceByCategoryAndNameForUser", "app.preference.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	// Apply override if this preference is admin-enforced
	overrides := a.Config().MattermostExtendedSettings.Preferences.Overrides
	if len(overrides) > 0 {
		key := category + ":" + preferenceName
		if enforcedValue, ok := overrides[key]; ok {
			res.Value = enforcedValue
		}
	}

	return res, nil
}

func (a *App) UpdatePreferences(rctx request.CTX, userID string, preferences model.Preferences) *model.AppError {
	for _, preference := range preferences {
		if userID != preference.UserId {
			return model.NewAppError("savePreferences", "api.preference.update_preferences.set.app_error", nil,
				"userId="+userID+", preference.UserId="+preference.UserId, http.StatusForbidden)
		}
	}

	// Block updates to admin-enforced preferences
	overrides := a.Config().MattermostExtendedSettings.Preferences.Overrides
	if len(overrides) > 0 {
		for _, pref := range preferences {
			key := pref.Category + ":" + pref.Name
			if _, isOverridden := overrides[key]; isOverridden {
				return model.NewAppError("UpdatePreferences", "api.preference.update_preferences.admin_enforced.app_error",
					map[string]any{"Category": pref.Category, "Name": pref.Name},
					"preference is admin-enforced", http.StatusForbidden)
			}
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

	pluginContext := pluginContext(rctx)
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			hooks.PreferencesHaveChanged(pluginContext, preferences)
			return true
		}, plugin.PreferencesHaveChangedID)
	})

	return nil
}

func (a *App) DeletePreferences(rctx request.CTX, userID string, preferences model.Preferences) *model.AppError {
	for _, preference := range preferences {
		if userID != preference.UserId {
			err := model.NewAppError("DeletePreferences", "api.preference.delete_preferences.delete.app_error", nil,
				"userId="+userID+", preference.UserId="+preference.UserId, http.StatusForbidden)
			return err
		}
	}

	// Block deletion of admin-enforced preferences
	overrides := a.Config().MattermostExtendedSettings.Preferences.Overrides
	if len(overrides) > 0 {
		for _, pref := range preferences {
			key := pref.Category + ":" + pref.Name
			if _, isOverridden := overrides[key]; isOverridden {
				return model.NewAppError("DeletePreferences", "api.preference.delete_preferences.admin_enforced.app_error",
					map[string]any{"Category": pref.Category, "Name": pref.Name},
					"preference is admin-enforced", http.StatusForbidden)
			}
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

// GetDistinctPreferences returns all unique preference keys (category:name pairs) from the database.
// This is used by the admin panel to discover available preferences for override configuration.
// Requires system admin permission.
func (a *App) GetDistinctPreferences() ([]model.PreferenceKey, *model.AppError) {
	keys, err := a.Srv().Store().Preference().GetDistinctPreferences()
	if err != nil {
		return nil, model.NewAppError("GetDistinctPreferences", "app.preference.get_distinct.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return keys, nil
}
