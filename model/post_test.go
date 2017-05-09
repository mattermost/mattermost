// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestPostJson(t *testing.T) {
	o := Post{Id: NewId(), Message: NewId()}
	json := o.ToJson()
	ro := PostFromJson(strings.NewReader(json))

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestPostIsValid(t *testing.T) {
	o := Post{}

	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Id = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CreateAt = GetMillis()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.UpdateAt = GetMillis()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.UserId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ChannelId = NewId()
	o.RootId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.RootId = ""
	o.ParentId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ParentId = NewId()
	o.RootId = ""
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ParentId = ""
	o.Message = strings.Repeat("0", 4001)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Message = strings.Repeat("0", 4000)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Message = "test"
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestPostPreSave(t *testing.T) {
	o := Post{Message: "test"}
	o.PreSave()

	if o.CreateAt == 0 {
		t.Fatal("should be set")
	}

	past := GetMillis() - 1
	o = Post{Message: "test", CreateAt: past}
	o.PreSave()

	if o.CreateAt > past {
		t.Fatal("should not be updated")
	}

	o.Etag()
}

func TestPostIsSystemMessage(t *testing.T) {
	post1 := Post{Message: "test_1"}
	post1.PreSave()

	if post1.IsSystemMessage() {
		t.Fatalf("TestPostIsSystemMessage failed, expected post1.IsSystemMessage() to be false")
	}

	post2 := Post{Message: "test_2", Type: POST_JOIN_LEAVE}
	post2.PreSave()
	if !post2.IsSystemMessage() {
		t.Fatalf("TestPostIsSystemMessage failed, expected post2.IsSystemMessage() to be true")
	}
}

func TestPostIsUserActivitySystemMessage(t *testing.T) {
	post1 := Post{Message: "test_1"}
	post1.PreSave()

	if post1.IsUserActivitySystemMessage() {
		t.Fatalf("TestPostIsUserActivitySystemMessage failed, expected post1.IsSystemMessage() to be false")
	}

	post2 := Post{Message: "test_2", Type: POST_JOIN_LEAVE}
	post2.PreSave()
	if !post2.IsUserActivitySystemMessage() {
		t.Fatalf("TestPostIsUserActivitySystemMessage failed, expected post2.IsSystemMessage() to be true")
	}

	post3 := Post{Message: "test_3", Type: POST_JOIN_CHANNEL}
	post3.PreSave()
	if !post3.IsUserActivitySystemMessage() {
		t.Fatalf("TestPostIsUserActivitySystemMessage failed, expected post3.IsSystemMessage() to be true")
	}

	post4 := Post{Message: "test_4", Type: POST_LEAVE_CHANNEL}
	post4.PreSave()
	if !post4.IsUserActivitySystemMessage() {
		t.Fatalf("TestPostIsUserActivitySystemMessage failed, expected post4.IsSystemMessage() to be true")
	}

	post5 := Post{Message: "test_5", Type: POST_ADD_REMOVE}
	post5.PreSave()
	if !post5.IsUserActivitySystemMessage() {
		t.Fatalf("TestPostIsUserActivitySystemMessage failed, expected post5.IsSystemMessage() to be true")
	}

	post6 := Post{Message: "test_6", Type: POST_ADD_TO_CHANNEL}
	post6.PreSave()
	if !post6.IsUserActivitySystemMessage() {
		t.Fatalf("TestPostIsUserActivitySystemMessage failed, expected post6.IsSystemMessage() to be true")
	}

	post7 := Post{Message: "test_7", Type: POST_REMOVE_FROM_CHANNEL}
	post7.PreSave()
	if !post7.IsUserActivitySystemMessage() {
		t.Fatalf("TestPostIsUserActivitySystemMessage failed, expected post7.IsSystemMessage() to be true")
	}
}
