// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"
)

const SessionAttributesPropertyGroupName = "session_attributes"

const (
	SessionAttributePlatformDesktop = "desktop"
	SessionAttributePlatformMobile  = "mobile"
	SessionAttributePlatformBrowser = "browser"
)

const (
	SessionAttributesPropertyFieldClientIPAddress         = "client_ip_address"
	SessionAttributesPropertyFieldNetworkInterfaceType    = "network_interface_type"
	SessionAttributesPropertyFieldVPNActive               = "vpn_active"
	SessionAttributesPropertyFieldSSID                    = "ssid"
	SessionAttributesPropertyFieldTLSDDeviceID            = "tls_device_id"
	SessionAttributesPropertyFieldClientDeviceID          = "client_device_id"
	SessionAttributesPropertyFieldMDMEnrolled             = "mdm_enrolled"
	SessionAttributesPropertyFieldHardwareID              = "hardware_id"
	SessionAttributesPropertyFieldOSPlatform              = "os_platform"
	SessionAttributesPropertyFieldOSVersion               = "os_version"
	SessionAttributesPropertyFieldClientVersion           = "client_version"
	SessionAttributesPropertyFieldJailbreakDetected       = "jailbreak_detected"
	SessionAttributesPropertyFieldServerFQDN              = "server_fqdn"
	SessionAttributesPropertyFieldClientFQDN              = "client_fqdn"
	SessionAttributesPropertyFieldUserAgentPlatform       = "user_agent_platform"
	SessionAttributesPropertyFieldUserAgentOS             = "user_agent_os"
	SessionAttributesPropertyFieldUserAgentBrowserName    = "user_agent_browser_name"
	SessionAttributesPropertyFieldUserAgentBrowserVersion = "user_agent_browser_version"
	SessionAttributesPropertyFieldIPAddress               = "ip_address"
)

const (
	SessionAttributesDisplayNameClientIPAddress         = "Client IP address"
	SessionAttributesDisplayNameNetworkInterfaceType    = "Network interface type"
	SessionAttributesDisplayNameVPNActive               = "VPN active"
	SessionAttributesDisplayNameSSID                    = "SSID"
	SessionAttributesDisplayNameTLSDDeviceID            = "TLS device ID"
	SessionAttributesDisplayNameClientDeviceID          = "Device ID"
	SessionAttributesDisplayNameMDMEnrolled             = "MDM enrolled"
	SessionAttributesDisplayNameHardwareID              = "Hardware ID"
	SessionAttributesDisplayNameOSPlatform              = "OS platform"
	SessionAttributesDisplayNameOSVersion               = "OS version"
	SessionAttributesDisplayNameClientVersion           = "Client version"
	SessionAttributesDisplayNameJailbreakDetected       = "Jailbreak detected"
	SessionAttributesDisplayNameServerFQDN              = "Server FQDN"
	SessionAttributesDisplayNameClientFQDN              = "Client FQDN"
	SessionAttributesDisplayNameUserAgentPlatform       = "User agent platform"
	SessionAttributesDisplayNameUserAgentOS             = "User agent OS"
	SessionAttributesDisplayNameUserAgentBrowserName    = "User agent browser name"
	SessionAttributesDisplayNameUserAgentBrowserVersion = "User agent browser version"
	SessionAttributesDisplayNameIPAddress               = "IP address"
)

const (
	SAAttrEnabled            = "enabled"
	SAAttrPlatforms          = "platforms"
	SAAttrTTLSeconds         = "ttl_seconds"
	SAAttrGracePeriodSeconds = "grace_period_seconds"
	SAAttrDisplayName        = "display_name"
)

const (
	SessionAttributeDefaultTTLNetworkIdentity = 15
	SessionAttributeDefaultTTLPosture         = 60
	SessionAttributeDefaultTTLIdentity        = 300
)

const (
	SessionAttributeDefaultGraceNetworkIdentity = 15
	SessionAttributeDefaultGracePosture         = 60
	SessionAttributeDefaultGraceIdentity        = 300
)

const (
	SessionAttributeHeaderClientAttributes = "X-MM-Session-Attributes"
	SessionAttributeHeaderProxyDeviceID    = "X-Mattermost-Session-Attribute-Device-Id"
)

var SessionAttributesRequestDerivedFieldNames = map[string]struct{}{
	SessionAttributesPropertyFieldUserAgentPlatform:       {},
	SessionAttributesPropertyFieldUserAgentOS:             {},
	SessionAttributesPropertyFieldUserAgentBrowserName:    {},
	SessionAttributesPropertyFieldUserAgentBrowserVersion: {},
	SessionAttributesPropertyFieldIPAddress:               {},
}

