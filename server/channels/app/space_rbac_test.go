// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// setupSpaceRBACMock builds a store-mock helper for the space scope guards.
//
// The guards are not gated on the Docs feature flag — the only thing that flag
// gates is space creation — so the flag's value is irrelevant to everything
// tested through this helper. TestSpaceGuardsHoldWithFlagOff pins that.
func setupSpaceRBACMock(t *testing.T) *TestHelper {
	return SetupWithStoreMock(t)
}

func TestCheckSpacePermissionScope(t *testing.T) {
	guarded := model.PermissionReadPage.Id

	t.Run("write adding no guarded permission is never rejected and takes no scheme read", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), Permissions: []string{model.PermissionInviteUser.Id}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, nil))
		mockSchemeStore.AssertNotCalled(t, "Get", mock.Anything)
	})

	t.Run("removing a guarded permission is allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.TeamUserRoleId, Permissions: []string{model.PermissionViewTeam.Id}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, []string{model.PermissionViewTeam.Id, guarded}))
	})

	t.Run("team built-in role rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.TeamUserRoleId, Permissions: []string{guarded}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr)
	})

	t.Run("system-scoped role rejected (the live fallback surface)", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.SystemUserRoleId, Permissions: []string{guarded}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	t.Run("system_admin excepted", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.SystemAdminRoleId, Permissions: []string{guarded}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	t.Run("global channel built-ins rejected by name", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		for _, name := range []string{model.ChannelGuestRoleId, model.ChannelUserRoleId, model.ChannelAdminRoleId} {
			role := &model.Role{Name: name, Permissions: []string{guarded}}
			assert.NotNil(t, th.App.checkSpacePermissionScope(role, nil), "role %q", name)
		}
	})

	t.Run("atomic capability role names rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.SpacePageCommenterRoleId, Permissions: append(
			model.PermissionIDs(model.SpacePageCommenterRolePermissions), model.PermissionAdminSpace.Id)}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, model.PermissionIDs(model.SpacePageCommenterRolePermissions)))
	})

	// The name-based rejects above all run with a nil SchemeId, where the final
	// fail-closed fallthrough would refuse the write anyway. Pairing each name
	// with a scheme that genuinely proves space scope is the only shape that
	// tells the two apart: without the name checks these would be allowed.
	t.Run("guarded role names rejected even when their scheme proves space scope", func(t *testing.T) {
		mainHelper.Parallel(t)

		for _, name := range []string{
			model.SpacePageCommenterRoleId,
			model.TeamUserRoleId,
			model.ChannelUserRoleId,
		} {
			t.Run(name, func(t *testing.T) {
				th := setupSpaceRBACMock(t)

				schemeID := model.NewId()
				mockStore := th.App.Srv().Store().(*mocks.Store)
				mockSchemeStore := mocks.SchemeStore{}
				mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{
					Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel,
				}, nil)
				mockStore.On("Scheme").Return(&mockSchemeStore)

				role := &model.Role{Name: name, SchemeId: &schemeID, Permissions: []string{guarded}}
				require.NotNil(t, th.App.checkSpacePermissionScope(role, nil),
					"role %q must be rejected by name, not by the nil-SchemeId fallthrough", name)
			})
		}
	})

	t.Run("space-scheme generated role allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	// A per-space custom scheme carries no reserved name — the caller picks it — so a space
	// backing channel already pointing at the scheme is what proves space scope instead.
	t.Run("custom scheme a space references allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(1), nil)
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	// Scope is half the proof: only a channel-scoped scheme can govern a space,
	// so a scheme of another scope is refused without asking the count.
	t.Run("scheme at the wrong scope rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{
			Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeTeam,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, nil))
		mockChannelStore.AssertNotCalled(t, "CountSpaceChannelsByScheme", mock.Anything)
	})

	// An unreadable count cannot prove space scope, and reporting it as a scope
	// violation would blame the caller for an unreachable database.
	t.Run("count store error is a server error", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), errors.New("db down"))
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("ordinary channel-scheme generated role rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	// Channel scope alone proves nothing: an ordinary customer channel scheme is
	// channel-scoped too. Only a seeded preset name, or a space actually
	// pointing at the scheme, counts.
	t.Run("ordinary channel scheme does not prove space scope", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{
			Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
	})

	t.Run("scheme store error is not reported as a scope violation", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(nil, errors.New("connection reset"))
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr, "the write must still be refused")
		assert.Equal(t, "app.scheme.get.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("team-scheme generated channel role rejected (the live injection path)", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{Id: schemeID, Scope: model.SchemeScopeTeam}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	t.Run("unresolvable scheme fails closed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	t.Run("nil-SchemeId unrecognized name fails closed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.NewId(), Permissions: []string{guarded}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	// A presence check would reject this; only a diff lets an already-granted
	// permission survive an unrelated re-save of the same role.
	t.Run("re-saving a role that already carries the permission is not an add", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.TeamUserRoleId, Permissions: []string{guarded, model.PermissionViewTeam.Id}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, []string{guarded}))
		// The stored set already proved the grant, so no scheme lookup is needed.
		mockSchemeStore.AssertNotCalled(t, "Get", mock.Anything)
	})

	t.Run("adding a second guarded permission alongside one already stored is still rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.TeamUserRoleId, Permissions: []string{guarded, model.PermissionAdminSpace.Id}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, []string{guarded}))
	})
}

