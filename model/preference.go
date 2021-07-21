// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW = "direct_channel_show"
	PREFERENCE_CATEGORY_GROUP_CHANNEL_SHOW  = "group_channel_show"
	PREFERENCE_CATEGORY_TUTORIAL_STEPS      = "tutorial_step"
	PREFERENCE_CATEGORY_ADVANCED_SETTINGS   = "advanced_settings"
	PREFERENCE_CATEGORY_FLAGGED_POST        = "flagged_post"
	PREFERENCE_CATEGORY_FAVORITE_CHANNEL    = "favorite_channel"
	PREFERENCE_CATEGORY_SIDEBAR_SETTINGS    = "sidebar_settings"

	PREFERENCE_CATEGORY_DISPLAY_SETTINGS      = "display_settings"
	PREFERENCE_NAME_COLLAPSED_THREADS_ENABLED = "collapsed_reply_threads"
	PREFERENCE_NAME_CHANNEL_DISPLAY_MODE      = "channel_display_mode"
	PREFERENCE_NAME_COLLAPSE_SETTING          = "collapse_previews"
	PREFERENCE_NAME_MESSAGE_DISPLAY           = "message_display"
	PREFERENCE_NAME_NAME_FORMAT               = "name_format"
	PREFERENCE_NAME_USE_MILITARY_TIME         = "use_military_time"
	PREFERENCE_RECOMMENDED_NEXT_STEPS         = "recommended_next_steps"

	PREFERENCE_CATEGORY_THEME           = "theme"
	PreferenceCategoryDirectChannelShow = "direct_channel_show"
	PreferenceCategoryGroupChannelShow  = "group_channel_show"
	PreferenceCategoryTutorialSteps     = "tutorial_step"
	PreferenceCategoryAdvancedSettings  = "advanced_settings"
	PreferenceCategoryFlaggedPost       = "flagged_post"
	PreferenceCategoryFavoriteChannel   = "favorite_channel"
	PreferenceCategorySidebarSettings   = "sidebar_settings"

	PreferenceCategoryDisplaySettings     = "display_settings"
	PreferenceNameCollapsedThreadsEnabled = "collapsed_reply_threads"
	PreferenceNameChannelDisplayMode      = "channel_display_mode"
	PreferenceNameCollapseSetting         = "collapse_previews"
	PreferenceNameMessageDisplay          = "message_display"
	PreferenceNameNameFormat              = "name_format"
	PreferenceNameUseMilitaryTime         = "use_military_time"

	PreferenceCategoryTheme = "theme"
	// the name for theme props is the team id

	PreferenceCategoryAuthorizedOAuthApp = "oauth_app"
	// the name for oauth_app is the client_id and value is the current scope

	PreferenceCategoryLast    = "last"
	PreferenceNameLastChannel = "channel"
	PreferenceNameLastTeam    = "team"

	PreferenceCategoryCustomStatus          = "custom_status"
	PreferenceNameRecentCustomStatuses      = "recent_custom_statuses"
	PreferenceNameCustomStatusTutorialState = "custom_status_tutorial_state"

	PreferenceCustomStatusModalViewed = "custom_status_modal_viewed"

	PreferenceCategoryNotifications = "notifications"
	PreferenceNameEmailInterval     = "email_interval"

	PreferenceEmailIntervalNoBatchingSeconds = "30"  // the "immediate" setting is actually 30s
	PreferenceEmailIntervalBatchingSeconds   = "900" // fifteen minutes is 900 seconds
	PreferenceEmailIntervalImmediately       = "immediately"
	PreferenceEmailIntervalFifteen           = "fifteen"
	PreferenceEmailIntervalFifteenAsSeconds  = "900"
	PreferenceEmailIntervalHour              = "hour"
	PreferenceEmailIntervalHourAsSeconds     = "3600"
)

type Preference struct {
	UserId   string `json:"user_id"`
	Category string `json:"category"`
	Name     string `json:"name"`
	Value    string `json:"value"`
}

func (o *Preference) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func PreferenceFromJson(data io.Reader) *Preference {
	var o *Preference
	json.NewDecoder(data).Decode(&o)
	return o
}

func (o *Preference) IsValid() *AppError {
	if !IsValidId(o.UserId) {
		return NewAppError("Preference.IsValid", "model.preference.is_valid.id.app_error", nil, "user_id="+o.UserId, http.StatusBadRequest)
	}

	if o.Category == "" || len(o.Category) > 32 {
		return NewAppError("Preference.IsValid", "model.preference.is_valid.category.app_error", nil, "category="+o.Category, http.StatusBadRequest)
	}

	if len(o.Name) > 32 {
		return NewAppError("Preference.IsValid", "model.preference.is_valid.name.app_error", nil, "name="+o.Name, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Value) > 2000 {
		return NewAppError("Preference.IsValid", "model.preference.is_valid.value.app_error", nil, "value="+o.Value, http.StatusBadRequest)
	}

	if o.Category == PreferenceCategoryTheme {
		var unused map[string]string
		if err := json.NewDecoder(strings.NewReader(o.Value)).Decode(&unused); err != nil {
			return NewAppError("Preference.IsValid", "model.preference.is_valid.theme.app_error", nil, "value="+o.Value, http.StatusBadRequest)
		}
	}

	return nil
}

func (o *Preference) PreUpdate() {
	if o.Category == PreferenceCategoryTheme {
		// decode the value of theme (a map of strings to string) and eliminate any invalid values
		var props map[string]string
		if err := json.NewDecoder(strings.NewReader(o.Value)).Decode(&props); err != nil {
			// just continue, the invalid preference value should get caught by IsValid before saving
			return
		}

		colorPattern := regexp.MustCompile(`^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$`)

		// blank out any invalid theme values
		for name, value := range props {
			if name == "image" || name == "type" || name == "codeTheme" {
				continue
			}

			if !colorPattern.MatchString(value) {
				props[name] = "#ffffff"
			}
		}

		if b, err := json.Marshal(props); err == nil {
			o.Value = string(b)
		}
	}
}
