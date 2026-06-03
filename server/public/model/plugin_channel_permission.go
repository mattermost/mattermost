// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

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
	PluginPermissionReadChannel = "read_channel"
	PluginPermissionCreatePost  = "create_post"
)

// IsValid validates the PluginChannelPermission fields.
func (p *PluginChannelPermission) IsValid() *AppError {
	if p.PluginID == "" {
		return NewAppError("PluginChannelPermission.IsValid", "model.plugin_channel_permission.plugin_id.app_error", nil, "", http.StatusBadRequest)
	}
	if p.ChannelID == "" || !IsValidId(p.ChannelID) {
		return NewAppError("PluginChannelPermission.IsValid", "model.plugin_channel_permission.channel_id.app_error", nil, "", http.StatusBadRequest)
	}
	if p.Permission != PluginPermissionReadChannel && p.Permission != PluginPermissionCreatePost {
		return NewAppError("PluginChannelPermission.IsValid", "model.plugin_channel_permission.permission.app_error", nil, "", http.StatusBadRequest)
	}
	if p.GrantedBy == "" || !IsValidId(p.GrantedBy) {
		return NewAppError("PluginChannelPermission.IsValid", "model.plugin_channel_permission.granted_by.app_error", nil, "", http.StatusBadRequest)
	}
	if p.GrantedAt == 0 {
		return NewAppError("PluginChannelPermission.IsValid", "model.plugin_channel_permission.granted_at.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}