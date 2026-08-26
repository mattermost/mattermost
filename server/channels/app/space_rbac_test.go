// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func setupSpaceRBACMock(t *testing.T) *TestHelper {
	return SetupWithStoreMock(t)
}

func permissionSet(ids []string) map[string]bool {
	set := make(map[string]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set
}

func getSeededSpaceScheme(t *testing.T, th *TestHelper, name string) *model.Scheme {
	t.Helper()
	scheme, err := th.App.Srv().Store().Scheme().GetByName(name)
	require.NoError(t, err)
	return scheme
}

func storedRolePermissionSet(t *testing.T, th *TestHelper, roleName string) map[string]bool {
	t.Helper()
	role, err := th.App.Srv().Store().Role().GetByName(th.Context, roleName)
	require.NoError(t, err)
	return permissionSet(role.Permissions)
}

func saveSpaceChannelWithScheme(t *testing.T, th *TestHelper, schemeID string) *model.Channel {
	t.Helper()
	space := &model.Channel{
		TeamId:      th.BasicTeam.Id,
		DisplayName: "Space",
		Name:        "space-" + model.NewId(),
		Type:        model.ChannelTypeSpace,
	}
	if schemeID != "" {
		space.SchemeId = &schemeID
	}
	space, err := th.App.Srv().Store().Channel().Save(th.Context, space, -1)
	require.NoError(t, err)
	return space
}

func saveSpaceChannelMember(t *testing.T, th *TestHelper, channelID, userID string, schemeAdmin, schemeGuest bool) {
	t.Helper()
	_, err := th.App.Srv().Store().Channel().SaveMember(th.Context, &model.ChannelMember{
		ChannelId:   channelID,
		UserId:      userID,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeUser:  !schemeGuest,
		SchemeAdmin: schemeAdmin,
		SchemeGuest: schemeGuest,
	})
	require.NoError(t, err)
	th.App.Srv().Store().Channel().InvalidateAllChannelMembersForUser(userID)
}

func TestCheckSpacePermissionScope(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	t.Run("ordinary role is unchanged", func(t *testing.T) {
		role := &model.Role{Name: model.NewId(), Permissions: []string{model.PermissionCreatePost.Id}}
		require.Nil(t, th.App.checkSpacePermissionScope(role))
	})

	t.Run("space permission is rejected outside system admin", func(t *testing.T) {
		role := &model.Role{Name: model.SystemUserRoleId, Permissions: []string{model.PermissionReadPage.Id}}
		appErr := th.App.checkSpacePermissionScope(role)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("system admin may carry space permissions", func(t *testing.T) {
		role := &model.Role{Name: model.SystemAdminRoleId, Permissions: model.PermissionIDs(model.SpaceChannelScopedPermissions)}
		require.Nil(t, th.App.checkSpacePermissionScope(role))
	})

	t.Run("capability role is immutable", func(t *testing.T) {
		role := &model.Role{
			Name:        model.SpacePageCommenterRoleId,
			Permissions: model.PermissionIDs(model.SpaceCapabilityRolePermissions[model.SpacePageCommenterRoleId]),
		}
		appErr := th.App.checkSpacePermissionScope(role)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_capability_role.app_error", appErr.Id)
	})

	t.Run("a no-op patch remains a no-op", func(t *testing.T) {
		permissions := model.PermissionIDs(model.SpaceCapabilityRolePermissions[model.SpacePageCommenterRoleId])
		role := &model.Role{Name: model.SpacePageCommenterRoleId, Permissions: permissions}
		got, appErr := th.App.PatchRole(role, &model.RolePatch{Permissions: &permissions})
		require.Nil(t, appErr)
		assert.Same(t, role, got)
	})
}

func TestCreateRoleSpacePermissionGuard(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockRoleStore := mocks.RoleStore{}
	mockStore.On("Role").Return(&mockRoleStore)

	_, appErr := th.App.CreateRole(&model.Role{
		Name:        model.NewId(),
		DisplayName: "custom",
		Permissions: []string{model.PermissionEditPage.Id},
	})
	require.NotNil(t, appErr)
	assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
	mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
}

func TestSpaceSchemeAssignmentPolicy(t *testing.T) {
	t.Run("ordinary channels retain existing scheme behavior", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		schemeID := model.NewId()
		require.Nil(t, th.App.checkChannelSchemeAssignment("CreateChannel", model.ChannelTypeOpen, &schemeID))
	})

	t.Run("space with no scheme is accepted", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.Nil(t, th.App.checkSchemeAssignmentToSpace("CreateChannel", nil))
	})

	for _, tc := range []struct {
		name     string
		scheme   *model.Scheme
		accepted bool
	}{
		{
			name: "seeded preset",
			scheme: &model.Scheme{
				Id: model.NewId(), Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel,
			},
			accepted: true,
		},
		{
			name: "plugin pool scheme",
			scheme: &model.Scheme{
				Id: model.NewId(), Name: model.PluginChannelSchemeName("com.example.plugin", []string{model.PermissionReadPage.Id}, nil, nil), Scope: model.SchemeScopeChannel,
			},
			accepted: true,
		},
		{
			name:     "ordinary custom scheme",
			scheme:   &model.Scheme{Id: model.NewId(), Name: model.NewId(), Scope: model.SchemeScopeChannel},
			accepted: false,
		},
		{
			name: "deleted plugin pool scheme",
			scheme: &model.Scheme{
				Id: model.NewId(), Name: model.PluginChannelSchemeName("com.example.plugin", nil, nil, nil), Scope: model.SchemeScopeChannel, DeleteAt: model.GetMillis(),
			},
			accepted: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mainHelper.Parallel(t)
			th := setupSpaceRBACMock(t)
			mockStore := th.App.Srv().Store().(*mocks.Store)
			mockSchemeStore := mocks.SchemeStore{}
			mockSchemeStore.On("GetFromMaster", tc.scheme.Id).Return(tc.scheme, nil)
			mockStore.On("Scheme").Return(&mockSchemeStore)

			appErr := th.App.checkSchemeAssignmentToSpace("CreateChannel", &tc.scheme.Id)
			if tc.accepted {
				require.Nil(t, appErr)
			} else {
				require.NotNil(t, appErr)
				assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
			}
		})
	}
}

