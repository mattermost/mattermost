// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTeamMemberJson(t *testing.T) {
	t.Run("empty string", func(t *testing.T) {
		tm, err := TeamMemberFromJson(strings.NewReader(""))
		require.Nil(t, tm)
		require.Error(t, err)
	})

	t.Run("invalid json", func(t *testing.T) {
		tm, err := TeamMemberFromJson(strings.NewReader("invalid"))
		require.Nil(t, tm)
		require.Error(t, err)
	})

	t.Run("valid json", func(t *testing.T) {
		o := TeamMember{TeamId: NewId(), UserId: NewId()}
		json := o.ToJson()
		ro, err := TeamMemberFromJson(strings.NewReader(json))
		require.Nil(t, err)
		require.Equal(t, o.TeamId, ro.TeamId, "Ids do not match")
	})
}

func TestTeamMemberIsValid(t *testing.T) {
	o := TeamMember{}

	require.Error(t, o.IsValid(), "should be invalid")

	o.TeamId = NewId()

	require.Error(t, o.IsValid(), "should be invalid")
}

func TestUnreadMemberJson(t *testing.T) {
	o := TeamUnread{TeamId: NewId(), MsgCount: 5, MentionCount: 3}
	json := o.ToJson()

	r := TeamUnreadFromJson(strings.NewReader(json))

	require.Equal(t, o.TeamId, r.TeamId, "Ids do not match")

	require.Equal(t, o.MsgCount, r.MsgCount, "MsgCount do not match")
}
