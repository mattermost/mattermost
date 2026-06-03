// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PluginChannelPermission represents a permission grant
// allowing a specific plugin to access a specific channel.
type PluginChannelPermission struct {
    PluginID   string `json:"plugin_id"`
    ChannelID  string `json:"channel_id"`
    Permission string `json:"permission"`
    GrantedBy  string `json:"granted_by"`
    GrantedAt  int64  `json:"granted_at"`
}

// Plugin permission types for channel-scoped access control.
const (
    PluginPermissionReadChannel  = "read_channel"
    PluginPermissionCreatePost   = "create_post"
)