// TestUpdateRoleBaselineIsKeyedById pins that the guard diffs against the row the
// save will actually overwrite. Role().Get is the one read of a role that no cache
// layer serves, so a peer node's removal that has not yet invalidated this node's
// entry cannot leave a stale-wider baseline that lets a re-add through — the
// Name-keyed lookup, which is answered from cache before the context is consulted,
// is never used when the save carries an Id. Keying by Id also makes a divergent
// Id/Name pair structurally unable to select the wrong baseline.
func TestUpdateRoleBaselineIsKeyedById(t *testing.T) {
	t.Run("baseline read by id, never by name", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockRoleStore := mocks.RoleStore{}
		mockStore.On("Role").Return(&mockRoleStore)
		mockSchemeStore := mocks.SchemeStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)

		roleID, roleName := model.NewId(), model.NewId()
		// The row being saved does not carry the guarded permission, so the
		// incoming one is an add and must be rejected.
		mockRoleStore.On("Get", roleID).Return(&model.Role{
			Id:   roleID,
			Name: roleName,
		}, nil)

		role := &model.Role{
			Id:          roleID,
			Name:        roleName,
			Permissions: []string{model.PermissionAdminSpace.Id},
		}
		_, appErr := th.App.UpdateRole(role)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
		mockRoleStore.AssertNotCalled(t, "GetByName", mock.Anything, mock.Anything)
		mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
	})

	t.Run("a save carrying no id falls back to the name lookup", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockRoleStore := mocks.RoleStore{}
		mockStore.On("Role").Return(&mockRoleStore)
		mockSchemeStore := mocks.SchemeStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)

		roleName := model.NewId()
		mockRoleStore.On("GetByName", mock.Anything, roleName).Return(&model.Role{
			Name: roleName,
		}, nil)

		role := &model.Role{
			Name:        roleName,
			Permissions: []string{model.PermissionAdminSpace.Id},
		}
		_, appErr := th.App.UpdateRole(role)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
		mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
	})

}

