// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
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
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("system-scoped role rejected (the live fallback surface)", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.SystemUserRoleId, Permissions: []string{guarded}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
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
			appErr := th.App.checkSpacePermissionScope(role, nil)
			assert.NotNil(t, appErr, "role %q", name)
			assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id, "role %q", name)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode, "role %q", name)
		}
	})

	t.Run("space capability role names rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		role := &model.Role{Name: model.SpacePageCommenterRoleId, Permissions: append(
			model.PermissionIDs(model.SpaceCapabilityRolePermissions[model.SpacePageCommenterRoleId]), model.PermissionAdminSpace.Id)}
		appErr := th.App.checkSpacePermissionScope(role, model.PermissionIDs(model.SpaceCapabilityRolePermissions[model.SpacePageCommenterRoleId]))
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_capability_role.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	// The name-based rejects above all run with a nil SchemeId, where the final
	// fail-closed fallthrough would refuse the write anyway. Pairing each name
	// with a scheme that genuinely proves space scope — a custom scheme a space
	// backing channel points at — is the only shape that tells the two apart:
	// without the name checks these would be allowed.
	t.Run("guarded role names rejected even when their scheme proves space scope", func(t *testing.T) {
		mainHelper.Parallel(t)

		for _, tc := range []struct {
			name  string
			errID string
		}{
			{model.SpacePageCommenterRoleId, "app.role.save.space_capability_role.app_error"},
			{model.TeamUserRoleId, "app.role.save.space_permission_scope.app_error"},
			{model.ChannelUserRoleId, "app.role.save.space_permission_scope.app_error"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				th := setupSpaceRBACMock(t)

				schemeID := model.NewId()
				mockStore := th.App.Srv().Store().(*mocks.Store)
				mockSchemeStore := mocks.SchemeStore{}
				mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
					Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel,
				}, nil)
				mockStore.On("Scheme").Return(&mockSchemeStore)
				mockChannelStore := mocks.ChannelStore{}
				mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(1), nil)
				mockChannelStore.On("CountNonSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
				mockStore.On("Channel").Return(&mockChannelStore)

				role := &model.Role{Name: tc.name, SchemeId: &schemeID, Permissions: []string{guarded}}
				appErr := th.App.checkSpacePermissionScope(role, nil)
				require.NotNil(t, appErr, "role %q must be rejected by name, not by the nil-SchemeId fallthrough", tc.name)
				assert.Equal(t, tc.errID, appErr.Id, "role %q", tc.name)
				assert.Equal(t, http.StatusBadRequest, appErr.StatusCode, "role %q", tc.name)
			})
		}
	})

	// The roles generated for a seeded preset are shared by every space pointing
	// at it, and the completed seeding migration never repairs them, so the guard
	// freezes them outright rather than reading the preset name as an accept: a
	// diff-based guard would pass a write that only removes a grant, or one that
	// changes something the diff does not watch.
	t.Run("preset-generated role frozen in both directions", func(t *testing.T) {
		mainHelper.Parallel(t)

		for _, tc := range []struct {
			name        string
			permissions []string
			stored      []string
		}{
			{"adding a guarded permission", []string{guarded}, nil},
			{"removing a guarded permission", []string{}, []string{guarded}},
			{"a write changing no permission", []string{guarded}, []string{guarded}},
		} {
			t.Run(tc.name, func(t *testing.T) {
				th := setupSpaceRBACMock(t)

				schemeID := model.NewId()
				mockStore := th.App.Srv().Store().(*mocks.Store)
				mockSchemeStore := mocks.SchemeStore{}
				mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel}, nil)
				mockStore.On("Scheme").Return(&mockSchemeStore)

				role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, SchemeManaged: true, Permissions: tc.permissions}
				appErr := th.App.checkSpacePermissionScope(role, tc.stored)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.role.save.space_preset_role.app_error", appErr.Id)
			})
		}
	})

	// The freeze needs the scheme, so scheme-role writes now pay one primary
	// lookup even without a guarded permission — and are then let through when
	// the scheme is not a preset.
	t.Run("ordinary scheme role write with no guarded permission is allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, SchemeManaged: true, Permissions: []string{model.PermissionInviteUser.Id}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	// No runtime role write adds a space permission, whatever the scheme governs.
	// A scheme's roles are written with their final permissions in the transaction
	// that creates the scheme, so there is no legitimate later writer to admit —
	// and the association counts that used to prove space scope are never read.
	t.Run("scheme-generated role rejected whatever the scheme governs", func(t *testing.T) {
		for _, tc := range []struct {
			name       string
			guestRole  bool
			permission string
		}{
			{"user role, read grant", false, model.PermissionReadPage.Id},
			{"user role, write grant", false, model.PermissionEditPage.Id},
			{"guest role, read grant", true, model.PermissionReadPage.Id},
			{"guest role, write grant", true, model.PermissionEditPage.Id},
		} {
			t.Run(tc.name, func(t *testing.T) {
				mainHelper.Parallel(t)
				th := setupSpaceRBACMock(t)

				schemeID := model.NewId()
				guestRoleName := model.NewId()
				mockStore := th.App.Srv().Store().(*mocks.Store)
				mockSchemeStore := mocks.SchemeStore{}
				mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
					Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel,
					DefaultChannelGuestRole: guestRoleName,
				}, nil)
				mockStore.On("Scheme").Return(&mockSchemeStore)
				mockChannelStore := mocks.ChannelStore{}
				mockStore.On("Channel").Return(&mockChannelStore)

				roleName := model.NewId()
				if tc.guestRole {
					roleName = guestRoleName
				}
				role := &model.Role{Name: roleName, SchemeId: &schemeID, SchemeManaged: true, Permissions: []string{tc.permission}}
				appErr := th.App.checkSpacePermissionScope(role, nil)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
				mockChannelStore.AssertNotCalled(t, "CountSpaceChannelsByScheme", mock.Anything)
				mockChannelStore.AssertNotCalled(t, "CountNonSpaceChannelsByScheme", mock.Anything)
			})
		}
	})

	// A plugin channel scheme is created complete and shared by every channel its
	// owner configured the same way, so its roles are frozen against any write —
	// not only one carrying a space permission.
	t.Run("plugin scheme role rejected even for an unguarded permission", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id:    schemeID,
			Name:  model.PluginChannelSchemeName("com.example.plugin", []string{model.PermissionReadPage.Id}, nil, nil),
			Scope: model.SchemeScopeChannel,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, SchemeManaged: true, Permissions: []string{model.PermissionInviteUser.Id}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.plugin_scheme_role.app_error", appErr.Id)
	})

	// The freeze tests the whole minted shape, not the prefix. A customer scheme
	// that merely starts with it is theirs to edit, and misreading one as minted
	// would leave it permanently uneditable.
	t.Run("a scheme merely prefixed plugin_ is not frozen", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id:    schemeID,
			Name:  "plugin_incident_response",
			Scope: model.SchemeScopeChannel,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, SchemeManaged: true, Permissions: []string{model.PermissionInviteUser.Id}}
		assert.Nil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	// Scope is half the proof: only a channel-scoped scheme can govern a space,
	// so a scheme of another scope is refused without asking the count.
	t.Run("scheme at the wrong scope rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeTeam,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, nil))
		mockChannelStore.AssertNotCalled(t, "CountSpaceChannelsByScheme", mock.Anything)
	})

	// A scheme that cannot be read is still refused, and as a server error rather
	// than a scope violation: reporting it as the latter would blame the caller for
	// an unreachable database.
	t.Run("scheme read error is a server error", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(nil, errors.New("db down"))
		mockStore.On("Scheme").Return(&mockSchemeStore)

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
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
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
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
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
		mockSchemeStore.On("GetFromMaster", schemeID).Return(nil, errors.New("connection reset"))
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
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{Id: schemeID, Scope: model.SchemeScopeTeam}, nil)
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
		mockSchemeStore.On("GetFromMaster", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		require.NotNil(t, th.App.checkSpacePermissionScope(role, nil))
	})

	// A scheme created moments earlier is absent from the replica, and one just
	// deleted is still live there. The guard reads the primary for both, so the
	// replica's answer never reaches the decision.
	t.Run("scheme resolved on the primary, never the replica", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("Get", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id:    schemeID,
			Name:  model.SchemeNameSpaceContribute,
			Scope: model.SchemeScopeChannel,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, SchemeManaged: true, Permissions: []string{guarded}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr)
		// Only the primary's row carries the preset identity this refusal is
		// keyed on; the replica answered not-found, which would have failed
		// closed with the scope error instead.
		assert.Equal(t, "app.role.save.space_preset_role.app_error", appErr.Id)
	})

	// Deleting a scheme blanks SchemeId on every channel that used it, so the
	// space-association count below cannot catch a deleted scheme either — the
	// DeleteAt refusal is the only thing standing between a scheme on its way out
	// and a role write taking space authority on it.
	t.Run("a soft-deleted scheme proves nothing and fails closed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		// A seeded preset name, which would otherwise prove space scope outright.
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id:       schemeID,
			Name:     model.SchemeNameSpaceContribute,
			Scope:    model.SchemeScopeChannel,
			DeleteAt: model.GetMillis(),
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)

		role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
		appErr := th.App.checkSpacePermissionScope(role, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
		mockChannelStore.AssertNotCalled(t, "CountSpaceChannelsByScheme", mock.Anything)
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
		mockRoleStore.On("GetFromMaster", roleID).Return(&model.Role{
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
		// The replica read would present a baseline that a peer node's removal
		// may not have reached yet, so the guard must not fall back to it.
		mockRoleStore.AssertNotCalled(t, "Get", mock.Anything)
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
		Id:                      model.NewId(),
		Name:                    model.SchemeNameSpaceContribute,
		Scope:                   model.SchemeScopeChannel,
		DefaultChannelUserRole:  model.NewId(),
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelGuestRole: model.NewId(),
	}

	// governs counts the ordinary channels on the scheme; it excludes spaces, so
	// a non-zero count means the scheme belongs to a customer's channels.
	setup := func(t *testing.T, governs int64) *TestHelper {
		th := setupSpaceRBACMock(t)
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountNonSpaceChannelsByScheme", mock.AnythingOfType("string")).Return(governs, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		return th
	}

	t.Run("canonical row accepted", func(t *testing.T) {
		th := setup(t, 0)
		require.NoError(t, th.App.Srv().validateAdoptableSpaceScheme(canonical))
	})

	// Each rejection below varies one field from the canonical row, and asserts on
	// the message, so a check firing for the wrong reason does not read as a pass.
	t.Run("soft-deleted row rejected", func(t *testing.T) {
		// GetByName has no DeleteAt filter, so a deleted row reaches the check.
		th := setup(t, 0)
		foreign := *canonical
		foreign.DeleteAt = 1
		require.ErrorContains(t, th.App.Srv().validateAdoptableSpaceScheme(&foreign), "is deleted")
	})

	t.Run("wrong scope rejected", func(t *testing.T) {
		th := setup(t, 0)
		foreign := *canonical
		foreign.Scope = model.SchemeScopeTeam
		require.ErrorContains(t, th.App.Srv().validateAdoptableSpaceScheme(&foreign), "with scope")
	})

	t.Run("incomplete generated roles rejected", func(t *testing.T) {
		th := setup(t, 0)
		for _, blank := range []func(*model.Scheme){
			func(s *model.Scheme) { s.DefaultChannelUserRole = "" },
			func(s *model.Scheme) { s.DefaultChannelAdminRole = "" },
			func(s *model.Scheme) { s.DefaultChannelGuestRole = "" },
		} {
			foreign := *canonical
			blank(&foreign)
			require.ErrorContains(t, th.App.Srv().validateAdoptableSpaceScheme(&foreign),
				"without a complete set of generated channel roles")
		}
	})

	t.Run("row governing ordinary channels rejected", func(t *testing.T) {
		// A customer scheme that predates the name reservation satisfies every
		// shape check above; adopting it would strip the moderated permissions
		// from the channels it governs.
		th := setup(t, 1)
		require.ErrorContains(t, th.App.Srv().validateAdoptableSpaceScheme(canonical),
			"governs non-space channels")
	})

	t.Run("duplicate generated roles rejected", func(t *testing.T) {
		// Two references converging on one row would merge that row's seeded
		// permission sets, giving the user or guest role the admin grants.
		th := setup(t, 0)
		foreign := *canonical
		foreign.DefaultChannelAdminRole = foreign.DefaultChannelUserRole
		require.ErrorContains(t, th.App.Srv().validateAdoptableSpaceScheme(&foreign),
			"not distinct")
	})
}

// validateAdoptableSpaceRole guards the capability-role seeding against name
// collisions: a row under a reserved name is adopted only when it is the row
// the migration would have written — matching permissions on a live,
// standalone, non-scheme-managed role. Each rejection asserts on the message,
// so a check firing for the wrong reason does not read as a pass.
func TestValidateAdoptableSpaceRole(t *testing.T) {
	mainHelper.Parallel(t)

	want := model.MakeDefaultRoles()[model.SpacePageEditorRoleId]
	canonical := func() *model.Role {
		return &model.Role{
			Name:        model.SpacePageEditorRoleId,
			Permissions: slices.Clone(want.Permissions),
		}
	}

	t.Run("canonical row accepted", func(t *testing.T) {
		require.NoError(t, validateAdoptableSpaceRole(model.SpacePageEditorRoleId, canonical(), want))
	})

	t.Run("different permission set rejected", func(t *testing.T) {
		stored := canonical()
		stored.Permissions = append(stored.Permissions, model.PermissionAdminSpace.Id)
		require.ErrorContains(t, validateAdoptableSpaceRole(model.SpacePageEditorRoleId, stored, want),
			"different permission set")
	})

	t.Run("deleted row rejected", func(t *testing.T) {
		// The role reads carry no DeleteAt filter, so a deleted row reaches the
		// validator like any other — adopting it would mark the migration
		// complete with no live capability role behind the reserved name.
		stored := canonical()
		stored.DeleteAt = 1
		require.ErrorContains(t, validateAdoptableSpaceRole(model.SpacePageEditorRoleId, stored, want),
			"is deleted")
	})

	t.Run("scheme-managed row rejected", func(t *testing.T) {
		// A scheme-managed row under the reserved name would be adopted as a
		// capability role yet refused by member assignment, which admits a
		// capability role as an explicit role only when it is standalone.
		stored := canonical()
		stored.SchemeManaged = true
		require.ErrorContains(t, validateAdoptableSpaceRole(model.SpacePageEditorRoleId, stored, want),
			"scheme-managed")
	})

	t.Run("scheme-owned row rejected", func(t *testing.T) {
		stored := canonical()
		schemeID := model.NewId()
		stored.SchemeId = &schemeID
		require.ErrorContains(t, validateAdoptableSpaceRole(model.SpacePageEditorRoleId, stored, want),
			"owned by scheme")
	})
}

// validateAdoptedSpaceSchemeRoles guards the scheme seeding against a scheme
// row whose generated-role references resolve to rows the scheme does not own:
// permission contents alone do not prove ownership, and the store-direct
// seeding below the runtime scope guard would add page and admin permissions
// to whatever row the reference names.
func TestValidateAdoptedSpaceSchemeRoles(t *testing.T) {
	mainHelper.Parallel(t)

	scheme := &model.Scheme{
		Id:                      model.NewId(),
		Name:                    model.SchemeNameSpaceContribute,
		Scope:                   model.SchemeScopeChannel,
		DefaultChannelUserRole:  model.NewId(),
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelGuestRole: model.NewId(),
	}

	generatedRole := func(name string, perms []*model.Permission) *model.Role {
		return &model.Role{
			Id:            model.NewId(),
			Name:          name,
			SchemeManaged: true,
			SchemeId:      &scheme.Id,
			Permissions:   model.PermissionIDs(perms),
		}
	}

	// setup mocks the three generated-role reads with canonical rows, then lets
	// the caller break one of them.
	setup := func(t *testing.T, mutate func(user, admin, guest *model.Role)) *TestHelper {
		th := setupSpaceRBACMock(t)

		user := generatedRole(scheme.DefaultChannelUserRole, model.SpaceDefaultContributePermissions)
		admin := generatedRole(scheme.DefaultChannelAdminRole, model.SpaceAdminRolePermissions)
		guest := generatedRole(scheme.DefaultChannelGuestRole, model.SpaceDefaultReadOnlyPermissions)
		if mutate != nil {
			mutate(user, admin, guest)
		}

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockRoleStore := mocks.RoleStore{}
		for _, role := range []*model.Role{user, admin, guest} {
			mockRoleStore.On("GetByNamesFromMaster", []string{role.Name}).Return([]*model.Role{role}, nil)
		}
		mockStore.On("Role").Return(&mockRoleStore)
		return th
	}

	userTarget := model.SpaceDefaultContributePermissions

	t.Run("canonical generated roles accepted", func(t *testing.T) {
		th := setup(t, nil)
		require.NoError(t, th.App.Srv().validateAdoptedSpaceSchemeRoles(scheme, userTarget))
	})

	t.Run("a role granting beyond the preset rejected", func(t *testing.T) {
		th := setup(t, func(user, admin, guest *model.Role) {
			user.Permissions = append(user.Permissions, model.PermissionManageTeam.Id)
		})
		require.ErrorContains(t, th.App.Srv().validateAdoptedSpaceSchemeRoles(scheme, userTarget),
			"which a seeded space preset never does")
	})

	t.Run("a deleted generated role rejected", func(t *testing.T) {
		th := setup(t, func(user, admin, guest *model.Role) {
			admin.DeleteAt = 1
		})
		require.ErrorContains(t, th.App.Srv().validateAdoptedSpaceSchemeRoles(scheme, userTarget),
			"is deleted")
	})

	t.Run("a non-scheme-managed generated role rejected", func(t *testing.T) {
		th := setup(t, func(user, admin, guest *model.Role) {
			guest.SchemeManaged = false
		})
		require.ErrorContains(t, th.App.Srv().validateAdoptedSpaceSchemeRoles(scheme, userTarget),
			"not scheme-managed")
	})

	t.Run("a generated role owned by another scheme rejected", func(t *testing.T) {
		foreignScheme := model.NewId()
		th := setup(t, func(user, admin, guest *model.Role) {
			user.SchemeId = &foreignScheme
		})
		require.ErrorContains(t, th.App.Srv().validateAdoptedSpaceSchemeRoles(scheme, userTarget),
			"not owned by it")
	})

	t.Run("a standalone role the reference resolves to rejected", func(t *testing.T) {
		// The direct-SQL collision shape: the scheme row names a role that was
		// never generated for it. Contents match, so only ownership refuses it.
		th := setup(t, func(user, admin, guest *model.Role) {
			user.SchemeManaged = false
			user.SchemeId = nil
		})
		require.ErrorContains(t, th.App.Srv().validateAdoptedSpaceSchemeRoles(scheme, userTarget),
			"not scheme-managed")
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
	scheme, err := th.App.Srv().Store().Scheme().GetByName(name)
	require.NoError(t, err, "seeding migration must have created scheme %q", name)
	return scheme
}

func storedRolePermissionSet(t *testing.T, th *TestHelper, roleName string) map[string]bool {
	t.Helper()
	role, err := th.App.Srv().Store().Role().GetByName(th.Context, roleName)
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
		_, err := th.App.Srv().Store().Role().GetByName(th.Context, roleID)
		require.NoError(t, err, "capability role %q must survive the reset", roleID)
	}
}

// TestSpaceSeedingMigrations asserts against a real database that the boot
// seeding created the space capability roles and the three preset schemes
// with exactly the canonical permission sets — moderated permissions stripped
// from the generated user and guest roles, the admin role granted the full
// admin slice.
func TestSpaceSeedingMigrations(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("space capability roles exist with canonical definitions", func(t *testing.T) {
		canonical := model.MakeDefaultRoles()
		for _, roleID := range []string{
			model.SpacePageCreatorRoleId,
			model.SpacePageCommenterRoleId,
			model.SpacePageEditorRoleId,
			model.SpacePageDeleterOwnRoleId,
			model.SpacePageDeleterRoleId,
		} {
			role, err := th.App.Srv().Store().Role().GetByName(th.Context, roleID)
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

	t.Run("space capability role in ExplicitRoles unions on top of a read-only default", func(t *testing.T) {
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

// TestSpaceCapabilityRolesPinnedPermissions mirrors the "space capability role
// in ExplicitRoles unions on top of a read-only default" subtest in
// TestSpacePresetResolutionThroughRealSpace, which only ever exercised
// SpacePageCreatorRoleId. Mutation analysis showed
// The delete-own and delete-any capability roles could
// be swapped in permission.go with no test failing, so each capability role
// here is pinned by both a permission it must grant and a permission held by
// its closest sibling that it must not.
func TestSpaceCapabilityRolesPinnedPermissions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	readOnly := getSeededSpaceScheme(t, th, model.SchemeNameSpaceReadOnly)
	space := saveSpaceChannelWithScheme(t, th, readOnly.Id)

	assignRole := func(roleName string) *model.User {
		user := th.CreateUser(t)
		_, err := th.App.Srv().Store().Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:     space.Id,
			UserId:        user.Id,
			NotifyProps:   model.GetDefaultChannelNotifyProps(),
			SchemeUser:    true,
			ExplicitRoles: roleName,
		})
		require.NoError(t, err)
		th.App.Srv().Store().Channel().InvalidateAllChannelMembersForUser(user.Id)
		return user
	}

	check := func(userID string, perm *model.Permission) bool {
		has, _ := th.App.HasPermissionToChannel(th.Context, userID, space.Id, perm)
		return has
	}

	t.Run("editor grants edit_page but not comment_page", func(t *testing.T) {
		editor := assignRole(model.SpacePageEditorRoleId)
		assert.True(t, check(editor.Id, model.PermissionEditPage))
		assert.False(t, check(editor.Id, model.PermissionCommentPage))
	})

	t.Run("commenter grants comment_page but not edit_page", func(t *testing.T) {
		commenter := assignRole(model.SpacePageCommenterRoleId)
		assert.True(t, check(commenter.Id, model.PermissionCommentPage))
		assert.False(t, check(commenter.Id, model.PermissionEditPage))
	})

	t.Run("deleter grants delete_page but not delete_own_page", func(t *testing.T) {
		deleter := assignRole(model.SpacePageDeleterRoleId)
		assert.True(t, check(deleter.Id, model.PermissionDeletePage))
		assert.False(t, check(deleter.Id, model.PermissionDeleteOwnPage))
	})

	t.Run("deleter_own grants delete_own_page but not delete_page", func(t *testing.T) {
		deleterOwn := assignRole(model.SpacePageDeleterOwnRoleId)
		assert.True(t, check(deleterOwn.Id, model.PermissionDeleteOwnPage))
		assert.False(t, check(deleterOwn.Id, model.PermissionDeletePage))
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

// TestCreateRoleClearsSchemeIdOnAcceptedRole covers the same clear on the path
// that reaches the store. Nothing else reads SchemeId to grant anything —
// permission merging keys off SchemeManaged, which CreateRole already clears. checkSpacePermissionScope is the first code to
// treat SchemeId as proof of scope, so the saved row must not carry one the
// caller chose.
func TestCreateRoleClearsSchemeIdOnAcceptedRole(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockRoleStore := mocks.RoleStore{}
	mockStore.On("Role").Return(&mockRoleStore)

	var saved *model.Role
	mockRoleStore.On("Save", mock.AnythingOfType("*model.Role")).
		Run(func(args mock.Arguments) {
			saved = args.Get(0).(*model.Role)
		}).
		Return(&model.Role{}, nil)

	schemeID := model.NewId()
	role := &model.Role{
		Name:        model.NewId(),
		DisplayName: "custom",
		SchemeId:    &schemeID,
		Permissions: []string{model.PermissionCreatePost.Id},
	}
	_, appErr := th.App.CreateRole(role)
	require.Nil(t, appErr)
	require.NotNil(t, saved)
	assert.Nil(t, saved.SchemeId, "the saved role must not carry a caller-supplied SchemeId")
}

// TestSpaceCapabilityRoleConfinedToSpaces pins that the space capability
// roles, which are excluded from BuiltInSchemeManagedRoleIDs so they can ride
// in ExplicitRoles, are refused by UpdateChannelMemberRoles on an ordinary
// channel and accepted there only once the channel resolves to a space. It
// settles that with a dedicated space lookup rather than the scheme-role
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

	// UpdateChannelMemberRoles still accepts an ordinary explicit role.
	member, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser.Id, model.ChannelUserRoleId)
	require.Nil(t, appErr)
	assert.Equal(t, "", member.ExplicitRoles)

	// On a space backing channel the same roles are the per-member capability
	// grants and must be accepted — the docs plugin writes them through
	// UpdateChannelMemberRoles alongside the scheme's generated user role.
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
// the UpdateChannelMemberRoles guard. A team member's roles are the fallback
// consulted for every channel in the team, so a capability role accepted here
// would grant space authority across all of them at once — wider than
// UpdateChannelMemberRoles refuses one channel at a time.
func TestSpaceCapabilityRoleConfinedToChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	for _, roleName := range model.SpaceCapabilityRoles {
		_, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, th.BasicUser.Id,
			model.TeamUserRoleId+" "+roleName)
		require.NotNil(t, appErr, "role %q", roleName)
		assert.Equal(t, "api.team.update_team_member_roles.space_role.app_error", appErr.Id, "role %q", roleName)
	}

	// UpdateTeamMemberRoles still accepts an ordinary role.
	member, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.TeamUserRoleId)
	require.Nil(t, appErr)
	assert.Equal(t, "", member.ExplicitRoles)
}

// TestSpaceCapabilityRoleConfinedToSystemRoles pins the third guarded
// role-assignment path, UpdateUserRoles. A system role is the fallback consulted
// for every channel on the server, so a capability role accepted here would be
// wider still than UpdateTeamMemberRoles refuses — and CheckRolesExist alone
// would accept it, since the capability
// roles are deliberately absent from BuiltInSchemeManagedRoleIDs.
func TestSpaceCapabilityRoleConfinedToSystemRoles(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	for _, roleName := range model.SpaceCapabilityRoles {
		_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id,
			model.SystemUserRoleId+" "+roleName, false)
		require.NotNil(t, appErr, "role %q", roleName)
		assert.Equal(t, "api.user.update_user_roles.space_role.app_error", appErr.Id, "role %q", roleName)
	}

	// UpdateUserRoles still accepts an ordinary system role.
	user, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId, false)
	require.Nil(t, appErr)
	assert.Equal(t, model.SystemUserRoleId, user.Roles)
}

// TestUpdateUserRolesToGuestRevokesSpaceCapabilityRoles pins the guest transition
// that does not go through DemoteUserToGuest. Nothing on the UpdateUserRoles path
// resets a membership's explicit roles, so a capability role left there would keep
// resolving page permissions for the new guest.
func TestUpdateUserRolesToGuestRevokesSpaceCapabilityRoles(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	user := th.CreateUser(t)
	th.LinkUserToTeam(t, user, th.BasicTeam)

	space := saveSpaceChannelWithScheme(t, th, "")
	_, err := th.App.Srv().Store().Channel().SaveMember(th.Context, &model.ChannelMember{
		ChannelId:     space.Id,
		UserId:        user.Id,
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
		SchemeUser:    true,
		ExplicitRoles: model.SpacePageEditorRoleId,
	})
	require.NoError(t, err)
	th.App.Srv().Store().Channel().InvalidateAllChannelMembersForUser(user.Id)

	updated, appErr := th.App.UpdateUserRoles(th.Context, user.Id, model.SystemGuestRoleId, false)
	require.Nil(t, appErr)
	assert.Equal(t, model.SystemGuestRoleId, updated.Roles)

	member, appErr := th.App.GetChannelMember(th.Context, space.Id, user.Id)
	require.Nil(t, appErr)
	assert.NotContains(t, member.ExplicitRoles, model.SpacePageEditorRoleId)
}

// TestImportSchemeRejectsSpacePresetNames pins that bulk import cannot write
// through a seeded preset. A reserved name resolves to the seeded scheme, which
// takes the update branch, and the role writes that follow would land on the
// roles every space on that preset resolves through — the scope guard waves them
// past because the scheme's name is its own proof of space authority.
func TestImportSchemeRejectsSpacePresetNames(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	for _, name := range model.SpaceSchemeNames {
		data := &imports.SchemeImportData{
			Name:                    model.NewPointer(name),
			DisplayName:             model.NewPointer("Hijacked"),
			Scope:                   model.NewPointer(model.SchemeScopeChannel),
			DefaultChannelAdminRole: &imports.RoleImportData{Name: model.NewPointer(model.NewId()), DisplayName: model.NewPointer("a")},
			DefaultChannelUserRole:  &imports.RoleImportData{Name: model.NewPointer(model.NewId()), DisplayName: model.NewPointer("u")},
			DefaultChannelGuestRole: &imports.RoleImportData{Name: model.NewPointer(model.NewId()), DisplayName: model.NewPointer("g")},
		}

		// Refused on the dry run too, so an operator finds out before the real pass.
		appErr := th.App.importScheme(th.Context, data, true)
		require.NotNil(t, appErr, "scheme %q", name)
		assert.Equal(t, "app.scheme.save.space_scheme_name.app_error", appErr.Id, "scheme %q", name)

		appErr = th.App.importScheme(th.Context, data, false)
		require.NotNil(t, appErr, "scheme %q", name)
		assert.Equal(t, "app.scheme.save.space_scheme_name.app_error", appErr.Id, "scheme %q", name)
	}
}

// TestImportChannelRejectsSpaceScheme pins that bulk import cannot attach a
// space scheme to an ordinary channel: importChannel resolves data.Scheme by
// name and passes the id straight to CreateChannel or UpdateChannel, so the
// channel-scheme guard inside those two is all that stands between an import
// line and the state UpdateChannelScheme refuses.
func TestImportChannelRejectsSpaceScheme(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	data := &imports.ChannelImportData{
		Team:        &th.BasicTeam.Name,
		Name:        model.NewPointer("space-scheme-import-" + model.NewId()),
		DisplayName: model.NewPointer("Borrowed"),
		Type:        model.NewPointer(model.ChannelTypeOpen),
		Scheme:      model.NewPointer(model.SchemeNameSpaceContribute),
	}

	// Create branch: the channel does not exist yet, so the guard fires in CreateChannel.
	appErr := th.App.importChannel(th.Context, data, false)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel.update_channel_scheme.space_scheme.app_error", appErr.Id)

	// Update branch: import the channel without a scheme first, then re-import
	// it carrying one, so the guard fires in UpdateChannel instead.
	data.Scheme = nil
	require.Nil(t, th.App.importChannel(th.Context, data, false))
	data.Scheme = model.NewPointer(model.SchemeNameSpaceContribute)
	appErr = th.App.importChannel(th.Context, data, false)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel.update_channel_scheme.space_scheme.app_error", appErr.Id)
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

// TestUpdateChannelRejectsSpaceScheme pins UpdateChannel, which takes SchemeId
// straight from the caller. Two paths reach it without passing
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
	mockSchemeStore.On("GetFromMaster", schemeID).
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
		mockSchemeStore.On("GetFromMaster", schemeID).
			Return(&model.Scheme{Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		_, appErr := th.App.DeleteScheme(schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.delete.space_scheme.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Delete", mock.Anything)
	})

	// A scheme of another scope carrying a reserved name is a conflicting row the
	// seeding migration refuses to adopt; deleting it is the operator's remedy.
	t.Run("reserved name outside channel scope is not treated as a preset", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeTeam}
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(scheme, nil)
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

	// Refused by identity, not by reference count: the name is a pure function of
	// the permission sets and Schemes.Name is unique across deleted rows, so a
	// deleted one leaves the next get-or-create for that set resolving to a row it
	// must refuse rather than minting a replacement.
	t.Run("minted plugin scheme refused even when nothing references it", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		mintedName := model.PluginChannelSchemeName("com.example.plugin", []string{model.PermissionReadPage.Id}, nil, nil)
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).
			Return(&model.Scheme{Id: schemeID, Name: mintedName, Scope: model.SchemeScopeChannel}, nil)
		mockChannelStore := mocks.ChannelStore{}
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		_, appErr := th.App.DeleteScheme(schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.delete.plugin_scheme.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Delete", mock.Anything)
		mockChannelStore.AssertNotCalled(t, "CountSpaceChannelsByScheme", mock.Anything)
	})

	// The prefix is a plain string a customer may already have used. Only a name a
	// digest pair could have produced is claimed, so an ordinary scheme that merely
	// starts with it stays the customer's to delete.
	t.Run("a customer scheme merely prefixed plugin_ deletes normally", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)
		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

		schemeID := model.NewId()
		scheme := &model.Scheme{Id: schemeID, Name: "plugin_incident_response", Scope: model.SchemeScopeChannel}
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(scheme, nil)
		mockSchemeStore.On("Delete", schemeID).Return(scheme, nil)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		deleted, appErr := th.App.DeleteScheme(schemeID)
		require.Nil(t, appErr)
		assert.Equal(t, schemeID, deleted.Id)
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

	// A minted plugin scheme is identified by its name and nothing else, so a
	// rename would unfreeze its roles while every channel already pointing at it
	// keeps resolving them.
	t.Run("renaming a minted plugin scheme away is rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		mintedName := model.PluginChannelSchemeName("com.example.plugin", []string{model.PermissionReadPage.Id}, nil, nil)
		th, mockSchemeStore, schemeID := setup(t, mintedName)

		_, appErr := th.App.UpdateScheme(&model.Scheme{Id: schemeID, Name: "renamed_scheme", Scope: model.SchemeScopeChannel})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.plugin_scheme_rename.app_error", appErr.Id)
		mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
	})

	// A squat on a minted name cannot be adopted — the get-or-create verifies the
	// roles grant what the name says — but it permanently denies that permission
	// set to the plugin that derives it.
	t.Run("renaming another scheme into the minted namespace is rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, mockSchemeStore, schemeID := setup(t, "ordinary_scheme")

		mintedName := model.PluginChannelSchemeName("com.example.plugin", []string{model.PermissionReadPage.Id}, nil, nil)
		_, appErr := th.App.UpdateScheme(&model.Scheme{Id: schemeID, Name: mintedName, Scope: model.SchemeScopeChannel})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.plugin_scheme_name.app_error", appErr.Id)
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
	// carrying a reserved name is a conflicting row that the seeding migration
	// refuses to adopt. Renaming it away is the operator's only remedy; refusing that
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

// A custom scheme no space points at is not a preset and carries no space
// authority, so the ordinary-channel guard leaves it alone: only the presets
// carry the moderated-permission stripping that would silently take create_post
// away from an ordinary channel's members.
func TestRejectSpaceSchemeOnOrdinaryChannelIgnoresCustomSchemes(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetFromMaster", schemeID).
		Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockRoleStore := mocks.RoleStore{}
	mockRoleStore.On("GetByNamesFromMaster", mock.Anything).Return([]*model.Role{}, nil)
	mockStore.On("Role").Return(&mockRoleStore)

	require.Nil(t, th.App.rejectSpaceSchemeOnOrdinaryChannel("UpdateChannelScheme", &schemeID))
}

// CreateBoardChannel takes SchemeId from the request body the same way
// CreateChannel does, so it is a third entry point for the same refusal and is pinned
// here: a board is never a space, and must not carry a space's scheme.
func TestCreateBoardChannelRejectsASpaceScheme(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// The preset is seeded at boot, so this resolves to the real row the guard
	// refuses rather than a mocked stand-in.
	preset, err := th.App.Srv().Store().Scheme().GetByName(model.SchemeNameSpaceContribute)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      th.BasicTeam.Id,
		Type:        model.ChannelTypeOpenBoard,
		DisplayName: "board",
		Name:        "board-" + model.NewId(),
		CreatorId:   th.BasicUser.Id,
		SchemeId:    &preset.Id,
	}
	_, appErr := th.App.CreateBoardChannel(th.Context, channel)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel.update_channel_scheme.space_scheme.app_error", appErr.Id)
}

// The mirror of the case above: once a space points at a custom scheme, that scheme
// must be barred from ordinary channels. This is the other half of the exclusivity
// rejectUnusableSpaceScheme enforces.
func TestRejectSpaceSchemeOnOrdinaryChannelRefusesSchemeUsedByASpace(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetFromMaster", schemeID).
		Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(1), nil)
	mockStore.On("Channel").Return(&mockChannelStore)

	appErr := th.App.rejectSpaceSchemeOnOrdinaryChannel("UpdateChannelScheme", &schemeID)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel.update_channel_scheme.space_scheme.app_error", appErr.Id)
	assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
}

// isSeededSpaceScheme answers the preset question for three guards, so each of
// its branches is pinned here rather than only through its callers.
func TestIsSeededSpaceScheme(t *testing.T) {
	setup := func(t *testing.T, ret *model.Scheme, err error) (*TestHelper, string) {
		th := setupSpaceRBACMock(t)
		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(ret, err)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		return th, schemeID
	}

	t.Run("a seeded preset is recognised", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, schemeID := setup(t, &model.Scheme{Id: model.NewId(), Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel}, nil)
		isPreset, appErr := th.App.isSeededSpaceScheme(schemeID)
		require.Nil(t, appErr)
		assert.True(t, isPreset)
	})

	t.Run("a reserved name outside channel scope is a squatter, not a preset", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, schemeID := setup(t, &model.Scheme{Id: model.NewId(), Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeTeam}, nil)
		isPreset, appErr := th.App.isSeededSpaceScheme(schemeID)
		require.Nil(t, appErr)
		assert.False(t, isPreset, "scope is part of the identity")
	})

	t.Run("an ordinary channel scheme is not a preset", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, schemeID := setup(t, &model.Scheme{Id: model.NewId(), Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
		isPreset, appErr := th.App.isSeededSpaceScheme(schemeID)
		require.Nil(t, appErr)
		assert.False(t, isPreset)
	})

	t.Run("a missing scheme is not a preset and is not an error", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, schemeID := setup(t, nil, store.NewErrNotFound("Scheme", "id"))
		isPreset, appErr := th.App.isSeededSpaceScheme(schemeID)
		require.Nil(t, appErr)
		assert.False(t, isPreset)
	})

	t.Run("a store failure is reported, never reported as not-a-preset", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, schemeID := setup(t, nil, errors.New("db down"))
		isPreset, appErr := th.App.isSeededSpaceScheme(schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.get.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		assert.False(t, isPreset)
	})
}

