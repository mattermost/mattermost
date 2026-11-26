// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func TestMeProviderDoCommand(t *testing.T) {
	th := setup(t)

	mp := MeProvider{}

	msg := "hello"

	resp := mp.DoCommand(th.App, th.Context, &model.CommandArgs{}, msg)

	assert.Equal(t, model.CommandResponseTypeInChannel, resp.ResponseType)
	assert.Equal(t, model.PostTypeMe, resp.Type)
	assert.Equal(t, "*"+msg+"*", resp.Text)
}

func TestMeProviderDoCommandWithoutMessage(t *testing.T) {
	th := setup(t)

	mp := MeProvider{}

	for _, msg := range []string{"", "   "} {
		resp := mp.DoCommand(th.App, th.Context, &model.CommandArgs{T: i18n.IdentityTfunc()}, msg)

		assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
		assert.Equal(t, "api.command_me.message.app_error", resp.Text)
	}
}
