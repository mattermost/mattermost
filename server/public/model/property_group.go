// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"regexp"
)

const AccessControlPropertyGroupName = "access_control"

// DeprecatedCPAPropertyGroupName is the old group name for custom profile attributes.
// It was renamed to "access_control". The plugin API still accepts this name
// for backward compatibility, but plugin authors should migrate to
// AccessControlPropertyGroupName.
const DeprecatedCPAPropertyGroupName = "custom_profile_attributes"

// AccessControlGroupFieldLimit is the global cap on the number of
// property fields that can exist in the access_control group across
// all object types. Call sites read all fields/values in a single page
// (PerPage = AccessControlGroupFieldLimit + 5) instead of paginating,
// on the assumption that the result set is bounded by this limit. If the
// limit is ever raised significantly or removed, every call site that uses
// AccessControlGroupFieldLimit + 5 must be converted to paginate.
const AccessControlGroupFieldLimit = 200

var validPropertyGroupNameRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9_]*$`)

const (
	PropertyGroupVersionV1 = 1
	PropertyGroupVersionV2 = 2
)

// AccessControlPropertyGroupSchemaVersion is the current schema version for
// the access_control group's field definitions. Increment this constant
// whenever the shape of access_control fields (attrs, types, options) changes
// in a way that consumers need to detect.
const AccessControlPropertyGroupSchemaVersion = 1

type PropertyGroup struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Version       int    `json:"version"`
	SchemaVersion int    `json:"schema_version"`
}

func (pg *PropertyGroup) IsPSAv1() bool {
	return pg.Version == PropertyGroupVersionV1
}

func (pg *PropertyGroup) IsPSAv2() bool {
	return pg.Version == PropertyGroupVersionV2
}

func (pg *PropertyGroup) PreSave() {
	if pg.ID == "" {
		pg.ID = NewId()
	}

	if pg.Version == 0 {
		pg.Version = PropertyGroupVersionV1
	}

	if pg.SchemaVersion <= 0 {
		pg.SchemaVersion = 1
	}
}

func (pg *PropertyGroup) IsValid() *AppError {
	if !IsValidId(pg.ID) {
		return NewAppError("PropertyGroup.IsValid", "model.property_group.is_valid.app_error", map[string]any{"FieldName": "id", "Reason": "invalid id"}, "", http.StatusBadRequest)
	}

	if !IsValidPropertyGroupName(pg.Name) {
		return NewAppError("PropertyGroup.IsValid", "model.property_group.is_valid.app_error", map[string]any{"FieldName": "name", "Reason": "invalid name"}, "id="+pg.ID, http.StatusBadRequest)
	}

	if pg.Version != PropertyGroupVersionV1 && pg.Version != PropertyGroupVersionV2 {
		return NewAppError("PropertyGroup.IsValid", "model.property_group.is_valid.app_error", map[string]any{"FieldName": "version", "Reason": "unknown value"}, "id="+pg.ID, http.StatusBadRequest)
	}

	return nil
}

// IsValidPropertyGroupName checks that the name matches [a-z0-9][a-z0-9_]*.
// Names starting with "_" are reserved.
func IsValidPropertyGroupName(name string) bool {
	return name != "" && validPropertyGroupNameRegex.MatchString(name)
}
