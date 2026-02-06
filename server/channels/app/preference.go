// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GetPreferencesForUser(rctx request.CTX, userID string) (model.Preferences, *model.AppError) {
	preferences, err := a.Srv().Store().Preference().GetAll(userID)
	if err != nil {
		return nil, model.NewAppError("GetPreferencesForUser", "app.preference.get_all.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	return a.applyPreferenceOverrides(userID, preferences, ""), nil
}

// applyPreferenceOverrides applies admin-enforced preference overrides to the given preferences.
// This ensures users always see the admin-enforced values for overridden settings.
// It both modifies existing preferences AND injects any overrides that don't exist yet.
// If filterCategory is non-empty, only overrides matching that category are injected.
func (a *App) applyPreferenceOverrides(userID string, preferences model.Preferences, filterCategory string) model.Preferences {
	overrides := a.Config().MattermostExtendedSettings.Preferences.Overrides
	if len(overrides) == 0 {
		return preferences
	}

	// Track which override keys we've already applied
	appliedKeys := make(map[string]bool)

	// First, modify any existing preferences that have overrides
	for i, pref := range preferences {
		key := pref.Category + ":" + pref.Name
		if enforcedValue, ok := overrides[key]; ok {
			preferences[i].Value = enforcedValue
			appliedKeys[key] = true
		}
	}

	// Then, inject any overrides that don't exist in the user's preferences
	for key, enforcedValue := range overrides {
		if appliedKeys[key] {
			continue // Already applied
		}

		// Parse the key into category:name
		parts := strings.SplitN(key, ":", 2)
		if len(parts) != 2 {
			continue // Invalid key format
		}

		category := parts[0]
		name := parts[1]

		// If filtering by category, skip overrides from other categories
		if filterCategory != "" && category != filterCategory {
			continue
		}

		// Add the override as a new preference
		preferences = append(preferences, model.Preference{
			UserId:   userID,
			Category: category,
			Name:     name,
			Value:    enforcedValue,
		})
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
	// Apply overrides even if no preferences exist yet - overrides may need to be injected
	preferences = a.applyPreferenceOverrides(userID, preferences, category)
	if len(preferences) == 0 {
		err := model.NewAppError("GetPreferenceByCategoryForUser", "api.preference.preferences_category.get.app_error", nil, "", http.StatusNotFound)
		return nil, err
	}
	return preferences, nil
}

func (a *App) GetPreferenceByCategoryAndNameForUser(rctx request.CTX, userID string, category string, preferenceName string) (*model.Preference, *model.AppError) {
	// Check if there's an admin override for this preference
	overrides := a.Config().MattermostExtendedSettings.Preferences.Overrides
	key := category + ":" + preferenceName
	var enforcedValue string
	var hasOverride bool
	if len(overrides) > 0 {
		enforcedValue, hasOverride = overrides[key]
	}

	res, err := a.Srv().Store().Preference().Get(userID, category, preferenceName)
	if err != nil {
		// If the preference doesn't exist in DB but we have an override, return the override
		if hasOverride {
			return &model.Preference{
				UserId:   userID,
				Category: category,
				Name:     preferenceName,
				Value:    enforcedValue,
			}, nil
		}
		return nil, model.NewAppError("GetPreferenceByCategoryAndNameForUser", "app.preference.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	// Apply override if this preference is admin-enforced
	if hasOverride {
		res.Value = enforcedValue
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

	// Filter out admin-enforced preferences instead of blocking the entire batch.
	// This allows users to save other preferences when one happens to be enforced.
	overrides := a.Config().MattermostExtendedSettings.Preferences.Overrides
	if len(overrides) > 0 {
		filteredPreferences := make(model.Preferences, 0, len(preferences))
		for _, pref := range preferences {
			key := pref.Category + ":" + pref.Name
			if _, isOverridden := overrides[key]; !isOverridden {
				filteredPreferences = append(filteredPreferences, pref)
			}
		}

		// If all preferences were filtered out (all enforced), return error
		if len(filteredPreferences) == 0 {
			return model.NewAppError("UpdatePreferences", "api.preference.update_preferences.admin_enforced.app_error",
				nil, "all preferences in batch are admin-enforced", http.StatusForbidden)
		}

		// Use the filtered list for saving
		preferences = filteredPreferences
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

// PushPreferenceToAllUsers pushes a preference value directly into the database for all active users.
// If overwriteExisting is true, existing values are updated; otherwise only users who don't have
// the preference yet will get the new value.
func (a *App) PushPreferenceToAllUsers(category, name, value string, overwriteExisting bool) (int64, *model.AppError) {
	affected, err := a.Srv().Store().Preference().PushPreferenceToAllUsers(category, name, value, overwriteExisting)
	if err != nil {
		return 0, model.NewAppError("PushPreferenceToAllUsers", "app.preference.push.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return affected, nil
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
