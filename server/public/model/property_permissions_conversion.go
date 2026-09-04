// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "maps"

// LegacyConversionOpts controls how PermissionsFromLegacy reads a field's
// legacy permission columns and Attrs.
type LegacyConversionOpts struct {
	// ConvertAttrs is true only for the access_control group. Only there were
	// the protected flag and access_mode attrs ever enforced, so only there is
	// there anything to preserve when converting them; everywhere else those
	// settings have never gated anything.
	ConvertAttrs bool
	// Template is the linked field's template, when the field being converted
	// is linked to one. Its option.read tier caps the converted field's own,
	// since a linked field's option.read reads the template's option scheme
	// rather than its own.
	Template *Permissions
}

// PermissionsFromLegacy converts a field's legacy permission columns, and (for
// an access_control field) its Attrs-based protected/access_mode settings,
// into a normalized Permissions object: Restrictions, Grants, and Masking.
func PermissionsFromLegacy(field *PropertyField, opts LegacyConversionOpts) *Permissions {
	restrictions := &Restrictions{
		Field:  WriteOnly{Write: permissionLevelOrNone(field.PermissionField)},
		Option: ReadWrite{Write: permissionLevelOrNone(field.PermissionOptions)},
		Value:  ReadWrite{Write: permissionLevelOrNone(field.PermissionValues)},
	}

	if !opts.ConvertAttrs {
		// Reads in every other group were never gated by anything; the omitted-leaf
		// default of none would take away access every caller has today.
		restrictions.Value.Read = PermissionLevelEveryone
		restrictions.Option.Read = PermissionLevelEveryone
	} else {
		switch LegacyAccessMode(field) {
		case PropertyAccessModePublic:
			restrictions.Value.Read = PermissionLevelEveryone
			restrictions.Option.Read = PermissionLevelEveryone
		case PropertyAccessModeSharedOnly:
			// The read is allowed here and then narrowed by masking (added once its
			// holdings field is resolved) to what the caller holds. Denying the read
			// here would deny the read the filter is meant to narrow.
			restrictions.Value.Read = PermissionLevelEveryone
			restrictions.Option.Read = PermissionLevelEveryone
		default:
			// source_only, or an access_mode this build does not recognize: only the
			// source plugin reads such a field today (its grant is added separately),
			// so this cannot be read as public without widening a field somebody
			// deliberately restricted.
			restrictions.Value.Read = PermissionLevelNone
			restrictions.Option.Read = PermissionLevelNone
		}
	}

	if field.Protected {
		// The legacy human decision refuses field.write outright on a protected
		// field before it ever reads PermissionField, for every group.
		restrictions.Field.Write = PermissionLevelNone
	}
	if opts.ConvertAttrs && (HasPropertyFieldOwners(field) || IsPropertyFieldProtected(field) || GetPropertyFieldSyncSource(field) != "") {
		// The converted restriction refuses every human on an owner-managed,
		// protected, or synced field before it ever reads PermissionValues;
		// converting that column's level instead would hand those values to
		// members. A grant can still restore write access for a specific
		// identity (e.g. the sync source itself, or a field's own owner),
		// since the model is grant-only and a grant always beats a restriction.
		restrictions.Value.Write = PermissionLevelNone
	}

	if opts.Template != nil {
		// A linked field's option.read reads the template's option scheme, and the
		// property service refuses a linked field above its template's tier on
		// every write, the backfill's own write included.
		templateOptionRead := opts.Template.Restrictions.TierFor(PropertyActionOptionRead)
		if !restrictions.Option.Read.AtMostAsPermissiveAs(templateOptionRead) {
			restrictions.Option.Read = templateOptionRead
		}
	}

	masking := maskingFromLegacy(field, restrictions, opts)

	grants := []Grant{}
	if opts.ConvertAttrs {
		// Owners, the source plugin ID and the sync lock are all read from Attrs,
		// so they convert only where Attrs were ever enforced.
		grants = grantsFromLegacy(field)
	}
	if opts.Template != nil {
		// A linked field's grant over option.read is read access to the template's
		// own scheme, never a right the identity held over the linked field itself
		// (PropertyField.IsValid refuses such a grant outright), so the converted
		// grants must not carry it.
		for i := range grants {
			grants[i].Allow = removeAction(grants[i].Allow, PropertyActionOptionRead)
		}
	}

	return &Permissions{
		Restrictions: restrictions,
		Grants:       grants,
		Masking:      masking,
	}
}

