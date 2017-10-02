// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestMsgCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(th.BasicClient)
	th.LinkUserToTeam(user3, team)

	Client.Must(Client.CreateDirectChannel(user2.Id))
	Client.Must(Client.CreateDirectChannel(user3.Id))

	rs1 := Client.Must(Client.Command("", "/msg "+user2.Username)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user2.Id) && !strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+user2.Id+"__"+user1.Id) {
		t.Fatal("failed to create direct channel")
	}

	rs2 := Client.Must(Client.Command("", "/msg "+user3.Username+" foobar")).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user3.Id) && !strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+user3.Id+"__"+user1.Id) {
		t.Fatal("failed to create second direct channel")
	}
	if result := Client.Must(Client.SearchPosts("foobar", false)).Data.(*model.PostList); len(result.Order) == 0 {
		t.Fatalf("post did not get sent to direct message")
	}

	rs3 := Client.Must(Client.Command("", "/msg "+user2.Username)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user2.Id) && !strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+user2.Id+"__"+user1.Id) {
		t.Fatal("failed to go back to existing direct channel")
	}

	Client.Must(Client.Command("", "/msg "+th.BasicUser.Username+" foobar"))
	Client.Must(Client.Command("", "/msg junk foobar"))
}
