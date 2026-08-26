// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

const testPluginID = "com.example.plugin"

// setupPluginSchemeMock builds a store-mock helper with the phase 2 permissions
// migration marked complete. GetOrCreatePluginChannelScheme refuses to run before
// it, and that refusal is the same one every scheme call shares — pinned once in
// TestGetOrCreatePluginChannelScheme rather than mocked around in every case.
func setupPluginSchemeMock(t *testing.T) *TestHelper {
	th := SetupWithStoreMock(t)
	th.App.Srv().phase2PermissionsMigrationComplete = true
	return th
}

// pluginSchemeRoles builds the three stored roles a conforming scheme has, so a
// case that is not about role contents does not have to spell them out.
func pluginSchemeRoles(scheme *model.Scheme, user, admin, guest []string) []*model.Role {
	return []*model.Role{
		{Name: scheme.DefaultChannelUserRole, Permissions: user},
		{Name: scheme.DefaultChannelAdminRole, Permissions: admin},
		{Name: scheme.DefaultChannelGuestRole, Permissions: guest},
	}
}

func pluginScheme(name string) *model.Scheme {
	return &model.Scheme{
		Id:                      model.NewId(),
		Name:                    name,
		Scope:                   model.SchemeScopeChannel,
		DefaultChannelUserRole:  model.NewId(),
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelGuestRole: model.NewId(),
	}
}