func TestSpaceSchemeIdentityGuards(t *testing.T) {
	t.Run("reserved names cannot be created", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)

		for _, name := range model.SpaceSchemeNames {
			_, appErr := th.App.CreateScheme(&model.Scheme{Name: name, DisplayName: "x", Scope: model.SchemeScopeChannel})
			require.NotNil(t, appErr)
			assert.Equal(t, "app.scheme.save.space_scheme_name.app_error", appErr.Id)
		}
		pluginName := model.PluginChannelSchemeName("com.example.plugin", nil, nil, nil)
		_, appErr := th.App.CreateScheme(&model.Scheme{Name: pluginName, DisplayName: "x", Scope: model.SchemeScopeChannel})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.plugin_scheme_name.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
	})

	t.Run("preset and plugin schemes cannot be deleted", func(t *testing.T) {
		mainHelper.Parallel(t)
		for _, tc := range []struct {
			name    string
			errorID string
		}{
			{model.SchemeNameSpaceContribute, "app.scheme.delete.space_scheme.app_error"},
			{model.PluginChannelSchemeName("com.example.plugin", nil, nil, nil), "app.scheme.delete.plugin_scheme.app_error"},
		} {
			th := setupSpaceRBACMock(t)
			require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
			schemeID := model.NewId()
			mockStore := th.App.Srv().Store().(*mocks.Store)
			mockSchemeStore := mocks.SchemeStore{}
			mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
				Id: schemeID, Name: tc.name, Scope: model.SchemeScopeChannel,
			}, nil)
			mockStore.On("Scheme").Return(&mockSchemeStore)

			_, appErr := th.App.DeleteScheme(schemeID)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.errorID, appErr.Id)
			mockSchemeStore.AssertNotCalled(t, "Delete", mock.Anything)
		}
	})

	t.Run("preset and plugin generated-role references cannot be changed", func(t *testing.T) {
		mainHelper.Parallel(t)
		for _, tc := range []struct {
			name    string
			errorID string
		}{
			{model.SchemeNameSpaceContribute, "app.scheme.save.space_scheme_roles.app_error"},
			{model.PluginChannelSchemeName("com.example.plugin", nil, nil, nil), "app.scheme.save.plugin_scheme_roles.app_error"},
		} {
			th := setupSpaceRBACMock(t)
			stored := &model.Scheme{
				Id:                      model.NewId(),
				Name:                    tc.name,
				Scope:                   model.SchemeScopeChannel,
				DefaultChannelAdminRole: model.NewId(),
				DefaultChannelUserRole:  model.NewId(),
				DefaultChannelGuestRole: model.NewId(),
			}
			updated := *stored
			updated.DefaultChannelUserRole = model.NewId()

			mockStore := th.App.Srv().Store().(*mocks.Store)
			mockSchemeStore := mocks.SchemeStore{}
			mockSchemeStore.On("Get", stored.Id).Return(stored, nil)
			mockStore.On("Scheme").Return(&mockSchemeStore)

			appErr := th.App.checkSpaceSchemeUpdate(&updated)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.errorID, appErr.Id)
		}
	})

	t.Run("ordinary scheme deletion is unchanged", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
		scheme := &model.Scheme{Id: model.NewId(), Name: model.NewId(), Scope: model.SchemeScopeChannel}
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", scheme.Id).Return(scheme, nil)
		mockSchemeStore.On("Delete", scheme.Id).Return(scheme, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		deleted, appErr := th.App.DeleteScheme(scheme.Id)
		require.Nil(t, appErr)
		assert.Equal(t, scheme.Id, deleted.Id)
	})
}

