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

	// Enable the remote cluster service for shared channels.
	EnableRemoteClusterService bool

	// Enable DMs and GMs for shared channels.
	EnableSharedChannelsDMs bool

	// Enable plugins in shared channels.
	EnableSharedChannelsPlugins bool

	// Enable synchronization of channel members in shared channels
	EnableSharedChannelsMemberSync bool

	// Enable syncing all users for remote clusters in shared channels
	EnableSyncAllUsersForRemoteCluster bool

	// AppsEnabled toggles the Apps framework functionalities both in server and client side
	AppsEnabled bool

	CustomChannelIcons bool

	// Enable displaying followed threads under their parent channels in the sidebar
	ThreadsInSidebar bool

	// Enable custom names for threads (users can rename threads)
	CustomThreadNames bool

	PermalinkPreviews bool

	NormalizeLdapDNs bool

	// Enable WYSIWYG text editor
	WysiwygEditor bool

	OnboardingTourTips bool

	DeprecateCloudFree bool

	EnableExportDirectDownload bool

	MoveThreadsEnabled bool

	StreamlinedMarketplace bool

	CloudIPFiltering bool
	ConsumePostHook  bool

	CloudAnnualRenewals    bool
	CloudDedicatedExportUI bool

	ChannelBookmarks bool

	WebSocketEventScope bool

	NotificationMonitoring bool

	ExperimentalAuditSettingsSystemConsoleUI bool

	CustomProfileAttributes bool

	AttributeBasedAccessControl bool

	ContentFlagging bool

	// Enable AppsForm for Interactive Dialogs instead of legacy dialog implementation
	InteractiveDialogAppsForm bool

	EnableMattermostEntry bool

	// Enable mobile SSO SAML code-exchange flow (no tokens in deep links)
	MobileSSOCodeExchange bool

	// FEATURE_FLAG_REMOVAL: AutoTranslation - Remove this when MVP is to be released
	// Enable auto-translation feature for messages in channels
	AutoTranslation bool

	// Enable burn-on-read messages that automatically delete after viewing
	BurnOnRead bool

	// FEATURE_FLAG_REMOVAL: EnableAIPluginBridge
	EnableAIPluginBridge bool

	// Enable end-to-end encryption for messages
	Encryption bool

	// Enable Guilded-style sounds for message/reaction interactions
	GuildedSounds bool

	// Enable Discord-style replies with inline quote previews
	DiscordReplies bool

	// Enable error log dashboard for system admins
	ErrorLogDashboard bool

	// Apply dark mode to the System Console using CSS filters
	SystemConsoleDarkMode bool

	// Hide enterprise-only features from System Console since they can't be used without enterprise license
	SystemConsoleHideEnterprise bool

	// Add icons in front of every section in System Console
	SystemConsoleIcons bool

	// Suppress enterprise upgrade API calls that spam 403 errors on Team Edition
	SuppressEnterpriseUpgradeChecks bool

	// Display multiple images at full size instead of thumbnails
	ImageMulti bool

	// Enforce max height/width on images
	ImageSmaller bool

	// Show captions below images (from title attribute in markdown)
	ImageCaptions bool

	// Inline video players for video attachments
	VideoEmbed bool

	// Detect video URLs in text and embed players
	VideoLinkEmbed bool

	// Enable accurate status tracking with heartbeat-based LastActivityAt updates
	AccurateStatuses bool

	// Prevent users from being/staying offline when they show activity
	NoOffline bool

	// Discord-style YouTube embeds (card with red bar, no collapse button)
	EmbedYoutube bool

	// Reorganize user settings into more intuitive categories with icons
	SettingsResorted bool

	// Refactor user preferences to use shared definitions (required for PreferenceOverridesDashboard)
	PreferencesRevamp bool

	// Enable admin preference overrides dashboard (requires PreferencesRevamp)
	PreferenceOverridesDashboard bool

	// Hide the "Update your status" button that appears on posts when user has no custom status
	HideUpdateStatusButton bool

	// Enable Guilded-style chat layout with enhanced team sidebar, DM page, and persistent RHS
	GuildedChatLayout bool

	// Enable spoiler tags for text (||spoiler||) and blur overlays for images/videos
	Spoilers bool

	// Enable smooth scrolling with CSS overflow-anchor for buttery smooth post list scrolling
	SmoothScrolling bool
}

// featureFlagDefaults defines the default value for each boolean feature flag.
// Flags not listed here default to false.
var featureFlagDefaults = map[string]bool{
	// Flags that default to TRUE
	"EnableSharedChannelsPlugins":              true,
	"OnboardingTourTips":                       true,
	"StreamlinedMarketplace":                   true,
	"ChannelBookmarks":                         true,
	"WebSocketEventScope":                      true,
	"NotificationMonitoring":                   true,
	"ExperimentalAuditSettingsSystemConsoleUI": true,
	"CustomProfileAttributes":                  true,
	"AttributeBasedAccessControl":              true,
	"ContentFlagging":                          true,
	"InteractiveDialogAppsForm":                true,
	"EnableMattermostEntry":                    true,
	"MobileSSOCodeExchange":                    true,
	"BurnOnRead":                               true,
	"SuppressEnterpriseUpgradeChecks":          true,
	// All other boolean flags default to false (not listed)
}

// SetDefaults is intentionally a no-op for FeatureFlags.
// Feature flag defaults are applied only when the config is first created (via NewFeatureFlags).
// This allows user-set values (via API or config file) to persist without being overwritten.
// Environment variables (MM_FEATUREFLAGS_*) are applied after config loading and take precedence.
func (f *FeatureFlags) SetDefaults() {
	// Only set TestFeature if empty (it's a string, not bool)
	if f.TestFeature == "" {
		f.TestFeature = "off"
	}
	// Boolean flags are NOT reset here - their defaults are set in NewFeatureFlags()
}

// NewFeatureFlags creates a FeatureFlags struct with all default values applied.
// This should be used when creating a fresh config.
func NewFeatureFlags() *FeatureFlags {
	f := &FeatureFlags{}
	f.TestFeature = "off"

	// Apply defaults using reflection
	refStructVal := reflect.ValueOf(f).Elem()
	refStructType := reflect.TypeFor[FeatureFlags]()

	for i := 0; i < refStructVal.NumField(); i++ {
		field := refStructVal.Field(i)
		fieldType := refStructType.Field(i)

		if fieldType.Type.Kind() == reflect.Bool {
			if defaultVal, ok := featureFlagDefaults[fieldType.Name]; ok {
				field.SetBool(defaultVal)
			}
			// If not in map, default is already false (zero value)
		}
	}

	return f
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
