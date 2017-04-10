// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestPushNotification(t *testing.T) {
	msg := PushNotification{Platform: "test"}
	json := msg.ToJson()
	result := PushNotificationFromJson(strings.NewReader(json))

	if msg.Platform != result.Platform {
		t.Fatal("Ids do not match")
	}
}

func TestPushNotificationDeviceId(t *testing.T) {

	msg := PushNotification{Platform: "test"}

	msg.SetDeviceIdAndPlatform("android:12345")
	if msg.Platform != "android" {
		t.Fatal(msg.Platform)
	}
	if msg.DeviceId != "12345" {
		t.Fatal(msg.DeviceId)
	}
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform("android:12:345")
	if msg.Platform != "android" {
		t.Fatal(msg.Platform)
	}
	if msg.DeviceId != "12:345" {
		t.Fatal(msg.DeviceId)
	}
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform("android::12345")
	if msg.Platform != "android" {
		t.Fatal(msg.Platform)
	}
	if msg.DeviceId != ":12345" {
		t.Fatal(msg.DeviceId)
	}
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform(":12345")
	if msg.Platform != "" {
		t.Fatal(msg.Platform)
	}
	if msg.DeviceId != "12345" {
		t.Fatal(msg.DeviceId)
	}
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform("android:")
	if msg.Platform != "android" {
		t.Fatal(msg.Platform)
	}
	if msg.DeviceId != "" {
		t.Fatal(msg.DeviceId)
	}
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform("")
	if msg.Platform != "" {
		t.Fatal(msg.Platform)
	}
	if msg.DeviceId != "" {
		t.Fatal(msg.DeviceId)
	}
	msg.Platform = ""
	msg.DeviceId = ""

	msg.SetDeviceIdAndPlatform(":")
	if msg.Platform != "" {
		t.Fatal(msg.Platform)
	}
	if msg.DeviceId != "" {
		t.Fatal(msg.DeviceId)
	}
	msg.Platform = ""
	msg.DeviceId = ""
}