func TestSpaceSeedingMigrations(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	canonical := model.MakeDefaultRoles()
	for _, roleID := range model.SpaceCapabilityRoles {
		role, err := th.App.Srv().Store().Role().GetByName(th.Context, roleID)
		require.NoError(t, err)
		assert.ElementsMatch(t, canonical[roleID].Permissions, role.Permissions)
		assert.False(t, role.SchemeManaged)
		assert.True(t, role.BuiltIn)
	}

	presets := map[string][]*model.Permission{
		model.SchemeNameSpaceContribute: model.SpaceDefaultContributePermissions,
		model.SchemeNameSpaceComment:    model.SpaceDefaultCommentPermissions,
		model.SchemeNameSpaceReadOnly:   model.SpaceDefaultReadOnlyPermissions,
	}
	for name, userPermissions := range presets {
		scheme := getSeededSpaceScheme(t, th, name)
		assert.Equal(t, model.SchemeScopeChannel, scheme.Scope)
		assert.Equal(t, permissionSet(model.PermissionIDs(userPermissions)), storedRolePermissionSet(t, th, scheme.DefaultChannelUserRole))
		assert.Equal(t, permissionSet(model.PermissionIDs(model.SpaceAdminRolePermissions)), storedRolePermissionSet(t, th, scheme.DefaultChannelAdminRole))
		assert.Equal(t, permissionSet(model.PermissionIDs(model.SpaceDefaultReadOnlyPermissions)), storedRolePermissionSet(t, th, scheme.DefaultChannelGuestRole))
	}

	// Removing only the markers exercises exact-state adoption after the atomic
	// scheme transaction has already committed.
	_, err := th.App.Srv().Store().System().PermanentDeleteByName(SpaceRolesCreationMigrationKey)
	require.NoError(t, err)
	_, err = th.App.Srv().Store().System().PermanentDeleteByName(SpaceSchemesCreationMigrationKey)
	require.NoError(t, err)
	require.NoError(t, th.Server.doSpaceRolesCreationMigration())
	require.NoError(t, th.Server.doSpaceSchemesCreationMigration())
}

func TestSpacePresetResolutionThroughRealSpace(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	space := saveSpaceChannelWithScheme(t, th, contribute.Id)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, false)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser2.Id, true, false)

	has := func(userID string, permission *model.Permission) bool {
		ok, _ := th.App.HasPermissionToChannel(th.Context, userID, space.Id, permission)
		return ok
	}
	assert.True(t, has(th.BasicUser.Id, model.PermissionReadPage))
	assert.True(t, has(th.BasicUser.Id, model.PermissionEditPage))
	assert.False(t, has(th.BasicUser.Id, model.PermissionDeletePage))
	assert.True(t, has(th.BasicUser2.Id, model.PermissionDeletePage))
	assert.True(t, has(th.BasicUser2.Id, model.PermissionAdminSpace))
	assert.False(t, has(th.BasicUser.Id, model.PermissionCreatePost))
}

func TestSpaceDefaultSwitchImmediatelyEffective(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	readOnly := getSeededSpaceScheme(t, th, model.SchemeNameSpaceReadOnly)
	space := saveSpaceChannelWithScheme(t, th, contribute.Id)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, false)

	has, _ := th.App.HasPermissionToChannel(th.Context, th.BasicUser.Id, space.Id, model.PermissionEditPage)
	require.True(t, has)
	space.SchemeId = &readOnly.Id
	_, appErr := th.App.UpdateChannel(th.Context, space)
	require.Nil(t, appErr)
	has, _ = th.App.HasPermissionToChannel(th.Context, th.BasicUser.Id, space.Id, model.PermissionEditPage)
	assert.False(t, has)
}

