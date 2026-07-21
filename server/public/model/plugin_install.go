// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	PluginInstallConflictVersionDirectionUpgrade   = "upgrade"
	PluginInstallConflictVersionDirectionDowngrade = "downgrade"
	PluginInstallConflictVersionDirectionSame      = "same"
	PluginInstallConflictVersionDirectionUnknown   = "unknown"
)

type PluginInstallConflict struct {
	ExistingManifest *Manifest `json:"existing_manifest"`
	UploadedManifest *Manifest `json:"uploaded_manifest"`
	VersionDirection string    `json:"version_direction"`
}
