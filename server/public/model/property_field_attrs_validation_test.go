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

func TestSanitizeAndValidatePropertyFieldBoolAttr(t *testing.T) {
	tests := []struct {
		name      string
		key       string
		attrs     StringInterface
		want      bool
		wantKey   bool
		wantError string
	}{
		{name: "nil attrs", key: PropertyFieldAttrRequired, attrs: nil},
		{name: "no key", key: PropertyFieldAttrRequired, attrs: StringInterface{"other": "value"}},
		{name: "explicit nil clears the key", key: PropertyFieldAttrRequired, attrs: StringInterface{PropertyFieldAttrRequired: nil}},
		{name: "required true", key: PropertyFieldAttrRequired, attrs: StringInterface{PropertyFieldAttrRequired: true}, want: true, wantKey: true},
		{name: "required false is kept", key: PropertyFieldAttrRequired, attrs: StringInterface{PropertyFieldAttrRequired: false}, want: false, wantKey: true},
		{name: "editable false is kept", key: PropertyFieldAttrEditable, attrs: StringInterface{PropertyFieldAttrEditable: false}, want: false, wantKey: true},
		{name: "string is not coerced", key: PropertyFieldAttrRequired, attrs: StringInterface{PropertyFieldAttrRequired: "true"}, wantError: "required must be a boolean"},
		{name: "numeric is rejected", key: PropertyFieldAttrEditable, attrs: StringInterface{PropertyFieldAttrEditable: 1}, wantError: "editable must be a boolean"},
		{name: "array is rejected", key: PropertyFieldAttrRequired, attrs: StringInterface{PropertyFieldAttrRequired: []any{true}}, wantError: "required must be a boolean"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{Attrs: tt.attrs}
			err := SanitizeAndValidatePropertyFieldBoolAttr(field, tt.key)
			if tt.wantError != "" {
				require.ErrorContains(t, err, tt.wantError)
				return
			}

			require.NoError(t, err)
			if field.Attrs == nil {
				return
			}
			actual, ok := field.Attrs[tt.key]
			require.Equal(t, tt.wantKey, ok)
			if tt.wantKey {
				require.Equal(t, tt.want, actual)
			}
		})
	}
}

// The two keys are independent: validating one must not disturb the other, and
// neither may touch a key the hook doesn't own.
func TestSanitizeAndValidatePropertyFieldBoolAttrLeavesOtherKeys(t *testing.T) {
	field := &PropertyField{Attrs: StringInterface{
		PropertyFieldAttrRequired:   true,
		PropertyFieldAttrEditable:   nil,
		PropertyFieldAttrSortOrder:  3,
		PropertyFieldAttrVisibility: PropertyFieldVisibilityAlways,
	}}

	require.NoError(t, SanitizeAndValidatePropertyFieldBoolAttr(field, PropertyFieldAttrRequired))
	require.NoError(t, SanitizeAndValidatePropertyFieldBoolAttr(field, PropertyFieldAttrEditable))

	require.Equal(t, true, field.Attrs[PropertyFieldAttrRequired])
	require.NotContains(t, field.Attrs, PropertyFieldAttrEditable)
	require.Equal(t, 3, field.Attrs[PropertyFieldAttrSortOrder])
	require.Equal(t, PropertyFieldVisibilityAlways, field.Attrs[PropertyFieldAttrVisibility])
}

func TestIsPropertyFieldRequired(t *testing.T) {
	tests := []struct {
		name  string
		field *PropertyField
		want  bool
	}{
		{name: "nil field", field: nil, want: false},
		{name: "nil attrs", field: &PropertyField{}, want: false},
		{name: "absent key", field: &PropertyField{Attrs: StringInterface{}}, want: false},
		{name: "true", field: &PropertyField{Attrs: StringInterface{PropertyFieldAttrRequired: true}}, want: true},
		{name: "false", field: &PropertyField{Attrs: StringInterface{PropertyFieldAttrRequired: false}}, want: false},
		// A typo must not silently block channel creation.
		{name: "stringly true", field: &PropertyField{Attrs: StringInterface{PropertyFieldAttrRequired: "true"}}, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsPropertyFieldRequired(tt.field))
		})
	}
}

