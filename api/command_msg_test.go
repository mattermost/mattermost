// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
)

func TestMsgCommands(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "success+test@simulator.amazonses.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Username: "user1", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test2@simulator.amazonses.com", Nickname: "Corey Hulen 2", Username: "user2", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	user3 := &model.User{TeamId: team.Id, Email: model.NewId() + "success+test3@simulator.amazonses.com", Nickname: "Corey Hulen 3", Username: "user3", Password: "pwd"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user3.Id))

	rs1 := Client.Must(Client.Command("", "/msg user2", false)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user2.Id) && !strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+user2.Id+"__"+user1.Id) {
		t.Fatal("failed to create direct channel")
	}

	rs2 := Client.Must(Client.Command("", "/msg user3 foobar", false)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user3.Id) && !strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+user3.Id+"__"+user1.Id) {
		t.Fatal("failed to create second direct channel")
	}
	if result := Client.Must(Client.SearchPosts("foobar")).Data.(*model.PostList); len(result.Order) == 0 {
		t.Fatalf("post did not get sent to direct message")
	}

	rs3 := Client.Must(Client.Command("", "/msg user2", false)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user2.Id) && !strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+user2.Id+"__"+user1.Id) {
		t.Fatal("failed to go back to existing direct channel")
	}
}
