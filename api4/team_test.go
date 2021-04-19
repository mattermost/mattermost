// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mail"
	"github.com/mattermost/mattermost-server/v5/utils/testutils"
)

func TestCreateTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TEAM_OPEN}
		rteam, resp := client.CreateTeam(team)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		require.Equal(t, rteam.Name, team.Name, "names did not match")

		require.Equal(t, rteam.DisplayName, team.DisplayName, "display names did not match")

		require.Equal(t, rteam.Type, team.Type, "types did not match")

		_, resp = client.CreateTeam(rteam)
		CheckBadRequestStatus(t, resp)

		rteam.Id = ""
		_, resp = client.CreateTeam(rteam)
		CheckErrorMessage(t, resp, "app.team.save.existing.app_error")
		CheckBadRequestStatus(t, resp)

		rteam.Name = ""
		_, resp = client.CreateTeam(rteam)
		CheckErrorMessage(t, resp, "model.team.is_valid.characters.app_error")
		CheckBadRequestStatus(t, resp)

		r, err := client.DoApiPost("/teams", "garbage")
		require.NotNil(t, err, "should have errored")

		require.Equalf(t, r.StatusCode, http.StatusBadRequest, "wrong status code, actual: %s, expected: %s", strconv.Itoa(r.StatusCode), strconv.Itoa(http.StatusBadRequest))

		// Test GroupConstrained flag
		groupConstrainedTeam := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TEAM_OPEN, GroupConstrained: model.NewBool(true)}
		rteam, resp = client.CreateTeam(groupConstrainedTeam)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		assert.Equal(t, *rteam.GroupConstrained, *groupConstrainedTeam.GroupConstrained, "GroupConstrained flags do not match")
	})

	th.Client.Logout()

	team := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TEAM_OPEN}
	_, resp := th.Client.CreateTeam(team)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	th.RemovePermissionFromRole(model.PERMISSION_CREATE_TEAM.Id, model.SYSTEM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_CREATE_TEAM.Id, model.SYSTEM_ADMIN_ROLE_ID)

	_, resp = th.Client.CreateTeam(team)
	CheckForbiddenStatus(t, resp)
}

func TestCreateTeamSanitization(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Non-admin users can create a team, but they become a team admin by doing so

	t.Run("team admin", func(t *testing.T) {
		team := &model.Team{
			DisplayName:    t.Name() + "_1",
			Name:           GenerateTestTeamName(),
			Email:          th.GenerateTestEmail(),
			Type:           model.TEAM_OPEN,
			AllowedDomains: "simulator.amazonses.com,localhost",
		}

		rteam, resp := th.Client.CreateTeam(team)
		CheckNoError(t, resp)
		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		team := &model.Team{
			DisplayName:    t.Name() + "_2",
			Name:           GenerateTestTeamName(),
			Email:          th.GenerateTestEmail(),
			Type:           model.TEAM_OPEN,
			AllowedDomains: "simulator.amazonses.com,localhost",
		}

		rteam, resp := client.CreateTeam(team)
		CheckNoError(t, resp)
		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	}, "system admin")
}

func TestGetTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rteam, resp := client.GetTeam(team.Id, "")
		CheckNoError(t, resp)

		require.Equal(t, rteam.Id, team.Id, "wrong team")

		_, resp = client.GetTeam("junk", "")
		CheckBadRequestStatus(t, resp)

		_, resp = client.GetTeam("", "")
		CheckNotFoundStatus(t, resp)

		_, resp = client.GetTeam(model.NewId(), "")
		CheckNotFoundStatus(t, resp)
	})

	th.LoginTeamAdmin()

	team2 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN, AllowOpenInvite: false}
	rteam2, _ := Client.CreateTeam(team2)

	team3 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_INVITE, AllowOpenInvite: true}
	rteam3, _ := Client.CreateTeam(team3)

	th.LoginBasic()
	// AllowInviteOpen is false and team is open, and user is not on team
	_, resp := Client.GetTeam(rteam2.Id, "")
	CheckForbiddenStatus(t, resp)

	// AllowInviteOpen is true and team is invite, and user is not on team
	_, resp = Client.GetTeam(rteam3.Id, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetTeam(team.Id, "")
	CheckUnauthorizedStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp = client.GetTeam(rteam2.Id, "")
		CheckNoError(t, resp)
	})
}

func TestGetTeamSanitization(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	CheckNoError(t, resp)

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteam, resp := client.GetTeam(team.Id, "")
		CheckNoError(t, resp)

		require.Empty(t, rteam.Email, "should have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	t.Run("team user without invite permissions", func(t *testing.T) {
		th.RemovePermissionFromRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_USER_ROLE_ID)
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteam, resp := client.GetTeam(team.Id, "")
		CheckNoError(t, resp)

		require.Empty(t, rteam.Email, "should have sanitized email")
		require.Empty(t, rteam.InviteId, "should have sanitized inviteid")
	})

	t.Run("team admin", func(t *testing.T) {
		rteam, resp := th.Client.GetTeam(team.Id, "")
		CheckNoError(t, resp)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rteam, resp := client.GetTeam(team.Id, "")
		CheckNoError(t, resp)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	}, "system admin")
}

func TestGetTeamUnread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	teamUnread, resp := Client.GetTeamUnread(th.BasicTeam.Id, th.BasicUser.Id)
	CheckNoError(t, resp)
	require.Equal(t, teamUnread.TeamId, th.BasicTeam.Id, "wrong team id returned for regular user call")

	_, resp = Client.GetTeamUnread("junk", th.BasicUser.Id)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamUnread(th.BasicTeam.Id, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamUnread(model.NewId(), th.BasicUser.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetTeamUnread(th.BasicTeam.Id, model.NewId())
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetTeamUnread(th.BasicTeam.Id, th.BasicUser.Id)
	CheckUnauthorizedStatus(t, resp)

	teamUnread, resp = th.SystemAdminClient.GetTeamUnread(th.BasicTeam.Id, th.BasicUser.Id)
	CheckNoError(t, resp)
	require.Equal(t, teamUnread.TeamId, th.BasicTeam.Id, "wrong team id returned")
}

func TestUpdateTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := &model.Team{DisplayName: "Name", Description: "Some description", AllowOpenInvite: false, InviteId: "inviteid0", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
		var resp *model.Response
		team, resp = th.Client.CreateTeam(team)
		CheckNoError(t, resp)

		team.Description = "updated description"
		uteam, resp := client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.Equal(t, uteam.Description, "updated description", "Update failed")

		team.DisplayName = "Updated Name"
		uteam, resp = client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.Equal(t, uteam.DisplayName, "Updated Name", "Update failed")

		// Test GroupConstrained flag
		team.GroupConstrained = model.NewBool(true)
		rteam, resp := client.UpdateTeam(team)
		CheckNoError(t, resp)
		CheckOKStatus(t, resp)

		require.Equal(t, *rteam.GroupConstrained, *team.GroupConstrained, "GroupConstrained flags do not match")

		team.GroupConstrained = nil

		team.AllowOpenInvite = true
		uteam, resp = client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.True(t, uteam.AllowOpenInvite, "Update failed")

		team.InviteId = "inviteid1"
		uteam, resp = client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.NotEqual(t, uteam.InviteId, "inviteid1", "InviteID should not be updated")

		team.AllowedDomains = "domain"
		uteam, resp = client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.Equal(t, uteam.AllowedDomains, "domain", "Update failed")

		team.Name = "Updated name"
		uteam, resp = client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.NotEqual(t, uteam.Name, "Updated name", "Should not update name")

		team.Email = "test@domain.com"
		uteam, resp = client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.NotEqual(t, uteam.Email, "test@domain.com", "Should not update email")

		team.Type = model.TEAM_INVITE
		uteam, resp = client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.NotEqual(t, uteam.Type, model.TEAM_INVITE, "Should not update type")

		originalTeamId := team.Id
		team.Id = model.NewId()

		r, _ := client.DoApiPut(client.GetTeamRoute(originalTeamId), team.ToJson())
		assert.Equal(t, http.StatusBadRequest, r.StatusCode)

		require.Equal(t, uteam.Id, originalTeamId, "wrong team id")

		team.Id = "fake"
		_, resp = client.UpdateTeam(team)
		CheckBadRequestStatus(t, resp)

		th.Client.Logout() // for non-local clients
		_, resp = th.Client.UpdateTeam(team)
		CheckUnauthorizedStatus(t, resp)
		th.LoginBasic()
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		team := &model.Team{DisplayName: "New", Description: "Some description", AllowOpenInvite: false, InviteId: "inviteid0", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
		var resp *model.Response
		team, resp = client.CreateTeam(team)
		CheckNoError(t, resp)

		team.Name = "new-name"
		_, resp = client.UpdateTeam(team)
		CheckNoError(t, resp)
	})
}

