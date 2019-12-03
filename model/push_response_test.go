// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

func TestPushResponseToFromJson(t *testing.T) {
	r := NewErrorPushResponse("error message")
	j := r.ToJson()
	r1 := PushResponseFromJson(strings.NewReader(j))

	CheckString(t, r1["status"], r["status"])
	CheckString(t, r1["error"], r["error"])
}
