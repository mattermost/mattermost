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

// validateAdoptableSpaceScheme accepts only the exact immutable state created by
// SaveChannelSchemeWithRoles. This covers a previous run that committed the scheme
// before the migration marker was saved, as well as an HA node that lost the insert
// race, without inferring ownership from channels that happen to reference it.
func (s *Server) validateAdoptableSpaceScheme(existing *model.Scheme, user, admin, guest []string) error {
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

	roleNames := []string{
		existing.DefaultChannelUserRole,
		existing.DefaultChannelAdminRole,
		existing.DefaultChannelGuestRole,
	}
	roles, err := s.Store().Role().GetByNamesFromMaster(roleNames)
	if err != nil {
		return fmt.Errorf("could not query generated roles for scheme %q: %w", existing.Name, err)
	}
	rolesByName := make(map[string]*model.Role, len(roles))
	for _, role := range roles {
		rolesByName[role.Name] = role
	}

	for _, expected := range []struct {
		name        string
		permissions []string
	}{
		{existing.DefaultChannelUserRole, user},
		{existing.DefaultChannelAdminRole, admin},
		{existing.DefaultChannelGuestRole, guest},
	} {
		role := rolesByName[expected.name]
		if role == nil {
			return fmt.Errorf("scheme role %q for scheme %q has no row on the primary"+seedingConflictSuffix, expected.name, existing.Name)
		}
		if role.DeleteAt != 0 || !role.SchemeManaged || role.SchemeId == nil || *role.SchemeId != existing.Id {
			return fmt.Errorf("scheme %q already exists and its generated role %q is deleted, not scheme-managed, or not owned by it"+seedingConflictSuffix, existing.Name, expected.name)
		}
		if !slices.Equal(model.NormalizePermissions(role.Permissions), model.NormalizePermissions(expected.permissions)) {
			return fmt.Errorf("scheme %q already exists and its generated role %q has a different permission set"+seedingConflictSuffix, existing.Name, expected.name)
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
		user := model.PermissionIDs(preset.userPerms)
		admin := model.PermissionIDs(model.SpaceAdminRolePermissions)
		guest := model.PermissionIDs(model.SpaceDefaultReadOnlyPermissions)
		scheme, err := s.Store().Scheme().SaveChannelSchemeWithRoles(&model.Scheme{
			Name:        preset.name,
			DisplayName: preset.displayName,
			Scope:       model.SchemeScopeChannel,
		}, user, admin, guest)
		if err == nil {
			continue
		}

		mlog.Warn("Couldn't save the space preset scheme, another node or an earlier migration run may have created it; re-reading on the primary", mlog.String("scheme_name", preset.name), mlog.Err(err))
		scheme, readErr := s.Store().Scheme().GetByNameFromMaster(preset.name)
		if readErr != nil {
			return fmt.Errorf("failed to create space scheme %q: %w (re-read on the primary also failed: %v)", preset.name, err, readErr)
		}
		if validateErr := s.validateAdoptableSpaceScheme(scheme, user, admin, guest); validateErr != nil {
			return validateErr
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
