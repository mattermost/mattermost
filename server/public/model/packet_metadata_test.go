// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestPacketMetadataValidate(t *testing.T) {
	tests := map[string]struct {
		name      string
		metadata  PacketMetadata
		expectErr bool
	}{
		"Valid Metadata": {
			metadata: PacketMetadata{
				Version:       1,
				Type:          SupportPacketType,
				GeneratedAt:   1720097114454,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				LicenseID:     NewId(),
				CustomerID:    NewId(),
				Extras:        map[string]interface{}{"key": "value"},
			},
			expectErr: false,
		},
		"Valid Metadata without license": {
			metadata: PacketMetadata{
				Version:       1,
				Type:          SupportPacketType,
				GeneratedAt:   1720097114454,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				Extras:        map[string]interface{}{"key": "value"},
			},
			expectErr: false,
		},
		"Invalid Version": {
			metadata: PacketMetadata{
				Version:       0,
				Type:          SupportPacketType,
				GeneratedAt:   1720097114454,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				LicenseID:     NewId(),
				CustomerID:    NewId(),
			},
			expectErr: true,
		},
		"Invalid Type": {
			metadata: PacketMetadata{
				Version:       1,
				Type:          "invalid-type",
				GeneratedAt:   1720097114454,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				LicenseID:     NewId(),
				CustomerID:    NewId(),
			},
			expectErr: true,
		},
		"Invalid GeneratedAt": {
			metadata: PacketMetadata{
				Version:       1,
				Type:          SupportPacketType,
				GeneratedAt:   0,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				LicenseID:     NewId(),
				CustomerID:    NewId(),
			},
			expectErr: true,
		},
		"Invalid Server Version": {
			metadata: PacketMetadata{
				Version:       1,
				Type:          SupportPacketType,
				GeneratedAt:   1720097114454,
				ServerVersion: "invalid-version",
				ServerID:      "valid-server-id",
				LicenseID:     "valid-license-id",
				CustomerID:    "valid-customer-id",
			},
			expectErr: true,
		},
		"Invalid Server ID": {
			metadata: PacketMetadata{
				Version:       1,
				Type:          SupportPacketType,
				GeneratedAt:   1720097114454,
				ServerVersion: "5.33.3",
				ServerID:      "",
				LicenseID:     NewId(),
				CustomerID:    NewId(),
			},
			expectErr: true,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			err := tt.metadata.Validate()
			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestParsePacketMetadata(t *testing.T) {
	valid := `
version: 1
type: support-packet
generated_at: 1622569200
server_version: 5.33.3
server_id: 8fqk9rti13fmpxdd5934a3xsxh
license_id: 3g3pqn8in3brzjkozcn1kdidgr
customer_id: 74cmws7gf3ykpj31car7zahsny
extras:
  key: value
`

	invalidVersion := `
version: 0
type: support-packet
generated_at: 1622569200
server_version: 5.33.3
server_id: 8fqk9rti13fmpxdd5934a3xsxh
license_id: 3g3pqn8in3brzjkozcn1kdidgr
customer_id: 74cmws7gf3ykpj31car7zahsny
`

	unsupportedVersion := `
version: 2
type: support-packet
generated_at: 1622569200
server_version: 5.33.3
server_id: 8fqk9rti13fmpxdd5934a3xsxh
license_id: 3g3pqn8in3brzjkozcn1kdidgr
customer_id: 74cmws7gf3ykpj31car7zahsny
`

	tests := map[string]struct {
		yamlData  string
		expectErr bool
	}{
		"Valid Metadata YAML": {
			yamlData:  valid,
			expectErr: false,
		},
		"Invalid Version in YAML": {
			yamlData:  invalidVersion,
			expectErr: true,
		},
		"Unsupported Version in YAML": {
			yamlData:  unsupportedVersion,
			expectErr: true,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			// Confirm valid yaml
			var md *PacketMetadata
			err := yaml.Unmarshal([]byte(tt.yamlData), &md)
			require.NoError(t, err)

			md, err = ParsePacketMetadata([]byte(tt.yamlData))
			if tt.expectErr {
				require.Error(t, err)
				require.Nil(t, md)
			} else {
				require.NoError(t, err)
				require.NotNil(t, md)
			}
		})
	}
}
