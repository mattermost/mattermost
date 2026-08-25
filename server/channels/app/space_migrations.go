// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// seedingConflictSuffix closes every seeding-collision error. The remedy is the
// same in each case and the failure is not node-local, so it is stated once.
const seedingConflictSuffix = "; rename or delete the conflicting row to proceed. This blocks the upgrade on every node, not just this one"

// validateAdoptableSpaceRole rejects a row found under a reserved capability role
// name that is not the row this migration would have written. Adopting a collision
// would grant space permissions this migration never defined, or leave the
// capability behind a row that cannot carry it — the member-assignment guards
// refuse a scheme-managed or scheme-owned role as an explicit role.
//
// The role reads carry no DeleteAt filter, so a deleted row reaches this like any
// other.
func validateAdoptableSpaceRole(roleID string, stored, want *model.Role) error {
	if stored.DeleteAt != 0 {
		return fmt.Errorf("role %q already exists and is deleted"+seedingConflictSuffix, roleID)
	}
	if stored.SchemeManaged {
		return fmt.Errorf("role %q already exists and is scheme-managed"+seedingConflictSuffix, roleID)
	}
	if stored.SchemeId != nil && *stored.SchemeId != "" {
		return fmt.Errorf("role %q already exists and is owned by scheme %q"+seedingConflictSuffix, roleID, *stored.SchemeId)
	}
	if !slices.Equal(model.NormalizePermissions(stored.Permissions), model.NormalizePermissions(want.Permissions)) {
		return fmt.Errorf("role %q already exists with a different permission set than the built-in definition"+seedingConflictSuffix, roleID)
	}
	return nil
}

// validateAdoptableSpaceScheme rejects a scheme row carrying a preset space
// scheme's name that cannot serve as one. Adopting a foreign row would rewrite that
// scheme's generated role permission sets, stripping the moderated permissions from
// a customer's channels.
//
// The shape requirements are the seeding's own: a live channel-scoped row with
// three distinct generated channel roles. Two references converging on one row
// would merge the sets, leaving the user or guest role with the admin grants, and
// an empty role name would fail the role seeding outright. A single non-space
// channel on the scheme proves it is a customer's.
func (s *Server) validateAdoptableSpaceScheme(existing *model.Scheme) error {
	if existing.DeleteAt != 0 {
		return fmt.Errorf("scheme %q already exists and is deleted"+seedingConflictSuffix, existing.Name)
	}
	if existing.Scope != model.SchemeScopeChannel {
		return fmt.Errorf("scheme %q already exists with scope %q instead of %q"+seedingConflictSuffix, existing.Name, existing.Scope, model.SchemeScopeChannel)
	}
	if existing.DefaultChannelUserRole == "" || existing.DefaultChannelAdminRole == "" || existing.DefaultChannelGuestRole == "" {
		return fmt.Errorf("scheme %q already exists without a complete set of generated channel roles"+seedingConflictSuffix, existing.Name)
	}
	if existing.DefaultChannelUserRole == existing.DefaultChannelAdminRole ||
		existing.DefaultChannelUserRole == existing.DefaultChannelGuestRole ||
		existing.DefaultChannelAdminRole == existing.DefaultChannelGuestRole {
		return fmt.Errorf("scheme %q already exists with generated channel roles that are not distinct"+seedingConflictSuffix, existing.Name)
	}

	governed, err := s.Store().Channel().CountNonSpaceChannelsByScheme(existing.Id)
	if err != nil {
		return fmt.Errorf("could not check scheme %q for non-space channels: %w", existing.Name, err)
	}
	if governed > 0 {
		return fmt.Errorf("scheme %q already exists and governs non-space channels"+seedingConflictSuffix, existing.Name)
	}
	return nil
}

