// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestInvitePeopleCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	r1 := Client.Must(Client.Command(channel.Id, "/invite_people test@example.com")).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Command failed to execute")
	}

	r2 := Client.Must(Client.Command(channel.Id, "/invite_people test1@example.com test2@example.com")).Data.(*model.CommandResponse)
	if r2 == nil {
		t.Fatal("Command failed to execute")
	}

	r3 := Client.Must(Client.Command(channel.Id, "/invite_people")).Data.(*model.CommandResponse)
	if r3 == nil {
		t.Fatal("Command failed to execute")
	}
}