func TestUpdateTeamSanitization(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	CheckNoError(t, resp)

	// Non-admin users cannot update the team

	t.Run("team admin", func(t *testing.T) {
		rteam, resp := th.Client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email for admin")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	t.Run("system admin", func(t *testing.T) {
		rteam, resp := th.SystemAdminClient.UpdateTeam(team)
		CheckNoError(t, resp)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email for admin")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})
}

func TestPatchTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := &model.Team{DisplayName: "Name", Description: "Some description", CompanyName: "Some company name", AllowOpenInvite: false, InviteId: "inviteid0", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
	team, _ = th.Client.CreateTeam(team)

	patch := &model.TeamPatch{}
	patch.DisplayName = model.NewString("Other name")
	patch.Description = model.NewString("Other description")
	patch.CompanyName = model.NewString("Other company name")
	patch.AllowOpenInvite = model.NewBool(true)

	_, resp := th.Client.PatchTeam(GenerateTestId(), patch)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.PatchTeam(team.Id, patch)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic2()
	_, resp = th.Client.PatchTeam(team.Id, patch)
	CheckForbiddenStatus(t, resp)
	th.LoginBasic()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rteam, resp := client.PatchTeam(team.Id, patch)
		CheckNoError(t, resp)

		require.Equal(t, rteam.DisplayName, "Other name", "DisplayName did not update properly")
		require.Equal(t, rteam.Description, "Other description", "Description did not update properly")
		require.Equal(t, rteam.CompanyName, "Other company name", "CompanyName did not update properly")
		require.NotEqual(t, rteam.InviteId, "inviteid1", "InviteId should not update")
		require.True(t, rteam.AllowOpenInvite, "AllowOpenInvite did not update properly")

		t.Run("Changing AllowOpenInvite to false regenerates InviteID", func(t *testing.T) {
			team2 := &model.Team{DisplayName: "Name2", Description: "Some description", CompanyName: "Some company name", AllowOpenInvite: true, InviteId: model.NewId(), Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
			team2, _ = client.CreateTeam(team2)

			patch2 := &model.TeamPatch{
				AllowOpenInvite: model.NewBool(false),
			}

			rteam2, resp2 := client.PatchTeam(team2.Id, patch2)
			CheckNoError(t, resp2)
			require.Equal(t, team2.Id, rteam2.Id)
			require.False(t, rteam2.AllowOpenInvite)
			require.NotEqual(t, team2.InviteId, rteam2.InviteId)
		})

		t.Run("Changing AllowOpenInvite to true doesn't regenerate InviteID", func(t *testing.T) {
			team2 := &model.Team{DisplayName: "Name3", Description: "Some description", CompanyName: "Some company name", AllowOpenInvite: false, InviteId: model.NewId(), Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
			team2, _ = client.CreateTeam(team2)

			patch2 := &model.TeamPatch{
				AllowOpenInvite: model.NewBool(true),
			}

			rteam2, resp2 := client.PatchTeam(team2.Id, patch2)
			CheckNoError(t, resp2)
			require.Equal(t, team2.Id, rteam2.Id)
			require.True(t, rteam2.AllowOpenInvite)
			require.Equal(t, team2.InviteId, rteam2.InviteId)
		})

		// Test GroupConstrained flag
		patch.GroupConstrained = model.NewBool(true)
		rteam, resp = client.PatchTeam(team.Id, patch)
		CheckNoError(t, resp)
		CheckOKStatus(t, resp)
		require.Equal(t, *rteam.GroupConstrained, *patch.GroupConstrained, "GroupConstrained flags do not match")

		patch.GroupConstrained = nil
		_, resp = client.PatchTeam("junk", patch)
		CheckBadRequestStatus(t, resp)

		r, err := client.DoApiPut("/teams/"+team.Id+"/patch", "garbage")
		require.NotNil(t, err, "should have errored")
		require.Equalf(t, r.StatusCode, http.StatusBadRequest, "wrong status code, actual: %s, expected: %s", strconv.Itoa(r.StatusCode), strconv.Itoa(http.StatusBadRequest))
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.PatchTeam(th.BasicTeam.Id, patch)
		CheckNoError(t, resp)
	})
}

func TestRestoreTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client

	createTeam := func(t *testing.T, deleted bool, teamType string) *model.Team {
		t.Helper()
		team := &model.Team{
			DisplayName:     "Some Team",
			Description:     "Some description",
			CompanyName:     "Some company name",
			AllowOpenInvite: (teamType == model.TEAM_OPEN),
			InviteId:        model.NewId(),
			Name:            "aa-" + model.NewRandomTeamName() + "zz",
			Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
			Type:            teamType,
		}
		team, _ = Client.CreateTeam(team)
		require.NotNil(t, team)
		if deleted {
			_, resp := th.SystemAdminClient.SoftDeleteTeam(team.Id)
			CheckOKStatus(t, resp)
		}
		return team
	}
	teamPublic := createTeam(t, true, model.TEAM_OPEN)

	t.Run("invalid team", func(t *testing.T) {
		_, resp := Client.RestoreTeam(model.NewId())
		CheckForbiddenStatus(t, resp)
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := createTeam(t, true, model.TEAM_OPEN)
		team, resp := client.RestoreTeam(team.Id)
		CheckOKStatus(t, resp)
		require.Zero(t, team.DeleteAt)
		require.Equal(t, model.TEAM_OPEN, team.Type)
	}, "restore archived public team")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := createTeam(t, true, model.TEAM_INVITE)
		team, resp := client.RestoreTeam(team.Id)
		CheckOKStatus(t, resp)
		require.Zero(t, team.DeleteAt)
		require.Equal(t, model.TEAM_INVITE, team.Type)
	}, "restore archived private team")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := createTeam(t, false, model.TEAM_OPEN)
		team, resp := client.RestoreTeam(team.Id)
		CheckOKStatus(t, resp)
		require.Zero(t, team.DeleteAt)
		require.Equal(t, model.TEAM_OPEN, team.Type)
	}, "restore active public team")

	t.Run("not logged in", func(t *testing.T) {
		Client.Logout()
		_, resp := Client.RestoreTeam(teamPublic.Id)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("no permission to manage team", func(t *testing.T) {
		th.LoginBasic2()
		_, resp := Client.RestoreTeam(teamPublic.Id)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.RestoreTeam(teamPublic.Id)
		CheckOKStatus(t, resp)
	})
}

func TestPatchTeamSanitization(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	CheckNoError(t, resp)

	// Non-admin users cannot update the team

	t.Run("team admin", func(t *testing.T) {
		rteam, resp := th.Client.PatchTeam(team.Id, &model.TeamPatch{})
		CheckNoError(t, resp)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email for admin")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	t.Run("system admin", func(t *testing.T) {
		rteam, resp := th.SystemAdminClient.PatchTeam(team.Id, &model.TeamPatch{})
		CheckNoError(t, resp)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email for admin")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})
}

func TestUpdateTeamPrivacy(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client

	createTeam := func(teamType string, allowOpenInvite bool) *model.Team {
		team := &model.Team{
			DisplayName:     teamType + " Team",
			Description:     "Some description",
			CompanyName:     "Some company name",
			AllowOpenInvite: allowOpenInvite,
			InviteId:        model.NewId(),
			Name:            "aa-" + model.NewRandomTeamName() + "zz",
			Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
			Type:            teamType,
		}
		team, _ = Client.CreateTeam(team)
		return team
	}

	teamPublic := createTeam(model.TEAM_OPEN, true)
	teamPrivate := createTeam(model.TEAM_INVITE, false)

	teamPublic2 := createTeam(model.TEAM_OPEN, true)
	teamPrivate2 := createTeam(model.TEAM_INVITE, false)

	tests := []struct {
		name                string
		team                *model.Team
		privacy             string
		errChecker          func(t *testing.T, resp *model.Response)
		wantType            string
		wantOpenInvite      bool
		wantInviteIdChanged bool
		originalInviteId    string
	}{
		{name: "bad privacy", team: teamPublic, privacy: "blap", errChecker: CheckBadRequestStatus, wantType: model.TEAM_OPEN, wantOpenInvite: true},
		{name: "public to private", team: teamPublic, privacy: model.TEAM_INVITE, errChecker: nil, wantType: model.TEAM_INVITE, wantOpenInvite: false, originalInviteId: teamPublic.InviteId, wantInviteIdChanged: true},
		{name: "private to public", team: teamPrivate, privacy: model.TEAM_OPEN, errChecker: nil, wantType: model.TEAM_OPEN, wantOpenInvite: true, originalInviteId: teamPrivate.InviteId, wantInviteIdChanged: false},
		{name: "public to public", team: teamPublic2, privacy: model.TEAM_OPEN, errChecker: nil, wantType: model.TEAM_OPEN, wantOpenInvite: true, originalInviteId: teamPublic2.InviteId, wantInviteIdChanged: false},
		{name: "private to private", team: teamPrivate2, privacy: model.TEAM_INVITE, errChecker: nil, wantType: model.TEAM_INVITE, wantOpenInvite: false, originalInviteId: teamPrivate2.InviteId, wantInviteIdChanged: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
				team, resp := client.UpdateTeamPrivacy(test.team.Id, test.privacy)
				if test.errChecker != nil {
					test.errChecker(t, resp)
					return
				}
				CheckNoError(t, resp)
				CheckOKStatus(t, resp)
				require.Equal(t, test.wantType, team.Type)
				require.Equal(t, test.wantOpenInvite, team.AllowOpenInvite)
				if test.wantInviteIdChanged {
					require.NotEqual(t, test.originalInviteId, team.InviteId)
				} else {
					require.Equal(t, test.originalInviteId, team.InviteId)
				}
			})
		})
	}

	t.Run("non-existent team", func(t *testing.T) {
		_, resp := Client.UpdateTeamPrivacy(model.NewId(), model.TEAM_INVITE)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.UpdateTeamPrivacy(model.NewId(), model.TEAM_INVITE)
		CheckNotFoundStatus(t, resp)
	}, "non-existent team for admins")

	t.Run("not logged in", func(t *testing.T) {
		Client.Logout()
		_, resp := Client.UpdateTeamPrivacy(teamPublic.Id, model.TEAM_INVITE)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("no permission to manage team", func(t *testing.T) {
		th.LoginBasic2()
		_, resp := Client.UpdateTeamPrivacy(teamPublic.Id, model.TEAM_INVITE)
		CheckForbiddenStatus(t, resp)
	})
}

func TestTeamUnicodeNames(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client

	t.Run("create team unicode", func(t *testing.T) {
		team := &model.Team{
			Name:        GenerateTestUsername(),
			DisplayName: "Some\u206c Team",
			Description: "A \ufffatest\ufffb channel.",
			CompanyName: "\ufeffAcme Inc\ufffc",
			Type:        model.TEAM_OPEN}
		rteam, resp := Client.CreateTeam(team)
		CheckNoError(t, resp)
		CheckCreatedStatus(t, resp)

		require.Equal(t, "Some Team", rteam.DisplayName, "bad unicode should be filtered from display name")
		require.Equal(t, "A test channel.", rteam.Description, "bad unicode should be filtered from description")
		require.Equal(t, "Acme Inc", rteam.CompanyName, "bad unicode should be filtered from company name")
	})

	t.Run("update team unicode", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Name",
			Description: "Some description",
			CompanyName: "Bad Company",
			Name:        model.NewRandomTeamName(),
			Email:       "success+" + model.NewId() + "@simulator.amazonses.com",
			Type:        model.TEAM_OPEN}
		team, _ = Client.CreateTeam(team)

		team.DisplayName = "\u206eThe Team\u206f"
		team.Description = "A \u17a3great\u17d3 team."
		team.CompanyName = "\u206aAcme Inc"
		uteam, resp := Client.UpdateTeam(team)
		CheckNoError(t, resp)

		require.Equal(t, "The Team", uteam.DisplayName, "bad unicode should be filtered from display name")
		require.Equal(t, "A great team.", uteam.Description, "bad unicode should be filtered from description")
		require.Equal(t, "Acme Inc", uteam.CompanyName, "bad unicode should be filtered from company name")
	})

	t.Run("patch team unicode", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Name",
			Description: "Some description",
			CompanyName: "Some company name",
			Name:        model.NewRandomTeamName(),
			Email:       "success+" + model.NewId() + "@simulator.amazonses.com",
			Type:        model.TEAM_OPEN}
		team, _ = Client.CreateTeam(team)

		patch := &model.TeamPatch{}

		patch.DisplayName = model.NewString("Goat\u206e Team")
		patch.Description = model.NewString("\ufffaGreat team.")
		patch.CompanyName = model.NewString("\u202bAcme Inc\u202c")

		rteam, resp := Client.PatchTeam(team.Id, patch)
		CheckNoError(t, resp)

		require.Equal(t, "Goat Team", rteam.DisplayName, "bad unicode should be filtered from display name")
		require.Equal(t, "Great team.", rteam.Description, "bad unicode should be filtered from description")
		require.Equal(t, "Acme Inc", rteam.CompanyName, "bad unicode should be filtered from company name")
	})
}

func TestRegenerateTeamInviteId(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client

	team := &model.Team{DisplayName: "Name", Description: "Some description", CompanyName: "Some company name", AllowOpenInvite: false, InviteId: "inviteid0", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
	team, _ = Client.CreateTeam(team)

	assert.NotEqual(t, team.InviteId, "")
	assert.NotEqual(t, team.InviteId, "inviteid0")

	rteam, resp := Client.RegenerateTeamInviteId(team.Id)
	CheckNoError(t, resp)

	assert.NotEqual(t, team.InviteId, rteam.InviteId)
	assert.NotEqual(t, team.InviteId, "")
}

func TestSoftDeleteTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, resp := th.Client.SoftDeleteTeam(th.BasicTeam.Id)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.SoftDeleteTeam(th.BasicTeam.Id)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	team := &model.Team{DisplayName: "DisplayName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN}
	team, _ = th.Client.CreateTeam(team)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		ok, resp := client.SoftDeleteTeam(team.Id)
		CheckNoError(t, resp)

		require.True(t, ok, "should have returned true")

		rteam, err := th.App.GetTeam(team.Id)
		require.Nil(t, err, "should have returned archived team")
		require.NotEqual(t, rteam.DeleteAt, 0, "should have not set to zero")

		ok, resp = client.SoftDeleteTeam("junk")
		CheckBadRequestStatus(t, resp)

		require.False(t, ok, "should have returned false")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.SoftDeleteTeam(th.BasicTeam.Id)
		CheckNoError(t, resp)
	})
}

func TestPermanentDeleteTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	enableAPITeamDeletion := *th.App.Config().ServiceSettings.EnableAPITeamDeletion
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableAPITeamDeletion = &enableAPITeamDeletion })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPITeamDeletion = false })

	t.Run("Permanent deletion not available through API if EnableAPITeamDeletion is not set", func(t *testing.T) {
		team := &model.Team{DisplayName: "DisplayName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN}
		team, _ = th.Client.CreateTeam(team)

		_, resp := th.Client.PermanentDeleteTeam(team.Id)
		CheckUnauthorizedStatus(t, resp)

		_, resp = th.SystemAdminClient.PermanentDeleteTeam(team.Id)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("Permanent deletion available through local mode even if EnableAPITeamDeletion is not set", func(t *testing.T) {
		team := &model.Team{DisplayName: "DisplayName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN}
		team, _ = th.Client.CreateTeam(team)

		ok, resp := th.LocalClient.PermanentDeleteTeam(team.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableAPITeamDeletion = &enableAPITeamDeletion })
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPITeamDeletion = true })

		team := &model.Team{DisplayName: "DisplayName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN}
		team, _ = client.CreateTeam(team)
		ok, resp := client.PermanentDeleteTeam(team.Id)
		CheckNoError(t, resp)
		assert.True(t, ok)

		_, err := th.App.GetTeam(team.Id)
		assert.NotNil(t, err)

		ok, resp = client.PermanentDeleteTeam("junk")
		CheckBadRequestStatus(t, resp)

		require.False(t, ok, "should have returned false")
	}, "Permanent deletion with EnableAPITeamDeletion set")
}

func TestGetAllTeams(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	team1 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN, AllowOpenInvite: true}
	team1, resp := Client.CreateTeam(team1)
	CheckNoError(t, resp)

	team2 := &model.Team{DisplayName: "Name2", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN, AllowOpenInvite: true}
	team2, resp = Client.CreateTeam(team2)
	CheckNoError(t, resp)

	team3 := &model.Team{DisplayName: "Name3", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN, AllowOpenInvite: false}
	team3, resp = Client.CreateTeam(team3)
	CheckNoError(t, resp)

	team4 := &model.Team{DisplayName: "Name4", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN, AllowOpenInvite: false}
	team4, resp = Client.CreateTeam(team4)
	CheckNoError(t, resp)

	testCases := []struct {
		Name               string
		Page               int
		PerPage            int
		Permissions        []string
		ExpectedTeams      []string
		WithCount          bool
		ExpectedCount      int64
		ExpectedError      bool
		ErrorId            string
		ExpectedStatusCode int
	}{
		{
			Name:          "Get 1 team per page",
			Page:          0,
			PerPage:       1,
			Permissions:   []string{model.PERMISSION_LIST_PUBLIC_TEAMS.Id},
			ExpectedTeams: []string{team1.Id},
		},
		{
			Name:          "Get second page with 1 team per page",
			Page:          1,
			PerPage:       1,
			Permissions:   []string{model.PERMISSION_LIST_PUBLIC_TEAMS.Id},
			ExpectedTeams: []string{team2.Id},
		},
		{
			Name:          "Get no items per page",
			Page:          1,
			PerPage:       0,
			Permissions:   []string{model.PERMISSION_LIST_PUBLIC_TEAMS.Id},
			ExpectedTeams: []string{},
		},
		{
			Name:          "Get all open teams",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PERMISSION_LIST_PUBLIC_TEAMS.Id},
			ExpectedTeams: []string{team1.Id, team2.Id},
		},
		{
			Name:          "Get all private teams",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PERMISSION_LIST_PRIVATE_TEAMS.Id},
			ExpectedTeams: []string{th.BasicTeam.Id, team3.Id, team4.Id},
		},
		{
			Name:          "Get all teams",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PERMISSION_LIST_PUBLIC_TEAMS.Id, model.PERMISSION_LIST_PRIVATE_TEAMS.Id},
			ExpectedTeams: []string{th.BasicTeam.Id, team1.Id, team2.Id, team3.Id, team4.Id},
		},
		{
			Name:               "Get no teams because permissions",
			Page:               0,
			PerPage:            10,
			Permissions:        []string{},
			ExpectedError:      true,
			ExpectedStatusCode: http.StatusForbidden,
			ErrorId:            "api.team.get_all_teams.insufficient_permissions",
		},
		{
			Name:               "Get no teams because permissions with count",
			Page:               0,
			PerPage:            10,
			Permissions:        []string{},
			WithCount:          true,
			ExpectedError:      true,
			ExpectedStatusCode: http.StatusForbidden,
			ErrorId:            "api.team.get_all_teams.insufficient_permissions",
		},
		{
			Name:          "Get all teams with count",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PERMISSION_LIST_PUBLIC_TEAMS.Id, model.PERMISSION_LIST_PRIVATE_TEAMS.Id},
			ExpectedTeams: []string{th.BasicTeam.Id, team1.Id, team2.Id, team3.Id, team4.Id},
			WithCount:     true,
			ExpectedCount: 5,
		},
		{
			Name:          "Get all public teams with count",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PERMISSION_LIST_PUBLIC_TEAMS.Id},
			ExpectedTeams: []string{team1.Id, team2.Id},
			WithCount:     true,
			ExpectedCount: 2,
		},
		{
			Name:          "Get all private teams with count",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PERMISSION_LIST_PRIVATE_TEAMS.Id},
			ExpectedTeams: []string{th.BasicTeam.Id, team3.Id, team4.Id},
			WithCount:     true,
			ExpectedCount: 3,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			defaultRolePermissions := th.SaveDefaultRolePermissions()
			defer func() {
				th.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			th.RemovePermissionFromRole(model.PERMISSION_LIST_PUBLIC_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
			th.RemovePermissionFromRole(model.PERMISSION_JOIN_PUBLIC_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
			th.RemovePermissionFromRole(model.PERMISSION_LIST_PRIVATE_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
			th.RemovePermissionFromRole(model.PERMISSION_JOIN_PRIVATE_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
			for _, permission := range tc.Permissions {
				th.AddPermissionToRole(permission, model.SYSTEM_USER_ROLE_ID)
			}

			var teams []*model.Team
			var count int64
			if tc.WithCount {
				teams, count, resp = Client.GetAllTeamsWithTotalCount("", tc.Page, tc.PerPage)
			} else {
				teams, resp = Client.GetAllTeams("", tc.Page, tc.PerPage)
			}
			if tc.ExpectedError {
				CheckErrorMessage(t, resp, tc.ErrorId)
				checkHTTPStatus(t, resp, tc.ExpectedStatusCode, true)
				return
			}
			CheckNoError(t, resp)
			require.Equal(t, len(tc.ExpectedTeams), len(teams))
			for idx, team := range teams {
				assert.Equal(t, tc.ExpectedTeams[idx], team.Id)
			}
			require.Equal(t, tc.ExpectedCount, count)
		})
	}

	t.Run("Local mode", func(t *testing.T) {
		teams, res := th.LocalClient.GetAllTeams("", 0, 10)
		CheckNoError(t, res)
		require.Len(t, teams, 5)
	})

	t.Run("Unauthorized", func(t *testing.T) {
		Client.Logout()
		_, resp = Client.GetAllTeams("", 1, 10)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetAllTeamsSanitization(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:     t.Name() + "_1",
		Name:            GenerateTestTeamName(),
		Email:           th.GenerateTestEmail(),
		Type:            model.TEAM_OPEN,
		AllowedDomains:  "simulator.amazonses.com,localhost",
		AllowOpenInvite: true,
	})
	CheckNoError(t, resp)
	team2, resp := th.SystemAdminClient.CreateTeam(&model.Team{
		DisplayName:     t.Name() + "_2",
		Name:            GenerateTestTeamName(),
		Email:           th.GenerateTestEmail(),
		Type:            model.TEAM_OPEN,
		AllowedDomains:  "simulator.amazonses.com,localhost",
		AllowOpenInvite: true,
	})
	CheckNoError(t, resp)

	// This may not work if the server has over 1000 open teams on it

	t.Run("team admin/non-admin", func(t *testing.T) {
		teamFound := false
		team2Found := false

		rteams, resp := th.Client.GetAllTeams("", 0, 1000)
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			if rteam.Id == team.Id {
				teamFound = true
				require.NotEmpty(t, rteam.Email, "should not have sanitized email for team admin")
				require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
			} else if rteam.Id == team2.Id {
				team2Found = true
				require.Empty(t, rteam.Email, "should have sanitized email for team admin")
				require.Empty(t, rteam.InviteId, "should have sanitized inviteid")
			}
		}

		require.True(t, teamFound, "wasn't returned the expected teams so the test wasn't run correctly")
		require.True(t, team2Found, "wasn't returned the expected teams so the test wasn't run correctly")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rteams, resp := client.GetAllTeams("", 0, 1000)
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			if rteam.Id != team.Id && rteam.Id != team2.Id {
				continue
			}

			require.NotEmpty(t, rteam.Email, "should not have sanitized email")
			require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
		}
	}, "system admin")
}

func TestGetTeamByName(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	team := th.BasicTeam

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rteam, resp := client.GetTeamByName(team.Name, "")
		CheckNoError(t, resp)

		require.Equal(t, rteam.Name, team.Name, "wrong team")

		_, resp = client.GetTeamByName("junk", "")
		CheckNotFoundStatus(t, resp)

		_, resp = client.GetTeamByName("", "")
		CheckNotFoundStatus(t, resp)

	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.GetTeamByName(strings.ToUpper(team.Name), "")
		CheckNoError(t, resp)
	})

	th.Client.Logout()
	_, resp := th.Client.GetTeamByName(team.Name, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetTeamByName(team.Name, "")
	CheckNoError(t, resp)

	th.LoginTeamAdmin()

	team2 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_OPEN, AllowOpenInvite: false}
	rteam2, _ := th.Client.CreateTeam(team2)

	team3 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_INVITE, AllowOpenInvite: true}
	rteam3, _ := th.Client.CreateTeam(team3)

	th.LoginBasic()
	// AllowInviteOpen is false and team is open, and user is not on team
	_, resp = th.Client.GetTeamByName(rteam2.Name, "")
	CheckForbiddenStatus(t, resp)

	// AllowInviteOpen is true and team is invite only, and user is not on team
	_, resp = th.Client.GetTeamByName(rteam3.Name, "")
	CheckForbiddenStatus(t, resp)
}

func TestGetTeamByNameSanitization(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	CheckNoError(t, resp)

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteam, resp := client.GetTeamByName(team.Name, "")
		CheckNoError(t, resp)

		require.Empty(t, rteam.Email, "should've sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
	})

	t.Run("team user without invite permissions", func(t *testing.T) {
		th.RemovePermissionFromRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_USER_ROLE_ID)
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()

		th.LoginBasic2WithClient(client)

		rteam, resp := client.GetTeam(team.Id, "")
		CheckNoError(t, resp)

		require.Empty(t, rteam.Email, "should have sanitized email")
		require.Empty(t, rteam.InviteId, "should have sanitized inviteid")
	})

	t.Run("team admin/non-admin", func(t *testing.T) {
		rteam, resp := th.Client.GetTeamByName(team.Name, "")
		CheckNoError(t, resp)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
	})

	t.Run("system admin", func(t *testing.T) {
		rteam, resp := th.SystemAdminClient.GetTeamByName(team.Name, "")
		CheckNoError(t, resp)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
	})
}

func TestSearchAllTeams(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	oTeam := th.BasicTeam
	oTeam.AllowOpenInvite = true

	updatedTeam, err := th.App.UpdateTeam(oTeam)
	require.Nil(t, err, err)
	oTeam.UpdateAt = updatedTeam.UpdateAt

	pTeam := &model.Team{DisplayName: "PName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_INVITE}
	th.Client.CreateTeam(pTeam)

	rteams, resp := th.Client.SearchTeams(&model.TeamSearch{Term: pTeam.Name})
	CheckNoError(t, resp)
	require.Empty(t, rteams, "should have not returned team")

	rteams, resp = th.Client.SearchTeams(&model.TeamSearch{Term: pTeam.DisplayName})
	CheckNoError(t, resp)
	require.Empty(t, rteams, "should have not returned team")

	th.Client.Logout()

	_, resp = th.Client.SearchTeams(&model.TeamSearch{Term: pTeam.Name})
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.Client.SearchTeams(&model.TeamSearch{Term: pTeam.DisplayName})
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rteams, resp := client.SearchTeams(&model.TeamSearch{Term: oTeam.Name})
		CheckNoError(t, resp)
		require.Len(t, rteams, 1, "should have returned 1 team")
		require.Equal(t, oTeam.Id, rteams[0].Id, "invalid team")

		rteams, resp = client.SearchTeams(&model.TeamSearch{Term: oTeam.DisplayName})
		CheckNoError(t, resp)
		require.Len(t, rteams, 1, "should have returned 1 team")
		require.Equal(t, oTeam.Id, rteams[0].Id, "invalid team")

		rteams, resp = client.SearchTeams(&model.TeamSearch{Term: "junk"})
		CheckNoError(t, resp)
		require.Empty(t, rteams, "should have not returned team")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rteams, resp := client.SearchTeams(&model.TeamSearch{Term: oTeam.Name})
		CheckNoError(t, resp)
		require.Len(t, rteams, 1, "should have returned 1 team")

		rteams, resp = client.SearchTeams(&model.TeamSearch{Term: pTeam.DisplayName})
		CheckNoError(t, resp)
		require.Len(t, rteams, 1, "should have returned 1 team")
	})
}

