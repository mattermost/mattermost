// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestNewId(t *testing.T) {
	for i := 0; i < 1000; i++ {
		id := NewId()
		if len(id) > 26 {
			t.Fatal("ids shouldn't be longer than 26 chars")
		}
	}
}

func TestAppError(t *testing.T) {
	err := NewAppError("TestAppError", "message", "")
	json := err.ToJson()
	rerr := AppErrorFromJson(strings.NewReader(json))
	if err.Message != rerr.Message {
		t.Fatal()
	}

	err.Error()
}

func TestMapJson(t *testing.T) {

	m := make(map[string]string)
	m["id"] = "test_id"
	json := MapToJson(m)

	rm := MapFromJson(strings.NewReader(json))

	if rm["id"] != "test_id" {
		t.Fatal("map should be valid")
	}

	rm2 := MapFromJson(strings.NewReader(""))
	if len(rm2) > 0 {
		t.Fatal("make should be ivalid")
	}
}

func TestValidEmail(t *testing.T) {
	if !IsValidEmail("corey@hulen.com") {
		t.Error("email should be valid")
	}

	if IsValidEmail("@corey@hulen.com") {
		t.Error("should be invalid")
	}
}

func TestValidLower(t *testing.T) {
	if !IsLower("corey@hulen.com") {
		t.Error("should be valid")
	}

	if IsLower("Corey@hulen.com") {
		t.Error("should be invalid")
	}
}

func TestEtag(t *testing.T) {
	etag := Etag("hello", 24)
	if len(etag) <= 0 {
		t.Fatal()
	}
}
