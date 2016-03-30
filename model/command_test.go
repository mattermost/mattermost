// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestCommandJson(t *testing.T) {
	o := Command{Id: NewId()}
	json := o.ToJson()
	ro := CommandFromJson(strings.NewReader(json))

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestCommandIsValid(t *testing.T) {
	o := Command{}

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

	o.CreatorId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CreatorId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Token = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Token = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.TeamId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.TeamId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.URL = "nowhere.com/"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.URL = "http://nowhere.com/"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Method = COMMAND_METHOD_GET
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.DisplayName = strings.Repeat("1", 65)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.DisplayName = strings.Repeat("1", 64)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Description = strings.Repeat("1", 129)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Description = strings.Repeat("1", 128)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestCommandPreSave(t *testing.T) {
	o := Command{}
	o.PreSave()
}

func TestCommandPreUpdate(t *testing.T) {
	o := Command{}
	o.PreUpdate()
}
