// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCommandWebhookPreSave(t *testing.T) {
	h := CommandWebhook{}
	h.PreSave()

	require.Len(t, h.Id, 26, "Id should be generated")
	require.NotEqual(t, 0, h.CreateAt, "CreateAt should be set")
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
		{func() { h.Id = NewId() }, ""},
		{func() { h.CreateAt = 0 }, "model.command_hook.create_at.app_error"},
		{func() { h.CreateAt = GetMillis() }, ""},
		{func() { h.CommandId = "asd" }, "model.command_hook.command_id.app_error"},
		{func() { h.CommandId = NewId() }, ""},
		{func() { h.UserId = "asd" }, "model.command_hook.user_id.app_error"},
		{func() { h.UserId = NewId() }, ""},
		{func() { h.ChannelId = "asd" }, "model.command_hook.channel_id.app_error"},
		{func() { h.ChannelId = NewId() }, ""},
		{func() { h.RootId = "asd" }, "model.command_hook.root_id.app_error"},
		{func() { h.RootId = NewId() }, ""},
	} {
		tmp := h
		test.Transform()
		appErr := h.IsValid()

		if test.ExpectedError == "" {
			assert.Nil(t, appErr, "hook should be valid")
		} else {
			require.NotNil(t, appErr)
			assert.Equal(t, test.ExpectedError, appErr.Id, "expected "+test.ExpectedError+" error")
		}

		h = tmp
	}
}
