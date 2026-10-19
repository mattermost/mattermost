// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

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

func TestIsMHPNSEndpoint(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		expected bool
	}{
		{name: "legacy US endpoint", url: MHPNSLegacyUS, expected: true},
		{name: "legacy DE endpoint", url: MHPNSLegacyDE, expected: true},
		{name: "global endpoint", url: MHPNSGlobal, expected: true},
		{name: "US endpoint", url: MHPNSUS, expected: true},
		{name: "EU endpoint", url: MHPNSEU, expected: true},
		{name: "AP endpoint", url: MHPNSAP, expected: true},
		{name: "legacy MHPNS alias", url: MHPNS, expected: true},
		{name: "test endpoint", url: GenericNotificationServer, expected: false},
		{name: "custom endpoint", url: "https://push.example.com", expected: false},
		{name: "empty string", url: "", expected: false},
		{name: "case variant", url: "https://GLOBAL.push.mattermost.com", expected: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, IsMHPNSEndpoint(tc.url))
		})
	}
}
