// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTermsOfServiceIsValid(t *testing.T) {
	s := TermsOfService{}

	if err := s.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	s.Id = NewId()
	if err := s.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	s.CreateAt = GetMillis()
	if err := s.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	s.UserId = NewId()
	if err := s.IsValid(); err != nil {
		t.Fatal("should be invalid")
	}

	s.Text = strings.Repeat("0", POST_MESSAGE_MAX_RUNES_V2+1)
	if err := s.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	s.Text = strings.Repeat("0", POST_MESSAGE_MAX_RUNES_V2)
	if err := s.IsValid(); err != nil {
		t.Fatal(err)
	}

	s.Text = "test"
	if err := s.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestTermsOfServiceJson(t *testing.T) {
	o := TermsOfService{
		Id:       NewId(),
		Text:     NewId(),
		CreateAt: GetMillis(),
		UserId:   NewId(),
	}
	j := o.ToJson()
	ro := TermsOfServiceFromJson(strings.NewReader(j))

	assert.NotNil(t, ro)
	assert.Equal(t, o, *ro)
}
