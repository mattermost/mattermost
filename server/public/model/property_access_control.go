// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "context"

// AccessControlContextKey is the type for access control context keys.
type AccessControlContextKey string

// AccessControlCallerIDContextKey is the context key for access control caller ID.
const AccessControlCallerIDContextKey AccessControlContextKey = "access_control_caller_id"

// AccessControlScopeContextKey is the context key for the caller's "acting-as"
// scope. The scope rides alongside the caller ID so a single owner (e.g. the
// SCIM plugin) can subdivide its access per external system (e.g. "entra").
const AccessControlScopeContextKey AccessControlContextKey = "access_control_scope"

// Well-known caller IDs for internal services that need to write property
// values on synced fields. These are set on the request context by the
// respective sync services so that the access control hook can identify them.
//
// The "system:" prefix contains a colon, which is not a valid character in a
// plugin ID (see IsValidPluginId). That guarantees these values cannot be
// forged by a plugin whose manifest ID is used as its caller ID.
//
// CallerIDLocalAdmin marks a request as originating from a local-mode
// (unrestricted) session, which has an empty Session.UserId but full admin
// privileges. HTTP handlers tag the rctx with this caller ID when
// Session().IsUnrestricted() is true, so the attribute validation hook's
// permission checker can grant admin privileges without a user lookup.
//
// The CallerID*System values mark a request as the startup migration that
// installs and upgrades one group's builtin field definitions. There is one per
// subsystem rather than a single shared "migration" identity, so that the
// boards migration cannot rewrite session_attributes' schema. Each is a
// machine caller (isMachineCaller in the access-control hook), matched to a
// {service, <group>} grant on the fields it owns via SystemCallerOwnedGroup --
// a subsystem's authority over its own builtin fields is enumerable and
// revocable in the field definition, the same as any other grant, rather than
// a caller-ID bypass nothing can see or take away.
const (
	CallerIDLDAPSync   = "system:ldap_sync"
	CallerIDSAMLSync   = "system:saml_sync"
	CallerIDLocalAdmin = "system:local_admin"

	CallerIDBoardsSystem            = "system:boards"
	CallerIDSessionAttributesSystem = "system:session_attributes"
	CallerIDManagedCategorySystem   = "system:managed_category"
)

// systemCallerOwnedGroups maps each subsystem identity to the one property
// group whose builtin definitions it owns.
var systemCallerOwnedGroups = map[string]string{
	CallerIDBoardsSystem:            BoardsPropertyGroupName,
	CallerIDSessionAttributesSystem: SessionAttributesPropertyGroupName,
	CallerIDManagedCategorySystem:   ManagedCategoryPropertyGroupName,
}

// SystemCallerOwnedGroup reports the property group a subsystem identity owns.
// A caller that is not one of those identities returns false, and one that is
// may act only on the group it names -- the separation a single shared
// migration identity would not buy.
func SystemCallerOwnedGroup(callerID string) (string, bool) {
	group, ok := systemCallerOwnedGroups[callerID]
	return group, ok
}

// systemOwnedFieldNames lists, for each system-owned property group, the
// exact field names its setup migration seeds and keeps maintaining across
// version bumps. SystemOwnedFieldGrant mints a grant only for these names --
// deliberately not "every field in the group", since the generic v3 API can
// add a field to a system-owned group too (a custom session_attributes field,
// for one) and such a field is not the owning subsystem's to write.
//
// None of these groups masks any field today, so none of these identities is
// listed in a masking except: a system caller is a machine caller like any
// other and holds no values, so a masked field it needs to read would show it
// nothing unless later added there explicitly -- the same trap as tagging a
// local-mode admin as a machine caller with no holdings. If boards, session_attributes or
// managed_category ever masks a field, its migration needs an except entry
// naming its own service identity before that ships, or its own read of that
// field goes blind the way the v1 -> v2 boards upgrade almost did.
var systemOwnedFieldNames = map[string]map[string]bool{
	BoardsPropertyGroupName: {
		BoardsPropertyFieldAssignee: true,
		BoardsPropertyFieldStatus:   true,
	},
	ManagedCategoryPropertyGroupName: {
		ManagedCategoryPropertyFieldName: true,
	},
	SessionAttributesPropertyGroupName: sessionAttributesSystemFieldNames(),
}

