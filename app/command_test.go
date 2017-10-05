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
	if err == nil && err.Id != "api.context.invalid_param.app_error" {
		t.Fatal("should have failed - bad post type")
	}
}
