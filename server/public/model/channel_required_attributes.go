// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// IsChannelFieldFillableByCreators reports whether whoever creates a channel
// can give it a value for field: the value.write tier is one the create
// endpoint lets a creator fill (admin, creator, member or everyone; the
// creator becomes the channel's admin), and channel members can read the
// field's options and values. A required field failing this check is one new
// channels can never satisfy.
//
// The field is judged on ChannelFieldEffectivePermissions, masking included. A
// linked field never stores its own masking, so callers judging one set its
// template's masking on the field first.
func IsChannelFieldFillableByCreators(field *PropertyField) bool {
	if field == nil || field.ObjectType != PropertyFieldObjectTypeChannel {
		return false
	}
	if managed, _ := field.Attrs[PropertyFieldAttrManaged].(string); managed == "admin" {
		return false
	}

	permissions := ChannelFieldEffectivePermissions(field)
	if permissions.Masking != nil {
		return false
	}

	restrictions := permissions.Restrictions
	switch restrictions.TierFor(PropertyActionValueWrite) {
	case PermissionLevelAdmin, PermissionLevelCreator, PermissionLevelMember, PermissionLevelEveryone:
	default:
		return false
	}

	return PermissionLevelMember.AtMostAsPermissiveAs(restrictions.TierFor(PropertyActionValueRead)) &&
		PermissionLevelMember.AtMostAsPermissiveAs(restrictions.TierFor(PropertyActionOptionRead))
}

// ChannelFieldEffectivePermissions returns the permissions a channel field is
// enforced with: Permissions when set, otherwise the access_control conversion
// of its legacy columns and attrs, which is what the property service stores
// for it. Owned, protected and synced fields convert to value.write none plus a
// grant. A nil PermissionValues is the channel default, admin.
func ChannelFieldEffectivePermissions(field *PropertyField) *Permissions {
	if field.Permissions != nil {
		return field.Permissions
	}
	legacy := *field
	if legacy.PermissionValues == nil {
		admin := PermissionLevelAdmin
		legacy.PermissionValues = &admin
	}
	return PermissionsFromLegacy(&legacy, LegacyConversionOpts{ConvertAttrs: true})
}
