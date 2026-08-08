// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

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

// isSpaceGuestPermissionID reports whether id is a space permission a guest may
// hold. The guest tier is read-only, so this is the read-only baseline the
// seeding writes onto every space scheme's guest role.
func isSpaceGuestPermissionID(id string) bool {
	return slices.ContainsFunc(model.SpaceDefaultReadOnlyPermissions, func(p *model.Permission) bool {
		return p.Id == id
	})
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
// Reads the store directly rather than through GetRole or GetRoleByName: those
// run mergeChannelHigherScopedPermissions on the way out, which widens the
// permission list. A widened baseline would make a genuine re-add look like it
// was already stored, and the guard would pass it.
//
// Keyed by Id wherever the caller supplies one, which is every caller that reaches
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
		// Read on the primary: this baseline decides whether a guarded permission
		// counts as newly added, so a replica that has not yet seen a peer node's
		// removal would present a wider baseline and let the re-add through
		// without reproving the scheme's space scope.
		storedRole, err := a.Srv().Store().Role().GetFromMaster(role.Id)
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

	// Plain context: as the comment above records, the cache answers this read
	// before the context is consulted, so asking for the master here would claim
	// a freshness this path cannot deliver.
	storedRole, err := a.Srv().Store().Role().GetByName(context.Background(), role.Name)
	if err != nil {
		if !errors.As(err, &nfErr) {
			return nil, readErr(err)
		}
		return nil, nil
	}
	return storedRole, nil
}

