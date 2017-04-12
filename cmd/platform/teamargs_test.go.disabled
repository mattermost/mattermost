// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
)

func TestGetTeamFromTeamArg(t *testing.T) {
	th := app.Setup().InitBasic()

	team := th.BasicTeam

	if found := getTeamFromTeamArg(""); found != nil {
		t.Fatal("shoudn't have gotten a team", found)
	}

	if found := getTeamFromTeamArg(model.NewId()); found != nil {
		t.Fatal("shoudn't have gotten a team", found)
	}

	if found := getTeamFromTeamArg(team.Id); found == nil || found.Id != team.Id {
		t.Fatal("got incorrect team", found)
	}

	if found := getTeamFromTeamArg(team.Name); found == nil || found.Id != team.Id {
		t.Fatal("got incorrect team", found)
	}
}

func TestGetTeamsFromTeamArg(t *testing.T) {
	th := app.Setup().InitBasic()

	team := th.BasicTeam
	team2 := th.CreateTeam()

	if found := getTeamsFromTeamArgs([]string{}); len(found) != 0 {
		t.Fatal("shoudn't have gotten any teams", found)
	}

	if found := getTeamsFromTeamArgs([]string{team.Id}); len(found) == 1 && found[0].Id != team.Id {
		t.Fatal("got incorrect team", found)
	}

	if found := getTeamsFromTeamArgs([]string{team2.Name}); len(found) == 1 && found[0].Id != team2.Id {
		t.Fatal("got incorrect team", found)
	}

	if found := getTeamsFromTeamArgs([]string{team.Name, team2.Id}); len(found) != 2 {
		t.Fatal("got incorrect number of teams", found)
	} else if !(found[0].Id == team.Id && found[1].Id == team2.Id) && !(found[1].Id == team.Id && found[0].Id == team2.Id) {
		t.Fatal("got incorrect teams", found[0], found[1])
	}
}
