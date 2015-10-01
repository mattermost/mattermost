// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestPreferenceIsValid(t *testing.T) {
	preference := Preference{}

	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.UserId = NewId()
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Category = "1234garbage"
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Category = PREFERENCE_CATEGORY_DIRECT_CHANNELS
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Name = "1234garbage"
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.Name = PREFERENCE_NAME_SHOWHIDE
	if err := preference.IsValid(); err != nil {
		t.Fatal()
	}

	preference.AltId = "1234garbage"
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}

	preference.AltId = NewId()
	if err := preference.IsValid(); err != nil {
		t.Fatal()
	}

	preference.Value = "1234garbage"
	if err := preference.IsValid(); err != nil {
		t.Fatal()
	}

	preference.Value = strings.Repeat("01234567890", 20)
	if err := preference.IsValid(); err == nil {
		t.Fatal()
	}
}