// ProjectLegacyPermissions is the inverse of PermissionsFromLegacy: it
// returns a copy of field with its legacy permission columns and Attrs
// populated from field.Permissions, so a v2 caller keeps reading a field
// whose access is decided from permissions alone. Returns field
// unchanged when Permissions is nil — there is nothing to project. Never
// mutates field or its Attrs map.
func ProjectLegacyPermissions(field *PropertyField) *PropertyField {
	if field.Permissions == nil {
		return field
	}

	projected := *field
	projected.Attrs = maps.Clone(field.Attrs)
	if projected.Attrs == nil {
		projected.Attrs = StringInterface{}
	}

	restrictions := field.Permissions.Restrictions
	fieldWrite := restrictions.TierFor(PropertyActionFieldWrite)
	valueWrite := restrictions.TierFor(PropertyActionValueWrite)
	optionWrite := restrictions.TierFor(PropertyActionOptionWrite)
	projected.PermissionField = &fieldWrite
	projected.PermissionValues = &valueWrite
	projected.PermissionOptions = &optionWrite

	// Protected is derived from field.write: none, which is how IsValid
	// cross-validates protected against permission_field on the projected result.
	projected.Protected = fieldWrite == PermissionLevelNone
	if projected.Protected {
		projected.Attrs[PropertyAttrsProtected] = true
	} else {
		delete(projected.Attrs, PropertyAttrsProtected)
	}

	if owners := ownersFromGrants(field.Permissions.Grants); len(owners) > 0 {
		projected.Attrs[PropertyAttrsOwners] = owners
	} else {
		// No owners at all, so the field looks exactly like a field that never
		// had any, rather than one carrying an empty list.
		delete(projected.Attrs, PropertyAttrsOwners)
	}

	if accessMode := field.GetAccessMode(); accessMode == PropertyAccessModePublic {
		// An absent key already means public.
		delete(projected.Attrs, PropertyAttrsAccessMode)
	} else {
		projected.Attrs[PropertyAttrsAccessMode] = accessMode
	}

	return &projected
}

// ownersFromGrants converts each grant into the PropertyOwner shape a v2
// caller reads from Attrs, carrying the grant's own Allow list rather than
// enumerating every action.
func ownersFromGrants(grants []Grant) []PropertyOwner {
	if len(grants) == 0 {
		return nil
	}
	owners := make([]PropertyOwner, len(grants))
	for i, grant := range grants {
		owners[i] = PropertyOwner{
			ID:     grant.ID,
			Type:   grant.Type,
			Scopes: grant.Scopes,
			Allow:  grant.Allow,
		}
	}
	return owners
}

// maskingFromLegacy converts a shared_only access mode into a Masking object.
// It returns nil for every other access mode, and for a linked field it never
// returns one of the field's own — it either leaves the field to inherit the
// template's object whole, or, if the template did not convert to masked,
// narrows the field's own reads to none in restrictions instead.
func maskingFromLegacy(field *PropertyField, restrictions *Restrictions, opts LegacyConversionOpts) *Masking {
	if !opts.ConvertAttrs || LegacyAccessMode(field) != PropertyAccessModeSharedOnly {
		return nil
	}

	if opts.Template != nil {
		if opts.Template.Masking != nil {
			// Inherits the template's object whole: the model refuses a linked field
			// that declares its own, and the read path already resolves a linked
			// field's masking from its template.
			return nil
		}
		// Configured as filtered but linked to a template with nothing to filter by.
		// Leaving reads at everyone (set above by the shared_only case) would unmask
		// values that are filtered today, so fail closed instead.
		restrictions.Value.Read = PermissionLevelNone
		restrictions.Option.Read = PermissionLevelNone
		return nil
	}

	masking := &Masking{}
	if pluginID, _ := field.Attrs[PropertyAttrsSourcePluginID].(string); pluginID != "" {
		// Replaces the source plugin's silent shared_only bypass with an explicit
		// exemption.
		masking.Except = append(masking.Except, Identity{Type: PropertyOwnerTypePlugin, ID: pluginID})
	}
	if syncSource := GetPropertyFieldSyncSource(field); syncSource != "" {
		// A machine caller holds no values, so without this a masked synced field
		// would accept only the first sync write and refuse every one after it.
		masking.Except = append(masking.Except, Identity{Type: PropertyOwnerTypeService, ID: syncSource})
	}

	if field.ObjectType == PropertyFieldObjectTypeUser &&
		(restrictions.Value.Write == PermissionLevelMember || restrictions.Value.Write == PermissionLevelEveryone) {
		// Unreachable for a field that passed ValidatePropertyFieldAccessMode:
		// shared_only requires protected, and a protected field's value.write was
		// zeroed above. This is the fail-safe for a row that reached the conversion
		// without passing that validator — a caller who can edit their own holdings
		// on a masked user field could widen their own view by writing into it, and
		// validateMaskingForField refuses that combination outright, so raise the
		// tier rather than emit an object the model would reject.
		restrictions.Value.Write = PermissionLevelAdmin
	}

	return masking
}

