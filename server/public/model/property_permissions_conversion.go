// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

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
// into a normalized Permissions object. The result is always complete:
// Restrictions is non-nil with all five enforced leaves set, Grants is a
// non-nil empty slice for a caller to append owner/source-plugin/sync grants
// onto, and Masking is nil — shared_only becomes a Masking object in a later
// step, once its holdings field is resolved.
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
		switch field.GetAccessMode() {
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
	if opts.ConvertAttrs && IsPropertyFieldProtected(field) {
		// On a protected access_control field the value-write gate falls through to
		// the protected/source-plugin check, so only the source plugin can write
		// values today no matter what PermissionValues says. Converting value.write
		// to the column's level instead would hand those values to members.
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
	}
}

// grantsFromLegacy converts a field's owners, source plugin and sync lock —
// all Attrs-based, all implicitly trusted with everything under the legacy
// model — into grants enumerating the five enforced actions. An identity named
// by more than one input (an owner who is also the field's source plugin)
// collapses into a single grant rather than one per input, matching how the
// store's grants table is keyed.
func grantsFromLegacy(field *PropertyField) []Grant {
	type identityKey struct{ typ, id string }
	var order []identityKey
	byIdentity := map[identityKey]*Grant{}

	addGrant := func(identityType, id string, scopes, allow []string) {
		if id == "" {
			return
		}
		key := identityKey{identityType, id}
		if existing, ok := byIdentity[key]; ok {
			existing.Allow = unionActions(existing.Allow, allow)
			existing.Scopes = mergeScopes(existing.Scopes, scopes)
			return
		}
		byIdentity[key] = &Grant{
			Identity: Identity{Type: identityType, ID: id},
			Scopes:   scopes,
			Allow:    allow,
		}
		order = append(order, key)
	}

	for _, owner := range GetPropertyFieldOwners(field) {
		addGrant(owner.Type, owner.ID, owner.Scopes, validPropertyActions)
	}

	if pluginID, _ := field.Attrs[PropertyAttrsSourcePluginID].(string); pluginID != "" {
		// The source plugin can read, write the definition and write values on a
		// protected field today (hasUnrestrictedFieldReadAccess,
		// checkLegacyFieldWriteAccess); anything less takes access away, and it is
		// never scope-restricted.
		addGrant(PropertyOwnerTypePlugin, pluginID, nil, validPropertyActions)
	}

	if syncSource := GetPropertyFieldSyncSource(field); syncSource != "" {
		// The ldap/saml lock only ever gated value writes (checkSyncLock); granting
		// value.read too would widen a source_only synced field the sync caller
		// cannot read today.
		addGrant(PropertyOwnerTypeService, syncSource, nil, []string{PropertyActionValueWrite})
	}

	grants := make([]Grant, 0, len(order))
	for _, key := range order {
		grants = append(grants, *byIdentity[key])
	}
	return grants
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

// permissionLevelOrNone reads a legacy *PermissionLevel column, converting an
// unset column (nil, meaning the level was never set) to none rather than
// leaving the leaf empty — an unset legacy column denies today, same as none.
func permissionLevelOrNone(level *PermissionLevel) PermissionLevel {
	if level == nil {
		return PermissionLevelNone
	}
	return *level
}
