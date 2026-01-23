// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	// The primary key for the preference table is the combination of User.Id, Category, and Name.

	// PreferenceCategoryDirectChannelShow and PreferenceCategoryGroupChannelShow
	// are used to store the user's preferences for which channels to show in the sidebar.
	// The Name field is the channel ID.
	PreferenceCategoryDirectChannelShow = "direct_channel_show"
	PreferenceCategoryGroupChannelShow  = "group_channel_show"
	// PreferenceCategoryTutorialStep is used to store the user's progress in the tutorial.
	// The Name field is the user ID again (for whatever reason).
	PreferenceCategoryTutorialSteps = "tutorial_step"
	// PreferenceCategoryAdvancedSettings has settings for the user's advanced settings.
	// The Name field is the setting name. Possible values are:
	// - "formatting"
	// - "send_on_ctrl_enter"
	// - "join_leave"
	// - "unread_scroll_position"
	// - "sync_drafts"
	// - "feature_enabled_markdown_preview" <- deprecated in favor of "formatting"
	PreferenceCategoryAdvancedSettings = "advanced_settings"
	// PreferenceCategoryFlaggedPost is used to store the user's saved posts.
	// The Name field is the post ID.
	PreferenceCategoryFlaggedPost = "flagged_post"
	// PreferenceCategoryFavoriteChannel is used to store the user's favorite channels to be
	// shown in the sidebar. The Name field is the channel ID.
	PreferenceCategoryFavoriteChannel = "favorite_channel"
	// PreferenceCategorySidebarSettings is used to store the user's sidebar settings.
	// The Name field is the setting name. (ie. PreferenceNameShowUnreadSection or PreferenceLimitVisibleDmsGms)
	PreferenceCategorySidebarSettings = "sidebar_settings"
	// PreferenceCategoryDisplaySettings is used to store the user's various display settings.
	// The possible Name fields are:
	// - PreferenceNameUseMilitaryTime
	// - PreferenceNameCollapseSetting
	// - PreferenceNameMessageDisplay
	// - PreferenceNameCollapseConsecutive
	// - PreferenceNameColorizeUsernames
	// - PreferenceNameChannelDisplayMode
	// - PreferenceNameNameFormat
	PreferenceCategoryDisplaySettings = "display_settings"
	// PreferenceCategorySystemNotice is used store system admin notices.
	// Possible Name values are not defined here. It can be anything with the notice name.
	PreferenceCategorySystemNotice = "system_notice"
	// Deprecated: PreferenceCategoryLast is not used anymore.
	PreferenceCategoryLast = "last"
	// PreferenceCategoryCustomStatus is used to store the user's custom status preferences.
	// Possible Name values are:
	// - PreferenceNameRecentCustomStatuses
	// - PreferenceNameCustomStatusTutorialState
	// - PreferenceCustomStatusModalViewed
	PreferenceCategoryCustomStatus = "custom_status"
	// PreferenceCategoryNotifications is used to store the user's notification settings.
	// Possible Name values are:
	// - PreferenceNameEmailInterval
	PreferenceCategoryNotifications = "notifications"

	// Deprecated: PreferenceRecommendedNextSteps is not used anymore.
	// Use PreferenceCategoryRecommendedNextSteps instead.
	// PreferenceRecommendedNextSteps is actually a Category. The only possible
	// Name vaule is PreferenceRecommendedNextStepsHide for now.
	PreferenceRecommendedNextSteps         = PreferenceCategoryRecommendedNextSteps
	PreferenceCategoryRecommendedNextSteps = "recommended_next_steps"

	// PreferenceCategoryTheme has the name for the team id where theme is set.
	PreferenceCategoryTheme = "theme"

	PreferenceNameCollapsedThreadsEnabled = "collapsed_reply_threads"
	PreferenceNameChannelDisplayMode      = "channel_display_mode"
	PreferenceNameCollapseSetting         = "collapse_previews"
	PreferenceNameMessageDisplay          = "message_display"
	PreferenceNameCollapseConsecutive     = "collapse_consecutive_messages"
	PreferenceNameColorizeUsernames       = "colorize_usernames"
	PreferenceNameNameFormat              = "name_format"
	PreferenceNameUseMilitaryTime         = "use_military_time"

	PreferenceNameShowUnreadSection = "show_unread_section"
	PreferenceLimitVisibleDmsGms    = "limit_visible_dms_gms"

	PreferenceMaxLimitVisibleDmsGmsValue = 40
	MaxPreferenceValueLength             = 20000

	PreferenceCategoryAuthorizedOAuthApp = "oauth_app"
	// the name for oauth_app is the client_id and value is the current scope

	// Deprecated: PreferenceCategoryLastChannel is not used anymore.
	PreferenceNameLastChannel = "channel"
	// Deprecated: PreferenceCategoryLastTeam is not used anymore.
	PreferenceNameLastTeam = "team"

	PreferenceNameRecentCustomStatuses      = "recent_custom_statuses"
	PreferenceNameCustomStatusTutorialState = "custom_status_tutorial_state"
	PreferenceCustomStatusModalViewed       = "custom_status_modal_viewed"

	PreferenceNameEmailInterval = "email_interval"

	PreferenceEmailIntervalNoBatchingSeconds = "30"  // the "immediate" setting is actually 30s
	PreferenceEmailIntervalBatchingSeconds   = "900" // fifteen minutes is 900 seconds
	PreferenceEmailIntervalImmediately       = "immediately"
	PreferenceEmailIntervalFifteen           = "fifteen"
	PreferenceEmailIntervalFifteenAsSeconds  = "900"
	PreferenceEmailIntervalHour              = "hour"
	PreferenceEmailIntervalHourAsSeconds     = "3600"
	PreferenceCloudUserEphemeralInfo         = "cloud_user_ephemeral_info"

	PreferenceNameRecommendedNextStepsHide = "hide"
)

