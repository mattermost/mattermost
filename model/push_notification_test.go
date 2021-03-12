// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPushNotification(t *testing.T) {
	t.Run("should build a push notification from JSON", func(t *testing.T) {
		msg := PushNotification{Platform: "test"}
		json := msg.ToJson()
		result, err := PushNotificationFromJson(strings.NewReader(json))

		require.NoError(t, err)
		require.Equal(t, msg.Platform, result.Platform, "ids do not match")
	})

	t.Run("should throw an error when the message is nil", func(t *testing.T) {
		_, err := PushNotificationFromJson(nil)
		require.Error(t, err)
		require.Equal(t, "push notification data can't be nil", err.Error())
	})

	t.Run("should throw an error when the message parsing fails", func(t *testing.T) {
		_, err := PushNotificationFromJson(strings.NewReader(""))
		require.Error(t, err)
		require.Equal(t, "EOF", err.Error())
	})
}

func TestPushNotificationAck(t *testing.T) {
	t.Run("should build a push notification ack from JSON", func(t *testing.T) {
		msg := PushNotificationAck{ClientPlatform: "test"}
		json := msg.ToJson()
		result, err := PushNotificationAckFromJson(strings.NewReader(json))

		require.NoError(t, err)
		require.Equal(t, msg.ClientPlatform, result.ClientPlatform, "ids do not match")
	})

	t.Run("should throw an error when the message is nil", func(t *testing.T) {
		_, err := PushNotificationAckFromJson(nil)
		require.Error(t, err)
		require.Equal(t, "push notification data can't be nil", err.Error())
	})

	t.Run("should throw an error when the message parsing fails", func(t *testing.T) {
		_, err := PushNotificationAckFromJson(strings.NewReader(""))
		require.Error(t, err)
		require.Equal(t, "EOF", err.Error())
	})
}

func TestPushNotificationDeviceId(t *testing.T) {

	msg := PushNotification{Platform: "test"}

	msg.SetDeviceIdAndPlatform("android:12345")
	require.Equal(t, msg.Platform, "android", msg.Platform)
	require.Equal(t, msg.DeviceId, "12345", msg.DeviceId)
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform("android:12:345")
	require.Equal(t, msg.Platform, "android", msg.Platform)
	require.Equal(t, msg.DeviceId, "12:345", msg.DeviceId)
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform("android::12345")
	require.Equal(t, msg.Platform, "android", msg.Platform)
	require.Equal(t, msg.DeviceId, ":12345", msg.DeviceId)
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform(":12345")
	require.Equal(t, msg.Platform, "", msg.Platform)
	require.Equal(t, msg.DeviceId, "12345", msg.DeviceId)
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform("android:")
	require.Equal(t, msg.Platform, "android", msg.Platform)
	require.Equal(t, msg.DeviceId, "", msg.DeviceId)
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform("")
	require.Equal(t, msg.Platform, "", msg.Platform)
	require.Equal(t, msg.DeviceId, "", msg.DeviceId)
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform(":")
	require.Equal(t, msg.Platform, "", msg.Platform)
	require.Equal(t, msg.DeviceId, "", msg.DeviceId)
	msg.Platform = ""
	msg.DeviceId = ""
}
