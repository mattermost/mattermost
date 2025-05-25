// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"

	"github.com/blang/semver/v4"
	"gopkg.in/yaml.v3"
)

type PacketType string

const (
	CurrentMetadataVersion int        = 1
	SupportPacketType      PacketType = "support-packet"
	PluginPacketType       PacketType = "plugin-packet"

	PacketMetadataFileName = "metadata.yaml"
)

// PacketMetadata contains information about the server and the configured license (if there is one),
// It's used in file archives, so called Packets, that customer send to Mattermost Staff for review.
// For example, this metadata is attached to the Support Packet and the Metrics plugin Packet.
type PacketMetadata struct {
	// Required Fields

	Version       int        `yaml:"version"`
	Type          PacketType `yaml:"type"`
	GeneratedAt   int64      `yaml:"generated_at"`
	ServerVersion string     `yaml:"server_version"`
	ServerID      string     `yaml:"server_id"`

	// Optional Fields

	LicenseID  string         `yaml:"license_id"`
	CustomerID string         `yaml:"customer_id"`
	Extras     map[string]any `yaml:"extras,omitempty"`
}

func (md *PacketMetadata) Validate() error {
	if md.Version < 1 {
		return fmt.Errorf("metadata version should be greater than 1")
	}

	switch md.Type {
	case SupportPacketType, PluginPacketType:
	default:
		return fmt.Errorf("unrecognized packet type: %s", md.Type)
	}

	if md.GeneratedAt <= 0 {
		return fmt.Errorf("generated_at should be a positive number")
	}

	if _, err := semver.ParseTolerant(md.ServerVersion); err != nil {
		return fmt.Errorf("could not parse server version: %w", err)
	}

	if !IsValidId(md.ServerID) {
		return fmt.Errorf("server id is not a valid id %q", md.ServerID)
	}

	if md.LicenseID != "" && !IsValidId(md.LicenseID) {
		return fmt.Errorf("license id is not a valid id %q", md.LicenseID)
	}

	if md.CustomerID != "" && !IsValidId(md.CustomerID) {
		return fmt.Errorf("customer id is not a valid id %q", md.CustomerID)
	}

	return nil
}

func ParsePacketMetadata(b []byte) (*PacketMetadata, error) {
	v := struct {
		Version int `yaml:"version"`
	}{}

	err := yaml.Unmarshal(b, &v)
	if err != nil {
		return nil, err
	}

	switch v.Version {
	case 1:
		var md PacketMetadata
		err = yaml.Unmarshal(b, &md)
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

// GeneratePacketMetadata is a utility function to generate metadata for customer provided Packets.
// It will construct it from a Packet Type, the telemetryID and optionally a license.
func GeneratePacketMetadata(t PacketType, telemetryID string, license *License, extra map[string]any) (*PacketMetadata, error) {
	if extra == nil {
		extra = make(map[string]any)
	}

	md := &PacketMetadata{
		Version:       CurrentMetadataVersion,
		Type:          t,
		GeneratedAt:   GetMillis(),
		ServerVersion: CurrentVersion,
		ServerID:      telemetryID,
		Extras:        extra,
	}

	if license != nil {
		md.LicenseID = license.Id
		md.CustomerID = license.Customer.Id
	}

	if err := md.Validate(); err != nil {
		return nil, fmt.Errorf("invalid metadata: %w", err)
	}

	return md, nil
}