type Preference struct {
	UserId   string `json:"user_id"`
	Category string `json:"category"`
	Name     string `json:"name"`
	Value    string `json:"value"`
}

type Preferences []Preference

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

	if utf8.RuneCountInString(o.Value) > MaxPreferenceValueLength {
		return NewAppError("Preference.IsValid", "model.preference.is_valid.value.app_error", nil, "value="+o.Value, http.StatusBadRequest)
	}

	if o.Category == PreferenceCategoryTheme {
		var unused map[string]string
		if err := json.NewDecoder(strings.NewReader(o.Value)).Decode(&unused); err != nil {
			return NewAppError("Preference.IsValid", "model.preference.is_valid.theme.app_error", nil, "value="+o.Value, http.StatusBadRequest).Wrap(err)
		}
	}

	if o.Category == PreferenceCategorySidebarSettings && o.Name == PreferenceLimitVisibleDmsGms {
		visibleDmsGmsValue, convErr := strconv.Atoi(o.Value)
		if convErr != nil || visibleDmsGmsValue < 1 || visibleDmsGmsValue > PreferenceMaxLimitVisibleDmsGmsValue {
			return NewAppError("Preference.IsValid", "model.preference.is_valid.limit_visible_dms_gms.app_error", nil, "value="+o.Value, http.StatusBadRequest)
		}
	}

	return nil
}

var preUpdateColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$`)

func (o *Preference) PreUpdate() {
	if o.Category == PreferenceCategoryTheme {
		// decode the value of theme (a map of strings to string) and eliminate any invalid values
		var props map[string]string
		// just continue, the invalid preference value should get caught by IsValid before saving
		json.NewDecoder(strings.NewReader(o.Value)).Decode(&props)

		// blank out any invalid theme values
		for name, value := range props {
			if name == "image" || name == "type" || name == "codeTheme" {
				continue
			}

			if !preUpdateColorPattern.MatchString(value) {
				props[name] = "#ffffff"
			}
		}

		if b, err := json.Marshal(props); err == nil {
			o.Value = string(b)
		}
	}
}
