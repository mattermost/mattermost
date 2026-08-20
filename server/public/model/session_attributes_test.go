// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSAFieldFromPropertyField(t *testing.T) {
	field := &PropertyField{
		Name:       SessionAttributesPropertyFieldVPNActive,
		Type:       PropertyFieldTypeText,
		ObjectType: PropertyFieldObjectTypeSession,
		Attrs: StringInterface{
			"enabled":              true,
			"platforms":            []string{SessionAttributePlatformDesktop, SessionAttributePlatformMobile},
			"ttl_seconds":          60,
			"grace_period_seconds": 15,
			"display_name":         "VPN Active",
		},
	}

	saField, err := SAFieldFromPropertyField(field)
	require.NoError(t, err)
	assert.True(t, saField.Attrs.Enabled)
	assert.Equal(t, []string{SessionAttributePlatformDesktop, SessionAttributePlatformMobile}, saField.Attrs.Platforms)
	assert.Equal(t, 60, saField.Attrs.TTLSeconds)
	assert.Equal(t, 15, saField.Attrs.GracePeriodSeconds)
	assert.Equal(t, "VPN Active", saField.Attrs.DisplayName)
}

func TestSessionAttributeSystemFieldsDisplayNames(t *testing.T) {
	fields := SessionAttributeSystemFields("group-id")
	require.NotEmpty(t, fields)

	displayNamesByName := make(map[string]string, len(fields))
	for _, field := range fields {
		saField, err := SAFieldFromPropertyField(field)
		require.NoError(t, err)
		require.NotEmpty(t, saField.Attrs.DisplayName, "field %q must have a display name", field.Name)
		displayNamesByName[field.Name] = saField.Attrs.DisplayName
	}

	expected := map[string]string{
		SessionAttributesPropertyFieldClientIPAddress:      SessionAttributesDisplayNameClientIPAddress,
		SessionAttributesPropertyFieldNetworkInterfaceType: SessionAttributesDisplayNameNetworkInterfaceType,
		SessionAttributesPropertyFieldVPNActive:            SessionAttributesDisplayNameVPNActive,
		SessionAttributesPropertyFieldSSID:                 SessionAttributesDisplayNameSSID,
		SessionAttributesPropertyFieldClientDeviceID:       SessionAttributesDisplayNameClientDeviceID,
		SessionAttributesPropertyFieldHardwareID:           SessionAttributesDisplayNameHardwareID,
		SessionAttributesPropertyFieldMDMEnrolled:          SessionAttributesDisplayNameMDMEnrolled,
		SessionAttributesPropertyFieldClientVersion:        SessionAttributesDisplayNameClientVersion,
		SessionAttributesPropertyFieldOSPlatform:           SessionAttributesDisplayNameOSPlatform,
		SessionAttributesPropertyFieldOSVersion:            SessionAttributesDisplayNameOSVersion,
		SessionAttributesPropertyFieldJailbreakDetected:    SessionAttributesDisplayNameJailbreakDetected,
	}
	for name, displayName := range expected {
		assert.Equal(t, displayName, displayNamesByName[name], "display name for %q", name)
	}
}

func TestSessionAttributeSystemFieldsOSPlatform(t *testing.T) {
	var field *PropertyField
	for _, f := range SessionAttributeSystemFields("group-id") {
		if f.Name == SessionAttributesPropertyFieldOSPlatform {
			field = f
			break
		}
	}
	require.NotNil(t, field)
	require.Equal(t, PropertyFieldTypeSelect, field.Type)

	options, err := NewPropertyOptionsFromFieldAttrs[*PluginPropertyOption](field.Attrs[PropertyFieldAttributeOptions])
	require.NoError(t, err)

	names := make([]string, 0, len(options))
	for _, option := range options {
		names = append(names, option.GetName())
	}
	assert.Equal(t, []string{"macos", "windows", "linux", "ios", "android"}, names)

	for _, name := range names {
		assert.True(t, IsValidSessionAttributeValue(field, name), "%q must be an accepted value", name)
	}
	assert.False(t, IsValidSessionAttributeValue(field, "darwin"))
}

func TestSessionAttributeSystemFieldsUserAgentPlatform(t *testing.T) {
	var field *PropertyField
	for _, f := range SessionAttributeSystemFields("group-id") {
		if f.Name == SessionAttributesPropertyFieldUserAgentPlatform {
			field = f
			break
		}
	}
	require.NotNil(t, field)
	require.Equal(t, PropertyFieldTypeSelect, field.Type)

	options, err := NewPropertyOptionsFromFieldAttrs[*PluginPropertyOption](field.Attrs[PropertyFieldAttributeOptions])
	require.NoError(t, err)

	names := make([]string, 0, len(options))
	for _, option := range options {
		names = append(names, option.GetName())
	}
	// TestPlatformNamesAreSelectableSessionAttributeValues (channels/app) keeps
	// this list in sync with the platform names the server derives from a user
	// agent, which model cannot import.
	assert.Equal(t, []string{"Windows", "Macintosh", "Linux", "Android", "iPad", "iPhone", "iPod", "BlackBerry", "Windows Phone", "Unknown"}, names)

	assert.True(t, IsValidSessionAttributeValue(field, "Android"))
	// Unlike os_platform, which spells its values in lower case.
	assert.False(t, IsValidSessionAttributeValue(field, "android"))
}

