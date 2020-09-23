// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTermsOfServiceIsValid(t *testing.T) {
	s := TermsOfService{}

	assert.Error(t, s.IsValid(), "should be invalid")

	s.Id = NewId()
	assert.Error(t, s.IsValid(), "should be invalid")

	s.CreateAt = GetMillis()
	assert.Error(t, s.IsValid(), "should be invalid")

	s.UserId = NewId()
	assert.Error(t, s.IsValid(), "should be invalid")

	s.Text = strings.Repeat("0", POST_MESSAGE_MAX_RUNES_V2+1)
	assert.Error(t, s.IsValid(), "should be invalid")

	s.Text = strings.Repeat("0", POST_MESSAGE_MAX_RUNES_V2)
	assert.Nil(t, s.IsValid(), "should be valid")

	s.Text = "test"
	assert.Nil(t, s.IsValid(), "should be valid")
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
