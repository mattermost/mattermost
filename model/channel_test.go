// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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

	p := ChannelPatch{Name: new(string)}
	*p.Name = NewId()
	json = p.ToJson()
	rp := ChannelPatchFromJson(strings.NewReader(json))

	if *p.Name != *rp.Name {
		t.Fatal("names do not match")
	}
}

func TestChannelCopy(t *testing.T) {
	o := Channel{Id: NewId(), Name: NewId()}
	ro := o.DeepCopy()

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestChannelPatch(t *testing.T) {
	p := &ChannelPatch{Name: new(string), DisplayName: new(string), Header: new(string), Purpose: new(string)}
	*p.Name = NewId()
	*p.DisplayName = NewId()
	*p.Header = NewId()
	*p.Purpose = NewId()

	o := Channel{Id: NewId(), Name: NewId()}
	o.Patch(p)

	if *p.Name != o.Name {
		t.Fatal("do not match")
	}
	if *p.DisplayName != o.DisplayName {
		t.Fatal("do not match")
	}
	if *p.Header != o.Header {
		t.Fatal("do not match")
	}
	if *p.Purpose != o.Purpose {
		t.Fatal("do not match")
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

	o.Header = strings.Repeat("01234567890", 100)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Header = "1234"
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Purpose = strings.Repeat("01234567890", 30)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Purpose = "1234"
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Purpose = strings.Repeat("0123456789", 25)
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

func TestGetGroupDisplayNameFromUsers(t *testing.T) {
	users := make([]*User, 4)
	users[0] = &User{Username: NewId()}
	users[1] = &User{Username: NewId()}
	users[2] = &User{Username: NewId()}
	users[3] = &User{Username: NewId()}

	name := GetGroupDisplayNameFromUsers(users, true)
	if len(name) > CHANNEL_NAME_MAX_LENGTH {
		t.Fatal("name too long")
	}
}

func TestGetGroupNameFromUserIds(t *testing.T) {
	name := GetGroupNameFromUserIds([]string{NewId(), NewId(), NewId(), NewId(), NewId()})

	if len(name) > CHANNEL_NAME_MAX_LENGTH {
		t.Fatal("name too long")
	}
}
