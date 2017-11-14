// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestGroupmsgCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(th.BasicClient)
	user4 := th.CreateUser(th.BasicClient)
	user5 := th.CreateUser(th.BasicClient)
	user6 := th.CreateUser(th.BasicClient)
	user7 := th.CreateUser(th.BasicClient)
	user8 := th.CreateUser(th.BasicClient)
	user9 := th.CreateUser(th.BasicClient)
	th.LinkUserToTeam(user3, team)
	th.LinkUserToTeam(user4, team)

	rs1 := Client.Must(Client.Command("", "/groupmsg "+user2.Username+","+user3.Username)).Data.(*model.CommandResponse)

	group1 := model.GetGroupNameFromUserIds([]string{user1.Id, user2.Id, user3.Id})

	if !strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+group1) {
		t.Fatal("failed to create group channel")
	}

	rs2 := Client.Must(Client.Command("", "/groupmsg "+user3.Username+","+user4.Username+" foobar")).Data.(*model.CommandResponse)
	group2 := model.GetGroupNameFromUserIds([]string{user1.Id, user3.Id, user4.Id})

	if !strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+group2) {
		t.Fatal("failed to create second direct channel")
	}
	if result := Client.Must(Client.SearchPosts("foobar", false)).Data.(*model.PostList); len(result.Order) == 0 {
		t.Fatal("post did not get sent to direct message")
	}

	rs3 := Client.Must(Client.Command("", "/groupmsg "+user2.Username+","+user3.Username)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+group1) {
		t.Fatal("failed to go back to existing group channel")
	}

	Client.Must(Client.Command("", "/groupmsg "+user2.Username+" foobar"))
	Client.Must(Client.Command("", "/groupmsg "+user2.Username+","+user3.Username+","+user4.Username+","+user5.Username+","+user6.Username+","+user7.Username+","+user8.Username+","+user9.Username+" foobar"))
	Client.Must(Client.Command("", "/groupmsg junk foobar"))
	Client.Must(Client.Command("", "/groupmsg junk,junk2 foobar"))
}
