// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// MattermostExtendedSettings defines configuration settings for Mattermost Extended features.
type MattermostExtendedSettings struct {
	// EnableEncryption enables end-to-end encryption for messages.
	EnableEncryption *bool `access:"mattermost_extended"`
	// AdminModeOnly restricts encryption to system administrators only.
	AdminModeOnly *bool `access:"mattermost_extended"`
}

// SetDefaults applies the default settings to the struct.
func (s *MattermostExtendedSettings) SetDefaults() {
	if s.EnableEncryption == nil {
		s.EnableEncryption = NewPointer(false)
	}

	if s.AdminModeOnly == nil {
		s.AdminModeOnly = NewPointer(false)
	}
}
