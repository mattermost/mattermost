// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
)

// ActionEntry registers an action that access evaluation manages through ABAC.
//
// Handlers keep checking the individual permission IDs listed in Permissions;
// access evaluation maps each one to its action with ActionForPermission and
// evaluates the policies written on Name. A policy on a registered action
// applies to every caller, system admins included, and a stored policy still
// denies while ABAC cannot evaluate it.
type ActionEntry struct {
	// Name is the policy action the permissions are evaluated under.
	Name string
	// ResourceType is the resource the action is evaluated against: one of
	// AccessControlPolicyTypeSystem, AccessControlPolicyTypeTeam or
	// AccessControlPolicyTypeChannel.
	ResourceType string
	// Grantable makes RBAC abstain, rather than deny, when no role grants one of
	// Permissions, so that a policy can grant it. A registered but non-grantable
	// action can only be restricted by policy, never granted.
	Grantable bool
	// Permissions are the RBAC permission IDs the action covers. Each permission
	// belongs to at most one action.
	Permissions []string
}

// registeredActions lists every action access evaluation routes through ABAC.
// Registering an action here is all that is needed to make it a valid action
// on system permission policies.
var registeredActions = []ActionEntry{}

// unregistrablePermissions are permissions too broad to hand to a policy:
// granting any of them is equivalent to full system admin, or lets the holder
// grant themselves anything else.
var unregistrablePermissions = []string{
	"manage_system",
	"manage_roles",
	"assign_system_admin_role",
	"sysconsole_write_user_management_permissions",
	"sysconsole_write_user_management_system_roles",
}

var registeredActionResourceTypes = []string{
	AccessControlPolicyTypeSystem,
	AccessControlPolicyTypeTeam,
	AccessControlPolicyTypeChannel,
}

type actionRegistry struct {
	entries      []ActionEntry
	byName       map[string]*ActionEntry
	byPermission map[string]*ActionEntry
}

var (
	defaultActionRegistryOnce sync.Once
	defaultActionRegistry     *actionRegistry
	actionRegistryOverride    atomic.Pointer[actionRegistry]
)

func newActionRegistry(entries []ActionEntry) (*actionRegistry, error) {
	r := &actionRegistry{
		entries:      make([]ActionEntry, 0, len(entries)),
		byName:       make(map[string]*ActionEntry, len(entries)),
		byPermission: make(map[string]*ActionEntry),
	}

	seenNames := make(map[string]bool, len(entries))
	permissionOwners := make(map[string]string)
	for _, entry := range entries {
		if !IsValidPolicyAction(entry.Name) {
			return nil, fmt.Errorf("registered action %q: invalid action name", entry.Name)
		}
		if allowedActionsV0_3[entry.Name] {
			return nil, fmt.Errorf("registered action %q: collides with a built-in policy action", entry.Name)
		}
		if seenNames[entry.Name] {
			return nil, fmt.Errorf("registered action %q: registered more than once", entry.Name)
		}
		seenNames[entry.Name] = true
		if !slices.Contains(registeredActionResourceTypes, entry.ResourceType) {
			return nil, fmt.Errorf("registered action %q: unknown resource type %q", entry.Name, entry.ResourceType)
		}
		if len(entry.Permissions) == 0 {
			return nil, fmt.Errorf("registered action %q: no permissions", entry.Name)
		}
		for _, permissionID := range entry.Permissions {
			if permissionID == "" {
				return nil, fmt.Errorf("registered action %q: empty permission ID", entry.Name)
			}
			if slices.Contains(unregistrablePermissions, permissionID) {
				return nil, fmt.Errorf("registered action %q: permission %q is too broad to register", entry.Name, permissionID)
			}
			if owner, exists := permissionOwners[permissionID]; exists {
				return nil, fmt.Errorf("registered action %q: permission %q already belongs to action %q", entry.Name, permissionID, owner)
			}
			permissionOwners[permissionID] = entry.Name
		}

		entry.Permissions = slices.Clone(entry.Permissions)
		r.entries = append(r.entries, entry)
	}

	for i := range r.entries {
		entry := &r.entries[i]
		r.byName[entry.Name] = entry
		for _, permissionID := range entry.Permissions {
			r.byPermission[permissionID] = entry
		}
	}

	return r, nil
}

func currentActionRegistry() *actionRegistry {
	if override := actionRegistryOverride.Load(); override != nil {
		return override
	}
	defaultActionRegistryOnce.Do(func() {
		r, err := newActionRegistry(registeredActions)
		if err != nil {
			panic(err)
		}
		defaultActionRegistry = r
	})
	return defaultActionRegistry
}

// ActionForPermission returns the registered action the permission belongs to.
func ActionForPermission(permissionID string) (ActionEntry, bool) {
	entry, ok := currentActionRegistry().byPermission[permissionID]
	if !ok {
		return ActionEntry{}, false
	}
	return cloneActionEntry(*entry), true
}

// IsRegisteredAction reports whether name is a registered action.
func IsRegisteredAction(name string) bool {
	_, ok := currentActionRegistry().byName[name]
	return ok
}

// RegisteredActionsForResourceType returns the registered actions evaluated
// against the given resource type, in registration order.
func RegisteredActionsForResourceType(resourceType string) []ActionEntry {
	var entries []ActionEntry
	for _, entry := range currentActionRegistry().entries {
		if entry.ResourceType == resourceType {
			entries = append(entries, cloneActionEntry(entry))
		}
	}
	return entries
}

func cloneActionEntry(entry ActionEntry) ActionEntry {
	entry.Permissions = slices.Clone(entry.Permissions)
	return entry
}

// SetRegisteredActionsForTesting replaces the action registry with entries
// until the test ends. The registry is process-wide, so tests that call it
// must not run in parallel with tests that evaluate registered actions.
func SetRegisteredActionsForTesting(tb testing.TB, entries ...ActionEntry) {
	tb.Helper()
	r, err := newActionRegistry(entries)
	if err != nil {
		tb.Fatalf("invalid action registry: %v", err)
	}
	previous := actionRegistryOverride.Swap(r)
	tb.Cleanup(func() {
		actionRegistryOverride.Store(previous)
	})
}
