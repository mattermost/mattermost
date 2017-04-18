// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestNewOkPushResponse(t *testing.T) {
	r := NewOkPushResponse()
	CheckString(t, r["status"], "OK")
}

func TestNewRemovePushResponse(t *testing.T) {
	r := NewRemovePushResponse()
	CheckString(t, r["status"], "REMOVE")
}

func TestNewErrorPushResponse(t *testing.T) {
	r := NewErrorPushResponse("error message")
	CheckString(t, r["status"], "FAIL")
	CheckString(t, r["error"], "error message")
}

func TestPushResponseToJson(t *testing.T) {
	r := NewErrorPushResponse("error message")
	j := r.ToJson()

	expected := `{"error":"error message","status":"FAIL"}`
	CheckString(t, j, expected)
}

func TestPushResponseFromJson(t *testing.T) {
	j := `{"error":"error message","status":"FAIL"}`
	r := PushResponseFromJson(strings.NewReader(j))

	CheckString(t, r["status"], "FAIL")
	CheckString(t, r["error"], "error message")
}
