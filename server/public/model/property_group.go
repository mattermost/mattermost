// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"regexp"
)

var validPropertyGroupNameRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9_]*$`)

const (
	PropertyGroupVersionV1 = 1
	PropertyGroupVersionV2 = 2
)

type PropertyGroup struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version int    `json:"version"`
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
