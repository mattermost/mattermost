// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestAddWikiPagePermissionsMigration(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupWithStoreMock(t)

	migrationMap, err := th.App.getAddWikiPagePermissionsMigration()
	require.NoError(t, err)

	teamUserRole := &model.Role{
		Name:        model.TeamUserRoleId,
		Permissions: []string{model.PermissionViewTeam.Id},
	}
	teamAdminRole := &model.Role{
		Name:        model.TeamAdminRoleId,
		Permissions: []string{model.PermissionManageTeam.Id},
	}
	systemGuestRole := &model.Role{
		Name:        model.SystemGuestRoleId,
		Permissions: []string{},
	}
	systemAdminRole := &model.Role{
		Name:        model.SystemAdminRoleId,
		Permissions: []string{model.PermissionManageSystem.Id},
	}
	roles := []*model.Role{teamUserRole, teamAdminRole, systemGuestRole, systemAdminRole}

	mockStore := th.App.Srv().Store().(*mocks.Store)
	roleStore := mocks.RoleStore{}
	systemStore := mocks.SystemStore{}

	mockStore.On("Role").Return(&roleStore)
	mockStore.On("System").Return(&systemStore)

	systemStore.On("GetByName", model.MigrationKeyAddWikiPagePermissions).
		Return(nil, model.NewAppError("test", "missing", nil, "", 404)).Once()
	systemStore.On("GetByName", model.MigrationKeyAddWikiPagePermissions).
		Return(&model.System{Name: model.MigrationKeyAddWikiPagePermissions, Value: "true"}, nil).Once()
	systemStore.On("SaveOrUpdate", mock.MatchedBy(func(system *model.System) bool {
		return system.Name == model.MigrationKeyAddWikiPagePermissions && system.Value == "true"
	})).Return(nil).Once()

	roleStore.On("SavePreservingUnknownPermissions", mock.AnythingOfType("*model.Role")).
		Return(func(role *model.Role) *model.Role { return role }, nil).Times(len(roles))

	appErr := th.App.Srv().doPermissionsMigration(model.MigrationKeyAddWikiPagePermissions, migrationMap, roles)
	require.Nil(t, appErr)

	t.Run("team_user gets read/create + own-edit/own-delete + comment", func(t *testing.T) {
		assert.Contains(t, teamUserRole.Permissions, model.PermissionReadWiki.Id)
		assert.Contains(t, teamUserRole.Permissions, model.PermissionCreateWiki.Id)
		assert.Contains(t, teamUserRole.Permissions, model.PermissionReadPage.Id)
		assert.Contains(t, teamUserRole.Permissions, model.PermissionCreatePage.Id)
		assert.Contains(t, teamUserRole.Permissions, model.PermissionEditOwnPage.Id)
		assert.Contains(t, teamUserRole.Permissions, model.PermissionDeleteOwnPage.Id)
		assert.Contains(t, teamUserRole.Permissions, model.PermissionCommentPage.Id)

		// Should NOT receive management-tier perms.
		assert.NotContains(t, teamUserRole.Permissions, model.PermissionManageWiki.Id)
		assert.NotContains(t, teamUserRole.Permissions, model.PermissionDeleteWiki.Id)
		assert.NotContains(t, teamUserRole.Permissions, model.PermissionAdminWiki.Id)
		assert.NotContains(t, teamUserRole.Permissions, model.PermissionEditPage.Id)
		assert.NotContains(t, teamUserRole.Permissions, model.PermissionDeletePage.Id)
	})

	t.Run("team_admin gets full wiki/page management", func(t *testing.T) {
		expected := []string{
			model.PermissionReadWiki.Id,
			model.PermissionCreateWiki.Id,
			model.PermissionManageWiki.Id,
			model.PermissionDeleteWiki.Id,
			model.PermissionAdminWiki.Id,
			model.PermissionReadPage.Id,
			model.PermissionCreatePage.Id,
			model.PermissionEditPage.Id,
			model.PermissionEditOwnPage.Id,
			model.PermissionDeleteOwnPage.Id,
			model.PermissionDeletePage.Id,
			model.PermissionCommentPage.Id,
		}
		for _, p := range expected {
			assert.Contains(t, teamAdminRole.Permissions, p, "team_admin should have %s", p)
		}
	})

	t.Run("system_guest gets read + comment only", func(t *testing.T) {
		assert.Contains(t, systemGuestRole.Permissions, model.PermissionReadWiki.Id)
		assert.Contains(t, systemGuestRole.Permissions, model.PermissionReadPage.Id)
		assert.Contains(t, systemGuestRole.Permissions, model.PermissionCommentPage.Id)

		// Guests must NOT get create/edit/delete perms.
		excluded := []string{
			model.PermissionCreateWiki.Id,
			model.PermissionManageWiki.Id,
			model.PermissionDeleteWiki.Id,
			model.PermissionAdminWiki.Id,
			model.PermissionCreatePage.Id,
			model.PermissionEditPage.Id,
			model.PermissionEditOwnPage.Id,
			model.PermissionDeleteOwnPage.Id,
			model.PermissionDeletePage.Id,
		}
		for _, p := range excluded {
			assert.NotContains(t, systemGuestRole.Permissions, p, "system_guest must NOT have %s", p)
		}
	})

	t.Run("system_admin gets all wiki/page perms", func(t *testing.T) {
		expected := []string{
			model.PermissionReadWiki.Id,
			model.PermissionCreateWiki.Id,
			model.PermissionManageWiki.Id,
			model.PermissionDeleteWiki.Id,
			model.PermissionAdminWiki.Id,
			model.PermissionReadPage.Id,
			model.PermissionCreatePage.Id,
			model.PermissionEditPage.Id,
			model.PermissionEditOwnPage.Id,
			model.PermissionDeleteOwnPage.Id,
			model.PermissionDeletePage.Id,
			model.PermissionCommentPage.Id,
		}
		for _, p := range expected {
			assert.Contains(t, systemAdminRole.Permissions, p, "system_admin should have %s", p)
		}
	})

	t.Run("re-running is idempotent", func(t *testing.T) {
		teamUserBefore := len(teamUserRole.Permissions)
		teamAdminBefore := len(teamAdminRole.Permissions)
		systemGuestBefore := len(systemGuestRole.Permissions)
		systemAdminBefore := len(systemAdminRole.Permissions)

		appErr = th.App.Srv().doPermissionsMigration(model.MigrationKeyAddWikiPagePermissions, migrationMap, roles)
		require.Nil(t, appErr)

		assert.Equal(t, teamUserBefore, len(teamUserRole.Permissions))
		assert.Equal(t, teamAdminBefore, len(teamAdminRole.Permissions))
		assert.Equal(t, systemGuestBefore, len(systemGuestRole.Permissions))
		assert.Equal(t, systemAdminBefore, len(systemAdminRole.Permissions))
	})

	roleStore.AssertNumberOfCalls(t, "SavePreservingUnknownPermissions", len(roles))
	systemStore.AssertNumberOfCalls(t, "SaveOrUpdate", 1)
}
