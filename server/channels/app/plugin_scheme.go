// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// getSchemeByNameFromMaster resolves a scheme on the primary for plugin read-after-write calls.
func (a *App) getSchemeByNameFromMaster(name string) (*model.Scheme, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme, err := a.Srv().Store().Scheme().GetByNameFromMaster(name)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("GetSchemeByName", "app.scheme.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetSchemeByName", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return scheme, nil
}

// GetSchemeForChannel returns a channel's directly assigned scheme and generated roles. The
// channel-to-scheme lookup does not filter by channel type, so the same API works for ordinary
// channels and any opaque backing-channel type without exposing that type to the plugin.
func (a *App) GetSchemeForChannel(rctx request.CTX, channelID string) (scheme *model.Scheme, guestRole, userRole, adminRole *model.Role, err *model.AppError) {
	scheme, sErr := a.Srv().Store().Scheme().GetForChannelFromMaster(channelID)
	if sErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(sErr, &nfErr) {
			err = model.NewAppError("GetSchemeForChannel", "app.scheme.get.app_error", nil, "channel has no directly assigned scheme", http.StatusNotFound).Wrap(sErr)
		} else {
			err = model.NewAppError("GetSchemeForChannel", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(sErr)
		}
		return
	}

	// Both reads use the primary. The scheme association must show a recent channel update, and
	// the generated roles may have been created by SaveChannelSchemeWithRoles moments earlier, so a
	// replica or a cold role cache can miss them.
	roles, nErr := a.Srv().Store().Role().GetByNamesFromMaster([]string{
		scheme.DefaultChannelGuestRole,
		scheme.DefaultChannelUserRole,
		scheme.DefaultChannelAdminRole,
	})
	if nErr != nil {
		err = model.NewAppError("GetSchemeForChannel", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		return
	}
	if err = a.mergeChannelHigherScopedPermissions(roles); err != nil {
		return
	}

	rolesByName := make(map[string]*model.Role, len(roles))
	for _, role := range roles {
		rolesByName[role.Name] = role
	}
	guestRole = rolesByName[scheme.DefaultChannelGuestRole]
	userRole = rolesByName[scheme.DefaultChannelUserRole]
	adminRole = rolesByName[scheme.DefaultChannelAdminRole]
	if guestRole == nil || userRole == nil || adminRole == nil {
		scheme, guestRole, userRole, adminRole = nil, nil, nil, nil
		err = model.NewAppError("GetSchemeForChannel", "app.role.get_by_names.app_error", nil, "one or more channel scheme roles were not found", http.StatusNotFound)
	}

	return
}

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
			// any other scope would be inert. Refused rather than dropped, so the
			// caller is told the request was rejected.
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
	// insert and adopts the scheme the other insert created rather than failing
	// the caller.
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
// occupies it. The name is derived rather than allocated, so whatever is stored under
// it is unverified input; a mismatch is refused rather than repaired, since these
// roles govern every channel already pointing at the scheme.
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
	conflictParams := map[string]any{
		"SchemeName":    name,
		"UserRoleName":  scheme.DefaultChannelUserRole,
		"AdminRoleName": scheme.DefaultChannelAdminRole,
		"GuestRoleName": scheme.DefaultChannelGuestRole,
	}
	if scheme.DeleteAt != 0 || scheme.Scope != model.SchemeScopeChannel {
		return nil, model.NewAppError("getPluginChannelScheme", "app.scheme.plugin_scheme.conflict.app_error",
			conflictParams, "", http.StatusInternalServerError)
	}

	if err := a.Srv().validateSchemeRoles(scheme, user, admin, guest); err != nil {
		var conflict *errSchemeRoleConflict
		if errors.As(err, &conflict) {
			return nil, model.NewAppError("getPluginChannelScheme", "app.scheme.plugin_scheme.conflict.app_error",
				conflictParams, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil, model.NewAppError("getPluginChannelScheme", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return scheme, nil
}

// errSchemeRoleConflict reports a generated role that is not the row its scheme's name implies,
// as distinct from a failed read.
type errSchemeRoleConflict struct {
	roleName string
	reason   string
}

func (e *errSchemeRoleConflict) Error() string {
	return fmt.Sprintf("generated role %q %s", e.roleName, e.reason)
}

// validateSchemeRoles reads scheme's three generated roles on the primary and returns an
// *errSchemeRoleConflict for the first that has no row, is deleted, is not scheme-managed, is not
// owned by scheme, or grants a permission set other than user, admin or guest respectively. Both
// adoption paths apply it to a row found under a derived name — the seeding migration after a lost
// insert and the plugin pool on every lookup — since whatever is stored under such a name is
// unverified input. The read is store-direct and on the primary: the comparison needs the exact
// stored permissions, where GetRolesByNames applies higher-scope inheritance, and a caller that
// lost the create race must see the row another node wrote moments ago.
func (s *Server) validateSchemeRoles(scheme *model.Scheme, user, admin, guest []string) error {
	roles, err := s.Store().Role().GetByNamesFromMaster([]string{
		scheme.DefaultChannelUserRole,
		scheme.DefaultChannelAdminRole,
		scheme.DefaultChannelGuestRole,
	})
	if err != nil {
		return err
	}
	rolesByName := make(map[string]*model.Role, len(roles))
	for _, role := range roles {
		rolesByName[role.Name] = role
	}

	for _, expected := range []struct {
		name        string
		permissions []string
	}{
		{scheme.DefaultChannelUserRole, user},
		{scheme.DefaultChannelAdminRole, admin},
		{scheme.DefaultChannelGuestRole, guest},
	} {
		role := rolesByName[expected.name]
		if role == nil {
			return &errSchemeRoleConflict{roleName: expected.name, reason: "has no row on the primary"}
		}
		if role.DeleteAt != 0 || !role.SchemeManaged || role.SchemeId == nil || *role.SchemeId != scheme.Id {
			return &errSchemeRoleConflict{roleName: expected.name, reason: "is deleted, not scheme-managed, or not owned by the scheme"}
		}
		if !slices.Equal(model.NormalizePermissions(role.Permissions), model.NormalizePermissions(expected.permissions)) {
			return &errSchemeRoleConflict{roleName: expected.name, reason: "has a different permission set"}
		}
	}
	return nil
}
