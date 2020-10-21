// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSharedChannelJson(t *testing.T) {
	o := SharedChannel{ChannelId: NewId(), ShareName: NewId()}
	json := o.ToJson()
	ro := SharedChannelFromJson(strings.NewReader(json))

	require.Equal(t, o.ChannelId, ro.ChannelId)
	require.Equal(t, o.ShareName, ro.ShareName)
}

func TestSharedChannelIsValid(t *testing.T) {
	o := SharedChannel{}

	require.Error(t, o.IsValid())

	o.ChannelId = NewId()
	require.Error(t, o.IsValid())

	o.CreateAt = GetMillis()
	require.Error(t, o.IsValid())

	o.UpdateAt = GetMillis()
	require.Error(t, o.IsValid())

	o.ShareDisplayName = strings.Repeat("01234567890", 20)
	require.Error(t, o.IsValid())

	o.ShareDisplayName = "1234"
	o.ShareName = "ZZZZZZZ"
	require.Error(t, o.IsValid())

	o.ShareName = "zzzzz"
	require.Error(t, o.IsValid())

	o.ShareHeader = strings.Repeat("01234567890", 100)
	require.Error(t, o.IsValid())

	o.ShareHeader = "1234"
	require.Nil(t, o.IsValid())

	o.SharePurpose = strings.Repeat("01234567890", 30)
	require.Error(t, o.IsValid())

	o.SharePurpose = "1234"
	require.Nil(t, o.IsValid())

	o.SharePurpose = strings.Repeat("0123456789", 25)
	require.Nil(t, o.IsValid())
}

func TestSharedChannelPreSave(t *testing.T) {
	now := GetMillis()

	o := SharedChannel{ChannelId: NewId(), ShareName: "test"}
	o.PreSave()

	require.GreaterOrEqual(t, o.CreateAt, now)
	require.GreaterOrEqual(t, o.UpdateAt, now)
}

func TestSharedChannelPreUpdate(t *testing.T) {
	now := GetMillis()

	o := SharedChannel{ChannelId: NewId(), ShareName: "test"}
	o.PreUpdate()

	require.GreaterOrEqual(t, o.UpdateAt, now)
}
