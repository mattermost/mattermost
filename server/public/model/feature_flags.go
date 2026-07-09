// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"reflect"
	"strconv"
)

type FeatureFlags struct {
	// Exists only for unit and manual testing.
	// When set to a value, will be returned by the ping endpoint.
	TestFeature string
	// Exists only for testing bool functionality. Boolean feature flags interpret "on" or "true" as true and
	// all other values as false.
	TestBoolFeature bool

	// Enable DMs and GMs for shared channels.
	EnableSharedChannelsDMs bool

	// Enable syncing all users for remote clusters in shared channels
	EnableSyncAllUsersForRemoteCluster bool

	// AppsEnabled toggles the Apps framework functionalities both in server and client side
	AppsEnabled bool

	NormalizeLdapDNs bool

	// Enable WYSIWYG text editor
	WysiwygEditor bool

	OnboardingTourTips bool

	EnableExportDirectDownload bool

	MoveThreadsEnabled bool

	CloudDedicatedExportUI bool

	NotificationMonitoring bool

	ExperimentalAuditSettingsSystemConsoleUI bool

	CustomProfileAttributes bool

	AttributeBasedAccessControl bool

	// Mask non-held attribute values in the policy editor for delegated admins.
	// Requires AttributeBasedAccessControl.
	AttributeValueMasking bool

	// Enable permission policies (file upload/download ABAC policies).
	// Requires AttributeBasedAccessControl to also be enabled.
	//
	// This is the umbrella flag: when off, both ChannelPermissionPolicies
	// and PolicySimulation are also off regardless of their individual
	// settings. Use the IsChannelPermissionPoliciesEnabled() and
	// IsPolicySimulationEnabled() helpers below rather than checking
	// PermissionPolicies + the sub-flag manually at every call site —
	// they encapsulate the dependency so a future renaming /
	// consolidation only has to update one place.
	PermissionPolicies bool

	// Enable permission-rule actions (upload_file_attachment,
	// download_file_attachment) on channel-scope policies — and, on the
	// frontend, the Channel Settings → Permissions Policy tab that lets
	// channel admins configure them. Requires PermissionPolicies. Read
	// via FeatureFlags.IsChannelPermissionPoliciesEnabled() so the
	// PermissionPolicies dependency is enforced at every call site.
	ChannelPermissionPolicies bool

	// Enable the "Simulate access" preview UX and its backing
	// /cel/simulate_users endpoint. Requires PermissionPolicies. Read
	// via FeatureFlags.IsPolicySimulationEnabled() so the
	// PermissionPolicies dependency is enforced at every call site.
	PolicySimulation bool

	ContentFlagging bool

	EnableMattermostEntry bool

	// DEPRECATED: Mobile SSO SAML code-exchange flow - disabled by default
	// This feature is deprecated and will be removed in a future release.
	// Mobile clients should use the direct SSO callback flow with srv parameter verification.
	MobileSSOCodeExchange bool

	// Enable the SHIFT+ESC combo to mark _all_ chats, messages, and channels as read
	EnableShiftEscapeToMarkAllRead bool

	// FEATURE_FLAG_REMOVAL: AutoTranslation - Remove this when MVP is to be released
	// Enable auto-translation feature for messages in channels
	AutoTranslation bool

	// Enable classification markings for banners at the system and channel level
	ClassificationMarkings bool

	// Enable burn-on-read messages that automatically delete after viewing
	BurnOnRead bool

	// FEATURE_FLAG_REMOVAL: EnableAIPluginBridge
	EnableAIPluginBridge bool

	// FEATURE_FLAG_REMOVAL: EnableAIRecaps - Remove this when GA is released
	EnableAIRecaps bool

	// FEATURE_FLAG_REMOVAL: IntegratedBoards - Remove this when GA is released
	// Enable the Integrated Boards feature within Mattermost channels
	IntegratedBoards bool

	// Enable LIKE-based CJK (Chinese, Japanese, Korean) search for PostgreSQL
	CJKSearch bool

	// Collect plugin metrics and serve them on the /metrics endpoint
	AggregatePluginMetrics bool

	// ManagedChannelCategories enables server-side managed sidebar category enforcement (Enterprise).
	ManagedChannelCategories bool

	// Enable collection of request-provided session attributes (user agent, IP address, etc.).
	SessionAttributes bool

	// FEATURE_FLAG_REMOVAL: DiscoverableChannels - Remove this when the feature is GA.
	// Gates the per-channel Discoverable toggle and the channel-join-request flow that lets
	// non-members find a private channel in Browse Channels and request to join it.
	DiscoverableChannels bool

	// Enable Mobile Ephemeral Mode for controlling data persistence on mobile devices
	MobileEphemeralMode bool

	// FEATURE_FLAG_REMOVAL: PropertyFieldRank - Remove this when the feature is GA.
	// Gates the "rank" custom profile attribute type: when off, the app layer
	// rejects creating a rank property field or converting an existing field to
	// rank, and the admin console hides the rank type option.
	PropertyFieldRank bool

	// Requires AttributeBasedAccessControl to also be enabled.
	TeamMembershipAccessControl bool

	// Enable the new mm_blocks Interactive Messages framework
	MmBlocksEnabled bool

	ChannelBookmarks bool
}

