// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func (a *App) GetRole(id string) (*model.Role, *model.AppError) {
	role, err := a.Srv().Store().Role().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetRole", "app.role.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	appErr := a.Srv().mergeChannelHigherScopedPermissions([]*model.Role{role})
	if appErr != nil {
		return nil, appErr
	}

	return role, nil
}

func (a *App) GetAllRoles() ([]*model.Role, *model.AppError) {
	roles, err := a.Srv().Store().Role().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetAllRoles", "app.role.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	appErr := a.Srv().mergeChannelHigherScopedPermissions(roles)
	if appErr != nil {
		return nil, appErr
	}

	return roles, nil
}

func (s *Server) GetRoleByName(ctx context.Context, name string) (*model.Role, *model.AppError) {
	role, nErr := s.Store().Role().GetByName(ctx, name)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("GetRoleByName", "app.role.get_by_name.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("GetRoleByName", "app.role.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	err := s.mergeChannelHigherScopedPermissions([]*model.Role{role})
	if err != nil {
		return nil, err
	}

	return role, nil
}

func (a *App) GetRoleByName(rctx request.CTX, name string) (*model.Role, *model.AppError) {
	return a.Srv().GetRoleByName(rctx.Context(), name)
}

func (a *App) GetRolesByNames(names []string) ([]*model.Role, *model.AppError) {
	roles, nErr := a.Srv().Store().Role().GetByNames(names)
	if nErr != nil {
		return nil, model.NewAppError("GetRolesByNames", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	err := a.mergeChannelHigherScopedPermissions(roles)
	if err != nil {
		return nil, err
	}

	return roles, nil
}

func (a *App) DeleteRole(id string) (*model.Role, *model.AppError) {
	role, err := a.Srv().Store().Role().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeleteRole", "app.role.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("DeleteRole", "app.role.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return role, nil
}

// mergeChannelHigherScopedPermissions updates the permissions based on the role type, whether the permission is
// moderated, and the value of the permission on the higher-scoped scheme.
func (s *Server) mergeChannelHigherScopedPermissions(roles []*model.Role) *model.AppError {
	var higherScopeNamesToQuery []string

	for _, role := range roles {
		if role.SchemeManaged {
			higherScopeNamesToQuery = append(higherScopeNamesToQuery, role.Name)
		}
	}

	if len(higherScopeNamesToQuery) == 0 {
		return nil
	}

	higherScopedPermissionsMap, err := s.Store().Role().ChannelHigherScopedPermissions(higherScopeNamesToQuery)
	if err != nil {
		return model.NewAppError("mergeChannelHigherScopedPermissions", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, role := range roles {
		if role.SchemeManaged {
			if higherScopedPermissions, ok := higherScopedPermissionsMap[role.Name]; ok {
				role.MergeChannelHigherScopedPermissions(higherScopedPermissions)
			}
		}
	}

	return nil
}

// mergeChannelHigherScopedPermissions updates the permissions based on the role type, whether the permission is
// moderated, and the value of the permission on the higher-scoped scheme.
func (a *App) mergeChannelHigherScopedPermissions(roles []*model.Role) *model.AppError {
	return a.Srv().mergeChannelHigherScopedPermissions(roles)
}

func (a *App) PatchRole(role *model.Role, patch *model.RolePatch) (*model.Role, *model.AppError) {
	// If patch is a no-op then short-circuit the store.
	if patch.Permissions != nil && reflect.DeepEqual(*patch.Permissions, role.Permissions) {
		return role, nil
	}

	role.Patch(patch)
	role, err := a.UpdateRole(role)
	if err != nil {
		return nil, err
	}

	if appErr := a.sendUpdatedRoleEvent(role); appErr != nil {
		return nil, appErr
	}

	return role, err
}

func asPermissionSet(permissions []string) map[string]bool {
	set := make(map[string]bool, len(permissions))
	for _, p := range permissions {
		set[p] = true
	}
	return set
}

// hasSpaceChannelScopedPermission reports whether any of the permissions is one
// of the channel-scoped space permissions.
func hasSpaceChannelScopedPermission(permissions []string) bool {
	return slices.ContainsFunc(permissions, model.IsSpaceChannelScopedPermissionID)
}

// spacePermissionAddDiff returns the channel-scoped space permissions present
// in the incoming permission set and absent from the stored one. A diff, not a
// presence check: removing a leaked grant must stay possible. The stored set is
// built only once a guarded permission actually turns up, so a role write
// carrying none allocates nothing.
func spacePermissionAddDiff(incoming, stored []string) []string {
	var added []string
	var storedSet map[string]bool
	for _, p := range incoming {
		if !model.IsSpaceChannelScopedPermissionID(p) {
			continue
		}
		if storedSet == nil {
			storedSet = asPermissionSet(stored)
		}
		if !storedSet[p] {
			added = append(added, p)
		}
	}
	return added
}

// storedRoleForSpaceGuard reads the row a role save will overwrite, so the scope
// guard can diff the incoming permissions against it. A nil role with a nil error
// means there is no stored row, and every incoming guarded permission counts as
// an add.
//
// Keyed by Id wherever the caller supplies one, which is every sink that reaches
// UpdateRole with a role it first read back. Role().Get is the one read of a role
// that no cache layer serves, where GetByName is answered from the local cache
// before the context is even consulted — so store.WithMaster does not make it
// fresh, and a peer node's removal that has not yet invalidated this node's entry
// would leave the guard diffing against a stale-wider baseline and letting a
// re-add through.
//
// Name is the fallback for a save carrying no Id. Keying by Id first also removes
// the divergent-Id/Name hazard by construction: the baseline is now read from the
// same row the save will write, so the two can no longer select different rows.
func (a *App) storedRoleForSpaceGuard(role *model.Role) (*model.Role, *model.AppError) {
	readErr := func(err error) *model.AppError {
		// An unreadable stored role cannot be diffed against; failing here beats
		// misreporting the cause as a scope violation.
		return model.NewAppError("UpdateRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var nfErr *store.ErrNotFound

	if role.Id != "" {
		storedRole, err := a.Srv().Store().Role().Get(role.Id)
		if err != nil {
			if !errors.As(err, &nfErr) {
				return nil, readErr(err)
			}
			return nil, nil
		}
		return storedRole, nil
	}

	if role.Name == "" {
		return nil, nil
	}

	storedRole, err := a.Srv().Store().Role().GetByName(store.WithMaster(context.Background()), role.Name)
	if err != nil {
		if !errors.As(err, &nfErr) {
			return nil, readErr(err)
		}
		return nil, nil
	}
	return storedRole, nil
}

// rejectSpaceCapabilityRoleOutsideSpace reports whether an ExplicitRoles write
// carries an atomic space capability role where it cannot legitimately mean
// anything. Those roles grant space authority on a single space's backing
// channel, so ownerIsSpaceChannel is the whole test: false for every ordinary
// channel, and false for a team member, whose roles are consulted as the
// fallback for every channel in the team and so would spread one space's grant
// across all of them.
//
// Both ExplicitRoles sinks call this rather than repeating the predicate, so a
// future write path has one function to find instead of the rule to rediscover.
// Each sink builds its own AppError, because the i18n extractor only collects
// message IDs written as literals at the model.NewAppError call site.
func rejectSpaceCapabilityRoleOutsideSpace(rctx request.CTX, where, roleName string, ownerIsSpaceChannel bool) bool {
	if !model.IsSpaceCapabilityRole(roleName) || ownerIsSpaceChannel {
		return false
	}
	// A refused space grant is a scope violation worth an operator trail, not
	// just an error to the caller.
	rctx.Logger().Warn("Refused a space capability role outside a space",
		mlog.String("where", where),
		mlog.String("role_name", roleName),
	)
	return true
}

// checkSpacePermissionScope rejects a role write that adds any channel-scoped
// space permission (the six page operations and admin_space) to a role whose
// scheme does not govern a space, which a seeded preset name or a space backing
// channel pointing at the scheme proves; system_admin is the single exception.
// The guard governs the App sinks only; migration seeding writes store-direct,
// below it.
//
// Deliberately not gated on the docs feature flag. The permissions, roles and
// preset schemes are seeded unconditionally at boot, so a grant planted while
// the flag was off would survive the flip and become live space authority, and
// nothing re-validates stored rows at enable time.
func (a *App) checkSpacePermissionScope(role *model.Role, stored []string) *model.AppError {
	added := spacePermissionAddDiff(role.Permissions, stored)
	if len(added) == 0 {
		return nil
	}

	reject := func() *model.AppError {
		return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_permission_scope.app_error",
			map[string]any{"RoleName": role.Name}, "permissions="+strings.Join(added, ","), http.StatusBadRequest)
	}

	if role.Name == model.SystemAdminRoleId {
		// system_admin legitimately carries every space permission, so an add
		// here is never a scope violation.
		return nil
	}

	if model.IsSpaceCapabilityRole(role.Name) {
		// Widening an atomic capability role is a code+migration change, never
		// a runtime role write.
		return reject()
	}

	if model.IsBuiltInRole(role.Name) {
		// Team/system built-ins and the global channel-scoped built-ins.
		return reject()
	}

	if role.SchemeId != nil && *role.SchemeId != "" {
		scheme, err := a.Srv().Store().Scheme().Get(*role.SchemeId)
		if err != nil {
			var nfErr *store.ErrNotFound
			if !errors.As(err, &nfErr) {
				// A store failure is not a scope violation; reporting it as one
				// would tell the caller their role is malformed when the database
				// is simply unreachable. Both outcomes refuse the write.
				return model.NewAppError("checkSpacePermissionScope", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			// Fail closed: an unresolvable scheme cannot prove space scope.
			return reject()
		}
		// Channel scope alone is too wide: an ordinary customer channel scheme
		// is channel-scoped too, so accepting it would let anyone who can write
		// a channel scheme hand its roles space authority. The scheme has to
		// prove it governs a space.
		//
		// Two proofs, both unforgeable. A seeded preset name is one: the names
		// are reserved, so no caller can mint or rename into them. A space
		// backing channel already pointing at the scheme is the other, and it
		// is what a per-space custom scheme presents — a name cannot be that
		// proof, because the caller chooses it. A scheme must therefore already
		// be attached to a space before its roles can take space permissions; a
		// role write that arrives first is rejected.
		if scheme.Scope == model.SchemeScopeChannel {
			if model.IsSpaceSchemeName(scheme.Name) {
				return nil
			}

			count, cErr := a.Srv().Store().Channel().CountSpaceChannelsByScheme(*role.SchemeId)
			if cErr != nil {
				return model.NewAppError("checkSpacePermissionScope", "app.channel.count_space_channels_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(cErr)
			}
			if count > 0 {
				return nil
			}
		}
		return reject()
	}

	// nil SchemeId with an unrecognized name: fail closed.
	return reject()
}

func (a *App) CreateRole(role *model.Role) (*model.Role, *model.AppError) {
	role.Id = ""
	role.CreateAt = 0
	role.UpdateAt = 0
	role.DeleteAt = 0
	role.BuiltIn = false
	role.SchemeManaged = false
	// Resetting SchemeId closes the guard's scheme-based bypass: a
	// caller-supplied id pointing at a space preset would otherwise let a
	// created role borrow that scheme's scope and pass unrejected.
	role.SchemeId = nil

	// On the create path there is no stored role, so every guarded permission
	// in the incoming set counts as an add.
	if appErr := a.checkSpacePermissionScope(role, nil); appErr != nil {
		return nil, appErr
	}

	var err error
	role, err = a.Srv().Store().Role().Save(role)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateRole", "app.role.save.invalid_role.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateRole", "app.role.save.insert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return role, nil
}

func (a *App) UpdateRole(role *model.Role) (*model.Role, *model.AppError) {
	// The sink holds no prior permission set, so re-read the stored role to diff
	// against before saving: only an *add* of a guarded permission is rejected,
	// never a removal.
	//
	// Only a write carrying one of the guarded permissions needs a baseline at
	// all: with none of them incoming there is no add to find, whatever the
	// stored row says. Skipping the read there keeps every ordinary role write —
	// which is nearly all of them — at its previous cost.
	var storedPermissions []string
	if hasSpaceChannelScopedPermission(role.Permissions) {
		storedRole, appErr := a.storedRoleForSpaceGuard(role)
		if appErr != nil {
			return nil, appErr
		}
		if storedRole != nil {
			storedPermissions = storedRole.Permissions
		}
	}
	if appErr := a.checkSpacePermissionScope(role, storedPermissions); appErr != nil {
		return nil, appErr
	}

	savedRole, err := a.Srv().Store().Role().Save(role)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateRole", "app.role.save.invalid_role.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateRole", "app.role.save.insert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	builtInChannelRoles := []string{
		model.ChannelGuestRoleId,
		model.ChannelUserRoleId,
		model.ChannelAdminRoleId,
	}

	builtInRolesMinusChannelRoles := append(utils.RemoveStringsFromSlice(model.BuiltInSchemeManagedRoleIDs, builtInChannelRoles...), model.NewSystemRoleIDs...)

	if slices.Contains(builtInRolesMinusChannelRoles, savedRole.Name) {
		return savedRole, nil
	}

	var roleRetrievalFunc func() ([]*model.Role, *model.AppError)

	if slices.Contains(builtInChannelRoles, savedRole.Name) {
		roleRetrievalFunc = func() ([]*model.Role, *model.AppError) {
			roles, nErr := a.Srv().Store().Role().AllChannelSchemeRoles()
			if nErr != nil {
				return nil, model.NewAppError("UpdateRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}

			return roles, nil
		}
	} else {
		roleRetrievalFunc = func() ([]*model.Role, *model.AppError) {
			roles, nErr := a.Srv().Store().Role().ChannelRolesUnderTeamRole(savedRole.Name)
			if nErr != nil {
				return nil, model.NewAppError("UpdateRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}

			return roles, nil
		}
	}

	impactedRoles, appErr := roleRetrievalFunc()
	if appErr != nil {
		return nil, appErr
	}
	impactedRoles = append(impactedRoles, role)

	appErr = a.mergeChannelHigherScopedPermissions(impactedRoles)
	if appErr != nil {
		return nil, appErr
	}

	for _, ir := range impactedRoles {
		if ir.Name != role.Name {
			appErr = a.sendUpdatedRoleEvent(ir)
			if appErr != nil {
				return nil, appErr
			}
		}
	}

	return savedRole, nil
}

func (a *App) CheckRolesExist(roleNames []string) *model.AppError {
	roles, err := a.GetRolesByNames(roleNames)
	if err != nil {
		return err
	}

	for _, name := range roleNames {
		nameFound := false
		for _, role := range roles {
			if name == role.Name {
				nameFound = true
				break
			}
		}
		if !nameFound {
			return model.NewAppError("CheckRolesExist", "app.role.check_roles_exist.role_not_found", nil, "role="+name, http.StatusBadRequest)
		}
	}

	return nil
}

func (a *App) sendUpdatedRoleEvent(role *model.Role) *model.AppError {
	roleJSON, jsonErr := json.Marshal(role)
	if jsonErr != nil {
		return model.NewAppError("sendUpdatedRoleEvent", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}

	publishEvent := func(teamID, channelID string) {
		message := model.NewWebSocketEvent(model.WebsocketEventRoleUpdated, teamID, channelID, "", nil, "")
		message.Add("role", string(roleJSON))
		a.Publish(message)
	}

	// Built-in system roles apply to all users; broadcast globally without a DB lookup.
	if role.BuiltIn {
		publishEvent("", "")
		return nil
	}

	// Scheme-managed roles: use SchemeId to look up the owning scheme.
	if role.SchemeId == nil {
		// No owning scheme — treat as global (e.g. custom non-scheme role).
		publishEvent("", "")
		return nil
	}
	scheme, err := a.Srv().Store().Scheme().Get(*role.SchemeId)
	if err != nil {
		a.Log().Error("Failed to look up scheme for role event; skipping broadcast",
			mlog.String("role_id", role.Id),
			mlog.String("scheme_id", *role.SchemeId),
			mlog.Err(err))
		return nil
	}

	const pageSize = 1000
	const maxBroadcasts = 100000
	switch scheme.Scope {
	case model.SchemeScopeTeam:
		totalBroadcasts := 0
		offset := 0
		for {
			teams, storeErr := a.Srv().Store().Team().GetTeamsByScheme(scheme.Id, offset, pageSize)
			if storeErr != nil {
				return model.NewAppError("sendUpdatedRoleEvent", "app.role.send_updated_role_event.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
			}
			for _, team := range teams {
				publishEvent(team.Id, "")
			}
			totalBroadcasts += len(teams)
			if len(teams) < pageSize {
				break
			}
			if totalBroadcasts >= maxBroadcasts {
				a.Log().Error("sendUpdatedRoleEvent: hit broadcast limit for team scheme",
					mlog.String("scheme_id", scheme.Id),
					mlog.Int("totalBroadcasts", totalBroadcasts))
				break
			}
			offset += pageSize
		}
	case model.SchemeScopeChannel:
		totalBroadcasts := 0
		offset := 0
		for {
			channels, storeErr := a.Srv().Store().Channel().GetChannelsByScheme(scheme.Id, offset, pageSize)
			if storeErr != nil {
				return model.NewAppError("sendUpdatedRoleEvent", "app.role.send_updated_role_event.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
			}
			for _, channel := range channels {
				publishEvent("", channel.Id)
			}
			totalBroadcasts += len(channels)
			if len(channels) < pageSize {
				break
			}
			if totalBroadcasts >= maxBroadcasts {
				a.Log().Error("sendUpdatedRoleEvent: hit broadcast limit for channel scheme",
					mlog.String("scheme_id", scheme.Id),
					mlog.Int("totalBroadcasts", totalBroadcasts))
				break
			}
			offset += pageSize
		}
	case model.SchemeScopePlaybook, model.SchemeScopeRun:
		// Playbook/run schemes don't map to teams or channels; broadcast globally.
		publishEvent("", "")
	default:
		return model.NewAppError("sendUpdatedRoleEvent", "app.role.send_updated_role_event.unknown_scope", nil, fmt.Sprintf("unknown scheme scope: %s", scheme.Scope), http.StatusInternalServerError)
	}
	return nil
}

func removeRoles(rolesToRemove []string, roles string) string {
	roleList := strings.Fields(roles)
	newRoles := make([]string, 0)

	for _, role := range roleList {
		shouldRemove := slices.Contains(rolesToRemove, role)
		if !shouldRemove {
			newRoles = append(newRoles, role)
		}
	}

	return strings.Join(newRoles, " ")
}