// IsSpaceChannelByID must distinguish "not a space" from "could not tell". A
// lookup failure that returned (false, nil) would silently downgrade every
// caller's guard to "ordinary channel", which is the permissive answer.
func TestIsSpaceChannelByIDFailsClosedOnLookupError(t *testing.T) {
	setup := func(t *testing.T, err error) (*TestHelper, string) {
		th := setupSpaceRBACMock(t)
		channelID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("GetChannelOfType", mock.Anything, channelID, model.ChannelTypeSpace).
			Return(nil, err)
		mockStore.On("Channel").Return(&mockChannelStore)
		return th, channelID
	}

	t.Run("a store failure is surfaced, not reported as 'not a space'", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, channelID := setup(t, errors.New("db down"))

		isSpace, appErr := th.App.IsSpaceChannelByID(th.Context, channelID)
		require.NotNil(t, appErr, "a failed lookup must not answer the permissive way")
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		assert.False(t, isSpace)
	})

	t.Run("a genuine not-found is the one case that answers 'not a space'", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, channelID := setup(t, store.NewErrNotFound("Channel", "id"))

		isSpace, appErr := th.App.IsSpaceChannelByID(th.Context, channelID)
		require.Nil(t, appErr)
		assert.False(t, isSpace)
	})
}

// The scheme lookup is shared by both channel guards, so a failure there has to
// surface rather than be read as "this scheme holds no space authority".
func TestSpaceChannelGuardsPropagateSchemeLookupErrors(t *testing.T) {
	setup := func(t *testing.T) (*TestHelper, string) {
		th := setupSpaceRBACMock(t)
		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(nil, errors.New("db down"))
		mockStore.On("Scheme").Return(&mockSchemeStore)
		// The ordinary-channel guard counts spaces on the scheme before reading it,
		// so that count has to succeed for the scheme lookup to be reached.
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		return th, schemeID
	}

	t.Run("rejectSpaceSchemeOnOrdinaryChannel", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, schemeID := setup(t)
		appErr := th.App.rejectSpaceSchemeOnOrdinaryChannel("UpdateChannelScheme", &schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("rejectUnusableSpaceScheme", func(t *testing.T) {
		mainHelper.Parallel(t)
		th, schemeID := setup(t)
		appErr := th.App.rejectUnusableSpaceScheme("CreateChannel", &schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

// The space guard on a space's own SchemeId counts ordinary channels on the
// primary; a failure there cannot prove the scheme is unused, so it refuses.
func TestRejectUnusableSpaceSchemeFailsClosedOnCountError(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	scheme := &model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}
	mockSchemeStore.On("GetFromMaster", schemeID).Return(scheme, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("CountNonSpaceChannelsByScheme", schemeID).Return(int64(0), errors.New("db down"))
	mockStore.On("Channel").Return(&mockChannelStore)

	appErr := th.App.rejectUnusableSpaceScheme("CreateChannel", &schemeID)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
}

// A store failure on the space-association read is not proof the scheme is
// clean, so the guard reports the failure instead of allowing the write.
func TestRejectSpaceSchemeOnOrdinaryChannelFailsClosedOnCountError(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetFromMaster", schemeID).
		Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), errors.New("db down"))
	mockStore.On("Channel").Return(&mockChannelStore)

	appErr := th.App.rejectSpaceSchemeOnOrdinaryChannel("UpdateChannelScheme", &schemeID)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
}

// TestRejectUnusableSpaceScheme pins the guard on a space's own SchemeId. It is
// the mirror of the ordinary-channel guard: that one keeps a preset off a
// channel, this one keeps an arbitrary customer scheme off a space, because a
// space pointing at a scheme is what checkSpacePermissionScope later reads as
// proof of space scope and what checkSpaceSchemeDelete reads as a reason to
// refuse a delete.
func TestRejectUnusableSpaceScheme(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("no scheme is accepted", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		require.Nil(t, th.App.rejectUnusableSpaceScheme("CreateChannel", nil))
		empty := ""
		require.Nil(t, th.App.rejectUnusableSpaceScheme("CreateChannel", &empty))
	})

	t.Run("a seeded preset is accepted by identity", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id: schemeID, Name: model.SchemeNameSpaceContribute, Scope: model.SchemeScopeChannel,
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)

		require.Nil(t, th.App.rejectUnusableSpaceScheme("CreateChannel", &schemeID))
	})

	t.Run("a channel scheme governing no ordinary channel is accepted", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		scheme := &model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(scheme, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountNonSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
		mockStore.On("Channel").Return(&mockChannelStore)

		require.Nil(t, th.App.rejectUnusableSpaceScheme("CreateChannel", &schemeID))
	})

	t.Run("a scheme already governing an ordinary channel is refused", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		scheme := &model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(scheme, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockChannelStore := mocks.ChannelStore{}
		mockChannelStore.On("CountNonSpaceChannelsByScheme", schemeID).Return(int64(1), nil)
		mockStore.On("Channel").Return(&mockChannelStore)

		appErr := th.App.rejectUnusableSpaceScheme("CreateChannel", &schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
	})

	t.Run("an unresolvable scheme fails closed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
		mockStore.On("Scheme").Return(&mockSchemeStore)

		appErr := th.App.rejectUnusableSpaceScheme("CreateChannel", &schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
	})

	// Creating a scheme and pointing a space at it is the ordinary caller
	// sequence, so the replica routinely has not caught up by the time this guard
	// runs. Neither the preset identity read nor the resolution below it may
	// consult it, or a just-created scheme reads as unusable.
	t.Run("neither read consults the replica", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockChannelStore := mocks.ChannelStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id:    schemeID,
			Name:  model.NewId(),
			Scope: model.SchemeScopeChannel,
		}, nil)
		mockChannelStore.On("CountNonSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		require.Nil(t, th.App.rejectUnusableSpaceScheme("CreateChannel", &schemeID))
		mockSchemeStore.AssertNotCalled(t, "Get", mock.Anything)
	})

	// Deleting a scheme blanks SchemeId on every channel that used it, so the
	// ordinary-channel count comes back empty for a deleted scheme and agrees
	// that it is unused. The DeleteAt refusal is what stops a space being pointed
	// at a scheme on its way out, and the read it trusts has to be the primary's:
	// a lagging replica still reports the row live.
	t.Run("a soft-deleted scheme is refused even though it governs no channel", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		schemeID := model.NewId()
		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockSchemeStore := mocks.SchemeStore{}
		mockChannelStore := mocks.ChannelStore{}
		mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
			Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel, DeleteAt: model.GetMillis(),
		}, nil)
		mockStore.On("Scheme").Return(&mockSchemeStore)
		mockStore.On("Channel").Return(&mockChannelStore)

		appErr := th.App.rejectUnusableSpaceScheme("CreateChannel", &schemeID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
		mockChannelStore.AssertNotCalled(t, "CountNonSpaceChannelsByScheme", mock.Anything)
	})
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
	mockSchemeStore.On("GetFromMaster", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
	mockStore.On("Scheme").Return(&mockSchemeStore)

	_, appErr := th.App.UpdateScheme(&model.Scheme{Id: schemeID, Name: "ordinary_scheme", Scope: model.SchemeScopeChannel})
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode, "a missing scheme is a 404, not a 500")
	mockSchemeStore.AssertCalled(t, "GetFromMaster", schemeID)
	mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
}

