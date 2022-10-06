// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mail"
	"github.com/mattermost/mattermost-server/v6/utils/testutils"
)

func TestCreateTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TeamOpen}
		rteam, resp, err := client.CreateTeam(team)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		require.Equal(t, rteam.Name, team.Name, "names did not match")

		require.Equal(t, rteam.DisplayName, team.DisplayName, "display names did not match")

		require.Equal(t, rteam.Type, team.Type, "types did not match")

		_, resp, err = client.CreateTeam(rteam)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		rteam.Id = ""
		_, resp, err = client.CreateTeam(rteam)
		CheckErrorID(t, err, "app.team.save.existing.app_error")
		CheckBadRequestStatus(t, resp)

		rteam.Name = ""
		_, resp, err = client.CreateTeam(rteam)
		CheckErrorID(t, err, "model.team.is_valid.characters.app_error")
		CheckBadRequestStatus(t, resp)

		r, err := client.DoAPIPost("/teams", "garbage")
		require.Error(t, err, "should have errored")

		require.Equalf(t, r.StatusCode, http.StatusBadRequest, "wrong status code, actual: %s, expected: %s", strconv.Itoa(r.StatusCode), strconv.Itoa(http.StatusBadRequest))

		// Test GroupConstrained flag
		groupConstrainedTeam := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TeamOpen, GroupConstrained: model.NewBool(true)}
		rteam, resp, err = client.CreateTeam(groupConstrainedTeam)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		assert.Equal(t, *rteam.GroupConstrained, *groupConstrainedTeam.GroupConstrained, "GroupConstrained flags do not match")
	})

	t.Run("unauthenticated receives 403", func(t *testing.T) {
		th.Client.Logout()

		team := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TeamOpen}
		_, resp, err := th.Client.CreateTeam(team)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)

		th.LoginBasic()

		// Check the appropriate permissions are enforced.
		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		th.RemovePermissionFromRole(model.PermissionCreateTeam.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionCreateTeam.Id, model.SystemAdminRoleId)

		_, resp, err = th.Client.CreateTeam(team)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("cloud limit reached returns 400", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &mocks.CloudInterface{}
		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = cloud

		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(&model.ProductLimits{
			Teams: &model.TeamsLimits{
				Active: model.NewInt(1),
			},
		}, nil).Once()
		team := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TeamOpen}
		_, resp, err := th.Client.CreateTeam(team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("cloud below limit returns 200", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &mocks.CloudInterface{}
		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = cloud

		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(&model.ProductLimits{
			Teams: &model.TeamsLimits{
				Active: model.NewInt(200),
			},
		}, nil).Once()
		team := &model.Team{Name: GenerateTestUsername(), DisplayName: "Some Team", Type: model.TeamOpen}
		_, resp, err := th.Client.CreateTeam(team)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})
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
			Type:           model.TeamOpen,
			AllowedDomains: "simulator.amazonses.com,localhost",
		}

		rteam, _, err := th.Client.CreateTeam(team)
		require.NoError(t, err)
		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		team := &model.Team{
			DisplayName:    t.Name() + "_2",
			Name:           GenerateTestTeamName(),
			Email:          th.GenerateTestEmail(),
			Type:           model.TeamOpen,
			AllowedDomains: "simulator.amazonses.com,localhost",
		}

		rteam, _, err := client.CreateTeam(team)
		require.NoError(t, err)
		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	}, "system admin")
}

func TestGetTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	team := th.BasicTeam

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rteam, _, err := client.GetTeam(team.Id, "")
		require.NoError(t, err)

		require.Equal(t, rteam.Id, team.Id, "wrong team")

		_, resp, err := client.GetTeam("junk", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetTeam("", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		_, resp, err = client.GetTeam(model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	th.LoginTeamAdmin()

	team2 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen, AllowOpenInvite: false}
	rteam2, _, _ := client.CreateTeam(team2)

	team3 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamInvite, AllowOpenInvite: true}
	rteam3, _, _ := client.CreateTeam(team3)

	th.LoginBasic()
	// AllowInviteOpen is false and team is open, and user is not on team
	_, resp, err := client.GetTeam(rteam2.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// AllowInviteOpen is true and team is invite, and user is not on team
	_, resp, err = client.GetTeam(rteam3.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetTeam(team.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.GetTeam(rteam2.Id, "")
		require.NoError(t, err)
	})
}

func TestGetTeamSanitization(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TeamOpen,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	require.NoError(t, err)

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteam, _, err := client.GetTeam(team.Id, "")
		require.NoError(t, err)

		require.Empty(t, rteam.Email, "should have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	t.Run("team user without invite permissions", func(t *testing.T) {
		th.RemovePermissionFromRole(model.PermissionInviteUser.Id, model.TeamUserRoleId)
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteam, _, err := client.GetTeam(team.Id, "")
		require.NoError(t, err)

		require.Empty(t, rteam.Email, "should have sanitized email")
		require.Empty(t, rteam.InviteId, "should have sanitized inviteid")
	})

	t.Run("team admin", func(t *testing.T) {
		rteam, _, err := th.Client.GetTeam(team.Id, "")
		require.NoError(t, err)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rteam, _, err := client.GetTeam(team.Id, "")
		require.NoError(t, err)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	}, "system admin")
}

func TestGetTeamUnread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	teamUnread, _, err := client.GetTeamUnread(th.BasicTeam.Id, th.BasicUser.Id)
	require.NoError(t, err)
	require.Equal(t, teamUnread.TeamId, th.BasicTeam.Id, "wrong team id returned for regular user call")

	_, resp, err := client.GetTeamUnread("junk", th.BasicUser.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamUnread(th.BasicTeam.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamUnread(model.NewId(), th.BasicUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.GetTeamUnread(th.BasicTeam.Id, model.NewId())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetTeamUnread(th.BasicTeam.Id, th.BasicUser.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	teamUnread, _, err = th.SystemAdminClient.GetTeamUnread(th.BasicTeam.Id, th.BasicUser.Id)
	require.NoError(t, err)
	require.Equal(t, teamUnread.TeamId, th.BasicTeam.Id, "wrong team id returned")
}

func TestUpdateTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := &model.Team{DisplayName: "Name", Description: "Some description", AllowOpenInvite: false, InviteId: "inviteid0", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TeamOpen}
		team, _, err := th.Client.CreateTeam(team)
		require.NoError(t, err)

		team.Description = "updated description"
		uteam, _, err := client.UpdateTeam(team)
		require.NoError(t, err)

		require.Equal(t, uteam.Description, "updated description", "Update failed")

		team.DisplayName = "Updated Name"
		uteam, _, err = client.UpdateTeam(team)
		require.NoError(t, err)

		require.Equal(t, uteam.DisplayName, "Updated Name", "Update failed")

		// Test GroupConstrained flag
		team.GroupConstrained = model.NewBool(true)
		rteam, resp, err := client.UpdateTeam(team)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Equal(t, *rteam.GroupConstrained, *team.GroupConstrained, "GroupConstrained flags do not match")

		team.GroupConstrained = nil

		team.AllowOpenInvite = true
		uteam, _, err = client.UpdateTeam(team)
		require.NoError(t, err)

		require.True(t, uteam.AllowOpenInvite, "Update failed")

		team.InviteId = "inviteid1"
		uteam, _, err = client.UpdateTeam(team)
		require.NoError(t, err)

		require.NotEqual(t, uteam.InviteId, "inviteid1", "InviteID should not be updated")

		team.AllowedDomains = "domain"
		uteam, _, err = client.UpdateTeam(team)
		require.NoError(t, err)

		require.Equal(t, uteam.AllowedDomains, "domain", "Update failed")

		team.Name = "Updated name"
		uteam, _, err = client.UpdateTeam(team)
		require.NoError(t, err)

		require.NotEqual(t, uteam.Name, "Updated name", "Should not update name")

		team.Email = "test@domain.com"
		uteam, _, err = client.UpdateTeam(team)
		require.NoError(t, err)

		require.NotEqual(t, uteam.Email, "test@domain.com", "Should not update email")

		team.Type = model.TeamInvite
		uteam, _, err = client.UpdateTeam(team)
		require.NoError(t, err)

		require.NotEqual(t, uteam.Type, model.TeamInvite, "Should not update type")

		originalTeamId := team.Id
		team.Id = model.NewId()

		teamJSON, jsonErr := json.Marshal(team)
		require.NoError(t, jsonErr)
		r, err := th.Client.DoAPIPut("/teams/"+originalTeamId, string(teamJSON))
		assert.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, r.StatusCode)

		require.Equal(t, uteam.Id, originalTeamId, "wrong team id")

		team.Id = "fake"
		_, resp, err = client.UpdateTeam(team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		th.Client.Logout() // for non-local clients
		_, resp, err = th.Client.UpdateTeam(team)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		th.LoginBasic()
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		team := &model.Team{DisplayName: "New", Description: "Some description", AllowOpenInvite: false, InviteId: "inviteid0", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TeamOpen}
		team, _, err := client.CreateTeam(team)
		require.NoError(t, err)

		team.Name = "new-name"
		_, _, err = client.UpdateTeam(team)
		require.NoError(t, err)
	})
}

func TestUpdateTeamSanitization(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TeamOpen,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	require.NoError(t, err)

	// Non-admin users cannot update the team

	t.Run("team admin", func(t *testing.T) {
		rteam, _, err := th.Client.UpdateTeam(team)
		require.NoError(t, err)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email for admin")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	t.Run("system admin", func(t *testing.T) {
		rteam, _, err := th.SystemAdminClient.UpdateTeam(team)
		require.NoError(t, err)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email for admin")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})
}

func TestPatchTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := &model.Team{DisplayName: "Name", Description: "Some description", CompanyName: "Some company name", AllowOpenInvite: false, InviteId: "inviteid0", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TeamOpen}
	team, _, _ = th.Client.CreateTeam(team)

	patch := &model.TeamPatch{}
	patch.DisplayName = model.NewString("Other name")
	patch.Description = model.NewString("Other description")
	patch.CompanyName = model.NewString("Other company name")
	patch.AllowOpenInvite = model.NewBool(true)

	_, resp, err := th.Client.PatchTeam(GenerateTestId(), patch)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp, err = th.Client.PatchTeam(team.Id, patch)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic2()
	_, resp, err = th.Client.PatchTeam(team.Id, patch)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	th.LoginBasic()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rteam, _, err2 := client.PatchTeam(team.Id, patch)
		require.NoError(t, err2)

		require.Equal(t, rteam.DisplayName, "Other name", "DisplayName did not update properly")
		require.Equal(t, rteam.Description, "Other description", "Description did not update properly")
		require.Equal(t, rteam.CompanyName, "Other company name", "CompanyName did not update properly")
		require.NotEqual(t, rteam.InviteId, "inviteid1", "InviteId should not update")
		require.True(t, rteam.AllowOpenInvite, "AllowOpenInvite did not update properly")

		t.Run("Changing AllowOpenInvite to false regenerates InviteID", func(t *testing.T) {
			team2 := &model.Team{DisplayName: "Name2", Description: "Some description", CompanyName: "Some company name", AllowOpenInvite: true, InviteId: model.NewId(), Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TeamOpen}
			team2, _, _ = client.CreateTeam(team2)

			patch2 := &model.TeamPatch{
				AllowOpenInvite: model.NewBool(false),
			}

			rteam2, _, err3 := client.PatchTeam(team2.Id, patch2)
			require.NoError(t, err3)
			require.Equal(t, team2.Id, rteam2.Id)
			require.False(t, rteam2.AllowOpenInvite)
			require.NotEqual(t, team2.InviteId, rteam2.InviteId)
		})

		t.Run("Changing AllowOpenInvite to true doesn't regenerate InviteID", func(t *testing.T) {
			team2 := &model.Team{DisplayName: "Name3", Description: "Some description", CompanyName: "Some company name", AllowOpenInvite: false, InviteId: model.NewId(), Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TeamOpen}
			team2, _, _ = client.CreateTeam(team2)

			patch2 := &model.TeamPatch{
				AllowOpenInvite: model.NewBool(true),
			}

			rteam2, _, err3 := client.PatchTeam(team2.Id, patch2)
			require.NoError(t, err3)
			require.Equal(t, team2.Id, rteam2.Id)
			require.True(t, rteam2.AllowOpenInvite)
			require.Equal(t, team2.InviteId, rteam2.InviteId)
		})

		// Test GroupConstrained flag
		patch.GroupConstrained = model.NewBool(true)
		rteam, resp, err2 := client.PatchTeam(team.Id, patch)
		require.NoError(t, err2)
		CheckOKStatus(t, resp)
		require.Equal(t, *rteam.GroupConstrained, *patch.GroupConstrained, "GroupConstrained flags do not match")

		patch.GroupConstrained = nil
		_, resp, err = client.PatchTeam("junk", patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		r, err2 := client.DoAPIPut("/teams/"+team.Id+"/patch", "garbage")
		require.Error(t, err2, "should have errored")
		require.Equalf(t, r.StatusCode, http.StatusBadRequest, "wrong status code, actual: %s, expected: %s", strconv.Itoa(r.StatusCode), strconv.Itoa(http.StatusBadRequest))
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.PatchTeam(th.BasicTeam.Id, patch)
		require.NoError(t, err)
	})
}

func TestRestoreTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	createTeam := func(t *testing.T, deleted bool, teamType string) *model.Team {
		t.Helper()
		team := &model.Team{
			DisplayName:     "Some Team",
			Description:     "Some description",
			CompanyName:     "Some company name",
			AllowOpenInvite: (teamType == model.TeamOpen),
			InviteId:        model.NewId(),
			Name:            "aa-" + model.NewRandomTeamName() + "zz",
			Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
			Type:            teamType,
		}
		team, _, _ = client.CreateTeam(team)
		require.NotNil(t, team)
		if deleted {
			resp, err := th.SystemAdminClient.SoftDeleteTeam(team.Id)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		}
		return team
	}
	teamPublic := createTeam(t, true, model.TeamOpen)

	t.Run("invalid team", func(t *testing.T) {
		_, resp, err := client.RestoreTeam(model.NewId())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := createTeam(t, true, model.TeamOpen)
		team, resp, err := client.RestoreTeam(team.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Zero(t, team.DeleteAt)
		require.Equal(t, model.TeamOpen, team.Type)
	}, "restore archived public team")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := createTeam(t, true, model.TeamInvite)
		team, resp, err := client.RestoreTeam(team.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Zero(t, team.DeleteAt)
		require.Equal(t, model.TeamInvite, team.Type)
	}, "restore archived private team")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		team := createTeam(t, false, model.TeamOpen)
		team, resp, err := client.RestoreTeam(team.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Zero(t, team.DeleteAt)
		require.Equal(t, model.TeamOpen, team.Type)
	}, "restore active public team")

	t.Run("not logged in", func(t *testing.T) {
		client.Logout()
		_, resp, err := client.RestoreTeam(teamPublic.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("no permission to manage team", func(t *testing.T) {
		th.LoginBasic2()
		_, resp, err := client.RestoreTeam(teamPublic.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.RestoreTeam(teamPublic.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("cloud limit reached returns 400", func(t *testing.T) {
		// Create an archived team to be restored later
		team := createTeam(t, true, model.TeamOpen)
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &mocks.CloudInterface{}
		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = cloud

		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(&model.ProductLimits{
			Teams: &model.TeamsLimits{
				Active: model.NewInt(1),
			},
		}, nil).Once()

		_, resp, err := client.RestoreTeam(team.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("cloud below limit returns 200", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &mocks.CloudInterface{}
		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = cloud

		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(&model.ProductLimits{
			Teams: &model.TeamsLimits{
				Active: model.NewInt(200),
			},
		}, nil).Twice()
		team := createTeam(t, true, model.TeamOpen)
		_, resp, err := client.RestoreTeam(team.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestPatchTeamSanitization(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TeamOpen,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	require.NoError(t, err)

	// Non-admin users cannot update the team

	t.Run("team admin", func(t *testing.T) {
		rteam, _, err := th.Client.PatchTeam(team.Id, &model.TeamPatch{})
		require.NoError(t, err)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email for admin")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})

	t.Run("system admin", func(t *testing.T) {
		rteam, _, err := th.SystemAdminClient.PatchTeam(team.Id, &model.TeamPatch{})
		require.NoError(t, err)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email for admin")
		require.NotEmpty(t, rteam.InviteId, "should not have sanitized inviteid")
	})
}

func TestUpdateTeamPrivacy(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

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
		team, _, _ = client.CreateTeam(team)
		return team
	}

	teamPublic := createTeam(model.TeamOpen, true)
	teamPrivate := createTeam(model.TeamInvite, false)

	teamPublic2 := createTeam(model.TeamOpen, true)
	teamPrivate2 := createTeam(model.TeamInvite, false)

	tests := []struct {
		name                string
		team                *model.Team
		privacy             string
		errChecker          func(t testing.TB, resp *model.Response)
		wantType            string
		wantOpenInvite      bool
		wantInviteIdChanged bool
		originalInviteId    string
	}{
		{name: "bad privacy", team: teamPublic, privacy: "blap", errChecker: CheckBadRequestStatus, wantType: model.TeamOpen, wantOpenInvite: true},
		{name: "public to private", team: teamPublic, privacy: model.TeamInvite, errChecker: nil, wantType: model.TeamInvite, wantOpenInvite: false, originalInviteId: teamPublic.InviteId, wantInviteIdChanged: true},
		{name: "private to public", team: teamPrivate, privacy: model.TeamOpen, errChecker: nil, wantType: model.TeamOpen, wantOpenInvite: true, originalInviteId: teamPrivate.InviteId, wantInviteIdChanged: false},
		{name: "public to public", team: teamPublic2, privacy: model.TeamOpen, errChecker: nil, wantType: model.TeamOpen, wantOpenInvite: true, originalInviteId: teamPublic2.InviteId, wantInviteIdChanged: false},
		{name: "private to private", team: teamPrivate2, privacy: model.TeamInvite, errChecker: nil, wantType: model.TeamInvite, wantOpenInvite: false, originalInviteId: teamPrivate2.InviteId, wantInviteIdChanged: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
				team, resp, err := client.UpdateTeamPrivacy(test.team.Id, test.privacy)
				if test.errChecker != nil {
					test.errChecker(t, resp)
					return
				}
				require.NoError(t, err)
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
		_, resp, err := client.UpdateTeamPrivacy(model.NewId(), model.TeamInvite)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.UpdateTeamPrivacy(model.NewId(), model.TeamInvite)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "non-existent team for admins")

	t.Run("not logged in", func(t *testing.T) {
		client.Logout()
		_, resp, err := client.UpdateTeamPrivacy(teamPublic.Id, model.TeamInvite)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("no permission to manage team", func(t *testing.T) {
		th.LoginBasic2()
		_, resp, err := client.UpdateTeamPrivacy(teamPublic.Id, model.TeamInvite)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestTeamUnicodeNames(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	t.Run("create team unicode", func(t *testing.T) {
		team := &model.Team{
			Name:        GenerateTestUsername(),
			DisplayName: "Some\u206c Team",
			Description: "A \ufffatest\ufffb channel.",
			CompanyName: "\ufeffAcme Inc\ufffc",
			Type:        model.TeamOpen}
		rteam, resp, err := client.CreateTeam(team)
		require.NoError(t, err)
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
			Type:        model.TeamOpen}
		team, _, _ = client.CreateTeam(team)

		team.DisplayName = "\u206eThe Team\u206f"
		team.Description = "A \u17a3great\u17d3 team."
		team.CompanyName = "\u206aAcme Inc"
		uteam, _, err := client.UpdateTeam(team)
		require.NoError(t, err)

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
			Type:        model.TeamOpen}
		team, _, _ = client.CreateTeam(team)

		patch := &model.TeamPatch{}

		patch.DisplayName = model.NewString("Goat\u206e Team")
		patch.Description = model.NewString("\ufffaGreat team.")
		patch.CompanyName = model.NewString("\u202bAcme Inc\u202c")

		rteam, _, err := client.PatchTeam(team.Id, patch)
		require.NoError(t, err)

		require.Equal(t, "Goat Team", rteam.DisplayName, "bad unicode should be filtered from display name")
		require.Equal(t, "Great team.", rteam.Description, "bad unicode should be filtered from description")
		require.Equal(t, "Acme Inc", rteam.CompanyName, "bad unicode should be filtered from company name")
	})
}

func TestRegenerateTeamInviteId(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	team := &model.Team{DisplayName: "Name", Description: "Some description", CompanyName: "Some company name", AllowOpenInvite: false, InviteId: "inviteid0", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TeamOpen}
	team, _, _ = client.CreateTeam(team)

	assert.NotEqual(t, team.InviteId, "")
	assert.NotEqual(t, team.InviteId, "inviteid0")

	rteam, _, err := client.RegenerateTeamInviteId(team.Id)
	require.NoError(t, err)

	assert.NotEqual(t, team.InviteId, rteam.InviteId)
	assert.NotEqual(t, team.InviteId, "")
}

func TestSoftDeleteTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	resp, err := th.Client.SoftDeleteTeam(th.BasicTeam.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	resp, err = th.Client.SoftDeleteTeam(th.BasicTeam.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	team := &model.Team{DisplayName: "DisplayName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen}
	team, _, _ = th.Client.CreateTeam(team)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		_, err2 := client.SoftDeleteTeam(team.Id)
		require.NoError(t, err2)

		rteam, appErr := th.App.GetTeam(team.Id)
		require.Nil(t, appErr, "should have returned archived team")
		require.NotEqual(t, rteam.DeleteAt, 0, "should have not set to zero")

		resp, err2 = client.SoftDeleteTeam("junk")
		require.Error(t, err2)
		CheckBadRequestStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err = client.SoftDeleteTeam(th.BasicTeam.Id)
		require.NoError(t, err)
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
		team := &model.Team{DisplayName: "DisplayName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen}
		team, _, _ = th.Client.CreateTeam(team)

		resp, err := th.Client.PermanentDeleteTeam(team.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)

		resp, err = th.SystemAdminClient.PermanentDeleteTeam(team.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("Permanent deletion available through local mode even if EnableAPITeamDeletion is not set", func(t *testing.T) {
		team := &model.Team{DisplayName: "DisplayName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen}
		team, _, _ = th.Client.CreateTeam(team)

		_, err := th.LocalClient.PermanentDeleteTeam(team.Id)
		require.NoError(t, err)
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableAPITeamDeletion = &enableAPITeamDeletion })
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPITeamDeletion = true })

		team := &model.Team{DisplayName: "DisplayName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen}
		team, _, _ = client.CreateTeam(team)
		_, err := client.PermanentDeleteTeam(team.Id)
		require.NoError(t, err)

		_, appErr := th.App.GetTeam(team.Id)
		assert.NotNil(t, appErr)

		resp, err := client.PermanentDeleteTeam("junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "Permanent deletion with EnableAPITeamDeletion set")
}

func TestGetAllTeams(t *testing.T) {
	th := Setup(t).InitBasic()
	th.LoginSystemManager()
	defer th.TearDown()
	client := th.Client

	team1 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen, AllowOpenInvite: true}
	team1, _, err := client.CreateTeam(team1)
	require.NoError(t, err)

	team2 := &model.Team{DisplayName: "Name2", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen, AllowOpenInvite: true}
	team2, _, err = client.CreateTeam(team2)
	require.NoError(t, err)

	team3 := &model.Team{DisplayName: "Name3", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen, AllowOpenInvite: false}
	team3, _, err = client.CreateTeam(team3)
	require.NoError(t, err)

	team4 := &model.Team{DisplayName: "Name4", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen, AllowOpenInvite: false}
	team4, _, err = client.CreateTeam(team4)
	require.NoError(t, err)

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
			Permissions:   []string{model.PermissionListPublicTeams.Id},
			ExpectedTeams: []string{team1.Id},
		},
		{
			Name:          "Get second page with 1 team per page",
			Page:          1,
			PerPage:       1,
			Permissions:   []string{model.PermissionListPublicTeams.Id},
			ExpectedTeams: []string{team2.Id},
		},
		{
			Name:          "Get no items per page",
			Page:          1,
			PerPage:       0,
			Permissions:   []string{model.PermissionListPublicTeams.Id},
			ExpectedTeams: []string{},
		},
		{
			Name:          "Get all open teams",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PermissionListPublicTeams.Id},
			ExpectedTeams: []string{team1.Id, team2.Id},
		},
		{
			Name:          "Get all private teams",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PermissionListPrivateTeams.Id},
			ExpectedTeams: []string{th.BasicTeam.Id, team3.Id, team4.Id},
		},
		{
			Name:          "Get all teams",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PermissionListPublicTeams.Id, model.PermissionListPrivateTeams.Id},
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
			Permissions:   []string{model.PermissionListPublicTeams.Id, model.PermissionListPrivateTeams.Id},
			ExpectedTeams: []string{th.BasicTeam.Id, team1.Id, team2.Id, team3.Id, team4.Id},
			WithCount:     true,
			ExpectedCount: 5,
		},
		{
			Name:          "Get all public teams with count",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PermissionListPublicTeams.Id},
			ExpectedTeams: []string{team1.Id, team2.Id},
			WithCount:     true,
			ExpectedCount: 2,
		},
		{
			Name:          "Get all private teams with count",
			Page:          0,
			PerPage:       10,
			Permissions:   []string{model.PermissionListPrivateTeams.Id},
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
			th.RemovePermissionFromRole(model.PermissionListPublicTeams.Id, model.SystemUserRoleId)
			th.RemovePermissionFromRole(model.PermissionJoinPublicTeams.Id, model.SystemUserRoleId)
			th.RemovePermissionFromRole(model.PermissionListPrivateTeams.Id, model.SystemUserRoleId)
			th.RemovePermissionFromRole(model.PermissionJoinPrivateTeams.Id, model.SystemUserRoleId)
			for _, permission := range tc.Permissions {
				th.AddPermissionToRole(permission, model.SystemUserRoleId)
			}

			var teams []*model.Team
			var count int64
			var resp *model.Response
			var err2 error
			if tc.WithCount {
				teams, count, resp, err2 = client.GetAllTeamsWithTotalCount("", tc.Page, tc.PerPage)
			} else {
				teams, resp, err2 = client.GetAllTeams("", tc.Page, tc.PerPage)
			}
			if tc.ExpectedError {
				CheckErrorID(t, err2, tc.ErrorId)
				checkHTTPStatus(t, resp, tc.ExpectedStatusCode)
				return
			}
			require.NoError(t, err2)
			require.Equal(t, len(tc.ExpectedTeams), len(teams))
			for idx, team := range teams {
				assert.Equal(t, tc.ExpectedTeams[idx], team.Id)
			}
			require.Equal(t, tc.ExpectedCount, count)
		})
	}

	t.Run("Local mode", func(t *testing.T) {
		teams, _, err2 := th.LocalClient.GetAllTeams("", 0, 10)
		require.NoError(t, err2)
		require.Len(t, teams, 5)
	})

	// Choose a team which the system manager can access
	sysManagerTeams, resp, err := th.SystemManagerClient.GetAllTeams("", 0, 10000)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	policyTeam := sysManagerTeams[0]
	// If no policies exist, GetAllTeamsExcludePolicyConstrained should return everything
	t.Run("exclude policy constrained, without policy", func(t *testing.T) {
		_, excludeConstrainedResp, err2 := client.GetAllTeamsExcludePolicyConstrained("", 0, 100)
		require.Error(t, err2)
		CheckForbiddenStatus(t, excludeConstrainedResp)
		teams, excludeConstrainedResp, err2 := th.SystemAdminClient.GetAllTeamsExcludePolicyConstrained("", 0, 100)
		require.NoError(t, err2)
		CheckOKStatus(t, excludeConstrainedResp)
		found := false
		for _, team := range teams {
			if team.Id == policyTeam.Id {
				found = true
				break
			}
		}
		require.True(t, found)
	})
	// Now actually create the policy and assign the team to it
	policy, savePolicyErr := th.App.Srv().Store.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "Policy 1",
			PostDurationDays: model.NewInt64(30),
		},
		TeamIDs: []string{policyTeam.Id},
	})
	require.NoError(t, savePolicyErr)
	// This time, the team shouldn't be returned
	t.Run("exclude policy constrained, with policy", func(t *testing.T) {
		teams, excludeConstrainedResp, err2 := th.SystemAdminClient.GetAllTeamsExcludePolicyConstrained("", 0, 100)
		require.NoError(t, err2)
		CheckOKStatus(t, excludeConstrainedResp)
		found := false
		for _, team := range teams {
			if team.Id == policyTeam.Id {
				found = true
				break
			}
		}
		require.False(t, found)
	})

	t.Run("does not return policy ID", func(t *testing.T) {
		teams, sysManagerResp, err2 := th.SystemManagerClient.GetAllTeams("", 0, 100)
		require.NoError(t, err2)
		CheckOKStatus(t, sysManagerResp)
		found := false
		for _, team := range teams {
			if team.Id == policyTeam.Id {
				found = true
				require.Nil(t, team.PolicyID)
				break
			}
		}
		require.True(t, found)
	})

	t.Run("returns policy ID", func(t *testing.T) {
		teams, sysAdminResp, err2 := th.SystemAdminClient.GetAllTeams("", 0, 100)
		require.NoError(t, err2)
		CheckOKStatus(t, sysAdminResp)
		found := false
		for _, team := range teams {
			if team.Id == policyTeam.Id {
				found = true
				require.Equal(t, *team.PolicyID, policy.ID)
				break
			}
		}
		require.True(t, found)
	})

	t.Run("Unauthorized", func(t *testing.T) {
		client.Logout()
		_, resp, err = client.GetAllTeams("", 1, 10)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("Sanitize the teams in the response with total count", func(t *testing.T) {
		otherUser := th.CreateUser()
		client.Login(otherUser.Email, otherUser.Password)
		teams, _, _, err := client.GetAllTeamsWithTotalCount("", 0, 10)
		require.NoError(t, err)
		for _, team := range teams {
			if team.Email != "" {
				require.Nil(t, team.Email)
				break
			}
		}
	})
}

func TestGetAllTeamsSanitization(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:     t.Name() + "_1",
		Name:            GenerateTestTeamName(),
		Email:           th.GenerateTestEmail(),
		Type:            model.TeamOpen,
		AllowedDomains:  "simulator.amazonses.com,localhost",
		AllowOpenInvite: true,
	})
	require.NoError(t, err)
	team2, _, err := th.SystemAdminClient.CreateTeam(&model.Team{
		DisplayName:     t.Name() + "_2",
		Name:            GenerateTestTeamName(),
		Email:           th.GenerateTestEmail(),
		Type:            model.TeamOpen,
		AllowedDomains:  "simulator.amazonses.com,localhost",
		AllowOpenInvite: true,
	})
	require.NoError(t, err)

	// This may not work if the server has over 1000 open teams on it

	t.Run("team admin/non-admin", func(t *testing.T) {
		teamFound := false
		team2Found := false

		rteams, _, err := th.Client.GetAllTeams("", 0, 1000)
		require.NoError(t, err)
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
		rteams, _, err := client.GetAllTeams("", 0, 1000)
		require.NoError(t, err)
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
		rteam, _, err := client.GetTeamByName(team.Name, "")
		require.NoError(t, err)

		require.Equal(t, rteam.Name, team.Name, "wrong team")

		_, resp, err := client.GetTeamByName("junk", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		_, resp, err = client.GetTeamByName("", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err := client.GetTeamByName(strings.ToUpper(team.Name), "")
		require.NoError(t, err)
	})

	th.Client.Logout()
	_, resp, err := th.Client.GetTeamByName(team.Name, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetTeamByName(team.Name, "")
	require.NoError(t, err)

	th.LoginTeamAdmin()

	team2 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen, AllowOpenInvite: false}
	rteam2, _, _ := th.Client.CreateTeam(team2)

	team3 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamInvite, AllowOpenInvite: true}
	rteam3, _, _ := th.Client.CreateTeam(team3)

	th.LoginBasic()
	// AllowInviteOpen is false and team is open, and user is not on team
	_, resp, err = th.Client.GetTeamByName(rteam2.Name, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// AllowInviteOpen is true and team is invite only, and user is not on team
	_, resp, err = th.Client.GetTeamByName(rteam3.Name, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetTeamByNameSanitization(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TeamOpen,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	require.NoError(t, err)

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteam, _, err := client.GetTeamByName(team.Name, "")
		require.NoError(t, err)

		require.Empty(t, rteam.Email, "should've sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
	})

	t.Run("team user without invite permissions", func(t *testing.T) {
		th.RemovePermissionFromRole(model.PermissionInviteUser.Id, model.TeamUserRoleId)
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()

		th.LoginBasic2WithClient(client)

		rteam, _, err := client.GetTeam(team.Id, "")
		require.NoError(t, err)

		require.Empty(t, rteam.Email, "should have sanitized email")
		require.Empty(t, rteam.InviteId, "should have sanitized inviteid")
	})

	t.Run("team admin/non-admin", func(t *testing.T) {
		rteam, _, err := th.Client.GetTeamByName(team.Name, "")
		require.NoError(t, err)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
	})

	t.Run("system admin", func(t *testing.T) {
		rteam, _, err := th.SystemAdminClient.GetTeamByName(team.Name, "")
		require.NoError(t, err)

		require.NotEmpty(t, rteam.Email, "should not have sanitized email")
		require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
	})
}

func TestSearchAllTeams(t *testing.T) {
	th := Setup(t).InitBasic()
	th.LoginSystemManager()
	defer th.TearDown()

	oTeam := th.BasicTeam
	oTeam.AllowOpenInvite = true

	updatedTeam, appErr := th.App.UpdateTeam(oTeam)
	require.Nil(t, appErr)
	oTeam.UpdateAt = updatedTeam.UpdateAt

	pTeam := &model.Team{DisplayName: "PName", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamInvite}
	th.Client.CreateTeam(pTeam)

	rteams, _, err := th.Client.SearchTeams(&model.TeamSearch{Term: pTeam.Name})
	require.NoError(t, err)
	require.Empty(t, rteams, "should have not returned team")

	rteams, _, err = th.Client.SearchTeams(&model.TeamSearch{Term: pTeam.DisplayName})
	require.NoError(t, err)
	require.Empty(t, rteams, "should have not returned team")

	th.Client.Logout()

	_, resp, err := th.Client.SearchTeams(&model.TeamSearch{Term: pTeam.Name})
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, resp, err = th.Client.SearchTeams(&model.TeamSearch{Term: pTeam.DisplayName})
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		rteams, _, err2 := client.SearchTeams(&model.TeamSearch{Term: oTeam.Name})
		require.NoError(t, err2)
		require.Len(t, rteams, 1, "should have returned 1 team")
		require.Equal(t, oTeam.Id, rteams[0].Id, "invalid team")

		rteams, _, err2 = client.SearchTeams(&model.TeamSearch{Term: oTeam.DisplayName})
		require.NoError(t, err2)
		require.Len(t, rteams, 1, "should have returned 1 team")
		require.Equal(t, oTeam.Id, rteams[0].Id, "invalid team")

		rteams, _, err2 = client.SearchTeams(&model.TeamSearch{Term: "junk"})
		require.NoError(t, err2)
		require.Empty(t, rteams, "should have not returned team")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rteams, _, err2 := client.SearchTeams(&model.TeamSearch{Term: oTeam.Name})
		require.NoError(t, err2)
		require.Len(t, rteams, 1, "should have returned 1 team")

		rteams, _, err2 = client.SearchTeams(&model.TeamSearch{Term: pTeam.DisplayName})
		require.NoError(t, err2)
		require.Len(t, rteams, 1, "should have returned 1 team")
	})

	// Choose a team which the system manager can access
	sysManagerTeams, resp, err := th.SystemManagerClient.GetAllTeams("", 0, 10000)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	policyTeam := sysManagerTeams[0]
	// Now actually create the policy and assign the team to it
	policy, savePolicyErr := th.App.Srv().Store.RetentionPolicy().Save(&model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      "Policy 1",
			PostDurationDays: model.NewInt64(30),
		},
		TeamIDs: []string{policyTeam.Id},
	})
	require.NoError(t, savePolicyErr)
	t.Run("does not return policy ID", func(t *testing.T) {
		teams, sysManagerResp, err := th.SystemManagerClient.SearchTeams(&model.TeamSearch{Term: policyTeam.Name})
		require.NoError(t, err)
		CheckOKStatus(t, sysManagerResp)
		found := false
		for _, team := range teams {
			if team.Id == policyTeam.Id {
				found = true
				require.Nil(t, team.PolicyID)
				break
			}
		}
		require.True(t, found)
	})
	t.Run("returns policy ID", func(t *testing.T) {
		teams, sysAdminResp, err := th.SystemAdminClient.SearchTeams(&model.TeamSearch{Term: policyTeam.Name})
		require.NoError(t, err)
		CheckOKStatus(t, sysAdminResp)
		found := false
		for _, team := range teams {
			if team.Id == policyTeam.Id {
				found = true
				require.Equal(t, *team.PolicyID, policy.ID)
				break
			}
		}
		require.True(t, found)
	})
}

func TestSearchAllTeamsPaged(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	commonRandom := model.NewId()
	teams := [3]*model.Team{}

	for i := 0; i < 3; i++ {
		uid := model.NewId()
		newTeam, err := th.App.CreateTeam(th.Context, &model.Team{
			DisplayName: fmt.Sprintf("%s %d %s", commonRandom, i, uid),
			Name:        fmt.Sprintf("%s-%d-%s", commonRandom, i, uid),
			Type:        model.TeamOpen,
			Email:       th.GenerateTestEmail(),
		})
		require.Nil(t, err)
		teams[i] = newTeam
	}

	foobarTeam, appErr := th.App.CreateTeam(th.Context, &model.Team{
		DisplayName: "FOOBARDISPLAYNAME",
		Name:        "whatever",
		Type:        model.TeamOpen,
		Email:       th.GenerateTestEmail(),
	})
	require.Nil(t, appErr)

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
			teams, count, _, err := th.SystemAdminClient.SearchTeamsPaged(tc.Search)
			require.NoError(t, err)
			require.Equal(t, tc.ExpectedTotalCount, count)
			require.Equal(t, len(tc.ExpectedTeams), len(teams))
			for i, team := range teams {
				require.Equal(t, tc.ExpectedTeams[i], team.Id)
			}
		})
	}

	_, _, resp, err := th.Client.SearchTeamsPaged(&model.TeamSearch{Term: commonRandom, PerPage: model.NewInt(100)})
	CheckErrorID(t, err, "api.team.search_teams.pagination_not_implemented.public_team_search")
	require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
}

func TestSearchAllTeamsSanitization(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TeamOpen,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	require.NoError(t, err)
	team2, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_2",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TeamOpen,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	require.NoError(t, err)

	t.Run("non-team user", func(t *testing.T) {
		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteams, _, err := client.SearchTeams(&model.TeamSearch{Term: t.Name()})
		require.NoError(t, err)
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

		rteams, _, err := client.SearchTeams(&model.TeamSearch{Term: t.Name()})
		require.NoError(t, err)
		for _, rteam := range rteams {
			require.Empty(t, rteam.Email, "should've sanitized email")
			require.Empty(t, rteam.AllowedDomains, "should've sanitized allowed domains")
			require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
		}
	})

	t.Run("team admin", func(t *testing.T) {
		rteams, _, err := th.Client.SearchTeams(&model.TeamSearch{Term: t.Name()})
		require.NoError(t, err)
		for _, rteam := range rteams {
			if rteam.Id == team.Id || rteam.Id == team2.Id || rteam.Id == th.BasicTeam.Id {
				require.NotEmpty(t, rteam.Email, "should not have sanitized email")
				require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
			}
		}
	})

	t.Run("system admin", func(t *testing.T) {
		rteams, _, err := th.SystemAdminClient.SearchTeams(&model.TeamSearch{Term: t.Name()})
		require.NoError(t, err)
		for _, rteam := range rteams {
			require.NotEmpty(t, rteam.Email, "should not have sanitized email")
			require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
		}
	})
}

func TestGetTeamsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	team2 := &model.Team{DisplayName: "Name", Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamInvite}
	rteam2, _, _ := client.CreateTeam(team2)

	teams, _, err := client.GetTeamsForUser(th.BasicUser.Id, "")
	require.NoError(t, err)

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

	_, resp, err := client.GetTeamsForUser("junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamsForUser(model.NewId(), "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.GetTeamsForUser(th.BasicUser2.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetTeamsForUser(th.BasicUser2.Id, "")
	require.NoError(t, err)
}

func TestGetTeamsForUserSanitization(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TeamOpen,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	require.NoError(t, err)
	team2, _, err := th.Client.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_2",
		Name:           GenerateTestTeamName(),
		Email:          th.GenerateTestEmail(),
		Type:           model.TeamOpen,
		AllowedDomains: "simulator.amazonses.com,localhost",
	})
	require.NoError(t, err)

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)
		th.LinkUserToTeam(th.BasicUser2, team2)

		client := th.CreateClient()
		th.LoginBasic2WithClient(client)

		rteams, _, err := client.GetTeamsForUser(th.BasicUser2.Id, "")
		require.NoError(t, err)
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
		th.RemovePermissionFromRole(model.PermissionInviteUser.Id, model.TeamUserRoleId)
		th.LoginBasic2WithClient(client)

		rteams, _, err := client.GetTeamsForUser(th.BasicUser2.Id, "")
		require.NoError(t, err)
		for _, rteam := range rteams {
			if rteam.Id != team.Id && rteam.Id != team2.Id {
				continue
			}

			require.Empty(t, rteam.Email, "should have sanitized email")
			require.Empty(t, rteam.InviteId, "should have sanitized inviteid")
		}
	})

	t.Run("team admin", func(t *testing.T) {
		rteams, _, err := th.Client.GetTeamsForUser(th.BasicUser.Id, "")
		require.NoError(t, err)
		for _, rteam := range rteams {
			if rteam.Id != team.Id && rteam.Id != team2.Id {
				continue
			}

			require.NotEmpty(t, rteam.Email, "should not have sanitized email")
			require.NotEmpty(t, rteam.InviteId, "should have not sanitized inviteid")
		}
	})

	t.Run("system admin", func(t *testing.T) {
		rteams, _, err := th.SystemAdminClient.GetTeamsForUser(th.BasicUser.Id, "")
		require.NoError(t, err)
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
	client := th.Client
	team := th.BasicTeam
	user := th.BasicUser

	rmember, _, err := client.GetTeamMember(team.Id, user.Id, "")
	require.NoError(t, err)

	require.Equal(t, rmember.TeamId, team.Id, "wrong team id")

	require.Equal(t, rmember.UserId, user.Id, "wrong user id")

	_, resp, err := client.GetTeamMember("junk", user.Id, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamMember(team.Id, "junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamMember("junk", "junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamMember(team.Id, model.NewId(), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetTeamMember(model.NewId(), user.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetTeamMember(team.Id, user.Id, "")
	require.NoError(t, err)
}

func TestGetTeamMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	team := th.BasicTeam
	userNotMember := th.CreateUser()

	rmembers, _, err := client.GetTeamMembers(team.Id, 0, 100, "")
	require.NoError(t, err)

	t.Logf("rmembers count %v\n", len(rmembers))

	require.NotEqual(t, len(rmembers), 0, "should have results")

	for _, rmember := range rmembers {
		require.Equal(t, rmember.TeamId, team.Id, "user should be a member of team")
		require.NotEqual(t, rmember.UserId, userNotMember.Id, "user should be a member of team")
	}

	rmembers, _, err = client.GetTeamMembers(team.Id, 0, 1, "")
	require.NoError(t, err)
	require.Len(t, rmembers, 1, "should be 1 per page")

	rmembers, _, err = client.GetTeamMembers(team.Id, 1, 1, "")
	require.NoError(t, err)
	require.Len(t, rmembers, 1, "should be 1 per page")

	rmembers, _, err = client.GetTeamMembers(team.Id, 10000, 100, "")
	require.NoError(t, err)
	require.Empty(t, rmembers, "should be no member")

	rmembers, _, err = client.GetTeamMembers(team.Id, 0, 2, "")
	require.NoError(t, err)
	rmembers2, _, err := client.GetTeamMembers(team.Id, 1, 2, "")
	require.NoError(t, err)

	for _, tm1 := range rmembers {
		for _, tm2 := range rmembers2 {
			assert.NotEqual(t, tm1.UserId+tm1.TeamId, tm2.UserId+tm2.TeamId, "different pages should not have the same members")
		}
	}

	_, resp, err := client.GetTeamMembers("junk", 0, 100, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamMembers(model.NewId(), 0, 100, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetTeamMembers(team.Id, 0, 1, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, "", false, "")
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, model.USERNAME, false, "")
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, model.USERNAME, true, "")
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, "", true, "")
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetTeamMembersSortAndWithoutDeletedUsers(team.Id, 0, 100, model.USERNAME, false, "")
	require.NoError(t, err)
}

func TestGetTeamMembersForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	members, _, err := client.GetTeamMembersForUser(th.BasicUser.Id, "")
	require.NoError(t, err)

	found := false
	for _, m := range members {
		if m.TeamId == th.BasicTeam.Id {
			found = true
		}
	}

	require.True(t, found, "missing team member")

	_, resp, err := client.GetTeamMembersForUser("junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamMembersForUser(model.NewId(), "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetTeamMembersForUser(th.BasicUser.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	user := th.CreateUser()
	client.Login(user.Email, user.Password)
	_, resp, err = client.GetTeamMembersForUser(th.BasicUser.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetTeamMembersForUser(th.BasicUser.Id, "")
	require.NoError(t, err)
}

func TestGetTeamMembersByIds(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	tm, _, err := client.GetTeamMembersByIds(th.BasicTeam.Id, []string{th.BasicUser.Id})
	require.NoError(t, err)

	require.Equal(t, tm[0].UserId, th.BasicUser.Id, "returned wrong user")

	_, resp, err := client.GetTeamMembersByIds(th.BasicTeam.Id, []string{})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	tm1, _, err := client.GetTeamMembersByIds(th.BasicTeam.Id, []string{"junk"})
	require.NoError(t, err)
	require.False(t, len(tm1) > 0, "no users should be returned")

	tm1, _, err = client.GetTeamMembersByIds(th.BasicTeam.Id, []string{"junk", th.BasicUser.Id})
	require.NoError(t, err)
	require.Len(t, tm1, 1, "1 user should be returned")

	_, resp, err = client.GetTeamMembersByIds("junk", []string{th.BasicUser.Id})
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamMembersByIds(model.NewId(), []string{th.BasicUser.Id})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetTeamMembersByIds(th.BasicTeam.Id, []string{th.BasicUser.Id})
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestAddTeamMember(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
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
	_, err := th.SystemAdminClient.DemoteUserToGuest(guest.Id)
	require.NoError(t, err)

	appErr := th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, "")
	require.Nil(t, appErr)

	// Regular user can't add a member to a team they don't belong to.
	th.LoginBasic2()
	_, resp, err := client.AddTeamMember(team.Id, otherUser.Id)
	CheckForbiddenStatus(t, resp)
	require.Error(t, err, "Error is nil")
	client.Logout()

	// SystemAdmin and mode can add member to a team
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		var tm *model.TeamMember
		tm, resp, err = client.AddTeamMember(team.Id, otherUser.Id)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, tm.UserId, otherUser.Id, "user ids should have matched")
		require.Equal(t, tm.TeamId, team.Id, "team ids should have matched")
	})

	// Regular user can add a member to a team they belong to.
	th.LoginBasic()
	tm, resp, err := client.AddTeamMember(team.Id, otherUser.Id)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// Check all the returned data.
	require.NotNil(t, tm, "should have returned team member")

	require.Equal(t, tm.UserId, otherUser.Id, "user ids should have matched")

	require.Equal(t, tm.TeamId, team.Id, "team ids should have matched")

	// Check with various invalid requests.
	tm, resp, err = client.AddTeamMember(team.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	require.Nil(t, tm, "should have not returned team member")

	_, resp, err = client.AddTeamMember("junk", otherUser.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.AddTeamMember(GenerateTestId(), otherUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.AddTeamMember(team.Id, GenerateTestId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	client.Logout()

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	// Set the config so that only team admins can add a user to a team.
	th.AddPermissionToRole(model.PermissionInviteUser.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionAddUserToTeam.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionInviteUser.Id, model.TeamUserRoleId)
	th.RemovePermissionFromRole(model.PermissionAddUserToTeam.Id, model.TeamUserRoleId)

	th.LoginBasic()

	// Check that a regular user can't add someone to the team.
	_, resp, err = client.AddTeamMember(team.Id, otherUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Update user to team admin
	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.Srv().InvalidateAllCaches()
	th.LoginBasic()

	// Should work as a team admin.
	_, _, err = client.AddTeamMember(team.Id, otherUser.Id)
	require.NoError(t, err)

	// Change permission level to team user
	th.AddPermissionToRole(model.PermissionInviteUser.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(model.PermissionAddUserToTeam.Id, model.TeamUserRoleId)
	th.RemovePermissionFromRole(model.PermissionInviteUser.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionAddUserToTeam.Id, model.TeamAdminRoleId)

	th.UpdateUserToNonTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.Srv().InvalidateAllCaches()
	th.LoginBasic()

	// Should work as a regular user.
	_, _, err = client.AddTeamMember(team.Id, otherUser.Id)
	require.NoError(t, err)

	// Should return error with invalid JSON in body.
	_, err = client.DoAPIPost("/teams/"+team.Id+"/members", "invalid")
	require.Error(t, err)
	CheckErrorID(t, err, "api.team.add_team_member.invalid_body.app_error")

	// by token
	client.Login(otherUser.Email, otherUser.Password)

	token := model.NewToken(
		app.TokenTypeTeamInvitation,
		model.MapToJSON(map[string]string{"teamId": team.Id}),
	)
	require.NoError(t, th.App.Srv().Store.Token().Save(token))

	tm, _, err = client.AddTeamMemberFromInvite(token.Token, "")
	require.NoError(t, err)

	require.NotNil(t, tm, "should have returned team member")

	require.Equal(t, tm.UserId, otherUser.Id, "user ids should have matched")

	require.Equal(t, tm.TeamId, team.Id, "team ids should have matched")

	_, err = th.App.Srv().Store.Token().GetByToken(token.Token)
	require.Error(t, err, "The token must be deleted after be used")

	tm, resp, err = client.AddTeamMemberFromInvite("junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	require.Nil(t, tm, "should have not returned team member")

	// expired token of more than 50 hours
	token = model.NewToken(app.TokenTypeTeamInvitation, "")
	token.CreateAt = model.GetMillis() - 1000*60*60*50
	require.NoError(t, th.App.Srv().Store.Token().Save(token))

	_, resp, err = client.AddTeamMemberFromInvite(token.Token, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	th.App.DeleteToken(token)

	// invalid team id
	testId := GenerateTestId()
	token = model.NewToken(
		app.TokenTypeTeamInvitation,
		model.MapToJSON(map[string]string{"teamId": testId}),
	)
	require.NoError(t, th.App.Srv().Store.Token().Save(token))

	_, resp, err = client.AddTeamMemberFromInvite(token.Token, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
	th.App.DeleteToken(token)

	// by invite_id
	th.App.Srv().SetLicense(model.NewTestLicense(""))
	defer th.App.Srv().SetLicense(nil)
	_, _, err = client.Login(guest.Email, guest.Password)
	require.NoError(t, err)

	_, resp, err = client.AddTeamMemberFromInvite("", team.InviteId)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// by invite_id
	client.Login(otherUser.Email, otherUser.Password)

	tm, _, err = client.AddTeamMemberFromInvite("", team.InviteId)
	require.NoError(t, err)

	require.NotNil(t, tm, "should have returned team member")

	require.Equal(t, tm.UserId, otherUser.Id, "user ids should have matched")

	require.Equal(t, tm.TeamId, team.Id, "team ids should have matched")

	tm, resp, err = client.AddTeamMemberFromInvite("", "junk")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	require.Nil(t, tm, "should have not returned team member")

	// Set a team to group-constrained
	team.GroupConstrained = model.NewBool(true)
	_, appErr = th.App.UpdateTeam(team)
	require.Nil(t, appErr)

	// Attempt to use a token on a group-constrained team
	token = model.NewToken(
		app.TokenTypeTeamInvitation,
		model.MapToJSON(map[string]string{"teamId": team.Id}),
	)
	require.NoError(t, th.App.Srv().Store.Token().Save(token))
	_, _, err = client.AddTeamMemberFromInvite(token.Token, "")
	CheckErrorID(t, err, "app.team.invite_token.group_constrained.error")

	// Attempt to use an invite id
	_, _, err = client.AddTeamMemberFromInvite("", team.InviteId)
	CheckErrorID(t, err, "app.team.invite_id.group_constrained.error")

	// User is not in associated groups so shouldn't be allowed
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.AddTeamMember(team.Id, otherUser.Id)
		CheckErrorID(t, err, "api.team.add_members.user_denied")
	})

	// Associate group to team
	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    th.Group.Id,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
	})
	require.Nil(t, appErr)

	// Add user to group
	_, appErr = th.App.UpsertGroupMember(th.Group.Id, otherUser.Id)
	require.Nil(t, appErr)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, err = client.AddTeamMember(team.Id, otherUser.Id)
		require.NoError(t, err)
	})
}

func TestAddTeamMemberMyself(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

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
				th.AddPermissionToRole(model.PermissionJoinPublicTeams.Id, model.SystemUserRoleId)
			} else {
				th.RemovePermissionFromRole(model.PermissionJoinPublicTeams.Id, model.SystemUserRoleId)
			}
			if tc.PrivatePermission {
				th.AddPermissionToRole(model.PermissionJoinPrivateTeams.Id, model.SystemUserRoleId)
			} else {
				th.RemovePermissionFromRole(model.PermissionJoinPrivateTeams.Id, model.SystemUserRoleId)
			}
			_, resp, err := client.AddTeamMember(team.Id, th.BasicUser.Id)
			if tc.ExpectedSuccess {
				require.NoError(t, err)
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
	_, _, err := client.UpdateTeam(team)
	require.NoError(t, err)

	// create two users on allowed domains
	user1, _, err := client.CreateUser(&model.User{
		Email:    "user@domain1.com",
		Password: "Pa$$word11",
		Username: GenerateTestUsername(),
	})
	require.NoError(t, err)
	user2, _, err := client.CreateUser(&model.User{
		Email:    "user@domain2.com",
		Password: "Pa$$word11",
		Username: GenerateTestUsername(),
	})
	require.NoError(t, err)

	userList := []string{
		user1.Id,
		user2.Id,
	}

	// validate that they can be added
	tm, _, err := client.AddTeamMembers(team.Id, userList)
	require.NoError(t, err)
	require.Len(t, tm, 2)

	// cleanup
	_, err = client.RemoveTeamMember(team.Id, user1.Id)
	require.NoError(t, err)
	_, err = client.RemoveTeamMember(team.Id, user2.Id)
	require.NoError(t, err)

	// disable one of the allowed domains
	team.AllowedDomains = "domain1.com"
	_, _, err = client.UpdateTeam(team)
	require.NoError(t, err)

	// validate that they cannot be added
	_, _, err = client.AddTeamMembers(team.Id, userList)
	require.Error(t, err)

	// validate that one user can be added gracefully
	members, _, err := client.AddTeamMembersGracefully(team.Id, userList)
	require.NoError(t, err)
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
	client := th.Client
	team := th.BasicTeam
	otherUser := th.CreateUser()
	userList := []string{
		otherUser.Id,
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})
	bot := th.CreateBotWithSystemAdminClient()

	appErr := th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.BasicUser2.Id, "")
	require.Nil(t, appErr)

	// Regular user can't add a member to a team they don't belong to.
	th.LoginBasic2()
	_, resp, err := client.AddTeamMembers(team.Id, userList)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	client.Logout()

	// Regular user can add a member to a team they belong to.
	th.LoginBasic()
	tm, resp, err := client.AddTeamMembers(team.Id, userList)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// Check all the returned data.
	require.NotNil(t, tm[0], "should have returned team member")

	require.Equal(t, tm[0].UserId, otherUser.Id, "user ids should have matched")

	require.Equal(t, tm[0].TeamId, team.Id, "team ids should have matched")

	// Check with various invalid requests.
	_, resp, err = client.AddTeamMembers("junk", userList)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.AddTeamMembers(GenerateTestId(), userList)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	testUserList := append(userList, GenerateTestId())
	_, resp, err = client.AddTeamMembers(team.Id, testUserList)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Test with many users.
	for i := 0; i < 260; i++ {
		testUserList = append(testUserList, GenerateTestId())
	}
	_, resp, err = client.AddTeamMembers(team.Id, testUserList)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	client.Logout()

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	// Set the config so that only team admins can add a user to a team.
	th.AddPermissionToRole(model.PermissionInviteUser.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionAddUserToTeam.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionInviteUser.Id, model.TeamUserRoleId)
	th.RemovePermissionFromRole(model.PermissionAddUserToTeam.Id, model.TeamUserRoleId)

	th.LoginBasic()

	// Check that a regular user can't add someone to the team.
	_, resp, err = client.AddTeamMembers(team.Id, userList)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Update user to team admin
	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.Srv().InvalidateAllCaches()
	th.LoginBasic()

	// Should work as a team admin.
	_, _, err = client.AddTeamMembers(team.Id, userList)
	require.NoError(t, err)

	// Change permission level to team user
	th.AddPermissionToRole(model.PermissionInviteUser.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(model.PermissionAddUserToTeam.Id, model.TeamUserRoleId)
	th.RemovePermissionFromRole(model.PermissionInviteUser.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionAddUserToTeam.Id, model.TeamAdminRoleId)

	th.UpdateUserToNonTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.Srv().InvalidateAllCaches()
	th.LoginBasic()

	// Should work as a regular user.
	_, _, err = client.AddTeamMembers(team.Id, userList)
	require.NoError(t, err)

	// Set a team to group-constrained
	team.GroupConstrained = model.NewBool(true)
	_, appErr = th.App.UpdateTeam(team)
	require.Nil(t, appErr)

	// User is not in associated groups so shouldn't be allowed
	_, _, err = client.AddTeamMembers(team.Id, userList)
	CheckErrorID(t, err, "api.team.add_members.user_denied")

	// Ensure that a group synced team can still add bots
	_, _, err = client.AddTeamMembers(team.Id, []string{bot.UserId})
	require.NoError(t, err)

	// Associate group to team
	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		GroupId:    th.Group.Id,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
	})
	require.Nil(t, appErr)

	// Add user to group
	_, appErr = th.App.UpsertGroupMember(th.Group.Id, userList[0])
	require.Nil(t, appErr)

	_, _, err = client.AddTeamMembers(team.Id, userList)
	require.NoError(t, err)
}

func TestRemoveTeamMember(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
	})
	bot := th.CreateBotWithSystemAdminClient()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		_, err := client.RemoveTeamMember(th.BasicTeam.Id, th.BasicUser.Id)
		require.NoError(t, err)

		_, _, err = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, th.BasicUser.Id)
		require.NoError(t, err)
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.RemoveTeamMember(th.BasicTeam.Id, "junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = client.RemoveTeamMember("junk", th.BasicUser2.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	resp, err := client.RemoveTeamMember(th.BasicTeam.Id, th.BasicUser2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		resp, err = client.RemoveTeamMember(model.NewId(), th.BasicUser.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	_, _, err = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, th.SystemAdminUser.Id)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.AddTeamMember(th.BasicTeam.Id, bot.UserId)
	require.NoError(t, err)

	// If the team is group-constrained the user cannot be removed
	th.BasicTeam.GroupConstrained = model.NewBool(true)
	_, appErr := th.App.UpdateTeam(th.BasicTeam)
	require.Nil(t, appErr)
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err2 := client.RemoveTeamMember(th.BasicTeam.Id, th.BasicUser.Id)
		CheckErrorID(t, err2, "api.team.remove_member.group_constrained.app_error")
	})

	// Can remove a bot even if team is group-constrained

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err2 := client.RemoveTeamMember(th.BasicTeam.Id, bot.UserId)
		require.NoError(t, err2)
		_, _, err2 = client.AddTeamMember(th.BasicTeam.Id, bot.UserId)
		require.NoError(t, err2)
	})

	// Can remove self even if team is group-constrained
	_, err = th.SystemAdminClient.RemoveTeamMember(th.BasicTeam.Id, th.SystemAdminUser.Id)
	require.NoError(t, err)
}

