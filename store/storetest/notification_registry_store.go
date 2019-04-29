// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationRegistryStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testNotificationRegistryStoreSave(t, ss) })
	t.Run("MarkAsReceived", func(t *testing.T) { testNotificationRegistryStoreMarkAsReceived(t, ss) })
	t.Run("UpdateSendStatus", func(t *testing.T) { testNotificationRegistryStoreUpdateSendStatus(t, ss) })
}

func testNotificationRegistryStoreSave(t *testing.T, ss store.Store) {
	t.Run("should save notification registry", func(t *testing.T) {
		notificationRegistry := &model.NotificationRegistry{
			AckId:    model.NewId(),
			DeviceId: "apple_or_android_device_identifier",
			PostId:   model.NewId(),
			UserId:   model.NewId(),
			Type:     model.PUSH_TYPE_MESSAGE,
		}

		result, err := ss.NotificationRegistry().Save(notificationRegistry)

		require.Nil(t, err)
		require.IsType(t, notificationRegistry, result)
		assert.NotZero(t, result.CreateAt)
	})

	t.Run("should save notification registry without AckId", func(t *testing.T) {
		notificationRegistry := &model.NotificationRegistry{
			DeviceId: "apple_or_android_device_identifier",
			PostId:   model.NewId(),
			UserId:   model.NewId(),
			Type:     model.PUSH_TYPE_MESSAGE,
		}

		result, err := ss.NotificationRegistry().Save(notificationRegistry)

		require.Nil(t, err)
		require.IsType(t, notificationRegistry, result)
		assert.NotEmpty(t, result.AckId)
		assert.NotZero(t, result.CreateAt)
	})

	t.Run("should fail to save invalid notification registry", func(t *testing.T) {
		notificationRegistry := &model.NotificationRegistry{
			DeviceId: "apple_or_android_device_identifier",
			PostId:   model.NewId(),
			UserId:   model.NewId(),
			Type:     "garbage",
		}

		_, err := ss.NotificationRegistry().Save(notificationRegistry)

		assert.NotNil(t, err)
	})
}

func testNotificationRegistryStoreMarkAsReceived(t *testing.T, ss store.Store) {
	notificationRegistry := &model.NotificationRegistry{
		DeviceId: "apple_or_android_device_identifier",
		PostId:   model.NewId(),
		UserId:   model.NewId(),
		Type:     model.PUSH_TYPE_MESSAGE,
	}

	t.Run("should update when the notification was received", func(t *testing.T) {
		result, err := ss.NotificationRegistry().Save(notificationRegistry)
		if err != nil {
			t.Fatal("Notification should have been saved")
		}

		err = ss.NotificationRegistry().MarkAsReceived(result.AckId, model.GetMillis())

		assert.Nil(t, err)
	})
}

func testNotificationRegistryStoreUpdateSendStatus(t *testing.T, ss store.Store) {
	notificationRegistry := &model.NotificationRegistry{
		DeviceId: "apple_or_android_device_identifier",
		UserId:   model.NewId(),
		Type:     model.PUSH_TYPE_CLEAR,
	}

	t.Run("should update when the notification send status", func(t *testing.T) {
		result, err := ss.NotificationRegistry().Save(notificationRegistry)
		if err != nil {
			t.Fatal("Notification should have been saved")
		}

		err = ss.NotificationRegistry().UpdateSendStatus(result.AckId, "Some Status")

		assert.Nil(t, err)
	})
}
