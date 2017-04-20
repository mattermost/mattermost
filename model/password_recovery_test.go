// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestPasswordRecoveryIsValid(t *testing.T) {
	// Valid example.
	p := PasswordRecovery{
		UserId:   NewId(),
		Code:     strings.Repeat("a", 128),
		CreateAt: GetMillis(),
	}

	if err := p.IsValid(); err != nil {
		t.Fatal(err)
	}

	// Various invalid ones.
	p.UserId = "abc"
	if err := p.IsValid(); err == nil {
		t.Fatal("Should have failed validation")
	}

	p.UserId = NewId()
	p.Code = "abc"
	if err := p.IsValid(); err == nil {
		t.Fatal("Should have failed validation")
	}

	p.Code = strings.Repeat("a", 128)
	p.CreateAt = 0
	if err := p.IsValid(); err == nil {
		t.Fatal("Should have failed validation")
	}
}

func TestPasswordRecoveryPreSave(t *testing.T) {
	p := PasswordRecovery{
		UserId: NewId(),
	}

	// Check it's valid after running PreSave
	p.PreSave()

	if err := p.IsValid(); err != nil {
		t.Fatal(err)
	}
}
