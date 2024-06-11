// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelMemberIsValid(t *testing.T) {
	o := ChannelMember{}

	require.NotNil(t, o.IsValid(), "should be invalid")

	o.ChannelId = NewId()
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.UserId = NewId()
	require.NotNil(t, o.IsValid(), "should be invalid because of missing notify props")

	o.NotifyProps = GetDefaultChannelNotifyProps()
	require.Nil(t, o.IsValid(), "should be valid")

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

func TestIsChannelMemberNotifyPropsValid(t *testing.T) {
	t.Run("should require certain fields unless allowMissingFields is true", func(t *testing.T) {
		notifyProps := map[string]string{}

		err := IsChannelMemberNotifyPropsValid(notifyProps, false)
		assert.NotNil(t, err)

		err = IsChannelMemberNotifyPropsValid(notifyProps, true)
		assert.Nil(t, err)
	})
}
