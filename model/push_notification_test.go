// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
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