func TestSAFieldEnabledForPlatform(t *testing.T) {
	field := &PropertyField{
		Name: SessionAttributesPropertyFieldVPNActive,
		Type: PropertyFieldTypeText,
		Attrs: StringInterface{
			"enabled":   true,
			"platforms": []string{SessionAttributePlatformDesktop, SessionAttributePlatformMobile},
		},
	}

	saField, err := SAFieldFromPropertyField(field)
	require.NoError(t, err)
	assert.True(t, saField.EnabledForPlatform(SessionAttributePlatformDesktop))
	assert.True(t, saField.EnabledForPlatform(SessionAttributePlatformMobile))
	assert.False(t, saField.EnabledForPlatform(SessionAttributePlatformBrowser))

	field.Attrs["enabled"] = false
	disabled, err := SAFieldFromPropertyField(field)
	require.NoError(t, err)
	assert.False(t, disabled.EnabledForPlatform(SessionAttributePlatformDesktop))
}

func TestSessionAttributeSystemFieldsOperators(t *testing.T) {
	fields := SessionAttributeSystemFields("group-id")
	byName := make(map[string]*PropertyField, len(fields))
	for _, field := range fields {
		byName[field.Name] = field
	}

	baseStringOps := []string{"==", "!=", "in", "startsWith", "endsWith", "contains"}
	versionOps := append(slices.Clone(baseStringOps), sessionVersionOperators...)

	assertOperators := func(t *testing.T, field *PropertyField, expected []string) {
		t.Helper()
		require.NotNil(t, field)
		raw, ok := field.Attrs[NativeAttributeAttrOperators]
		require.True(t, ok, "field %q must declare operators", field.Name)
		ops, ok := raw.([]string)
		require.True(t, ok, "field %q operators must be []string", field.Name)
		assert.Equal(t, expected, ops)
	}

	assertOperators(t, byName[SessionAttributesPropertyFieldIPAddress], append(slices.Clone(baseStringOps), SessionOperatorInCIDR))
	assertOperators(t, byName[SessionAttributesPropertyFieldClientIPAddress], append(slices.Clone(baseStringOps), SessionOperatorInCIDR))
	assertOperators(t, byName[SessionAttributesPropertyFieldOSVersion], versionOps)
	assertOperators(t, byName[SessionAttributesPropertyFieldClientVersion], versionOps)
	assertOperators(t, byName[SessionAttributesPropertyFieldUserAgentBrowserVersion], versionOps)

	_, hasOperators := byName[SessionAttributesPropertyFieldSSID].Attrs[NativeAttributeAttrOperators]
	assert.False(t, hasOperators, "fields without specialized operators must not declare attrs.operators")
}

func TestIsValidSessionAttributeValue(t *testing.T) {
	textField := &PropertyField{
		Name: SessionAttributesPropertyFieldOSVersion,
		Type: PropertyFieldTypeText,
	}
	selectField := &PropertyField{
		Name: SessionAttributesPropertyFieldNetworkInterfaceType,
		Type: PropertyFieldTypeSelect,
		Attrs: StringInterface{
			PropertyFieldAttributeOptions: []map[string]string{
				{"name": "wifi"},
				{"name": "ethernet"},
			},
		},
	}
	boolField := &PropertyField{
		Name: SessionAttributesPropertyFieldVPNActive,
		Type: PropertyFieldTypeSelect,
		Attrs: StringInterface{
			PropertyFieldAttributeOptions: []map[string]string{
				{"name": "true"},
				{"name": "false"},
			},
		},
	}

	t.Run("text accepts string", func(t *testing.T) {
		assert.True(t, IsValidSessionAttributeValue(textField, "15.1"))
	})

	t.Run("text rejects non-string", func(t *testing.T) {
		assert.False(t, IsValidSessionAttributeValue(textField, 42))
	})

	t.Run("select accepts valid option", func(t *testing.T) {
		assert.True(t, IsValidSessionAttributeValue(selectField, "wifi"))
	})

	t.Run("select accepts valid option from db-shaped attrs", func(t *testing.T) {
		dbSelectField := &PropertyField{
			Name: SessionAttributesPropertyFieldNetworkInterfaceType,
			Type: PropertyFieldTypeSelect,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "wifi"},
					map[string]any{"name": "ethernet"},
				},
			},
		}
		assert.True(t, IsValidSessionAttributeValue(dbSelectField, "wifi"))
	})

	t.Run("select rejects invalid option", func(t *testing.T) {
		assert.False(t, IsValidSessionAttributeValue(selectField, "bluetooth"))
	})

	t.Run("select rejects empty string", func(t *testing.T) {
		assert.False(t, IsValidSessionAttributeValue(selectField, ""))
	})

	t.Run("bool select accepts true and false", func(t *testing.T) {
		assert.True(t, IsValidSessionAttributeValue(boolField, "true"))
		assert.True(t, IsValidSessionAttributeValue(boolField, "false"))
	})

	t.Run("bool select rejects non-option values", func(t *testing.T) {
		assert.False(t, IsValidSessionAttributeValue(boolField, true))
		assert.False(t, IsValidSessionAttributeValue(boolField, "yes"))
	})
}
