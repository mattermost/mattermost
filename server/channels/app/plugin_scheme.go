// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// GetOrCreatePluginChannelScheme resolves the channel scheme whose three generated
// roles grant exactly user, admin and guest for pluginID, creating it on first use.
// Equal normalized inputs select one deterministic pool name; an existing row is
// reused only after its scope and role contents are validated.
//
// pluginID is the calling plugin's manifest id, taken at the RPC boundary rather than caller input;
// it contributes the namespace portion of the deterministic name.
//
// The returned scheme is complete when committed. Application role-write paths treat its generated
// roles as immutable; callers request a different scheme instead of reconfiguring this one.
func (a *App) GetOrCreatePluginChannelScheme(pluginID string, user, admin, guest []string) (*model.Scheme, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}
	if pluginID == "" {
		return nil, model.NewAppError("GetOrCreatePluginChannelScheme", "app.scheme.plugin_scheme.no_plugin_id.app_error", nil, "", http.StatusInternalServerError)
	}
	for _, set := range [][]string{user, admin, guest} {
		for _, id := range set {
			// A generated channel role only resolves on a channel, so a permission of
			// any other scope would be inert. Refused rather than dropped, so a
			// caller that asks for one learns it did not land.
			if !model.IsChannelScopedPermissionID(id) {
				return nil, model.NewAppError("GetOrCreatePluginChannelScheme", "app.scheme.plugin_scheme.permission_scope.app_error",
					map[string]any{"PermissionId": id}, "", http.StatusBadRequest)
			}
		}
	}

	name := model.PluginChannelSchemeName(pluginID, user, admin, guest)

	existing, appErr := a.getPluginChannelScheme(name, user, admin, guest)
	if appErr != nil {
		return nil, appErr
	}
	if existing != nil {
		return existing, nil
	}

	scheme, err := a.Srv().Store().Scheme().SaveChannelSchemeWithRoles(&model.Scheme{
		Name:        name,
		DisplayName: name,
		Scope:       model.SchemeScopeChannel,
	}, user, admin, guest)
	if err == nil {
		return scheme, nil
	}

	// The name is unique, so a concurrent first use of the same sets loses this
	// insert and adopts the winner's scheme rather than failing the caller.
	adopted, adoptErr := a.getPluginChannelScheme(name, user, admin, guest)
	if adoptErr != nil {
		return nil, adoptErr
	}
	if adopted != nil {
		return adopted, nil
	}

	var invErr *store.ErrInvalidInput
	var appErrFromStore *model.AppError
	switch {
	case errors.As(err, &appErrFromStore):
		return nil, appErrFromStore
	case errors.As(err, &invErr):
		return nil, model.NewAppError("GetOrCreatePluginChannelScheme", "app.scheme.save.invalid_scheme.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	default:
		return nil, model.NewAppError("GetOrCreatePluginChannelScheme", "app.scheme.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
}

// getPluginChannelScheme returns the scheme stored under name when it grants what
// name implies, nil when nothing is stored there, and an error when something else
// occupies it. The name is derived rather than allocated, so whatever sits at it is
// unverified input; a mismatch is refused rather than repaired, since these roles
// govern every channel already pointing at the scheme.
func (a *App) getPluginChannelScheme(name string, user, admin, guest []string) (*model.Scheme, *model.AppError) {
	scheme, err := a.Srv().Store().Scheme().GetByNameFromMaster(name)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, nil
		}
		return nil, model.NewAppError("getPluginChannelScheme", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// A soft-deleted row still occupies the name — the read carries no DeleteAt
	// filter and Schemes.Name is unique across deleted rows — so it can neither be
	// returned nor replaced.
	if scheme.DeleteAt != 0 || scheme.Scope != model.SchemeScopeChannel {
		return nil, model.NewAppError("getPluginChannelScheme", "app.scheme.plugin_scheme.conflict.app_error",
			map[string]any{"SchemeName": name}, "", http.StatusInternalServerError)
	}

	// Read directly from the store and on the primary. The comparison below needs
	// the exact stored permissions; GetRolesByNames returns effective permissions
	// after applying higher-scope inheritance. The primary read also lets a caller
	// that lost the create race see the row another node wrote moments ago.
	roles, nErr := a.Srv().Store().Role().GetByNamesFromMaster([]string{
		scheme.DefaultChannelUserRole,
		scheme.DefaultChannelAdminRole,
		scheme.DefaultChannelGuestRole,
	})
	if nErr != nil {
		return nil, model.NewAppError("getPluginChannelScheme", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	byName := make(map[string][]string, len(roles))
	for _, role := range roles {
		byName[role.Name] = role.Permissions
	}

	for _, want := range []struct {
		roleName    string
		permissions []string
	}{
		{scheme.DefaultChannelUserRole, user},
		{scheme.DefaultChannelAdminRole, admin},
		{scheme.DefaultChannelGuestRole, guest},
	} {
		stored, ok := byName[want.roleName]
		if !ok || !slices.Equal(model.NormalizePermissions(stored), model.NormalizePermissions(want.permissions)) {
			return nil, model.NewAppError("getPluginChannelScheme", "app.scheme.plugin_scheme.conflict.app_error",
				map[string]any{"SchemeName": name}, "", http.StatusInternalServerError)
		}
	}

	return scheme, nil
}
