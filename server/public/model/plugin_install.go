// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	PluginInstallConflictVersionDirectionUpgrade   = "upgrade"
	PluginInstallConflictVersionDirectionDowngrade = "downgrade"
	PluginInstallConflictVersionDirectionSame      = "same"
	PluginInstallConflictVersionDirectionUnknown   = "unknown"
)

// PluginInstallConflict describes an attempt to install a plugin bundle whose id matches an already
// installed plugin. It is serialized into AppError.DetailedError and reaches API clients in
// production, so it must carry only the metadata the confirmation dialog renders: whole manifests
// also describe settings schemas and server executable paths.
type PluginInstallConflict struct {
	PluginID         string `json:"plugin_id"`
	PluginName       string `json:"plugin_name,omitempty"`
	HomepageURL      string `json:"homepage_url,omitempty"`
	ExistingVersion  string `json:"existing_version"`
	UploadedVersion  string `json:"uploaded_version"`
	VersionDirection string `json:"version_direction"`
}
