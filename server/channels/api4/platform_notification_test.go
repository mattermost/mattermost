// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func makeAPIPlatformNotification(userID string, recordedAt int64) *model.PlatformNotification {
	return &model.PlatformNotification{
		Id:                 model.NewId(),
		UserId:             userID,
		PostId:             model.NewId(),
		ChannelId:          model.NewId(),
		TeamId:             model.NewId(),
		RecordedAt:         recordedAt,
		ChannelDisplayName: "Town Square",
		ContextLabel:       "Message",
		PermalinkUrl:       "/team/pl/post",
		PreviewBody:        "@user: hello",
		IsGroupMessage:     true,
	}
}

func TestPlatformNotificationsCRUD(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	user := th.BasicUser

	empty, _, err := client.GetPlatformNotifications(context.Background(), user.Id)
	require.NoError(t, err)
	assert.Empty(t, empty)

	notification := makeAPIPlatformNotification(user.Id, 200)
	saved, _, err := client.UpsertPlatformNotification(context.Background(), user.Id, notification)
	require.NoError(t, err)
	require.Equal(t, notification.Id, saved.Id)
	assert.True(t, saved.IsGroupMessage)
	assert.Equal(t, user.Id, saved.UserId)

	got, _, err := client.GetPlatformNotifications(context.Background(), user.Id)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, notification.Id, got[0].Id)
	assert.True(t, got[0].IsGroupMessage)

	replacement := makeAPIPlatformNotification(user.Id, 400)
	replaced, _, err := client.ReplacePlatformNotifications(context.Background(), user.Id, []*model.PlatformNotification{replacement})
	require.NoError(t, err)
	require.Len(t, replaced, 1)
	assert.Equal(t, replacement.Id, replaced[0].Id)

	_, err = client.DeletePlatformNotification(context.Background(), user.Id, replacement.Id)
	require.NoError(t, err)

	got, _, err = client.GetPlatformNotifications(context.Background(), user.Id)
	require.NoError(t, err)
	assert.Empty(t, got)

	_, _, err = client.UpsertPlatformNotification(context.Background(), user.Id, makeAPIPlatformNotification(user.Id, 500))
	require.NoError(t, err)
	_, err = client.ClearPlatformNotifications(context.Background(), user.Id)
	require.NoError(t, err)

	got, _, err = client.GetPlatformNotifications(context.Background(), user.Id)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestPlatformNotificationsForbiddenForOtherUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	notification := makeAPIPlatformNotification(th.BasicUser.Id, 100)
	_, resp, err := th.Client.UpsertPlatformNotification(context.Background(), th.BasicUser2.Id, notification)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.Client.GetPlatformNotifications(context.Background(), th.BasicUser2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.Client.ReplacePlatformNotifications(context.Background(), th.BasicUser2.Id, []*model.PlatformNotification{notification})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	resp, err = th.Client.DeletePlatformNotification(context.Background(), th.BasicUser2.Id, notification.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	resp, err = th.Client.ClearPlatformNotifications(context.Background(), th.BasicUser2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestPlatformNotificationsInvalidBody(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	invalid := makeAPIPlatformNotification(th.BasicUser.Id, 0)
	_, resp, err := th.Client.UpsertPlatformNotification(context.Background(), th.BasicUser.Id, invalid)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
}