// rejectSpaceCapabilityRoleOutsideSpace reports whether an ExplicitRoles write
// carries a space capability role where it cannot legitimately mean
// anything. Those roles grant space authority on a single space's backing
// channel, so ownerIsSpaceChannel is the whole test: false for every ordinary
// channel, and false for a team member, whose roles are consulted as the
// fallback for every channel in the team and so would spread one space's grant
// across all of them.
//
// UpdateChannelMemberRoles, UpdateTeamMemberRoles, UpdateUserRoles and BulkImport
// all call this rather than repeating the predicate, so a future write path has one
// function to find instead of the rule to rediscover. Each caller builds its own
// AppError, because the i18n extractor only collects
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
// scheme does not govern a space, which only a space backing channel pointing
// at the scheme proves; system_admin is the single exception. The space
// capability roles and the roles generated for the seeded preset schemes are
// frozen outright, in both directions — changing either is a code plus
// migration change, never a runtime role write. The guard runs on CreateRole and
// UpdateRole — and so on PatchRole, which routes through UpdateRole; migration
// seeding writes to the store directly, below it.
//
// Deliberately not gated on the docs feature flag. The permissions, roles and
// preset schemes are seeded unconditionally at boot, so a grant planted while
// the flag was off would survive the flip and become live space authority, and
// nothing re-validates stored rows at enable time.
func (a *App) checkSpacePermissionScope(role *model.Role, stored []string) *model.AppError {
	// Ahead of the add diff, because a capability role is frozen in both
	// directions. Diffing first would accept a write that only *removes* a page
	// permission — dropping read_page from docs_space_page_editor degrades every
	// member holding it on every space, and the seeding migration does not repair
	// it: its existence check short-circuits on the first read and only compares
	// permission sets on the lost-insert-race path.
	if model.IsSpaceCapabilityRole(role.Name) {
		// Changing a space capability role is a code plus migration change,
		// never a runtime role write; the seeding writes these store-direct,
		// below this guard.
		return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_capability_role.app_error",
			map[string]any{"RoleName": role.Name}, "", http.StatusBadRequest)
	}

	// The scheme is resolved ahead of the add diff because a role generated for
	// a seeded preset is frozen the same way the capability roles are: every
	// space pointing at the preset shares its generated roles, and the seeding
	// migration never repairs a drifted one — its completion key short-circuits
	// the next boot. Waiting for the diff would accept a write that only
	// removes a grant, or one that changes nothing the diff watches, such as
	// clearing SchemeManaged. The read prices every scheme-role write at one
	// primary lookup; those writes are all sysconsole-, import- or
	// plugin-gated and low frequency.
	var scheme *model.Scheme
	if role.SchemeId != nil && *role.SchemeId != "" {
		// A store failure is not a scope violation; reporting it as one would
		// tell the caller their role is malformed when the database is simply
		// unreachable. Both outcomes refuse the write.
		var appErr *model.AppError
		scheme, appErr = a.getSchemeFromMaster("checkSpacePermissionScope", *role.SchemeId)
		if appErr != nil {
			return appErr
		}
		// The same identity isSeededSpaceScheme tests: a reserved name outside
		// channel scope is a squatter's row, not a preset, and a deleted row's
		// roles are refused space authority by the deleted-scheme branch below.
		if scheme != nil && scheme.DeleteAt == 0 && scheme.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(scheme.Name) {
			return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_preset_role.app_error",
				map[string]any{"RoleName": role.Name}, "", http.StatusBadRequest)
		}
	}

	added := spacePermissionAddDiff(role.Permissions, stored)
	if len(added) == 0 {
		// A write that adds nothing can still change what the grants already on
		// the role are worth. The explicit-role write paths — UpdateChannelMemberRoles,
		// UpdateTeamMemberRoles, UpdateUserRoles and the bulk-import member writes,
		// rejectSpaceCapabilityRoleOutsideSpace's callers — admit a
		// non-scheme-managed role on its name alone and match capability roles only
		// by the five fixed names, so a scheme-generated space role that keeps its
		// grants while dropping SchemeManaged becomes assignable as an arbitrary
		// explicit user, team or ordinary channel role. Its authority comes from the
		// scheme, so it has to stay scheme-managed for as long as it holds the grants.
		//
		// Built-ins are exempt: they carry a reserved name those same guards match
		// on, so one never becomes freely assignable this way, and a grant already
		// stored on one has to stay removable.
		if !role.SchemeManaged && !model.IsBuiltInRole(role.Name) && hasSpaceChannelScopedPermission(role.Permissions) {
			return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_role_scheme_managed.app_error",
				map[string]any{"RoleName": role.Name}, "", http.StatusBadRequest)
		}
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

	if model.IsBuiltInRole(role.Name) {
		// Team/system built-ins and the global channel-scoped built-ins.
		return reject()
	}

	if role.SchemeId != nil && *role.SchemeId != "" {
		if scheme == nil || scheme.DeleteAt != 0 {
			// Fail closed: neither an unresolvable scheme nor a deleted one can
			// prove space scope. The read carries no DeleteAt filter, and a deleted
			// scheme's channels have had their SchemeId blanked, so it would
			// otherwise reach the counts below.
			return reject()
		}
		// Channel scope alone is too wide: an ordinary customer channel scheme
		// is channel-scoped too, so accepting it would let anyone who can write
		// a channel scheme grant its roles space authority. The scheme has to
		// prove it governs a space.
		//
		// The one proof left is a space backing channel already pointing at the
		// scheme, which is what a per-space custom scheme presents — a name
		// cannot be that proof, because the caller chooses it, and the reserved
		// preset names were frozen out above. A scheme must therefore already
		// be attached to a space before its roles can take space permissions; a
		// role write that arrives first is rejected.
		//
		// A dedicated scheme scope would reduce all of this to a scope test, the
		// way playbooks and runs got their own. Spaces do not, because a backing
		// channel is still a channel: its roles have to keep resolving through the
		// channel-scoped path, so the scheme stays channel-scoped and the proof
		// moves here instead.
		//
		// A space pointing at the scheme is only half the proof, which is why
		// schemeGovernsOnlySpaces also confirms no ordinary channel shares it: the
		// channel guard refuses to add an ordinary channel to a scheme that already
		// grants space permissions, but nothing stops both channels being attached
		// first and the grant being asked for afterwards, and an ordinary channel
		// sharing the scheme would resolve whatever is granted here for its own
		// members.
		onlySpaces, appErr := a.schemeGovernsOnlySpaces("checkSpacePermissionScope", scheme)
		if appErr != nil {
			return appErr
		}
		if onlySpaces {
			// The proof accepts the write only for a role that stays
			// scheme-managed. That closes the one-write gap the metadata branch
			// above cannot see: a save that both adds a grant and clears
			// SchemeManaged — reachable through importRole, the sole role write
			// whose SchemeManaged is caller-controlled — would otherwise ride the
			// proof to an accept and land as a freely assignable role holding
			// space grants. Tested at the accept, not ahead of it, so every
			// rejection here still reports the scope violation that actually
			// stopped it.
			if !role.SchemeManaged {
				return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_role_scheme_managed.app_error",
					map[string]any{"RoleName": role.Name}, "", http.StatusBadRequest)
			}
			// A space's guest tier reads and nothing more, so the scheme's guest
			// role may take only the read-only space permissions. A page-write or
			// admin_space grant on it would reach every guest member of the space
			// through the scheme, defeating the guest ceiling
			// UpdateChannelMemberRoles enforces on the member-assignment side. Only
			// the guest role is capped: the user and admin roles legitimately carry
			// the wider grants.
			if role.Name == scheme.DefaultChannelGuestRole {
				for _, id := range added {
					if !isSpaceGuestPermissionID(id) {
						return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_guest_permission_scope.app_error",
							map[string]any{"RoleName": role.Name}, "permissions="+strings.Join(added, ","), http.StatusBadRequest)
					}
				}
			}
			return nil
		}
		return reject()
	}

	// nil SchemeId with an unrecognized name: fail closed.
	return reject()
}

// stripSpaceCapabilityRolesFromMember removes every space capability role from
// the member's explicit roles on channelID. Demoting a user to guest resets
// the member's scheme flags but leaves the explicit roles column untouched, so
// a capability role held there would keep granting page access to the new
// guest. The member is read from the primary: a lagging replica could return
// pre-demotion scheme flags, and saving those back would undo the demotion on
// this membership.
func (a *App) stripSpaceCapabilityRolesFromMember(rctx request.CTX, channelID, userID string) *model.AppError {
	member, appErr := a.GetChannelMember(RequestContextWithMaster(rctx), channelID, userID)
	if appErr != nil {
		return appErr
	}

	kept := make([]string, 0)
	stripped := false
	for roleName := range strings.FieldsSeq(member.ExplicitRoles) {
		if model.IsSpaceCapabilityRole(roleName) {
			stripped = true
			continue
		}
		kept = append(kept, roleName)
	}
	if !stripped {
		return nil
	}

	member.ExplicitRoles = strings.Join(kept, " ")
	_, appErr = a.updateChannelMember(rctx, member)
	return appErr
}
