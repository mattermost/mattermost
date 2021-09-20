// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PluginEventData used to notify peers about plugin changes.
type PluginEventData struct {
	Id string `json:"id"`
}
