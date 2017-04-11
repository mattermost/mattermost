// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestModelNewOkPushResponse(t *testing.T) {
	r := NewOkPushResponse()
	if r["status"] != "OK" {
		t.Fatalf("Expected OK, got %v", r["status"])
	}
}

func TestModelNewRemovePushResponse(t *testing.T) {
	r := NewRemovePushResponse()
	if r["status"] != "REMOVE" {
		t.Fatalf("Expected REMOVE, got %v", r["status"])
	}
}

func TestModelNewErrorPushResponse(t *testing.T) {
	r := NewErrorPushResponse("error message")
	if r["status"] != "FAIL" {
		t.Fatalf("Expected error, got %v", r["status"])
	}
	if r["error"] != "error message" {
		t.Fatalf("Got wrong error message")
	}
}

func TestModelPushResponseToJson(t *testing.T) {
	r := NewErrorPushResponse("error message")
	j := r.ToJson()

	if j != `{"error":"error message","status":"FAIL"}` {
		t.Fatalf("Got unexpected json: %v", j)
	}
}

func TestModelPushResponseFromJson(t *testing.T) {
	j := `{"error":"error message","status":"FAIL"}`

	r := PushResponseFromJson(strings.NewReader(j))

	if r["status"] != "FAIL" {
		t.Fatalf("Expected error, got %v", r["status"])
	}
	if r["error"] != "error message" {
		t.Fatalf("Got wrong error message")
	}
}