func (f *FeatureFlags) SetDefaults() {
	f.TestFeature = "off"
	f.TestBoolFeature = false
	f.EnableSharedChannelsDMs = false
	f.EnableSyncAllUsersForRemoteCluster = false
	f.AppsEnabled = false
	f.NormalizeLdapDNs = false
	f.WysiwygEditor = false
	f.OnboardingTourTips = true
	f.EnableExportDirectDownload = false
	f.MoveThreadsEnabled = false
	f.CloudDedicatedExportUI = false
	f.NotificationMonitoring = true
	f.ExperimentalAuditSettingsSystemConsoleUI = true
	f.CustomProfileAttributes = true
	f.AttributeBasedAccessControl = true
	f.AttributeValueMasking = true
	f.PermissionPolicies = true
	f.TeamMembershipAccessControl = false
	f.ChannelPermissionPolicies = true
	f.PolicySimulation = true
	f.ContentFlagging = true
	f.EnableMattermostEntry = true

	// DEPRECATED: Disabled by default - mobile clients use direct SSO callback flow
	f.MobileSSOCodeExchange = false
	f.EnableShiftEscapeToMarkAllRead = false

	f.AutoTranslation = true

	f.ClassificationMarkings = true

	f.BurnOnRead = true

	// FEATURE_FLAG_REMOVAL: EnableAIPluginBridge - Remove this default when MVP is to be released
	f.EnableAIPluginBridge = false

	f.EnableAIRecaps = false

	f.IntegratedBoards = false

	f.CJKSearch = true

	f.AggregatePluginMetrics = false

	f.ManagedChannelCategories = false

	f.SessionAttributes = false

	f.DiscoverableChannels = false

	f.MobileEphemeralMode = false

	f.PropertyFieldRank = true

	f.MmBlocksEnabled = true

	f.ChannelBookmarks = true
}

// IsChannelPermissionPoliciesEnabled reports whether channel-scope
// policies may carry permission-rule actions (file upload/download)
// and whether the Channel Settings → Permissions Policy tab should
// be exposed. Both the sub-flag AND the PermissionPolicies umbrella
// must be on — turning the umbrella off implicitly disables the
// sub-feature even if its own flag is on. Centralizing the
// dependency check here keeps every call site honest.
func (f *FeatureFlags) IsChannelPermissionPoliciesEnabled() bool {
	return f.PermissionPolicies && f.ChannelPermissionPolicies
}

// IsPolicySimulationEnabled reports whether the "Simulate access"
// preview UX and its backing /cel/simulate_users endpoint are
// available. Both the sub-flag AND the PermissionPolicies umbrella
// must be on — turning the umbrella off implicitly disables the
// sub-feature even if its own flag is on. Centralizing the
// dependency check here keeps every call site honest.
func (f *FeatureFlags) IsPolicySimulationEnabled() bool {
	return f.PermissionPolicies && f.PolicySimulation
}

// ToMap returns the feature flags as a map[string]string
// Supports boolean and string feature flags.
func (f *FeatureFlags) ToMap() map[string]string {
	refStructVal := reflect.ValueOf(*f)
	refStructType := reflect.TypeFor[FeatureFlags]()
	ret := make(map[string]string)
	for i := 0; i < refStructVal.NumField(); i++ {
		refFieldVal := refStructVal.Field(i)
		if !refFieldVal.IsValid() {
			continue
		}
		refFieldType := refStructType.Field(i)
		switch refFieldType.Type.Kind() {
		case reflect.Bool:
			ret[refFieldType.Name] = strconv.FormatBool(refFieldVal.Bool())
		default:
			ret[refFieldType.Name] = refFieldVal.String()
		}
	}

	return ret
}
