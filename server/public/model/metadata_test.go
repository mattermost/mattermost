// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidate(t *testing.T) {
	tests := []struct {
		name      string
		metadata  Metadata
		expectErr bool
	}{
		{
			name: "Valid Metadata",
			metadata: Metadata{
				Version:       1,
				Type:          ServerMetadata,
				GeneratedAt:   1622569200,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				LicenseID:     NewId(),
				CustomerID:    NewId(),
				Extras:        map[string]interface{}{"key": "value"},
			},
			expectErr: false,
		},
		{
			name: "Valid Metadata without license",
			metadata: Metadata{
				Version:       1,
				Type:          ServerMetadata,
				GeneratedAt:   1622569200,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				Extras:        map[string]interface{}{"key": "value"},
			},
			expectErr: false,
		},
		{
			name: "Invalid Version",
			metadata: Metadata{
				Version:       0,
				Type:          ServerMetadata,
				GeneratedAt:   1622569200,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				LicenseID:     NewId(),
				CustomerID:    NewId(),
			},
			expectErr: true,
		},
		{
			name: "Invalid Type",
			metadata: Metadata{
				Version:       1,
				Type:          "invalid-type",
				GeneratedAt:   1622569200,
				ServerVersion: "5.33.3",
				ServerID:      NewId(),
				LicenseID:     NewId(),
				CustomerID:    NewId(),
			},
			expectErr: true,
		},
		{
			name: "Invalid Server Version",
			metadata: Metadata{
				Version:       1,
				Type:          ServerMetadata,
				GeneratedAt:   1622569200,
				ServerVersion: "invalid-version",
				ServerID:      "valid-server-id",
				LicenseID:     "valid-license-id",
				CustomerID:    "valid-customer-id",
			},
			expectErr: true,
		},
		{
			name: "Invalid Server ID",
			metadata: Metadata{
				Version:       1,
				Type:          ServerMetadata,
				GeneratedAt:   1622569200,
				ServerVersion: "5.33.3",
				ServerID:      "",
				LicenseID:     NewId(),
				CustomerID:    NewId(),
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.metadata.Validate()
			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestParseMetadata(t *testing.T) {
	validMetadataJSON := `{
		"version": 1,
		"type": "mattermost-support-package",
		"generated_at": 1622569200,
		"server_version": "5.33.3",
		"server_id": "8fqk9rti13fmpxdd5934a3xsxh",
		"license_id": "3g3pqn8in3brzjkozcn1kdidgr",
		"customer_id": "74cmws7gf3ykpj31car7zahsny",
		"extras": {"key": "value"}
	}`

	invalidVersionJSON := `{
		"version": 0,
		"type": "mattermost-support-package",
		"generated_at": 1622569200,
		"server_version": "5.33.3",
		"server_id": "8fqk9rti13fmpxdd5934a3xsxh",
		"license_id": "3g3pqn8in3brzjkozcn1kdidgr",
		"customer_id": "74cmws7gf3ykpj31car7zahsny",
	}`

	unsupportedVersionJSON := `{
		"version": 2,
		"type": "mattermost-support-package",
		"generated_at": 1622569200,
		"server_version": "5.33.3",
		"server_id": "8fqk9rti13fmpxdd5934a3xsxh",
		"license_id": "3g3pqn8in3brzjkozcn1kdidgr",
		"customer_id": "74cmws7gf3ykpj31car7zahsny",
	}`

	tests := []struct {
		name      string
		jsonData  string
		expectErr bool
	}{
		{
			name:      "Valid Metadata JSON",
			jsonData:  validMetadataJSON,
			expectErr: false,
		},
		{
			name:      "Invalid Version in JSON",
			jsonData:  invalidVersionJSON,
			expectErr: true,
		},
		{
			name:      "Unsupported Version in JSON",
			jsonData:  unsupportedVersionJSON,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			md, err := ParseMetadata([]byte(tt.jsonData))
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