var SessionAttributesDeviceIDFieldNames = map[string]struct{}{
	SessionAttributesPropertyFieldTLSDDeviceID:   {},
	SessionAttributesPropertyFieldClientDeviceID: {},
	SessionAttributesPropertyFieldHardwareID:     {},
}

type SessionAttributesClusterPayload struct {
	SessionID string         `json:"session_id"`
	Attrs     map[string]any `json:"attrs"`
	Timestamp int64          `json:"timestamp"`
}

type SAField struct {
	PropertyField
	Attrs SAAttrs `json:"attrs"`
}

type SAAttrs struct {
	Enabled            bool     `json:"enabled"`
	Platforms          []string `json:"platforms"`
	TTLSeconds         int      `json:"ttl_seconds"`
	GracePeriodSeconds int      `json:"grace_period_seconds"`
	DisplayName        string   `json:"display_name,omitempty"`
}

type SessionAttributeManifestEntry struct {
	Name               string   `json:"name"`
	Type               string   `json:"type"`
	TTLSeconds         int      `json:"ttl_seconds"`
	GracePeriodSeconds int      `json:"grace_period_seconds"`
	Platforms          []string `json:"platforms"`
	DisplayName        string   `json:"display_name,omitempty"`
}

func SAFieldFromPropertyField(field *PropertyField) (*SAField, error) {
	if field == nil {
		return nil, fmt.Errorf("property field is nil")
	}

	sa := &SAField{PropertyField: *field}
	if len(field.Attrs) == 0 {
		return sa, nil
	}

	// The only way we can convert the attrs to SAAttrs is to marshal and unmarshal.
	attrsJSON, err := json.Marshal(field.Attrs)
	if err != nil {
		return nil, fmt.Errorf("marshal session attribute field attrs: %w", err)
	}
	if err := json.Unmarshal(attrsJSON, &sa.Attrs); err != nil {
		return nil, fmt.Errorf("unmarshal session attribute field attrs: %w", err)
	}
	return sa, nil
}

func (f *SAField) EnabledForPlatform(platform string) bool {
	if f == nil || !f.Attrs.Enabled {
		return false
	}
	return slices.Contains(f.Attrs.Platforms, platform)
}

// IsValidSessionAttributeValue checks an incoming session attribute value against the field schema.
func IsValidSessionAttributeValue(field *PropertyField, value any) bool {
	if field == nil || value == nil {
		return false
	}

	switch field.Type {
	case PropertyFieldTypeText:
		str, ok := value.(string)
		if !ok {
			return false
		}
		if str == "" {
			return false
		}
		return true
	case PropertyFieldTypeSelect:
		str, ok := value.(string)
		if !ok || str == "" {
			return false
		}
		rawOptions := field.GetAttr(PropertyFieldAttributeOptions)
		if rawOptions == nil {
			return false
		}
		options, err := NewPropertyOptionsFromFieldAttrs[*PluginPropertyOption](rawOptions)
		if err != nil {
			return false
		}
		for _, option := range options {
			if option.GetName() == str || option.GetID() == str {
				return true
			}
		}
		return false
	default:
		return false
	}
}

func sessionAttributeFieldAttrs(platforms []string, ttl, grace int) StringInterface {
	return StringInterface{
		SAAttrEnabled:            false,
		SAAttrPlatforms:          platforms,
		SAAttrTTLSeconds:         ttl,
		SAAttrGracePeriodSeconds: grace,
	}
}

func sessionAttributeField(groupID, name, displayName string, fieldType PropertyFieldType, platforms []string, ttl, grace int, extraAttrs StringInterface) *PropertyField {
	attrs := sessionAttributeFieldAttrs(platforms, ttl, grace)
	attrs[SAAttrDisplayName] = displayName
	maps.Copy(attrs, extraAttrs)
	return &PropertyField{
		GroupID:           groupID,
		Name:              name,
		Type:              fieldType,
		ObjectType:        PropertyFieldObjectTypeSession,
		TargetType:        string(PropertyFieldTargetLevelSystem),
		TargetID:          "",
		PermissionField:   NewPointer(PermissionLevelSysadmin),
		PermissionValues:  NewPointer(PermissionLevelSysadmin),
		PermissionOptions: NewPointer(PermissionLevelSysadmin),
		Attrs:             attrs,
	}
}

