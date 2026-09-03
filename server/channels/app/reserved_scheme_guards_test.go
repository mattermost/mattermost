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

func TestReservedSchemeIdentityGuards(t *testing.T) {
	pluginName := model.PluginChannelSchemeName(testPluginID, nil, nil, nil)

	t.Run("a reserved name cannot be created", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)

		_, appErr := th.App.CreateScheme(&model.Scheme{Name: pluginName, DisplayName: "x", Scope: model.SchemeScopeChannel})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.plugin_scheme_name.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
	})

	t.Run("a reserved scheme cannot be deleted", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id: schemeID, Name: pluginName, Scope: model.SchemeScopeChannel,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		_, appErr := th.App.DeleteScheme(schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.delete.plugin_scheme.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("an ordinary scheme is still deletable", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)
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

	// Renaming a reserved scheme away from its name would unfreeze its roles while every
	// channel on it kept resolving them, so the rename is refused. The operator-facing
	// display name is not part of the identity and stays editable.
	t.Run("a reserved scheme cannot be renamed away", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)
		stored := reservedSchemeFixture(pluginName)
		renamed := *stored
		renamed.Name = model.NewId()

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", stored.Id).Return(stored, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		appErr := th.App.checkSpaceSchemeUpdate(&renamed)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.plugin_scheme_rename.app_error", appErr.Id)

		relabelled := *stored
		relabelled.DisplayName = "Renamed for operators"
		require.Nil(t, th.App.checkSpaceSchemeUpdate(&relabelled))
	})

	t.Run("a reserved scheme cannot be repointed at other generated roles", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)
		stored := reservedSchemeFixture(pluginName)
		updated := *stored
		updated.DefaultChannelUserRole = model.NewId()

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", stored.Id).Return(stored, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		appErr := th.App.checkSpaceSchemeUpdate(&updated)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.plugin_scheme_roles.app_error", appErr.Id)
	})

	// A scope flip would make reservedSchemeKindOf stop classifying the row as reserved,
	// unfreezing its name and generated roles on every later write.
	t.Run("a reserved scheme cannot change scope", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)
		stored := reservedSchemeFixture(pluginName)
		rescoped := *stored
		rescoped.Scope = model.SchemeScopeTeam

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", stored.Id).Return(stored, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		appErr := th.App.checkSpaceSchemeUpdate(&rescoped)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.plugin_scheme_scope.app_error", appErr.Id)
	})
}

func reservedSchemeFixture(name string) *model.Scheme {
	return &model.Scheme{
		Id:                      model.NewId(),
		Name:                    name,
		Scope:                   model.SchemeScopeChannel,
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelUserRole:  model.NewId(),
		DefaultChannelGuestRole: model.NewId(),
	}
}

// Generated roles are definitions shared by every channel on their scheme. They are changed by
// resolving another plugin scheme, never by editing the shared row. Exercise both public
// application write paths against all three role classes; checking the store afterward makes the
// rejection, not merely its error, the invariant under test.
func TestPluginSchemeGeneratedRolesAreImmutable(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	scheme, appErr := th.App.GetOrCreatePluginChannelScheme(
		testPluginID+"."+model.NewId(),
		[]string{model.PermissionReadChannel.Id},
		[]string{model.PermissionManagePublicChannelMembers.Id},
		[]string{model.PermissionReadChannel.Id},
	)
	require.Nil(t, appErr)

	for _, roleCase := range []struct {
		name     string
		roleName string
	}{
		{name: "guest", roleName: scheme.DefaultChannelGuestRole},
		{name: "user", roleName: scheme.DefaultChannelUserRole},
		{name: "admin", roleName: scheme.DefaultChannelAdminRole},
	} {
		t.Run(roleCase.name, func(t *testing.T) {
			role, err := th.App.Srv().Store().Role().GetByName(th.Context, roleCase.roleName)
			require.NoError(t, err)
			original := append([]string(nil), role.Permissions...)
			require.NotContains(t, original, model.PermissionCreatePost.Id)
			changed := append(append([]string(nil), original...), model.PermissionCreatePost.Id)

			_, appErr := th.App.PatchRole(role, &model.RolePatch{Permissions: &changed})
			require.NotNil(t, appErr)
			assert.Equal(t, "app.role.save.plugin_scheme_role.app_error", appErr.Id)

			stored, err := th.App.Srv().Store().Role().GetByName(th.Context, roleCase.roleName)
			require.NoError(t, err)
			assert.ElementsMatch(t, original, stored.Permissions)

			stored.Permissions = changed
			_, appErr = th.App.UpdateRole(stored)
			require.NotNil(t, appErr)
			assert.Equal(t, "app.role.save.plugin_scheme_role.app_error", appErr.Id)

			stored, err = th.App.Srv().Store().Role().GetByName(th.Context, roleCase.roleName)
			require.NoError(t, err)
			assert.ElementsMatch(t, original, stored.Permissions)
		})
	}
}
