// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestIncomingWebhookJson(t *testing.T) {
	o := IncomingWebhook{Id: NewId()}
	json := o.ToJson()
	ro := IncomingWebhookFromJson(strings.NewReader(json))

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestIncomingWebhookIsValid(t *testing.T) {
	o := IncomingWebhook{}

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

	o.UserId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.UserId = NewId()
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
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}
}

func TestIncomingWebhookPreSave(t *testing.T) {
	o := IncomingWebhook{}
	o.PreSave()
}

func TestIncomingWebhookPreUpdate(t *testing.T) {
	o := IncomingWebhook{}
	o.PreUpdate()
}
