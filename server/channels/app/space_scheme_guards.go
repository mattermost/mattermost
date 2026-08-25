// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// getSchemeFromMaster resolves a scheme on the primary only. Every guard checking
// a scheme's space permissions uses this rather than the replica-first
// fallback below: a replica that has not yet seen a delete answers DeleteAt == 0 for
// a row the primary has already soft-deleted, and the deleted-scheme refusals have
// to trust that field.
//
// A nil scheme with a nil error means the id resolves to no row; each caller refuses
// that its own way.
func (a *App) getSchemeFromMaster(where, schemeId string) (*model.Scheme, *model.AppError) {
	scheme, err := a.Srv().Store().Scheme().GetFromMaster(schemeId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return nil, model.NewAppError(where, "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil, nil
	}
	return scheme, nil
}

// getSchemeWithMasterFallback resolves a scheme on the replica, re-reading on the
// primary when it has no row: nothing populates the scheme cache on create, so a
// scheme created moments earlier is absent from the replica.
func (a *App) getSchemeWithMasterFallback(where, schemeId string) (*model.Scheme, *model.AppError) {
	scheme, err := a.Srv().Store().Scheme().Get(schemeId)
	if err == nil {
		return scheme, nil
	}

	var nfErr *store.ErrNotFound
	if !errors.As(err, &nfErr) {
		return nil, model.NewAppError(where, "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return a.getSchemeFromMaster(where, schemeId)
}

// isSeededSpaceScheme reports whether schemeId is one of the seeded space preset
// schemes. Identity is the pair (channel scope, one of the reserved names), not the
// id. A lookup failure other than not-found fails closed.
func (a *App) isSeededSpaceScheme(schemeId string) (bool, *model.AppError) {
	scheme, appErr := a.getSchemeFromMaster("isSeededSpaceScheme", schemeId)
	if appErr != nil {
		return false, appErr
	}
	if scheme == nil {
		return false, nil
	}
	// Scope is part of the identity: a scheme of another scope carrying a reserved
	// name is a conflicting row the seeding migration refuses to adopt, and deleting
	// it is the operator's remedy.
	return scheme.DeleteAt == 0 && scheme.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(scheme.Name), nil
}

// isPluginChannelScheme reports whether schemeId identifies a plugin channel scheme
// created by GetOrCreatePluginChannelScheme. Identity is the pair (channel scope,
// plugin channel scheme name shape), the same shape the role-write freeze tests.
func (a *App) isPluginChannelScheme(schemeId string) (bool, *model.AppError) {
	scheme, appErr := a.getSchemeFromMaster("isPluginChannelScheme", schemeId)
	if appErr != nil {
		return false, appErr
	}
	if scheme == nil {
		return false, nil
	}
	return scheme.Scope == model.SchemeScopeChannel && model.IsPluginChannelSchemeName(scheme.Name), nil
}

// schemeHoldsSpaceGrants reports whether a scheme's generated channel roles
// currently carry a space permission — the durable half of the space-scheme test.
// Whether a space points at a scheme can be taken away, but the grants written onto
// its roles stay written, and MergeChannelHigherScopedPermissions would carry them
// through to an ordinary channel's members. Both reads go to the primary and
// neither is served by a cache.
func (a *App) schemeHoldsSpaceGrants(schemeId string) (bool, *model.AppError) {
	scheme, appErr := a.getSchemeFromMaster("schemeHoldsSpaceGrants", schemeId)
	if appErr != nil {
		return false, appErr
	}
	if scheme == nil {
		return false, nil
	}

	names := []string{scheme.DefaultChannelAdminRole, scheme.DefaultChannelUserRole, scheme.DefaultChannelGuestRole}
	roles, nErr := a.Srv().Store().Role().GetByNamesFromMaster(names)
	if nErr != nil {
		return false, model.NewAppError("schemeHoldsSpaceGrants", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	rolesMap := make(map[string]*model.Role, len(roles))
	for _, role := range roles {
		rolesMap[role.Name] = role
	}
	return schemeGrantsSpacePermissions(scheme, rolesMap), nil
}

// checkSpaceSchemeName rejects creating or renaming a scheme into a reserved name:
// a seeded space preset, or a name of the shape GetOrCreatePluginChannelScheme
// creates. A preset squat would be adopted by the seeding's get-or-create; a squat
// on a plugin channel scheme name permanently denies that permission set to the
// plugin deriving it, since the name is a pure function of the set. Not gated on
// the docs feature flag, for the same reason as checkSpacePermissionScope.
func (a *App) checkSpaceSchemeName(where, name string) *model.AppError {
	if model.IsSpaceSchemeName(name) {
		return model.NewAppError(where, "app.scheme.save.space_scheme_name.app_error",
			map[string]any{"SchemeName": name}, "", http.StatusBadRequest)
	}
	if model.IsPluginChannelSchemeName(name) {
		return model.NewAppError(where, "app.scheme.save.plugin_scheme_name.app_error",
			map[string]any{"SchemeName": name}, "", http.StatusBadRequest)
	}
	return nil
}

// checkSpaceSchemeRename guards a scheme update in both directions: renaming a
// seeded preset away from its reserved name, and renaming any scheme into one. A
// name-keyed delete refusal alone would be defeated by renaming the scheme first.
func (a *App) checkSpaceSchemeRename(scheme *model.Scheme) *model.AppError {
	// The import path relies on the primary fallback: GetSchemeByName re-reads on the
	// primary when the replica has no row yet, then passes the id straight to
	// UpdateScheme, so the stored-row read here has to reach it the same way.
	stored, appErr := a.getSchemeWithMasterFallback("UpdateScheme", scheme.Id)
	if appErr != nil {
		return appErr
	}
	if stored == nil {
		return model.NewAppError("UpdateScheme", "app.scheme.get.app_error", nil, "", http.StatusNotFound)
	}
	if stored.Name == scheme.Name {
		return nil
	}

	// Only a channel-scoped scheme can actually be a space scheme, so the
	// rename refusal is scoped to that case. A scheme of any other scope
	// carrying a reserved name is a conflicting row that the seeding migration
	// refuses to adopt — renaming it away is the operator's remedy, and
	// refusing that rename too would leave the boot permanently blocked.
	if stored.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(stored.Name) {
		return model.NewAppError("UpdateScheme", "app.scheme.save.space_scheme_rename.app_error",
			map[string]any{"SchemeName": stored.Name}, "", http.StatusBadRequest)
	}
	// A plugin channel scheme is identified by its name and nothing else: the role
	// freeze, the delete refusal and the get-or-create's own lookup all key off it.
	// Renaming one away unfreezes its roles while every channel already pointing at it
	// keeps resolving them, and leaves the next get-or-create for the same permission
	// set creating a second scheme beside it.
	if stored.Scope == model.SchemeScopeChannel && model.IsPluginChannelSchemeName(stored.Name) {
		return model.NewAppError("UpdateScheme", "app.scheme.save.plugin_scheme_rename.app_error",
			map[string]any{"SchemeName": stored.Name}, "", http.StatusBadRequest)
	}
	return a.checkSpaceSchemeName("UpdateScheme", scheme.Name)
}

// checkSpaceSchemeDelete refuses deleting a scheme a space depends on. Deleting one
// blanks SchemeId on every channel using it, which would drop every member of every
// space on the scheme to the page-perm-less global roles. The seeded presets are
// refused by identity, and so is any scheme still referenced by a space backing
// channel — soft-deleted spaces included, since they are restorable and keep their
// SchemeId.
func (a *App) checkSpaceSchemeDelete(schemeId string) *model.AppError {
	isPreset, appErr := a.isSeededSpaceScheme(schemeId)
	if appErr != nil {
		return appErr
	}
	if isPreset {
		return model.NewAppError("DeleteScheme", "app.scheme.delete.space_scheme.app_error", nil, "", http.StatusBadRequest)
	}

	// A plugin channel scheme is refused whether or not anything references it today:
	// Schemes.Name is unique across deleted rows, so a deleted one leaves the next
	// get-or-create for that permission set resolving to a row it must refuse rather
	// than creating a replacement. Reported separately from the space-scheme refusal
	// below: an operator looking at a plugin channel scheme has no space to detach to
	// make the delete succeed, so the space wording would send them looking for one.
	isPluginScheme, pErr := a.isPluginChannelScheme(schemeId)
	if pErr != nil {
		return pErr
	}
	if isPluginScheme {
		return model.NewAppError("DeleteScheme", "app.scheme.delete.plugin_scheme.app_error", nil, "", http.StatusBadRequest)
	}

	// The count-then-delete window is not transactional — a concurrent repoint can
	// still race the delete; accepted for this sysconsole-gated, low-frequency path.
	count, cErr := a.Srv().Store().Channel().CountSpaceChannelsByScheme(schemeId)
	if cErr != nil {
		return model.NewAppError("DeleteScheme", "app.scheme.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(cErr)
	}
	if count > 0 {
		return model.NewAppError("DeleteScheme", "app.scheme.delete.space_scheme.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}