func TestIsEmptyPropertyValue(t *testing.T) {
	empty := []string{"", " ", "null", `""`, "[]", " [] "}
	for _, raw := range empty {
		require.True(t, IsEmptyPropertyValue(json.RawMessage(raw)), raw)
	}

	set := []string{`"x"`, `["a"]`, "0", "false", `{"a":1}`}
	for _, raw := range set {
		require.False(t, IsEmptyPropertyValue(json.RawMessage(raw)), raw)
	}
}

func TestSanitizeAndValidatePropertyFieldChangePolicy(t *testing.T) {
	tests := []struct {
		name      string
		fieldType PropertyFieldType
		attrs     StringInterface
		want      string
		wantKey   bool
		wantError string
	}{
		{name: "nil attrs", fieldType: PropertyFieldTypeSelect, attrs: nil},
		{name: "no key", fieldType: PropertyFieldTypeSelect, attrs: StringInterface{"other": "value"}},
		{name: "explicit nil clears the key", fieldType: PropertyFieldTypeSelect, attrs: StringInterface{PropertyFieldAttrChangePolicy: nil}},
		{name: "empty clears the key", fieldType: PropertyFieldTypeSelect, attrs: StringInterface{PropertyFieldAttrChangePolicy: "  "}},
		{name: "any is the default and is not stored", fieldType: PropertyFieldTypeSelect, attrs: StringInterface{PropertyFieldAttrChangePolicy: PropertyFieldChangePolicyAny}},
		{
			name:      "never is kept on any type",
			fieldType: PropertyFieldTypeText,
			attrs:     StringInterface{PropertyFieldAttrChangePolicy: PropertyFieldChangePolicyNever},
			want:      PropertyFieldChangePolicyNever,
			wantKey:   true,
		},
		{
			name:      "raise_only is kept on a rank field",
			fieldType: PropertyFieldTypeRank,
			attrs:     StringInterface{PropertyFieldAttrChangePolicy: " raise_only "},
			want:      PropertyFieldChangePolicyRaiseOnly,
			wantKey:   true,
		},
		{
			name:      "raise_only is stripped off a select field, which has no ranks to compare",
			fieldType: PropertyFieldTypeSelect,
			attrs:     StringInterface{PropertyFieldAttrChangePolicy: PropertyFieldChangePolicyRaiseOnly},
		},
		{
			name:      "unknown policy is rejected",
			fieldType: PropertyFieldTypeRank,
			attrs:     StringInterface{PropertyFieldAttrChangePolicy: "frozen"},
			wantError: `invalid change_policy "frozen"`,
		},
		{
			name:      "non-string is rejected",
			fieldType: PropertyFieldTypeRank,
			attrs:     StringInterface{PropertyFieldAttrChangePolicy: true},
			wantError: "change_policy must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{Type: tt.fieldType, Attrs: tt.attrs}
			err := SanitizeAndValidatePropertyFieldChangePolicy(field)
			if tt.wantError != "" {
				require.ErrorContains(t, err, tt.wantError)
				return
			}

			require.NoError(t, err)
			if field.Attrs == nil {
				return
			}
			actual, ok := field.Attrs[PropertyFieldAttrChangePolicy]
			require.Equal(t, tt.wantKey, ok)
			if tt.wantKey {
				require.Equal(t, tt.want, actual)
			}
		})
	}
}

// editable predates change_policy, so a field carrying only editable=false must
// still read as locked.
func TestGetPropertyFieldChangePolicy(t *testing.T) {
	require.Equal(t, PropertyFieldChangePolicyAny, GetPropertyFieldChangePolicy(&PropertyField{}))
	require.Equal(t, PropertyFieldChangePolicyAny, GetPropertyFieldChangePolicy(&PropertyField{Attrs: StringInterface{PropertyFieldAttrEditable: true}}))
	require.Equal(t, PropertyFieldChangePolicyNever, GetPropertyFieldChangePolicy(&PropertyField{Attrs: StringInterface{PropertyFieldAttrEditable: false}}))
	require.Equal(t, PropertyFieldChangePolicyRaiseOnly, GetPropertyFieldChangePolicy(&PropertyField{Attrs: StringInterface{
		PropertyFieldAttrChangePolicy: PropertyFieldChangePolicyRaiseOnly,
	}}))

	// change_policy wins: it is the more expressive key, and the pair is only ever
	// written together for "never".
	require.Equal(t, PropertyFieldChangePolicyNever, GetPropertyFieldChangePolicy(&PropertyField{Attrs: StringInterface{
		PropertyFieldAttrChangePolicy: PropertyFieldChangePolicyNever,
		PropertyFieldAttrEditable:     false,
	}}))
}

