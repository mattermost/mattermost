// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestMsgCommands(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	team := th.BasicTeam
	user2 := th.BasicUser2
	user3 := th.CreateUser(th.BasicClient)
	LinkUserToTeam(user3, team)

	dc2 := Client.Must(Client.CreateDirectChannel(user2.Id)).Data.(*model.Channel)
	dc3 := Client.Must(Client.CreateDirectChannel(user3.Id)).Data.(*model.Channel)

	if result := Client.Must(Client.Command("", "/msg "+user2.Username, false)).Data.(*model.CommandResponse); result.GotoChannel != dc2.Id {
		t.Fatal("failed to create direct channel")
	}

	if result := Client.Must(Client.Command("", "/msg "+user3.Username+" foobar", false)).Data.(*model.CommandResponse); result.GotoChannel != dc3.Id {
		t.Fatal("failed to create direct channel")
	}
	if result := Client.Must(Client.SearchPosts("foobar", false)).Data.(*model.PostList); len(result.Order) == 0 {
		t.Fatalf("post did not get sent to direct message")
	}

	if result := Client.Must(Client.Command("", "/msg "+user2.Username, false)).Data.(*model.CommandResponse); result.GotoChannel != dc2.Id {
		t.Fatal("failed to go back to existing direct channel")
	}
}
