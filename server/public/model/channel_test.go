// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelCopy(t *testing.T) {
	o := Channel{Id: NewId(), Name: NewId()}
	ro := o.DeepCopy()

	require.Equal(t, o.Id, ro.Id, "Ids do not match")
}

func TestChannelPatch(t *testing.T) {
	p := &ChannelPatch{Name: new(string), DisplayName: new(string), Header: new(string), Purpose: new(string), GroupConstrained: new(bool)}
	*p.Name = NewId()
	*p.DisplayName = NewId()
	*p.Header = NewId()
	*p.Purpose = NewId()
	*p.GroupConstrained = true

	o := Channel{Id: NewId(), Name: NewId()}
	o.Patch(p)

	require.Equal(t, *p.Name, o.Name)
	require.Equal(t, *p.DisplayName, o.DisplayName)
	require.Equal(t, *p.Header, o.Header)
	require.Equal(t, *p.Purpose, o.Purpose)
	require.Equal(t, *p.GroupConstrained, *o.GroupConstrained)
}

func TestChannelPatchDiscoverable(t *testing.T) {
	t.Run("applies discoverable when set", func(t *testing.T) {
		on := true
		p := &ChannelPatch{Discoverable: &on}
		o := Channel{Id: NewId(), Name: NewId(), Type: ChannelTypePrivate}
		o.Patch(p)
		require.True(t, o.Discoverable)
	})

	t.Run("clears discoverable when set to false", func(t *testing.T) {
		off := false
		p := &ChannelPatch{Discoverable: &off}
		o := Channel{Id: NewId(), Name: NewId(), Type: ChannelTypePrivate, Discoverable: true}
		o.Patch(p)
		require.False(t, o.Discoverable)
	})

	t.Run("nil discoverable leaves channel untouched", func(t *testing.T) {
		o := Channel{Id: NewId(), Name: NewId(), Type: ChannelTypePrivate, Discoverable: true}
		o.Patch(&ChannelPatch{})
		require.True(t, o.Discoverable)
	})
}

func TestChannelIsValidDiscoverable(t *testing.T) {
	base := Channel{
		Id:          NewId(),
		CreateAt:    GetMillis(),
		UpdateAt:    GetMillis(),
		DisplayName: "x",
		Name:        "valid-name",
		Header:      "h",
		Purpose:     "p",
	}

	t.Run("discoverable=false is valid on any type", func(t *testing.T) {
		c := base
		c.Type = ChannelTypeOpen
		require.Nil(t, c.IsValid())
	})

	t.Run("discoverable=true requires private channel", func(t *testing.T) {
		c := base
		c.Type = ChannelTypeOpen
		c.Discoverable = true
		require.NotNil(t, c.IsValid(), "discoverable=true on public channel must be rejected")

		c.Type = ChannelTypeDirect
		require.NotNil(t, c.IsValid())

		c.Type = ChannelTypeGroup
		require.NotNil(t, c.IsValid())

		c.Type = ChannelTypePrivate
		require.Nil(t, c.IsValid())
	})
}

func TestChannelSupportsGroupSync(t *testing.T) {
	require.True(t, (&Channel{Type: ChannelTypeOpen}).SupportsGroupSync())
	require.True(t, (&Channel{Type: ChannelTypePrivate}).SupportsGroupSync())
	require.False(t, (&Channel{Type: ChannelTypeDirect}).SupportsGroupSync())
	require.False(t, (&Channel{Type: ChannelTypeGroup}).SupportsGroupSync())
	require.False(t, (&Channel{Type: ChannelTypeOpenBoard}).SupportsGroupSync())
	require.False(t, (&Channel{Type: ChannelTypePrivateBoard}).SupportsGroupSync())
}