func TestSanitizeAndValidatePropertyFieldActions(t *testing.T) {
	tests := []struct {
		name      string
		attrs     StringInterface
		want      []any
		wantKey   bool
		wantError string
	}{
		{name: "nil attrs", attrs: nil},
		{name: "no actions key", attrs: StringInterface{"other": "value"}},
		{name: "nil actions", attrs: StringInterface{PropertyFieldAttrActions: nil}},
		{name: "empty typed actions", attrs: StringInterface{PropertyFieldAttrActions: []string{}}},
		{name: "empty decoded actions", attrs: StringInterface{PropertyFieldAttrActions: []any{}}},
		{
			name:    "classification banner actions",
			attrs:   StringInterface{PropertyFieldAttrActions: []any{PropertyFieldActionDisplayBannerTop, PropertyFieldActionDisplayBannerBottom}},
			want:    []any{PropertyFieldActionDisplayBannerTop, PropertyFieldActionDisplayBannerBottom},
			wantKey: true,
		},
		{
			name:    "smart label actions are trimmed and canonicalized",
			attrs:   StringInterface{PropertyFieldAttrActions: []string{" " + PropertyFieldActionDisplayLabelHeader + " ", PropertyFieldActionDisplayLabelInfo}},
			want:    []any{PropertyFieldActionDisplayLabelHeader, PropertyFieldActionDisplayLabelInfo},
			wantKey: true,
		},
		{name: "non-array", attrs: StringInterface{PropertyFieldAttrActions: "display_label_header"}, wantError: "actions must be an array"},
		{name: "non-string element", attrs: StringInterface{PropertyFieldAttrActions: []any{42}}, wantError: "actions[0] must be a string"},
		{name: "empty action", attrs: StringInterface{PropertyFieldAttrActions: []any{" "}}, wantError: "actions must not contain empty strings"},
		{name: "unknown action", attrs: StringInterface{PropertyFieldAttrActions: []any{"unknown"}}, wantError: "unknown action"},
		{
			name:      "duplicate action",
			attrs:     StringInterface{PropertyFieldAttrActions: []any{PropertyFieldActionDisplayLabelHeader, PropertyFieldActionDisplayLabelHeader}},
			wantError: "duplicate action",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{Attrs: tt.attrs}
			err := SanitizeAndValidatePropertyFieldActions(field)
			if tt.wantError != "" {
				require.ErrorContains(t, err, tt.wantError)
				return
			}

			require.NoError(t, err)
			if field.Attrs == nil {
				return
			}
			actual, ok := field.Attrs[PropertyFieldAttrActions]
			require.Equal(t, tt.wantKey, ok)
			if tt.wantKey && tt.want != nil {
				require.Equal(t, tt.want, actual)
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
		{name: "valid url with path", valueType: "url", value: `"https://example.com/path?q=1"`},
		{name: "invalid url - plain string", valueType: "url", value: `"not a url"`, wantErr: true},
		{name: "invalid url - relative path", valueType: "url", value: `"/relative/path"`, wantErr: true},
		{name: "invalid url - missing host", valueType: "url", value: `"http://"`, wantErr: true},
		{name: "invalid url - missing scheme", valueType: "url", value: `"example.com"`, wantErr: true},
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

	// The sync caller IDs must not be valid plugin IDs, otherwise an
	// admin-installed plugin could set its manifest ID to one of these
	// values and bypass the sync-lock check for LDAP/SAML-managed fields.
	require.False(t, IsValidPluginId(CallerIDLDAPSync),
		"CallerIDLDAPSync must not be a valid plugin ID")
	require.False(t, IsValidPluginId(CallerIDSAMLSync),
		"CallerIDSAMLSync must not be a valid plugin ID")
}
