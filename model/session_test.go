// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
	"time"
)

func TestSessionJson(t *testing.T) {
	session := Session{}
	session.PreSave()
	json := session.ToJson()
	rsession := SessionFromJson(strings.NewReader(json))

	if rsession.Id != session.Id {
		t.Fatal("Ids do not match")
	}

	session.Sanitize()

	if session.IsExpired() {
		t.Fatal("Shouldn't expire")
	}

	session.ExpiresAt = GetMillis()
	time.Sleep(10 * time.Millisecond)
	if !session.IsExpired() {
		t.Fatal("Should expire")
	}

	session.SetExpireInDays(10)
}
