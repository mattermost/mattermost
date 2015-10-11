// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestMessgaeJson(t *testing.T) {
	m := NewMessage(NewId(), NewId(), NewId(), ACTION_TYPING)
	m.Add("RootId", NewId())
	json := m.ToJson()
	result := MessageFromJson(strings.NewReader(json))

	if m.TeamId != result.TeamId {
		t.Fatal("Ids do not match")
	}

	if m.Props["RootId"] != result.Props["RootId"] {
		t.Fatal("Ids do not match")
	}
}
