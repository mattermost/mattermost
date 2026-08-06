// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// sortedPermissions returns the permissions in a stable order so two sets can be
// compared without caring how either was assembled.
func sortedPermissions(permissions []string) []string {
	sorted := slices.Clone(permissions)
	slices.Sort(sorted)
	return sorted
}

// validateAdoptableSpaceRole rejects a row found under a reserved capability
// role name whose permissions differ from the built-in definition. Such a row is
// a name collision rather than this migration's own earlier work, and adopting
// it would hand out space permissions this migration never defined.
func validateAdoptableSpaceRole(roleID string, stored, want *model.Role) error {
	if slices.Equal(sortedPermissions(stored.Permissions), sortedPermissions(want.Permissions)) {
		return nil
	}
	return fmt.Errorf("role %q already exists with a different permission set than the built-in definition; rename or delete the conflicting role to proceed; this blocks the upgrade on every node, not just this one", roleID)
}

// validateAdoptableSpaceScheme rejects a scheme row that carries a preset space
// scheme's name but cannot serve as one: adopting a foreign row would rewrite
// that scheme's generated role permission sets on every boot, and a row without
// a full set of generated channel roles would fail the role-permission seeding
// with a not-found on an empty role name.
func (s *Server) validateAdoptableSpaceScheme(existing *model.Scheme) error {
	// The scheme select carries no DeleteAt filter, so a soft-deleted row comes
	// back like any other; adopting one would mark the migration complete while
	// leaving no live preset behind.
	if existing.DeleteAt != 0 {
		return fmt.Errorf("scheme %q already exists but is deleted; restore or permanently remove the conflicting scheme to proceed; this blocks the upgrade on every node, not just this one", existing.Name)
	}
	if existing.Scope != model.SchemeScopeChannel {
		return fmt.Errorf("scheme %q already exists with scope %q instead of %q; rename or delete the conflicting scheme to proceed; this blocks the upgrade on every node, not just this one", existing.Name, existing.Scope, model.SchemeScopeChannel)
	}
	if existing.DefaultChannelUserRole == "" || existing.DefaultChannelAdminRole == "" || existing.DefaultChannelGuestRole == "" {
		return fmt.Errorf("scheme %q already exists without a complete set of generated channel roles; rename or delete the conflicting scheme to proceed; this blocks the upgrade on every node, not just this one", existing.Name)
	}
	// The three checks above are all satisfied by an ordinary channel scheme, so
	// on a server that already had one under a reserved name they would adopt it
	// — and the role-permission seeding below would then strip the moderated
	// permissions from every channel it governs. GetChannelsByScheme excludes
	// spaces, so a single row here proves the scheme is a customer's.
	governed, err := s.Store().Channel().CountNonSpaceChannelsByScheme(existing.Id)
	if err != nil {
		return fmt.Errorf("could not check scheme %q for non-space channels: %w", existing.Name, err)
	}
	if governed > 0 {
		return fmt.Errorf("scheme %q already exists and governs non-space channels; rename or delete the conflicting scheme to proceed; this blocks the upgrade on every node, not just this one", existing.Name)
	}
	return nil
}

