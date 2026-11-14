// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// IsChannelFieldFillableByCreators reports whether whoever creates a channel
// can give it a value for field: the value.write tier is admin (the creator
// becomes the channel's admin) or member, and channel members can read the
// field's options and values. These are the tiers the create endpoint lets a
// creator fill, so a required field failing this check is one new channels
// can never satisfy. creator is deliberately not fillable: the create endpoint
// refuses creator-level values.
//
// The field is judged on its effective permissions: Permissions when set,
// otherwise the access_control conversion of its legacy columns and attrs,
// which is what the property service stores for it. Owned, protected and
// synced fields convert to value.write none plus a grant, so they are never
// fillable. A nil PermissionValues is the channel default, admin, and
// managed=admin pins it to sysadmin, as the access_control hook does on save.
func IsChannelFieldFillableByCreators(field *PropertyField) bool {
	if field == nil || field.ObjectType != PropertyFieldObjectTypeChannel {
		return false
	}
	if managed, _ := field.Attrs[PropertyFieldAttrManaged].(string); managed == "admin" {
		return false
	}

	permissions := field.Permissions
	if permissions == nil {
		legacy := *field
		if legacy.PermissionValues == nil {
			admin := PermissionLevelAdmin
			legacy.PermissionValues = &admin
		}
		permissions = PermissionsFromLegacy(&legacy, LegacyConversionOpts{ConvertAttrs: true})
	}

	if permissions.Masking != nil {
		return false
	}

	restrictions := permissions.Restrictions
	switch restrictions.TierFor(PropertyActionValueWrite) {
	case PermissionLevelAdmin, PermissionLevelMember:
	default:
		return false
	}

	return PermissionLevelMember.AtMostAsPermissiveAs(restrictions.TierFor(PropertyActionValueRead)) &&
		PermissionLevelMember.AtMostAsPermissiveAs(restrictions.TierFor(PropertyActionOptionRead))
}
