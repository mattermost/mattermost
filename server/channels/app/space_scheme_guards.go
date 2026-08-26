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

// getSchemeWithMasterFallback resolves on the replica and retries a miss on the primary for
// immediate post-create reads.
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

// isSeededSpaceScheme reports whether schemeId is a live seeded space preset. Identity is channel
// scope plus a reserved name, not the id. A lookup failure other than not-found fails closed.
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

// isPluginChannelScheme reports whether schemeId has the channel scope and reserved name shape
// used by GetOrCreatePluginChannelScheme. It identifies protected shape, not provenance.
func (a *App) isPluginChannelScheme(schemeId string) (bool, *model.AppError) {
	scheme, appErr := a.getSchemeFromMaster("isPluginChannelScheme", schemeId)
	if appErr != nil {
		return false, appErr
	}
	if scheme == nil {
		return false, nil
	}
	return scheme.DeleteAt == 0 && scheme.Scope == model.SchemeScopeChannel && model.IsPluginChannelSchemeName(scheme.Name), nil
}

// checkSpaceSchemeName rejects creating or renaming a scheme into a reserved name:
// a seeded space preset, or a name of the shape GetOrCreatePluginChannelScheme
// creates. An incompatible preset row blocks seeding, while a plugin-shaped row blocks its
// deterministic pool key until operator repair. Not gated on
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

// checkSpaceSchemeUpdate guards a scheme update in both directions: renaming a
// seeded preset away from its reserved name, and renaming any scheme into one. It
// also freezes a seeded preset's generated-role references while allowing safe
// metadata updates. A name-keyed delete refusal alone would be defeated by renaming
// the scheme first.
func (a *App) checkSpaceSchemeUpdate(scheme *model.Scheme) *model.AppError {
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
	// Only a channel-scoped scheme can actually be a space scheme, so the
	// rename refusal is scoped to that case. A scheme of any other scope
	// carrying a reserved name is a conflicting row that the seeding migration
	// refuses to adopt — renaming it away is the operator's remedy, and
	// refusing that rename too would leave the boot permanently blocked.
	if stored.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(stored.Name) {
		if stored.Name != scheme.Name {
			return model.NewAppError("UpdateScheme", "app.scheme.save.space_scheme_rename.app_error",
				map[string]any{"SchemeName": stored.Name}, "", http.StatusBadRequest)
		}
		if stored.DefaultChannelAdminRole != scheme.DefaultChannelAdminRole ||
			stored.DefaultChannelUserRole != scheme.DefaultChannelUserRole ||
			stored.DefaultChannelGuestRole != scheme.DefaultChannelGuestRole {
			return model.NewAppError("UpdateScheme", "app.scheme.save.space_scheme_roles.app_error",
				map[string]any{"SchemeName": stored.Name}, "", http.StatusBadRequest)
		}
		return nil
	}
	// A plugin channel scheme is identified by its name and nothing else: the role
	// freeze, the delete refusal and the get-or-create's own lookup all key off it.
	// Renaming one away unfreezes its roles while every channel already pointing at it
	// keeps resolving them, and leaves the next get-or-create for the same permission
	// set creating a second scheme beside it.
	if stored.Scope == model.SchemeScopeChannel && model.IsPluginChannelSchemeName(stored.Name) {
		if stored.Name != scheme.Name {
			return model.NewAppError("UpdateScheme", "app.scheme.save.plugin_scheme_rename.app_error",
				map[string]any{"SchemeName": stored.Name}, "", http.StatusBadRequest)
		}
		if stored.DefaultChannelAdminRole != scheme.DefaultChannelAdminRole ||
			stored.DefaultChannelUserRole != scheme.DefaultChannelUserRole ||
			stored.DefaultChannelGuestRole != scheme.DefaultChannelGuestRole {
			return model.NewAppError("UpdateScheme", "app.scheme.save.plugin_scheme_roles.app_error",
				map[string]any{"SchemeName": stored.Name}, "", http.StatusBadRequest)
		}
		return nil
	}
	if stored.Name == scheme.Name {
		return nil
	}
	return a.checkSpaceSchemeName("UpdateScheme", scheme.Name)
}

// checkSpaceSchemeDelete refuses deleting the fixed presets and immutable plugin pool schemes.
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
	return nil
}
