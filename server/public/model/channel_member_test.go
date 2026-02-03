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

func TestChannelMemberSanitizeForCurrentUser(t *testing.T) {
	currentUserId := NewId()
	otherUserId := NewId()
	channelId := NewId()

	t.Run("should not sanitize current user's own membership", func(t *testing.T) {
		member := &ChannelMember{
			ChannelId:    channelId,
			UserId:       currentUserId,
			LastViewedAt: 1234567890000,
			LastUpdateAt: 1234567890000,
			NotifyProps:  GetDefaultChannelNotifyProps(),
		}

		originalLastViewedAt := member.LastViewedAt
		originalLastUpdateAt := member.LastUpdateAt

		member.SanitizeForCurrentUser(currentUserId)

		assert.Equal(t, originalLastViewedAt, member.LastViewedAt, "LastViewedAt should not be sanitized for current user")
		assert.Equal(t, originalLastUpdateAt, member.LastUpdateAt, "LastUpdateAt should not be sanitized for current user")
	})

	t.Run("should sanitize other users' membership data", func(t *testing.T) {
		member := &ChannelMember{
			ChannelId:    channelId,
			UserId:       otherUserId,
			LastViewedAt: 1234567890000,
			LastUpdateAt: 1234567890000,
			NotifyProps:  GetDefaultChannelNotifyProps(),
		}

		member.SanitizeForCurrentUser(currentUserId)

		assert.Equal(t, int64(-1), member.LastViewedAt, "LastViewedAt should be sanitized for other users")
		assert.Equal(t, int64(-1), member.LastUpdateAt, "LastUpdateAt should be sanitized for other users")
	})

	t.Run("should preserve other fields when sanitizing", func(t *testing.T) {
		member := &ChannelMember{
			ChannelId:     channelId,
			UserId:        otherUserId,
			Roles:         "channel_user",
			LastViewedAt:  1234567890000,
			LastUpdateAt:  1234567890000,
			MsgCount:      100,
			MentionCount:  5,
			NotifyProps:   GetDefaultChannelNotifyProps(),
			SchemeUser:    true,
			SchemeAdmin:   false,
			ExplicitRoles: "",
		}

		originalRoles := member.Roles
		originalMsgCount := member.MsgCount
		originalMentionCount := member.MentionCount
		originalSchemeUser := member.SchemeUser
		originalSchemeAdmin := member.SchemeAdmin

		member.SanitizeForCurrentUser(currentUserId)

		assert.Equal(t, int64(-1), member.LastViewedAt, "LastViewedAt should be sanitized")
		assert.Equal(t, int64(-1), member.LastUpdateAt, "LastUpdateAt should be sanitized")
		assert.Equal(t, originalRoles, member.Roles, "Roles should be preserved")
		assert.Equal(t, originalMsgCount, member.MsgCount, "MsgCount should be preserved")
		assert.Equal(t, originalMentionCount, member.MentionCount, "MentionCount should be preserved")
		assert.Equal(t, originalSchemeUser, member.SchemeUser, "SchemeUser should be preserved")
		assert.Equal(t, originalSchemeAdmin, member.SchemeAdmin, "SchemeAdmin should be preserved")
	})
}
