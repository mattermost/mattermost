// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

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