func TestValidateAdoptableSpaceScheme(t *testing.T) {
	canonical := &model.Scheme{
		Name:                    model.SchemeNameSpaceContribute,
		Scope:                   model.SchemeScopeChannel,
		DefaultChannelUserRole:  model.NewId(),
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelGuestRole: model.NewId(),
	}

	t.Run("canonical row accepted", func(t *testing.T) {
		require.NoError(t, validateAdoptableSpaceScheme(canonical))
	})

	t.Run("soft-deleted row rejected", func(t *testing.T) {
		// GetByName has no DeleteAt filter, so a deleted row reaches the check.
		foreign := *canonical
		foreign.DeleteAt = 1
		require.Error(t, validateAdoptableSpaceScheme(&foreign))
	})

	t.Run("wrong scope rejected", func(t *testing.T) {
		foreign := *canonical
		foreign.Scope = model.SchemeScopeTeam
		require.Error(t, validateAdoptableSpaceScheme(&foreign))
	})

	t.Run("incomplete generated roles rejected", func(t *testing.T) {
		for _, blank := range []func(*model.Scheme){
			func(s *model.Scheme) { s.DefaultChannelUserRole = "" },
			func(s *model.Scheme) { s.DefaultChannelAdminRole = "" },
			func(s *model.Scheme) { s.DefaultChannelGuestRole = "" },
		} {
			foreign := *canonical
			blank(&foreign)
			require.Error(t, validateAdoptableSpaceScheme(&foreign))
		}
	})
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

func getSeededSpaceScheme(t *testing.T, th *TestHelper, name string) *model.Scheme {
	t.Helper()
	scheme, err := th.App.Srv().Store().Scheme().GetByName(th.Context.Context(), name)
	require.NoError(t, err, "seeding migration must have created scheme %q", name)
	return scheme
}

func storedRolePermissionSet(t *testing.T, th *TestHelper, roleName string) map[string]bool {
	t.Helper()
	role, err := th.App.Srv().Store().Role().GetByName(th.Context.Context(), roleName)
	require.NoError(t, err)
	return asPermissionSet(role.Permissions)
}

func permissionIDSet(perms []*model.Permission) map[string]bool {
	return asPermissionSet(model.PermissionIDs(perms))
}

// TestSpaceSeedingSurvivesPermissionsReset pins that a permissions reset — which
// purges every scheme and role, then re-runs the migrations — leaves the space
// presets rebuilt. The reset only re-runs migrations whose System key it clears,
// so without the space keys in that list the presets would be purged and never
// recreated, dropping every space member to the page-perm-less global roles with
// no supported way back.
func TestSpaceSeedingSurvivesPermissionsReset(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	before := make(map[string]string, len(model.SpaceSchemeNames))
	for _, name := range model.SpaceSchemeNames {
		before[name] = getSeededSpaceScheme(t, th, name).DefaultChannelUserRole
	}

	require.Nil(t, th.App.ResetPermissionsSystem())

	for _, name := range model.SpaceSchemeNames {
		scheme := getSeededSpaceScheme(t, th, name)
		assert.Equal(t, model.SchemeScopeChannel, scheme.Scope)
		assert.NotEmpty(t, scheme.DefaultChannelUserRole)
		assert.NotEqual(t, before[name], scheme.DefaultChannelUserRole,
			"the purge should have rebuilt %q rather than left the old rows in place", name)
	}

	// The presets' generated roles must carry their permissions again, not just
	// exist: a rebuilt scheme whose roles were never re-stripped and re-granted
	// would resolve to the wrong capability set.
	assert.Equal(t,
		permissionIDSet(model.SpaceDefaultReadOnlyPermissions),
		storedRolePermissionSet(t, th, getSeededSpaceScheme(t, th, model.SchemeNameSpaceReadOnly).DefaultChannelUserRole))

	for _, roleID := range model.SpaceCapabilityRoles {
		_, err := th.App.Srv().Store().Role().GetByName(th.Context.Context(), roleID)
		require.NoError(t, err, "capability role %q must survive the reset", roleID)
	}
}

// TestSpaceSeedingMigrations asserts against a real database that the boot
// seeding created the atomic capability roles and the three preset schemes
// with exactly the canonical permission sets — moderated permissions stripped
// from the generated user and guest roles, the admin role granted the full
// admin slice.
func TestSpaceSeedingMigrations(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("atomic capability roles exist with canonical definitions", func(t *testing.T) {
		canonical := model.MakeDefaultRoles()
		for _, roleID := range []string{
			model.SpacePageCreatorRoleId,
			model.SpacePageCommenterRoleId,
			model.SpacePageEditorRoleId,
			model.SpacePageDeleterOwnRoleId,
		} {
			role, err := th.App.Srv().Store().Role().GetByName(th.Context.Context(), roleID)
			require.NoError(t, err, "role %q must be seeded", roleID)
			assert.ElementsMatch(t, canonical[roleID].Permissions, role.Permissions)
			assert.False(t, role.SchemeManaged)
			assert.True(t, role.BuiltIn)
			assert.Nil(t, role.SchemeId)
		}
	})

	t.Run("preset schemes exist with exact generated-role permission sets", func(t *testing.T) {
		presets := map[string][]*model.Permission{
			model.SchemeNameSpaceContribute: model.SpaceDefaultContributePermissions,
			model.SchemeNameSpaceComment:    model.SpaceDefaultCommentPermissions,
			model.SchemeNameSpaceReadOnly:   model.SpaceDefaultReadOnlyPermissions,
		}
		for name, userPerms := range presets {
			scheme := getSeededSpaceScheme(t, th, name)
			assert.Equal(t, model.SchemeScopeChannel, scheme.Scope)

			assert.Equal(t, permissionIDSet(userPerms), storedRolePermissionSet(t, th, scheme.DefaultChannelUserRole),
				"user role of %q", name)
			assert.Equal(t, permissionIDSet(model.SpaceAdminRolePermissions), storedRolePermissionSet(t, th, scheme.DefaultChannelAdminRole),
				"admin role of %q", name)
			assert.Equal(t, permissionIDSet(model.SpaceDefaultReadOnlyPermissions), storedRolePermissionSet(t, th, scheme.DefaultChannelGuestRole),
				"guest role of %q", name)
		}
	})

	t.Run("team and system role rows carry the lifecycle grants", func(t *testing.T) {
		assert.True(t, storedRolePermissionSet(t, th, model.TeamGuestRoleId)[model.PermissionReadSpace.Id])
		teamUser := storedRolePermissionSet(t, th, model.TeamUserRoleId)
		assert.True(t, teamUser[model.PermissionReadSpace.Id])
		assert.True(t, teamUser[model.PermissionCreateSpace.Id])
		teamAdmin := storedRolePermissionSet(t, th, model.TeamAdminRoleId)
		assert.True(t, teamAdmin[model.PermissionManageSpace.Id])
		assert.True(t, teamAdmin[model.PermissionDeleteSpace.Id])

		sysAdmin := storedRolePermissionSet(t, th, model.SystemAdminRoleId)
		for _, p := range model.SpaceChannelScopedPermissions {
			assert.True(t, sysAdmin[p.Id], "system_admin must carry %q", p.Id)
		}
		assert.True(t, sysAdmin[model.PermissionManageSpace.Id])
	})

	t.Run("re-running the migrations is a no-op", func(t *testing.T) {
		_, err := th.App.Srv().Store().System().PermanentDeleteByName(SpaceRolesCreationMigrationKey)
		require.NoError(t, err)
		_, err = th.App.Srv().Store().System().PermanentDeleteByName(SpaceSchemesCreationMigrationKey)
		require.NoError(t, err)

		require.NoError(t, th.Server.doSpaceRolesCreationMigration())
		require.NoError(t, th.Server.doSpaceSchemesCreationMigration())
	})
}

func TestValidateCanonicalSpaceRole(t *testing.T) {
	canonical := model.MakeDefaultRoles()[model.SpacePageCreatorRoleId]

	t.Run("canonical row accepted", func(t *testing.T) {
		require.NoError(t, validateCanonicalSpaceRole(canonical.Clone(), canonical))
	})

	t.Run("foreign row without ownership markers rejected", func(t *testing.T) {
		foreign := canonical.Clone()
		foreign.BuiltIn = false
		require.Error(t, validateCanonicalSpaceRole(foreign, canonical))

		foreign = canonical.Clone()
		foreign.SchemeManaged = true
		require.Error(t, validateCanonicalSpaceRole(foreign, canonical))

		schemeID := model.NewId()
		foreign = canonical.Clone()
		foreign.SchemeId = &schemeID
		require.Error(t, validateCanonicalSpaceRole(foreign, canonical))
	})

	t.Run("non-canonical permission set rejected", func(t *testing.T) {
		foreign := canonical.Clone()
		foreign.Permissions = append(foreign.Permissions, model.PermissionAdminSpace.Id)
		require.Error(t, validateCanonicalSpaceRole(foreign, canonical))
	})
}

// TestSpacePresetResolutionThroughRealSpace exercises the higher-scope merge
// exemption for space permissions end to end: without it, every preset grant
// is stripped at resolution time and these assertions fail against master.
func TestSpacePresetResolutionThroughRealSpace(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	space := saveSpaceChannelWithScheme(t, th, contribute.Id)

	member := th.BasicUser
	admin := th.BasicUser2
	guest := th.CreateUser(t)
	saveSpaceChannelMember(t, th, space.Id, member.Id, false, false)
	saveSpaceChannelMember(t, th, space.Id, admin.Id, true, false)
	saveSpaceChannelMember(t, th, space.Id, guest.Id, false, true)

	check := func(userID string, perm *model.Permission) bool {
		has, _ := th.App.HasPermissionToChannel(th.Context, userID, space.Id, perm)
		return has
	}

	t.Run("plain member resolves the contribute default", func(t *testing.T) {
		assert.True(t, check(member.Id, model.PermissionReadPage))
		assert.True(t, check(member.Id, model.PermissionEditPage))
		assert.True(t, check(member.Id, model.PermissionCreatePage))
		assert.True(t, check(member.Id, model.PermissionDeleteOwnPage))
		assert.False(t, check(member.Id, model.PermissionDeletePage))
		assert.False(t, check(member.Id, model.PermissionAdminSpace))
	})

	t.Run("SchemeAdmin resolves the full admin set", func(t *testing.T) {
		assert.True(t, check(admin.Id, model.PermissionDeletePage))
		assert.True(t, check(admin.Id, model.PermissionAdminSpace))
	})

	t.Run("guest resolves read_page only", func(t *testing.T) {
		assert.True(t, check(guest.Id, model.PermissionReadPage))
		assert.False(t, check(guest.Id, model.PermissionCreatePage))
		assert.False(t, check(guest.Id, model.PermissionCommentPage))
	})

	t.Run("moderated permissions stay stripped from the backing channel", func(t *testing.T) {
		assert.False(t, check(member.Id, model.PermissionCreatePost))
		assert.False(t, check(member.Id, model.PermissionAddReaction))
		assert.False(t, check(member.Id, model.PermissionManagePublicChannelMembers))
		assert.False(t, check(member.Id, model.PermissionAddBookmarkPublicChannel))
		assert.False(t, check(guest.Id, model.PermissionCreatePost))
	})

	t.Run("atomic capability role in ExplicitRoles unions on top of a read-only default", func(t *testing.T) {
		readOnly := getSeededSpaceScheme(t, th, model.SchemeNameSpaceReadOnly)
		roSpace := saveSpaceChannelWithScheme(t, th, readOnly.Id)
		creator := th.CreateUser(t)
		_, err := th.App.Srv().Store().Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:     roSpace.Id,
			UserId:        creator.Id,
			NotifyProps:   model.GetDefaultChannelNotifyProps(),
			SchemeUser:    true,
			ExplicitRoles: model.SpacePageCreatorRoleId,
		})
		require.NoError(t, err)
		th.App.Srv().Store().Channel().InvalidateAllChannelMembersForUser(creator.Id)

		has, _ := th.App.HasPermissionToChannel(th.Context, creator.Id, roSpace.Id, model.PermissionCreatePage)
		assert.True(t, has, "create-but-not-comment: creator role grants create_page")
		has, _ = th.App.HasPermissionToChannel(th.Context, creator.Id, roSpace.Id, model.PermissionCommentPage)
		assert.False(t, has, "creator role must not grant comment_page")
	})
}