func TestChannelIsValidGroupConstrained(t *testing.T) {
	base := Channel{
		Id:          NewId(),
		CreateAt:    GetMillis(),
		UpdateAt:    GetMillis(),
		DisplayName: "x",
		Name:        "valid-name",
		Header:      "h",
		Purpose:     "p",
	}

	t.Run("group_constrained is allowed on public and private channels", func(t *testing.T) {
		c := base
		c.GroupConstrained = NewPointer(true)

		c.Type = ChannelTypeOpen
		require.Nil(t, c.IsValid())

		c.Type = ChannelTypePrivate
		require.Nil(t, c.IsValid())
	})

	t.Run("group_constrained is rejected on direct, group, and board channels", func(t *testing.T) {
		c := base
		c.GroupConstrained = NewPointer(true)

		c.Type = ChannelTypeDirect
		require.NotNil(t, c.IsValid())

		c.Type = ChannelTypeGroup
		require.NotNil(t, c.IsValid())

		c.Type = ChannelTypeOpenBoard
		require.NotNil(t, c.IsValid())

		c.Type = ChannelTypePrivateBoard
		require.NotNil(t, c.IsValid())
	})
}

func TestChannelIsValid(t *testing.T) {
	o := Channel{}

	require.NotNil(t, o.IsValid())

	o.Id = NewId()
	require.NotNil(t, o.IsValid())

	o.CreateAt = GetMillis()
	require.NotNil(t, o.IsValid())

	o.UpdateAt = GetMillis()
	require.NotNil(t, o.IsValid())

	o.DisplayName = strings.Repeat("01234567890", 20)
	require.NotNil(t, o.IsValid())

	o.DisplayName = "1234"
	o.Name = "ZZZZZZZ"
	require.NotNil(t, o.IsValid())

	o.Name = "zzzzz"
	require.NotNil(t, o.IsValid())

	o.Type = "U"
	require.NotNil(t, o.IsValid())

	o.Type = ChannelTypePrivate
	require.Nil(t, o.IsValid())

	o.Header = strings.Repeat("01234567890", 100)
	require.NotNil(t, o.IsValid())

	o.Header = "1234"
	require.Nil(t, o.IsValid())

	o.Purpose = strings.Repeat("01234567890", 30)
	require.NotNil(t, o.IsValid())

	o.Purpose = "1234"
	require.Nil(t, o.IsValid())

	o.Purpose = strings.Repeat("0123456789", 25)
	require.Nil(t, o.IsValid())

	o.Name = "beu8cc6b3jnxfe9r4na9baooma__36atajbs87dqmpym6o8eiy9saa"
	require.NotNil(t, o.IsValid())

	o.Name = "71b03afcbb2d503d49f87f057549c43db4e19f92"
	require.NotNil(t, o.IsValid())
}

func TestChannelIsValidBoard(t *testing.T) {
	t.Run("rejects non-board type", func(t *testing.T) {
		c := &Channel{Type: ChannelTypeOpen, TeamId: NewId(), DisplayName: "Board"}
		err := c.IsValidBoard()
		require.NotNil(t, err)
		require.Equal(t, "model.channel.is_valid_board.type.app_error", err.Id)
	})

	t.Run("rejects missing team_id", func(t *testing.T) {
		c := &Channel{Type: ChannelTypeOpenBoard, DisplayName: "Board"}
		err := c.IsValidBoard()
		require.NotNil(t, err)
		require.Equal(t, "model.channel.is_valid_board.team_id.app_error", err.Id)
	})

	t.Run("rejects empty display name", func(t *testing.T) {
		c := &Channel{Type: ChannelTypeOpenBoard, TeamId: NewId()}
		err := c.IsValidBoard()
		require.NotNil(t, err)
		require.Equal(t, "model.channel.is_valid_board.display_name.app_error", err.Id)
	})

	t.Run("accepts valid open board", func(t *testing.T) {
		c := &Channel{Type: ChannelTypeOpenBoard, TeamId: NewId(), DisplayName: "Board"}
		require.Nil(t, c.IsValidBoard())
	})

	t.Run("accepts valid private board", func(t *testing.T) {
		c := &Channel{Type: ChannelTypePrivateBoard, TeamId: NewId(), DisplayName: "Board"}
		require.Nil(t, c.IsValidBoard())
	})
}

