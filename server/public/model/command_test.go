// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCommandIsValid(t *testing.T) {
	o := Command{
		Id:          NewId(),
		Token:       NewId(),
		CreateAt:    GetMillis(),
		UpdateAt:    GetMillis(),
		CreatorId:   NewId(),
		TeamId:      NewId(),
		Trigger:     "trigger",
		URL:         "http://example.com",
		Method:      CommandMethodGet,
		DisplayName: "",
		Description: "",
	}

	require.Nil(t, o.IsValid())

	o.Id = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Id = NewId()
	require.Nil(t, o.IsValid())

	o.Token = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Token = NewId()
	require.Nil(t, o.IsValid())

	o.CreateAt = 0
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.CreateAt = GetMillis()
	require.Nil(t, o.IsValid())

	o.UpdateAt = 0
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.UpdateAt = GetMillis()
	require.Nil(t, o.IsValid())

	o.CreatorId = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.CreatorId = NewId()
	require.Nil(t, o.IsValid())

	o.TeamId = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.TeamId = NewId()
	require.Nil(t, o.IsValid())

	o.Trigger = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Trigger = strings.Repeat("1", 129)
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Trigger = strings.Repeat("1", 128)
	require.Nil(t, o.IsValid())

	o.URL = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.URL = "1234"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.URL = "https:////example.com"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.URL = "https://example.com"
	require.Nil(t, o.IsValid())

	o.Method = "https://example.com"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Method = CommandMethodGet
	require.Nil(t, o.IsValid())

	o.Method = CommandMethodPost
	require.Nil(t, o.IsValid())

	o.DisplayName = strings.Repeat("1", 65)
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.DisplayName = strings.Repeat("1", 64)
	require.Nil(t, o.IsValid())

	o.Description = strings.Repeat("1", 129)
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Description = strings.Repeat("1", 128)
	require.Nil(t, o.IsValid())
}

func TestCommandIsValidAllowedFields(t *testing.T) {
	base := Command{
		Id:          NewId(),
		Token:       NewId(),
		CreateAt:    GetMillis(),
		UpdateAt:    GetMillis(),
		CreatorId:   NewId(),
		TeamId:      NewId(),
		Trigger:     "trigger",
		URL:         "http://example.com",
		Method:      CommandMethodGet,
		DisplayName: "",
		Description: "",
	}

	t.Run("valid with empty restriction fields", func(t *testing.T) {
		o := base
		require.Nil(t, o.IsValid())
	})

	t.Run("valid with allowed roles", func(t *testing.T) {
		o := base
		o.AllowedRoles = "system_admin team_admin"
		require.Nil(t, o.IsValid())
	})

	t.Run("invalid with too long allowed roles", func(t *testing.T) {
		o := base
		o.AllowedRoles = strings.Repeat("a", 1025)
		require.NotNil(t, o.IsValid())
	})

	t.Run("invalid with too long allowed users", func(t *testing.T) {
		o := base
		o.AllowedUsers = strings.Repeat("a", 1025)
		require.NotNil(t, o.IsValid())
	})

	t.Run("invalid with too long allowed channels", func(t *testing.T) {
		o := base
		o.AllowedChannels = strings.Repeat("a", 1025)
		require.NotNil(t, o.IsValid())
	})

	t.Run("invalid role name with special characters", func(t *testing.T) {
		o := base
		o.AllowedRoles = "system_admin invalid-role!"
		require.NotNil(t, o.IsValid())
	})

	t.Run("invalid role name with uppercase", func(t *testing.T) {
		o := base
		o.AllowedRoles = "SystemAdmin"
		require.NotNil(t, o.IsValid())
	})

	t.Run("valid custom role name", func(t *testing.T) {
		o := base
		o.AllowedRoles = "my_custom_role"
		require.Nil(t, o.IsValid())
	})

	t.Run("invalid user ID in allowed users", func(t *testing.T) {
		o := base
		o.AllowedUsers = "not-a-valid-id"
		require.NotNil(t, o.IsValid())
	})

	t.Run("valid user IDs in allowed users", func(t *testing.T) {
		o := base
		o.AllowedUsers = NewId() + " " + NewId()
		require.Nil(t, o.IsValid())
	})

	t.Run("invalid channel ID in allowed channels", func(t *testing.T) {
		o := base
		o.AllowedChannels = "bad-channel-id"
		require.NotNil(t, o.IsValid())
	})

	t.Run("valid channel IDs in allowed channels", func(t *testing.T) {
		o := base
		o.AllowedChannels = NewId() + " " + NewId()
		require.Nil(t, o.IsValid())
	})
}