// TestSpaceDefaultSwitchImmediatelyEffective proves the UpdateChannel
// SchemeId-change invalidation: with the member-roles cache warm, a default
// switch takes effect on the very next request.
func TestSpaceDefaultSwitchImmediatelyEffective(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	readOnly := getSeededSpaceScheme(t, th, model.SchemeNameSpaceReadOnly)
	space := saveSpaceChannelWithScheme(t, th, contribute.Id)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, false)

	// Warm the member-roles cache on the contribute preset.
	has, _ := th.App.HasPermissionToChannel(th.Context, th.BasicUser.Id, space.Id, model.PermissionEditPage)
	require.True(t, has)

	updated, err := th.App.Srv().Store().Channel().GetChannelOfType(th.Context, space.Id, model.ChannelTypeSpace)
	require.NoError(t, err)
	updated.SchemeId = &readOnly.Id
	_, appErr := th.App.UpdateChannel(th.Context, updated)
	require.Nil(t, appErr)

	has, _ = th.App.HasPermissionToChannel(th.Context, th.BasicUser.Id, space.Id, model.PermissionEditPage)
	assert.False(t, has, "default switch must be effective on the next request, not at cache expiry")
	has, _ = th.App.HasPermissionToChannel(th.Context, th.BasicUser.Id, space.Id, model.PermissionReadPage)
	assert.True(t, has)
}

func TestCreateRoleSpacePermissionGuard(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockRoleStore := mocks.RoleStore{}
	mockStore.On("Role").Return(&mockRoleStore)

	role := &model.Role{
		Name:        model.NewId(),
		DisplayName: "custom",
		Permissions: []string{model.PermissionEditPage.Id},
	}
	_, appErr := th.App.CreateRole(role)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
	mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
}