// validateAdoptedSpaceSchemeRoles refuses a row that is shaped like a preset but
// does not grant like one. validateAdoptableSpaceScheme proves the shape; this
// proves the authority and the ownership. Both are needed: the seeding only strips
// the moderated permissions and adds the targets, so any other permission already
// on a generated role survives; and the scheme row can name a standalone role
// already assigned outside spaces, which the store-direct seeding would then hand
// the page and admin permissions, below the runtime scope guard.
//
// Only permissions this build recognises are judged, so a server downgraded from a
// newer release is not blocked by permissions it merely does not know yet — the
// same reason the seeding writes through SavePreservingUnknownPermissions.
func (s *Server) validateAdoptedSpaceSchemeRoles(scheme *model.Scheme, userTarget []*model.Permission) error {
	known := make(map[string]bool, len(model.AllPermissions))
	for _, p := range model.AllPermissions {
		known[p.Id] = true
	}

	for _, generated := range []struct {
		roleName  string
		moderated bool
		target    []*model.Permission
	}{
		{scheme.DefaultChannelUserRole, true, userTarget},
		{scheme.DefaultChannelAdminRole, false, model.SpaceAdminRolePermissions},
		{scheme.DefaultChannelGuestRole, true, model.SpaceDefaultReadOnlyPermissions},
	} {
		// GetByNamesFromMaster rather than GetByName with a master context: the role
		// cache answers GetByName before the context is consulted.
		matched, err := s.Store().Role().GetByNamesFromMaster([]string{generated.roleName})
		if err != nil {
			return fmt.Errorf("could not query scheme role %q for scheme %q: %w", generated.roleName, scheme.Name, err)
		}
		if len(matched) == 0 {
			return fmt.Errorf("scheme role %q for scheme %q has no row on the primary", generated.roleName, scheme.Name)
		}
		role := matched[0]

		if role.DeleteAt != 0 || !role.SchemeManaged || role.SchemeId == nil || *role.SchemeId != scheme.Id {
			return fmt.Errorf("scheme %q already exists and its generated role %q is deleted, not scheme-managed, or not owned by it"+seedingConflictSuffix, scheme.Name, generated.roleName)
		}

		// What the seeding would have produced, which is not the global default role:
		// creating a channel-scoped scheme starts the generated admin role empty and
		// reduces the user and guest roles to the channel-moderated permissions. So
		// the moderated set is the whole baseline for those two, whatever an operator
		// has granted the global roles, plus this preset's own grants.
		allowed := make(map[string]bool, len(model.ChannelModeratedPermissionsMap)+len(generated.target))
		if generated.moderated {
			for id := range model.ChannelModeratedPermissionsMap {
				allowed[id] = true
			}
		}
		for _, p := range generated.target {
			allowed[p.Id] = true
		}

		for _, p := range role.Permissions {
			if known[p] && !allowed[p] {
				return fmt.Errorf("scheme %q already exists and its generated role %q grants %q, which a seeded space preset never does"+seedingConflictSuffix, scheme.Name, generated.roleName, p)
			}
		}
	}
	return nil
}

func (s *Server) doSpaceRolesCreationMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(SpaceRolesCreationMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	roles := model.MakeDefaultRoles()

	for _, roleID := range model.SpaceCapabilityRoles {
		if stored, err := s.Store().Role().GetByName(request.EmptyContext(s.Log()), roleID); err == nil {
			// A row already under the reserved name is only this migration's own
			// earlier work if its permissions match the built-in definition. The
			// lost-insert-race branch below refuses the same way.
			if vErr := validateAdoptableSpaceRole(roleID, stored, roles[roleID]); vErr != nil {
				return vErr
			}
			continue
		} else if !errors.As(err, &nfErr) {
			return fmt.Errorf("could not query role %q: %w", roleID, err)
		}

		if _, err := s.Store().Role().Save(roles[roleID]); err != nil {
			mlog.Warn("Couldn't save the space capability role, this can be an expected case; another node likely won the insert race, re-reading on the primary", mlog.String("role_name", roleID), mlog.Err(err))

			// The store wraps the raw duplicate-key error, so a lost HA insert race is
			// detected by re-reading the row on the primary. GetByNamesFromMaster is
			// the uncached primary read; GetByName is answered from the role cache
			// before its context is consulted.
			matched, rErr := s.Store().Role().GetByNamesFromMaster([]string{roleID})
			if rErr != nil {
				return fmt.Errorf("failed to create space capability role %q: %w (re-read on the primary also failed: %v)", roleID, err, rErr)
			}
			if len(matched) == 0 {
				return fmt.Errorf("failed to create space capability role %q: %w (re-read on the primary found no row)", roleID, err)
			}
			stored := matched[0]

			// A row under the reserved name is only proof the race was lost if it is
			// the row this migration would have written.
			if err := validateAdoptableSpaceRole(roleID, stored, roles[roleID]); err != nil {
				return err
			}
		}
	}

	system := model.System{
		Name:  SpaceRolesCreationMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().SaveOrUpdate(&system); err != nil {
		return fmt.Errorf("failed to mark space roles creation migration as completed: %w", err)
	}

	return nil
}

// applySpaceSchemeRolePermissions reads a scheme-generated role, strips the
// moderated permissions inherited from the global role it was seeded from when strip
// is set, adds any missing target permissions, and saves only when the set changed.
// It is idempotent, so racing nodes and re-runs converge on the same final set.
func (s *Server) applySpaceSchemeRolePermissions(roleName string, target []*model.Permission, strip bool) error {
	// The uncached primary read; converging on a peer node's write needs the row the
	// primary holds now.
	matched, err := s.Store().Role().GetByNamesFromMaster([]string{roleName})
	if err != nil {
		return fmt.Errorf("could not query scheme role %q: %w", roleName, err)
	}
	if len(matched) == 0 {
		return fmt.Errorf("scheme role %q has no row on the primary", roleName)
	}
	role := matched[0]

	perms := asPermissionSet(role.Permissions)
	changed := false
	if strip {
		for moderated := range model.ChannelModeratedPermissionsMap {
			if perms[moderated] {
				delete(perms, moderated)
				changed = true
			}
		}
	}
	for _, p := range target {
		if !perms[p.Id] {
			perms[p.Id] = true
			changed = true
		}
	}
	if !changed {
		return nil
	}

	newPermissions := make([]string, 0, len(perms))
	for p := range perms {
		newPermissions = append(newPermissions, p)
	}
	// Deterministic order keeps racing HA nodes and re-runs writing identical
	// rows, and keeps role diffs readable.
	slices.Sort(newPermissions)
	role.Permissions = newPermissions
	// The permission set is carried over from the stored row, so on a server
	// downgraded from a newer release it can hold permissions this build does not
	// recognize, which Save would reject.
	if _, err := s.Store().Role().SavePreservingUnknownPermissions(role); err != nil {
		return fmt.Errorf("failed to save scheme role %q: %w", roleName, err)
	}
	return nil
}

// doSpaceSchemesCreationMigration seeds the space preset schemes.
//
// Deliberately ungated, where App.CreateScheme is gated on the custom permissions
// schemes license: the presets are the unlicensed tier of space permissions. They
// are core-provided and fixed, and attaching one is an ordinary channel update
// carrying its SchemeId that never reaches CreateScheme. What the license buys is a
// per-space custom scheme.
//
// Writing store-direct also puts this below the App guards, which is what lets it
// create schemes under names checkSpaceSchemeName reserves against callers.
func (s *Server) doSpaceSchemesCreationMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(SpaceSchemesCreationMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	presets := []struct {
		name        string
		displayName string
		userPerms   []*model.Permission
	}{
		{model.SchemeNameSpaceContribute, model.SchemeDisplayNameSpaceContribute, model.SpaceDefaultContributePermissions},
		{model.SchemeNameSpaceComment, model.SchemeDisplayNameSpaceComment, model.SpaceDefaultCommentPermissions},
		{model.SchemeNameSpaceReadOnly, model.SchemeDisplayNameSpaceReadOnly, model.SpaceDefaultReadOnlyPermissions},
	}

	for _, preset := range presets {
		// A row this migration did not just create is one it is adopting, and an
		// adopted row has to prove it is a preset rather than a name collision.
		adopted := true
		scheme, err := s.Store().Scheme().GetByName(preset.name)
		if err != nil {
			if !errors.As(err, &nfErr) {
				return fmt.Errorf("could not query scheme %q: %w", preset.name, err)
			}
			scheme, err = s.Store().Scheme().Save(&model.Scheme{
				Name:        preset.name,
				DisplayName: preset.displayName,
				Scope:       model.SchemeScopeChannel,
			})
			if err == nil {
				adopted = false
			} else {
				mlog.Warn("Couldn't save the space preset scheme, this can be an expected case; another node likely won the insert race, re-reading on the primary", mlog.String("scheme_name", preset.name), mlog.Err(err))

				// Re-read on the primary before treating the save error as real, the
				// same recovery doAdvancedPermissionsMigration performs on a role. The
				// original save error is the root cause, so it is the one reported.
				var rErr error
				scheme, rErr = s.Store().Scheme().GetByNameFromMaster(preset.name)
				if rErr != nil {
					return fmt.Errorf("failed to create space scheme %q: %w (re-read on the primary also failed: %v)", preset.name, err, rErr)
				}
			}
		}

		// Only a row this migration did not create needs to prove itself; one it just
		// inserted is a preset by construction.
		if adopted {
			if vErr := s.validateAdoptableSpaceScheme(scheme); vErr != nil {
				return vErr
			}
			if vErr := s.validateAdoptedSpaceSchemeRoles(scheme, preset.userPerms); vErr != nil {
				return vErr
			}
		}

		if err := s.applySpaceSchemeRolePermissions(scheme.DefaultChannelUserRole, preset.userPerms, true); err != nil {
			return err
		}
		if err := s.applySpaceSchemeRolePermissions(scheme.DefaultChannelAdminRole, model.SpaceAdminRolePermissions, false); err != nil {
			return err
		}
		if err := s.applySpaceSchemeRolePermissions(scheme.DefaultChannelGuestRole, model.SpaceDefaultReadOnlyPermissions, true); err != nil {
			return err
		}
	}

	system := model.System{
		Name:  SpaceSchemesCreationMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().SaveOrUpdate(&system); err != nil {
		return fmt.Errorf("failed to mark space schemes creation migration as completed: %w", err)
	}

	return nil
}