func TestUpdateSchemeMissedOnTheReplicaIsResolvedOnThePrimary(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	schemeID := model.NewId()
	stored := &model.Scheme{Id: schemeID, Name: "ordinary_scheme", Scope: model.SchemeScopeChannel}
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("Get", schemeID).Return(nil, store.NewErrNotFound("Scheme", schemeID))
	mockSchemeStore.On("GetFromMaster", schemeID).Return(stored, nil)
	mockSchemeStore.On("Save", mock.Anything).Return(stored, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)

	// The import path resolves a scheme on the primary and passes its id straight
	// to UpdateScheme, so the rename guard has to look there too before refusing.
	_, appErr := th.App.UpdateScheme(&model.Scheme{Id: schemeID, Name: "ordinary_scheme", Scope: model.SchemeScopeChannel})
	require.Nil(t, appErr)
	mockSchemeStore.AssertCalled(t, "Save", mock.Anything)
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
	mockRoleStore.On("GetFromMaster", mock.Anything).Return(nil, errors.New("connection reset"))
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
		mockSchemeStore.On("GetFromMaster", mock.Anything).Return(nil, errors.New("connection reset"))
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
	// The first pass reads the replica and misses.
	mockRoleStore.On("GetByName", mock.Anything, mock.Anything).Return(
		func(_ request.CTX, name string) (*model.Role, error) {
			return nil, store.NewErrNotFound("Role", name)
		})
	// The recovery pass re-reads on the primary through the uncached
	// GetByNamesFromMaster, which reports a missing row as an empty result
	// rather than a not-found error.
	mockRoleStore.On("GetByNamesFromMaster", mock.Anything).Return(
		func(names []string) ([]*model.Role, error) {
			role, err := reread(names[0])
			if err != nil {
				var nfErr *store.ErrNotFound
				if errors.As(err, &nfErr) {
					return []*model.Role{}, nil
				}
				return nil, err
			}
			return []*model.Role{role}, nil
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

// TestSpaceRolesMigrationRefusesPreexistingForeignRole covers the first-pass
// adoption check, which the lost-insert-race tests above cannot reach: there the
// row only appears on the primary re-read after a failed save, whereas here it is
// already present on the first read and no save is attempted at all.
func TestSpaceRolesMigrationRefusesPreexistingForeignRole(t *testing.T) {
	canonical := model.MakeDefaultRoles()

	preexistingRoleStore := func(t *testing.T, stored func(roleID string) *model.Role) *mocks.Store {
		t.Helper()
		mockStore := mocks.Store{}

		mockSystemStore := mocks.SystemStore{}
		mockSystemStore.On("GetByName", SpaceRolesCreationMigrationKey).
			Return(nil, store.NewErrNotFound("System", SpaceRolesCreationMigrationKey))
		mockSystemStore.On("SaveOrUpdate", mock.Anything).Return(nil)
		mockStore.On("System").Return(&mockSystemStore)

		mockRoleStore := mocks.RoleStore{}
		mockRoleStore.On("GetByName", mock.Anything, mock.Anything).Return(
			func(_ request.CTX, name string) (*model.Role, error) { return stored(name), nil })
		mockStore.On("Role").Return(&mockRoleStore)

		mockStore.On("Close").Return(nil)

		return &mockStore
	}

	t.Run("a row matching the built-in definition is adopted", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		mockStore := preexistingRoleStore(t, func(roleID string) *model.Role { return canonical[roleID].Clone() })
		th.App.Srv().SetStore(mockStore)

		require.NoError(t, th.Server.doSpaceRolesCreationMigration())
		mockStore.Role().(*mocks.RoleStore).AssertNotCalled(t, "Save", mock.Anything)
	})

	t.Run("a row with different permissions fails the migration", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		mockStore := preexistingRoleStore(t, func(roleID string) *model.Role {
			foreign := canonical[roleID].Clone()
			foreign.Permissions = append(foreign.Permissions, model.PermissionAdminSpace.Id)
			return foreign
		})
		th.App.Srv().SetStore(mockStore)

		err := th.Server.doSpaceRolesCreationMigration()
		require.ErrorContains(t, err, "different permission set",
			"a name collision must not be silently adopted")
		mockStore.Role().(*mocks.RoleStore).AssertNotCalled(t, "Save", mock.Anything)
	})
}

// spaceSchemesMigrationStore drives doSpaceSchemesCreationMigration with a
// Scheme().Save that always fails, standing in for the losing side of a
// concurrent HA insert, so the primary re-read and the adoption check run.
func spaceSchemesMigrationStore(t *testing.T, reread func(name string) (*model.Scheme, error)) *mocks.Store {
	t.Helper()
	return spaceSchemesMigrationStoreGranting(t, reread, nil)
}

// spaceSchemesMigrationStoreGranting is spaceSchemesMigrationStore with extra
// permissions planted on every generated role, standing in for a scheme that
// carries a preset name but grants more than a seeded preset ever would.
func spaceSchemesMigrationStoreGranting(t *testing.T, reread func(name string) (*model.Scheme, error), extraRolePermissions []string) *mocks.Store {
	t.Helper()
	mockStore := mocks.Store{}

	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", SpaceSchemesCreationMigrationKey).
		Return(nil, store.NewErrNotFound("System", SpaceSchemesCreationMigrationKey))
	mockSystemStore.On("SaveOrUpdate", mock.Anything).Return(nil)
	mockStore.On("System").Return(&mockSystemStore)

	// The adopted scheme's generated roles must read back as its own: the
	// reread records which scheme id owns each generated role name, and the
	// role fixture below stamps that ownership on the rows it returns.
	roleSchemeIDs := map[string]string{}

	// The get-or-create read has to miss so the failing Save below runs, and the
	// recovery re-read that follows it goes to the primary.
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetByName", mock.AnythingOfType("string")).Return(
		func(name string) (*model.Scheme, error) {
			return nil, store.NewErrNotFound("Scheme", name)
		})
	mockSchemeStore.On("GetByNameFromMaster", mock.AnythingOfType("string")).Return(
		func(name string) (*model.Scheme, error) {
			scheme, err := reread(name)
			if scheme != nil {
				for _, roleName := range []string{scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole, scheme.DefaultChannelGuestRole} {
					roleSchemeIDs[roleName] = scheme.Id
				}
			}
			return scheme, err
		})
	mockSchemeStore.On("Save", mock.Anything).Return(nil, errors.New("duplicate key"))
	mockStore.On("Scheme").Return(&mockSchemeStore)

	// The generated roles the closure reads back and rewrites. A real scheme
	// seeds each one from the global role of the same kind, so the fixture does
	// too — assigning all three the same permission set would give the admin role
	// grants channel_admin never has, which the adoption check rightly refuses.
	roleByName := func(name string) (*model.Role, error) {
		defaults := model.MakeDefaultRoles()
		base := model.ChannelUserRoleId
		switch {
		case strings.HasSuffix(name, "_"+model.ChannelAdminRoleId):
			base = model.ChannelAdminRoleId
		case strings.HasSuffix(name, "_"+model.ChannelGuestRoleId):
			base = model.ChannelGuestRoleId
		}
		// What createScheme actually produces for a channel-scoped scheme,
		// which is not the global default role: the generated admin role
		// starts empty, and the user and guest roles keep only the
		// channel-moderated permissions of the global role each is seeded
		// from. Seeding the full default role here would model a scheme the
		// server never creates.
		seeded := []string{}
		if base != model.ChannelAdminRoleId {
			for _, p := range defaults[base].Permissions {
				if _, moderated := model.ChannelModeratedPermissionsMap[p]; moderated {
					seeded = append(seeded, p)
				}
			}
		}
		role := &model.Role{
			Name:        name,
			Permissions: append(seeded, extraRolePermissions...),
		}
		if schemeID, ok := roleSchemeIDs[name]; ok {
			role.SchemeManaged = true
			role.SchemeId = &schemeID
		}
		return role, nil
	}
	mockRoleStore := mocks.RoleStore{}
	mockRoleStore.On("GetByName", mock.Anything, mock.Anything).Return(
		func(_ request.CTX, name string) (*model.Role, error) { return roleByName(name) })
	// The validation and seeding reads go through the uncached primary read.
	mockRoleStore.On("GetByNamesFromMaster", mock.Anything).Return(
		func(names []string) ([]*model.Role, error) {
			role, err := roleByName(names[0])
			if err != nil {
				return nil, err
			}
			return []*model.Role{role}, nil
		})
	// applySpaceSchemeRolePermissions writes through the unknown-permission
	// preserving save, not the plain one.
	mockRoleStore.On("SavePreservingUnknownPermissions", mock.Anything).Return(
		func(role *model.Role) (*model.Role, error) { return role, nil })
	mockStore.On("Role").Return(&mockRoleStore)

	// The adoption check asks whether the scheme governs any ordinary channel.
	// A scheme reached through the insert race is one another node just created,
	// so it governs none.
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("CountNonSpaceChannelsByScheme", mock.AnythingOfType("string")).
		Return(int64(0), nil)
	mockStore.On("Channel").Return(&mockChannelStore)

	mockStore.On("Close").Return(nil)
	return &mockStore
}

