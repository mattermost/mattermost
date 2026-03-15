// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/csv"
	"errors"
	"io"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
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
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
	testPermissionInheritance(t, func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData) {
		actualRole, err := th.App.GetRoleByName(th.Context, testData.channelRole.Name)
		require.Nil(t, err)
		require.NotNil(t, actualRole)
		require.Equal(t, testData.channelRole.Name, actualRole.Name)
		require.Equal(t, testData.shouldHavePermission, slices.Contains(actualRole.Permissions, testData.permission.Id), "row: %+v", testData.truthTableRow)
	})
}

func TestGetRoleByID(t *testing.T) {
	mainHelper.Parallel(t)
	testPermissionInheritance(t, func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData) {
		actualRole, err := th.App.GetRole(testData.channelRole.Id)
		require.Nil(t, err)
		require.NotNil(t, actualRole)
		require.Equal(t, testData.channelRole.Id, actualRole.Id)
		require.Equal(t, testData.shouldHavePermission, slices.Contains(actualRole.Permissions, testData.permission.Id), "row: %+v", testData.truthTableRow)
	})
}

func TestGetAllRoles(t *testing.T) {
	mainHelper.Parallel(t)
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
	th := Setup(t).InitBasic(t)

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

	team := th.CreateTeam(t)
	defer func() {
		appErr = th.App.PermanentDeleteTeamId(th.Context, team.Id)
		require.Nil(t, appErr)
	}()

	// Make a channel
	channel := th.CreateChannel(t, team)
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
				higherScopedRole, testErr := th.App.GetRoleByName(th.Context, roleNameUnderTest)
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
				channelRole, testErr := th.App.GetRoleByName(th.Context, channelRoleName)
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

func TestSendUpdatedRoleEvent(t *testing.T) {
	t.Run("BuiltIn role broadcasts globally without a DB lookup", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.TeamAdminRoleId, BuiltIn: true}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.Nil(t, appErr)
		mockSchemeStore.AssertNotCalled(t, "Get", mock.Anything)
	})

	t.Run("Team scheme role calls GetTeamsByScheme and emits per-team events", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		schemeID := model.NewId()
		roleName := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Scope: model.SchemeScopeTeam}
		teams := []*model.Team{{Id: model.NewId()}, {Id: model.NewId()}}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockTeamStore := mocks.TeamStore{}
		mockSchemeStore.On("Get", schemeID).Return(scheme, nil)
		mockTeamStore.On("GetTeamsByScheme", schemeID, 0, 1000).Return(teams, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Team").Return(&mockTeamStore)

		role := &model.Role{Name: roleName, BuiltIn: false, SchemeId: &schemeID}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.Nil(t, appErr)
		mockSchemeStore.AssertCalled(t, "Get", schemeID)
		mockTeamStore.AssertCalled(t, "GetTeamsByScheme", schemeID, 0, 1000)
	})

	t.Run("Channel scheme role calls GetChannelsByScheme and emits per-channel events", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		schemeID := model.NewId()
		roleName := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Scope: model.SchemeScopeChannel}
		channels := model.ChannelList{{Id: model.NewId()}}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockChannelStore := mocks.ChannelStore{}
		mockSchemeStore.On("Get", schemeID).Return(scheme, nil)
		mockChannelStore.On("GetChannelsByScheme", schemeID, 0, 1000).Return(channels, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: roleName, BuiltIn: false, SchemeId: &schemeID}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.Nil(t, appErr)
		mockSchemeStore.AssertCalled(t, "Get", schemeID)
		mockChannelStore.AssertCalled(t, "GetChannelsByScheme", schemeID, 0, 1000)
	})

	t.Run("Role not in any scheme broadcasts globally", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockTeamStore := mocks.TeamStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Team").Return(&mockTeamStore)

		role := &model.Role{Name: model.NewId(), BuiltIn: false, SchemeId: nil}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.Nil(t, appErr)
		mockSchemeStore.AssertNotCalled(t, "Get", mock.Anything)
		mockTeamStore.AssertNotCalled(t, "GetTeamsByScheme", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("Playbook scope falls back to global broadcast without querying teams or channels", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		schemeID := model.NewId()
		roleName := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Scope: model.SchemeScopePlaybook}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockTeamStore := mocks.TeamStore{}
		mockChannelStore := mocks.ChannelStore{}
		mockSchemeStore.On("Get", schemeID).Return(scheme, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Team").Return(&mockTeamStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: roleName, BuiltIn: false, SchemeId: &schemeID}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.Nil(t, appErr)
		mockTeamStore.AssertNotCalled(t, "GetTeamsByScheme", mock.Anything, mock.Anything, mock.Anything)
		mockChannelStore.AssertNotCalled(t, "GetChannelsByScheme", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("Scheme store error is logged and skips broadcast", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		schemeID := model.NewId()
		roleName := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(nil, errors.New("db error"))
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: roleName, BuiltIn: false, SchemeId: &schemeID}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.Nil(t, appErr)
	})

	t.Run("GetTeamsByScheme store error propagates as AppError", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		schemeID := model.NewId()
		roleName := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Scope: model.SchemeScopeTeam}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockTeamStore := mocks.TeamStore{}
		mockSchemeStore.On("Get", schemeID).Return(scheme, nil)
		mockTeamStore.On("GetTeamsByScheme", schemeID, 0, 1000).Return(nil, errors.New("db error"))
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Team").Return(&mockTeamStore)

		role := &model.Role{Name: roleName, BuiltIn: false, SchemeId: &schemeID}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.NotNil(t, appErr)
	})

	t.Run("Team scheme paginates across multiple pages", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		schemeID := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Scope: model.SchemeScopeTeam}

		// Build a full first page (1000 teams) and a partial second page (2 teams).
		page1 := make([]*model.Team, 1000)
		for i := range page1 {
			page1[i] = &model.Team{Id: model.NewId()}
		}
		page2 := []*model.Team{{Id: model.NewId()}, {Id: model.NewId()}}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockTeamStore := mocks.TeamStore{}
		mockSchemeStore.On("Get", schemeID).Return(scheme, nil)
		mockTeamStore.On("GetTeamsByScheme", schemeID, 0, 1000).Return(page1, nil)
		mockTeamStore.On("GetTeamsByScheme", schemeID, 1000, 1000).Return(page2, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Team").Return(&mockTeamStore)

		role := &model.Role{Name: model.NewId(), BuiltIn: false, SchemeId: &schemeID}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.Nil(t, appErr)
		mockTeamStore.AssertCalled(t, "GetTeamsByScheme", schemeID, 0, 1000)
		mockTeamStore.AssertCalled(t, "GetTeamsByScheme", schemeID, 1000, 1000)
	})

	t.Run("Channel scheme paginates across multiple pages", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		schemeID := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Scope: model.SchemeScopeChannel}

		page1 := make(model.ChannelList, 1000)
		for i := range page1 {
			page1[i] = &model.Channel{Id: model.NewId()}
		}
		page2 := model.ChannelList{{Id: model.NewId()}, {Id: model.NewId()}, {Id: model.NewId()}}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockChannelStore := mocks.ChannelStore{}
		mockSchemeStore.On("Get", schemeID).Return(scheme, nil)
		mockChannelStore.On("GetChannelsByScheme", schemeID, 0, 1000).Return(page1, nil)
		mockChannelStore.On("GetChannelsByScheme", schemeID, 1000, 1000).Return(page2, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: model.NewId(), BuiltIn: false, SchemeId: &schemeID}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.Nil(t, appErr)
		mockChannelStore.AssertCalled(t, "GetChannelsByScheme", schemeID, 0, 1000)
		mockChannelStore.AssertCalled(t, "GetChannelsByScheme", schemeID, 1000, 1000)
	})

	t.Run("GetChannelsByScheme store error propagates as AppError", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		schemeID := model.NewId()
		roleName := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Scope: model.SchemeScopeChannel}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockChannelStore := mocks.ChannelStore{}
		mockSchemeStore.On("Get", schemeID).Return(scheme, nil)
		mockChannelStore.On("GetChannelsByScheme", schemeID, 0, 1000).Return(nil, errors.New("db error"))
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: roleName, BuiltIn: false, SchemeId: &schemeID}
		appErr := th.App.sendUpdatedRoleEvent(role)
		require.NotNil(t, appErr)
	})
}
