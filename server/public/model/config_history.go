// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ConfigHistoryEntry describes a configuration saved by a database-backed config store.
type ConfigHistoryEntry struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	Active   bool   `json:"active"`
	// Unreadable is true when the saved configuration can't be loaded, such as one that isn't
	// valid JSON.
	Unreadable bool `json:"unreadable"`
	// Changes lists the settings that differ from the configuration saved before this one.
	// It is nil when they aren't known: for the oldest saved configuration, for an unreadable
	// one, and for one saved right after an unreadable one.
	Changes []*ConfigChange `json:"changes"`
}

// ConfigChange describes a setting whose value differs between two configurations.
// Sensitive values are replaced with FakeSetting.
type ConfigChange struct {
	Path     string `json:"path"`
	OldValue any    `json:"old_value"`
	NewValue any    `json:"new_value"`
}
