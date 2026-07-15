// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"regexp"
)

const (
	// Property Field Access Control Attributes
	PropertyAttrsProtected      = "protected"
	PropertyAttrsSourcePluginID = "source_plugin_id"
	PropertyAttrsAccessMode     = "access_mode"
	PropertyAttrsOwners         = "owners"

	// Access Modes
	PropertyAccessModePublic     = "" // Empty string means public (default)
	PropertyAccessModeSourceOnly = "source_only"
	PropertyAccessModeSharedOnly = "shared_only"
)

// Property owner types. An owner is an identity trusted to manage an
// attribute's data; see the Property Permissions Proposal.
const (
	PropertyOwnerTypePlugin  = "plugin"
	PropertyOwnerTypeService = "service"
	PropertyOwnerTypeRole    = "role"
	PropertyOwnerTypeUser    = "user"
)

// Defensive bounds on the owners list. These are not semantic limits — the
// server never interprets owner IDs or scopes — they only keep a buggy or
// hostile owner from bloating the field's Attrs blob. Real usage is far below
// them (a field has one or two owners, each with a handful of scopes). Scope
// labels must match the identifier charset enforced by IsValidPropertyOwnerScope.
const (
	PropertyOwnersMaxPerField  = 20  // owners per field
	PropertyOwnerScopesMax     = 32  // scopes per owner
	PropertyOwnerScopeMaxRunes = 64  // length of a single scope label
	PropertyOwnerIDMaxRunes    = 255 // length of an owner id
)

// PropertyOwner is an identity trusted to manage an attribute's data. When a
// field carries one or more owners (in its Attrs blob under PropertyAttrsOwners)
// the owners list governs the write-access decision for that field, superseding
// the legacy protected / source_plugin_id gating and the sync-lock:
//   - A machine caller must be a listed owner to write values or edit/delete the
//     field. A listed owner may edit the whole field definition including the
//     owners list (no own-entry restriction). A non-owner machine caller cannot
//     modify the field or add itself; the first owner is bootstrapped by a
//     sysadmin via the REST API.
//   - Value writes by a machine caller are allowed only if it is a listed owner
//     (matching ID and Type) whose Scopes contain the caller's acting-as scope.
//     An owner with an empty Scopes list is not scope-restricted and may write
//     for any scope.
//   - Value writes by a human (session) caller are always rejected: an
//     owner-managed field's values are authoritative to the owning
//     integration, so no session user — including sysadmins — may overwrite
//     them. This is enforced in the property-service hook, mirroring the
//     ldap/saml sync lock; PermissionValues is left at the normal default.
//
// What it does NOT change: source_plugin_id immutability and the protected-flag
// rules still apply as invariants on field-definition writes (a plugin-created
// owner field still carries its source_plugin_id), and read/masking is unchanged
// and still keys off access_mode.
type PropertyOwner struct {
	ID     string   `json:"id"`
	Type   string   `json:"type"`
	Scopes []string `json:"scopes"`
}

// IsValidPropertyOwnerType reports whether the given owner type is recognized.
func IsValidPropertyOwnerType(ownerType string) bool {
	switch ownerType {
	case PropertyOwnerTypePlugin,
		PropertyOwnerTypeService,
		PropertyOwnerTypeRole,
		PropertyOwnerTypeUser:
		return true
	}
	return false
}

var validPropertyOwnerScopeChars = regexp.MustCompile(`^[a-zA-Z0-9._:-]+$`)

// IsValidPropertyOwnerScope reports whether a scope label is identifier-shaped.
// This is a structural bound (like the length/count caps), not a semantic
// registry: the server still does not interpret what a scope means.
func IsValidPropertyOwnerScope(scope string) bool {
	return validPropertyOwnerScopeChars.MatchString(scope)
}

// GetPropertyFieldOwners returns the owners declared on a field's Attrs blob.
// Returns nil when the field has no owners. Handles both the typed
// ([]PropertyOwner) shape used right after a write and the generic
// ([]interface{} of maps) shape produced by a JSON round-trip from the store.
func GetPropertyFieldOwners(field *PropertyField) []PropertyOwner {
	if field == nil || field.Attrs == nil {
		return nil
	}

	raw, ok := field.Attrs[PropertyAttrsOwners]
	if !ok || raw == nil {
		return nil
	}

	if owners, ok := raw.([]PropertyOwner); ok {
		return owners
	}

	data, err := json.Marshal(raw)
	if err != nil {
		return nil
	}

	var owners []PropertyOwner
	if err := json.Unmarshal(data, &owners); err != nil {
		return nil
	}
	return owners
}

// HasPropertyFieldOwners reports whether a field declares any owners.
func HasPropertyFieldOwners(field *PropertyField) bool {
	return len(GetPropertyFieldOwners(field)) > 0
}

// IsKnownPropertyAccessMode checks if the given access mode is a recognized value
func IsKnownPropertyAccessMode(accessMode string) bool {
	switch accessMode {
	case PropertyAccessModePublic,
		PropertyAccessModeSourceOnly,
		PropertyAccessModeSharedOnly:
		return true
	}
	return false
}

// IsPropertyFieldProtected returns whether a PropertyField is protected from modifications
// by callers other than the source plugin
func IsPropertyFieldProtected(field *PropertyField) bool {
	if field.Attrs == nil {
		return false
	}

	protected, ok := field.Attrs[PropertyAttrsProtected].(bool)
	return ok && protected
}

// GetAccessMode returns the field's access mode. Returns the public mode (empty
// string) when no access_mode is configured or the field has no attrs at all.
func (f *PropertyField) GetAccessMode() string {
	if f.Attrs == nil {
		return PropertyAccessModePublic
	}
	accessMode, ok := f.Attrs[PropertyAttrsAccessMode].(string)
	if !ok {
		return PropertyAccessModePublic
	}
	return accessMode
}

// ValidatePropertyFieldAccessMode validates that the access_mode attribute is valid
// and compatible with the field type
func ValidatePropertyFieldAccessMode(field *PropertyField) error {
	if field.Attrs == nil {
		return nil
	}

	accessMode, ok := field.Attrs[PropertyAttrsAccessMode].(string)
	if !ok {
		// No access mode set, that's fine (defaults to public)
		return nil
	}

	// Check if access mode is known
	if !IsKnownPropertyAccessMode(accessMode) {
		return fmt.Errorf("invalid access mode '%s'", accessMode)
	}

	// Validate that non-public access modes require protected flag
	if accessMode == PropertyAccessModeSourceOnly || accessMode == PropertyAccessModeSharedOnly {
		if !IsPropertyFieldProtected(field) {
			return fmt.Errorf("access mode '%s' requires the field to be protected", accessMode)
		}
	}

	// shared_only + member-writable is contradictory: shared_only filters what
	// callers see to values they hold, but member-writable lets users self-assign
	// any value. Reject the combination at validation time instead of working
	// around it at the API/service layer.
	if accessMode == PropertyAccessModeSharedOnly && field.PermissionValues != nil && *field.PermissionValues == PermissionLevelMember {
		return fmt.Errorf("access mode 'shared_only' is incompatible with member-writable permission_values")
	}

	return nil
}
