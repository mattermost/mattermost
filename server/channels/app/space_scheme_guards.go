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
// fallback below: a replica that has not yet seen a delete returns DeleteAt == 0 for
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

// reservedSchemeKind is one of the two channel scheme shapes the guards below protect: a seeded
// space preset, or the shape GetOrCreatePluginChannelScheme creates. Identity is channel scope
// plus the name, not the id, and it identifies protected shape, not provenance. Each kind reports
// its refusals under its own error ids.
type reservedSchemeKind struct {
	plugin bool
}

var (
	seededSpaceSchemeKind = &reservedSchemeKind{}

	// A plugin channel scheme is identified by its name and nothing else: the write
	// refusal on its generated roles (checkFrozenSchemeRole), the delete refusal
	// (checkSpaceSchemeDelete) and the get-or-create's own lookup all key off it.
	// Renaming one away unfreezes its roles while every channel already pointing at it
	// keeps resolving them, and leaves the next get-or-create for the same permission
	// set creating a second scheme beside it. Deleting one is refused whether or not
	// anything references it today: Schemes.Name is unique across deleted rows, so a
	// deleted one leaves the next get-or-create for that permission set resolving to a
	// row it must refuse rather than creating a replacement. The delete refusal is
	// reported separately from the preset's: an operator looking at a plugin channel
	// scheme has no space to detach to make the delete succeed, so the space wording
	// would send them looking for one.
	pluginChannelSchemeKind = &reservedSchemeKind{plugin: true}
)

func (k *reservedSchemeKind) renameError(schemeName string) *model.AppError {
	params := map[string]any{"SchemeName": schemeName}
	if k.plugin {
		return model.NewAppError("UpdateScheme", "app.scheme.save.plugin_scheme_rename.app_error", params, "", http.StatusBadRequest)
	}
	return model.NewAppError("UpdateScheme", "app.scheme.save.space_scheme_rename.app_error", params, "", http.StatusBadRequest)
}

func (k *reservedSchemeKind) rolesError(schemeName string) *model.AppError {
	params := map[string]any{"SchemeName": schemeName}
	if k.plugin {
		return model.NewAppError("UpdateScheme", "app.scheme.save.plugin_scheme_roles.app_error", params, "", http.StatusBadRequest)
	}
	return model.NewAppError("UpdateScheme", "app.scheme.save.space_scheme_roles.app_error", params, "", http.StatusBadRequest)
}

func (k *reservedSchemeKind) scopeError(schemeName string) *model.AppError {
	params := map[string]any{"SchemeName": schemeName}
	if k.plugin {
		return model.NewAppError("UpdateScheme", "app.scheme.save.plugin_scheme_scope.app_error", params, "", http.StatusBadRequest)
	}
	return model.NewAppError("UpdateScheme", "app.scheme.save.space_scheme_scope.app_error", params, "", http.StatusBadRequest)
}

func (k *reservedSchemeKind) deleteError() *model.AppError {
	if k.plugin {
		return model.NewAppError("DeleteScheme", "app.scheme.delete.plugin_scheme.app_error", nil, "", http.StatusBadRequest)
	}
	return model.NewAppError("DeleteScheme", "app.scheme.delete.space_scheme.app_error", nil, "", http.StatusBadRequest)
}

// reservedSchemeKindOf classifies scheme by scope and name; nil means it is not reserved.
// Scope is part of the identity: a scheme of another scope carrying a reserved name is a
// conflicting row the seeding migration refuses to adopt, and renaming or deleting it is
// the operator's remedy — refusing that too would leave the boot permanently blocked.
func reservedSchemeKindOf(scheme *model.Scheme) *reservedSchemeKind {
	if scheme.Scope != model.SchemeScopeChannel {
		return nil
	}
	if model.IsSpaceSchemeName(scheme.Name) {
		return seededSpaceSchemeKind
	}
	if model.IsPluginChannelSchemeName(scheme.Name) {
		return pluginChannelSchemeKind
	}
	return nil
}

// reservedSchemeKindByID classifies the scheme stored under schemeId with one primary read. A
// missing or deleted row is not reserved. A lookup failure other than not-found fails closed.
func (a *App) reservedSchemeKindByID(where, schemeId string) (*reservedSchemeKind, *model.AppError) {
	scheme, appErr := a.getSchemeFromMaster(where, schemeId)
	if appErr != nil {
		return nil, appErr
	}
	if scheme == nil || scheme.DeleteAt != 0 {
		return nil, nil
	}
	return reservedSchemeKindOf(scheme), nil
}

// checkSpaceSchemeName rejects creating or renaming a scheme into a reserved name:
// a seeded space preset, or a name of the shape GetOrCreatePluginChannelScheme
// creates. An incompatible preset row blocks seeding, while a plugin-shaped row
// occupies the exact name GetOrCreatePluginChannelScheme derives for that
// plugin/permission combination, so that combination cannot get its real scheme
// until an operator clears the row. Not gated on
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
// also freezes a reserved scheme's scope and generated-role references while
// allowing safe metadata updates. A name-keyed delete refusal alone would be
// defeated by renaming the scheme first.
func (a *App) checkSpaceSchemeUpdate(scheme *model.Scheme) *model.AppError {
	// The import path (importScheme) resolves the existing scheme by a plain
	// replica read (GetSchemeByName), so a scheme this same request just created
	// could still be missing there; this guard's own read tolerates that by
	// falling back to the primary.
	stored, appErr := a.getSchemeWithMasterFallback("UpdateScheme", scheme.Id)
	if appErr != nil {
		return appErr
	}
	if stored == nil {
		return model.NewAppError("UpdateScheme", "app.scheme.get.app_error", nil, "", http.StatusNotFound)
	}
	if kind := reservedSchemeKindOf(stored); kind != nil {
		if stored.Name != scheme.Name {
			return kind.renameError(stored.Name)
		}
		// Scope is part of the reserved identity: a scope flip would make
		// reservedSchemeKindOf stop classifying the row as reserved, unfreezing
		// its name and generated roles on every later write.
		if stored.Scope != scheme.Scope {
			return kind.scopeError(stored.Name)
		}
		if stored.DefaultChannelAdminRole != scheme.DefaultChannelAdminRole ||
			stored.DefaultChannelUserRole != scheme.DefaultChannelUserRole ||
			stored.DefaultChannelGuestRole != scheme.DefaultChannelGuestRole {
			return kind.rolesError(stored.Name)
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
	kind, appErr := a.reservedSchemeKindByID("DeleteScheme", schemeId)
	if appErr != nil {
		return appErr
	}
	if kind != nil {
		return kind.deleteError()
	}
	return nil
}
