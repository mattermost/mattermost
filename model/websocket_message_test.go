// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestWebSocketEvent(t *testing.T) {
	m := NewWebSocketEvent("some_event", NewId(), NewId(), NewId(), nil)
	m.Add("RootId", NewId())
	json := m.ToJson()
	result := WebSocketEventFromJson(strings.NewReader(json))

	badresult := WebSocketEventFromJson(strings.NewReader("junk"))
	if badresult != nil {
		t.Fatal("should not have parsed")
	}

	if !m.IsValid() {
		t.Fatal("should be valid")
	}

	if m.Broadcast.TeamId != result.Broadcast.TeamId {
		t.Fatal("Ids do not match")
	}

	if m.Data["RootId"] != result.Data["RootId"] {
		t.Fatal("Ids do not match")
	}
}

func TestWebSocketResponse(t *testing.T) {
	m := NewWebSocketResponse("OK", 1, map[string]interface{}{})
	e := NewWebSocketError(1, &AppError{})
	m.Add("RootId", NewId())
	json := m.ToJson()
	result := WebSocketResponseFromJson(strings.NewReader(json))
	json2 := e.ToJson()
	WebSocketResponseFromJson(strings.NewReader(json2))

	badresult := WebSocketResponseFromJson(strings.NewReader("junk"))
	if badresult != nil {
		t.Fatal("should not have parsed")
	}

	if !m.IsValid() {
		t.Fatal("should be valid")
	}

	if m.Data["RootId"] != result.Data["RootId"] {
		t.Fatal("Ids do not match")
	}
}