func TestSearchAllTeamsPaged(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	commonRandom := model.NewId()
	teams := [3]*model.Team{}

	for i := 0; i < 3; i++ {
		uid := model.NewId()
		newTeam, err := th.App.CreateTeam(&model.Team{
			DisplayName: fmt.Sprintf("%s %d %s", commonRandom, i, uid),
			Name:        fmt.Sprintf("%s-%d-%s", commonRandom, i, uid),
			Type:        model.TEAM_OPEN,
			Email:       th.GenerateTestEmail(),
		})
		require.Nil(t, err)
		teams[i] = newTeam
	}

	foobarTeam, err := th.App.CreateTeam(&model.Team{
		DisplayName: "FOOBARDISPLAYNAME",
		Name:        "whatever",
		Type:        model.TEAM_OPEN,
		Email:       th.GenerateTestEmail(),
	})
	require.Nil(t, err)

	testCases := []struct {
		Name               string
		Search             *model.TeamSearch
		ExpectedTeams      []string
		ExpectedTotalCount int64
	}{
		{
			Name:               "Retrieve foobar team using partial term search",
			Search:             &model.TeamSearch{Term: "oobardisplay", Page: model.NewInt(0), PerPage: model.NewInt(100)},
			ExpectedTeams:      []string{foobarTeam.Id},
			ExpectedTotalCount: 1,
		},
		{
			Name:               "Retrieve foobar team using the beginning of the display name as search text",
			Search:             &model.TeamSearch{Term: "foobar", Page: model.NewInt(0), PerPage: model.NewInt(100)},
			ExpectedTeams:      []string{foobarTeam.Id},
			ExpectedTotalCount: 1,
		},
		{
			Name:               "Retrieve foobar team using the ending of the term of the display name",
			Search:             &model.TeamSearch{Term: "bardisplayname", Page: model.NewInt(0), PerPage: model.NewInt(100)},
			ExpectedTeams:      []string{foobarTeam.Id},
			ExpectedTotalCount: 1,
		},
		{
			Name:               "Retrieve foobar team using partial term search on the name property of team",
			Search:             &model.TeamSearch{Term: "what", Page: model.NewInt(0), PerPage: model.NewInt(100)},
			ExpectedTeams:      []string{foobarTeam.Id},
			ExpectedTotalCount: 1,
		},
		{
			Name:               "Retrieve foobar team using partial term search on the name property of team #2",
			Search:             &model.TeamSearch{Term: "ever", Page: model.NewInt(0), PerPage: model.NewInt(100)},
			ExpectedTeams:      []string{foobarTeam.Id},
			ExpectedTotalCount: 1,
		},
		{
			Name:               "Get all teams on one page",
			Search:             &model.TeamSearch{Term: commonRandom, Page: model.NewInt(0), PerPage: model.NewInt(100)},
			ExpectedTeams:      []string{teams[0].Id, teams[1].Id, teams[2].Id},
			ExpectedTotalCount: 3,
		},
		{
			Name:               "Get all teams on one page with partial word",
			Search:             &model.TeamSearch{Term: commonRandom[11:18]},
			ExpectedTeams:      []string{teams[0].Id, teams[1].Id, teams[2].Id},
			ExpectedTotalCount: 3,
		},
		{
			Name:               "Get all teams on one page with term upper cased",
			Search:             &model.TeamSearch{Term: strings.ToUpper(commonRandom)},
			ExpectedTeams:      []string{teams[0].Id, teams[1].Id, teams[2].Id},
			ExpectedTotalCount: 3,
		},
		{
			Name:               "Get all teams on one page with some of term upper and some lower",
			Search:             &model.TeamSearch{Term: commonRandom[0:11] + strings.ToUpper(commonRandom[11:18]+commonRandom[18:])},
			ExpectedTeams:      []string{teams[0].Id, teams[1].Id, teams[2].Id},
			ExpectedTotalCount: 3,
		},
		{
			Name:               "Get 2 teams on the first page",
			Search:             &model.TeamSearch{Term: commonRandom, Page: model.NewInt(0), PerPage: model.NewInt(2)},
			ExpectedTeams:      []string{teams[0].Id, teams[1].Id},
			ExpectedTotalCount: 3,
		},
		{
			Name:               "Get 1 team on the second page",
			Search:             &model.TeamSearch{Term: commonRandom, Page: model.NewInt(1), PerPage: model.NewInt(2)},
			ExpectedTeams:      []string{teams[2].Id},
			ExpectedTotalCount: 3,
		},
		{
			Name:               "SearchTeamsPaged paginates results by default",
			Search:             &model.TeamSearch{Term: commonRandom},
			ExpectedTeams:      []string{teams[0].Id, teams[1].Id, teams[2].Id},
			ExpectedTotalCount: 3,
		},
		{
			Name:               "No results",
			Search:             &model.TeamSearch{Term: model.NewId()},
			ExpectedTeams:      []string{},
			ExpectedTotalCount: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			teams, count, resp := th.SystemAdminClient.SearchTeamsPaged(tc.Search)
			require.Nil(t, resp.Error)
			require.Equal(t, tc.ExpectedTotalCount, count)
			require.Equal(t, len(tc.ExpectedTeams), len(teams))
			for i, team := range teams {
				require.Equal(t, tc.ExpectedTeams[i], team.Id)
			}
		})
	}

	_, _, resp := th.Client.SearchTeamsPaged(&model.TeamSearch{Term: commonRandom, PerPage: model.NewInt(100)})
	require.Equal(t, "api.team.search_teams.pagination_not_implemented.public_team_search", resp.Error.Id)
	require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
}

func TestSearchAllTeamsSanitization(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	CheckNoError(t, resp)
	team2, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_2",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	CheckNoError(t, resp)

	t.Run("non-team user", func(t *testing.T) {
		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteams, resp := client.SearchTeams(&model.TeamSearch{Term: t.Name()})
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			require.Empty(t, rteam.Email, "should've sanitized email")
			require.Empty(t, rteam.AllowedDomains, "should've sanitized allowed domains")
			require.Empty(t, rteam.InviteId, "should have sanitized inviteid")
		}
	})

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteams, resp := client.SearchTeams(&model.TeamSearch{Term: t.Name()})
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			require.Empty(t, rteam.Email, "should've sanitized email")
			require.Empty(t, rteam.AllowedDomains, "should've sanitized allowed domains")
			require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
		}
	})

	t.Run("team admin", func(t *testing.T) {
		rteams, resp := th.Client.SearchTeams(&model.TeamSearch{Term: t.Name()})
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			if rteam.Id == team.Id || rteam.Id == team2.Id || rteam.Id == th.BasicTeam.Id {
				require.NotEmpty(t, rteam.Email, "should not have sanitized email")
				require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
			}
		}
	})

	t.Run("system admin", func(t *testing.T) {
		rteams, resp := th.SystemAdminClient.SearchTeams(&model.TeamSearch{Term: t.Name()})
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			require.NotEmpty(t, rteam.Email, "should not have sanitized email")
			require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
		}
	})
}

func TestGetTeamsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	team2 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TEAM_INVITE}
	rteam2, _ := Client.CreateTeam(team2)

	teams, resp := Client.GetTeamsForUser(th.BasicUser.Id, "")
	CheckNoError(t, resp)

	require.Len(t, teams, 2, "wrong number of teams")

	found1 := false
	found2 := false
	for _, t := range teams {
		if t.Id == th.BasicTeam.Id {
			found1 = true
		} else if t.Id == rteam2.Id {
			found2 = true
		}
	}

	require.True(t, found1, "missing team")
	require.True(t, found2, "missing team")

	_, resp = Client.GetTeamsForUser("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamsForUser(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetTeamsForUser(th.BasicUser2.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetTeamsForUser(th.BasicUser2.Id, "")
	CheckNoError(t, resp)
}

func TestGetTeamsForUserSanitization(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	CheckNoError(t, resp)
	team2, resp := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_2",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	CheckNoError(t, resp)

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)
		th.LinkUserToTeam(th.BasicUser2, team2)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteams, resp := client.GetTeamsForUser(th.BasicUser2.Id, "")
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			if rteam.Id != team.Id && rteam.Id != team2.Id {
				continue
			}

			require.Empty(t, rteam.Email, "should've sanitized email")
			require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
		}
	})

	t.Run("team user without invite permissions", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)
		th.LinkUserToTeam(th.BasicUser2, team2)

		client := th.CreateClient()
		th.RemovePermissionFromRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_USER_ROLE_ID)
		th.LoginBasic2WithClient(client)

		rteams, resp := client.GetTeamsForUser(th.BasicUser2.Id, "")
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			if rteam.Id != team.Id && rteam.Id != team2.Id {
				continue
			}

			require.Empty(t, rteam.Email, "should have sanitized email")
			require.Empty(t, rteam.InviteId, "should have sanitized inviteid")
		}
	})

	t.Run("team admin", func(t *testing.T) {
		rteams, resp := th.Client.GetTeamsForUser(th.BasicUser.Id, "")
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			if rteam.Id != team.Id && rteam.Id != team2.Id {
				continue
			}

			require.NotEmpty(t, rteam.Email, "should not have sanitized email")
			require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
		}
	})

	t.Run("system admin", func(t *testing.T) {
		rteams, resp := th.SystemAdminClient.GetTeamsForUser(th.BasicUser.Id, "")
		CheckNoError(t, resp)
		for _, rteam := range rteams {
			if rteam.Id != team.Id && rteam.Id != team2.Id {
				continue
			}

			require.NotEmpty(t, rteam.Email, "should not have sanitized email")
			require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
		}
	})
}

