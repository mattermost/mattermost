// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestStatus(t *testing.T) {
	status := Status{NewId(), STATUS_ONLINE, 0}
	json := status.ToJson()
	status2 := StatusFromJson(strings.NewReader(json))

	if status.UserId != status2.UserId {
		t.Fatal("UserId should have matched")
	}

	if status.Status != status2.Status {
		t.Fatal("Status should have matched")
	}

	if status.LastActivityAt != status2.LastActivityAt {
		t.Fatal("LastActivityAt should have matched")
	}
}