// grantsFromLegacy converts a field's owners, source plugin and sync lock —
// all Attrs-based, all implicitly trusted with everything under the legacy
// model — into grants enumerating the five enforced actions, plus one
// wildcard plugin grant for ambient access a machine caller named nowhere
// on the field still holds (see ambientMachineGrantAllow).
//
// Each input's Allow is split by PropertyActionMeasuredAgainstValueObject
// before it is merged in: an owner's Scopes only ever narrows the value
// actions, since field.write and the option actions are measured against the
// field's own target rather than a value's object, so scope has nothing to
// say about them. The two halves are tracked separately per identity and
// recombined into one grant at the end whenever neither ends up carrying a
// scope — e.g. an owner who is also the field's source plugin, whose
// unrestricted access cancels the owner scope out of both halves. An identity
// whose two halves do end up scoped differently is the case this split
// exists for: a scoped owner keeps its field.write and option grants
// unscoped even though its value grant is not, matching how the store's
// grants table (keyed on FieldID, Type, ID, Action, not Scopes) lets two
// grants for one identity coexist as long as their actions are disjoint.
func grantsFromLegacy(field *PropertyField) []Grant {
	type identityKey struct{ typ, id string }
	var order []identityKey
	valueByIdentity := map[identityKey]*Grant{}
	otherByIdentity := map[identityKey]*Grant{}

	addTo := func(byIdentity map[identityKey]*Grant, key identityKey, scopes, allow []string) {
		if len(allow) == 0 {
			return
		}
		if existing, ok := byIdentity[key]; ok {
			existing.Allow = unionActions(existing.Allow, allow)
			existing.Scopes = mergeScopes(existing.Scopes, scopes)
			return
		}
		byIdentity[key] = &Grant{
			Identity: Identity{Type: key.typ, ID: key.id},
			Scopes:   scopes,
			Allow:    allow,
		}
	}

	addGrant := func(identityType, id string, scopes, allow []string) {
		if id == "" {
			return
		}
		key := identityKey{identityType, id}
		if _, ok := valueByIdentity[key]; !ok {
			if _, ok := otherByIdentity[key]; !ok {
				order = append(order, key)
			}
		}
		var valueAllow, otherAllow []string
		for _, action := range allow {
			if PropertyActionMeasuredAgainstValueObject(action) {
				valueAllow = append(valueAllow, action)
			} else {
				otherAllow = append(otherAllow, action)
			}
		}
		addTo(valueByIdentity, key, scopes, valueAllow)
		// field.write/option grants are never scope-gated, no matter what
		// scope the same call passed for the value half above.
		addTo(otherByIdentity, key, nil, otherAllow)
	}

	for _, owner := range GetPropertyFieldOwners(field) {
		allow := validPropertyActions
		if len(owner.Allow) > 0 {
			// An owner written by ProjectLegacyPermissions carries the exact list its
			// grant was allowed; honoring it verbatim is what makes projecting a
			// converted field and converting it back lossless. An owner with no Allow
			// predates this field and keeps the legacy assumption of full access.
			allow = owner.Allow
		}
		addGrant(owner.Type, owner.ID, owner.Scopes, allow)
	}

	if pluginID, _ := field.Attrs[PropertyAttrsSourcePluginID].(string); pluginID != "" {
		// The source plugin can read, write the definition and write values on a
		// protected field; anything less takes access away, and it is never
		// scope-restricted.
		addGrant(PropertyOwnerTypePlugin, pluginID, nil, validPropertyActions)
	}

	if syncSource := GetPropertyFieldSyncSource(field); syncSource != "" {
		// The ldap/saml lock only ever gated value writes; granting value.read
		// too would widen a source_only synced field the sync caller cannot
		// read.
		addGrant(PropertyOwnerTypeService, syncSource, nil, []string{PropertyActionValueWrite})
	}

	if allow := ambientMachineGrantAllow(field); len(allow) > 0 {
		// An installed plugin arriving through the plugin API matches no
		// owner, protected, or sync-lock grant of its own, so without this
		// wildcard the conversion would revoke access nothing else on this
		// field replaces.
		addGrant(PropertyOwnerTypePlugin, "*", nil, allow)
	}

	grants := make([]Grant, 0, len(order))
	for _, key := range order {
		value, other := valueByIdentity[key], otherByIdentity[key]
		switch {
		case value == nil:
			grants = append(grants, *other)
		case other == nil:
			grants = append(grants, *value)
		case len(value.Scopes) == 0 && len(other.Scopes) == 0:
			// Neither half ended up scoped, so one grant says exactly what two
			// would.
			grants = append(grants, Grant{Identity: value.Identity, Allow: unionActions(value.Allow, other.Allow)})
		default:
			grants = append(grants, *value, *other)
		}
	}
	return grants
}

