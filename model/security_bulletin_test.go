// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestSecurityBulletinToJson(t *testing.T) {
	b := SecurityBulletin{
		Id: "asdfghjkl",
		AppliesToVersion: "3.7.3",
	}

	j := b.ToJson()
	expected := `{"id":"asdfghjkl","applies_to_version":"3.7.3"}`
	CheckString(t, j, expected)
}

func TestSecurityBulletinFromJson(t *testing.T) {
	// Valid Security Bulletin JSON.
	s1 := `{"id":"asdfghjkl","applies_to_version":"3.7.3"}`
	b1 := SecurityBulletinFromJson(strings.NewReader(s1))

	CheckString(t, b1.AppliesToVersion, "3.7.3")

	CheckString(t, b1.Id, "asdfghjkl")

	// Malformed JSON
	s2 := `{"wat"`
	b2 := SecurityBulletinFromJson(strings.NewReader(s2))

	if b2 != nil {
		t.Fatal("expected nil")
	}
}

func TestSecurityBulletinsToJson(t *testing.T) {
	b := SecurityBulletins{
		{
			Id: "asdfghjkl",
			AppliesToVersion: "3.7.3",
		},
		{
			Id: "qwertyuiop",
			AppliesToVersion: "3.5.1",
		},
	}

	j := b.ToJson()

	expected := `[{"id":"asdfghjkl","applies_to_version":"3.7.3"},{"id":"qwertyuiop","applies_to_version":"3.5.1"}]`
	CheckString(t, j, expected)
}

func TestSecurityBulletinsFromJson(t *testing.T) {
	// Valid bulletins
	s1 := `[{"id":"asdfghjkl","applies_to_version":"3.7.3"},{"id":"qwertyuiop","applies_to_version":"3.7.3"}]`

	b1 := SecurityBulletinsFromJson(strings.NewReader(s1))

	CheckInt(t, len(b1), 2)

	// Malformed JSON
	s2 := `{"wat"`
	b2 := SecurityBulletinsFromJson(strings.NewReader(s2))

	CheckInt(t, len(b2), 0)
}