// adoptableSpaceScheme builds a row shaped like a scheme another node just
// created. The generated role names carry the kind they were seeded from so the
// role fixture can return that kind's permissions, the way a real scheme does.
func adoptableSpaceScheme(name string) *model.Scheme {
	return &model.Scheme{
		Id:                      model.NewId(),
		Name:                    name,
		Scope:                   model.SchemeScopeChannel,
		DefaultChannelUserRole:  name + "_" + model.ChannelUserRoleId,
		DefaultChannelAdminRole: name + "_" + model.ChannelAdminRoleId,
		DefaultChannelGuestRole: name + "_" + model.ChannelGuestRoleId,
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

	t.Run("re-read finding an over-granting scheme fails the migration", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		// Shaped exactly like a preset, so every check in
		// validateAdoptableSpaceScheme passes, but its generated roles carry a
		// channel permission the seeding never grants. Adopting it would leave
		// that grant on a row three guards then read as proof of space scope.
		th.App.Srv().SetStore(spaceSchemesMigrationStoreGranting(t,
			func(name string) (*model.Scheme, error) { return adoptableSpaceScheme(name), nil },
			[]string{model.PermissionDeletePublicChannel.Id}))

		err := th.Server.doSpaceSchemesCreationMigration()
		require.Error(t, err, "a scheme granting more than a preset must not be adopted")
		assert.Contains(t, err.Error(), model.PermissionDeletePublicChannel.Id,
			"the error names the permission that disqualified the row")
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
// Spaces are not returned by an ordinary channel-by-id lookup, so scheme-role lookup has to
// fetch them by their exact channel type; otherwise every role assignment on a freshly created
// space 404s.
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

// TestUpdateChannelMemberRolesRefusesCapabilityRoleForGuest pins the read-only
// contract the admin console states for guests: a guest sees the spaces of the
// teams it belongs to and holds no capability inside any of them. The space
// check alone does not carry it, because a guest of a space passes that check.
func TestUpdateChannelMemberRolesRefusesCapabilityRoleForGuest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	scheme := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	space := saveSpaceChannelWithScheme(t, th, scheme.Id)

	// Saved once: every update below is refused, so the member is left as it was.
	saveSpaceChannelMember(t, th, space.Id, th.BasicUser2.Id, false, true)

	for _, roleName := range model.SpaceCapabilityRoles {
		t.Run(roleName, func(t *testing.T) {
			_, appErr := th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser2.Id,
				scheme.DefaultChannelGuestRole+" "+roleName)
			require.NotNil(t, appErr, "a guest must not receive a space capability role")
			assert.Equal(t, "api.channel.update_channel_member_roles.space_guest_role.app_error", appErr.Id)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		})
	}

	t.Run("a non-guest member of the same space still receives the role", func(t *testing.T) {
		saveSpaceChannelMember(t, th, space.Id, th.BasicUser.Id, false, false)

		member, appErr := th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser.Id,
			scheme.DefaultChannelUserRole+" "+model.SpacePageEditorRoleId)
		require.Nil(t, appErr)
		assert.Contains(t, member.ExplicitRoles, model.SpacePageEditorRoleId)
	})

	// The scheme's generated admin role reaches the member through SchemeAdmin
	// rather than ExplicitRoles, so the capability-role check above never sees
	// it, while getChannelRoles resolves guest and admin independently.
	t.Run("the scheme admin role is refused alongside the guest role", func(t *testing.T) {
		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, space.Id, th.BasicUser2.Id,
			scheme.DefaultChannelGuestRole+" "+scheme.DefaultChannelAdminRole)
		require.NotNil(t, appErr, "a guest must not hold space administrator authority")
		assert.Equal(t, "api.channel.update_channel_member_roles.space_guest_admin.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("an ordinary channel also refuses a guest channel admin", func(t *testing.T) {
		_, err := th.App.Srv().Store().Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:   th.BasicChannel.Id,
			UserId:      th.BasicUser2.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeGuest: true,
		})
		require.NoError(t, err)
		th.App.Srv().Store().Channel().InvalidateAllChannelMembersForUser(th.BasicUser2.Id)

		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser2.Id,
			model.ChannelGuestRoleId+" "+model.ChannelAdminRoleId)
		require.NotNil(t, appErr, "guest+admin must be rejected on regular channels too")
		assert.Equal(t, "api.channel.update_channel_member_roles.guest_and_admin.app_error", appErr.Id)
	})
}