// validateAdoptedSpaceSchemeRoles refuses a row that is shaped like a preset but
// does not grant like one. validateAdoptableSpaceScheme proves the shape; this
// proves the authority, which has to be checked separately because the seeding
// only strips the moderated permissions and adds the targets — every other
// permission already on a generated role survives into what becomes, from here
// on, an unforgeable proof of space scope wherever the scope guards read it.
//
// Only permissions this build recognises are judged, so a server downgraded from
// a newer release is not blocked by permissions it merely does not know yet —
// the same reason the seeding writes through SavePreservingUnknownPermissions.
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
		role, err := s.Store().Role().GetByName(store.WithMaster(context.Background()), generated.roleName)
		if err != nil {
			return fmt.Errorf("could not query scheme role %q for scheme %q: %w", generated.roleName, scheme.Name, err)
		}

		// What the seeding would have produced, which is not the global default
		// role: creating a channel-scoped scheme starts the generated admin role
		// empty and reduces the user and guest roles to the channel-moderated
		// permissions of the global role each is seeded from. So the moderated
		// set is the whole baseline for those two, whatever an operator has
		// granted the global roles — baselining against the global defaults
		// instead would reject a legitimately seeded preset whenever a moderated
		// permission was granted that the default role does not carry, which for
		// channel_guest is every bookmark permission and both manage-members
		// permissions. Plus this preset's own grants.
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
				return fmt.Errorf("scheme %q already exists and its generated role %q grants %q, which a seeded space preset never does; rename or delete the conflicting scheme to proceed; this blocks the upgrade on every node, not just this one", scheme.Name, generated.roleName, p)
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
		if stored, err := s.Store().Role().GetByName(context.Background(), roleID); err == nil {
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

			// The store wraps the raw duplicate-key error, so a lost HA insert
			// race is detected by re-reading the row on the primary: a lagging
			// replica could miss the other node's just-committed insert and
			// fatal the boot.
			stored, rErr := s.Store().Role().GetByName(store.WithMaster(context.Background()), roleID)
			if rErr != nil {
				return fmt.Errorf("failed to create space capability role %q: %w (re-read on the primary also failed: %v)", roleID, err, rErr)
			}

			// A row under the reserved name is only proof the race was lost if
			// it is the row this migration would have written.
			// validateAdoptableSpaceScheme refuses the same way when seeding
			// schemes.
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
// moderated permissions inherited from the global role it was seeded from when
// strip is set, adds any missing target permissions, and saves only when the
// set changed. Racing nodes converge: the function is idempotent, so running
// it again from the result of a prior run — or interleaved with another
// node's run — always lands on the same final permission set.
func (s *Server) applySpaceSchemeRolePermissions(roleName string, target []*model.Permission, strip bool) error {
	role, err := s.Store().Role().GetByName(store.WithMaster(context.Background()), roleName)
	if err != nil {
		return fmt.Errorf("could not query scheme role %q: %w", roleName, err)
	}

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
	// recognize. Save would reject those and fail the boot; the same reason the
	// generic permissions migrations write through this method.
	if _, err := s.Store().Role().SavePreservingUnknownPermissions(role); err != nil {
		return fmt.Errorf("failed to save scheme role %q: %w", roleName, err)
	}
	return nil
}

// doSpaceSchemesCreationMigration seeds the three space preset schemes.
//
// Deliberately ungated, where App.CreateScheme is gated on the custom
// permissions schemes license: the presets are the unlicensed tier of space
// permissions, not an exception to the licensed one. They are core-provided and
// fixed, so every edition can point a space at one — attaching a preset is an
// ordinary channel update carrying its SchemeId and never reaches CreateScheme.
// What the license buys is a per-space *custom* scheme, which is what the gate
// on CreateScheme covers. The two are consistent, not in tension.
//
// Writing store-direct also puts this below the App guards, which is what lets
// it create schemes under names checkSpaceSchemeName reserves against callers.
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

				// Re-read before treating the save error as real, the same
				// recovery doAdvancedPermissionsMigration performs on a role.
				// The read goes to the primary so a lagging replica cannot miss
				// the other node's just-committed insert and fatal the boot. The
				// original save error is the root cause, so it is the one
				// reported, with the re-read failure carried alongside it.
				var rErr error
				scheme, rErr = s.Store().Scheme().GetByNameFromMaster(preset.name)
				if rErr != nil {
					return fmt.Errorf("failed to create space scheme %q: %w (re-read on the primary also failed: %v)", preset.name, err, rErr)
				}
			}
		}

		// Only a row this migration did not create needs to prove itself. A row
		// it just inserted is a preset by construction, and validating it would
		// spend a primary count per preset on every fresh boot to re-derive that.
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
