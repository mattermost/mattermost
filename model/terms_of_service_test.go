// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTermsOfServiceIsValid(t *testing.T) {
	s := TermsOfService{}

	require.Error(t, s.IsValid(), "should be invalid")

	s.Id = NewId()
	require.Error(t, s.IsValid(), "should be invalid")

	s.CreateAt = GetMillis()
	require.Error(t, s.IsValid(), "should be invalid")

	s.UserId = NewId()
	require.Error(t, s.IsValid(), "should be invalid")

	s.Text = strings.Repeat("0", POST_MESSAGE_MAX_RUNES_V2+1)
	require.Error(t, s.IsValid(), "should be invalid")

	s.Text = strings.Repeat("0", POST_MESSAGE_MAX_RUNES_V2)
	require.Nil(t, s.IsValid(), "should be valid")

	s.Text = "test"
	require.Nil(t, s.IsValid(), "should be valid")
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