// TestCheckSpacePermissionScopeMetadataOnlyWrite covers a write that adds no
// permission, so the add diff is empty and only the preset freeze reads the
// scheme — an ordinary one here, which proves nothing. Dropping SchemeManaged
// while the grants stay turns a generated space role into one every acceptance
// guard admits on its name alone.
func TestCheckSpacePermissionScopeMetadataOnlyWrite(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
		Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel,
	}, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)

	storedPermissions := []string{model.PermissionAdminSpace.Id, model.PermissionEditPage.Id}

	spaceRole := func(schemeManaged bool) *model.Role {
		return &model.Role{
			Name:          model.NewId(),
			Permissions:   slices.Clone(storedPermissions),
			SchemeManaged: schemeManaged,
			SchemeId:      &schemeID,
		}
	}

	t.Run("dropping SchemeManaged while the grants stay is refused", func(t *testing.T) {
		appErr := th.App.checkSpacePermissionScope(spaceRole(false), storedPermissions)
		require.NotNil(t, appErr, "a role keeping space grants must stay scheme-managed")
		assert.Equal(t, "app.role.save.space_role_scheme_managed.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("the same write on a scheme-managed role is unaffected", func(t *testing.T) {
		require.Nil(t, th.App.checkSpacePermissionScope(spaceRole(true), storedPermissions))
	})

	t.Run("a role holding no space grant may still drop SchemeManaged", func(t *testing.T) {
		ordinary := &model.Role{Name: model.NewId(), Permissions: []string{model.PermissionCreatePost.Id}}
		require.Nil(t, th.App.checkSpacePermissionScope(ordinary, []string{model.PermissionCreatePost.Id}))
	})

	t.Run("removing the grants alongside the flip is allowed", func(t *testing.T) {
		// The guard is not a freeze: shedding the permissions is how a role
		// legitimately leaves the scheme's authority behind.
		shed := &model.Role{Name: model.NewId(), Permissions: []string{}, SchemeId: &schemeID}
		require.Nil(t, th.App.checkSpacePermissionScope(shed, storedPermissions))
	})
}

