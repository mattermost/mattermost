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

func attachSpacePresetScheme(t *testing.T, th *TestHelper, channel *model.Channel) {
	t.Helper()
	scheme := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	channel.SchemeId = &scheme.Id
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
		require.Nil(t, th.App.checkSpacePermissionScope("CreateRole", role))
	})

	t.Run("space permission is rejected outside system admin", func(t *testing.T) {
		role := &model.Role{Name: model.SystemUserRoleId, Permissions: []string{model.PermissionReadPage.Id}}
		appErr := th.App.checkSpacePermissionScope("CreateRole", role)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("system admin may carry space permissions", func(t *testing.T) {
		role := &model.Role{Name: model.SystemAdminRoleId, Permissions: model.PermissionIDs(model.SpaceChannelScopedPermissions)}
		require.Nil(t, th.App.checkSpacePermissionScope("CreateRole", role))
	})

	t.Run("capability role is immutable", func(t *testing.T) {
		role := &model.Role{
			Name:        model.SpacePageCommenterRoleId,
			Permissions: model.PermissionIDs(model.SpaceCapabilityRolePermissions[model.SpacePageCommenterRoleId]),
		}
		appErr := th.App.checkSpacePermissionScope("CreateRole", role)
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

// Generated roles are definitions shared by every channel on their scheme. They are changed by
// selecting another preset or resolving another plugin scheme, never by editing the shared row.
// Exercise both public application write paths against all three role classes and both generated
// scheme families; checking the store afterward makes the rejection, not merely its error, the
// invariant under test.
func TestGeneratedSpaceSchemeRolesAreImmutable(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	pluginScheme, appErr := th.App.GetOrCreatePluginChannelScheme(
		testPluginID+"."+model.NewId(),
		[]string{model.PermissionReadPage.Id},
		[]string{model.PermissionAdminSpace.Id},
		[]string{model.PermissionReadPage.Id},
	)
	require.Nil(t, appErr)
	presetScheme := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)

	for _, schemeCase := range []struct {
		name    string
		scheme  *model.Scheme
		errorID string
	}{
		{name: "plugin pool", scheme: pluginScheme, errorID: "app.role.save.plugin_scheme_role.app_error"},
		{name: "space preset", scheme: presetScheme, errorID: "app.role.save.space_preset_role.app_error"},
	} {
		for _, roleCase := range []struct {
			name     string
			roleName string
		}{
			{name: "guest", roleName: schemeCase.scheme.DefaultChannelGuestRole},
			{name: "user", roleName: schemeCase.scheme.DefaultChannelUserRole},
			{name: "admin", roleName: schemeCase.scheme.DefaultChannelAdminRole},
		} {
			t.Run(schemeCase.name+"/"+roleCase.name, func(t *testing.T) {
				role, err := th.App.Srv().Store().Role().GetByName(th.Context, roleCase.roleName)
				require.NoError(t, err)
				original := append([]string(nil), role.Permissions...)
				require.NotContains(t, original, model.PermissionCreatePost.Id)
				changed := append(append([]string(nil), original...), model.PermissionCreatePost.Id)

				_, appErr := th.App.PatchRole(role, &model.RolePatch{Permissions: &changed})
				require.NotNil(t, appErr)
				assert.Equal(t, schemeCase.errorID, appErr.Id)

				stored, err := th.App.Srv().Store().Role().GetByName(th.Context, roleCase.roleName)
				require.NoError(t, err)
				assert.ElementsMatch(t, original, stored.Permissions)

				stored.Permissions = changed
				_, appErr = th.App.UpdateRole(stored)
				require.NotNil(t, appErr)
				assert.Equal(t, schemeCase.errorID, appErr.Id)

				stored, err = th.App.Srv().Store().Role().GetByName(th.Context, roleCase.roleName)
				require.NoError(t, err)
				assert.ElementsMatch(t, original, stored.Permissions)
			})
		}
	}
}

func TestSpaceSchemeAssignmentPolicy(t *testing.T) {
	t.Run("ordinary channel with no scheme is accepted", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.Nil(t, th.App.checkChannelSchemeAssignment("CreateChannel", model.ChannelTypeOpen, nil))
	})

	t.Run("space with no scheme is refused", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		appErr := th.App.checkSchemeAssignmentToSpace("CreateChannel", nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)

		empty := ""
		appErr = th.App.checkSchemeAssignmentToSpace("CreateChannel", &empty)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
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

	for _, tc := range []struct {
		name     string
		scheme   *model.Scheme
		accepted bool
	}{
		{
			name: "ordinary custom scheme on ordinary channel",
			scheme: &model.Scheme{
				Id: model.NewId(), Name: model.NewId(), Scope: model.SchemeScopeChannel,
			},
			accepted: true,
		},
		{
			name: "seeded preset on ordinary channel",
			scheme: &model.Scheme{
				Id: model.NewId(), Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel,
			},
		},
		{
			name: "plugin pool scheme on ordinary channel",
			scheme: &model.Scheme{
				Id: model.NewId(), Name: model.PluginChannelSchemeName("com.example.plugin", nil, nil, nil), Scope: model.SchemeScopeChannel,
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mainHelper.Parallel(t)
			th := setupSpaceRBACMock(t)
			mockStore := th.App.Srv().Store().(*mocks.Store)
			mockSchemeStore := mocks.SchemeStore{}
			// Both reserved kinds are classified from one primary read of the scheme.
			mockSchemeStore.On("GetFromMaster", tc.scheme.Id).Return(tc.scheme, nil).Once()
			mockStore.On("Scheme").Return(&mockSchemeStore)

			appErr := th.App.checkChannelSchemeAssignment("CreateChannel", model.ChannelTypeOpen, &tc.scheme.Id)
			if tc.accepted {
				require.Nil(t, appErr)
			} else {
				require.NotNil(t, appErr)
				assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_reserved.app_error", appErr.Id)
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
	require.NoError(t, th.Server.doSpaceRolesCreationMigration(th.Context))
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

// A guest reads a space and nothing more. Both refusals sit after the role loop, because
// SchemeGuest is only settled once the scheme-managed guest role has been seen, whatever order
// the caller listed the roles in.
func TestSpaceGuestMemberRoleRefusals(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	space := saveSpaceChannelWithScheme(t, th, contribute.Id)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, true)

	t.Run("a capability role is refused for a guest", func(t *testing.T) {
		for _, roles := range []string{
			contribute.DefaultChannelGuestRole + " " + model.SpacePageCreatorRoleId,
			model.SpacePageCreatorRoleId + " " + contribute.DefaultChannelGuestRole,
		} {
			_, appErr := th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser.Id, roles)
			require.NotNil(t, appErr, roles)
			assert.Equal(t, "api.channel.update_channel_member_roles.space_guest_role.app_error", appErr.Id)
		}
	})

	t.Run("a guest cannot be made a space admin", func(t *testing.T) {
		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser.Id,
			contribute.DefaultChannelGuestRole+" "+contribute.DefaultChannelAdminRole)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.channel.update_channel_member_roles.space_guest_admin.app_error", appErr.Id)
	})

	t.Run("the guest role alone is accepted", func(t *testing.T) {
		member, appErr := th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser.Id, contribute.DefaultChannelGuestRole)
		require.Nil(t, appErr)
		assert.True(t, member.SchemeGuest)
		assert.Empty(t, member.ExplicitRoles)
	})
}

// Renaming a reserved scheme away from its name would unfreeze its roles while every channel on
// it kept resolving them, so the rename is refused for presets and plugin pool schemes alike.
func TestSpaceSchemeRenameAwayRefused(t *testing.T) {
	mainHelper.Parallel(t)
	for _, tc := range []struct {
		name    string
		errorID string
	}{
		{model.SchemeNameSpaceContribute, "app.scheme.save.space_scheme_rename.app_error"},
		{model.PluginChannelSchemeName("com.example.plugin", nil, nil, nil), "app.scheme.save.plugin_scheme_rename.app_error"},
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
		renamed := *stored
		renamed.Name = model.NewId()

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", stored.Id).Return(stored, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		appErr := th.App.checkSpaceSchemeUpdate(&renamed)
		require.NotNil(t, appErr, tc.name)
		assert.Equal(t, tc.errorID, appErr.Id)

		// The operator-facing display name is not part of the identity and stays editable.
		relabelled := *stored
		relabelled.DisplayName = "Renamed for operators"
		require.Nil(t, th.App.checkSpaceSchemeUpdate(&relabelled))
	}
}

// Every refusal in validateAdoptableSpaceRole: a row found under a reserved capability role name
// is adopted only when it is the row the migration would have written.
func TestValidateAdoptableSpaceRoleRefusals(t *testing.T) {
	mainHelper.Parallel(t)
	want := model.MakeDefaultRoles()[model.SpacePageCreatorRoleId]
	sameRole := func() *model.Role {
		return &model.Role{Name: want.Name, Permissions: append([]string{}, want.Permissions...)}
	}
	schemeID := model.NewId()

	for _, tc := range []struct {
		name   string
		mutate func(*model.Role)
		reason string
	}{
		{"deleted", func(r *model.Role) { r.DeleteAt = 1 }, "is deleted"},
		{"scheme-managed", func(r *model.Role) { r.SchemeManaged = true }, "scheme-managed"},
		{"owned by a scheme", func(r *model.Role) { r.SchemeId = &schemeID }, "owned by scheme"},
		{"different permissions", func(r *model.Role) { r.Permissions = append(r.Permissions, model.PermissionAdminSpace.Id) }, "different permission set"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			stored := sameRole()
			tc.mutate(stored)
			err := validateAdoptableSpaceRole(want.Name, stored, want)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.reason)
			assert.Contains(t, err.Error(), want.Name)
		})
	}

	t.Run("the migration's own row is adopted", func(t *testing.T) {
		stored := sameRole()
		stored.Permissions = []string{stored.Permissions[1], stored.Permissions[0]}
		require.NoError(t, validateAdoptableSpaceRole(want.Name, stored, want))
	})
}

// Every refusal in validateAdoptableSpaceScheme beyond the permission mismatch the seeding test
// covers. The first four are decided from the scheme row alone; the rest need its generated roles.
func TestValidateAdoptableSpaceSchemeRefusals(t *testing.T) {
	mainHelper.Parallel(t)
	user := model.PermissionIDs(model.SpaceDefaultContributePermissions)
	admin := model.PermissionIDs(model.SpaceAdminRolePermissions)
	guest := model.PermissionIDs(model.SpaceDefaultReadOnlyPermissions)
	newScheme := func() *model.Scheme {
		return &model.Scheme{
			Id:                      model.NewId(),
			Name:                    model.SchemeNameSpaceContribute,
			Scope:                   model.SchemeScopeChannel,
			DefaultChannelUserRole:  "user",
			DefaultChannelAdminRole: "admin",
			DefaultChannelGuestRole: "guest",
		}
	}

	t.Run("decided from the scheme row", func(t *testing.T) {
		th := setupSpaceRBACMock(t)
		for _, tc := range []struct {
			name   string
			mutate func(*model.Scheme)
			reason string
		}{
			{"deleted", func(s *model.Scheme) { s.DeleteAt = 1 }, "is deleted"},
			{"wrong scope", func(s *model.Scheme) { s.Scope = model.SchemeScopeTeam }, "with scope"},
			{"missing a generated role", func(s *model.Scheme) { s.DefaultChannelGuestRole = "" }, "complete set of generated channel roles"},
			{"roles not distinct", func(s *model.Scheme) { s.DefaultChannelGuestRole = s.DefaultChannelUserRole }, "not distinct"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				scheme := newScheme()
				tc.mutate(scheme)
				err := th.Server.validateAdoptableSpaceScheme(scheme, user, admin, guest)
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.reason)
			})
		}
	})

	t.Run("decided from the generated roles", func(t *testing.T) {
		for _, tc := range []struct {
			name   string
			roles  func(schemeID string) []*model.Role
			reason string
		}{
			{"a role row is missing", func(schemeID string) []*model.Role {
				return []*model.Role{
					{Name: "user", Permissions: user, SchemeManaged: true, SchemeId: &schemeID},
					{Name: "admin", Permissions: admin, SchemeManaged: true, SchemeId: &schemeID},
				}
			}, "has no row on the primary"},
			{"a role is deleted", func(schemeID string) []*model.Role {
				return []*model.Role{
					{Name: "user", Permissions: user, SchemeManaged: true, SchemeId: &schemeID, DeleteAt: 1},
					{Name: "admin", Permissions: admin, SchemeManaged: true, SchemeId: &schemeID},
					{Name: "guest", Permissions: guest, SchemeManaged: true, SchemeId: &schemeID},
				}
			}, "deleted, not scheme-managed, or not owned"},
			{"a role is not scheme-managed", func(schemeID string) []*model.Role {
				return []*model.Role{
					{Name: "user", Permissions: user, SchemeManaged: false, SchemeId: &schemeID},
					{Name: "admin", Permissions: admin, SchemeManaged: true, SchemeId: &schemeID},
					{Name: "guest", Permissions: guest, SchemeManaged: true, SchemeId: &schemeID},
				}
			}, "deleted, not scheme-managed, or not owned"},
			{"a role belongs to another scheme", func(schemeID string) []*model.Role {
				other := model.NewId()
				return []*model.Role{
					{Name: "user", Permissions: user, SchemeManaged: true, SchemeId: &schemeID},
					{Name: "admin", Permissions: admin, SchemeManaged: true, SchemeId: &other},
					{Name: "guest", Permissions: guest, SchemeManaged: true, SchemeId: &schemeID},
				}
			}, "deleted, not scheme-managed, or not owned"},
			{"the guest role grants more than read", func(schemeID string) []*model.Role {
				return []*model.Role{
					{Name: "user", Permissions: user, SchemeManaged: true, SchemeId: &schemeID},
					{Name: "admin", Permissions: admin, SchemeManaged: true, SchemeId: &schemeID},
					{Name: "guest", Permissions: append(append([]string{}, guest...), model.PermissionCreatePage.Id), SchemeManaged: true, SchemeId: &schemeID},
				}
			}, "different permission set"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				th := setupSpaceRBACMock(t)
				scheme := newScheme()
				mockStore := th.App.Srv().Store().(*mocks.Store)
				mockRoleStore := mocks.RoleStore{}
				mockRoleStore.On("GetByNamesFromMaster", []string{"user", "admin", "guest"}).Return(tc.roles(scheme.Id), nil)
				mockStore.On("Role").Return(&mockRoleStore)

				err := th.Server.validateAdoptableSpaceScheme(scheme, user, admin, guest)
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.reason)
			})
		}
	})
}

