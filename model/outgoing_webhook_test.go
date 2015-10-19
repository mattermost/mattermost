// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestOutgoingWebhookJson(t *testing.T) {
	o := OutgoingWebhook{Id: NewId()}
	json := o.ToJson()
	ro := OutgoingWebhookFromJson(strings.NewReader(json))

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestOutgoingWebhookIsValid(t *testing.T) {
	o := OutgoingWebhook{}

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

	o.ChannelId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ChannelId = NewId()
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

	o.CallbackURLs = []string{"http://nowhere.com/"}
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestOutgoingWebhookPreSave(t *testing.T) {
	o := OutgoingWebhook{}
	o.PreSave()
}

func TestOutgoingWebhookPreUpdate(t *testing.T) {
	o := OutgoingWebhook{}
	o.PreUpdate()
}
