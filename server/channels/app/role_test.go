// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/csv"
	"io"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type permissionInheritanceTestData struct {
	channelRole          *model.Role
	permission           *model.Permission
	shouldHavePermission bool
	channel              *model.Channel
	higherScopedRole     *model.Role
	truthTableRow        []string
}

func TestGetRolesByNames(t *testing.T) {
	testPermissionInheritance(t, func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData) {
		actualRoles, err := th.App.GetRolesByNames([]string{testData.channelRole.Name})
		require.Nil(t, err)
		require.Len(t, actualRoles, 1)

		actualRole := actualRoles[0]
		require.NotNil(t, actualRole)
		require.Equal(t, testData.channelRole.Name, actualRole.Name)

		require.Equal(t, testData.shouldHavePermission, slices.Contains(actualRole.Permissions, testData.permission.Id))
	})
}

func TestGetRoleByName(t *testing.T) {
	testPermissionInheritance(t, func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData) {
		actualRole, err := th.App.GetRoleByName(context.Background(), testData.channelRole.Name)
		require.Nil(t, err)
		require.NotNil(t, actualRole)
		require.Equal(t, testData.channelRole.Name, actualRole.Name)
		require.Equal(t, testData.shouldHavePermission, slices.Contains(actualRole.Permissions, testData.permission.Id), "row: %+v", testData.truthTableRow)
	})
}

func TestGetRoleByID(t *testing.T) {
	testPermissionInheritance(t, func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData) {
		actualRole, err := th.App.GetRole(testData.channelRole.Id)
		require.Nil(t, err)
		require.NotNil(t, actualRole)
		require.Equal(t, testData.channelRole.Id, actualRole.Id)
		require.Equal(t, testData.shouldHavePermission, slices.Contains(actualRole.Permissions, testData.permission.Id), "row: %+v", testData.truthTableRow)
	})
}

func TestGetAllRoles(t *testing.T) {
	testPermissionInheritance(t, func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData) {
		actualRoles, err := th.App.GetAllRoles()
		require.Nil(t, err)
		for _, actualRole := range actualRoles {
			if actualRole.Id == testData.channelRole.Id {
				require.NotNil(t, actualRole)
				require.Equal(t, testData.channelRole.Id, actualRole.Id)
				require.Equal(t, testData.shouldHavePermission, slices.Contains(actualRole.Permissions, testData.permission.Id), "row: %+v", testData.truthTableRow)
			}
		}
	})
}

