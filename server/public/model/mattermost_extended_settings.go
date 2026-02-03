// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// MattermostExtendedSettings defines configuration settings for Mattermost Extended features.
// This includes "tweaks" - small behavioral changes that don't need feature flags.
type MattermostExtendedSettings struct {
	// Posts section - tweaks related to posts/messages
	Posts MattermostExtendedPostsSettings

	// Channels section - tweaks related to channels
	Channels MattermostExtendedChannelsSettings

	// Media section - settings for media display features
	Media MattermostExtendedMediaSettings

	// Statuses section - settings for accurate status tracking
	Statuses MattermostExtendedStatusesSettings
}

// MattermostExtendedPostsSettings contains tweaks for posts/messages behavior.
type MattermostExtendedPostsSettings struct {
	// When enabled, deleted messages immediately disappear for all users
	// instead of showing a "(message deleted)" placeholder
	HideDeletedMessagePlaceholder *bool
}

// MattermostExtendedChannelsSettings contains tweaks for channel behavior.
type MattermostExtendedChannelsSettings struct {
	// When enabled, adds a "Channel Settings" menu item to the sidebar channel
	// right-click menu for quick access to channel settings
	SidebarChannelSettings *bool
}

// MattermostExtendedMediaSettings contains settings for media display features.
type MattermostExtendedMediaSettings struct {
	// Maximum image height in pixels (used when ImageSmaller feature flag is enabled)
	MaxImageHeight *int

	// Maximum image width in pixels (used when ImageSmaller feature flag is enabled)
	MaxImageWidth *int

	// Caption font size in pixels (used when ImageCaptions feature flag is enabled)
	CaptionFontSize *int

	// Maximum video height in pixels for embedded video players
	MaxVideoHeight *int

	// Maximum video width in pixels for embedded video players
	MaxVideoWidth *int
}

// MattermostExtendedStatusesSettings contains settings for accurate status tracking.
type MattermostExtendedStatusesSettings struct {
	// Minutes of inactivity before setting user to Away (default: 5)
	InactivityTimeoutMinutes *int

	// How often the client sends heartbeat messages in seconds (default: 30)
	HeartbeatIntervalSeconds *int

	// Enable status change logging for the dashboard (default: false)
	EnableStatusLogs *bool

	// Maximum number of status logs to keep in memory (default: 500)
	MaxStatusLogs *int
}

// SetDefaults applies the default settings to the struct.
func (s *MattermostExtendedSettings) SetDefaults() {
	s.Posts.SetDefaults()
	s.Channels.SetDefaults()
	s.Media.SetDefaults()
	s.Statuses.SetDefaults()
}

// SetDefaults for Posts settings
func (s *MattermostExtendedPostsSettings) SetDefaults() {
	if s.HideDeletedMessagePlaceholder == nil {
		s.HideDeletedMessagePlaceholder = NewPointer(false)
	}
}

// SetDefaults for Channels settings
func (s *MattermostExtendedChannelsSettings) SetDefaults() {
	if s.SidebarChannelSettings == nil {
		s.SidebarChannelSettings = NewPointer(false)
	}
}

// SetDefaults for Media settings
func (s *MattermostExtendedMediaSettings) SetDefaults() {
	if s.MaxImageHeight == nil {
		s.MaxImageHeight = NewPointer(400)
	}
	if s.MaxImageWidth == nil {
		s.MaxImageWidth = NewPointer(500)
	}
	if s.CaptionFontSize == nil {
		s.CaptionFontSize = NewPointer(12)
	}
	if s.MaxVideoHeight == nil {
		s.MaxVideoHeight = NewPointer(350)
	}
	if s.MaxVideoWidth == nil {
		s.MaxVideoWidth = NewPointer(480)
	}
}

// SetDefaults for Statuses settings
func (s *MattermostExtendedStatusesSettings) SetDefaults() {
	if s.InactivityTimeoutMinutes == nil {
		s.InactivityTimeoutMinutes = NewPointer(5)
	}
	if s.HeartbeatIntervalSeconds == nil {
		s.HeartbeatIntervalSeconds = NewPointer(30)
	}
	if s.EnableStatusLogs == nil {
		s.EnableStatusLogs = NewPointer(false)
	}
	if s.MaxStatusLogs == nil {
		s.MaxStatusLogs = NewPointer(500)
	}
}