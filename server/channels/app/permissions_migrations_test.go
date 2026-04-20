// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestRestoreManageOAuthPermissionMigration(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupWithStoreMock(t)

	migrationMap, err := th.App.getRestoreManageOAuthPermissionMigration()
	require.NoError(t, err)

	systemAdminRole := &model.Role{
		Name:        model.SystemAdminRoleId,
		Permissions: []string{model.PermissionManageSystemWideOAuth.Id},
	}
	systemUserRole := &model.Role{
		Name:        model.SystemUserRoleId,
		Permissions: []string{model.PermissionCreateDirectChannel.Id},
	}
	roles := []*model.Role{systemAdminRole, systemUserRole}

	mockStore := th.App.Srv().Store().(*mocks.Store)
	roleStore := mocks.RoleStore{}
	systemStore := mocks.SystemStore{}

	mockStore.On("Role").Return(&roleStore)
	mockStore.On("System").Return(&systemStore)

	systemStore.On("GetByName", model.MigrationKeyRestoreManageOAuthPermission).
		Return(nil, model.NewAppError("test", "missing", nil, "", 404)).Once()
	systemStore.On("GetByName", model.MigrationKeyRestoreManageOAuthPermission).
		Return(&model.System{Name: model.MigrationKeyRestoreManageOAuthPermission, Value: "true"}, nil).Once()
	systemStore.On("SaveOrUpdate", mock.MatchedBy(func(system *model.System) bool {
		return system.Name == model.MigrationKeyRestoreManageOAuthPermission && system.Value == "true"
	})).Return(nil).Once()

	roleStore.On("Save", mock.AnythingOfType("*model.Role")).
		Return(func(role *model.Role) *model.Role { return role }, nil).Twice()

	appErr := th.App.Srv().doPermissionsMigration(model.MigrationKeyRestoreManageOAuthPermission, migrationMap, roles)
	require.Nil(t, appErr)
	assert.Contains(t, systemAdminRole.Permissions, model.PermissionManageOAuth.Id)
	assert.NotContains(t, systemUserRole.Permissions, model.PermissionManageOAuth.Id)
	assert.Len(t, systemAdminRole.Permissions, 2)

	appErr = th.App.Srv().doPermissionsMigration(model.MigrationKeyRestoreManageOAuthPermission, migrationMap, roles)
	require.Nil(t, appErr)
	assert.Len(t, systemAdminRole.Permissions, 2)

	roleStore.AssertNumberOfCalls(t, "Save", 2)
	systemStore.AssertNumberOfCalls(t, "SaveOrUpdate", 1)
}

func TestAddManageAgentPermissionsMigration(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupWithStoreMock(t)

	migrationMap, err := th.App.getAddManageAgentPermissionsMigration()
	require.NoError(t, err)

	systemAdminRole := &model.Role{
		Name:        model.SystemAdminRoleId,
		Permissions: []string{model.PermissionManageSystem.Id},
	}
	systemUserRole := &model.Role{
		Name:        model.SystemUserRoleId,
		Permissions: []string{model.PermissionCreateDirectChannel.Id},
	}
	roles := []*model.Role{systemAdminRole, systemUserRole}

	mockStore := th.App.Srv().Store().(*mocks.Store)
	roleStore := mocks.RoleStore{}
	systemStore := mocks.SystemStore{}

	mockStore.On("Role").Return(&roleStore)
	mockStore.On("System").Return(&systemStore)

	systemStore.On("GetByName", model.MigrationKeyAddManageAgentPermissions).
		Return(nil, model.NewAppError("test", "missing", nil, "", 404)).Once()
	systemStore.On("GetByName", model.MigrationKeyAddManageAgentPermissions).
		Return(&model.System{Name: model.MigrationKeyAddManageAgentPermissions, Value: "true"}, nil).Once()
	systemStore.On("SaveOrUpdate", mock.MatchedBy(func(system *model.System) bool {
		return system.Name == model.MigrationKeyAddManageAgentPermissions && system.Value == "true"
	})).Return(nil).Once()

	roleStore.On("Save", mock.AnythingOfType("*model.Role")).
		Return(func(role *model.Role) *model.Role { return role }, nil).Twice()

	appErr := th.App.Srv().doPermissionsMigration(model.MigrationKeyAddManageAgentPermissions, migrationMap, roles)
	require.Nil(t, appErr)
	assert.Contains(t, systemAdminRole.Permissions, model.PermissionManageOwnAgent.Id)
	assert.Contains(t, systemAdminRole.Permissions, model.PermissionManageOthersAgent.Id)
	assert.Contains(t, systemUserRole.Permissions, model.PermissionManageOwnAgent.Id)
	assert.NotContains(t, systemUserRole.Permissions, model.PermissionManageOthersAgent.Id)
	assert.Len(t, systemAdminRole.Permissions, 3)
	assert.Len(t, systemUserRole.Permissions, 2)

	appErr = th.App.Srv().doPermissionsMigration(model.MigrationKeyAddManageAgentPermissions, migrationMap, roles)
	require.Nil(t, appErr)
	assert.Len(t, systemAdminRole.Permissions, 3, "system_admin should still have 3 permissions after idempotent run")
	assert.Len(t, systemUserRole.Permissions, 2, "system_user should still have 2 permissions after idempotent run")

	roleStore.AssertNumberOfCalls(t, "Save", 2)
	systemStore.AssertNumberOfCalls(t, "SaveOrUpdate", 1)
}

