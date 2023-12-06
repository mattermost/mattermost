// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// OnInstallEvent is sent to the plugin when it gets installed.
type OnInstallEvent struct {
	UserId string // The user who installed the plugin
}