func TestSpaceCapabilityRolesConfinedToTheirBackingChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	for _, roleName := range model.SpaceCapabilityRoles {
		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser.Id, model.ChannelUserRoleId+" "+roleName)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.channel.update_channel_member_roles.space_role.app_error", appErr.Id)

		_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.TeamUserRoleId+" "+roleName)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.team.update_team_member_roles.space_role.app_error", appErr.Id)

		_, appErr = th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+roleName, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.user.update_user_roles.space_role.app_error", appErr.Id)
	}

	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	space := saveSpaceChannelWithScheme(t, th, contribute.Id)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, false)
	member, appErr := th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser.Id,
		contribute.DefaultChannelUserRole+" "+model.SpacePageCreatorRoleId)
	require.Nil(t, appErr)
	assert.Equal(t, model.SpacePageCreatorRoleId, member.ExplicitRoles)
}

func TestImportSchemeRejectsReservedSchemeNames(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	names := append([]string{}, model.SpaceSchemeNames...)
	names = append(names, model.PluginChannelSchemeName("com.example.plugin", nil, nil, nil))
	for _, name := range names {
		data := &imports.SchemeImportData{
			Name:                    model.NewPointer(name),
			DisplayName:             model.NewPointer("Hijacked"),
			Scope:                   model.NewPointer(model.SchemeScopeChannel),
			DefaultChannelAdminRole: &imports.RoleImportData{Name: model.NewPointer(model.NewId()), DisplayName: model.NewPointer("a")},
			DefaultChannelUserRole:  &imports.RoleImportData{Name: model.NewPointer(model.NewId()), DisplayName: model.NewPointer("u")},
			DefaultChannelGuestRole: &imports.RoleImportData{Name: model.NewPointer(model.NewId()), DisplayName: model.NewPointer("g")},
		}
		appErr := th.App.importScheme(th.Context, data, true)
		require.NotNil(t, appErr)
	}
}

func TestValidateAdoptableSpaceSchemeRequiresExactAtomicState(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)
	schemeID := model.NewId()
	scheme := &model.Scheme{
		Id:                      schemeID,
		Name:                    model.SchemeNameSpaceContribute,
		Scope:                   model.SchemeScopeChannel,
		DefaultChannelUserRole:  "user",
		DefaultChannelAdminRole: "admin",
		DefaultChannelGuestRole: "guest",
	}
	user := model.PermissionIDs(model.SpaceDefaultContributePermissions)
	admin := model.PermissionIDs(model.SpaceAdminRolePermissions)
	guest := model.PermissionIDs(model.SpaceDefaultReadOnlyPermissions)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockRoleStore := mocks.RoleStore{}
	mockRoleStore.On("GetByNamesFromMaster", []string{"user", "admin", "guest"}).Return([]*model.Role{
		{Name: "user", Permissions: user, SchemeManaged: true, SchemeId: &schemeID},
		{Name: "admin", Permissions: admin, SchemeManaged: true, SchemeId: &schemeID},
		{Name: "guest", Permissions: guest, SchemeManaged: true, SchemeId: &schemeID},
	}, nil).Once()
	mockRoleStore.On("GetByNamesFromMaster", []string{"user", "admin", "guest"}).Return([]*model.Role{
		{Name: "user", Permissions: append(user, model.PermissionCreatePost.Id), SchemeManaged: true, SchemeId: &schemeID},
		{Name: "admin", Permissions: admin, SchemeManaged: true, SchemeId: &schemeID},
		{Name: "guest", Permissions: guest, SchemeManaged: true, SchemeId: &schemeID},
	}, nil).Once()
	mockStore.On("Role").Return(&mockRoleStore)

	require.NoError(t, th.Server.validateAdoptableSpaceScheme(scheme, user, admin, guest))
	require.Error(t, th.Server.validateAdoptableSpaceScheme(scheme, user, admin, guest))
}

func TestSpaceSchemeLookupErrorsFailClosed(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)
	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetFromMaster", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
	mockStore.On("Scheme").Return(&mockSchemeStore)

	appErr := th.App.checkSchemeAssignmentToSpace("CreateChannel", &schemeID)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
}