// TestCheckSpacePermissionScopeAddAndFlipInOneWrite pins that a single write
// adding a space grant while clearing SchemeManaged is refused. The write is
// reachable through importRole, the sole role write whose SchemeManaged field is
// caller-controlled, and landing it would produce a freely assignable role
// holding space grants.
//
// It used to be the scheme-managed clause that caught this, because the scheme
// proof would otherwise have accepted the write. No runtime write adds a space
// permission at all now, so the blanket refusal catches it earlier and the
// scheme-managed clause never sees it. Kept as a regression test on the outcome
// rather than on which clause produces it: this is the shape of write that must
// not land, whichever rule stops it.
func TestCheckSpacePermissionScopeAddAndFlipInOneWrite(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
		Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel,
	}, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)
	mockChannelStore := mocks.ChannelStore{}
	mockStore.On("Channel").Return(&mockChannelStore)

	role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{model.PermissionEditPage.Id}}
	appErr := th.App.checkSpacePermissionScope(role, nil)
	require.NotNil(t, appErr, "adding a grant while clearing SchemeManaged must be refused")
	assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
	assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
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

	t.Run("scheme name guard rejects a minted plugin scheme name", func(t *testing.T) {
		minted := model.PluginChannelSchemeName("com.example.plugin", []string{model.PermissionReadPage.Id}, nil, nil)
		appErr := th.App.checkSpaceSchemeName("CreateScheme", minted)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.scheme.save.plugin_scheme_name.app_error", appErr.Id)
	})

	// The reservation covers the shape, not the prefix: a customer naming a scheme
	// of their own plugin_something keeps that name.
	t.Run("scheme name guard admits a name merely prefixed plugin_", func(t *testing.T) {
		assert.Nil(t, th.App.checkSpaceSchemeName("CreateScheme", "plugin_incident_response"))
	})

	t.Run("a role adding no space permission is still unaffected", func(t *testing.T) {
		role := &model.Role{Name: model.TeamUserRoleId, Permissions: []string{model.PermissionCreatePost.Id}}
		require.Nil(t, th.App.checkSpacePermissionScope(role, nil))
	})
}

