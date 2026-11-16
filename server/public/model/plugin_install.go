// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "github.com/Masterminds/semver/v3"

const (
	PluginInstallConflictVersionDirectionUpgrade   = "upgrade"
	PluginInstallConflictVersionDirectionDowngrade = "downgrade"
	PluginInstallConflictVersionDirectionSame      = "same"
	PluginInstallConflictVersionDirectionUnknown   = "unknown"
)

// Keys set in AppError.Props when a plugin upload conflicts with an already installed plugin. The
// plugin upload confirmation dialog reads them to describe the version change before overwriting.
const (
	PluginInstallConflictPropPluginID         = "plugin_id"
	PluginInstallConflictPropPluginName       = "plugin_name"
	PluginInstallConflictPropHomepageURL      = "homepage_url"
	PluginInstallConflictPropExistingVersion  = "existing_version"
	PluginInstallConflictPropUploadedVersion  = "uploaded_version"
	PluginInstallConflictPropVersionDirection = "version_direction"
)

// PluginInstallConflictVersionDirection compares the versions of an already installed plugin
// manifest and an uploaded plugin manifest with the same id, returning one of the
// PluginInstallConflictVersionDirection* constants.
func PluginInstallConflictVersionDirection(existingManifest, uploadedManifest *Manifest) string {
	if existingManifest == nil || uploadedManifest == nil {
		return PluginInstallConflictVersionDirectionUnknown
	}

	existing, err := semver.StrictNewVersion(existingManifest.Version)
	if err != nil {
		return PluginInstallConflictVersionDirectionUnknown
	}

	uploaded, err := semver.StrictNewVersion(uploadedManifest.Version)
	if err != nil {
		return PluginInstallConflictVersionDirectionUnknown
	}

	if uploaded.Equal(existing) {
		return PluginInstallConflictVersionDirectionSame
	}
	if uploaded.GreaterThan(existing) {
		return PluginInstallConflictVersionDirectionUpgrade
	}

	return PluginInstallConflictVersionDirectionDowngrade
}