func TestCommandHasRestrictions(t *testing.T) {
	o := Command{}
	require.False(t, o.HasRestrictions())

	o.AllowedRoles = "system_admin"
	require.True(t, o.HasRestrictions())

	o.AllowedRoles = ""
	o.AllowedUsers = NewId()
	require.True(t, o.HasRestrictions())

	o.AllowedUsers = ""
	o.AllowedChannels = NewId()
	require.True(t, o.HasRestrictions())
}

func TestCommandIsUserAllowed(t *testing.T) {
	userID := NewId()
	channelID := NewId()
	otherChannelID := NewId()

	t.Run("no restrictions allows everyone", func(t *testing.T) {
		cmd := &Command{}
		require.True(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("user in allowed users list", func(t *testing.T) {
		cmd := &Command{AllowedUsers: userID + " " + NewId()}
		require.True(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("user not in allowed users list", func(t *testing.T) {
		cmd := &Command{AllowedUsers: NewId() + " " + NewId()}
		require.False(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("user has allowed role", func(t *testing.T) {
		cmd := &Command{AllowedRoles: "system_admin team_admin"}
		require.True(t, cmd.IsUserAllowed(userID, channelID, "system_admin system_user"))
	})

	t.Run("user does not have allowed role", func(t *testing.T) {
		cmd := &Command{AllowedRoles: "system_admin"}
		require.False(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("channel in allowed channels list", func(t *testing.T) {
		cmd := &Command{AllowedChannels: channelID}
		require.True(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("channel not in allowed channels list", func(t *testing.T) {
		cmd := &Command{AllowedChannels: otherChannelID}
		require.False(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("channel matches but user does not match role", func(t *testing.T) {
		cmd := &Command{AllowedChannels: channelID, AllowedRoles: "system_admin"}
		require.False(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("channel matches and user matches role", func(t *testing.T) {
		cmd := &Command{AllowedChannels: channelID, AllowedRoles: "system_admin"}
		require.True(t, cmd.IsUserAllowed(userID, channelID, "system_admin system_user"))
	})

	t.Run("channel matches and user in allowed users", func(t *testing.T) {
		cmd := &Command{AllowedChannels: channelID, AllowedUsers: userID}
		require.True(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("channel does not match even if user matches", func(t *testing.T) {
		cmd := &Command{AllowedChannels: otherChannelID, AllowedUsers: userID}
		require.False(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})

	t.Run("channel_admin role check", func(t *testing.T) {
		cmd := &Command{AllowedRoles: "channel_admin"}
		require.True(t, cmd.IsUserAllowed(userID, channelID, "channel_admin channel_user"))
		require.False(t, cmd.IsUserAllowed(userID, channelID, "channel_user"))
	})

	t.Run("multiple roles and users combined", func(t *testing.T) {
		otherUser := NewId()
		cmd := &Command{
			AllowedRoles: "system_admin team_admin",
			AllowedUsers: otherUser,
		}
		// User matches by role
		require.True(t, cmd.IsUserAllowed(userID, channelID, "team_admin system_user"))
		// User matches by user ID
		require.True(t, cmd.IsUserAllowed(otherUser, channelID, "system_user"))
		// User matches neither
		require.False(t, cmd.IsUserAllowed(userID, channelID, "system_user"))
	})
}

func TestCommandPreSave(t *testing.T) {
	o := Command{}
	o.PreSave()
}

func TestCommandPreUpdate(t *testing.T) {
	o := Command{}
	o.PreUpdate()
}
