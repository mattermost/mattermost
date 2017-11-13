// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/model"
)

func TestCreateTeam(t *testing.T) {
	th := api.Setup().InitSystemAdmin()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	checkCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	found := th.SystemAdminClient.Must(th.SystemAdminClient.FindTeamByName(name)).Data.(bool)

	if !found {
		t.Fatal("Failed to create Team")
	}
}

func TestJoinTeam(t *testing.T) {
	th := api.Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	checkCommand(t, "team", "add", th.SystemAdminTeam.Name, th.BasicUser.Email)

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetProfilesInTeam(th.SystemAdminTeam.Id, 0, 1000, "")).Data.(map[string]*model.User)

	found := false

	for _, user := range profiles {
		if user.Email == th.BasicUser.Email {
			found = true
		}

	}

	if !found {
		t.Fatal("Failed to create User")
	}
}

func TestLeaveTeam(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	checkCommand(t, "team", "remove", th.BasicTeam.Name, th.BasicUser.Email)

	profiles := th.BasicClient.Must(th.BasicClient.GetProfilesInTeam(th.BasicTeam.Id, 0, 1000, "")).Data.(map[string]*model.User)

	found := false

	for _, user := range profiles {
		if user.Email == th.BasicUser.Email {
			found = true
		}

	}

	if found {
		t.Fatal("profile should not be on team")
	}

	if result := <-th.App.Srv.Store.Team().GetTeamsByUserId(th.BasicUser.Id); result.Err != nil {
		teamMembers := result.Data.([]*model.TeamMember)
		if len(teamMembers) > 0 {
			t.Fatal("Shouldn't be in team")
		}
	}
}
