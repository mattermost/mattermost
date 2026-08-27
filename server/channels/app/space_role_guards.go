// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// hasSpaceChannelScopedPermission reports whether any of the permissions is one
// of the channel-scoped space permissions.
func hasSpaceChannelScopedPermission(permissions []string) bool {
	return slices.ContainsFunc(permissions, model.IsSpaceChannelScopedPermissionID)
}

// logRefusedSpaceCapabilityRole records a refused space grant, which is a scope
// violation worth an operator trail rather than just an error to the caller.
// Callers build their own AppError, because the i18n extractor only collects
// message IDs written as literals at the model.NewAppError call site.
func logRefusedSpaceCapabilityRole(rctx request.CTX, where, roleName string) {
	rctx.Logger().Warn("Refused a space capability role outside a space",
		mlog.String("where", where),
		mlog.String("role_name", roleName),
	)
}

// checkSpacePermissionScope rejects any runtime role write carrying a channel-scoped
// space permission; system_admin is the single exception. The space
// capability roles are name-frozen; generated preset and plugin roles are frozen by
// their scheme association. The guard runs on CreateRole and UpdateRole, including
// PatchRole; migration seeding writes below it through the store.
//
// Deliberately not gated on the docs feature flag: the permissions, roles and preset
// schemes are seeded unconditionally at boot, so a grant planted while the flag was
// off would survive the flip, and nothing re-validates stored rows at enable time.
func (a *App) checkSpacePermissionScope(role *model.Role) *model.AppError {
	if model.IsSpaceCapabilityRole(role.Name) {
		return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_capability_role.app_error",
			map[string]any{"RoleName": role.Name}, "", http.StatusBadRequest)
	}

	if appErr := a.checkFrozenSchemeRole(role); appErr != nil {
		return appErr
	}

	if !hasSpaceChannelScopedPermission(role.Permissions) {
		return nil
	}

	if role.Name == model.SystemAdminRoleId {
		// system_admin legitimately carries every space permission.
		return nil
	}

	// Everything else is refused. Legitimate preset, capability, and plugin roles
	// are created below this guard and are immutable at runtime.
	return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_permission_scope.app_error",
		map[string]any{"RoleName": role.Name}, "permissions="+strings.Join(role.Permissions, ","), http.StatusBadRequest)
}

// checkFrozenSchemeRole refuses a write to a role generated for a seeded space
// preset or for a plugin scheme. Both are frozen in both directions, so this is
// resolved ahead of the add diff: waiting for the diff would accept a write that
// only removes a grant, or one that changes nothing the diff watches, such as
// clearing SchemeManaged.
//
// PatchRole starts from the stored role and preserves SchemeId, so generated-role updates reach
// this lookup. Direct UpdateRole callers must likewise supply the role's scheme association.
func (a *App) checkFrozenSchemeRole(role *model.Role) *model.AppError {
	if role.SchemeId == nil || *role.SchemeId == "" {
		return nil
	}

	// A store failure is not a scope violation, but both outcomes refuse the write.
	scheme, appErr := a.getSchemeFromMaster("checkSpacePermissionScope", *role.SchemeId)
	if appErr != nil {
		return appErr
	}
	if scheme == nil {
		return nil
	}

	if scheme.DeleteAt == 0 && scheme.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(scheme.Name) {
		return model.NewAppError("checkSpacePermissionScope", "app.role.save.space_preset_role.app_error",
			map[string]any{"RoleName": role.Name}, "", http.StatusBadRequest)
	}
	// A plugin scheme is shared by every channel its owner configured the same way,
	// so a later write would change what it grants for all of them at once. The owner
	// re-resolves to get a different set, which lands on a different scheme, so there
	// is no legitimate writer.
	if model.IsPluginChannelSchemeName(scheme.Name) {
		return model.NewAppError("checkSpacePermissionScope", "app.role.save.plugin_scheme_role.app_error",
			map[string]any{"RoleName": role.Name}, "", http.StatusBadRequest)
	}
	return nil
}

// revokeSpaceCapabilityRolesForUser removes every space capability role the user
// holds on a space backing channel, across all of their teams. Backing channels
// are excluded from GetChannelMembersForUser, so they are listed per team instead.
// A team listing failure ends the revocation rather than being logged past: the
// roles are stripped per team, so an unlisted team leaves its grants in place.
// Failures are reported as potentially partial because earlier teams or channels
// may already have been updated.
func (a *App) revokeSpaceCapabilityRolesForUser(rctx request.CTX, userID string) *model.AppError {
	teamMembers, appErr := a.GetTeamMembersForUser(rctx, userID, "", true)
	if appErr != nil {
		return model.NewAppError("revokeSpaceCapabilityRolesForUser", "app.user.revoke_space_capability_roles.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	for _, teamMember := range teamMembers {
		spaceChannels, sErr := a.Srv().Store().Channel().GetTeamSpaceChannelsForUser(teamMember.TeamId, userID)
		if sErr != nil {
			return model.NewAppError("revokeSpaceCapabilityRolesForUser", "app.user.revoke_space_capability_roles.app_error", nil, "", http.StatusInternalServerError).Wrap(sErr)
		}

		for _, spaceChannel := range spaceChannels {
			if appErr := a.stripSpaceCapabilityRolesFromMember(rctx, spaceChannel.Id, userID); appErr != nil {
				return appErr
			}
		}
	}

	return nil
}

// stripSpaceCapabilityRolesFromMember removes every space capability role from the
// member's explicit roles on channelID. The member is read from the primary: the
// read is followed by a write of the whole membership, so a lagging replica could
// clobber a concurrent role change with the state it returned.
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