func TestGetTeamStats(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	team := th.BasicTeam

	rstats, _, err := client.GetTeamStats(team.Id, "")
	require.NoError(t, err)

	require.Equal(t, rstats.TeamId, team.Id, "wrong team id")

	require.Equal(t, rstats.TotalMemberCount, int64(3), "wrong count")

	require.Equal(t, rstats.ActiveMemberCount, int64(3), "wrong count")

	_, resp, err := client.GetTeamStats("junk", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamStats(model.NewId(), "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemAdminClient.GetTeamStats(team.Id, "")
	require.NoError(t, err)

	// deactivate BasicUser2
	th.UpdateActiveUser(th.BasicUser2, false)

	rstats, _, err = th.SystemAdminClient.GetTeamStats(team.Id, "")
	require.NoError(t, err)

	require.Equal(t, rstats.TotalMemberCount, int64(3), "wrong count")

	require.Equal(t, rstats.ActiveMemberCount, int64(2), "wrong count")

	// login with different user and test if forbidden
	user := th.CreateUser()
	client.Login(user.Email, user.Password)
	_, resp, err = client.GetTeamStats(th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetTeamStats(th.BasicTeam.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdateTeamMemberRoles(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	SystemAdminClient := th.SystemAdminClient

	const TeamMember = "team_user"
	const TeamAdmin = "team_user team_admin"

	// user 1 tries to promote user 2
	resp, err := client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamAdmin)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// user 1 tries to promote himself
	resp, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, TeamAdmin)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// user 1 tries to demote someone
	resp, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.SystemAdminUser.Id, TeamMember)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// system admin promotes user 1
	_, err = SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, TeamAdmin)
	require.NoError(t, err)

	// user 1 (team admin) promotes user 2
	_, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamAdmin)
	require.NoError(t, err)

	// user 1 (team admin) demotes user 2 (team admin)
	_, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamMember)
	require.NoError(t, err)

	// user 1 (team admin) tries to demote system admin (not member of a team)
	resp, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.SystemAdminUser.Id, TeamMember)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// user 1 (team admin) demotes system admin (member of a team)
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
	_, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.SystemAdminUser.Id, TeamMember)
	require.NoError(t, err)
	// Note from API v3
	// Note to anyone who thinks this (above) test is wrong:
	// This operation will not affect the system admin's permissions because they have global access to all teams.
	// Their team level permissions are irrelevant. A team admin should be able to manage team level permissions.

	// System admins should be able to manipulate permission no matter what their team level permissions are.
	// system admin promotes user 2
	_, err = SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamAdmin)
	require.NoError(t, err)

	// system admin demotes user 2 (team admin)
	_, err = SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser2.Id, TeamMember)
	require.NoError(t, err)

	// user 1 (team admin) tries to promote himself to a random team
	resp, err = client.UpdateTeamMemberRoles(model.NewId(), th.BasicUser.Id, TeamAdmin)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// user 1 (team admin) tries to promote a random user
	resp, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, model.NewId(), TeamAdmin)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// user 1 (team admin) tries to promote invalid team permission
	resp, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// user 1 (team admin) demotes himself
	_, err = client.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, TeamMember)
	require.NoError(t, err)
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
	_, err := SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s1)
	require.NoError(t, err)

	tm1, _, err := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	assert.Equal(t, false, tm1.SchemeGuest)
	assert.Equal(t, false, tm1.SchemeUser)
	assert.Equal(t, false, tm1.SchemeAdmin)

	s2 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  true,
		SchemeGuest: false,
	}
	_, err = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s2)
	require.NoError(t, err)

	tm2, _, err := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	assert.Equal(t, false, tm2.SchemeGuest)
	assert.Equal(t, true, tm2.SchemeUser)
	assert.Equal(t, false, tm2.SchemeAdmin)

	s3 := &model.SchemeRoles{
		SchemeAdmin: true,
		SchemeUser:  false,
		SchemeGuest: false,
	}
	_, err = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s3)
	require.NoError(t, err)

	tm3, _, err := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	assert.Equal(t, false, tm3.SchemeGuest)
	assert.Equal(t, false, tm3.SchemeUser)
	assert.Equal(t, true, tm3.SchemeAdmin)

	s4 := &model.SchemeRoles{
		SchemeAdmin: true,
		SchemeUser:  true,
		SchemeGuest: false,
	}
	_, err = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s4)
	require.NoError(t, err)

	tm4, _, err := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	assert.Equal(t, false, tm4.SchemeGuest)
	assert.Equal(t, true, tm4.SchemeUser)
	assert.Equal(t, true, tm4.SchemeAdmin)

	s5 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  false,
		SchemeGuest: true,
	}
	_, err = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s5)
	require.NoError(t, err)

	tm5, _, err := SystemAdminClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	assert.Equal(t, true, tm5.SchemeGuest)
	assert.Equal(t, false, tm5.SchemeUser)
	assert.Equal(t, false, tm5.SchemeAdmin)

	s6 := &model.SchemeRoles{
		SchemeAdmin: false,
		SchemeUser:  true,
		SchemeGuest: true,
	}
	resp, err := SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s6)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = SystemAdminClient.UpdateTeamMemberSchemeRoles(model.NewId(), th.BasicUser.Id, s4)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	resp, err = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, model.NewId(), s4)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	resp, err = SystemAdminClient.UpdateTeamMemberSchemeRoles("ASDF", th.BasicUser.Id, s4)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, "ASDF", s4)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	th.LoginBasic2()
	resp, err = th.Client.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.BasicUser.Id, s4)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	SystemAdminClient.Logout()
	resp, err = SystemAdminClient.UpdateTeamMemberSchemeRoles(th.BasicTeam.Id, th.SystemAdminUser.Id, s4)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetMyTeamsUnread(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	user := th.BasicUser
	client.Login(user.Email, user.Password)

	teams, _, err := client.GetTeamsUnreadForUser(user.Id, "", true)
	require.NoError(t, err)
	require.NotEqual(t, len(teams), 0, "should have results")

	teams, _, err = client.GetTeamsUnreadForUser(user.Id, th.BasicTeam.Id, true)
	require.NoError(t, err)
	require.Empty(t, teams, "should not have results")

	_, resp, err := client.GetTeamsUnreadForUser("fail", "", true)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetTeamsUnreadForUser(model.NewId(), "", true)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetTeamsUnreadForUser(user.Id, "", true)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestTeamExists(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	public_member_team := th.BasicTeam
	err := th.App.UpdateTeamPrivacy(public_member_team.Id, model.TeamOpen, true)
	require.Nil(t, err)

	public_not_member_team := th.CreateTeamWithClient(th.SystemAdminClient)
	err = th.App.UpdateTeamPrivacy(public_not_member_team.Id, model.TeamOpen, true)
	require.Nil(t, err)

	private_member_team := th.CreateTeamWithClient(th.SystemAdminClient)
	th.LinkUserToTeam(th.BasicUser, private_member_team)
	err = th.App.UpdateTeamPrivacy(private_member_team.Id, model.TeamInvite, false)
	require.Nil(t, err)

	private_not_member_team := th.CreateTeamWithClient(th.SystemAdminClient)
	err = th.App.UpdateTeamPrivacy(private_not_member_team.Id, model.TeamInvite, false)
	require.Nil(t, err)

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	th.AddPermissionToRole(model.PermissionListPublicTeams.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(model.PermissionListPrivateTeams.Id, model.SystemUserRoleId)

	t.Run("Logged user with permissions and valid public team", func(t *testing.T) {
		th.LoginBasic()
		exists, _, err := client.TeamExists(public_not_member_team.Name, "")
		require.NoError(t, err)
		assert.True(t, exists, "team should exist")
	})

	t.Run("Logged user with permissions and valid private team", func(t *testing.T) {
		th.LoginBasic()
		exists, _, err := client.TeamExists(private_not_member_team.Name, "")
		require.NoError(t, err)
		assert.True(t, exists, "team should exist")
	})

	t.Run("Logged user and invalid team", func(t *testing.T) {
		th.LoginBasic()
		exists, _, err := client.TeamExists("testingteam", "")
		require.NoError(t, err)
		assert.False(t, exists, "team should not exist")
	})

	t.Run("Logged out user", func(t *testing.T) {
		client.Logout()
		_, resp, err := client.TeamExists(public_not_member_team.Name, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("Logged without LIST_PUBLIC_TEAMS permissions and member public team", func(t *testing.T) {
		th.LoginBasic()
		th.RemovePermissionFromRole(model.PermissionListPublicTeams.Id, model.SystemUserRoleId)

		exists, _, err := client.TeamExists(public_member_team.Name, "")
		require.NoError(t, err)
		assert.True(t, exists, "team should be visible")
	})

	t.Run("Logged without LIST_PUBLIC_TEAMS permissions and not member public team", func(t *testing.T) {
		th.LoginBasic()
		th.RemovePermissionFromRole(model.PermissionListPublicTeams.Id, model.SystemUserRoleId)

		exists, _, err := client.TeamExists(public_not_member_team.Name, "")
		require.NoError(t, err)
		assert.False(t, exists, "team should not be visible")
	})

	t.Run("Logged without LIST_PRIVATE_TEAMS permissions and member private team", func(t *testing.T) {
		th.LoginBasic()
		th.RemovePermissionFromRole(model.PermissionListPrivateTeams.Id, model.SystemUserRoleId)

		exists, _, err := client.TeamExists(private_member_team.Name, "")
		require.NoError(t, err)
		assert.True(t, exists, "team should be visible")
	})

	t.Run("Logged without LIST_PRIVATE_TEAMS permissions and not member private team", func(t *testing.T) {
		th.LoginBasic()
		th.RemovePermissionFromRole(model.PermissionListPrivateTeams.Id, model.SystemUserRoleId)

		exists, _, err := client.TeamExists(private_not_member_team.Name, "")
		require.NoError(t, err)
		assert.False(t, exists, "team should not be visible")
	})
}

func TestImportTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.TestForAllClients(t, func(T *testing.T, c *model.Client4) {
		data, err := testutils.ReadTestFile("Fake_Team_Import.zip")

		require.False(t, err != nil && len(data) == 0, "Error while reading the test file.")
		_, resp, err := th.SystemAdminClient.ImportTeam(data, binary.Size(data), "XYZ", "Fake_Team_Import.zip", th.BasicTeam.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = th.SystemAdminClient.ImportTeam(data, binary.Size(data), "", "Fake_Team_Import.zip", th.BasicTeam.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "Import from unknown and source")

	t.Run("ImportTeam", func(t *testing.T) {
		var data []byte
		var err error
		data, err = testutils.ReadTestFile("Fake_Team_Import.zip")

		require.False(t, err != nil && len(data) == 0, "Error while reading the test file.")

		// Import the channels/users/posts
		fileResp, _, err := th.SystemAdminClient.ImportTeam(data, binary.Size(data), "slack", "Fake_Team_Import.zip", th.BasicTeam.Id)
		require.NoError(t, err)

		fileData, err := base64.StdEncoding.DecodeString(fileResp["results"])
		require.NoError(t, err, "failed to decode base64 results data")

		fileReturned := string(fileData)
		require.Truef(t, strings.Contains(fileReturned, "darth.vader@stardeath.com"), "failed to report the user was imported, fileReturned: %s", fileReturned)

		// Checking the imported users
		importedUser, _, err := th.SystemAdminClient.GetUserByUsername("bot_test", "")
		require.NoError(t, err)
		require.Equal(t, importedUser.Username, "bot_test", "username should match with the imported user")

		importedUser, _, err = th.SystemAdminClient.GetUserByUsername("lordvader", "")
		require.NoError(t, err)
		require.Equal(t, importedUser.Username, "lordvader", "username should match with the imported user")

		// Checking the imported Channels
		importedChannel, _, err := th.SystemAdminClient.GetChannelByName("testchannel", th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Equal(t, importedChannel.Name, "testchannel", "names did not match expected: testchannel")

		importedChannel, _, err = th.SystemAdminClient.GetChannelByName("general", th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Equal(t, importedChannel.Name, "general", "names did not match expected: general")

		posts, _, err := th.SystemAdminClient.GetPostsForChannel(importedChannel.Id, 0, 60, "", false, false)
		require.NoError(t, err)
		require.Equal(t, posts.Posts[posts.Order[3]].Message, "This is a test post to test the import process", "missing posts in the import process")
	})

	t.Run("Cloud Forbidden", func(t *testing.T) {
		var data []byte
		var err error
		data, err = testutils.ReadTestFile("Fake_Team_Import.zip")

		require.False(t, err != nil && len(data) == 0, "Error while reading the test file.")
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		// Import the channels/users/posts
		_, resp, err := th.SystemAdminClient.ImportTeam(data, binary.Size(data), "slack", "Fake_Team_Import.zip", th.BasicTeam.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		th.App.Srv().SetLicense(nil)
	})

	t.Run("MissingFile", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.ImportTeam(nil, 4343, "slack", "Fake_Team_Import.zip", th.BasicTeam.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("WrongPermission", func(t *testing.T) {
		var data []byte
		var err error
		data, err = testutils.ReadTestFile("Fake_Team_Import.zip")
		require.False(t, err != nil && len(data) == 0, "Error while reading the test file.")

		// Import the channels/users/posts
		_, resp, err := th.Client.ImportTeam(data, binary.Size(data), "slack", "Fake_Team_Import.zip", th.BasicTeam.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestInviteUsersToTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := th.GenerateTestEmail()
	user2 := th.GenerateTestEmail()

	memberInvite := &model.MemberInvite{Emails: []string{user1, user2}}
	emailList := memberInvite.Emails

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
		_, err := client.InviteUsersToTeam(th.BasicTeam.Id, emailList)
		require.Error(t, err, "Should be disabled")
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
					require.Equalf(t, resultsEmail.Subject, expectedSubject, "Wrong Subject, \nactual: %s, \nexpected: %s", resultsEmail.Subject, expectedSubject)
				}
			}
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })
	_, err := th.SystemAdminClient.InviteUsersToTeam(th.BasicTeam.Id, emailList)
	require.NoError(t, err)
	nameFormat := *th.App.Config().TeamSettings.TeammateNameDisplay
	expectedSubject := i18n.T("api.templates.invite_subject",
		map[string]any{"SenderName": th.SystemAdminUser.GetDisplayName(nameFormat),
			"TeamDisplayName": th.BasicTeam.DisplayName,
			"SiteName":        th.App.ClientConfig()["SiteName"]})
	checkEmail(t, expectedSubject)

	// Test the invite to team and channel
	mail.DeleteMailBox(user1)
	mail.DeleteMailBox(user2)
	_, _, err = th.SystemAdminClient.InviteUsersToTeamAndChannelsGracefully(th.BasicTeam.Id, []string{user1, user2}, []string{th.BasicChannel.Id}, "")
	require.NoError(t, err)
	expectedSubject = i18n.T("api.templates.invite_team_and_channel_subject",
		map[string]any{"SenderName": th.SystemAdminUser.GetDisplayName(nameFormat),
			"TeamDisplayName": th.BasicTeam.DisplayName,
			"ChannelName":     th.BasicChannel.DisplayName,
			"SiteName":        th.App.ClientConfig()["SiteName"]})
	checkEmail(t, expectedSubject)

	mail.DeleteMailBox(user1)
	mail.DeleteMailBox(user2)
	_, err = th.LocalClient.InviteUsersToTeam(th.BasicTeam.Id, emailList)
	require.NoError(t, err)
	expectedSubject = i18n.T("api.templates.invite_subject",
		map[string]any{"SenderName": "Administrator",
			"TeamDisplayName": th.BasicTeam.DisplayName,
			"SiteName":        th.App.ClientConfig()["SiteName"]})
	checkEmail(t, expectedSubject)

	// Test the invite local to team and channel
	mail.DeleteMailBox(user1)
	mail.DeleteMailBox(user2)
	_, _, err = th.LocalClient.InviteUsersToTeamAndChannelsGracefully(th.BasicTeam.Id, []string{user1, user2}, []string{th.BasicChannel.Id}, "")
	require.NoError(t, err)
	expectedSubject = i18n.T("api.templates.invite_team_and_channel_subject",
		map[string]any{"SenderName": "Administrator",
			"TeamDisplayName": th.BasicTeam.DisplayName,
			"ChannelName":     th.BasicChannel.DisplayName,
			"SiteName":        th.App.ClientConfig()["SiteName"]})
	checkEmail(t, expectedSubject)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictCreationToDomains = "@global.com,@common.com" })

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		_, err := client.InviteUsersToTeam(th.BasicTeam.Id, emailList)
		require.Error(t, err, "Adding users with non-restricted domains was allowed")

		invitesWithErrors, _, err := client.InviteUsersToTeamGracefully(th.BasicTeam.Id, emailList)
		require.NoError(t, err)
		require.Len(t, invitesWithErrors, 2)
		require.NotNil(t, invitesWithErrors[0].Error)
		require.NotNil(t, invitesWithErrors[1].Error)
	}, "restricted domains")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		th.BasicTeam.AllowedDomains = "invalid.com,common.com"
		_, appErr := th.App.UpdateTeam(th.BasicTeam)
		require.NotNil(t, appErr, "Should not update the team")

		th.BasicTeam.AllowedDomains = "common.com"
		_, appErr = th.App.UpdateTeam(th.BasicTeam)
		require.Nilf(t, appErr, "%v, Should update the team", appErr)

		_, err := client.InviteUsersToTeam(th.BasicTeam.Id, []string{"test@global.com"})
		require.Errorf(t, err, "%v, Per team restriction should take precedence over the globally allowed domains", err)

		_, err = client.InviteUsersToTeam(th.BasicTeam.Id, []string{"test@common.com"})
		require.NoErrorf(t, err, "%v, Failed to invite user which was common between team and global domain restriction", err)

		_, err = client.InviteUsersToTeam(th.BasicTeam.Id, []string{"test@invalid.com"})
		require.Errorf(t, err, "%v, Should not invite user", err)

		invitesWithErrors, _, err := client.InviteUsersToTeamGracefully(th.BasicTeam.Id, []string{"test@invalid.com", "test@common.com"})
		require.NoError(t, err)
		require.Len(t, invitesWithErrors, 2)
		require.NotNil(t, invitesWithErrors[0].Error)
		require.Nil(t, invitesWithErrors[1].Error)
	}, "override restricted domains")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		th.BasicTeam.AllowedDomains = "common.com"
		_, appErr := th.App.UpdateTeam(th.BasicTeam)
		require.Nilf(t, appErr, "%v, Should update the team", appErr)

		emailList := make([]string, 22)
		for i := 0; i < 22; i++ {
			emailList[i] = "test-" + strconv.Itoa(i) + "@common.com"
		}
		resp, err := client.InviteUsersToTeam(th.BasicTeam.Id, emailList)
		require.Error(t, err)
		CheckRequestEntityTooLargeStatus(t, resp)
		CheckErrorID(t, err, "app.email.rate_limit_exceeded.app_error")

		_, resp, err = client.InviteUsersToTeamGracefully(th.BasicTeam.Id, emailList)
		require.Error(t, err)
		CheckRequestEntityTooLargeStatus(t, resp)
		CheckErrorID(t, err, "app.email.rate_limit_exceeded.app_error")
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
	_, err := th.SystemAdminClient.InviteGuestsToTeam(th.BasicTeam.Id, emailList, []string{th.BasicChannel.Id}, "test-message")
	assert.Error(t, err, "Should be disabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = false })
	_, err = th.SystemAdminClient.InviteGuestsToTeam(th.BasicTeam.Id, emailList, []string{th.BasicChannel.Id}, "test-message")
	require.Error(t, err, "Should be disabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })

	th.App.Srv().SetLicense(nil)

	_, err = th.SystemAdminClient.InviteGuestsToTeam(th.BasicTeam.Id, emailList, []string{th.BasicChannel.Id}, "test-message")
	require.Error(t, err, "Should be disabled")

	th.App.Srv().SetLicense(model.NewTestLicense(""))
	defer th.App.Srv().SetLicense(nil)

	_, err = th.SystemAdminClient.InviteGuestsToTeam(th.BasicTeam.Id, emailList, []string{th.BasicChannel.Id}, "test-message")
	require.NoError(t, err)

	t.Run("invalid data in request body", func(t *testing.T) {
		res, err := th.SystemAdminClient.DoAPIPost("/teams/"+th.BasicTeam.Id+"/invite-guests/email", "bad data")
		require.Error(t, err)
		CheckErrorID(t, err, "api.team.invite_guests_to_channels.invalid_body.app_error")
		require.Equal(t, http.StatusBadRequest, res.StatusCode)
	})

	nameFormat := *th.App.Config().TeamSettings.TeammateNameDisplay
	expectedSubject := i18n.T("api.templates.invite_guest_subject",
		map[string]any{"SenderName": th.SystemAdminUser.GetDisplayName(nameFormat),
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

		_, appErr := th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, invite, th.BasicUser.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.email.rate_limit_exceeded.app_error", err.Id)
		assert.Equal(t, http.StatusRequestEntityTooLarge, err.StatusCode)
	})
}

func TestInviteGuest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	guest1 := th.GenerateTestEmail()
	guest2 := th.GenerateTestEmail()

	emailList := []string{guest1, guest2}
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })

	t.Run("Guest Account not available in license returns forbidden", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseWithFalseDefaults("guest_accounts"))

		guestsInvite := model.GuestsInvite{
			Emails:   emailList,
			Channels: []string{th.BasicChannel.Id},
			Message:  "test message",
		}
		buf, err := json.Marshal(guestsInvite)
		require.NoError(t, err)

		res, err := th.SystemAdminClient.DoAPIPost("/teams/"+th.BasicTeam.Id+"/invite-guests/email", string(buf))

		require.Equal(t, http.StatusForbidden, res.StatusCode)
		require.True(t, strings.Contains(err.Error(), "Guest accounts are disabled"))
		require.Error(t, err)
	})

	t.Run("Guest Account available in license returns OK", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("guest_accounts"))

		guestsInvite := model.GuestsInvite{
			Emails:   emailList,
			Channels: []string{th.BasicChannel.Id},
			Message:  "test message",
		}
		buf, err := json.Marshal(guestsInvite)
		require.NoError(t, err)

		res, err := th.SystemAdminClient.DoAPIPost("/teams/"+th.BasicTeam.Id+"/invite-guests/email", string(buf))

		require.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, err)
	})
}

