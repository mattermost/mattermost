// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestUserTermsOfServiceIsValid(t *testing.T) {
	s := UserTermsOfService{}

	if err := s.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	s.UserId = NewId()
	if err := s.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	s.TermsOfServiceId = NewId()
	if err := s.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	s.CreateAt = GetMillis()
	if err := s.IsValid(); err != nil {
		t.Fatal("should be valid")
	}
}

func TestUserTermsOfServiceJson(t *testing.T) {
	o := UserTermsOfService{
		UserId:           NewId(),
		TermsOfServiceId: NewId(),
		CreateAt:         GetMillis(),
	}
	j := o.ToJson()
	ro := UserTermsOfServiceFromJson(strings.NewReader(j))

	assert.NotNil(t, ro)
	assert.Equal(t, o, *ro)
}
