// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "maps"

// Native user attributes are first-class User columns exposed to ABAC policies
// as user.<name> (in contrast to custom profile attributes, referenced as
// user.attributes.<name>). The SQL/CEL source of truth lives in the enterprise
// access_control package; these descriptors only drive editor autocomplete.
const (
	NativeAttributePropertyFieldEmail    = "email"
	NativeAttributePropertyFieldVerified = "verified"
	NativeAttributePropertyFieldIsBot    = "isbot"
	NativeAttributePropertyFieldCreateAt = "createat"
)

const (
	NativeAttributeDisplayNameEmail    = "Email"
	NativeAttributeDisplayNameVerified = "Email verified"
	NativeAttributeDisplayNameIsBot    = "Bot account"
	NativeAttributeDisplayNameCreateAt = "Account created"
)

// PropertyField Attrs keys describing a synthetic native user attribute.
const (
	// NativeAttributeAttrMarker marks a field as a Mattermost-native user
	// attribute (referenced as user.<name>), distinguishing it from custom
	// profile attributes (user.attributes.<name>).
	NativeAttributeAttrMarker = "native"
	// NativeAttributeAttrDisplayName carries the human-readable label.
	NativeAttributeAttrDisplayName = "display_name"
	// NativeAttributeAttrOperators lists the visual operators an editor may
	// offer. Values match the operator tokens defined by the enterprise visual
	// format (e.g. "==", "youngerThanDays").
	NativeAttributeAttrOperators = "operators"
)

func nativeAttributeField(groupID, name, displayName string, fieldType PropertyFieldType, operators []string, extraAttrs StringInterface) *PropertyField {
	attrs := StringInterface{
		NativeAttributeAttrMarker:      true,
		NativeAttributeAttrDisplayName: displayName,
		NativeAttributeAttrOperators:   operators,
	}
	maps.Copy(attrs, extraAttrs)
	return &PropertyField{
		GroupID:           groupID,
		Name:              name,
		Type:              fieldType,
		ObjectType:        PropertyFieldObjectTypeUser,
		TargetType:        string(PropertyFieldTargetLevelSystem),
		PermissionField:   NewPointer(PermissionLevelSysadmin),
		PermissionValues:  NewPointer(PermissionLevelSysadmin),
		PermissionOptions: NewPointer(PermissionLevelSysadmin),
		Attrs:             attrs,
	}
}

// NativeUserAttributeFields returns the synthetic PropertyField descriptors for
// the native user attributes exposed to ABAC editors. They are appended to the
// access-control autocomplete so the table/text editors can list them alongside
// custom profile attributes.
func NativeUserAttributeFields(groupID string) []*PropertyField {
	boolSelectOptions := StringInterface{
		PropertyFieldAttributeOptions: []map[string]string{
			{"name": "true"},
			{"name": "false"},
		},
	}

	return []*PropertyField{
		nativeAttributeField(groupID, NativeAttributePropertyFieldEmail, NativeAttributeDisplayNameEmail, PropertyFieldTypeText,
			[]string{"==", "!=", "in", "contains", "startsWith", "endsWith"}, nil),
		nativeAttributeField(groupID, NativeAttributePropertyFieldVerified, NativeAttributeDisplayNameVerified, PropertyFieldTypeSelect,
			[]string{"==", "!="}, boolSelectOptions),
		nativeAttributeField(groupID, NativeAttributePropertyFieldIsBot, NativeAttributeDisplayNameIsBot, PropertyFieldTypeSelect,
			[]string{"==", "!="}, boolSelectOptions),
		nativeAttributeField(groupID, NativeAttributePropertyFieldCreateAt, NativeAttributeDisplayNameCreateAt, PropertyFieldTypeText,
			[]string{"youngerThanDays"}, nil),
	}
}
