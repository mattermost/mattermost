// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"
)

func TestCommandWebhookPreSave(t *testing.T) {
	h := CommandWebhook{}
	h.PreSave()
	if len(h.Id) != 26 {
		t.Fatal("Id should be generated")
	}
	if h.CreateAt == 0 {
		t.Fatal("CreateAt should be set")
	}
}

func TestCommandWebhookIsValid(t *testing.T) {
	h := CommandWebhook{}
	h.Id = NewId()
	h.CreateAt = GetMillis()
	h.CommandId = NewId()
	h.UserId = NewId()
	h.ChannelId = NewId()

	for _, test := range []struct {
		Transform     func()
		ExpectedError string
	}{
		{func() {}, ""},
		{func() { h.Id = "asd" }, "model.command_hook.id.app_error"},
		{func() { h.CreateAt = 0 }, "model.command_hook.create_at.app_error"},
		{func() { h.CommandId = "asd" }, "model.command_hook.command_id.app_error"},
		{func() { h.UserId = "asd" }, "model.command_hook.user_id.app_error"},
		{func() { h.ChannelId = "asd" }, "model.command_hook.channel_id.app_error"},
		{func() { h.RootId = "asd" }, "model.command_hook.root_id.app_error"},
		{func() { h.RootId = NewId() }, ""},
		{func() { h.ParentId = "asd" }, "model.command_hook.parent_id.app_error"},
		{func() { h.ParentId = NewId() }, ""},
	} {
		tmp := h
		test.Transform()
		err := h.IsValid()
		if test.ExpectedError == "" && err != nil {
			t.Fatal("hook should be valid")
		} else if test.ExpectedError != "" && test.ExpectedError != err.Id {
			t.Fatal("expected " + test.ExpectedError + " error")
		}
		h = tmp
	}
}
