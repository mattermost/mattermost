// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"

	"github.com/blang/semver/v4"
)

type MetadataType string

const (
	CurrentMetadataVersion int          = 1
	ServerMetadata         MetadataType = "mattermost-support-package"
	PluginMetadata         MetadataType = "plugin-support-package"
)

type Metadata struct {
	// Required Fields
	Version       int          `json:"version"`
	Type          MetadataType `json:"type"`
	GeneratedAt   int64        `json:"generated_at"`
	ServerVersion string       `json:"server_version"`
	ServerID      string       `json:"server_id"`
	LicenseID     string       `json:"license_id"`
	CustomerID    string       `json:"customer_id"`
	// Optional Fields
	Extras map[string]any `json:"extras"`
}

func (md *Metadata) Validate() error {
	if md.Version < 1 {
		return fmt.Errorf("metadata version should be greater than 1")
	}

	if md.Type != ServerMetadata && md.Type != PluginMetadata {
		return fmt.Errorf("unrecognized metadata type: %s", md.Type)
	}

	if _, err := semver.ParseTolerant(md.ServerVersion); err != nil {
		return fmt.Errorf("could not parse server version: %w", err)
	}

	if !IsValidId(md.ServerID) {
		return fmt.Errorf("server id is not a valid id %q", md.ServerID)
	}

	if !IsValidId(md.LicenseID) && md.LicenseID != "" {
		return fmt.Errorf("license id is not a valid id %q", md.LicenseID)
	}

	if !IsValidId(md.CustomerID) && md.CustomerID != "" {
		return fmt.Errorf("customer id is not a valid id %q", md.CustomerID)
	}

	return nil
}

func ParseMetadata(b []byte) (*Metadata, error) {
	v := struct {
		Version int `json:"version"`
	}{}

	err := json.Unmarshal(b, &v)
	if err != nil {
		return nil, err
	}

	switch v.Version {
	case 1:
		var md Metadata
		err = json.Unmarshal(b, &md)
		if err != nil {
			return nil, err
		}

		err = md.Validate()
		if err != nil {
			return nil, err
		}

		return &md, nil
	default:
		return nil, fmt.Errorf("unsupported metadata version: %d", v.Version)
	}
}

// GeneratePluginMetadata is a utility function to generate a plugin metadata for support packets.
// It will construct it from the manifest, license and so on. The plugin_id and plugin_version will be
// used from the manifest.
func GeneratePluginMetadata(manifest *Manifest, license *License, serverID string, pluginMeta map[string]any) (*Metadata, error) {
	if pluginMeta == nil {
		pluginMeta = make(map[string]any)
	}

	// we override the plugin_id and version fields from the manifest
	pluginMeta["plugin_id"] = manifest.Id
	pluginMeta["plugin_version"] = manifest.Version

	md := Metadata{
		Version:       CurrentMetadataVersion,
		Type:          PluginMetadata,
		GeneratedAt:   GetMillis(),
		ServerVersion: CurrentVersion,
		ServerID:      serverID,
		Extras:        pluginMeta,
	}

	if license != nil {
		md.LicenseID = license.Id
		md.CustomerID = license.Customer.Id
	}

	if err := md.Validate(); err != nil {
		return nil, fmt.Errorf("invalid metadata: %w", err)
	}

	return &md, nil
}