// The scheme-assignment and scheme-identity guards are reached through the App entry points,
// not only by direct call: every refusal below is produced by CreateChannel, UpdateChannel, or
// UpdateScheme against a real store, and the accepted case passes through the same entry point.
func TestSpaceSchemeGuardsEnforcedThroughApp(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.EnableDocs = true }).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	preset := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	custom, appErr := th.App.CreateScheme(&model.Scheme{Name: model.NewId(), DisplayName: "Custom", Scope: model.SchemeScopeChannel})
	require.Nil(t, appErr)

	newChannel := func(channelType model.ChannelType, schemeID string) *model.Channel {
		channel := &model.Channel{
			TeamId:      th.BasicTeam.Id,
			DisplayName: "Guarded",
			Name:        "guarded-" + model.NewId(),
			Type:        channelType,
		}
		if schemeID != "" {
			channel.SchemeId = &schemeID
		}
		return channel
	}
	createChannel := func(t *testing.T, channel *model.Channel) *model.Channel {
		t.Helper()
		created, appErr := th.App.CreateChannel(th.Context, channel, false)
		require.Nil(t, appErr)
		t.Cleanup(func() {
			require.NoError(t, th.App.Srv().Store().Channel().PermanentDelete(th.Context, created.Id))
		})
		return created
	}

	t.Run("CreateChannel refuses a custom scheme on a space and a preset on an ordinary channel", func(t *testing.T) {
		_, appErr := th.App.CreateChannel(th.Context, newChannel(model.ChannelTypeSpace, custom.Id), false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)

		_, appErr = th.App.CreateChannel(th.Context, newChannel(model.ChannelTypeOpen, preset.Id), false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_reserved.app_error", appErr.Id)
	})

	t.Run("CreateChannel accepts a preset on a space", func(t *testing.T) {
		space := createChannel(t, newChannel(model.ChannelTypeSpace, preset.Id))
		require.NotNil(t, space.SchemeId)
		assert.Equal(t, preset.Id, *space.SchemeId)
	})

	t.Run("CreateChannel refuses a space with no scheme", func(t *testing.T) {
		_, appErr := th.App.CreateChannel(th.Context, newChannel(model.ChannelTypeSpace, ""), false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
	})

	t.Run("UpdateChannel refuses the same repoints and leaves the stored scheme alone", func(t *testing.T) {
		space := createChannel(t, newChannel(model.ChannelTypeSpace, preset.Id))
		repointedSpace := *space
		repointedSpace.SchemeId = &custom.Id
		_, appErr := th.App.UpdateChannel(th.Context, &repointedSpace)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
		storedSpace, appErr := th.App.GetChannelOfType(th.Context, space.Id, model.ChannelTypeSpace)
		require.Nil(t, appErr)
		require.NotNil(t, storedSpace.SchemeId)
		assert.Equal(t, preset.Id, *storedSpace.SchemeId)

		cleared := *space
		cleared.SchemeId = nil
		_, appErr = th.App.UpdateChannel(th.Context, &cleared)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
		storedSpace, appErr = th.App.GetChannelOfType(th.Context, space.Id, model.ChannelTypeSpace)
		require.Nil(t, appErr)
		require.NotNil(t, storedSpace.SchemeId)
		assert.Equal(t, preset.Id, *storedSpace.SchemeId)

		ordinary := createChannel(t, newChannel(model.ChannelTypeOpen, ""))
		repointedOrdinary := *ordinary
		repointedOrdinary.SchemeId = &preset.Id
		_, appErr = th.App.UpdateChannel(th.Context, &repointedOrdinary)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_reserved.app_error", appErr.Id)
		storedOrdinary, appErr := th.App.GetChannel(th.Context, ordinary.Id)
		require.Nil(t, appErr)
		assert.Nil(t, storedOrdinary.SchemeId)
	})

	t.Run("UpdateScheme refuses renaming into a reserved name and away from one", func(t *testing.T) {
		for _, reserved := range []struct {
			name    string
			errorID string
		}{
			{model.SchemeNameSpaceContribute, "app.scheme.save.space_scheme_name.app_error"},
			{model.PluginChannelSchemeName("com.example.plugin", nil, nil, nil), "app.scheme.save.plugin_scheme_name.app_error"},
		} {
			renamed := *custom
			renamed.Name = reserved.name
			_, appErr := th.App.UpdateScheme(&renamed)
			require.NotNil(t, appErr, reserved.name)
			assert.Equal(t, reserved.errorID, appErr.Id)
		}
		stored, err := th.App.Srv().Store().Scheme().Get(custom.Id)
		require.NoError(t, err)
		assert.Equal(t, custom.Name, stored.Name)

		renamedPreset := *preset
		renamedPreset.Name = model.NewId()
		_, appErr := th.App.UpdateScheme(&renamedPreset)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.space_scheme_rename.app_error", appErr.Id)

		// A rename that keeps the name is an ordinary metadata update and is accepted.
		relabelled := *custom
		relabelled.DisplayName = "Relabelled"
		updated, appErr := th.App.UpdateScheme(&relabelled)
		require.Nil(t, appErr)
		assert.Equal(t, "Relabelled", updated.DisplayName)
	})

	t.Run("UpdateScheme refuses a scope flip on a preset", func(t *testing.T) {
		rescopedPreset := *preset
		rescopedPreset.Scope = model.SchemeScopeTeam
		_, appErr := th.App.UpdateScheme(&rescopedPreset)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.space_scheme_scope.app_error", appErr.Id)

		stored, err := th.App.Srv().Store().Scheme().Get(preset.Id)
		require.NoError(t, err)
		assert.Equal(t, model.SchemeScopeChannel, stored.Scope)
	})
}

// GetSchemeRolesForChannel resolves a space's scheme through getChannelWithSpaceFallback and then
// schemeRolesForChannel. A scheme not yet visible on the replica falls back to a primary read, and
// a scheme absent there too surfaces the original not-found error rather than a fresh one.
func TestGetSchemeRolesForChannelSpaceSchemeMasterFallback(t *testing.T) {
	mainHelper.Parallel(t)

	newSpaceChannel := func(schemeID string) *model.Channel {
		return &model.Channel{
			Id:       model.NewId(),
			Type:     model.ChannelTypeSpace,
			SchemeId: &schemeID,
		}
	}

	t.Run("scheme missing on the replica resolves from the primary", func(t *testing.T) {
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
		schemeID := model.NewId()
		space := newSpaceChannel(schemeID)
		scheme := &model.Scheme{
			Id:                      schemeID,
			DefaultChannelGuestRole: "space-guest-role",
			DefaultChannelUserRole:  "space-user-role",
			DefaultChannelAdminRole: "space-admin-role",
		}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("Get", space.Id, true).Return(space, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
		mockSchemeStore.On("GetFromMaster", schemeID).Return(scheme, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		guestRoleName, userRoleName, adminRoleName, appErr := th.App.GetSchemeRolesForChannel(th.Context, space.Id)
		require.Nil(t, appErr)
		assert.Equal(t, scheme.DefaultChannelGuestRole, guestRoleName)
		assert.Equal(t, scheme.DefaultChannelUserRole, userRoleName)
		assert.Equal(t, scheme.DefaultChannelAdminRole, adminRoleName)
	})

	t.Run("scheme missing on the primary too fails closed with the original not-found", func(t *testing.T) {
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
		schemeID := model.NewId()
		space := newSpaceChannel(schemeID)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("Get", space.Id, true).Return(space, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
		mockSchemeStore.On("GetFromMaster", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
		mockStore.On("Scheme").Return(&mockSchemeStore)

		_, _, _, appErr := th.App.GetSchemeRolesForChannel(th.Context, space.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.get.app_error", appErr.Id)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}

// On the bulk-import path (allowSchemeUserUnset=true), a member stored as a guest is refused a
// capability role even though this call's roles carry no scheme role at all: the guest status is
// read from the stored membership rather than from the roles passed to this call.
func TestUpdateChannelMemberRolesInternalImportGuestCapabilityRole(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	space := saveSpaceChannelWithScheme(t, th, contribute.Id)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, true)

	_, appErr := th.App.updateChannelMemberRolesInternal(th.Context, space.Id, th.BasicUser.Id, model.SpacePageEditorRoleId, true)
	require.NotNil(t, appErr)
	assert.Equal(t, "api.channel.update_channel_member_roles.space_guest_role.app_error", appErr.Id)
}

// Both seeding migrations refuse a pre-existing row under a reserved name that is not the row
// they would have written, and leave their completion marker unwritten so the next start retries
// the seeding. Runs sequentially: it edits the seeded role and preset rows the parallel tests read,
// and restores them before finishing.
func TestSpaceSeedingMigrationsRefuseConflictingRows(t *testing.T) {
	th := Setup(t)
	ss := th.App.Srv().Store()

	requireMarkerAbsent := func(t *testing.T, key string) {
		t.Helper()
		_, err := ss.System().GetByName(key)
		var nfErr *store.ErrNotFound
		require.ErrorAs(t, err, &nfErr, "a refused migration must leave no completion marker")
	}
	setRolePermissions := func(t *testing.T, role *model.Role, permissions []string) {
		t.Helper()
		role.Permissions = permissions
		_, err := ss.Role().Save(role)
		require.NoError(t, err)
	}

	t.Run("a capability role with a different permission set", func(t *testing.T) {
		_, err := ss.System().PermanentDeleteByName(SpaceRolesCreationMigrationKey)
		require.NoError(t, err)
		role, err := ss.Role().GetByName(th.Context, model.SpacePageEditorRoleId)
		require.NoError(t, err)
		original := append([]string{}, role.Permissions...)
		t.Cleanup(func() {
			setRolePermissions(t, role, original)
			require.NoError(t, th.Server.doSpaceRolesCreationMigration(th.Context))
		})
		setRolePermissions(t, role, append(append([]string{}, original...), model.PermissionAdminSpace.Id))

		err = th.Server.doSpaceRolesCreationMigration(th.Context)
		require.Error(t, err)
		assert.Contains(t, err.Error(), model.SpacePageEditorRoleId)
		assert.Contains(t, err.Error(), "different permission set")
		requireMarkerAbsent(t, SpaceRolesCreationMigrationKey)
	})

	t.Run("a preset whose generated user role grants a different set", func(t *testing.T) {
		_, err := ss.System().PermanentDeleteByName(SpaceSchemesCreationMigrationKey)
		require.NoError(t, err)
		scheme := getSeededSpaceScheme(t, th, model.SchemeNameSpaceReadOnly)
		userRole, err := ss.Role().GetByName(th.Context, scheme.DefaultChannelUserRole)
		require.NoError(t, err)
		original := append([]string{}, userRole.Permissions...)
		t.Cleanup(func() {
			setRolePermissions(t, userRole, original)
			require.NoError(t, th.Server.doSpaceSchemesCreationMigration())
		})
		setRolePermissions(t, userRole, append(append([]string{}, original...), model.PermissionDeletePage.Id))

		err = th.Server.doSpaceSchemesCreationMigration()
		require.Error(t, err)
		assert.Contains(t, err.Error(), model.SchemeNameSpaceReadOnly)
		assert.Contains(t, err.Error(), "different permission set")
		requireMarkerAbsent(t, SpaceSchemesCreationMigrationKey)
	})
}