// TestUpdateSchemeRenameGuardAllowsSameNameSave pins the early return in
// checkSpaceSchemeRename: api4.patchScheme reads the stored scheme and applies
// model.Scheme.Patch, which leaves Name untouched unless the patch sets it. A
// save that only changes DisplayName on a seeded preset must not be treated as
// a rename away from the reserved name — every other subtest in
// TestUpdateSchemeSpaceGuards passes a scheme whose Name differs from the
// stored row, so none of them would fail if this early return were deleted.
func TestUpdateSchemeRenameGuardAllowsSameNameSave(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	stored := getSeededSpaceScheme(t, th, model.SchemeNameSpaceContribute)
	stored.DisplayName = "Updated Display Name"

	updated, appErr := th.App.UpdateScheme(stored)
	require.Nil(t, appErr)
	assert.Equal(t, model.SchemeNameSpaceContribute, updated.Name)
	assert.Equal(t, "Updated Display Name", updated.DisplayName)
}

// TestUpdateRoleBaselineNameFallbackStoreError covers the name-fallback branch
// of storedRoleForSpaceGuard: a save carrying no Id reads the stored baseline by
// name, and a store failure there must surface as a server error rather than be
// silently swallowed or misreported as a scope violation.
func TestUpdateRoleBaselineNameFallbackStoreError(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockRoleStore := mocks.RoleStore{}
	mockStore.On("Role").Return(&mockRoleStore)
	mockSchemeStore := mocks.SchemeStore{}
	mockStore.On("Scheme").Return(&mockSchemeStore)

	roleName := model.NewId()
	mockRoleStore.On("GetByName", mock.Anything, roleName).Return(nil, errors.New("connection reset"))

	role := &model.Role{
		Name:        roleName,
		Permissions: []string{model.PermissionAdminSpace.Id},
	}
	_, appErr := th.App.UpdateRole(role)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.role.get.app_error", appErr.Id)
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
}

// TestSpaceRolesMigrationExistenceCheckStoreError pins the existence-check
// branch inside doSpaceRolesCreationMigration's per-role loop: a store failure
// reading a role by name must abort the migration rather than be treated as a
// not-found and proceed to save.
func TestSpaceRolesMigrationExistenceCheckStoreError(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := mocks.Store{}
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", SpaceRolesCreationMigrationKey).
		Return(nil, store.NewErrNotFound("System", SpaceRolesCreationMigrationKey))
	mockStore.On("System").Return(&mockSystemStore)

	mockRoleStore := mocks.RoleStore{}
	mockRoleStore.On("GetByName", mock.Anything, mock.Anything).Return(nil, errors.New("connection reset"))
	mockStore.On("Role").Return(&mockRoleStore)
	mockStore.On("Close").Return(nil)

	th.App.Srv().SetStore(&mockStore)

	err := th.Server.doSpaceRolesCreationMigration()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "connection reset")
	mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
}

