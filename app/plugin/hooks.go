// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

// All implementations should be safe for concurrent use.
type Hooks interface {
	// Invoked when configuration changes may have been made
	OnConfigurationChange()
}