func TestGetTeamMember(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam
	user := th.BasicUser

	rmember, resp := Client.GetTeamMember(team.Id, user.Id, "")
	CheckNoError(t, resp)

	require.Equal(t, rmember.TeamId, team.Id, "wrong team id")

	require.Equal(t, rmember.UserId, user.Id, "wrong user id")

	_, resp = Client.GetTeamMember("junk", user.Id, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamMember(team.Id, "junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamMember("junk", "junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamMember(team.Id, model.NewId(), "")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetTeamMember(model.NewId(), user.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetTeamMember(team.Id, user.Id, "")
	CheckNoError(t, resp)
}

func TestGetTeamMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam
	userNotMember := th.CreateUser()

	rmembers, resp := Client.GetTeamMembers(team.Id, 0, 100, "")
	CheckNoError(t, resp)

	t.Logf("rmembers count %v\n", len(rmembers))

	require.NotEqual(t, len(rmembers), 0, "should have results")

	for _, rmember := range rmembers {
		require.Equal(t, rmember.TeamId, team.Id, "user should be a member of team")
		require.NotEqual(t, rmember.UserId, userNotMember.Id, "user should be a member of team")
	}

	rmembers, resp = Client.GetTeamMembers(team.Id, 0, 1, "")
	CheckNoError(t, resp)
	require.Len(t, rmembers, 1, "should be 1 per page")

	rmembers, resp = Client.GetTeamMembers(team.Id, 1, 1, "")
	CheckNoError(t, resp)
	require.Len(t, rmembers, 1, "should be 1 per page")

	rmembers, resp = Client.GetTeamMembers(team.Id, 10000, 100, "")
	CheckNoError(t, resp)
	require.Empty(t, rmembers, "should be no member")

	rmembers, resp = Client.GetTeamMembers(team.Id, 0, 2, "")
	CheckNoError(t, resp)
	rmembers2, resp := Client.GetTeamMembers(team.Id, 1, 2, "")
	CheckNoError(t, resp)

	for _, tm1 := range rmembers {
		for _, tm2 := range rmembers2 {
			assert.NotEqual(t, tm1.UserId+tm1.TeamId, tm2.UserId+tm2.TeamId, "different pages should not have the same members")
		}
	}

	_, resp = Client.GetTeamMembers("junk", 0, 100, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamMembers(model.NewId(), 0, 100, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetTeamMembers(team.Id, 0, 1, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, "", false, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, model.USERNAME, false, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, model.USERNAME, true, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, "", true, "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, model.USERNAME, false, "")
	CheckNoError(t, resp)
}

func TestGetTeamMembersForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	members, resp := Client.GetTeamMembersForUser(th.BasicUser.Id, "")
	CheckNoError(t, resp)

	found := false
	for _, m := range members {
		if m.TeamId == th.BasicTeam.Id {
			found = true
		}
	}

	require.True(t, found, "missing team member")

	_, resp = Client.GetTeamMembersForUser("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamMembersForUser(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetTeamMembersForUser(th.BasicUser.Id, "")
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetTeamMembersForUser(th.BasicUser.Id, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetTeamMembersForUser(th.BasicUser.Id, "")
	CheckNoError(t, resp)
}

func TestGetTeamMembersByIds(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	tm, resp := Client.GetTeamMembersByIds(th.BasicTeam.Id, []string{th.BasicUser.Id})
	CheckNoError(t, resp)

	require.Equal(t, tm[0].UserId, th.BasicUser.Id, "returned wrong user")

	_, resp = Client.GetTeamMembersByIds(th.BasicTeam.Id, []string{})
	CheckBadRequestStatus(t, resp)

	tm1, resp := Client.GetTeamMembersByIds(th.BasicTeam.Id, []string{"junk"})
	CheckNoError(t, resp)
	require.False(t, len(tm1) > 0, "no users should be returned")

	tm1, resp = Client.GetTeamMembersByIds(th.BasicTeam.Id, []string{"junk", th.BasicUser.Id})
	CheckNoError(t, resp)
	require.Len(t, tm1, 1, "1 user should be returned")

	_, resp = Client.GetTeamMembersByIds("junk", []string{th.BasicUser.Id})
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamMembersByIds(model.NewId(), []string{th.BasicUser.Id})
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetTeamMembersByIds(th.BasicTeam.Id, []string{th.BasicUser.Id})
	CheckUnauthorizedStatus(t, resp)
}

func TestAddTeamMember(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam
	otherUser := th.CreateUser()

	th.App.Srv().SetLicense(model.NewTestLicense(""))
	defer th.App.Srv().SetLicense(nil)

	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GuestAccountsSettings.Enable = &enableGuestAccounts })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })

	guest := th.CreateUser()
	_, resp := th.SystemAdminClient.DemoteUserToGuest(guest.Id)
	CheckNoError(t, resp)

	err := th.App.RemoveUserFromTeam(th.BasicTeam.Id, th.BasicUser2.Id, "")
	if err != nil {
		require.FailNow(t, err.Error())
	}

	// Regular user can't add a member to a team they don't belong to.
	th.LoginBasic2()
	_, resp = Client.AddTeamMember(team.Id, otherUser.Id)
	CheckForbiddenStatus(t, resp)
	require.NotNil(t, resp.Error, "Error is nil")
	Client.Logout()

	// SystemAdmin and mode can add member to a team
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		tm, r := client.AddTeamMember(team.Id, otherUser.Id)
		CheckNoError(t, r)
		CheckCreatedStatus(t, r)
		require.Equal(t, tm.UserId, otherUser.Id, "user ids should have matched")
		require.Equal(t, tm.TeamId, team.Id, "team ids should have matched")
	})

	// Regular user can add a member to a team they belong to.
	th.LoginBasic()
	tm, resp := Client.AddTeamMember(team.Id, otherUser.Id)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	// Check all the returned data.
	require.NotNil(t, tm, "should have returned team member")

	require.Equal(t, tm.UserId, otherUser.Id, "user ids should have matched")

	require.Equal(t, tm.TeamId, team.Id, "team ids should have matched")

	// Check with various invalid requests.
	tm, resp = Client.AddTeamMember(team.Id, "junk")
	CheckBadRequestStatus(t, resp)

	require.Nil(t, tm, "should have not returned team member")

	_, resp = Client.AddTeamMember("junk", otherUser.Id)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.AddTeamMember(GenerateTestId(), otherUser.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.AddTeamMember(team.Id, GenerateTestId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	// Set the config so that only team admins can add a user to a team.
	th.AddPermissionToRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_ADD_USER_TO_TEAM.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_USER_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_ADD_USER_TO_TEAM.Id, model.TEAM_USER_ROLE_ID)

	th.LoginBasic()

	// Check that a regular user can't add someone to the team.
	_, resp = Client.AddTeamMember(team.Id, otherUser.Id)
	CheckForbiddenStatus(t, resp)

	// Update user to team admin
	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.Srv().InvalidateAllCaches()
	th.LoginBasic()

	// Should work as a team admin.
	_, resp = Client.AddTeamMember(team.Id, otherUser.Id)
	CheckNoError(t, resp)

	// Change permission level to team user
	th.AddPermissionToRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_ADD_USER_TO_TEAM.Id, model.TEAM_USER_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_ADD_USER_TO_TEAM.Id, model.TEAM_ADMIN_ROLE_ID)

	th.UpdateUserToNonTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.Srv().InvalidateAllCaches()
	th.LoginBasic()

	// Should work as a regular user.
	_, resp = Client.AddTeamMember(team.Id, otherUser.Id)
	CheckNoError(t, resp)

	// Should return error with invalid JSON in body.
	_, err = Client.DoApiPost("/teams/"+team.Id+"/members", "invalid")
	require.NotNil(t, err)
	require.Equal(t, "api.team.add_team_member.invalid_body.app_error", err.Id)

	// by token
	Client.Login(otherUser.Email, otherUser.Password)

	token := model.NewToken(
		app.TokenTypeTeamInvitation,
		model.MapToJson(map[string]string{"teamId": team.Id}),
	)
	require.NoError(t, th.App.Srv().Store.Token().Save(token))

	tm, resp = Client.AddTeamMemberFromInvite(token.Token, "")
	CheckNoError(t, resp)

	require.NotNil(t, tm, "should have returned team member")

	require.Equal(t, tm.UserId, otherUser.Id, "user ids should have matched")

	require.Equal(t, tm.TeamId, team.Id, "team ids should have matched")

	_, nErr := th.App.Srv().Store.Token().GetByToken(token.Token)
	require.Error(t, nErr, "The token must be deleted after be used")

	tm, resp = Client.AddTeamMemberFromInvite("junk", "")
	CheckBadRequestStatus(t, resp)

	require.Nil(t, tm, "should have not returned team member")

	// expired token of more than 50 hours
	token = model.NewToken(app.TokenTypeTeamInvitation, "")
	token.CreateAt = model.GetMillis() - 1000*60*60*50
	require.NoError(t, th.App.Srv().Store.Token().Save(token))

	_, resp = Client.AddTeamMemberFromInvite(token.Token, "")
	CheckBadRequestStatus(t, resp)
	th.App.DeleteToken(token)

	// invalid team id
	testId := GenerateTestId()
	token = model.NewToken(
		app.TokenTypeTeamInvitation,
		model.MapToJson(map[string]string{"teamId": testId}),
	)
	require.NoError(t, th.App.Srv().Store.Token().Save(token))

	_, resp = Client.AddTeamMemberFromInvite(token.Token, "")
	CheckNotFoundStatus(t, resp)
	th.App.DeleteToken(token)

	// by invite_id
	th.App.Srv().SetLicense(model.NewTestLicense(""))
	defer th.App.Srv().SetLicense(nil)
	_, resp = Client.Login(guest.Email, guest.Password)
	CheckNoError(t, resp)

	tm, resp = Client.AddTeamMemberFromInvite("", team.InviteId)
	CheckForbiddenStatus(t, resp)

	// by invite_id
	Client.Login(otherUser.Email, otherUser.Password)

	tm, resp = Client.AddTeamMemberFromInvite("", team.InviteId)
	CheckNoError(t, resp)

	require.NotNil(t, tm, "should have returned team member")

	require.Equal(t, tm.UserId, otherUser.Id, "user ids should have matched")

	require.Equal(t, tm.TeamId, team.Id, "team ids should have matched")

	tm, resp = Client.AddTeamMemberFromInvite("", "junk")
	CheckNotFoundStatus(t, resp)

	require.Nil(t, tm, "should have not returned team member")

	// Set a team to group-constrained
	team.GroupConstrained = model.NewBool(true)
	_, err = th.App.UpdateTeam(team)
	require.Nil(t, err)

	// Attempt to use a token on a group-constrained team
	token = model.NewToken(
		app.TokenTypeTeamInvitation,
		model.MapToJson(map[string]string{"teamId": team.Id}),
	)
	require.NoError(t, th.App.Srv().Store.Token().Save(token))
	tm, resp = Client.AddTeamMemberFromInvite(token.Token, "")
	require.Equal(t, "app.team.invite_token.group_constrained.error", resp.Error.Id)

	// Attempt to use an invite id
	tm, resp = Client.AddTeamMemberFromInvite("", team.InviteId)
	require.Equal(t, "app.team.invite_id.group_constrained.error", resp.Error.Id)

	// User is not in associated groups so shouldn't be allowed
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp = client.AddTeamMember(team.Id, otherUser.Id)
		CheckErrorMessage(t, resp, "api.team.add_members.user_denied")
	})

	// Associate group to team
	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    th.Group.Id,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
	})
	require.Nil(t, err)

	// Add user to group
	_, err = th.App.UpsertGroupMember(th.Group.Id, otherUser.Id)
	require.Nil(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp = client.AddTeamMember(team.Id, otherUser.Id)
		CheckNoError(t, resp)
	})
}

func TestAddTeamMemberMyself(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	th.LoginBasic()

	testCases := []struct {
		Name              string
		Public            bool
		PublicPermission  bool
		PrivatePermission bool
		ExpectedSuccess   bool
	}{
		{
			Name:              "Try to join an open team without the permissions",
			Public:            true,
			PublicPermission:  false,
			PrivatePermission: false,
			ExpectedSuccess:   false,
		},
		{
			Name:              "Try to join a private team without the permissions",
			Public:            false,
			PublicPermission:  false,
			PrivatePermission: false,
			ExpectedSuccess:   false,
		},
		{
			Name:              "Try to join an open team without public permission but with private permissions",
			Public:            true,
			PublicPermission:  false,
			PrivatePermission: true,
			ExpectedSuccess:   false,
		},
		{
			Name:              "Try to join a private team without private permission but with public permission",
			Public:            false,
			PublicPermission:  true,
			PrivatePermission: false,
			ExpectedSuccess:   false,
		},
		{
			Name:              "Join an open team with the permissions",
			Public:            true,
			PublicPermission:  true,
			PrivatePermission: false,
			ExpectedSuccess:   true,
		},
		{
			Name:              "Join a private team with the permissions",
			Public:            false,
			PublicPermission:  false,
			PrivatePermission: true,
			ExpectedSuccess:   true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			team := th.CreateTeam()
			team.AllowOpenInvite = tc.Public
			th.App.UpdateTeam(team)
			if tc.PublicPermission {
				th.AddPermissionToRole(model.PERMISSION_JOIN_PUBLIC_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
			} else {
				th.RemovePermissionFromRole(model.PERMISSION_JOIN_PUBLIC_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
			}
			if tc.PrivatePermission {
				th.AddPermissionToRole(model.PERMISSION_JOIN_PRIVATE_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
			} else {
				th.RemovePermissionFromRole(model.PERMISSION_JOIN_PRIVATE_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
			}
			_, resp := Client.AddTeamMember(team.Id, th.BasicUser.Id)
			if tc.ExpectedSuccess {
				CheckNoError(t, resp)
			} else {
				CheckForbiddenStatus(t, resp)
			}
		})
	}

}

func TestAddTeamMembersDomainConstrained(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.SystemAdminClient
	team := th.BasicTeam
	team.AllowedDomains = "domain1.com, domain2.com"
	_, response := client.UpdateTeam(team)
	require.Nil(t, response.Error)

	// create two users on allowed domains
	user1, response := client.CreateUser(&model.User{
		Email:    "user@domain1.com",
		Password: "Pa$$word11",
		Username: GenerateTestUsername(),
	})
	require.Nil(t, response.Error)
	user2, response := client.CreateUser(&model.User{
		Email:    "user@domain2.com",
		Password: "Pa$$word11",
		Username: GenerateTestUsername(),
	})
	require.Nil(t, response.Error)

	userList := []string{
		user1.Id,
		user2.Id,
	}

	// validate that they can be added
	tm, response := client.AddTeamMembers(team.Id, userList)
	require.Nil(t, response.Error)
	require.Len(t, tm, 2)

	// cleanup
	_, response = client.RemoveTeamMember(team.Id, user1.Id)
	require.Nil(t, response.Error)
	_, response = client.RemoveTeamMember(team.Id, user2.Id)
	require.Nil(t, response.Error)

	// disable one of the allowed domains
	team.AllowedDomains = "domain1.com"
	_, response = client.UpdateTeam(team)
	require.Nil(t, response.Error)

	// validate that they cannot be added
	_, response = client.AddTeamMembers(team.Id, userList)
	require.NotNil(t, response.Error)

	// validate that one user can be added gracefully
	members, response := client.AddTeamMembersGracefully(team.Id, userList)
	require.Nil(t, response.Error)
	require.Len(t, members, 2)
	require.NotNil(t, members[0].Member)
	require.NotNil(t, members[1].Error)
	require.Equal(t, members[0].UserId, user1.Id)
	require.Equal(t, members[1].UserId, user2.Id)
	require.Nil(t, members[0].Error)
	require.Nil(t, members[1].Member)
}

func TestAddTeamMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam
	otherUser := th.CreateUser()
	userList := []string{
		otherUser.Id,
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})
	bot := th.CreateBotWithSystemAdminClient()

	err := th.App.RemoveUserFromTeam(th.BasicTeam.Id, th.BasicUser2.Id, "")
	require.Nil(t, err)

	// Regular user can't add a member to a team they don't belong to.
	th.LoginBasic2()
	_, resp := Client.AddTeamMembers(team.Id, userList)
	CheckForbiddenStatus(t, resp)
	Client.Logout()

	// Regular user can add a member to a team they belong to.
	th.LoginBasic()
	tm, resp := Client.AddTeamMembers(team.Id, userList)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	// Check all the returned data.
	require.NotNil(t, tm[0], "should have returned team member")

	require.Equal(t, tm[0].UserId, otherUser.Id, "user ids should have matched")

	require.Equal(t, tm[0].TeamId, team.Id, "team ids should have matched")

	// Check with various invalid requests.
	_, resp = Client.AddTeamMembers("junk", userList)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.AddTeamMembers(GenerateTestId(), userList)
	CheckNotFoundStatus(t, resp)

	testUserList := append(userList, GenerateTestId())
	_, resp = Client.AddTeamMembers(team.Id, testUserList)
	CheckNotFoundStatus(t, resp)

	// Test with many users.
	for i := 0; i < 260; i++ {
		testUserList = append(testUserList, GenerateTestId())
	}
	_, resp = Client.AddTeamMembers(team.Id, testUserList)
	CheckBadRequestStatus(t, resp)

	Client.Logout()

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	// Set the config so that only team admins can add a user to a team.
	th.AddPermissionToRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_ADD_USER_TO_TEAM.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_USER_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_ADD_USER_TO_TEAM.Id, model.TEAM_USER_ROLE_ID)

	th.LoginBasic()

	// Check that a regular user can't add someone to the team.
	_, resp = Client.AddTeamMembers(team.Id, userList)
	CheckForbiddenStatus(t, resp)

	// Update user to team admin
	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.Srv().InvalidateAllCaches()
	th.LoginBasic()

	// Should work as a team admin.
	_, resp = Client.AddTeamMembers(team.Id, userList)
	CheckNoError(t, resp)

	// Change permission level to team user
	th.AddPermissionToRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_ADD_USER_TO_TEAM.Id, model.TEAM_USER_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_INVITE_USER.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_ADD_USER_TO_TEAM.Id, model.TEAM_ADMIN_ROLE_ID)

	th.UpdateUserToNonTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.Srv().InvalidateAllCaches()
	th.LoginBasic()

	// Should work as a regular user.
	_, resp = Client.AddTeamMembers(team.Id, userList)
	CheckNoError(t, resp)

	// Set a team to group-constrained
	team.GroupConstrained = model.NewBool(true)
	_, err = th.App.UpdateTeam(team)
	require.Nil(t, err)

	// User is not in associated groups so shouldn't be allowed
	_, resp = Client.AddTeamMembers(team.Id, userList)
	CheckErrorMessage(t, resp, "api.team.add_members.user_denied")

	// Ensure that a group synced team can still add bots
	_, resp = Client.AddTeamMembers(team.Id, []string{bot.UserId})
	CheckNoError(t, resp)

	// Associate group to team
	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    th.Group.Id,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
	})
	require.Nil(t, err)

	// Add user to group
	_, err = th.App.UpsertGroupMember(th.Group.Id, userList[0])
	require.Nil(t, err)

	_, resp = Client.AddTeamMembers(team.Id, userList)
	CheckNoError(t, resp)
}