// TestSpaceSchemesMigrationExistenceCheckStoreError pins the existence-check
// branch inside doSpaceSchemesCreationMigration's per-preset loop: the fixture
// elsewhere in this file (spaceSchemesMigrationStore) only ever returns
// ErrNotFound on the first GetByName call, forcing the insert-race path; this
// test instead fails that very first call with a genuine store error, which
// must abort the migration rather than fall through to the Save attempt.
func TestSpaceSchemesMigrationExistenceCheckStoreError(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := mocks.Store{}
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", SpaceSchemesCreationMigrationKey).
		Return(nil, store.NewErrNotFound("System", SpaceSchemesCreationMigrationKey))
	mockStore.On("System").Return(&mockSystemStore)

	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetByName", mock.AnythingOfType("string")).Return(nil, errors.New("connection reset"))
	mockStore.On("Scheme").Return(&mockSchemeStore)
	mockStore.On("Close").Return(nil)

	th.App.Srv().SetStore(&mockStore)

	err := th.Server.doSpaceSchemesCreationMigration()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "connection reset")
	mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
}

// TestApplySpaceSchemeRolePermissionsStoreErrors pins the two store-error
// branches of applySpaceSchemeRolePermissions: the read that fetches the
// scheme-generated role, and the write that persists the stripped/granted
// permission set. Neither may be silently swallowed.
func TestApplySpaceSchemeRolePermissionsStoreErrors(t *testing.T) {
	t.Run("role read failure", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockRoleStore := mocks.RoleStore{}
		mockRoleStore.On("GetByNamesFromMaster", mock.Anything).Return(nil, errors.New("connection reset"))
		mockStore.On("Role").Return(&mockRoleStore)

		err := th.Server.applySpaceSchemeRolePermissions(model.NewId(), model.SpaceAdminRolePermissions, false)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "connection reset")
	})

	t.Run("SavePreservingUnknownPermissions failure", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := setupSpaceRBACMock(t)

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockRoleStore := mocks.RoleStore{}
		roleName := model.NewId()
		mockRoleStore.On("GetByNamesFromMaster", []string{roleName}).
			Return([]*model.Role{{Name: roleName, Permissions: []string{}}}, nil)
		mockRoleStore.On("SavePreservingUnknownPermissions", mock.Anything).Return(nil, errors.New("connection reset"))
		mockStore.On("Role").Return(&mockRoleStore)

		err := th.Server.applySpaceSchemeRolePermissions(roleName, model.SpaceAdminRolePermissions, false)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "connection reset")
	})
}

// TestSpaceSeedingMigrationsIdempotentWhenMarkerPresent pins that both
// migrations return immediately, with no further role or scheme reads, once
// their completion marker is already stored. TestSpaceSeedingMigrations only
// exercises the marker-absent path (after deleting the markers and re-running
// once); this pins the ordinary boot path where the marker is already there on
// every subsequent call.
func TestSpaceSeedingMigrationsIdempotentWhenMarkerPresent(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", SpaceRolesCreationMigrationKey).
		Return(&model.System{Name: SpaceRolesCreationMigrationKey, Value: "true"}, nil)
	mockSystemStore.On("GetByName", SpaceSchemesCreationMigrationKey).
		Return(&model.System{Name: SpaceSchemesCreationMigrationKey, Value: "true"}, nil)
	mockStore.On("System").Return(&mockSystemStore)
	mockRoleStore := mocks.RoleStore{}
	mockStore.On("Role").Return(&mockRoleStore)
	mockSchemeStore := mocks.SchemeStore{}
	mockStore.On("Scheme").Return(&mockSchemeStore)

	require.NoError(t, th.Server.doSpaceRolesCreationMigration())
	require.NoError(t, th.Server.doSpaceSchemesCreationMigration())

	mockRoleStore.AssertNotCalled(t, "GetByName", mock.Anything, mock.Anything)
	mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
	mockSchemeStore.AssertNotCalled(t, "GetByName", mock.Anything)
	mockSchemeStore.AssertNotCalled(t, "Save", mock.Anything)
}

// TestRejectSpaceSchemeOnOrdinaryChannelRefusesLingeringGrants pins the second check
// rejectSpaceSchemeOnOrdinaryChannel runs after the space-count check: a custom
// scheme no space currently points at (CountSpaceChannelsByScheme == 0) is still
// refused if its generated channel roles carry a space permission, because that grant
// is durable state a lapsed association cannot revoke.
//
// Dropping the association is exactly what leaves this the only check standing, so
// both of its reads go to the primary and neither may be served from a cache a peer
// node's grant has not yet invalidated.
func TestRejectSpaceSchemeOnOrdinaryChannelRefusesLingeringGrants(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	schemeID := model.NewId()
	userRoleName, adminRoleName, guestRoleName := model.NewId(), model.NewId(), model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{
		Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel,
		DefaultChannelUserRole:  userRoleName,
		DefaultChannelAdminRole: adminRoleName,
		DefaultChannelGuestRole: guestRoleName,
	}, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(0), nil)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockRoleStore := mocks.RoleStore{}
	mockRoleStore.On("GetByNamesFromMaster", []string{adminRoleName, userRoleName, guestRoleName}).Return([]*model.Role{
		{Name: userRoleName, Permissions: []string{model.PermissionCreatePage.Id}},
		{Name: adminRoleName, Permissions: []string{}},
		{Name: guestRoleName, Permissions: []string{}},
	}, nil)
	mockStore.On("Role").Return(&mockRoleStore)

	appErr := th.App.rejectSpaceSchemeOnOrdinaryChannel("UpdateChannelScheme", &schemeID)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel.update_channel_scheme.space_scheme.app_error", appErr.Id)
	mockSchemeStore.AssertNotCalled(t, "Get", mock.Anything)
	mockRoleStore.AssertNotCalled(t, "GetByNames", mock.Anything)
}

// TestCheckSpacePermissionScopeRefusesSchemeSharedWithOrdinaryChannel pins the
// second half of the association proof checkSpacePermissionScope now requires:
// a scheme both a space and an ordinary channel point at must have a
// space-permission add on its roles rejected, because an ordinary channel
// sharing the scheme would resolve the same grant for its own members.
// TestCheckSpacePermissionScope's "custom scheme a space references allowed"
// subtest pins the counterpart: a space-only scheme still succeeds.
func TestCheckSpacePermissionScopeRefusesSchemeSharedWithOrdinaryChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	guarded := model.PermissionReadPage.Id
	schemeID := model.NewId()
	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockSchemeStore := mocks.SchemeStore{}
	mockSchemeStore.On("GetFromMaster", schemeID).Return(&model.Scheme{Id: schemeID, Name: model.NewId(), Scope: model.SchemeScopeChannel}, nil)
	mockStore.On("Scheme").Return(&mockSchemeStore)
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("CountSpaceChannelsByScheme", schemeID).Return(int64(1), nil)
	mockChannelStore.On("CountNonSpaceChannelsByScheme", schemeID).Return(int64(1), nil)
	mockStore.On("Channel").Return(&mockChannelStore)

	role := &model.Role{Name: model.NewId(), SchemeId: &schemeID, Permissions: []string{guarded}}
	appErr := th.App.checkSpacePermissionScope(role, nil)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.role.save.space_permission_scope.app_error", appErr.Id)
}

// TestPatchRoleRejectsCapabilityRoleAheadOfNoOpShortCircuit pins that the
// capability-role guard in PatchRole runs before the no-op short-circuit: a
// patch whose Permissions are identical to the role's stored permissions must
// still be refused, not silently accepted as a 200/no-op that would let a
// caller testing what the API allows read the short-circuit as permission.
func TestPatchRoleRejectsCapabilityRoleAheadOfNoOpShortCircuit(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSpaceRBACMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockRoleStore := mocks.RoleStore{}
	mockStore.On("Role").Return(&mockRoleStore)

	permissions := model.PermissionIDs(model.SpaceCapabilityRolePermissions[model.SpacePageCommenterRoleId])
	role := &model.Role{
		Id:          model.NewId(),
		Name:        model.SpacePageCommenterRoleId,
		Permissions: permissions,
	}
	patch := &model.RolePatch{Permissions: &permissions}

	_, appErr := th.App.PatchRole(role, patch)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.role.save.space_capability_role.app_error", appErr.Id)
	mockRoleStore.AssertNotCalled(t, "Get", mock.Anything)
	mockRoleStore.AssertNotCalled(t, "Save", mock.Anything)
}

// TestCreateAndUpdateChannelRejectUnusableSpaceScheme drives the isSpace==true
// branch of checkChannelSchemeAssignment (rejectUnusableSpaceScheme) end to
// end through the real CreateChannel and UpdateChannel entry points, using a
// scheme that already governs an ordinary channel. Every other space fixture
// in this file writes the channel straight through
// Store().Channel().Save, which never runs the guard at all, so a mutant
// that skips it for a real space channel would not be caught anywhere else.
func TestCreateAndUpdateChannelRejectUnusableSpaceScheme(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.EnableDocs = true
	}).InitBasic(t)
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	ordinaryScheme, appErr := th.App.CreateChannelScheme(th.Context, th.BasicChannel)
	require.Nil(t, appErr)

	t.Run("CreateChannel refuses a space pointed at a scheme governing an ordinary channel", func(t *testing.T) {
		_, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			DisplayName: "Space",
			Name:        "space-" + model.NewId(),
			Type:        model.ChannelTypeSpace,
			SchemeId:    &ordinaryScheme.Id,
		}, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
	})

	t.Run("UpdateChannel refuses repointing an existing space at the same scheme", func(t *testing.T) {
		space, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			DisplayName: "Space",
			Name:        "space-" + model.NewId(),
			Type:        model.ChannelTypeSpace,
		}, false)
		require.Nil(t, appErr)

		space.SchemeId = &ordinaryScheme.Id
		_, appErr = th.App.UpdateChannel(th.Context, space)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", appErr.Id)
	})
}
