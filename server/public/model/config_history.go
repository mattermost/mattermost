// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ConfigHistoryEntry describes a configuration saved by a database-backed config store.
type ConfigHistoryEntry struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	Active   bool   `json:"active"`
	// Changes lists the settings that differ from the configuration saved before this one.
	// It is nil for the oldest saved configuration.
	Changes []*ConfigChange `json:"changes"`
}

// ConfigChange describes a setting whose value differs between two configurations.
// Sensitive values are replaced with FakeSetting.
type ConfigChange struct {
	Path     string `json:"path"`
	OldValue any    `json:"old_value"`
	NewValue any    `json:"new_value"`
}