func TestRemoveTeamMember(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})
	bot := th.CreateBotWithSystemAdminClient()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		pass, resp := client.RemoveTeamMember(th.BasicTeam.Id, th.BasicUser.Id)
		CheckNoError(t, resp)

		require.True(t, pass, "should have passed")

		_, resp = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, th.BasicUser.Id)
		CheckNoError(t, resp)
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.RemoveTeamMember(th.BasicTeam.Id, "junk")
		CheckBadRequestStatus(t, resp)

		_, resp = client.RemoveTeamMember("junk", th.BasicUser2.Id)
		CheckBadRequestStatus(t, resp)
	})

	_, resp := Client.RemoveTeamMember(th.BasicTeam.Id, th.BasicUser2.Id)
	CheckForbiddenStatus(t, resp)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		_, resp = client.RemoveTeamMember(model.NewId(), th.BasicUser.Id)
		CheckNotFoundStatus(t, resp)
	})

	_, resp = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, th.SystemAdminUser.Id)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, bot.UserId)
	CheckNoError(t, resp)

	// If the team is group-constrained the user cannot be removed
	th.BasicTeam.GroupConstrained = model.NewBool(true)
	_, err := th.App.UpdateTeam(th.BasicTeam)
	require.Nil(t, err)
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp = client.RemoveTeamMember(th.BasicTeam.Id, th.BasicUser.Id)
		require.Equal(t, "api.team.remove_member.group_constrained.app_error", resp.Error.Id)
	})

	// Can remove a bot even if team is group-constrained

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp = client.RemoveTeamMember(th.BasicTeam.Id, bot.UserId)
		CheckNoError(t, resp)
		_, resp = client.AddTeamMember(th.BasicTeam.Id, bot.UserId)
		CheckNoError(t, resp)
	})

	// Can remove self even if team is group-constrained
	_, resp = th.SystemAdminClient.RemoveTeamMember(th.BasicTeam.Id, th.SystemAdminUser.Id)
	CheckNoError(t, resp)
}

func TestGetTeamStats(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam

	rstats, resp := Client.GetTeamStats(team.Id, "")
	CheckNoError(t, resp)

	require.Equal(t, rstats.TeamId, team.Id, "wrong team id")

	require.Equal(t, rstats.TotalMemberCount, int64(3), "wrong count")

	require.Equal(t, rstats.ActiveMemberCount, int64(3), "wrong count")

	_, resp = Client.GetTeamStats("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamStats(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetTeamStats(team.Id, "")
	CheckNoError(t, resp)

	// deactivate BasicUser2
	th.UpdateActiveUser(th.BasicUser2, false)

	rstats, resp = th.SystemAdminClient.GetTeamStats(team.Id, "")
	CheckNoError(t, resp)

	require.Equal(t, rstats.TotalMemberCount, int64(3), "wrong count")

	require.Equal(t, rstats.ActiveMemberCount, int64(2), "wrong count")

	// login with different user and test if forbidden
	user := th.CreateUser()
	Client.Login(user.Email, user.Password)
	_, resp = Client.GetTeamStats(th.BasicTeam.Id, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetTeamStats(th.BasicTeam.Id, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdateTeamMemberRoles(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	SystemAdminClient := th.SystemAdminClient

	const TeamMember = "team_user"
	const TeamAdmin = "team_user team_admin"

	// user 1 tries to promote user 2
	ok, resp := Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamAdmin)
	CheckForbiddenStatus(t, resp)
	require.False(t, ok, "should have returned false")

	// user 1 tries to promote himself
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, TeamAdmin)
	CheckForbiddenStatus(t, resp)

	// user 1 tries to demote someone
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.SystemAdminUser.Id, TeamMember)
	CheckForbiddenStatus(t, resp)

	// system admin promotes user 1
	ok, resp = SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, TeamAdmin)
	CheckNoError(t, resp)
	require.True(t, ok, "should have returned true")

	// user 1 (team admin) promotes user 2
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamAdmin)
	CheckNoError(t, resp)

	// user 1 (team admin) demotes user 2 (team admin)
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamMember)
	CheckNoError(t, resp)

	// user 1 (team admin) tries to demote system admin (not member of a team)
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.SystemAdminUser.Id, TeamMember)
	CheckNotFoundStatus(t, resp)

	// user 1 (team admin) demotes system admin (member of a team)
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.SystemAdminUser.Id, TeamMember)
	CheckNoError(t, resp)
	// Note from API v3
	// Note to anyone who thinks this (above) test is wrong:
	// This operation will not affect the system admin's permissions because they have global access to all teams.
	// Their team level permissions are irrelevant. A team admin should be able to manage team level permissions.

	// System admins should be able to manipulate permission no matter what their team level permissions are.
	// system admin promotes user 2
	_, resp = SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamAdmin)
	CheckNoError(t, resp)

	// system admin demotes user 2 (team admin)
	_, resp = SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamMember)
	CheckNoError(t, resp)

	// user 1 (team admin) tries to promote himself to a random team
	_, resp = Client.UpdateTeamMemberRoles(model.NewId(), th.BasicUser.Id, TeamAdmin)
	CheckForbiddenStatus(t, resp)

	// user 1 (team admin) tries to promote a random user
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, model.NewId(), TeamAdmin)
	CheckNotFoundStatus(t, resp)

	// user 1 (team admin) tries to promote invalid team permission
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, "junk")
	CheckBadRequestStatus(t, resp)

	// user 1 (team admin) demotes himself
	_, resp = Client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, TeamMember)
	CheckNoError(t, resp)
}