// sessionAttributesSystemFieldNames collects the names SessionAttributeSystemFields
// seeds, so systemOwnedFieldNames stays in sync with that list instead of
// carrying its own hand-typed copy. The groupID argument only sets the
// returned fields' GroupID, which this never reads, so passing "" is fine.
func sessionAttributesSystemFieldNames() map[string]bool {
	names := make(map[string]bool)
	for _, field := range SessionAttributeSystemFields("") {
		names[field.Name] = true
	}
	return names
}

// SystemOwnedFieldGrant returns the {service, groupName} grant that lets the
// subsystem owning groupName keep reading and writing fieldName once the
// group is enforced, or nil if fieldName is not one its migration seeds (see
// systemOwnedFieldNames). Carries option.read alongside field.write and
// option.write: a machine caller's own grant is the only thing that admits it
// to a field's options at all, restrictions or no -- the boards migration
// reads its Status field's existing options to layer colours onto them on
// every version bump, and without option.read here that read comes back
// hidden, which is the exact defect that once destroyed every install's
// seeded options.
func SystemOwnedFieldGrant(groupName, fieldName string) *Grant {
	if !systemOwnedFieldNames[groupName][fieldName] {
		return nil
	}
	return &Grant{
		Identity: Identity{Type: PropertyOwnerTypeService, ID: groupName},
		Allow:    []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite},
	}
}

// WithCallerID adds the caller ID to a context.Context for access control purposes.
func WithCallerID(ctx context.Context, callerID string) context.Context {
	return context.WithValue(ctx, AccessControlCallerIDContextKey, callerID)
}

// CallerIDFromContext extracts the caller ID from a context.Context.
// Returns the caller ID and true if found, or empty string and false if not.
func CallerIDFromContext(ctx context.Context) (string, bool) {
	if v := ctx.Value(AccessControlCallerIDContextKey); v != nil {
		if id, ok := v.(string); ok {
			return id, true
		}
	}
	return "", false
}

// PropertyRequestOptions carries caller-side declarations for property plugin
// API calls. Values are applied to the request context alongside the caller ID
// (e.g. matching ActingAsScope against a field's owners). Value data belongs on
// PropertyValue; field configuration belongs on PropertyField.
type PropertyRequestOptions struct {
	// ActingAsScope is the owner-defined scope label the caller is acting as
	// (e.g. "entra"). Empty means the caller is not acting as any scope.
	ActingAsScope string
}

// WithPropertyRequestOptions applies the caller's per-call declarations onto
// ctx so the server can read them alongside the caller ID.
func WithPropertyRequestOptions(ctx context.Context, options PropertyRequestOptions) context.Context {
	if options.ActingAsScope != "" {
		ctx = context.WithValue(ctx, AccessControlScopeContextKey, options.ActingAsScope)
	}
	return ctx
}

// PropertyRequestOptionsFromContext reconstructs the caller's per-call
// declarations from ctx. Returns zero-value options when none were set.
func PropertyRequestOptionsFromContext(ctx context.Context) PropertyRequestOptions {
	scope, _ := ActingAsScopeFromContext(ctx)
	return PropertyRequestOptions{ActingAsScope: scope}
}

// ActingAsScopeFromContext extracts the caller's acting-as scope from a
// context.Context. Returns the scope and true if found, or empty string and
// false if not.
func ActingAsScopeFromContext(ctx context.Context) (string, bool) {
	if v := ctx.Value(AccessControlScopeContextKey); v != nil {
		if scope, ok := v.(string); ok {
			return scope, true
		}
	}
	return "", false
}
