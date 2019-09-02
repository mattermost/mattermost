// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestCreateTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	found := th.SystemAdminClient.Must(th.SystemAdminClient.TeamExists(name, "")).(bool)

	if !found {
		t.Fatal("Failed to create Team")
	}
}

func TestJoinTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.CheckCommand(t, "team", "add", th.BasicTeam.Name, th.BasicUser.Email)

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
	th := Setup().InitBasic()
	defer th.TearDown()

	th.CheckCommand(t, "team", "remove", th.BasicTeam.Name, th.BasicUser.Email)

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

	if teams, err := th.App.Srv.Store.Team().GetTeamsByUserId(th.BasicUser.Id); err != nil {
		if len(teams) > 0 {
			t.Fatal("Shouldn't be in team")
		}
	}
}

func TestListTeams(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := th.CheckCommand(t, "team", "list", th.BasicTeam.Name, th.BasicUser.Email)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}

func TestListArchivedTeams(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	th.CheckCommand(t, "team", "archive", name)

	output := th.CheckCommand(t, "team", "list", th.BasicTeam.Name, th.BasicUser.Email)

	if !strings.Contains(string(output), name+" (archived)") {
		t.Fatal("should have archived team")
	}
}

func TestSearchTeamsByName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := th.CheckCommand(t, "team", "search", name)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}

func TestSearchTeamsByDisplayName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := th.CheckCommand(t, "team", "search", displayName)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}

func TestSearchArchivedTeamsByName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	th.CheckCommand(t, "team", "archive", name)

	output := th.CheckCommand(t, "team", "search", name)

	if !strings.Contains(string(output), "(archived)") {
		t.Fatal("should have archived team")
	}
}

func TestArchiveTeams(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	th.CheckCommand(t, "team", "archive", name)

	output := th.CheckCommand(t, "team", "list")

	if !strings.Contains(string(output), name+" (archived)") {
		t.Fatal("should have archived team")
	}
}

func TestRestoreTeams(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	th.CheckCommand(t, "team", "archive", name)

	th.CheckCommand(t, "team", "restore", name)

	found := th.SystemAdminClient.Must(th.SystemAdminClient.TeamExists(name, "")).(bool)

	require.True(t, found)
}

func TestRenameTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	team := th.CreateTeam()

	newTeamName := "newteamnamex3"
	newDisplayName := "New Display NameX"

	th.CheckCommand(t, "team", "rename", team.Name, newTeamName, "--display_name", newDisplayName)

	// Get the team from the DB
	updatedTeam, _ := th.App.GetTeam(team.Id)

	if updatedTeam.Name != newTeamName {
		t.Fatal("failed renaming team")
	}

	if updatedTeam.DisplayName != newDisplayName {
		t.Fatal("failed updating team display name")
	}

	// Try to rename to occupied name
	team2 := th.CreateTeam()
	n := team2.Name
	dn := team2.DisplayName

	th.CheckCommand(t, "team", "rename", team2.Name, newTeamName, "--display_name", newDisplayName)

	// No renaming should have occured
	if team2.Name != n {
		t.Fatal("team was renamed when it should have not been")
	}

	if team2.DisplayName != dn {
		t.Fatal("team display name was changed when it should have not been")
	}

	// Try to change only Display Name
	team3 := th.CreateTeam()

	// trying to change only Display Name (using "-" as a new team name)
	th.CheckCommand(t, "team", "rename", team3.Name, "-", "--display_name", newDisplayName)

	// Get the team from the DB
	updatedTeam, _ = th.App.GetTeam(team3.Id)

	if updatedTeam.Name == "-" {
		t.Fatal("team was renamed to `-` but only display name should have been changed")
	}

	if updatedTeam.DisplayName != newDisplayName {
		t.Fatal("team Display Name was not properly updated")
	}

	// now try to change Display Name using old team name
	th.CheckCommand(t, "team", "rename", team3.Name, team3.Name, "--display_name", "Brand New DName")

	// Get the team from the DB
	updatedTeam, _ = th.App.GetTeam(team3.Id)

	if updatedTeam.DisplayName != "Brand New DName" {
		t.Fatal("team Display Name was not properly updated")
	}

}

func TestModifyTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	team := th.CreateTeam()

	th.CheckCommand(t, "team", "modify", team.Name, "--private")

	updatedTeam, _ := th.App.GetTeam(team.Id)

	if !updatedTeam.AllowOpenInvite && team.Type == model.TEAM_INVITE {
		t.Fatal("Failed modifying team's privacy to private")
	}

	th.CheckCommand(t, "team", "modify", team.Name, "--public")

	if updatedTeam.AllowOpenInvite && team.Type == model.TEAM_OPEN {
		t.Fatal("Failed modifying team's privacy to private")
	}

}