// TestCreateRoleClearsSchemeId pins the trusted-property clear: SchemeId is the
// scope guard's only non-rejecting branch, so a caller-supplied value must not
// survive into the guard and borrow a space scheme's scope.
func TestCreateRoleClearsSchemeId(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockRoleStore := mocks.RoleStore{}
	mockStore.On("Role").Return(&mockRoleStore)
	mockSchemeStore := mocks.SchemeStore{}
	mockStore.On("Scheme").Return(&mockSchemeStore)

	schemeID := model.NewId()
	role := &model.Role{
		Name:        model.NewId(),
		DisplayName: "custom",
		SchemeId:    &schemeID,
		Permissions: []string{model.PermissionAdminSpace.Id},
	}
	_, appErr := th.App.CreateRole(role)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
	assert.Nil(t, role.SchemeId, "CreateRole must clear a caller-supplied SchemeId")
	// The guard must never have consulted the borrowed scheme.
	mockSchemeStore.AssertNotCalled(t, "Get", mock.Anything)
	mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
}

// TestSpaceCapabilityRoleConfinedToSpaces pins that the atomic capability
// roles, which are excluded from BuiltInSchemeManagedRoleIDs so they can ride
// in ExplicitRoles, are refused by the channel-member role sink on an ordinary
// channel and accepted there only once the channel resolves to a space. The
// sink settles that with a dedicated space lookup rather than the scheme-role
// resolution it uses for ordinary channels.
func TestSpaceCapabilityRoleConfinedToSpaces(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	for _, roleName := range model.SpaceCapabilityRoles {
		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser.Id,
			model.ChannelUserRoleId+" "+roleName)
		require.NotNil(t, appErr, "role %q", roleName)
		assert.Equal(t, "api.channel.update_channel_member_roles.space_role.app_error", appErr.Id, "role %q", roleName)
	}

	// An ordinary explicit role on the same sink still works.
	member, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser.Id, model.ChannelUserRoleId)
	require.Nil(t, appErr)
	assert.Equal(t, "", member.ExplicitRoles)

	// On a space backing channel the same roles are the per-member capability
	// grants and must be accepted — the docs plugin writes them through this
	// sink alongside the scheme's generated user role.
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	space := saveSpaceChannelWithScheme(t, th, contribute.Id)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, false)

	member, appErr = th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser.Id,
		contribute.DefaultChannelUserRole+" "+model.SpacePageCreatorRoleId)
	require.Nil(t, appErr)
	assert.True(t, member.SchemeUser)
	assert.Equal(t, model.SpacePageCreatorRoleId, member.ExplicitRoles)
}

// TestSpaceCapabilityRoleConfinedToChannels pins the team-member counterpart of
// the channel sink guard. A team member's roles are the fallback consulted for
// every channel in the team, so a capability role accepted here would grant
// space authority across all of them at once — wider than the channel sink
// refuses one channel at a time.
func TestSpaceCapabilityRoleConfinedToChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	for _, roleName := range model.SpaceCapabilityRoles {
		_, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, th.BasicUser.Id,
			model.TeamUserRoleId+" "+roleName)
		require.NotNil(t, appErr, "role %q", roleName)
		assert.Equal(t, "api.team.update_team_member_roles.space_role.app_error", appErr.Id, "role %q", roleName)
	}

	// An ordinary role on the same sink still works.
	member, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.TeamUserRoleId)
	require.Nil(t, appErr)
	assert.Equal(t, "", member.ExplicitRoles)
}

// TestCreateChannelRejectsSpaceScheme pins that the create path cannot be used
// to reach the state UpdateChannelScheme refuses: it takes SchemeId straight
// from the caller, so without the guard it is the way around it.
func TestCreateChannelRejectsSpaceScheme(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)

	_, appErr := th.App.CreateChannel(th.Context, &model.Channel{
		TeamId:      th.BasicTeam.Id,
		DisplayName: "Borrowed",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
		SchemeId:    &contribute.Id,
	}, false)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel.update_channel_scheme.space_scheme.app_error", appErr.Id)

	// A channel carrying no scheme is unaffected.
	created, appErr := th.App.CreateChannel(th.Context, &model.Channel{
		TeamId:      th.BasicTeam.Id,
		DisplayName: "Ordinary",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, false)
	require.Nil(t, appErr)
	require.NotNil(t, created)
}

// TestUpdateChannelRejectsSpaceScheme pins the generic sink. UpdateChannel takes
// SchemeId straight from the caller and two paths reach it without passing
// UpdateChannelScheme — bulk import repoints an already-existing channel through
// it, and the plugin API delegates to it — so guarding only the narrower entry
// points would leave an ordinary channel reachable. Attaching a preset there
// would strip create_post from every member below admin.
func TestUpdateChannelRejectsSpaceScheme(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	contribute := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)

	channel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, appErr)

	channel.SchemeId = &contribute.Id
	_, appErr = th.App.UpdateChannel(th.Context, channel)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel.update_channel_scheme.space_scheme.app_error", appErr.Id)

	// An edit that leaves SchemeId alone is unaffected.
	unchanged, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, appErr)
	unchanged.DisplayName = "Renamed"
	updated, appErr := th.App.UpdateChannel(th.Context, unchanged)
	require.Nil(t, appErr)
	assert.Equal(t, "Renamed", updated.DisplayName)
}

