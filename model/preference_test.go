// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
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
		t.Fatal()
	}

	preference.Name = strings.Repeat("01234567890", 20)
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Name = NewId()
	if err := preference.IsValid(); err != nil {
		t.Fatal()
	}

	preference.Value = strings.Repeat("01234567890", 20)
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Value = "1234garbage"
	if err := preference.IsValid(); err != nil {
		t.Fatal()
	}
}