func TestChannelBannerBackgroundColorValidation(t *testing.T) {
	o := Channel{
		Id:       NewId(),
		CreateAt: GetMillis(),
		UpdateAt: GetMillis(),
		Name:     "valid-name",
		Type:     ChannelTypeOpen,
		Header:   "valid-header",
		Purpose:  "valid-purpose",
		BannerInfo: &ChannelBannerInfo{
			Enabled: new(true),
			Text:    new("Banner Text"),
		},
	}

	// Test with nil background color
	o.BannerInfo.BackgroundColor = nil
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.empty.app_error", o.IsValid().Id)

	// Test with empty background color
	o.BannerInfo.BackgroundColor = new("")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.empty.app_error", o.IsValid().Id)

	// Test with invalid background color (no # prefix)
	o.BannerInfo.BackgroundColor = new("FF0000")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.invalid.app_error", o.IsValid().Id)

	// Test with invalid background color (invalid characters)
	o.BannerInfo.BackgroundColor = new("#GGGGGG")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.invalid.app_error", o.IsValid().Id)

	// Test with invalid background color (wrong length)
	o.BannerInfo.BackgroundColor = new("#FF00")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.invalid.app_error", o.IsValid().Id)

	// Test with invalid background color (wrong length)
	o.BannerInfo.BackgroundColor = new("#FF00000")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.invalid.app_error", o.IsValid().Id)

	// Test with valid 6-digit hex color
	o.BannerInfo.BackgroundColor = new("#FF0000")
	require.Nil(t, o.IsValid())

	// Test with valid 6-digit hex color (lowercase)
	o.BannerInfo.BackgroundColor = new("#ff0000")
	require.Nil(t, o.IsValid())

	// Test with valid 3-digit hex color
	o.BannerInfo.BackgroundColor = new("#F00")
	require.Nil(t, o.IsValid())

	// Test with valid 3-digit hex color (lowercase)
	o.BannerInfo.BackgroundColor = new("#f00")
	require.Nil(t, o.IsValid())
}

func TestChannelPreSave(t *testing.T) {
	o := Channel{Name: "test"}
	o.PreSave()
}

func TestChannelPreUpdate(t *testing.T) {
	o := Channel{Name: "test"}
	o.PreUpdate()
}

func TestGetGroupDisplayNameFromUsers(t *testing.T) {
	users := make([]*User, 4)
	users[0] = &User{Username: NewId()}
	users[1] = &User{Username: NewId()}
	users[2] = &User{Username: NewId()}
	users[3] = &User{Username: NewId()}

	name := GetGroupDisplayNameFromUsers(users, true)
	require.LessOrEqual(t, len(name), ChannelNameMaxLength)
}

func TestGetGroupNameFromUserIds(t *testing.T) {
	name := GetGroupNameFromUserIds([]string{NewId(), NewId(), NewId(), NewId(), NewId()})

	require.LessOrEqual(t, len(name), ChannelNameMaxLength)
}

func TestSanitize(t *testing.T) {
	schemaId := NewId()
	o := Channel{
		Id:                NewId(),
		CreateAt:          1,
		UpdateAt:          1,
		DeleteAt:          1,
		Name:              NewId(),
		DisplayName:       NewId(),
		Header:            NewId(),
		Purpose:           NewId(),
		LastPostAt:        1,
		TotalMsgCount:     1,
		ExtraUpdateAt:     1,
		CreatorId:         NewId(),
		SchemeId:          &schemaId,
		Props:             make(map[string]any),
		GroupConstrained:  new(true),
		Shared:            new(true),
		TotalMsgCountRoot: 1,
		PolicyID:          &schemaId,
		LastRootPostAt:    1,
	}
	s := o.Sanitize()

	require.NotEqual(t, "", s.Id)
	require.Equal(t, int64(0), s.CreateAt)
	require.Equal(t, int64(0), s.UpdateAt)
	require.Equal(t, int64(0), s.DeleteAt)
	require.Equal(t, "", s.Name)
	require.NotEqual(t, "", s.DisplayName)
	require.Equal(t, "", s.Header)
	require.Equal(t, "", s.Purpose)
	require.Equal(t, int64(0), s.LastPostAt)
	require.Equal(t, int64(0), s.TotalMsgCount)
	require.Equal(t, int64(0), s.ExtraUpdateAt)
	require.Equal(t, "", s.CreatorId)
	require.Nil(t, s.SchemeId)
	require.Nil(t, s.Props)
	require.Nil(t, s.GroupConstrained)
	require.Nil(t, s.Shared)
	require.Equal(t, int64(0), s.TotalMsgCountRoot)
	require.Nil(t, s.PolicyID)
	require.Equal(t, int64(0), s.LastRootPostAt)
}
