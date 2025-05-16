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
			Enabled: NewPointer(true),
			Text:    NewPointer("Banner Text"),
		},
	}

	// Test with nil background color
	o.BannerInfo.BackgroundColor = nil
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.empty.app_error", o.IsValid().Id)

	// Test with empty background color
	o.BannerInfo.BackgroundColor = NewPointer("")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.empty.app_error", o.IsValid().Id)

	// Test with invalid background color (no # prefix)
	o.BannerInfo.BackgroundColor = NewPointer("FF0000")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.invalid.app_error", o.IsValid().Id)

	// Test with invalid background color (invalid characters)
	o.BannerInfo.BackgroundColor = NewPointer("#GGGGGG")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.invalid.app_error", o.IsValid().Id)

	// Test with invalid background color (wrong length)
	o.BannerInfo.BackgroundColor = NewPointer("#FF00")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.invalid.app_error", o.IsValid().Id)

	// Test with invalid background color (wrong length)
	o.BannerInfo.BackgroundColor = NewPointer("#FF00000")
	require.NotNil(t, o.IsValid())
	require.Equal(t, "model.channel.is_valid.banner_info.background_color.invalid.app_error", o.IsValid().Id)

	// Test with valid 6-digit hex color
	o.BannerInfo.BackgroundColor = NewPointer("#FF0000")
	require.Nil(t, o.IsValid())

	// Test with valid 6-digit hex color (lowercase)
	o.BannerInfo.BackgroundColor = NewPointer("#ff0000")
	require.Nil(t, o.IsValid())

	// Test with valid 3-digit hex color
	o.BannerInfo.BackgroundColor = NewPointer("#F00")
	require.Nil(t, o.IsValid())

	// Test with valid 3-digit hex color (lowercase)
	o.BannerInfo.BackgroundColor = NewPointer("#f00")
	require.Nil(t, o.IsValid())
}

func TestChannelPreSave(t *testing.T) {
	o := Channel{Name: "test"}
	o.PreSave()
	o.Etag()
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
		GroupConstrained:  NewPointer(true),
		Shared:            NewPointer(true),
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