// ambientMachineGrantAllow returns the actions a machine caller may perform on
// field with no grant naming it at all, so PermissionsFromLegacy can mint a
// wildcard plugin grant preserving that access instead of silently revoking
// it. Returns an empty slice when the field grants no such ambient access, so
// the caller adds no grant rather than one with an empty Allow.
//
// Each action mirrors what an unnamed plugin could do on the field:
//   - value.read and option.read: only a public field. A source_only field
//     denies both (no grant needed to match); a shared_only field is unmasked
//     either way for a caller holding nothing, so it needs none either.
//   - value.write: only when the field has no owners, is not protected, and
//     is not synced.
//   - field.write and option.write: the same owners/protected pair. Option
//     changes are gated on option.write, so they share that grant.
//
// An orphaned protected field (source plugin uninstalled) converts to no
// wildcard write: a stored grant cannot express "the source is gone", and
// narrower is the recoverable direction.
func ambientMachineGrantAllow(field *PropertyField) []string {
	granted := map[string]bool{}

	if LegacyAccessMode(field) == PropertyAccessModePublic {
		granted[PropertyActionValueRead] = true
		granted[PropertyActionOptionRead] = true
	}

	// field.Protected and the access_control-only Attrs flag are two separate
	// columns that both mean "protected"; either one stands in the way.
	protected := field.Protected || IsPropertyFieldProtected(field)
	if !HasPropertyFieldOwners(field) && !protected {
		granted[PropertyActionFieldWrite] = true
		granted[PropertyActionOptionWrite] = true
		if GetPropertyFieldSyncSource(field) == "" {
			granted[PropertyActionValueWrite] = true
		}
	}

	allow := make([]string, 0, len(granted))
	for _, action := range validPropertyActions {
		if granted[action] {
			allow = append(allow, action)
		}
	}
	return allow
}

// unionActions merges two allow lists, returning their union in
// validPropertyActions order so a merged grant's Allow is deterministic.
func unionActions(a, b []string) []string {
	seen := map[string]bool{}
	for _, action := range a {
		seen[action] = true
	}
	for _, action := range b {
		seen[action] = true
	}
	result := make([]string, 0, len(seen))
	for _, action := range validPropertyActions {
		if seen[action] {
			result = append(result, action)
		}
	}
	return result
}

// mergeScopes combines two owner scope lists for the same identity. An empty
// list means unrestricted (Grant.matches skips the scope check when Scopes is
// empty), so if either side is unrestricted the merge must stay unrestricted
// rather than narrowing it to the other side's scopes.
func mergeScopes(a, b []string) []string {
	if len(a) == 0 || len(b) == 0 {
		return nil
	}
	seen := map[string]bool{}
	result := make([]string, 0, len(a)+len(b))
	for _, scopes := range [][]string{a, b} {
		for _, scope := range scopes {
			if !seen[scope] {
				seen[scope] = true
				result = append(result, scope)
			}
		}
	}
	return result
}

// removeAction returns allow with action removed, preserving order.
func removeAction(allow []string, action string) []string {
	result := make([]string, 0, len(allow))
	for _, a := range allow {
		if a != action {
			result = append(result, a)
		}
	}
	return result
}

// LegacyAccessMode reads Attrs[access_mode] directly, ignoring Permissions
// even when it is set. GetAccessMode prefers Permissions once it is non-nil,
// which is right for every other reader -- but converting a field is the one
// place that must read what the legacy submission actually says regardless
// of what Permissions currently holds: reconverting an already-converted
// field puts the stored object on the field before this runs (see
// updatePropertyFields' translation), and GetAccessMode would then report
// the old, pre-update mode instead of the caller's submitted one. The same
// applies to a backfill row whose Permissions has been stripped: GetAccessMode
// reports public, and the stored attr is the value the conversion must see.
func LegacyAccessMode(field *PropertyField) string {
	if field.Attrs == nil {
		return PropertyAccessModePublic
	}
	accessMode, ok := field.Attrs[PropertyAttrsAccessMode].(string)
	if !ok {
		return PropertyAccessModePublic
	}
	return accessMode
}

// permissionLevelOrNone reads a legacy *PermissionLevel column, converting an
// unset column (nil, meaning the level was never set) to none rather than
// leaving the leaf empty — an unset legacy column denies today, same as none.
func permissionLevelOrNone(level *PermissionLevel) PermissionLevel {
	if level == nil {
		return PermissionLevelNone
	}
	return *level
}
