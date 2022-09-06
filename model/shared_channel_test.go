// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSharedChannelIsValid(t *testing.T) {
	id := NewId()
	now := GetMillis()
	data := []struct {
		name  string
		sc    *SharedChannel
		valid bool
	}{
		{name: "Zero value", sc: &SharedChannel{}, valid: false},
		{name: "Missing team_id", sc: &SharedChannel{ChannelId: id}, valid: false},
		{name: "Missing create_at", sc: &SharedChannel{ChannelId: id, TeamId: id}, valid: false},
		{name: "Missing update_at", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now}, valid: false},
		{name: "Missing share_name", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now}, valid: false},
		{name: "Invalid share_name", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: "@test@"}, valid: false},
		{name: "Too long share_name", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: strings.Repeat("01234567890", 100)}, valid: false},
		{name: "Missing creator_id", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: "test"}, valid: false},
		{name: "Missing remote_id", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: "test", CreatorId: id}, valid: false},
		{name: "Valid shared channel", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: "test", CreatorId: id, RemoteId: id}, valid: true},
	}

	for _, item := range data {
		appErr := item.sc.IsValid()
		if item.valid {
			assert.Nil(t, appErr, item.name)
		} else {
			assert.NotNil(t, appErr, item.name)
		}
	}
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
