// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

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

	o.NotifyProps["desktop"] = ChannelNotifyAll
	require.Nil(t, o.IsValid(), "should be valid")

	o.NotifyProps["mark_unread"] = "123456789012345678901"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.NotifyProps["mark_unread"] = ChannelMarkUnreadAll
	require.Nil(t, o.IsValid(), "should be valid")

	o.Roles = ""
	require.Nil(t, o.IsValid(), "should be invalid")

	o.NotifyProps["property"] = strings.Repeat("Z", ChannelMemberNotifyPropsMaxRunes)
	require.NotNil(t, o.IsValid(), "should be invalid")
}
