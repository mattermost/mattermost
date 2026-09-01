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

	return &Permissions{
		Restrictions: restrictions,
		Grants:       []Grant{},
	}
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
