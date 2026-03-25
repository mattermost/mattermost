// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestCreateTeamErrorPaths tests various error conditions in createTeam
func TestCreateTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("create team with invalid name", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Test Team",
			Name:        "invalid name with spaces",
			Type:        model.TeamOpen,
		}
		_, resp, err := th.Client.CreateTeam(context.Background(), team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create team with duplicate name", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Duplicate Team",
			Name:        th.BasicTeam.Name,
			Type:        model.TeamOpen,
		}
		_, resp, err := th.Client.CreateTeam(context.Background(), team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create team with empty display name", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "",
			Name:        "emptyname",
			Type:        model.TeamOpen,
		}
		_, resp, err := th.Client.CreateTeam(context.Background(), team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create team with empty name", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Test Team",
			Name:        "",
			Type:        model.TeamOpen,
		}
		_, resp, err := th.Client.CreateTeam(context.Background(), team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create team with invalid type", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Test Team",
			Name:        "testteam",
			Type:        "invalid",
		}
		_, resp, err := th.Client.CreateTeam(context.Background(), team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		team := &model.Team{
			DisplayName: "Test Team",
			Name:        "testteam",
			Type:        model.TeamOpen,
		}
		_, resp, err := th.Client.CreateTeam(context.Background(), team)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamErrorPaths tests error handling in getTeam
func TestGetTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeam(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent team", func(t *testing.T) {
		_, resp, err := th.Client.GetTeam(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get private team without membership", func(t *testing.T) {
		privateTeam := &model.Team{
			DisplayName:     "Private Team",
			Name:            model.NewId(),
			Type:            model.TeamInvite,
			AllowOpenInvite: false,
		}
		createdTeam, _, err := th.SystemAdminClient.CreateTeam(context.Background(), privateTeam)
		require.NoError(t, err)

		_, resp, err := th.Client.GetTeam(context.Background(), createdTeam.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeam(context.Background(), th.BasicTeam.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamByNameErrorPaths tests error handling in getTeamByName
func TestGetTeamByNameErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty team name", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamByName(context.Background(), "", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("non-existent team name", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamByName(context.Background(), "nonexistentteam", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get private team by name without membership", func(t *testing.T) {
		privateTeam := &model.Team{
			DisplayName:     "Private Team By Name",
			Name:            model.NewId(),
			Type:            model.TeamInvite,
			AllowOpenInvite: false,
		}
		createdTeam, _, err := th.SystemAdminClient.CreateTeam(context.Background(), privateTeam)
		require.NoError(t, err)

		_, resp, err := th.Client.GetTeamByName(context.Background(), createdTeam.Name, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeamByName(context.Background(), th.BasicTeam.Name, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUpdateTeamErrorPaths tests error conditions in updateTeam
func TestUpdateTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("update team with invalid name", func(t *testing.T) {
		team := th.BasicTeam.DeepCopy()
		team.Name = "invalid name"
		_, resp, err := th.Client.UpdateTeam(context.Background(), team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update team without permission", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		otherTeam.DisplayName = "Updated Name"
		_, resp, err := th.Client.UpdateTeam(context.Background(), otherTeam)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("update with invalid team id", func(t *testing.T) {
		team := th.BasicTeam.DeepCopy()
		team.Id = "invalid"
		_, resp, err := th.Client.UpdateTeam(context.Background(), team)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update non-existent team", func(t *testing.T) {
		team := th.BasicTeam.DeepCopy()
		team.Id = model.NewId()
		_, resp, err := th.SystemAdminClient.UpdateTeam(context.Background(), team)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		team := th.BasicTeam.DeepCopy()
		team.DisplayName = "New Name"
		_, resp, err := th.Client.UpdateTeam(context.Background(), team)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestPatchTeamErrorPaths tests error conditions in patchTeam
func TestPatchTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("patch with invalid name", func(t *testing.T) {
		patch := &model.TeamPatch{
			Name: model.NewPointer("invalid name"),
		}
		_, resp, err := th.Client.PatchTeam(context.Background(), th.BasicTeam.Id, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch team without permission", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		patch := &model.TeamPatch{
			DisplayName: model.NewPointer("Updated Name"),
		}
		_, resp, err := th.Client.PatchTeam(context.Background(), otherTeam.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("patch with invalid team id", func(t *testing.T) {
		patch := &model.TeamPatch{
			DisplayName: model.NewPointer("New Name"),
		}
		_, resp, err := th.Client.PatchTeam(context.Background(), "invalid", patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch non-existent team", func(t *testing.T) {
		patch := &model.TeamPatch{
			DisplayName: model.NewPointer("New Name"),
		}
		_, resp, err := th.SystemAdminClient.PatchTeam(context.Background(), model.NewId(), patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		patch := &model.TeamPatch{
			DisplayName: model.NewPointer("New Name"),
		}
		_, resp, err := th.Client.PatchTeam(context.Background(), th.BasicTeam.Id, patch)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestDeleteTeamErrorPaths tests error conditions in deleteTeam
func TestDeleteTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("delete team without permission", func(t *testing.T) {
		team := th.CreateTeam(t)
		resp, err := th.Client.SoftDeleteTeam(context.Background(), team.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delete with invalid team id", func(t *testing.T) {
		resp, err := th.SystemAdminClient.SoftDeleteTeam(context.Background(), "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete non-existent team", func(t *testing.T) {
		resp, err := th.SystemAdminClient.SoftDeleteTeam(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		team := th.CreateTeam(t)
		resp, err := th.Client.SoftDeleteTeam(context.Background(), team.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("permanent delete without permission", func(t *testing.T) {
		team := th.CreateTeam(t)
		resp, err := th.Client.PermanentDeleteTeam(context.Background(), team.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

// TestRestoreTeamErrorPaths tests error conditions in restoreTeam
func TestRestoreTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("restore team without permission", func(t *testing.T) {
		team := th.CreateTeam(t)
		th.SystemAdminClient.SoftDeleteTeam(context.Background(), team.Id)
		
		_, resp, err := th.Client.RestoreTeam(context.Background(), team.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("restore with invalid team id", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.RestoreTeam(context.Background(), "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("restore non-existent team", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.RestoreTeam(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("restore active team returns error", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.RestoreTeam(context.Background(), th.BasicTeam.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		team := th.CreateTeam(t)
		_, resp, err := th.Client.RestoreTeam(context.Background(), team.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamMemberErrorPaths tests error handling in getTeamMember
func TestGetTeamMemberErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("get member with invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamMember(context.Background(), "invalid", th.BasicUser.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get member with invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamMember(context.Background(), th.BasicTeam.Id, "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get member from team user is not in", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		_, resp, err := th.Client.GetTeamMember(context.Background(), otherTeam.Id, th.SystemAdminUser.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get non-existent member", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamMember(context.Background(), th.BasicTeam.Id, model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeamMember(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamMembersErrorPaths tests error handling in getTeamMembers
func TestGetTeamMembersErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("get members with invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamMembers(context.Background(), "invalid", 0, 10, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get members from team user is not in", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		_, resp, err := th.Client.GetTeamMembers(context.Background(), otherTeam.Id, 0, 10, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get members from non-existent team", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamMembers(context.Background(), model.NewId(), 0, 10, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeamMembers(context.Background(), th.BasicTeam.Id, 0, 10, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamMembersByIdsErrorPaths tests error handling in getTeamMembersByIds
func TestGetTeamMembersByIdsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty user ids list", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamMembersByIds(context.Background(), th.BasicTeam.Id, []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamMembersByIds(context.Background(), "invalid", []string{th.BasicUser.Id})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid user id in list", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamMembersByIds(context.Background(), th.BasicTeam.Id, []string{"invalid"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get members from team user is not in", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		_, resp, err := th.Client.GetTeamMembersByIds(context.Background(), otherTeam.Id, []string{th.SystemAdminUser.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeamMembersByIds(context.Background(), th.BasicTeam.Id, []string{th.BasicUser.Id})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestAddTeamMemberErrorPaths tests error conditions in addTeamMember
func TestAddTeamMemberErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("add member with invalid team id", func(t *testing.T) {
		user := th.CreateUser(t)
		_, resp, err := th.Client.AddTeamMember(context.Background(), "invalid", user.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("add member with invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.AddTeamMember(context.Background(), th.BasicTeam.Id, "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("add member to team without permission", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		user := th.CreateUser(t)
		_, resp, err := th.Client.AddTeamMember(context.Background(), otherTeam.Id, user.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("add non-existent user", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.AddTeamMember(context.Background(), th.BasicTeam.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("add member to non-existent team", func(t *testing.T) {
		user := th.CreateUser(t)
		_, resp, err := th.SystemAdminClient.AddTeamMember(context.Background(), model.NewId(), user.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		user := th.CreateUser(t)
		_, resp, err := th.Client.AddTeamMember(context.Background(), th.BasicTeam.Id, user.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestRemoveTeamMemberErrorPaths tests error conditions in removeTeamMember
func TestRemoveTeamMemberErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("remove member with invalid team id", func(t *testing.T) {
		resp, err := th.Client.RemoveTeamMember(context.Background(), "invalid", th.BasicUser.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("remove member with invalid user id", func(t *testing.T) {
		resp, err := th.Client.RemoveTeamMember(context.Background(), th.BasicTeam.Id, "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("remove member from team without permission", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		user := th.CreateUser(t)
		th.SystemAdminClient.AddTeamMember(context.Background(), otherTeam.Id, user.Id)
		
		resp, err := th.Client.RemoveTeamMember(context.Background(), otherTeam.Id, user.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("remove non-existent member", func(t *testing.T) {
		resp, err := th.SystemAdminClient.RemoveTeamMember(context.Background(), th.BasicTeam.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		resp, err := th.Client.RemoveTeamMember(context.Background(), th.BasicTeam.Id, th.BasicUser.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUpdateTeamMemberRolesErrorPaths tests error conditions in updateTeamMemberRoles
func TestUpdateTeamMemberRolesErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("regular user cannot update member roles", func(t *testing.T) {
		_, resp, err := th.Client.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, th.BasicUser2.Id, model.TeamUserRoleId)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("invalid team id", func(t *testing.T) {
			_, resp, err := client.UpdateTeamMemberRoles(context.Background(), "invalid", th.BasicUser.Id, model.TeamUserRoleId)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("invalid user id", func(t *testing.T) {
			_, resp, err := client.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, "invalid", model.TeamUserRoleId)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("invalid roles string", func(t *testing.T) {
			_, resp, err := client.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, "invalid_role")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("non-existent team member", func(t *testing.T) {
			_, resp, err := client.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, model.NewId(), model.TeamUserRoleId)
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, model.TeamUserRoleId)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamStatsErrorPaths tests error handling in getTeamStats
func TestGetTeamStatsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamStats(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get stats from team user is not in", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		_, resp, err := th.Client.GetTeamStats(context.Background(), otherTeam.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-existent team", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamStats(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeamStats(context.Background(), th.BasicTeam.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestRegenerateTeamInviteIdErrorPaths tests error conditions in regenerateTeamInviteId
func TestRegenerateTeamInviteIdErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("regular user cannot regenerate invite id", func(t *testing.T) {
		_, resp, err := th.Client.RegenerateTeamInviteId(context.Background(), th.BasicTeam.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.RegenerateTeamInviteId(context.Background(), "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent team", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.RegenerateTeamInviteId(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.RegenerateTeamInviteId(context.Background(), th.BasicTeam.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamsForUserErrorPaths tests error handling in getTeamsForUser
func TestGetTeamsForUserErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamsForUser(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get teams for other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		_, resp, err := th.Client.GetTeamsForUser(context.Background(), otherUser.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeamsForUser(context.Background(), th.BasicUser.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamsUnreadForUserErrorPaths tests error handling in getTeamsUnreadForUser
func TestGetTeamsUnreadForUserErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamsUnreadForUser(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get unread for other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		_, resp, err := th.Client.GetTeamsUnreadForUser(context.Background(), otherUser.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-existent user", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.GetTeamsUnreadForUser(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeamsUnreadForUser(context.Background(), th.BasicUser.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestSearchTeamsErrorPaths tests error handling in searchTeams
func TestSearchTeamsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("search without system admin permission requires login", func(t *testing.T) {
		th.Client.Logout(context.Background())
		search := &model.TeamSearch{
			Term: "test",
		}
		_, resp, err := th.Client.SearchTeams(context.Background(), search)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("empty search term", func(t *testing.T) {
		search := &model.TeamSearch{
			Term: "",
		}
		teams, _, err := th.Client.SearchTeams(context.Background(), search)
		require.NoError(t, err)
		// Empty search should still work, just return all accessible teams
		require.NotNil(t, teams)
	})
}

// TestTeamExistsErrorPaths tests error handling in teamExists
func TestTeamExistsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty team name", func(t *testing.T) {
		exists, resp, err := th.Client.TeamExists(context.Background(), "", "")
		require.Error(t, err)
		require.False(t, exists)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent team returns false", func(t *testing.T) {
		exists, _, err := th.Client.TeamExists(context.Background(), "nonexistentteam123456", "")
		require.NoError(t, err)
		require.False(t, exists)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		exists, resp, err := th.Client.TeamExists(context.Background(), th.BasicTeam.Name, "")
		require.Error(t, err)
		require.False(t, exists)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestInviteUsersToTeamErrorPaths tests error conditions in inviteUsersToTeam
func TestInviteUsersToTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invite without permission", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		resp, err := th.Client.InviteUsersToTeam(context.Background(), otherTeam.Id, []string{"user@example.com"})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("invalid team id", func(t *testing.T) {
		resp, err := th.Client.InviteUsersToTeam(context.Background(), "invalid", []string{"user@example.com"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("empty email list", func(t *testing.T) {
		resp, err := th.Client.InviteUsersToTeam(context.Background(), th.BasicTeam.Id, []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid email format", func(t *testing.T) {
		resp, err := th.Client.InviteUsersToTeam(context.Background(), th.BasicTeam.Id, []string{"notanemail"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent team", func(t *testing.T) {
		resp, err := th.SystemAdminClient.InviteUsersToTeam(context.Background(), model.NewId(), []string{"user@example.com"})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		resp, err := th.Client.InviteUsersToTeam(context.Background(), th.BasicTeam.Id, []string{"user@example.com"})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetTeamUnreadErrorPaths tests error handling in getTeamUnread
func TestGetTeamUnreadErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamUnread(context.Background(), "invalid", th.BasicUser.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetTeamUnread(context.Background(), th.BasicTeam.Id, "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get unread for other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		_, resp, err := th.Client.GetTeamUnread(context.Background(), th.BasicTeam.Id, otherUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get unread from team user is not in", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		_, resp, err := th.Client.GetTeamUnread(context.Background(), otherTeam.Id, th.BasicUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetTeamUnread(context.Background(), th.BasicTeam.Id, th.BasicUser.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUpdateTeamPrivacyErrorPaths tests error conditions in updateTeamPrivacy
func TestUpdateTeamPrivacyErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("regular user cannot update team privacy", func(t *testing.T) {
		privacy := model.TeamInvite
		_, resp, err := th.Client.UpdateTeamPrivacy(context.Background(), th.BasicTeam.Id, privacy)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("invalid team id", func(t *testing.T) {
			privacy := model.TeamInvite
			_, resp, err := client.UpdateTeamPrivacy(context.Background(), "invalid", privacy)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("non-existent team", func(t *testing.T) {
			privacy := model.TeamInvite
			_, resp, err := client.UpdateTeamPrivacy(context.Background(), model.NewId(), privacy)
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("invalid privacy value", func(t *testing.T) {
			_, resp, err := client.UpdateTeamPrivacy(context.Background(), th.BasicTeam.Id, "invalid")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		privacy := model.TeamInvite
		_, resp, err := th.Client.UpdateTeamPrivacy(context.Background(), th.BasicTeam.Id, privacy)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}
