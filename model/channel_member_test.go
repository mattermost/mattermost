// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestChannelMemberJson(t *testing.T) {
	o := ChannelMember{ChannelId: NewId(), UserId: NewId()}
	json := o.ToJson()
	ro := ChannelMemberFromJson(strings.NewReader(json))

	if o.ChannelId != ro.ChannelId {
		t.Fatal("Ids do not match")
	}
}

func TestChannelMemberIsValid(t *testing.T) {
	o := ChannelMember{}

	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ChannelId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Roles = "missing"
	o.NotifyProps = GetDefaultChannelNotifyProps()
	o.UserId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Roles = CHANNEL_ROLE_ADMIN
	o.NotifyProps["desktop"] = "junk"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.NotifyProps["desktop"] = "123456789012345678901"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.NotifyProps["desktop"] = CHANNEL_NOTIFY_ALL
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.NotifyProps["mark_unread"] = "123456789012345678901"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.NotifyProps["mark_unread"] = CHANNEL_MARK_UNREAD_ALL
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Roles = ""
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}
}
