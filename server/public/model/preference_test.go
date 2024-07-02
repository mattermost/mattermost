// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPreferenceIsValid(t *testing.T) {
	preference := Preference{
		UserId:   "1234garbage",
		Category: PreferenceCategoryDirectChannelShow,
		Name:     NewId(),
	}

	t.Run("should require a user ID", func(t *testing.T) {
		require.NotNil(t, preference.IsValid())

		preference.UserId = NewId()
		require.Nil(t, preference.IsValid())
	})

	t.Run("should require a valid category", func(t *testing.T) {
		preference.Category = strings.Repeat("01234567890", 20)
		require.NotNil(t, preference.IsValid())

		preference.Category = PreferenceCategoryDirectChannelShow
		require.Nil(t, preference.IsValid())
	})

	t.Run("should require a valid name", func(t *testing.T) {
		preference.Name = strings.Repeat("01234567890", 20)
		require.NotNil(t, preference.IsValid())

		preference.Name = NewId()
		require.Nil(t, preference.IsValid())
	})

	t.Run("should require a valid value", func(t *testing.T) {
		preference.Value = strings.Repeat("01234567890", 2001)
		require.NotNil(t, preference.IsValid())

		preference.Value = "1234garbage"
		require.Nil(t, preference.IsValid())
	})

	t.Run("should validate that a theme preference's value is a map", func(t *testing.T) {
		preference.Category = PreferenceCategoryTheme
		require.NotNil(t, preference.IsValid())

		preference.Value = `{"color": "#ff0000", "color2": "#faf"}`
		require.Nil(t, preference.IsValid())
	})

	t.Run("MM-57913 should be able to store an array of 200 IDs for the team sidebar order preference", func(t *testing.T) {
		preference.Category = "teams_order"
		preference.Name = ""

		teamIds := make([]string, 200)
		for i := range teamIds {
			teamIds[i] = NewId()
		}
		teamIdsBytes, _ := json.Marshal(teamIds)
		preference.Value = string(teamIdsBytes)

		require.Nil(t, preference.IsValid())
	})

	t.Run("limit_visible_dms_gms has a valid value", func(t *testing.T) {
		preference.Category = PreferenceCategorySidebarSettings
		preference.Name = PreferenceLimitVisibleDmsGms
		preference.Value = "40"
		require.Nil(t, preference.IsValid())
	})

	t.Run("limit_visible_dms_gms has a value greater than PreferenceMaxLimitVisibleDmsGmsValue", func(t *testing.T) {
		preference.Category = PreferenceCategorySidebarSettings
		preference.Name = PreferenceLimitVisibleDmsGms
		preference.Value = "10000"
		require.NotNil(t, preference.IsValid())
	})

	t.Run("limit_visible_dms_gms has an invalid value", func(t *testing.T) {
		preference.Category = PreferenceCategorySidebarSettings
		preference.Name = PreferenceLimitVisibleDmsGms
		preference.Value = "one thousand"
		require.NotNil(t, preference.IsValid())
	})

	t.Run("limit_visible_dms_gms has a negative number", func(t *testing.T) {
		preference.Category = PreferenceCategorySidebarSettings
		preference.Name = PreferenceLimitVisibleDmsGms
		preference.Value = "-10"
		require.NotNil(t, preference.IsValid())
	})
}

func TestPreferencePreUpdate(t *testing.T) {
	preference := Preference{
		Category: PreferenceCategoryTheme,
		Value:    `{"color": "#ff0000", "color2": "#faf", "codeTheme": "github", "invalid": "invalid"}`,
	}

	preference.PreUpdate()

	var props map[string]string
	require.NoError(t, json.NewDecoder(strings.NewReader(preference.Value)).Decode(&props))

	require.Equal(t, "#ff0000", props["color"], "shouldn't have changed valid props")
	require.Equal(t, "#faf", props["color2"], "shouldn't have changed valid props")
	require.Equal(t, "github", props["codeTheme"], "shouldn't have changed valid props")

	require.NotEqual(t, "invalid", props["invalid"], "should have changed invalid prop")
}