// testPermissionInheritance tests 48 combinations of scheme, permission, role data.
func testPermissionInheritance(t *testing.T, testCallback func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData)) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense(""))
	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	permissionsDefault := []string{
		model.PermissionManageChannelRoles.Id,
		model.PermissionManagePublicChannelMembers.Id,
	}

	// Defer resetting the system scheme permissions
	systemSchemeRoles, appErr := th.App.GetRolesByNames([]string{
		model.ChannelGuestRoleId,
		model.ChannelUserRoleId,
		model.ChannelAdminRoleId,
	})
	require.Nil(t, appErr)
	require.Len(t, systemSchemeRoles, 3)

	// defer resetting the system role permissions
	for _, systemRole := range systemSchemeRoles {
		defer func() {
			_, appErr = th.App.PatchRole(systemRole, &model.RolePatch{
				Permissions: &systemRole.Permissions,
			})
			require.Nil(t, appErr)
		}()
	}

	// Make a channel scheme, clear its permissions
	channelScheme, appErr := th.App.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	})
	require.Nil(t, appErr)
	defer func() {
		_, appErr = th.App.DeleteScheme(channelScheme.Id)
		require.Nil(t, appErr)
	}()

	team := th.CreateTeam()
	defer func() {
		appErr = th.App.PermanentDeleteTeamId(th.Context, team.Id)
		require.Nil(t, appErr)
	}()

	// Make a channel
	channel := th.CreateChannel(th.Context, team)
	defer func() {
		appErr = th.App.PermanentDeleteChannel(th.Context, channel)
		require.Nil(t, appErr)
	}()

	// Set the channel scheme
	channel.SchemeId = &channelScheme.Id
	channel, appErr = th.App.UpdateChannelScheme(th.Context, channel)
	require.Nil(t, appErr)

	// Get the truth table from CSV
	file, e := os.Open("tests/channel-role-has-permission.csv")
	require.NoError(t, e)
	defer file.Close()

	b, e := io.ReadAll(file)
	require.NoError(t, e)

	r := csv.NewReader(strings.NewReader(string(b)))
	records, e := r.ReadAll()
	require.NoError(t, e)

	test := func(higherScopedGuest, higherScopedUser, higherScopedAdmin string) {
		for _, roleNameUnderTest := range []string{higherScopedGuest, higherScopedUser, higherScopedAdmin} {
			for i, row := range records {
				// skip csv header
				if i == 0 {
					continue
				}

				higherSchemeHasPermission, e := strconv.ParseBool(row[0])
				require.NoError(t, e)

				permissionIsModerated, e := strconv.ParseBool(row[1])
				require.NoError(t, e)

				channelSchemeHasPermission, e := strconv.ParseBool(row[2])
				require.NoError(t, e)

				channelRoleIsChannelAdmin, e := strconv.ParseBool(row[3])
				require.NoError(t, e)

				shouldHavePermission, e := strconv.ParseBool(row[4])
				require.NoError(t, e)

				// skip some invalid combinations because of the outer loop iterating all 3 channel roles
				if (channelRoleIsChannelAdmin && roleNameUnderTest != higherScopedAdmin) || (!channelRoleIsChannelAdmin && roleNameUnderTest == higherScopedAdmin) {
					continue
				}

				// select the permission to test (moderated or non-moderated)
				var permission *model.Permission
				if permissionIsModerated {
					permission = model.PermissionCreatePost // moderated
				} else {
					permission = model.PermissionReadChannel // non-moderated
				}

				// add or remove the permission from the higher-scoped scheme
				higherScopedRole, testErr := th.App.GetRoleByName(context.Background(), roleNameUnderTest)
				require.Nil(t, testErr)

				var higherScopedPermissions []string
				if higherSchemeHasPermission {
					higherScopedPermissions = []string{permission.Id}
				} else {
					higherScopedPermissions = permissionsDefault
				}
				higherScopedRole, testErr = th.App.PatchRole(higherScopedRole, &model.RolePatch{Permissions: &higherScopedPermissions})
				require.Nil(t, testErr)

				// get channel role
				var channelRoleName string
				switch roleNameUnderTest {
				case higherScopedGuest:
					channelRoleName = channelScheme.DefaultChannelGuestRole
				case higherScopedUser:
					channelRoleName = channelScheme.DefaultChannelUserRole
				case higherScopedAdmin:
					channelRoleName = channelScheme.DefaultChannelAdminRole
				}
				channelRole, testErr := th.App.GetRoleByName(context.Background(), channelRoleName)
				require.Nil(t, testErr)

				// add or remove the permission from the channel scheme
				var channelSchemePermissions []string
				if channelSchemeHasPermission {
					channelSchemePermissions = []string{permission.Id}
				} else {
					channelSchemePermissions = permissionsDefault
				}
				channelRole, testErr = th.App.PatchRole(channelRole, &model.RolePatch{Permissions: &channelSchemePermissions})
				require.Nil(t, testErr)

				testCallback(t, th, permissionInheritanceTestData{
					channelRole:          channelRole,
					permission:           permission,
					shouldHavePermission: shouldHavePermission,
					channel:              channel,
					higherScopedRole:     higherScopedRole,
					truthTableRow:        row,
				})
			}
		}
	}

	// test 24 combinations where the higher-scoped scheme is the SYSTEM scheme
	test(model.ChannelGuestRoleId, model.ChannelUserRoleId, model.ChannelAdminRoleId)

	// create a team scheme
	teamScheme, appErr := th.App.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	})
	require.Nil(t, appErr)
	defer func() {
		_, appErr = th.App.DeleteScheme(teamScheme.Id)
		require.Nil(t, appErr)
	}()

	// assign the scheme to the team
	team.SchemeId = &teamScheme.Id
	_, appErr = th.App.UpdateTeamScheme(team)
	require.Nil(t, appErr)

	// test 24 combinations where the higher-scoped scheme is a TEAM scheme
	test(teamScheme.DefaultChannelGuestRole, teamScheme.DefaultChannelUserRole, teamScheme.DefaultChannelAdminRole)
}
