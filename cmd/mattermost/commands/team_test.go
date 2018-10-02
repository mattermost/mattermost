// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/model"
)

func TestCreateTeam(t *testing.T) {
	th := api4.Setup().InitSystemAdmin()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	found := th.SystemAdminClient.Must(th.SystemAdminClient.TeamExists(name, "")).(bool)

	if !found {
		t.Fatal("Failed to create Team")
	}
}

func TestJoinTeam(t *testing.T) {
	th := api4.Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	CheckCommand(t, "team", "add", th.BasicTeam.Name, th.BasicUser.Email)

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetUsersInTeam(th.BasicTeam.Id, 0, 1000, "")).([]*model.User)

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
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	CheckCommand(t, "team", "remove", th.BasicTeam.Name, th.BasicUser.Email)

	profiles := th.Client.Must(th.Client.GetUsersInTeam(th.BasicTeam.Id, 0, 1000, "")).([]*model.User)

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

func TestListTeams(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := CheckCommand(t, "team", "list", th.BasicTeam.Name, th.BasicUser.Email)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}

func TestSearchTeamsByName(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := CheckCommand(t, "team", "search", name)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}

func TestSearchTeamsByDisplayName(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := CheckCommand(t, "team", "search", displayName)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}
