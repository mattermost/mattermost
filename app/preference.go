// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
	"net/http"
)

func GetPreferencesForUser(userId string) (model.Preferences, *model.AppError) {
	if result := <-Srv.Store.Preference().GetAll(userId); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.(model.Preferences), nil
	}
}

func GetPreferenceByCategoryForUser(userId string, category string) (model.Preferences, *model.AppError) {
	if result := <-Srv.Store.Preference().GetCategory(userId, category); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else if len(result.Data.(model.Preferences)) == 0 {
		err := model.NewAppError("getPreferenceCategory", "api.preference.preferences_category.get.app_error", nil, "", http.StatusNotFound)
		return nil, err
	} else {
		return result.Data.(model.Preferences), nil
	}
}

func GetPreferenceByCategoryAndNameForUser(userId string, category string, preferenceName string) (*model.Preference, *model.AppError) {
	if result := <-Srv.Store.Preference().Get(userId, category, preferenceName); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		data := result.Data.(model.Preference)
		return &data, nil
	}
}

func UpdatePreferences(preferences model.Preferences) (bool, *model.AppError) {
	if result := <-Srv.Store.Preference().Save(&preferences); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return false, result.Err
	}

	return true, nil
}

func DeletePreferences(userId string, preferences model.Preferences) (bool, *model.AppError) {
	for _, preference := range preferences {
		if result := <-Srv.Store.Preference().Delete(userId, preference.Category, preference.Name); result.Err != nil {
			result.Err.StatusCode = http.StatusBadRequest
			return false, result.Err
		}
	}

	return true, nil
}