func TestApplyPermissionsMap(t *testing.T) {
	mainHelper.Parallel(t)
	tt := []struct {
		Name           string
		RoleMap        map[string]map[string]bool
		TranslationMap permissionsMap
		ExpectedResult []string
	}{
		{
			"Split existing",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{On: permissionExists("test2"), Add: []string{"test4", "test5"}}},
			[]string{"test1", "test2", "test3", "test4", "test5"},
		},
		{
			"Remove existing",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{On: permissionExists("test2"), Remove: []string{"test2"}}},
			[]string{"test1", "test3"},
		},
		{
			"Rename existing",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{On: permissionExists("test2"), Add: []string{"test5"}, Remove: []string{"test2"}}},
			[]string{"test1", "test3", "test5"},
		},
		{
			"Remove when other not exists",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{On: permissionNotExists("test5"), Remove: []string{"test2"}}},
			[]string{"test1", "test3"},
		},
		{
			"Add when at least one exists",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  permissionOr(permissionExists("test5"), permissionExists("test3")),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3", "test4"},
		},
		{
			"Add when all exists",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  permissionAnd(permissionExists("test1"), permissionExists("test2")),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3", "test4"},
		},
		{
			"Not add when one in the and not exists",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  permissionAnd(permissionExists("test1"), permissionExists("test5")),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3"},
		},
		{
			"Not Add when none on the or exists",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  permissionOr(permissionExists("test7"), permissionExists("test9")),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3"},
		},
		{
			"When the role matches",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  isExactRole("system_admin"),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3", "test4"},
		},
		{
			"When the role doesn't match",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  isExactRole("system_user"),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3"},
		},
		{
			"Remove a permission conditional on another role having it, success case",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test3": true,
				},
				"other_role": {
					"test4": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:     onOtherRole("other_role", permissionExists("test4")),
				Remove: []string{"test1"},
			}},
			[]string{"test2", "test3"},
		},
		{
			"Remove a permission conditional on another role having it, failure case",
			map[string]map[string]bool{
				"system_admin": {
					"test1": true,
					"test2": true,
					"test4": true,
				},
				"other_role": {
					"test1": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:     onOtherRole("other_role", permissionExists("test4")),
				Remove: []string{"test1"},
			}},
			[]string{"test1", "test2", "test4"},
		},
	}

	for _, tc := range tt {
		t.Run(tc.Name, func(t *testing.T) {
			result := applyPermissionsMap(&model.Role{Name: "system_admin"}, tc.RoleMap, tc.TranslationMap)
			assert.ElementsMatch(t, tc.ExpectedResult, result)
		})
	}
}

func TestApplyPermissionsMapToSchemeRole(t *testing.T) {
	mainHelper.Parallel(t)
	schemeRoleName := model.NewId()
	tt := []struct {
		Name           string
		RoleMap        map[string]map[string]bool
		TranslationMap permissionsMap
		ExpectedResult []string
	}{
		{
			"Adds a permission to a scheme role with a matching common name",
			map[string]map[string]bool{
				schemeRoleName: {
					"test1": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  isRole(model.TeamAdminRoleId),
				Add: []string{"test2"},
			}},
			[]string{"test1", "test2"},
		},
		{
			"Doesn't add a permission to a scheme role with a different common name",
			map[string]map[string]bool{
				schemeRoleName: {
					"test1": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  isRole(model.ChannelAdminRoleId),
				Add: []string{"test2"},
			}},
			[]string{"test1"},
		},
		{
			"Doesn't add a permission to a role with a the same exact name",
			map[string]map[string]bool{
				schemeRoleName: {
					"test1": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  isNotRole(schemeRoleName),
				Add: []string{"test2"},
			}},
			[]string{"test1"},
		},
		{
			"Doesn't add a permission to a role with a different exact name but the same common name",
			map[string]map[string]bool{
				schemeRoleName: {
					"test1": true,
				},
			},
			permissionsMap{permissionTransformation{
				On:  isNotRole(model.TeamAdminRoleId),
				Add: []string{"test2"},
			}},
			[]string{"test1"},
		},
	}

	for _, tc := range tt {
		t.Run(tc.Name, func(t *testing.T) {
			result := applyPermissionsMap(&model.Role{Name: schemeRoleName, DisplayName: sqlstore.SchemeRoleDisplayNameTeamAdmin}, tc.RoleMap, tc.TranslationMap)
			assert.ElementsMatch(t, tc.ExpectedResult, result)
		})
	}
}
