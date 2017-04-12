// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestPreferenceIsValid(t *testing.T) {
	preference := Preference{
		UserId:   "1234garbage",
		Category: PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
		Name:     NewId(),
	}

	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.UserId = NewId()
	if err := preference.IsValid(); err != nil {
		t.Fatal(err)
	}

	preference.Category = strings.Repeat("01234567890", 20)
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Category = PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW
	if err := preference.IsValid(); err != nil {
		t.Fatal(err)
	}

	preference.Name = strings.Repeat("01234567890", 20)
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Name = NewId()
	if err := preference.IsValid(); err != nil {
		t.Fatal(err)
	}

	preference.Value = strings.Repeat("01234567890", 201)
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Value = "1234garbage"
	if err := preference.IsValid(); err != nil {
		t.Fatal(err)
	}

	preference.Category = PREFERENCE_CATEGORY_THEME
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Value = `{"color": "#ff0000", "color2": "#faf"}`
	if err := preference.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestPreferencePreUpdate(t *testing.T) {
	preference := Preference{
		Category: PREFERENCE_CATEGORY_THEME,
		Value:    `{"color": "#ff0000", "color2": "#faf", "codeTheme": "github", "invalid": "invalid"}`,
	}

	preference.PreUpdate()

	var props map[string]string
	if err := json.NewDecoder(strings.NewReader(preference.Value)).Decode(&props); err != nil {
		t.Fatal(err)
	}

	if props["color"] != "#ff0000" || props["color2"] != "#faf" || props["codeTheme"] != "github" {
		t.Fatal("shouldn't have changed valid props")
	}

	if props["invalid"] == "invalid" {
		t.Fatal("should have changed invalid prop")
	}
}
