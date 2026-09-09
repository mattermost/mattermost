// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
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

		assert.Equal(t, sanitizedTimestamp, member.LastViewedAt, "LastViewedAt should be marked sanitized for other users")
		assert.Equal(t, sanitizedTimestamp, member.LastUpdateAt, "LastUpdateAt should be marked sanitized for other users")
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

		assert.Equal(t, sanitizedTimestamp, member.LastViewedAt, "LastViewedAt should be marked sanitized")
		assert.Equal(t, sanitizedTimestamp, member.LastUpdateAt, "LastUpdateAt should be marked sanitized")
		assert.Equal(t, originalRoles, member.Roles, "Roles should be preserved")
		assert.Equal(t, originalMsgCount, member.MsgCount, "MsgCount should be preserved")
		assert.Equal(t, originalMentionCount, member.MentionCount, "MentionCount should be preserved")
		assert.Equal(t, originalSchemeUser, member.SchemeUser, "SchemeUser should be preserved")
		assert.Equal(t, originalSchemeAdmin, member.SchemeAdmin, "SchemeAdmin should be preserved")
	})
}

func TestChannelMemberMarshalJSON(t *testing.T) {
	currentUserId := NewId()
	otherUserId := NewId()

	newMember := func(userId string) ChannelMember {
		return ChannelMember{
			ChannelId:    NewId(),
			UserId:       userId,
			Roles:        "channel_user",
			LastViewedAt: 1234567890000,
			MsgCount:     100,
			LastUpdateAt: 1234567890000,
			NotifyProps:  GetDefaultChannelNotifyProps(),
		}
	}

	decode := func(t *testing.T, member ChannelMember) map[string]any {
		t.Helper()
		data, err := json.Marshal(member)
		require.NoError(t, err)

		fields := map[string]any{}
		require.NoError(t, json.Unmarshal(data, &fields))
		return fields
	}

	t.Run("keeps timestamps for the current user's own membership", func(t *testing.T) {
		member := newMember(currentUserId)
		member.SanitizeForCurrentUser(currentUserId)

		fields := decode(t, member)
		assert.EqualValues(t, 1234567890000, fields["last_viewed_at"])
		assert.EqualValues(t, 1234567890000, fields["last_update_at"])
	})

	t.Run("keeps a legitimate zero timestamp for the requester", func(t *testing.T) {
		member := newMember(currentUserId)
		member.LastViewedAt = 0
		member.LastUpdateAt = 0
		member.SanitizeForCurrentUser(currentUserId)

		fields := decode(t, member)
		assert.Contains(t, fields, "last_viewed_at", "the requester's own last_viewed_at of 0 (never viewed) must be serialized")
		assert.EqualValues(t, 0, fields["last_viewed_at"])
		assert.Contains(t, fields, "last_update_at", "the requester's own last_update_at of 0 must be serialized")
		assert.EqualValues(t, 0, fields["last_update_at"])
	})

	t.Run("omits sanitized timestamps for another user's membership", func(t *testing.T) {
		member := newMember(otherUserId)
		member.SanitizeForCurrentUser(currentUserId)

		fields := decode(t, member)
		assert.NotContains(t, fields, "last_viewed_at", "sanitized last_viewed_at must be omitted")
		assert.NotContains(t, fields, "last_update_at", "sanitized last_update_at must be omitted")

		assert.Equal(t, member.ChannelId, fields["channel_id"])
		assert.Equal(t, otherUserId, fields["user_id"])
		assert.Equal(t, "channel_user", fields["roles"])
		assert.EqualValues(t, 100, fields["msg_count"])
		assert.Contains(t, fields, "notify_props")
	})
}

func TestChannelMemberWithTeamDataMarshalJSON(t *testing.T) {
	currentUserId := NewId()
	otherUserId := NewId()

	newMember := func(userId string) ChannelMemberWithTeamData {
		return ChannelMemberWithTeamData{
			ChannelMember: ChannelMember{
				ChannelId:    NewId(),
				UserId:       userId,
				Roles:        "channel_user",
				LastViewedAt: 1234567890000,
				LastUpdateAt: 1234567890000,
				NotifyProps:  GetDefaultChannelNotifyProps(),
			},
			TeamDisplayName: "Test Team",
			TeamName:        "test-team",
			TeamUpdateAt:    987654321,
		}
	}

	decode := func(t *testing.T, member ChannelMemberWithTeamData) map[string]any {
		t.Helper()
		data, err := json.Marshal(member)
		require.NoError(t, err)

		fields := map[string]any{}
		require.NoError(t, json.Unmarshal(data, &fields))
		return fields
	}

	t.Run("preserves team data and timestamps for the current user", func(t *testing.T) {
		member := newMember(currentUserId)
		member.SanitizeForCurrentUser(currentUserId)

		fields := decode(t, member)
		assert.EqualValues(t, 1234567890000, fields["last_viewed_at"])
		assert.EqualValues(t, 1234567890000, fields["last_update_at"])
		assert.Equal(t, "Test Team", fields["team_display_name"])
		assert.Equal(t, "test-team", fields["team_name"])
		assert.EqualValues(t, 987654321, fields["team_update_at"])
	})

	t.Run("omits sanitized timestamps but keeps team data for another user", func(t *testing.T) {
		member := newMember(otherUserId)
		member.SanitizeForCurrentUser(currentUserId)

		fields := decode(t, member)
		assert.NotContains(t, fields, "last_viewed_at", "sanitized last_viewed_at must be omitted")
		assert.NotContains(t, fields, "last_update_at", "sanitized last_update_at must be omitted")

		assert.Equal(t, "Test Team", fields["team_display_name"])
		assert.Equal(t, "test-team", fields["team_name"])
		assert.EqualValues(t, 987654321, fields["team_update_at"])
		assert.Equal(t, otherUserId, fields["user_id"])
	})
}
