// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidatePropertyFieldVisibility(t *testing.T) {
	tests := []struct {
		name    string
		attrs   StringInterface
		wantErr bool
	}{
		{name: "nil attrs", attrs: nil},
		{name: "no visibility key", attrs: StringInterface{"other": "val"}},
		{name: "empty string", attrs: StringInterface{PropertyFieldAttrVisibility: ""}},
		{name: "hidden", attrs: StringInterface{PropertyFieldAttrVisibility: "hidden"}},
		{name: "when_set", attrs: StringInterface{PropertyFieldAttrVisibility: "when_set"}},
		{name: "always", attrs: StringInterface{PropertyFieldAttrVisibility: "always"}},
		{name: "invalid", attrs: StringInterface{PropertyFieldAttrVisibility: "public"}, wantErr: true},
		{name: "non-string type", attrs: StringInterface{PropertyFieldAttrVisibility: 42}, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{Attrs: tt.attrs}
			err := ValidatePropertyFieldVisibility(field)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidatePropertyFieldSortOrder(t *testing.T) {
	tests := []struct {
		name    string
		attrs   StringInterface
		wantErr bool
	}{
		{name: "nil attrs", attrs: nil},
		{name: "no sort_order key", attrs: StringInterface{"other": "val"}},
		{name: "float64", attrs: StringInterface{PropertyFieldAttrSortOrder: float64(1.5)}},
		{name: "int", attrs: StringInterface{PropertyFieldAttrSortOrder: 1}},
		{name: "int64", attrs: StringInterface{PropertyFieldAttrSortOrder: int64(42)}},
		{name: "json.Number", attrs: StringInterface{PropertyFieldAttrSortOrder: json.Number("3.14")}},
		{name: "string", attrs: StringInterface{PropertyFieldAttrSortOrder: "not_a_number"}, wantErr: true},
		{name: "bool", attrs: StringInterface{PropertyFieldAttrSortOrder: true}, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{Attrs: tt.attrs}
			err := ValidatePropertyFieldSortOrder(field)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidatePropertyValueForValueType(t *testing.T) {
	tests := []struct {
		name      string
		valueType string
		value     string
		wantErr   bool
	}{
		{name: "empty value type", valueType: "", value: `"anything"`},
		{name: "valid email", valueType: "email", value: `"test@example.com"`},
		{name: "invalid email", valueType: "email", value: `"not-an-email"`, wantErr: true},
		{name: "empty email string", valueType: "email", value: `""`},
		{name: "valid url", valueType: "url", value: `"https://example.com"`},
		{name: "phone (any string)", valueType: "phone", value: `"+1-555-0123"`},
		{name: "unknown value type", valueType: "fax", value: `"test"`, wantErr: true},
		{name: "non-string json", valueType: "email", value: `42`, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePropertyValueForValueType(tt.valueType, json.RawMessage(tt.value))
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestIsPropertyFieldSynced(t *testing.T) {
	assert.False(t, IsPropertyFieldSynced(&PropertyField{}))
	assert.False(t, IsPropertyFieldSynced(&PropertyField{Attrs: StringInterface{}}))
	assert.True(t, IsPropertyFieldSynced(&PropertyField{Attrs: StringInterface{PropertyFieldAttrLDAP: "attr"}}))
	assert.True(t, IsPropertyFieldSynced(&PropertyField{Attrs: StringInterface{PropertyFieldAttrSAML: "attr"}}))
	assert.True(t, IsPropertyFieldSynced(&PropertyField{Attrs: StringInterface{PropertyFieldAttrLDAP: "a", PropertyFieldAttrSAML: "b"}}))
}

func TestGetPropertyFieldSyncSource(t *testing.T) {
	assert.Equal(t, "", GetPropertyFieldSyncSource(&PropertyField{}))
	assert.Equal(t, "ldap", GetPropertyFieldSyncSource(&PropertyField{Attrs: StringInterface{PropertyFieldAttrLDAP: "attr"}}))
	assert.Equal(t, "saml", GetPropertyFieldSyncSource(&PropertyField{Attrs: StringInterface{PropertyFieldAttrSAML: "attr"}}))
	// ldap takes priority
	assert.Equal(t, "ldap", GetPropertyFieldSyncSource(&PropertyField{Attrs: StringInterface{PropertyFieldAttrLDAP: "a", PropertyFieldAttrSAML: "b"}}))
}

func TestIsValidPropertyFieldVisibility(t *testing.T) {
	assert.True(t, IsValidPropertyFieldVisibility("hidden"))
	assert.True(t, IsValidPropertyFieldVisibility("when_set"))
	assert.True(t, IsValidPropertyFieldVisibility("always"))
	assert.False(t, IsValidPropertyFieldVisibility(""))
	assert.False(t, IsValidPropertyFieldVisibility("public"))
}

func TestIsValidPropertyFieldValueType(t *testing.T) {
	assert.True(t, IsValidPropertyFieldValueType("email"))
	assert.True(t, IsValidPropertyFieldValueType("url"))
	assert.True(t, IsValidPropertyFieldValueType("phone"))
	assert.False(t, IsValidPropertyFieldValueType(""))
	assert.False(t, IsValidPropertyFieldValueType("fax"))
}

func TestGetPropertyFieldValueType(t *testing.T) {
	assert.Equal(t, "", GetPropertyFieldValueType(&PropertyField{}))
	assert.Equal(t, "", GetPropertyFieldValueType(&PropertyField{Attrs: StringInterface{}}))
	assert.Equal(t, "email", GetPropertyFieldValueType(&PropertyField{Attrs: StringInterface{PropertyFieldAttrValueType: "email"}}))
	assert.Equal(t, "email", GetPropertyFieldValueType(&PropertyField{Attrs: StringInterface{PropertyFieldAttrValueType: " email "}}))
}

func TestCallerIDConstants(t *testing.T) {
	require.NotEmpty(t, CallerIDLDAPSync)
	require.NotEmpty(t, CallerIDSAMLSync)
	require.NotEqual(t, CallerIDLDAPSync, CallerIDSAMLSync)
}
