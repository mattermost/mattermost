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

	assert.NotNil(t, s.IsValid(), "should be invalid")

	s.Id = NewId()
	assert.NotNil(t, s.IsValid(), "should be invalid")

	s.CreateAt = GetMillis()
	assert.NotNil(t, s.IsValid(), "should be invalid")

	s.UserId = NewId()
	assert.Nil(t, s.IsValid(), "should be valid")

	s.Text = strings.Repeat("0", PostMessageMaxRunesV2+1)
	assert.NotNil(t, s.IsValid(), "should be invalid")

	s.Text = strings.Repeat("0", PostMessageMaxRunesV2)
	assert.Nil(t, s.IsValid(), "should be valid")

	s.Text = "test"
	assert.Nil(t, s.IsValid(), "should be valid")
}
