// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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
	o.Etag()
}
