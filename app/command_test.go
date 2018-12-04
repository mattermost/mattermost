// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestMoveCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	sourceTeam := th.CreateTeam()
	targetTeam := th.CreateTeam()

	command := &model.Command{}
	command.CreatorId = model.NewId()
	command.Method = model.COMMAND_METHOD_POST
	command.TeamId = sourceTeam.Id
	command.URL = "http://nowhere.com/"
	command.Trigger = "trigger1"

	command, err := th.App.CreateCommand(command)
	assert.Nil(t, err)

	defer func() {
		th.App.PermanentDeleteTeam(sourceTeam)
		th.App.PermanentDeleteTeam(targetTeam)
	}()

	// Move a command and check the team is updated.
	assert.Nil(t, th.App.MoveCommand(targetTeam, command))
	retrievedCommand, err := th.App.GetCommand(command.Id)
	assert.Nil(t, err)
	assert.EqualValues(t, targetTeam.Id, retrievedCommand.TeamId)

	// Move it to the team it's already in. Nothing should change.
	assert.Nil(t, th.App.MoveCommand(targetTeam, command))
	retrievedCommand, err = th.App.GetCommand(command.Id)
	assert.Nil(t, err)
	assert.EqualValues(t, targetTeam.Id, retrievedCommand.TeamId)
}

func TestCreateCommandPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Type:      model.POST_SYSTEM_GENERIC,
	}

	resp := &model.CommandResponse{
		Text: "some message",
	}

	_, err := th.App.CreateCommandPost(post, th.BasicTeam.Id, resp)
	if err == nil || err.Id != "api.context.invalid_param.app_error" {
		t.Fatal("should have failed - bad post type")
	}

	channel := th.CreateChannel(th.BasicTeam)

	post = &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    channel.Id,
	}

	_, err = th.App.CreateCommandPost(post, th.BasicTeam.Id, resp)
	if err == nil || err.Id != "api.command.command_post.forbidden.app_error" {
		t.Fatal("should have failed - forbidden channel post")
	}
}

func TestHandleCommandResponsePost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	command := &model.Command{}
	args := &model.CommandArgs{
		ChannelId: th.BasicChannel.Id,
		TeamId: th.BasicTeam.Id,
		UserId: th.BasicUser.Id,
		RootId: "root_id",
		ParentId: "parent_id",
	}

	resp := &model.CommandResponse{
		Type: model.POST_EPHEMERAL,
		Props: model.StringInterface{"some_key": "some value"},
		Text: "some message",
	}

	builtIn := true

	post, err := th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, args.ChannelId, post.ChannelId)
	assert.Equal(t, args.RootId, post.RootId)
	assert.Equal(t, args.ParentId, post.ParentId)
	assert.Equal(t, args.UserId, post.UserId)
	assert.Equal(t, resp.Type, post.Type)
	assert.Equal(t, resp.Props, post.Props)
	assert.Equal(t, resp.Text, post.Message)
	assert.Nil(t, post.Props["override_icon_url"])
	assert.Nil(t, post.Props["override_username"])
	assert.Nil(t, post.Props["from_webhook"])

	// Command is not built in, so it is a bot command.
	builtIn = false
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Equal(t, "true", post.Props["from_webhook"])

	builtIn = true

	// Channel id is specified by response, it should override the command args value.
	channel := th.CreateChannel(th.BasicTeam)
	resp.ChannelId = channel.Id
	th.AddUserToChannel(th.BasicUser, channel)

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, resp.ChannelId, post.ChannelId)
	assert.NotEqual(t, args.ChannelId, post.ChannelId)

	// Override username config is turned off. No override should occur.
	th.App.Config().ServiceSettings.EnablePostUsernameOverride = false
	resp.ChannelId = ""
	command.Username = "Command username"
	resp.Username = "Response username"

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Nil(t, post.Props["override_username"])

	th.App.Config().ServiceSettings.EnablePostUsernameOverride = true

	// Override username config is turned on. Override username through command property.
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, command.Username, post.Props["override_username"])
	assert.Equal(t, "true", post.Props["from_webhook"])

	command.Username = ""

	// Override username through response property.
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, resp.Username, post.Props["override_username"])
	assert.Equal(t, "true", post.Props["from_webhook"])

	th.App.Config().ServiceSettings.EnablePostUsernameOverride = false

	// Override icon url config is turned off. No override should occur.
	th.App.Config().ServiceSettings.EnablePostIconOverride = false
	command.IconURL = "Command icon url"
	resp.IconURL = "Response icon url"

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Nil(t, post.Props["override_icon_url"])

	th.App.Config().ServiceSettings.EnablePostIconOverride = true

	// Override icon url config is turned on. Override icon url through command property.
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, command.IconURL, post.Props["override_icon_url"])
	assert.Equal(t, "true", post.Props["from_webhook"])

	command.IconURL = ""

	// Override icon url through response property.
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, resp.IconURL, post.Props["override_icon_url"])
	assert.Equal(t, "true", post.Props["from_webhook"])

	// Test Slack text conversion.
	resp.Text = "<!channel>"

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, "@channel", post.Message)

	// Test Slack attachments text conversion.
	resp.Attachments = []*model.SlackAttachment{
		&model.SlackAttachment{
			Text: "<!here>",
		},
	}

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, "@here", resp.Attachments[0].Text)
}
