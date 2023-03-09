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

	require.NotNil(t, preference.IsValid())

	preference.UserId = NewId()
	require.Nil(t, preference.IsValid())

	preference.Category = strings.Repeat("01234567890", 20)
	require.NotNil(t, preference.IsValid())

	preference.Category = PreferenceCategoryDirectChannelShow
	require.Nil(t, preference.IsValid())

	preference.Name = strings.Repeat("01234567890", 20)
	require.NotNil(t, preference.IsValid())

	preference.Name = NewId()
	require.Nil(t, preference.IsValid())

	preference.Value = strings.Repeat("01234567890", 201)
	require.NotNil(t, preference.IsValid())

	preference.Value = "1234garbage"
	require.Nil(t, preference.IsValid())

	preference.Category = PreferenceCategoryTheme
	require.NotNil(t, preference.IsValid())

	preference.Value = `{"color": "#ff0000", "color2": "#faf"}`
	require.Nil(t, preference.IsValid())
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
