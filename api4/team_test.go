// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestCreateTeam(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.Client

	team := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TEAM_OPEN}
	rteam, resp := Client.CreateTeam(team)
	CheckNoError(t, resp)

	if rteam.Name != team.Name {
		t.Fatal("names did not match")
	}

	if rteam.DisplayName != team.DisplayName {
		t.Fatal("display names did not match")
	}

	if rteam.Type != team.Type {
		t.Fatal("types did not match")
	}

	_, resp = Client.CreateTeam(rteam)
	CheckBadRequestStatus(t, resp)

	rteam.Id = ""
	_, resp = Client.CreateTeam(rteam)
	CheckErrorMessage(t, resp, "A team with that name already exists")
	CheckBadRequestStatus(t, resp)

	rteam.Name = ""
	_, resp = Client.CreateTeam(rteam)
	CheckErrorMessage(t, resp, "Name must be 2 or more lowercase alphanumeric characters")
	CheckBadRequestStatus(t, resp)

	if r, err := Client.DoApiPost("/teams", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	Client.Logout()

	_, resp = Client.CreateTeam(rteam)
	CheckUnauthorizedStatus(t, resp)

	// Update permission
	enableTeamCreation := utils.Cfg.TeamSettings.EnableTeamCreation
	defer func() {
		utils.Cfg.TeamSettings.EnableTeamCreation = enableTeamCreation
	}()
	utils.Cfg.TeamSettings.EnableTeamCreation = false
	utils.SetDefaultRolesBasedOnConfig()

	th.LoginBasic()
	_, resp = Client.CreateTeam(team)
	CheckForbiddenStatus(t, resp)

}
