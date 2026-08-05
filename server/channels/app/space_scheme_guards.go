// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// isSeededSpaceScheme reports whether schemeId is one of the three seeded space
// preset schemes. Resolving the id and reading its name costs one lookup, where
// resolving each reserved name in turn would cost three; the by-id read is also
// the cached one, and the names it is compared against cannot drift because
// renaming a seeded preset is refused. A lookup failure other than not-found
// fails closed.
func (a *App) isSeededSpaceScheme(schemeId string) (bool, *model.AppError) {
	scheme, err := a.Srv().Store().Scheme().Get(schemeId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return false, nil
		}
		return false, model.NewAppError("isSeededSpaceScheme", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	// Scope is part of the identity: a scheme of another scope carrying a
	// reserved name is a squatter the seeding migration refuses to adopt, and
	// deleting it is the operator's remedy.
	return scheme.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(scheme.Name), nil
}

// schemeHoldsSpaceGrants reports whether a scheme's generated channel roles
// currently carry a space permission.
//
// This is the durable half of the space-scheme test. Whether a space points at
// a scheme is live state that can be taken away — repoint the space at a preset,
// or delete it — but the permissions checkSpacePermissionScope let onto the
// scheme's roles while that association held stay written. Asking only whether a
// space points at the scheme today would therefore let a scheme that still
// grants admin_space and the page permissions move to an ordinary channel once
// the association lapses, where MergeChannelHigherScopedPermissions carries
// those grants through to its members.
//
// The roles are read by name through the cached path, the same way
// mergeChannelHigherScopedPermissions resolves scheme roles. A role write that
// has not yet invalidated this node's cache could be missed, which is why this
// is the second of two tests rather than the only one: the association check
// above it already refuses the scheme while a space holds it.
func (a *App) schemeHoldsSpaceGrants(schemeId string) (bool, *model.AppError) {
	scheme, err := a.Srv().Store().Scheme().Get(schemeId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return false, nil
		}
		return false, model.NewAppError("schemeHoldsSpaceGrants", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	names := []string{scheme.DefaultChannelAdminRole, scheme.DefaultChannelUserRole, scheme.DefaultChannelGuestRole}
	roles, nErr := a.Srv().Store().Role().GetByNames(names)
	if nErr != nil {
		return false, model.NewAppError("schemeHoldsSpaceGrants", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	rolesMap := make(map[string]*model.Role, len(roles))
	for _, role := range roles {
		rolesMap[role.Name] = role
	}
	return schemeGrantsSpacePermissions(scheme, rolesMap), nil
}

// checkSpaceSchemeName rejects creating or renaming a scheme to one of the
// three seeded space preset names: a pre-migration name squat would be silently
// adopted by the seeding migration's get-or-create, and the permission scope
// guard reads a preset name as proof of space authority.
//
// Deliberately not gated on the docs feature flag, for the same reason as
// checkSpacePermissionScope: the seeding runs unconditionally, so the names are
// reserved on every server, and a squat planted while the flag was off would
// still be there when it flips on.
func (a *App) checkSpaceSchemeName(where, name string) *model.AppError {
	if model.IsSpaceSchemeName(name) {
		return model.NewAppError(where, "app.scheme.save.space_scheme_name.app_error",
			map[string]any{"SchemeName": name}, "", http.StatusBadRequest)
	}
	return nil
}

// checkSpaceSchemeRename guards a scheme update in both directions: renaming a
// seeded preset away from its reserved name, and renaming any scheme into one.
// Space scheme identity is protected at this shared sink because a name-keyed
// delete refusal alone would be defeated by renaming the scheme first.
//
// The stored row has to be read to see the name the update replaces, so this
// runs before the save on every update.
func (a *App) checkSpaceSchemeRename(scheme *model.Scheme) *model.AppError {
	stored, err := a.Srv().Store().Scheme().Get(scheme.Id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("UpdateScheme", "app.scheme.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("UpdateScheme", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	if stored.Name == scheme.Name {
		return nil
	}

	// Only a channel-scoped scheme can actually be a space scheme, so the
	// rename refusal is scoped to that case. A scheme of any other scope
	// carrying a reserved name is a squatter that the seeding migration
	// refuses to adopt — renaming it away is the operator's remedy, and
	// refusing that rename too would leave the boot permanently blocked.
	if stored.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(stored.Name) {
		return model.NewAppError("UpdateScheme", "app.scheme.save.space_scheme_rename.app_error",
			map[string]any{"SchemeName": stored.Name}, "", http.StatusBadRequest)
	}
	return a.checkSpaceSchemeName("UpdateScheme", scheme.Name)
}

// checkSpaceSchemeDelete refuses deleting a scheme a space depends on. Deleting
// one blanks SchemeId on every channel using it, which would drop every member
// of every space on the scheme to the page-perm-less global roles. The seeded
// presets are refused by identity, and so is any scheme still referenced by a
// space backing channel — soft-deleted spaces included, since they are
// restorable and keep their SchemeId.
func (a *App) checkSpaceSchemeDelete(schemeId string) *model.AppError {
	refused, appErr := a.isSeededSpaceScheme(schemeId)
	if appErr != nil {
		return appErr
	}
	if !refused {
		// The count-then-delete window is not transactional — a concurrent
		// repoint can still race the delete; accepted for this
		// sysconsole-gated, low-frequency path.
		count, cErr := a.Srv().Store().Channel().CountSpaceChannelsByScheme(schemeId)
		if cErr != nil {
			return model.NewAppError("DeleteScheme", "app.scheme.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(cErr)
		}
		refused = count > 0
	}
	if refused {
		return model.NewAppError("DeleteScheme", "app.scheme.delete.space_scheme.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}