// TestUpdateChannelSchemeUnresolvableSchemeIsNotRejected pins the guard's scope:
// it refuses the space presets, and leaves an id that resolves to no scheme to
// the write path rather than validating that a channel's scheme exists.
func TestUpdateChannelSchemeUnresolvableSchemeIsNotRejected(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	missing := model.NewId()
	updated, appErr := th.App.UpdateChannelScheme(th.Context, &model.Channel{
		Id:       th.BasicChannel.Id,
		SchemeId: &missing,
	})
	require.Nil(t, appErr)
	require.NotNil(t, updated.SchemeId)
	assert.Equal(t, missing, *updated.SchemeId)
}

// schemeIsNotASpacePreset makes the by-id identity read answer with an ordinary
// channel scheme, so the seeded-preset arm of the delete guard declines and the
// space-reference count decides.
func schemeIsNotASpacePreset(mockSchemeStore *mocks.SchemeStore, schemeID string) {
	mockSchemeStore.On("Get", schemeID).
		Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
}

func TestDeleteSchemeSpaceGuards(t *testing.T) {
	t.Run("seeded preset refused by id", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).
			Return(&model.Scheme{Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		_, appErr := th.App.DeleteScheme(schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.delete.space_scheme.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Delete", mock.Anything)
	})

	// A scheme of another scope carrying a reserved name is a squatter the
	// seeding migration refuses to adopt; deleting it is the operator's remedy.
	t.Run("reserved name outside channel scope is not treated as a preset", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeTeam}
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(scheme, nil)
		mockSchemeStore.On("Delete", schemeID).Return(scheme, nil)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		deleted, appErr := th.App.DeleteScheme(schemeID)
		require.Nil(t, appErr)
		assert.Equal(t, schemeID, deleted.Id)
	})

	t.Run("space-referenced scheme refused, soft-deleted spaces included", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		schemeIsNotASpacePreset(&mockSchemeStore, schemeID)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(1), nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		_, appErr := th.App.DeleteScheme(schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.delete.space_scheme.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("unreferenced non-space scheme deletes normally", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Name: model.NewId()}
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		schemeIsNotASpacePreset(&mockSchemeStore, schemeID)
		mockSchemeStore.On("Delete", schemeID).Return(scheme, nil)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		deleted, appErr := th.App.DeleteScheme(schemeID)
		require.Nil(t, appErr)
		assert.Equal(t, schemeID, deleted.Id)
	})
}

func TestUpdateSchemeSpaceGuards(t *testing.T) {
	setup := func(t *testing.T, storedName string) (*TestHelper, *mocks.SchemeStore, string) {
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{Id: schemeID, Name: storedName, Scope: model.SchemeScopeChannel}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		return th, &mockSchemeStore, schemeID
	}

	t.Run("renaming a seeded scheme away from its constant is rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, mockSchemeStore, schemeID := setup(t, model.SchemeNameSpaceContribute)

		_, appErr := th.App.UpdateScheme(&model.Scheme{Id: schemeID, Name: "renamed_scheme", Scope: model.SchemeScopeChannel})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.space_scheme_rename.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
	})

	t.Run("renaming another scheme to a seeded name is rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, mockSchemeStore, schemeID := setup(t, "ordinary_scheme")

		_, appErr := th.App.UpdateScheme(&model.Scheme{Id: schemeID, Name: model.SchemeNameSpaceReadOnly, Scope: model.SchemeScopeChannel})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.space_scheme_name.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
	})

	t.Run("ordinary rename still succeeds", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, mockSchemeStore, schemeID := setup(t, "ordinary_scheme")

		updated := &model.Scheme{Id: schemeID, Name: "renamed_scheme", Scope: model.SchemeScopeChannel}
		mockSchemeStore.On("Save", updated).Return(updated, nil)

		saved, appErr := th.App.UpdateScheme(updated)
		require.Nil(t, appErr)
		assert.Equal(t, "renamed_scheme", saved.Name)
	})

	// A scheme of a scope other than channel can never be a space scheme, so one
	// carrying a reserved name is a squatter that the seeding migration refuses
	// to adopt. Renaming it away is the operator's only remedy; refusing that
	// rename too would leave the boot blocked with no way out.
	t.Run("renaming a wrong-scope squatter away is allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(&model.Scheme{
			Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeTeam,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		updated := &model.Scheme{Id: schemeID, Name: "renamed_scheme", Scope: model.SchemeScopeTeam}
		mockSchemeStore.On("Save", updated).Return(updated, nil)

		saved, appErr := th.App.UpdateScheme(updated)
		require.Nil(t, appErr)
		assert.Equal(t, "renamed_scheme", saved.Name)
	})
}

func TestCreateSchemeSpaceNameGuard(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockStore.On("Scheme").Return(&mockSchemeStore)

	for _, name := range model.SpaceSchemeNames {
		_, appErr := th.App.CreateScheme(&model.Scheme{Name: name, DisplayName: "x", Scope: model.SchemeScopeChannel})
		require.NotNil(t, appErr, "scheme name %q must be rejected", name)
		assert.Equal(t, "app.scheme.save.space_scheme_name.app_error", appErr.Id)
	}
	mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
}

// A custom scheme is not a preset, so the ordinary-channel guard leaves it
// alone: only the presets carry the moderated-permission stripping that would
// silently take create_post away from an ordinary channel's members.
func TestRejectSpaceSchemeOnOrdinaryChannelIgnoresCustomSchemes(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("Get", schemeID).
		Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)

	require.Nil(t, th.App.rejectSpaceSchemeOnOrdinaryChannel("UpdateChannelScheme", &schemeID))
}

// The guards below fail closed on a store error rather than letting a write or
// delete through on an unreadable row, so each error branch is pinned.