func TestUpdateTeamMemberSchemeRoles(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	SystemAdminClient := th.SystemAdminClient
	th.LoginBasic()

	s1 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  false,
		SchemeGuest: false,
	}
	_, r1 := SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s1)
	CheckNoError(t, r1)

	tm1, rtm1 := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	CheckNoError(t, rtm1)
	assert.Equal(t, false, tm1.SchemeGuest)
	assert.Equal(t, false, tm1.SchemeUser)
	assert.Equal(t, false, tm1.SchemeAdmin)

	s2 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  true,
		SchemeGuest: false,
	}
	_, r2 := SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s2)
	CheckNoError(t, r2)

	tm2, rtm2 := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	CheckNoError(t, rtm2)
	assert.Equal(t, false, tm2.SchemeGuest)
	assert.Equal(t, true, tm2.SchemeUser)
	assert.Equal(t, false, tm2.SchemeAdmin)

	s3 := &model.SchemeRoles{
		SchemeAdmin: true,
		SchemeUser:  false,
		SchemeGuest: false,
	}
	_, r3 := SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s3)
	CheckNoError(t, r3)

	tm3, rtm3 := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	CheckNoError(t, rtm3)
	assert.Equal(t, false, tm3.SchemeGuest)
	assert.Equal(t, false, tm3.SchemeUser)
	assert.Equal(t, true, tm3.SchemeAdmin)

	s4 := &model.SchemeRoles{
		SchemeAdmin: true,
		SchemeUser:  true,
		SchemeGuest: false,
	}
	_, r4 := SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s4)
	CheckNoError(t, r4)

	tm4, rtm4 := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	CheckNoError(t, rtm4)
	assert.Equal(t, false, tm4.SchemeGuest)
	assert.Equal(t, true, tm4.SchemeUser)
	assert.Equal(t, true, tm4.SchemeAdmin)

	s5 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  false,
		SchemeGuest: true,
	}
	_, r5 := SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s5)
	CheckNoError(t, r5)

	tm5, rtm5 := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	CheckNoError(t, rtm5)
	assert.Equal(t, true, tm5.SchemeGuest)
	assert.Equal(t, false, tm5.SchemeUser)
	assert.Equal(t, false, tm5.SchemeAdmin)

	s6 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  true,
		SchemeGuest: true,
	}
	_, resp := SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s6)
	CheckBadRequestStatus(t, resp)

	_, resp = SystemAdminClient.UpdateTeamMemberSchemeRoles(model.NewId(), th.BasicUser.Id, s4)
	CheckNotFoundStatus(t, resp)

	_, resp = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, model.NewId(), s4)
	CheckNotFoundStatus(t, resp)

	_, resp = SystemAdminClient.UpdateTeamMemberSchemeRoles("ASDF", th.BasicUser.Id, s4)
	CheckBadRequestStatus(t, resp)

	_, resp = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, "ASDF", s4)
	CheckBadRequestStatus(t, resp)

	th.LoginBasic2()
	_, resp = th.Client.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s4)
	CheckForbiddenStatus(t, resp)

	SystemAdminClient.Logout()
	_, resp = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.SystemAdminUser.Id, s4)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetMyTeamsUnread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	user := th.BasicUser
	Client.Login(user.Email, user.Password)

	teams, resp := Client.GetTeamsUnreadForUser(user.Id, "")
	CheckNoError(t, resp)
	require.NotEqual(t, len(teams), 0, "should have results")

	teams, resp = Client.GetTeamsUnreadForUser(user.Id, th.BasicTeam.Id)
	CheckNoError(t, resp)
	require.Empty(t, teams, "should not have results")

	_, resp = Client.GetTeamsUnreadForUser("fail", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetTeamsUnreadForUser(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetTeamsUnreadForUser(user.Id, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestTeamExists(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	public_member_team := th.BasicTeam
	err := th.App.UpdateTeamPrivacy(public_member_team.Id, model.TEAM_OPEN, true)
	require.Nil(t, err)

	public_not_member_team := th.CreateTeamWithClient(th.SystemAdminClient)
	err = th.App.UpdateTeamPrivacy(public_not_member_team.Id, model.TEAM_OPEN, true)
	require.Nil(t, err)

	private_member_team := th.CreateTeamWithClient(th.SystemAdminClient)
	th.LinkUserToTeam(th.BasicUser, private_member_team)
	err = th.App.UpdateTeamPrivacy(private_member_team.Id, model.TEAM_INVITE, false)
	require.Nil(t, err)

	private_not_member_team := th.CreateTeamWithClient(th.SystemAdminClient)
	err = th.App.UpdateTeamPrivacy(private_not_member_team.Id, model.TEAM_INVITE, false)
	require.Nil(t, err)

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	th.AddPermissionToRole(model.PERMISSION_LIST_PUBLIC_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_LIST_PRIVATE_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)

	t.Run("Logged user with permissions and valid public team", func(t *testing.T) {
		th.LoginBasic()
		exists, resp := Client.TeamExists(public_not_member_team.Name, "")
		CheckNoError(t, resp)
		assert.True(t, exists, "team should exist")
	})

	t.Run("Logged user with permissions and valid private team", func(t *testing.T) {
		th.LoginBasic()
		exists, resp := Client.TeamExists(private_not_member_team.Name, "")
		CheckNoError(t, resp)
		assert.True(t, exists, "team should exist")
	})

	t.Run("Logged user and invalid team", func(t *testing.T) {
		th.LoginBasic()
		exists, resp := Client.TeamExists("testingteam", "")
		CheckNoError(t, resp)
		assert.False(t, exists, "team should not exist")
	})

	t.Run("Logged out user", func(t *testing.T) {
		Client.Logout()
		_, resp := Client.TeamExists(public_not_member_team.Name, "")
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("Logged without LIST_PUBLIC_TEAMS permissions and member public team", func(t *testing.T) {
		th.LoginBasic()
		th.RemovePermissionFromRole(model.PERMISSION_LIST_PUBLIC_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)

		exists, resp := Client.TeamExists(public_member_team.Name, "")
		CheckNoError(t, resp)
		assert.True(t, exists, "team should be visible")
	})

	t.Run("Logged without LIST_PUBLIC_TEAMS permissions and not member public team", func(t *testing.T) {
		th.LoginBasic()
		th.RemovePermissionFromRole(model.PERMISSION_LIST_PUBLIC_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)

		exists, resp := Client.TeamExists(public_not_member_team.Name, "")
		CheckNoError(t, resp)
		assert.False(t, exists, "team should not be visible")
	})

	t.Run("Logged without LIST_PRIVATE_TEAMS permissions and member private team", func(t *testing.T) {
		th.LoginBasic()
		th.RemovePermissionFromRole(model.PERMISSION_LIST_PRIVATE_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)

		exists, resp := Client.TeamExists(private_member_team.Name, "")
		CheckNoError(t, resp)
		assert.True(t, exists, "team should be visible")
	})

	t.Run("Logged without LIST_PRIVATE_TEAMS permissions and not member private team", func(t *testing.T) {
		th.LoginBasic()
		th.RemovePermissionFromRole(model.PERMISSION_LIST_PRIVATE_TEAMS.Id, model.SYSTEM_USER_ROLE_ID)

		exists, resp := Client.TeamExists(private_not_member_team.Name, "")
		CheckNoError(t, resp)
		assert.False(t, exists, "team should not be visible")
	})
}

func TestImportTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.TestForAllClients(t, func(T *testing.T, c *model.Client4) {
		data, err := testutils.ReadTestFile("Fake_Team_Import.zip")

		require.False(t, err != nil && len(data) == 0, "Error while reading the test file.")
		_, resp := th.SystemAdminClient.ImportTeam(data, binary.Size(data), "XYZ", "Fake_Team_Import.zip", th.BasicTeam.Id)
		CheckBadRequestStatus(t, resp)

		_, resp = th.SystemAdminClient.ImportTeam(data, binary.Size(data), "", "Fake_Team_Import.zip", th.BasicTeam.Id)
		CheckBadRequestStatus(t, resp)
	}, "Import from unknown and source")

	t.Run("ImportTeam", func(t *testing.T) {
		var data []byte
		var err error
		data, err = testutils.ReadTestFile("Fake_Team_Import.zip")

		require.False(t, err != nil && len(data) == 0, "Error while reading the test file.")

		// Import the channels/users/posts
		fileResp, resp := th.SystemAdminClient.ImportTeam(data, binary.Size(data), "slack", "Fake_Team_Import.zip", th.BasicTeam.Id)
		CheckNoError(t, resp)

		fileData, err := base64.StdEncoding.DecodeString(fileResp["results"])
		require.NoError(t, err, "failed to decode base64 results data")

		fileReturned := fmt.Sprintf("%s", fileData)
		require.Truef(t, strings.Contains(fileReturned, "darth.vader@stardeath.com"), "failed to report the user was imported, fileReturned: %s", fileReturned)

		// Checking the imported users
		importedUser, resp := th.SystemAdminClient.GetUserByUsername("bot_test", "")
		CheckNoError(t, resp)
		require.Equal(t, importedUser.Username, "bot_test", "username should match with the imported user")

		importedUser, resp = th.SystemAdminClient.GetUserByUsername("lordvader", "")
		CheckNoError(t, resp)
		require.Equal(t, importedUser.Username, "lordvader", "username should match with the imported user")

		// Checking the imported Channels
		importedChannel, resp := th.SystemAdminClient.GetChannelByName("testchannel", th.BasicTeam.Id, "")
		CheckNoError(t, resp)
		require.Equal(t, importedChannel.Name, "testchannel", "names did not match expected: testchannel")

		importedChannel, resp = th.SystemAdminClient.GetChannelByName("general", th.BasicTeam.Id, "")
		CheckNoError(t, resp)
		require.Equal(t, importedChannel.Name, "general", "names did not match expected: general")

		posts, resp := th.SystemAdminClient.GetPostsForChannel(importedChannel.Id, 0, 60, "", false)
		CheckNoError(t, resp)
		require.Equal(t, posts.Posts[posts.Order[3]].Message, "This is a test post to test the import process", "missing posts in the import process")
	})

	t.Run("Cloud Forbidden", func(t *testing.T) {
		var data []byte
		var err error
		data, err = testutils.ReadTestFile("Fake_Team_Import.zip")

		require.False(t, err != nil && len(data) == 0, "Error while reading the test file.")
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		// Import the channels/users/posts
		_, resp := th.SystemAdminClient.ImportTeam(data, binary.Size(data), "slack", "Fake_Team_Import.zip", th.BasicTeam.Id)
		CheckForbiddenStatus(t, resp)
		th.App.Srv().SetLicense(nil)
	})

	t.Run("MissingFile", func(t *testing.T) {
		_, resp := th.SystemAdminClient.ImportTeam(nil, 4343, "slack", "Fake_Team_Import.zip", th.BasicTeam.Id)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("WrongPermission", func(t *testing.T) {
		var data []byte
		var err error
		data, err = testutils.ReadTestFile("Fake_Team_Import.zip")
		require.False(t, err != nil && len(data) == 0, "Error while reading the test file.")

		// Import the channels/users/posts
		_, resp := th.Client.ImportTeam(data, binary.Size(data), "slack", "Fake_Team_Import.zip", th.BasicTeam.Id)
		CheckForbiddenStatus(t, resp)
	})
}

func TestInviteUsersToTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := th.GenerateTestEmail()
	user2 := th.GenerateTestEmail()

	emailList := []string{user1, user2}

	//Delete all the messages before check the sample email
	mail.DeleteMailBox(user1)
	mail.DeleteMailBox(user2)

	enableEmailInvitations := *th.App.Config().ServiceSettings.EnableEmailInvitations
	restrictCreationToDomains := th.App.Config().TeamSettings.RestrictCreationToDomains
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableEmailInvitations = &enableEmailInvitations })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.RestrictCreationToDomains = restrictCreationToDomains })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = false })
	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.InviteUsersToTeam(th.BasicTeam.Id, emailList)
		require.NotNil(t, resp.Error, "Should be disabled")
	})

	checkEmail := func(t *testing.T, expectedSubject string) {
		//Check if the email was sent to the right email address
		for _, email := range emailList {
			var resultsMailbox mail.JSONMessageHeaderInbucket
			err := mail.RetryInbucket(5, func() error {
				var err error
				resultsMailbox, err = mail.GetMailBox(email)
				return err
			})
			if err != nil {
				t.Log(err)
				t.Log("No email was received, maybe due load on the server. Disabling this verification")
			}
			if err == nil && len(resultsMailbox) > 0 {
				require.True(t, strings.ContainsAny(resultsMailbox[len(resultsMailbox)-1].To[0], email), "Wrong To recipient")
				resultsEmail, err := mail.GetMessageFromMailbox(email, resultsMailbox[len(resultsMailbox)-1].ID)
				if err == nil {
					require.Equalf(t, resultsEmail.Subject, expectedSubject, "Wrong Subject, actual: %s, expected: %s", resultsEmail.Subject, expectedSubject)
				}
			}
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })
	okMsg, resp := th.SystemAdminClient.InviteUsersToTeam(th.BasicTeam.Id, emailList)
	CheckNoError(t, resp)
	require.True(t, okMsg, "should return true")
	nameFormat := *th.App.Config().TeamSettings.TeammateNameDisplay
	expectedSubject := i18n.T("api.templates.invite_subject",
		map[string]interface{}{"SenderName": th.SystemAdminUser.GetDisplayName(nameFormat),
			"TeamDisplayName": th.BasicTeam.DisplayName,
			"SiteName":        th.App.ClientConfig()["SiteName"]})
	checkEmail(t, expectedSubject)

	mail.DeleteMailBox(user1)
	mail.DeleteMailBox(user2)
	okMsg, resp = th.LocalClient.InviteUsersToTeam(th.BasicTeam.Id, emailList)
	CheckNoError(t, resp)
	require.True(t, okMsg, "should return true")
	expectedSubject = i18n.T("api.templates.invite_subject",
		map[string]interface{}{"SenderName": "Administrator",
			"TeamDisplayName": th.BasicTeam.DisplayName,
			"SiteName":        th.App.ClientConfig()["SiteName"]})
	checkEmail(t, expectedSubject)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictCreationToDomains = "@global.com,@common.com" })

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		okMsg, resp := client.InviteUsersToTeam(th.BasicTeam.Id, emailList)
		require.False(t, okMsg, "should return false")
		require.NotNil(t, resp.Error, "Adding users with non-restricted domains was allowed")

		invitesWithErrors, resp := client.InviteUsersToTeamGracefully(th.BasicTeam.Id, emailList)
		CheckNoError(t, resp)
		require.Len(t, invitesWithErrors, 2)
		require.NotNil(t, invitesWithErrors[0].Error)
		require.NotNil(t, invitesWithErrors[1].Error)
	}, "restricted domains")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		th.BasicTeam.AllowedDomains = "invalid.com,common.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.NotNil(t, err, "Should not update the team")

		th.BasicTeam.AllowedDomains = "common.com"
		_, err = th.App.UpdateTeam(th.BasicTeam)
		require.Nilf(t, err, "%v, Should update the team", err)

		okMsg, resp := client.InviteUsersToTeam(th.BasicTeam.Id, []string{"test@global.com"})
		require.False(t, okMsg, "should return false")
		require.NotNilf(t, resp.Error, "%v, Per team restriction should take precedence over the globally allowed domains", err)

		okMsg, resp = client.InviteUsersToTeam(th.BasicTeam.Id, []string{"test@common.com"})
		require.True(t, okMsg, "should return true")
		require.Nilf(t, resp.Error, "%v, Failed to invite user which was common between team and global domain restriction", err)

		okMsg, resp = client.InviteUsersToTeam(th.BasicTeam.Id, []string{"test@invalid.com"})
		require.False(t, okMsg, "should return false")
		require.NotNilf(t, resp.Error, "%v, Should not invite user", err)

		invitesWithErrors, resp := client.InviteUsersToTeamGracefully(th.BasicTeam.Id, []string{"test@invalid.com", "test@common.com"})
		CheckNoError(t, resp)
		require.Len(t, invitesWithErrors, 2)
		require.NotNil(t, invitesWithErrors[0].Error)
		require.Nil(t, invitesWithErrors[1].Error)
	}, "override restricted domains")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		th.BasicTeam.AllowedDomains = "common.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nilf(t, err, "%v, Should update the team", err)

		emailList := make([]string, 22)
		for i := 0; i < 22; i++ {
			emailList[i] = "test-" + strconv.Itoa(i) + "@common.com"
		}
		okMsg, resp := client.InviteUsersToTeam(th.BasicTeam.Id, emailList)
		require.False(t, okMsg, "should return false")
		CheckRequestEntityTooLargeStatus(t, resp)
		CheckErrorMessage(t, resp, "app.email.rate_limit_exceeded.app_error")

		_, resp = client.InviteUsersToTeamGracefully(th.BasicTeam.Id, emailList)
		CheckRequestEntityTooLargeStatus(t, resp)
		CheckErrorMessage(t, resp, "app.email.rate_limit_exceeded.app_error")
	}, "rate limits")
}

func TestInviteGuestsToTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	guest1 := th.GenerateTestEmail()
	guest2 := th.GenerateTestEmail()

	emailList := []string{guest1, guest2}

	//Delete all the messages before check the sample email
	mail.DeleteMailBox(guest1)
	mail.DeleteMailBox(guest2)

	enableEmailInvitations := *th.App.Config().ServiceSettings.EnableEmailInvitations
	restrictCreationToDomains := th.App.Config().TeamSettings.RestrictCreationToDomains
	guestRestrictCreationToDomains := th.App.Config().GuestAccountsSettings.RestrictCreationToDomains
	enableGuestAccounts := *th.App.Config().GuestAccountsSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableEmailInvitations = &enableEmailInvitations })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.RestrictCreationToDomains = restrictCreationToDomains })
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.GuestAccountsSettings.RestrictCreationToDomains = guestRestrictCreationToDomains
		})
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GuestAccountsSettings.Enable = &enableGuestAccounts })
	}()

	th.App.Srv().SetLicense(model.NewTestLicense(""))

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = false })
	_, resp := th.SystemAdminClient.InviteGuestsToTeam(th.BasicTeam.Id, emailList, []string{th.BasicChannel.Id}, "test-message")
	assert.NotNil(t, resp.Error, "Should be disabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = false })
	_, resp = th.SystemAdminClient.InviteGuestsToTeam(th.BasicTeam.Id, emailList, []string{th.BasicChannel.Id}, "test-message")
	require.NotNil(t, resp.Error, "Should be disabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })

	th.App.Srv().SetLicense(nil)

	_, resp = th.SystemAdminClient.InviteGuestsToTeam(th.BasicTeam.Id, emailList, []string{th.BasicChannel.Id}, "test-message")
	require.NotNil(t, resp.Error, "Should be disabled")

	th.App.Srv().SetLicense(model.NewTestLicense(""))
	defer th.App.Srv().SetLicense(nil)

	okMsg, resp := th.SystemAdminClient.InviteGuestsToTeam(th.BasicTeam.Id, emailList, []string{th.BasicChannel.Id}, "test-message")
	CheckNoError(t, resp)
	require.True(t, okMsg, "should return true")

	t.Run("invalid data in request body", func(t *testing.T) {
		res, err := th.SystemAdminClient.DoApiPost(th.SystemAdminClient.GetTeamRoute(th.BasicTeam.Id)+"/invite-guests/email", "bad data")
		require.NotNil(t, err)
		require.Equal(t, "api.team.invite_guests_to_channels.invalid_body.app_error", err.Id)
		require.Equal(t, http.StatusBadRequest, res.StatusCode)
	})

	nameFormat := *th.App.Config().TeamSettings.TeammateNameDisplay
	expectedSubject := i18n.T("api.templates.invite_guest_subject",
		map[string]interface{}{"SenderName": th.SystemAdminUser.GetDisplayName(nameFormat),
			"TeamDisplayName": th.BasicTeam.DisplayName,
			"SiteName":        th.App.ClientConfig()["SiteName"]})

	//Check if the email was send to the right email address
	for _, email := range emailList {
		var resultsMailbox mail.JSONMessageHeaderInbucket
		err := mail.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = mail.GetMailBox(email)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			require.True(t, strings.ContainsAny(resultsMailbox[len(resultsMailbox)-1].To[0], email), "Wrong To recipient")
			resultsEmail, err := mail.GetMessageFromMailbox(email, resultsMailbox[len(resultsMailbox)-1].ID)
			if err == nil {
				require.Equalf(t, resultsEmail.Subject, expectedSubject, "Wrong Subject, actual: %s, expected: %s", resultsEmail.Subject, expectedSubject)
			}
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictCreationToDomains = "@global.com,@common.com" })

	t.Run("team domain restrictions should not affect inviting guests", func(t *testing.T) {
		err := th.App.InviteGuestsToChannels(th.BasicTeam.Id, &model.GuestsInvite{Emails: emailList, Channels: []string{th.BasicChannel.Id}, Message: "test message"}, th.BasicUser.Id)
		require.Nil(t, err, "guest user invites should not be affected by team restrictions")
	})

	t.Run("guest restrictions should affect guest users", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.RestrictCreationToDomains = "@guest.com" })

		err := th.App.InviteGuestsToChannels(th.BasicTeam.Id, &model.GuestsInvite{Emails: []string{"guest1@invalid.com"}, Channels: []string{th.BasicChannel.Id}, Message: "test message"}, th.BasicUser.Id)
		require.NotNil(t, err, "guest user invites should be affected by the guest domain restrictions")

		res, err := th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, &model.GuestsInvite{Emails: []string{"guest1@invalid.com", "guest1@guest.com"}, Channels: []string{th.BasicChannel.Id}, Message: "test message"}, th.BasicUser.Id)
		require.Nil(t, err)
		require.Len(t, res, 2)
		require.NotNil(t, res[0].Error)
		require.Nil(t, res[1].Error)

		err = th.App.InviteGuestsToChannels(th.BasicTeam.Id, &model.GuestsInvite{Emails: []string{"guest1@guest.com"}, Channels: []string{th.BasicChannel.Id}, Message: "test message"}, th.BasicUser.Id)
		require.Nil(t, err, "whitelisted guest user email should be allowed by the guest domain restrictions")
	})

	t.Run("guest restrictions should not affect inviting new team members", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.RestrictCreationToDomains = "@guest.com" })

		err := th.App.InviteNewUsersToTeam([]string{"user@global.com"}, th.BasicTeam.Id, th.BasicUser.Id)
		require.Nil(t, err, "non guest user invites should not be affected by the guest domain restrictions")
	})

	t.Run("rate limit", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.RestrictCreationToDomains = "@guest.com" })

		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nilf(t, err, "%v, Should update the team", err)

		emailList := make([]string, 22)
		for i := 0; i < 22; i++ {
			emailList[i] = "test-" + strconv.Itoa(i) + "@guest.com"
		}
		invite := &model.GuestsInvite{
			Emails:   emailList,
			Channels: []string{th.BasicChannel.Id},
			Message:  "test message",
		}
		err = th.App.InviteGuestsToChannels(th.BasicTeam.Id, invite, th.BasicUser.Id)
		require.NotNil(t, err)
		assert.Equal(t, "app.email.rate_limit_exceeded.app_error", err.Id)
		assert.Equal(t, http.StatusRequestEntityTooLarge, err.StatusCode)

		_, err = th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, invite, th.BasicUser.Id)
		require.NotNil(t, err)
		assert.Equal(t, "app.email.rate_limit_exceeded.app_error", err.Id)
		assert.Equal(t, http.StatusRequestEntityTooLarge, err.StatusCode)
	})
}

func TestGetTeamInviteInfo(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam

	team, resp := Client.GetTeamInviteInfo(team.InviteId)
	CheckNoError(t, resp)

	require.NotEmpty(t, team.DisplayName, "should not be empty")

	require.Empty(t, team.Email, "should be empty")

	team.InviteId = "12345678901234567890123456789012"
	team, resp = th.SystemAdminClient.UpdateTeam(team)
	CheckNoError(t, resp)

	_, resp = Client.GetTeamInviteInfo(team.InviteId)
	CheckNoError(t, resp)

	_, resp = Client.GetTeamInviteInfo("junk")
	CheckNotFoundStatus(t, resp)
}

func TestSetTeamIcon(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err, err)

	th.LoginTeamAdmin()

	ok, resp := Client.SetTeamIcon(team.Id, data)
	require.True(t, ok, resp.Error)

	CheckNoError(t, resp)

	ok, resp = Client.SetTeamIcon(model.NewId(), data)
	require.False(t, ok, "Should return false, set team icon not allowed")

	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	_, resp = Client.SetTeamIcon(team.Id, data)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	Client.Logout()

	_, resp = Client.SetTeamIcon(team.Id, data)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	teamBefore, appErr := th.App.GetTeam(team.Id)
	require.Nil(t, appErr)

	_, resp = th.SystemAdminClient.SetTeamIcon(team.Id, data)
	CheckNoError(t, resp)

	teamAfter, appErr := th.App.GetTeam(team.Id)
	require.Nil(t, appErr)
	assert.True(t, teamBefore.LastTeamIconUpdate < teamAfter.LastTeamIconUpdate, "LastTeamIconUpdate should have been updated for team")

	info := &model.FileInfo{Path: "teams/" + team.Id + "/teamIcon.png"}
	err = th.cleanupTestFile(info)
	require.NoError(t, err)
}

func TestGetTeamIcon(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam

	// should always fail because no initial image and no auto creation
	_, resp := Client.GetTeamIcon(team.Id, "")
	CheckNotFoundStatus(t, resp)

	Client.Logout()

	_, resp = Client.GetTeamIcon(team.Id, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestRemoveTeamIcon(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	team := th.BasicTeam

	th.LoginTeamAdmin()
	data, _ := testutils.ReadTestFile("test.png")
	Client.SetTeamIcon(team.Id, data)

	_, resp := Client.RemoveTeamIcon(team.Id)
	CheckNoError(t, resp)
	teamAfter, _ := th.App.GetTeam(team.Id)
	require.Equal(t, teamAfter.LastTeamIconUpdate, int64(0), "should update LastTeamIconUpdate to 0")

	Client.SetTeamIcon(team.Id, data)

	_, resp = th.SystemAdminClient.RemoveTeamIcon(team.Id)
	CheckNoError(t, resp)
	teamAfter, _ = th.App.GetTeam(team.Id)
	require.Equal(t, teamAfter.LastTeamIconUpdate, int64(0), "should update LastTeamIconUpdate to 0")

	Client.SetTeamIcon(team.Id, data)
	Client.Logout()

	_, resp = Client.RemoveTeamIcon(team.Id)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	_, resp = Client.RemoveTeamIcon(team.Id)
	CheckForbiddenStatus(t, resp)
}

func TestUpdateTeamScheme(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense(""))

	th.App.SetPhase2PermissionsMigrationStatus(true)

	team := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team, _ = th.SystemAdminClient.CreateTeam(team)

	teamScheme := &model.Scheme{
		DisplayName: "DisplayName",
		Name:        model.NewId(),
		Description: "Some description",
		Scope:       model.SCHEME_SCOPE_TEAM,
	}
	teamScheme, _ = th.SystemAdminClient.CreateScheme(teamScheme)
	channelScheme := &model.Scheme{
		DisplayName: "DisplayName",
		Name:        model.NewId(),
		Description: "Some description",
		Scope:       model.SCHEME_SCOPE_CHANNEL,
	}
	channelScheme, _ = th.SystemAdminClient.CreateScheme(channelScheme)

	// Test the setup/base case.
	_, resp := th.SystemAdminClient.UpdateTeamScheme(team.Id, teamScheme.Id)
	CheckNoError(t, resp)

	// Test the return to default scheme
	_, resp = th.SystemAdminClient.UpdateTeamScheme(team.Id, "")
	CheckNoError(t, resp)

	// Test various invalid team and scheme id combinations.
	_, resp = th.SystemAdminClient.UpdateTeamScheme(team.Id, "x")
	CheckBadRequestStatus(t, resp)
	_, resp = th.SystemAdminClient.UpdateTeamScheme("x", teamScheme.Id)
	CheckBadRequestStatus(t, resp)
	_, resp = th.SystemAdminClient.UpdateTeamScheme("x", "x")
	CheckBadRequestStatus(t, resp)

	// Test that permissions are required.
	_, resp = th.Client.UpdateTeamScheme(team.Id, teamScheme.Id)
	CheckForbiddenStatus(t, resp)

	// Test that a license is required.
	th.App.Srv().SetLicense(nil)
	_, resp = th.SystemAdminClient.UpdateTeamScheme(team.Id, teamScheme.Id)
	CheckNotImplementedStatus(t, resp)
	th.App.Srv().SetLicense(model.NewTestLicense(""))

	// Test an invalid scheme scope.
	_, resp = th.SystemAdminClient.UpdateTeamScheme(team.Id, channelScheme.Id)
	CheckBadRequestStatus(t, resp)

	// Test that an unauthenticated user gets rejected.
	th.SystemAdminClient.Logout()
	_, resp = th.SystemAdminClient.UpdateTeamScheme(team.Id, teamScheme.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestTeamMembersMinusGroupMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := th.BasicUser
	user2 := th.BasicUser2

	team := th.CreateTeam()
	team.GroupConstrained = model.NewBool(true)
	team, err := th.App.UpdateTeam(team)
	require.Nil(t, err)

	_, err = th.App.AddTeamMember(team.Id, user1.Id)
	require.Nil(t, err)
	_, err = th.App.AddTeamMember(team.Id, user2.Id)
	require.Nil(t, err)

	group1 := th.CreateGroup()
	group2 := th.CreateGroup()

	_, err = th.App.UpsertGroupMember(group1.Id, user1.Id)
	require.Nil(t, err)
	_, err = th.App.UpsertGroupMember(group2.Id, user2.Id)
	require.Nil(t, err)

	// No permissions
	_, _, res := th.Client.TeamMembersMinusGroupMembers(team.Id, []string{group1.Id, group2.Id}, 0, 100, "")
	require.Equal(t, "api.context.permissions.app_error", res.Error.Id)

	testCases := map[string]struct {
		groupIDs        []string
		page            int
		perPage         int
		length          int
		count           int
		otherAssertions func([]*model.UserWithGroups)
	}{
		"All groups, expect no users removed": {
			groupIDs: []string{group1.Id, group2.Id},
			page:     0,
			perPage:  100,
			length:   0,
			count:    0,
		},
		"Some nonexistent group, page 0": {
			groupIDs: []string{model.NewId()},
			page:     0,
			perPage:  1,
			length:   1,
			count:    2,
		},
		"Some nonexistent group, page 1": {
			groupIDs: []string{model.NewId()},
			page:     1,
			perPage:  1,
			length:   1,
			count:    2,
		},
		"One group, expect one user removed": {
			groupIDs: []string{group1.Id},
			page:     0,
			perPage:  100,
			length:   1,
			count:    1,
			otherAssertions: func(uwg []*model.UserWithGroups) {
				require.Equal(t, uwg[0].Id, user2.Id)
			},
		},
		"Other group, expect other user removed": {
			groupIDs: []string{group2.Id},
			page:     0,
			perPage:  100,
			length:   1,
			count:    1,
			otherAssertions: func(uwg []*model.UserWithGroups) {
				require.Equal(t, uwg[0].Id, user1.Id)
			},
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			uwg, count, res := th.SystemAdminClient.TeamMembersMinusGroupMembers(team.Id, tc.groupIDs, tc.page, tc.perPage, "")
			require.Nil(t, res.Error)
			require.Len(t, uwg, tc.length)
			require.Equal(t, tc.count, int(count))
			if tc.otherAssertions != nil {
				tc.otherAssertions(uwg)
			}
		})
	}
}

func TestInvalidateAllEmailInvites(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("Forbidden when request performed by system user", func(t *testing.T) {
		ok, res := th.Client.InvalidateEmailInvites()
		require.Equal(t, false, ok)
		CheckForbiddenStatus(t, res)
	})

	t.Run("OK when request performed by system user with requisite system permission", func(t *testing.T) {
		th.AddPermissionToRole(model.PERMISSION_INVALIDATE_EMAIL_INVITE.Id, model.SYSTEM_USER_ROLE_ID)
		defer th.RemovePermissionFromRole(model.PERMISSION_INVALIDATE_EMAIL_INVITE.Id, model.SYSTEM_USER_ROLE_ID)
		ok, res := th.Client.InvalidateEmailInvites()
		require.Equal(t, true, ok)
		CheckOKStatus(t, res)
	})

	t.Run("OK when request performed by system admin", func(t *testing.T) {
		ok, res := th.SystemAdminClient.InvalidateEmailInvites()
		require.Equal(t, true, ok)
		CheckOKStatus(t, res)
	})
}
