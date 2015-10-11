// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestChannelJson(t *testing.T) {
	o := Channel{Id: NewId(), Name: NewId()}
	json := o.ToJson()
	ro := ChannelFromJson(strings.NewReader(json))

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestChannelIsValid(t *testing.T) {
	o := Channel{}

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

	o.DisplayName = strings.Repeat("01234567890", 20)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.DisplayName = "1234"
	o.Name = "ZZZZZZZ"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Name = "zzzzz"

	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Type = "U"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Type = "P"

	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestChannelPreSave(t *testing.T) {
	o := Channel{Name: "test"}
	o.PreSave()
	o.Etag()
}

func TestChannelPreUpdate(t *testing.T) {
	o := Channel{Name: "test"}
	o.PreUpdate()
}
