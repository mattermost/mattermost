// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPushNotification(t *testing.T) {
	msg := PushNotification{Platform: "test"}
	json := msg.ToJson()
	result := PushNotificationFromJson(strings.NewReader(json))

	require.Equal(t, msg.Platform, result.Platform, "Ids do not match")
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
