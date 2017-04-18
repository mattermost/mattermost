// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestSecurityBulletinToFromJson(t *testing.T) {
	b := SecurityBulletin{
		Id:               NewId(),
		AppliesToVersion: NewId(),
	}

	j := b.ToJson()
	b1 := SecurityBulletinFromJson(strings.NewReader(j))

	CheckString(t, b1.AppliesToVersion, b.AppliesToVersion)
	CheckString(t, b1.Id, b.Id)

	// Malformed JSON
	s2 := `{"wat"`
	b2 := SecurityBulletinFromJson(strings.NewReader(s2))

	if b2 != nil {
		t.Fatal("expected nil")
	}
}

func TestSecurityBulletinsToFromJson(t *testing.T) {
	b := SecurityBulletins{
		{
			Id:               NewId(),
			AppliesToVersion: NewId(),
		},
		{
			Id:               NewId(),
			AppliesToVersion: NewId(),
		},
	}

	j := b.ToJson()

	b1 := SecurityBulletinsFromJson(strings.NewReader(j))

	CheckInt(t, len(b1), 2)

	// Malformed JSON
	s2 := `{"wat"`
	b2 := SecurityBulletinsFromJson(strings.NewReader(s2))

	CheckInt(t, len(b2), 0)
}