func TestGetOrCreatePluginChannelScheme(t *testing.T) {
	user := []string{model.PermissionReadPage.Id}
	admin := []string{model.PermissionAdminSpace.Id}
	guest := []string{model.PermissionReadPage.Id}

	t.Run("refused before the phase 2 migration completes", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := SetupWithStoreMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSystemStore := mocks.SystemStore{}
		mockSystemStore.On("GetByName", model.MigrationKeyAdvancedPermissionsPhase2).
			Return(nil, store.NewErrNotFound("System", model.MigrationKeyAdvancedPermissionsPhase2))
		mockStore.On("System").Return(&mockSystemStore)

		_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.schemes.is_phase_2_migration_completed.not_completed.app_error", appErr.Id)
	})

	t.Run("no plugin id is refused", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		_, appErr := th.App.GetOrCreatePluginChannelScheme("", user, admin, guest)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.plugin_scheme.no_plugin_id.app_error", appErr.Id)
	})

	// A generated channel role resolves only where its scheme is attached, so a
	// permission of another scope is refused rather than dropped — the caller
	// otherwise gets a scheme back and no sign that part of its request did not
	// land.
	t.Run("a permission outside channel scope is refused before any store read", func(t *testing.T) {
		mainHelper.Parallel(t)

		for _, tc := range []struct {
			name               string
			user, admin, guest []string
		}{
			{"team-scoped on the user role", []string{model.PermissionInviteUser.Id}, admin, guest},
			{"system-scoped on the admin role", user, []string{model.PermissionManageSystem.Id}, guest},
			{"team-scoped on the guest role", user, admin, []string{model.PermissionViewTeam.Id}},
		} {
			t.Run(tc.name, func(t *testing.T) {
				th := setupPluginSchemeMock(t)

				mockStore := th.App.Srv().Store().(*mocks.Store)
				mockSchemeStore := mocks.SchemeStore{}
				mockStore.On("Scheme").Return(&mockSchemeStore)

				_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, tc.user, tc.admin, tc.guest)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.scheme.plugin_scheme.permission_scope.app_error", appErr.Id)
				mockSchemeStore.AssertNotCalled(t, "GetByNameFromMaster", mock.Anything)
			})
		}
	})

	// The scheme pool is generic: it accepts any channel-scoped permission without
	// applying policy for a particular channel type or plugin.
	t.Run("channel-scoped guest permissions reach the store unchanged", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		requestedGuest := []string{model.PermissionReadPage.Id, model.PermissionEditPage.Id, model.PermissionCreatePost.Id}
		name := model.PluginChannelSchemeName(testPluginID, user, admin, requestedGuest)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).Return(nil, store.NewErrNotFound("Scheme", name))
		mockSchemeStore.On("SaveChannelSchemeWithRoles", mock.Anything, user, admin, requestedGuest).
			Return(pluginScheme(name), nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		scheme, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, requestedGuest)
		require.Nil(t, appErr)
		require.NotNil(t, scheme)
		mockSchemeStore.AssertCalled(t, "SaveChannelSchemeWithRoles", mock.Anything, user, admin, requestedGuest)
	})

	// The second caller asking for the same sets gets the first caller's scheme.
	// This is the whole point of the pooling: one scheme per distinct
	// configuration, not one per object configured.
	t.Run("an existing conforming scheme is returned without a save", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)
		existing := pluginScheme(name)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).Return(existing, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockRoleStore.On("GetByNamesFromMaster", mock.Anything).
			Return(pluginSchemeRoles(existing, user, admin, guest), nil)
		mockStore.On("Role").Return(&mockRoleStore)

		scheme, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.Nil(t, appErr)
		assert.Equal(t, existing.Id, scheme.Id)
		mockSchemeStore.AssertNotCalled(t, "SaveChannelSchemeWithRoles", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	// Order and repetition are the caller's, not the scheme's: the name is derived
	// from the canonical form of the sets, so a caller passing the same permissions
	// differently must land on the same scheme rather than create a second one.
	t.Run("reordered and repeated permissions resolve the same scheme", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		wideUser := []string{model.PermissionReadPage.Id, model.PermissionCreatePage.Id}
		name := model.PluginChannelSchemeName(testPluginID, wideUser, admin, guest)
		existing := pluginScheme(name)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).Return(existing, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockRoleStore.On("GetByNamesFromMaster", mock.Anything).
			Return(pluginSchemeRoles(existing, wideUser, admin, guest), nil)
		mockStore.On("Role").Return(&mockRoleStore)

		scheme, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID,
			[]string{model.PermissionCreatePage.Id, model.PermissionReadPage.Id, model.PermissionReadPage.Id},
			admin, guest)
		require.Nil(t, appErr)
		assert.Equal(t, existing.Id, scheme.Id)
	})

	// The name is derived, not allocated, so whatever sits at it is unverified
	// input. Payload equality is the test, not the name — and a mismatch is
	// refused rather than repaired, since these roles govern every channel already
	// pointing at the scheme.
	t.Run("a scheme occupying the name that does not conform is refused", func(t *testing.T) {
		mainHelper.Parallel(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)

		for _, tc := range []struct {
			name    string
			scheme  func() *model.Scheme
			roles   func(*model.Scheme) []*model.Role
			noRoles bool
		}{
			{
				name:   "wrong permissions on a role",
				scheme: func() *model.Scheme { return pluginScheme(name) },
				roles: func(s *model.Scheme) []*model.Role {
					return pluginSchemeRoles(s, []string{model.PermissionDeletePage.Id}, admin, guest)
				},
			},
			{
				name:   "extra permission on a role",
				scheme: func() *model.Scheme { return pluginScheme(name) },
				roles: func(s *model.Scheme) []*model.Role {
					return pluginSchemeRoles(s, append(append([]string{}, user...), model.PermissionDeletePage.Id), admin, guest)
				},
			},
			{
				name:   "a generated role is missing",
				scheme: func() *model.Scheme { return pluginScheme(name) },
				roles: func(s *model.Scheme) []*model.Role {
					return pluginSchemeRoles(s, user, admin, guest)[:2]
				},
			},
			{
				name: "wrong scope",
				scheme: func() *model.Scheme {
					s := pluginScheme(name)
					s.Scope = model.SchemeScopeTeam
					return s
				},
				noRoles: true,
			},
			{
				// A soft-deleted row still occupies the name — the read carries no
				// DeleteAt filter and Schemes.Name is unique across deleted rows —
				// so returning it would hand back a scheme no channel can be
				// attached to.
				name: "soft-deleted",
				scheme: func() *model.Scheme {
					s := pluginScheme(name)
					s.DeleteAt = model.GetMillis()
					return s
				},
				noRoles: true,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				th := setupPluginSchemeMock(t)
				occupant := tc.scheme()

				mockStore := th.App.Srv().Store().(*mocks.Store)
				mockSchemeStore := mocks.SchemeStore{}
				mockSchemeStore.On("GetByNameFromMaster", name).Return(occupant, nil)
				mockStore.On("Scheme").Return(&mockSchemeStore)
				mockRoleStore := mocks.RoleStore{}
				if !tc.noRoles {
					mockRoleStore.On("GetByNamesFromMaster", mock.Anything).Return(tc.roles(occupant), nil)
				}
				mockStore.On("Role").Return(&mockRoleStore)

				_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.scheme.plugin_scheme.conflict.app_error", appErr.Id)
				mockSchemeStore.AssertNotCalled(t, "SaveChannelSchemeWithRoles", mock.Anything, mock.Anything, mock.Anything, mock.Anything)

				if tc.noRoles {
					// The scheme is refused on its own row, so the role read is
					// never priced.
					mockRoleStore.AssertNotCalled(t, "GetByNamesFromMaster", mock.Anything)
				}
			})
		}
	})

	t.Run("nothing at the name is created", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)
		created := pluginScheme(name)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).Return(nil, store.NewErrNotFound("Scheme", name))
		mockSchemeStore.On("SaveChannelSchemeWithRoles", mock.Anything, user, admin, guest).
			Return(created, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockStore.On("Role").Return(&mockRoleStore)

		scheme, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.Nil(t, appErr)
		assert.Equal(t, created.Id, scheme.Id)

		saved := mockSchemeStore.Calls[1].Arguments.Get(0).(*model.Scheme)
		assert.Equal(t, name, saved.Name, "the scheme is saved under the derived name")
		assert.Equal(t, model.SchemeScopeChannel, saved.Scope)
		assert.Empty(t, saved.Id, "the store assigns the id")
	})

	// The loser of a concurrent first use adopts the winner's scheme instead of
	// failing: the name is unique, so the losing insert is the expected outcome,
	// and the winner's scheme is complete by the time it is visible.
	t.Run("a lost create race adopts the winner's scheme", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)
		winner := pluginScheme(name)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).
			Return(nil, store.NewErrNotFound("Scheme", name)).Once()
		mockSchemeStore.On("SaveChannelSchemeWithRoles", mock.Anything, user, admin, guest).
			Return(nil, errors.New("duplicate key value violates unique constraint"))
		mockSchemeStore.On("GetByNameFromMaster", name).Return(winner, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockRoleStore.On("GetByNamesFromMaster", mock.Anything).
			Return(pluginSchemeRoles(winner, user, admin, guest), nil)
		mockStore.On("Role").Return(&mockRoleStore)

		scheme, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.Nil(t, appErr)
		assert.Equal(t, winner.Id, scheme.Id)
	})

	// The adoption re-read is not a blanket retry: a save that failed for a reason
	// other than losing the race leaves nothing at the name, and the caller must
	// hear about it rather than get a silent nil.
	t.Run("a save failure with nothing to adopt is reported", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).Return(nil, store.NewErrNotFound("Scheme", name))
		mockSchemeStore.On("SaveChannelSchemeWithRoles", mock.Anything, user, admin, guest).
			Return(nil, errors.New("connection refused"))
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockStore.On("Role").Return(&mockRoleStore)

		_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.app_error", appErr.Id)
	})

	t.Run("a failed adoption re-read is reported", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).
			Return(nil, store.NewErrNotFound("Scheme", name)).Once()
		mockSchemeStore.On("SaveChannelSchemeWithRoles", mock.Anything, user, admin, guest).
			Return(nil, errors.New("duplicate key"))
		mockSchemeStore.On("GetByNameFromMaster", name).
			Return(nil, errors.New("primary unavailable")).Once()
		mockStore.On("Scheme").Return(&mockSchemeStore)

		_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.get.app_error", appErr.Id)
		require.EqualError(t, appErr.Unwrap(), "primary unavailable")
	})

	t.Run("an AppError returned by the store is preserved", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)
		storeAppErr := model.NewAppError("SaveChannelSchemeWithRoles", "store.scheme.save.app_error", nil, "", http.StatusConflict)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).
			Return(nil, store.NewErrNotFound("Scheme", name)).Twice()
		mockSchemeStore.On("SaveChannelSchemeWithRoles", mock.Anything, user, admin, guest).
			Return(nil, storeAppErr)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.Same(t, storeAppErr, appErr)
	})

	t.Run("an invalid scheme rejected by the store is reported as a bad request", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).Return(nil, store.NewErrNotFound("Scheme", name))
		mockSchemeStore.On("SaveChannelSchemeWithRoles", mock.Anything, user, admin, guest).
			Return(nil, store.NewErrInvalidInput("Scheme", "Scope", model.SchemeScopeTeam))
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockStore.On("Role").Return(&mockRoleStore)

		_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.invalid_scheme.app_error", appErr.Id)
	})

	// A read failure is not a missing scheme. Treating it as one would send the
	// caller into the create path and create a duplicate of a scheme that is merely
	// unreadable right now.
	t.Run("a scheme read failure is reported, not read as absent", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).Return(nil, errors.New("connection refused"))
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockStore.On("Role").Return(&mockRoleStore)

		_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.get.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "SaveChannelSchemeWithRoles", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("a role read failure is reported", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		name := model.PluginChannelSchemeName(testPluginID, user, admin, guest)
		existing := pluginScheme(name)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", name).Return(existing, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockRoleStore.On("GetByNamesFromMaster", mock.Anything).Return(nil, errors.New("connection refused"))
		mockStore.On("Role").Return(&mockRoleStore)

		_, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.get_by_names.app_error", appErr.Id)
	})

	// Ownership rides in the name's first digest, so one plugin cannot resolve or
	// displace another's scheme even when both ask for identical permission sets.
	t.Run("two plugins asking for the same sets resolve different schemes", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupPluginSchemeMock(t)

		ourName := model.PluginChannelSchemeName(testPluginID, user, admin, guest)
		theirName := model.PluginChannelSchemeName("com.example.other", user, admin, guest)
		require.NotEqual(t, ourName, theirName)

		theirs := pluginScheme(theirName)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetByNameFromMaster", theirName).Return(theirs, nil)
		mockSchemeStore.On("GetByNameFromMaster", ourName).Return(nil, store.NewErrNotFound("Scheme", ourName))
		mockSchemeStore.On("SaveChannelSchemeWithRoles", mock.Anything, user, admin, guest).
			Return(pluginScheme(ourName), nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockRoleStore := mocks.RoleStore{}
		mockStore.On("Role").Return(&mockRoleStore)

		scheme, appErr := th.App.GetOrCreatePluginChannelScheme(testPluginID, user, admin, guest)
		require.Nil(t, appErr)
		assert.Equal(t, ourName, scheme.Name)
		assert.NotEqual(t, theirs.Id, scheme.Id)
	})
}
