// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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
