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
	PreferenceRecommendedNextSteps        = "recommended_next_steps"

	PreferenceCategoryTheme = "theme"
	// the name for theme props is the team id

	PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP = "oauth_app"
	// the name for oauth_app is the client_id and value is the current scope

	PREFERENCE_CATEGORY_LAST     = "last"
	PREFERENCE_NAME_LAST_CHANNEL = "channel"
	PREFERENCE_NAME_LAST_TEAM    = "team"

	PREFERENCE_CATEGORY_CUSTOM_STATUS            = "custom_status"
	PREFERENCE_NAME_RECENT_CUSTOM_STATUSES       = "recent_custom_statuses"
	PREFERENCE_NAME_CUSTOM_STATUS_TUTORIAL_STATE = "custom_status_tutorial_state"

	PREFERENCE_CUSTOM_STATUS_MODAL_VIEWED = "custom_status_modal_viewed"

	PREFERENCE_CATEGORY_NOTIFICATIONS = "notifications"
	PREFERENCE_NAME_EMAIL_INTERVAL    = "email_interval"

	PREFERENCE_EMAIL_INTERVAL_NO_BATCHING_SECONDS = "30"  // the "immediate" setting is actually 30s
	PREFERENCE_EMAIL_INTERVAL_BATCHING_SECONDS    = "900" // fifteen minutes is 900 seconds
	PREFERENCE_EMAIL_INTERVAL_IMMEDIATELY         = "immediately"
	PREFERENCE_EMAIL_INTERVAL_FIFTEEN             = "fifteen"
	PREFERENCE_EMAIL_INTERVAL_FIFTEEN_AS_SECONDS  = "900"
	PREFERENCE_EMAIL_INTERVAL_HOUR                = "hour"
	PREFERENCE_EMAIL_INTERVAL_HOUR_AS_SECONDS     = "3600"
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

	if o.Category == PREFERENCE_CATEGORY_THEME {
		var unused map[string]string
		if err := json.NewDecoder(strings.NewReader(o.Value)).Decode(&unused); err != nil {
			return NewAppError("Preference.IsValid", "model.preference.is_valid.theme.app_error", nil, "value="+o.Value, http.StatusBadRequest)
		}
	}

	return nil
}

func (o *Preference) PreUpdate() {
	if o.Category == PREFERENCE_CATEGORY_THEME {
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
