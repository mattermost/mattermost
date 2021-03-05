// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelMemberJson(t *testing.T) {
	o := ChannelMember{ChannelId: NewId(), UserId: NewId()}
	json := o.ToJson()
	ro := ChannelMemberFromJson(strings.NewReader(json))

	require.Equal(t, o.ChannelId, ro.ChannelId, "ids do not match")
}

func TestChannelMemberIsValid(t *testing.T) {
	o := ChannelMember{}

	require.NotNil(t, o.IsValid(), "should be invalid")

	o.ChannelId = NewId()
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.NotifyProps = GetDefaultChannelNotifyProps()
	o.UserId = NewId()

	o.NotifyProps["desktop"] = "junk"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.NotifyProps["desktop"] = "123456789012345678901"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.NotifyProps["desktop"] = CHANNEL_NOTIFY_ALL
	require.Nil(t, o.IsValid(), "should be valid")

	o.NotifyProps["mark_unread"] = "123456789012345678901"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.NotifyProps["mark_unread"] = CHANNEL_MARK_UNREAD_ALL
	require.Nil(t, o.IsValid(), "should be valid")

	o.Roles = ""
	require.Nil(t, o.IsValid(), "should be invalid")
}

func TestChannelUnreadJson(t *testing.T) {
	o := ChannelUnread{ChannelId: NewId(), TeamId: NewId(), MsgCount: 5, MentionCount: 3}
	json := o.ToJson()
	ro := ChannelUnreadFromJson(strings.NewReader(json))

	require.Equal(t, o.TeamId, ro.TeamId, "team Ids do not match")
	require.Equal(t, o.MentionCount, ro.MentionCount, "mention count do not match")
}
