// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserTermsOfServiceIsValid(t *testing.T) {
	s := UserTermsOfService{}
	require.NotNil(t, s.IsValid(), "should be invalid")

	s.UserId = NewId()
	require.NotNil(t, s.IsValid(), "should be invalid")

	s.TermsOfServiceId = NewId()
	require.NotNil(t, s.IsValid(), "should be invalid")

	s.CreateAt = GetMillis()
	require.Nil(t, s.IsValid(), "should be valid")
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