func TestGetTeamInviteInfo(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	team := th.BasicTeam

	team, _, err := client.GetTeamInviteInfo(team.InviteId)
	require.NoError(t, err)

	require.NotEmpty(t, team.DisplayName, "should not be empty")

	require.Empty(t, team.Email, "should be empty")

	team.InviteId = "12345678901234567890123456789012"
	team, _, err = th.SystemAdminClient.UpdateTeam(team)
	require.NoError(t, err)

	_, _, err = client.GetTeamInviteInfo(team.InviteId)
	require.NoError(t, err)

	_, resp, err := client.GetTeamInviteInfo("junk")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestSetTeamIcon(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	team := th.BasicTeam

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err, err)

	th.LoginTeamAdmin()

	_, err = client.SetTeamIcon(team.Id, data)
	require.NoError(t, err)

	resp, err := client.SetTeamIcon(model.NewId(), data)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	resp, err = client.SetTeamIcon(team.Id, data)
	require.Error(t, err)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	client.Logout()

	resp, err = client.SetTeamIcon(team.Id, data)
	require.Error(t, err)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	teamBefore, appErr := th.App.GetTeam(team.Id)
	require.Nil(t, appErr)

	_, err = th.SystemAdminClient.SetTeamIcon(team.Id, data)
	require.NoError(t, err)

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
	client := th.Client
	team := th.BasicTeam

	// should always fail because no initial image and no auto creation
	_, resp, err := client.GetTeamIcon(team.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	client.Logout()

	_, resp, err = client.GetTeamIcon(team.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestRemoveTeamIcon(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	team := th.BasicTeam

	th.LoginTeamAdmin()
	data, _ := testutils.ReadTestFile("test.png")
	client.SetTeamIcon(team.Id, data)

	_, err := client.RemoveTeamIcon(team.Id)
	require.NoError(t, err)
	teamAfter, _ := th.App.GetTeam(team.Id)
	require.Equal(t, teamAfter.LastTeamIconUpdate, int64(0), "should update LastTeamIconUpdate to 0")

	client.SetTeamIcon(team.Id, data)

	_, err = th.SystemAdminClient.RemoveTeamIcon(team.Id)
	require.NoError(t, err)
	teamAfter, _ = th.App.GetTeam(team.Id)
	require.Equal(t, teamAfter.LastTeamIconUpdate, int64(0), "should update LastTeamIconUpdate to 0")

	client.SetTeamIcon(team.Id, data)
	client.Logout()

	resp, err := client.RemoveTeamIcon(team.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic()
	resp, err = client.RemoveTeamIcon(team.Id)
	require.Error(t, err)
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
		Type:            model.TeamOpen,
	}
	team, _, _ = th.SystemAdminClient.CreateTeam(team)

	teamScheme := &model.Scheme{
		DisplayName: "DisplayName",
		Name:        model.NewId(),
		Description: "Some description",
		Scope:       model.SchemeScopeTeam,
	}
	teamScheme, _, _ = th.SystemAdminClient.CreateScheme(teamScheme)
	channelScheme := &model.Scheme{
		DisplayName: "DisplayName",
		Name:        model.NewId(),
		Description: "Some description",
		Scope:       model.SchemeScopeChannel,
	}
	channelScheme, _, _ = th.SystemAdminClient.CreateScheme(channelScheme)

	// Test the setup/base case.
	_, err := th.SystemAdminClient.UpdateTeamScheme(team.Id, teamScheme.Id)
	require.NoError(t, err)

	// Test the return to default scheme
	_, err = th.SystemAdminClient.UpdateTeamScheme(team.Id, "")
	require.NoError(t, err)

	// Test various invalid team and scheme id combinations.
	resp, err := th.SystemAdminClient.UpdateTeamScheme(team.Id, "x")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	resp, err = th.SystemAdminClient.UpdateTeamScheme("x", teamScheme.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	resp, err = th.SystemAdminClient.UpdateTeamScheme("x", "x")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Test that permissions are required.
	resp, err = th.Client.UpdateTeamScheme(team.Id, teamScheme.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Test that a license is required.
	th.App.Srv().SetLicense(nil)
	resp, err = th.SystemAdminClient.UpdateTeamScheme(team.Id, teamScheme.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
	th.App.Srv().SetLicense(model.NewTestLicense(""))

	// Test an invalid scheme scope.
	resp, err = th.SystemAdminClient.UpdateTeamScheme(team.Id, channelScheme.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Test that an unauthenticated user gets rejected.
	th.SystemAdminClient.Logout()
	resp, err = th.SystemAdminClient.UpdateTeamScheme(team.Id, teamScheme.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestTeamMembersMinusGroupMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user1 := th.BasicUser
	user2 := th.BasicUser2

	team := th.CreateTeam()
	team.GroupConstrained = model.NewBool(true)
	team, appErr := th.App.UpdateTeam(team)
	require.Nil(t, appErr)

	_, appErr = th.App.AddTeamMember(th.Context, team.Id, user1.Id)
	require.Nil(t, appErr)
	_, appErr = th.App.AddTeamMember(th.Context, team.Id, user2.Id)
	require.Nil(t, appErr)

	group1 := th.CreateGroup()
	group2 := th.CreateGroup()

	_, appErr = th.App.UpsertGroupMember(group1.Id, user1.Id)
	require.Nil(t, appErr)
	_, appErr = th.App.UpsertGroupMember(group2.Id, user2.Id)
	require.Nil(t, appErr)

	// No permissions
	_, _, _, err := th.Client.TeamMembersMinusGroupMembers(team.Id, []string{group1.Id, group2.Id}, 0, 100, "")
	CheckErrorID(t, err, "api.context.permissions.app_error")

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
			uwg, count, _, err := th.SystemAdminClient.TeamMembersMinusGroupMembers(team.Id, tc.groupIDs, tc.page, tc.perPage, "")
			require.NoError(t, err)
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
		res, err := th.Client.InvalidateEmailInvites()
		require.Error(t, err)
		CheckForbiddenStatus(t, res)
	})

	t.Run("OK when request performed by system user with requisite system permission", func(t *testing.T) {
		th.AddPermissionToRole(model.PermissionInvalidateEmailInvite.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(model.PermissionInvalidateEmailInvite.Id, model.SystemUserRoleId)
		res, err := th.Client.InvalidateEmailInvites()
		require.NoError(t, err)
		CheckOKStatus(t, res)
	})

	t.Run("OK when request performed by system admin", func(t *testing.T) {
		res, err := th.SystemAdminClient.InvalidateEmailInvites()
		require.NoError(t, err)
		CheckOKStatus(t, res)
	})
}
