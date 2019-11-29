// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTeamMemberJson(t *testing.T) {
	o := TeamMember{TeamId: NewId(), UserId: NewId()}
	json := o.ToJson()
	ro := TeamMemberFromJson(strings.NewReader(json))

	require.Equal(t, o.TeamId, ro.TeamId, "Ids do not match")
}

func TestTeamMemberIsValid(t *testing.T) {
	o := TeamMember{}

	require.Error(t, o.IsValid(), "should be invalid")

	o.TeamId = NewId()

	require.Error(t, o.IsValid(), "should be invalid")

	/*o.UserId = NewId()
	o.Roles = "blahblah"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Roles = ""
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}*/
}

func TestUnreadMemberJson(t *testing.T) {
	o := TeamUnread{TeamId: NewId(), MsgCount: 5, MentionCount: 3}
	json := o.ToJson()

	r := TeamUnreadFromJson(strings.NewReader(json))

	require.Equal(t, o.TeamId, r.TeamId, "Ids do not match")

	require.Equal(t, o.MsgCount, r.MsgCount, "MsgCount do not match")
}
