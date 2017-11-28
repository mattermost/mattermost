// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
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

	o.Type = "junk"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Type = POST_CUSTOM_TYPE_PREFIX + "type"
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

func TestPostChannelMentions(t *testing.T) {
	post := Post{Message: "~a ~b ~b ~c/~d."}
	assert.Equal(t, []string{"a", "b", "c", "d"}, post.ChannelMentions())
}

func TestPostSanitizeProps(t *testing.T) {
	post1 := &Post{
		Message: "test",
	}

	post1.SanitizeProps()

	if post1.Props[PROPS_ADD_CHANNEL_MEMBER] != nil {
		t.Fatal("should be nil")
	}

	post2 := &Post{
		Message: "test",
		Props: StringInterface{
			PROPS_ADD_CHANNEL_MEMBER: "test",
		},
	}

	post2.SanitizeProps()

	if post2.Props[PROPS_ADD_CHANNEL_MEMBER] != nil {
		t.Fatal("should be nil")
	}

	post3 := &Post{
		Message: "test",
		Props: StringInterface{
			PROPS_ADD_CHANNEL_MEMBER: "no good",
			"attachments":            "good",
		},
	}

	post3.SanitizeProps()

	if post3.Props[PROPS_ADD_CHANNEL_MEMBER] != nil {
		t.Fatal("should be nil")
	}

	if post3.Props["attachments"] == nil {
		t.Fatal("should not be nil")
	}
}