func TestUpdateSchemeNotFoundIsNotAServerError(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("Get", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
	mockStore.On("Scheme").Return(&mockSchemeStore)

	_, appErr := th.App.UpdateScheme(&model.Scheme{Id: schemeID, Name: "ordinary_scheme", Scope: model.SchemeScopeChannel})
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode, "a missing scheme is a 404, not a 500")
	mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
}

func TestUpdateSchemeStoreErrorIsAServerError(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("Get", schemeID).Return(nil, errors.New("connection reset"))
	mockStore.On("Scheme").Return(&mockSchemeStore)

	_, appErr := th.App.UpdateScheme(&model.Scheme{Id: schemeID, Name: "ordinary_scheme", Scope: model.SchemeScopeChannel})
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
}

func TestUpdateRoleStoreErrorIsNotReportedAsAScopeViolation(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockRoleStore := mocks.RoleStore{}
	mockRoleStore.On("Get", mock.Anything).Return(nil, errors.New("connection reset"))
	mockStore.On("Role").Return(&mockRoleStore)

	role := &model.Role{Id: model.NewId(), Name: model.NewId(), Permissions: []string{model.PermissionAdminSpace.Id}}
	_, appErr := th.App.UpdateRole(role)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.role.get.app_error", appErr.Id,
		"an unreadable baseline must surface as a store error, not a permission-scope rejection")
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
}

func TestDeleteSchemeFailsClosedOnStoreErrors(t *testing.T) {
	t.Run("seeded-scheme lookup error refuses the delete", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", mock.Anything).Return(nil, errors.New("connection reset"))
		mockStore.On("Scheme").Return(&mockSchemeStore)

		_, appErr := th.App.DeleteScheme(model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		mockSchemeStore.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("space-channel count error refuses the delete", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		schemeIsNotASpacePreset(&mockSchemeStore, schemeID)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), errors.New("connection reset"))
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		_, appErr := th.App.DeleteScheme(schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		mockSchemeStore.AssertNotCalled(t, "Delete", mock.Anything)
	})
}

// spaceRolesMigrationStore builds a store whose Role().Save always fails, as it
// would on the losing side of a concurrent HA insert, and whose re-read on the
// primary returns whatever reread yields. It drives the seeding migration's
// lost-insert recovery, which a real single-node DB run never exercises.
func spaceRolesMigrationStore(t *testing.T, saveErr error, reread func(roleID string) (*model.Role, error)) *mocks.Store {
	t.Helper()
	mockStore := mocks.Store{}

	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", SpaceRolesCreationMigrationKey).
		Return(nil, store.NewErrNotFound("System", SpaceRolesCreationMigrationKey))
	mockSystemStore.On("SaveOrUpdate", mock.Anything).Return(nil)
	mockStore.On("System").Return(&mockSystemStore)

	mockRoleStore := mocks.RoleStore{}
	mockRoleStore.On("GetByName", mock.Anything, mock.Anything).Return(
		func(ctx context.Context, name string) (*model.Role, error) {
			// The first pass reads the replica and misses; the recovery pass
			// reads the primary.
			if store.HasMaster(ctx) {
				return reread(name)
			}
			return nil, store.NewErrNotFound("Role", name)
		})
	mockRoleStore.On("Save", mock.Anything).Return(nil, saveErr)
	mockStore.On("Role").Return(&mockRoleStore)

	// The helper's teardown closes whatever store is installed.
	mockStore.On("Close").Return(nil)

	return &mockStore
}

func TestSpaceRolesMigrationRecoversFromLostInsertRace(t *testing.T) {
	canonical := model.MakeDefaultRoles()

	t.Run("re-read finding the canonical row completes the migration", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		th.App.Srv().SetStore(spaceRolesMigrationStore(t, errors.New("duplicate key"),
			func(roleID string) (*model.Role, error) { return canonical[roleID].Clone(), nil }))

		require.NoError(t, th.Server.doSpaceRolesCreationMigration(),
			"a lost insert race whose winner wrote the canonical row must not fail boot")
	})

	t.Run("re-read finding a foreign row fails the migration", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		th.App.Srv().SetStore(spaceRolesMigrationStore(t, errors.New("duplicate key"),
			func(roleID string) (*model.Role, error) {
				foreign := canonical[roleID].Clone()
				foreign.Permissions = append(foreign.Permissions, model.PermissionAdminSpace.Id)
				return foreign, nil
			}))

		require.Error(t, th.Server.doSpaceRolesCreationMigration(),
			"a name collision with a non-canonical role must not be silently adopted")
	})

	t.Run("re-read also missing surfaces the original save error", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		th.App.Srv().SetStore(spaceRolesMigrationStore(t, errors.New("disk full"),
			func(roleID string) (*model.Role, error) { return nil, store.NewErrNotFound("Role", roleID) }))

		err := th.Server.doSpaceRolesCreationMigration()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "disk full", "the save failure is the root cause, not the re-read miss")
	})
}

