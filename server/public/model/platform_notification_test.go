// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validPlatformNotification() PlatformNotification {
	return PlatformNotification{
		Id:                 "dm:" + NewId() + ":100",
		UserId:             NewId(),
		PostId:             NewId(),
		ChannelId:          NewId(),
		TeamId:             NewId(),
		RecordedAt:         100,
		ChannelDisplayName: "Town Square",
		ContextLabel:       "Message",
		PermalinkUrl:       "/team/pl/post",
		PreviewBody:        "@user: hello",
	}
}

func TestPlatformNotificationIsValid(t *testing.T) {
	o := PlatformNotification{}
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	require.Nil(t, o.IsValid())

	o.Id = ""
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.UserId = "invalid"
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.PostId = "invalid"
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.ChannelId = "invalid"
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.TeamId = "invalid"
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.TeamId = ""
	require.Nil(t, o.IsValid())

	o = validPlatformNotification()
	o.RecordedAt = 0
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.PreviewBody = strings.Repeat("x", 4001)
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.PreviewBody = strings.Repeat("x", 4000)
	require.Nil(t, o.IsValid())

	o = validPlatformNotification()
	o.SenderUserId = "invalid"
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.SenderUserId = NewId()
	require.Nil(t, o.IsValid())

	o = validPlatformNotification()
	o.ThreadRootId = "invalid"
	require.NotNil(t, o.IsValid())

	o = validPlatformNotification()
	o.ThreadRootId = NewId()
	o.IsGroupMessage = true
	require.Nil(t, o.IsValid())
}

func TestPlatformNotificationPreSave(t *testing.T) {
	o := validPlatformNotification()
	o.ParticipantUserIds = nil
	o.PreSave()
	assert.Equal(t, StringArray{}, o.ParticipantUserIds)
}
