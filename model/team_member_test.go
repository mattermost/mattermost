// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTeamMemberIsValid(t *testing.T) {
	o := TeamMember{}
	require.NotNil(t, o.IsValid(), "should be invalid")
	o.TeamId = NewId()
	require.NotNil(t, o.IsValid(), "should be invalid")
}