// spaceSchemesMigrationStore drives doSpaceSchemesCreationMigration with a
// Scheme().Save that always fails, standing in for the losing side of a
// concurrent HA insert, so the primary re-read and the adoption check run.
func spaceSchemesMigrationStore(t *testing.T, reread func(name string) (*model.Scheme, error)) *mocks.Store {
	t.Helper()
	mockStore := mocks.Store{}

	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", SpaceSchemesCreationMigrationKey).
		Return(nil, store.NewErrNotFound("System", SpaceSchemesCreationMigrationKey))
	mockSystemStore.On("SaveOrUpdate", mock.Anything).Return(nil)
	mockStore.On("System").Return(&mockSystemStore)

	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetByName", mock.Anything, mock.Anything).Return(
		func(ctx context.Context, name string) (*model.Scheme, error) {
			if store.HasMaster(ctx) {
				return reread(name)
			}
			return nil, store.NewErrNotFound("Scheme", name)
		})
	mockSchemeStore.On("Save", mock.Anything).Return(nil, errors.New("duplicate key"))
	mockStore.On("Scheme").Return(&mockSchemeStore)

	// The generated roles the closure reads back and rewrites.
	mockRoleStore := mocks.RoleStore{}
	mockRoleStore.On("GetByName", mock.Anything, mock.Anything).Return(
		func(_ context.Context, name string) (*model.Role, error) {
			return &model.Role{Name: name, Permissions: []string{model.PermissionCreatePost.Id}}, nil
		})
	mockRoleStore.On("Save", mock.Anything).Return(
		func(role *model.Role) (*model.Role, error) { return role, nil })
	mockStore.On("Role").Return(&mockRoleStore)

	mockStore.On("Close").Return(nil)
	return &mockStore
}

func adoptableSpaceScheme(name string) *model.Scheme {
	return &model.Scheme{
		Id:                      model.NewId(),
		Name:                    name,
		Scope:                   model.SchemeScopeChannel,
		DefaultChannelUserRole:  model.NewId(),
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelGuestRole: model.NewId(),
	}
}

func TestSpaceSchemesMigrationRecoversFromLostInsertRace(t *testing.T) {
	t.Run("re-read finding an adoptable scheme completes the migration", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		th.App.Srv().SetStore(spaceSchemesMigrationStore(t, func(name string) (*model.Scheme, error) {
			return adoptableSpaceScheme(name), nil
		}))

		require.NoError(t, th.Server.doSpaceSchemesCreationMigration())
	})

	t.Run("re-read finding a wrong-scope scheme fails the migration", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		th.App.Srv().SetStore(spaceSchemesMigrationStore(t, func(name string) (*model.Scheme, error) {
			squatted := adoptableSpaceScheme(name)
			squatted.Scope = model.SchemeScopeTeam
			return squatted, nil
		}))

		require.Error(t, th.Server.doSpaceSchemesCreationMigration(),
			"a scheme squatting a preset name must not be adopted and rewritten")
	})

	t.Run("re-read finding a soft-deleted scheme fails the migration", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		th.App.Srv().SetStore(spaceSchemesMigrationStore(t, func(name string) (*model.Scheme, error) {
			deleted := adoptableSpaceScheme(name)
			deleted.DeleteAt = model.GetMillis()
			return deleted, nil
		}))

		require.Error(t, th.Server.doSpaceSchemesCreationMigration(),
			"adopting a deleted row would complete the migration with no live preset")
	})

	t.Run("re-read also missing fails the migration", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		th.App.Srv().SetStore(spaceSchemesMigrationStore(t, func(name string) (*model.Scheme, error) {
			return nil, store.NewErrNotFound("Scheme", name)
		}))

		require.Error(t, th.Server.doSpaceSchemesCreationMigration())
	})
}

// TestUpdateChannelMemberRolesOnSpace covers promoting a member of a space backing channel.
// Spaces are opaque to the generic channel resolver, so scheme-role lookup has to reach them
// by their exact type; otherwise every role assignment on a freshly created space 404s.
func TestUpdateChannelMemberRolesOnSpace(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	scheme := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	space := saveSpaceChannelWithScheme(t, th, scheme.Id)
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, false)

	member, appErr := th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser.Id,
		scheme.DefaultChannelUserRole+" "+scheme.DefaultChannelAdminRole)
	require.Nil(t, appErr, "promoting a space member must resolve the space scheme roles")
	assert.True(t, member.SchemeUser)
	assert.True(t, member.SchemeAdmin)

	guest, user, admin, appErr := th.App.GetSchemeRolesForChannel(th.Context, space.Id)
	require.Nil(t, appErr)
	assert.Equal(t, scheme.DefaultChannelGuestRole, guest)
	assert.Equal(t, scheme.DefaultChannelUserRole, user)
	assert.Equal(t, scheme.DefaultChannelAdminRole, admin)
}

// TestSpaceGuardsHoldWithFlagOff pins that the two scope guards stay active on a
// server where Docs is off. The permissions, roles and preset schemes are seeded
// unconditionally at boot, so they exist and resolve regardless of the flag; a
// grant or a name squat planted during the flag-off window would survive the flip
// and nothing re-validates stored rows at enable time.
func TestSpaceGuardsHoldWithFlagOff(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)
	require.False(t, th.App.Config().FeatureFlags.EnableDocs, "the flag must default off")

	t.Run("permission scope guard still rejects a built-in role", func(t *testing.T) {
		role := &model.Role{Name: model.TeamUserRoleId, Permissions: []string{model.PermissionAdminSpace.Id}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
	})

	t.Run("scheme name guard still rejects a reserved preset name", func(t *testing.T) {
		appErr := th.App.checkSpaceSchemeName("CreateScheme", model.SchemeNameSpaceContribute)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.space_scheme_name.app_error", appErr.Id)
	})

	t.Run("a role adding no space permission is still unaffected", func(t *testing.T) {
		role := &model.Role{Name: model.TeamUserRoleId, Permissions: []string{model.PermissionCreatePost.Id}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, nil))
	})
}
