// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPlatformNotificationStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("UpsertGetDelete", func(t *testing.T) { testPlatformNotificationUpsertGetDelete(t, rctx, ss) })
	t.Run("ReplaceAllForUser", func(t *testing.T) { testPlatformNotificationReplaceAllForUser(t, rctx, ss) })
	t.Run("TrimToMaxPerUser", func(t *testing.T) { testPlatformNotificationTrimToMaxPerUser(t, rctx, ss) })
	t.Run("PermanentDeleteByUser", func(t *testing.T) { testPlatformNotificationPermanentDeleteByUser(t, rctx, ss) })
}

func makePlatformNotification(userID string, recordedAt int64) *model.PlatformNotification {
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
		ParticipantUserIds: model.StringArray{model.NewId()},
	}
}

func testPlatformNotificationUpsertGetDelete(t *testing.T, _ request.CTX, ss store.Store) {
	userID := model.NewId()
	otherUserID := model.NewId()
	notification := makePlatformNotification(userID, 200)
	notification.IsGroupMessage = true
	notification.IsDirectMessage = false
	notification.IsMention = true

	saved, err := ss.PlatformNotification().Upsert(notification)
	require.NoError(t, err)
	require.Equal(t, notification.Id, saved.Id)

	got, err := ss.PlatformNotification().GetForUser(userID)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, notification.Id, got[0].Id)
	assert.Equal(t, notification.PostId, got[0].PostId)
	assert.True(t, got[0].IsGroupMessage)
	assert.True(t, got[0].IsMention)
	assert.Equal(t, notification.ParticipantUserIds, got[0].ParticipantUserIds)

	notification.PreviewBody = "@user: updated"
	notification.RecordedAt = 300
	_, err = ss.PlatformNotification().Upsert(notification)
	require.NoError(t, err)

	got, err = ss.PlatformNotification().GetForUser(userID)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "@user: updated", got[0].PreviewBody)
	assert.Equal(t, int64(300), got[0].RecordedAt)

	other := makePlatformNotification(otherUserID, 100)
	_, err = ss.PlatformNotification().Upsert(other)
	require.NoError(t, err)

	require.NoError(t, ss.PlatformNotification().Delete(userID, notification.Id))
	got, err = ss.PlatformNotification().GetForUser(userID)
	require.NoError(t, err)
	assert.Empty(t, got)

	got, err = ss.PlatformNotification().GetForUser(otherUserID)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, other.Id, got[0].Id)
}

func testPlatformNotificationReplaceAllForUser(t *testing.T, _ request.CTX, ss store.Store) {
	userID := model.NewId()
	first := makePlatformNotification(userID, 100)
	second := makePlatformNotification(userID, 200)
	require.NoError(t, mustUpsertPlatformNotification(ss, first))
	require.NoError(t, mustUpsertPlatformNotification(ss, second))

	replacement := makePlatformNotification(userID, 400)
	replacement.IsGroupMessage = true
	err := ss.PlatformNotification().ReplaceAllForUser(userID, []*model.PlatformNotification{replacement})
	require.NoError(t, err)

	got, err := ss.PlatformNotification().GetForUser(userID)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, replacement.Id, got[0].Id)
	assert.True(t, got[0].IsGroupMessage)
}

func testPlatformNotificationTrimToMaxPerUser(t *testing.T, _ request.CTX, ss store.Store) {
	userID := model.NewId()
	for i := 0; i < model.PlatformNotificationMaxPerUser; i++ {
		require.NoError(t, mustUpsertPlatformNotification(ss, makePlatformNotification(userID, int64(i+1))))
	}

	newest := makePlatformNotification(userID, int64(model.PlatformNotificationMaxPerUser+1))
	_, err := ss.PlatformNotification().Upsert(newest)
	require.NoError(t, err)

	got, err := ss.PlatformNotification().GetForUser(userID)
	require.NoError(t, err)
	require.Len(t, got, model.PlatformNotificationMaxPerUser)
	assert.Equal(t, newest.Id, got[0].Id)
	assert.Equal(t, newest.RecordedAt, got[0].RecordedAt)
}

func testPlatformNotificationPermanentDeleteByUser(t *testing.T, _ request.CTX, ss store.Store) {
	userID := model.NewId()
	otherUserID := model.NewId()
	require.NoError(t, mustUpsertPlatformNotification(ss, makePlatformNotification(userID, 100)))
	require.NoError(t, mustUpsertPlatformNotification(ss, makePlatformNotification(otherUserID, 100)))

	require.NoError(t, ss.PlatformNotification().PermanentDeleteByUser(userID))

	got, err := ss.PlatformNotification().GetForUser(userID)
	require.NoError(t, err)
	assert.Empty(t, got)

	got, err = ss.PlatformNotification().GetForUser(otherUserID)
	require.NoError(t, err)
	require.Len(t, got, 1)
}

func mustUpsertPlatformNotification(ss store.Store, notification *model.PlatformNotification) error {
	_, err := ss.PlatformNotification().Upsert(notification)
	return err
}