// SessionAttributeSystemFields returns the built-in session attribute schema fields.
func SessionAttributeSystemFields(groupID string) []*PropertyField {
	allPlatforms := []string{SessionAttributePlatformDesktop, SessionAttributePlatformMobile, SessionAttributePlatformBrowser}
	clientsOnly := []string{SessionAttributePlatformDesktop, SessionAttributePlatformMobile}
	desktopBrowser := []string{SessionAttributePlatformDesktop, SessionAttributePlatformBrowser}
	desktopOnly := []string{SessionAttributePlatformDesktop}
	mobileOnly := []string{SessionAttributePlatformMobile}

	boolSelectOptions := StringInterface{
		PropertyFieldAttributeOptions: []map[string]string{
			{"name": "true"},
			{"name": "false"},
		},
	}

	return []*PropertyField{
		sessionAttributeField(groupID, SessionAttributesPropertyFieldIPAddress, SessionAttributesDisplayNameIPAddress, PropertyFieldTypeText, allPlatforms, SessionAttributeDefaultTTLNetworkIdentity, SessionAttributeDefaultGraceNetworkIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldClientIPAddress, SessionAttributesDisplayNameClientIPAddress, PropertyFieldTypeText, clientsOnly, SessionAttributeDefaultTTLNetworkIdentity, SessionAttributeDefaultGraceNetworkIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldNetworkInterfaceType, SessionAttributesDisplayNameNetworkInterfaceType, PropertyFieldTypeSelect, clientsOnly, SessionAttributeDefaultTTLNetworkIdentity, SessionAttributeDefaultGraceNetworkIdentity, StringInterface{
			PropertyFieldAttributeOptions: []map[string]string{
				{"name": "wifi"},
				{"name": "ethernet"},
				{"name": "cellular"},
				{"name": "vpn"},
				{"name": "bluetooth"},
				{"name": "other"},
			},
		}),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldVPNActive, SessionAttributesDisplayNameVPNActive, PropertyFieldTypeSelect, clientsOnly, SessionAttributeDefaultTTLNetworkIdentity, SessionAttributeDefaultGraceNetworkIdentity, boolSelectOptions),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldSSID, SessionAttributesDisplayNameSSID, PropertyFieldTypeText, clientsOnly, SessionAttributeDefaultTTLNetworkIdentity, SessionAttributeDefaultGraceNetworkIdentity, nil),

		sessionAttributeField(groupID, SessionAttributesPropertyFieldMDMEnrolled, SessionAttributesDisplayNameMDMEnrolled, PropertyFieldTypeSelect, clientsOnly, SessionAttributeDefaultTTLPosture, SessionAttributeDefaultGracePosture, boolSelectOptions),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldJailbreakDetected, SessionAttributesDisplayNameJailbreakDetected, PropertyFieldTypeSelect, mobileOnly, SessionAttributeDefaultTTLPosture, SessionAttributeDefaultGracePosture, boolSelectOptions),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldOSPlatform, SessionAttributesDisplayNameOSPlatform, PropertyFieldTypeText, clientsOnly, SessionAttributeDefaultTTLPosture, SessionAttributeDefaultGracePosture, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldOSVersion, SessionAttributesDisplayNameOSVersion, PropertyFieldTypeText, clientsOnly, SessionAttributeDefaultTTLPosture, SessionAttributeDefaultGracePosture, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldClientVersion, SessionAttributesDisplayNameClientVersion, PropertyFieldTypeText, clientsOnly, SessionAttributeDefaultTTLPosture, SessionAttributeDefaultGracePosture, nil),

		sessionAttributeField(groupID, SessionAttributesPropertyFieldUserAgentPlatform, SessionAttributesDisplayNameUserAgentPlatform, PropertyFieldTypeText, allPlatforms, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldUserAgentOS, SessionAttributesDisplayNameUserAgentOS, PropertyFieldTypeText, allPlatforms, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldUserAgentBrowserName, SessionAttributesDisplayNameUserAgentBrowserName, PropertyFieldTypeText, allPlatforms, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldUserAgentBrowserVersion, SessionAttributesDisplayNameUserAgentBrowserVersion, PropertyFieldTypeText, allPlatforms, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldTLSDDeviceID, SessionAttributesDisplayNameTLSDDeviceID, PropertyFieldTypeText, desktopBrowser, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldClientDeviceID, SessionAttributesDisplayNameClientDeviceID, PropertyFieldTypeText, mobileOnly, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldHardwareID, SessionAttributesDisplayNameHardwareID, PropertyFieldTypeText, desktopOnly, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldServerFQDN, SessionAttributesDisplayNameServerFQDN, PropertyFieldTypeText, clientsOnly, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
		sessionAttributeField(groupID, SessionAttributesPropertyFieldClientFQDN, SessionAttributesDisplayNameClientFQDN, PropertyFieldTypeText, desktopOnly, SessionAttributeDefaultTTLIdentity, SessionAttributeDefaultGraceIdentity, nil),
	}
}
