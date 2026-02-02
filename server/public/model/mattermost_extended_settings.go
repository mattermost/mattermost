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

// SetDefaults applies the default settings to the struct.
func (s *MattermostExtendedSettings) SetDefaults() {
	s.Posts.SetDefaults()
	s.Channels.SetDefaults()
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