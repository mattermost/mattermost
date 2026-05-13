// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyGroupIsPSAv1(t *testing.T) {
	tests := []struct {
		name     string
		version  int
		expected bool
	}{
		{"v1 group", PropertyGroupVersionV1, true},
		{"v2 group", PropertyGroupVersionV2, false},
		{"zero-value version", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pg := &PropertyGroup{Version: tt.version}
			assert.Equal(t, tt.expected, pg.IsPSAv1())
		})
	}
}

func TestPropertyGroupIsPSAv2(t *testing.T) {
	tests := []struct {
		name     string
		version  int
		expected bool
	}{
		{"v1 group", PropertyGroupVersionV1, false},
		{"v2 group", PropertyGroupVersionV2, true},
		{"zero-value version", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pg := &PropertyGroup{Version: tt.version}
			assert.Equal(t, tt.expected, pg.IsPSAv2())
		})
	}
}

func TestPropertyGroupIsValid(t *testing.T) {
	tests := []struct {
		name    string
		group   PropertyGroup
		wantErr bool
	}{
		{
			name:    "valid v1 group",
			group:   PropertyGroup{ID: NewId(), Name: "test_group", Version: PropertyGroupVersionV1},
			wantErr: false,
		},
		{
			name:    "valid v2 group",
			group:   PropertyGroup{ID: NewId(), Name: "test_group", Version: PropertyGroupVersionV2},
			wantErr: false,
		},
		{
			name:    "empty name",
			group:   PropertyGroup{ID: NewId(), Name: "", Version: PropertyGroupVersionV1},
			wantErr: true,
		},
		{
			name:    "invalid version zero",
			group:   PropertyGroup{ID: NewId(), Name: "test_group", Version: 0},
			wantErr: true,
		},
		{
			name:    "invalid version 99",
			group:   PropertyGroup{ID: NewId(), Name: "test_group", Version: 99},
			wantErr: true,
		},
		{
			name:    "empty id",
			group:   PropertyGroup{ID: "", Name: "test_group", Version: PropertyGroupVersionV1},
			wantErr: true,
		},
		{
			name:    "invalid id",
			group:   PropertyGroup{ID: "not-a-valid-id!", Name: "test_group", Version: PropertyGroupVersionV1},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.group.IsValid()
			if tt.wantErr {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}
		})
	}
}

func TestPropertyGroupPreSave(t *testing.T) {
	t.Run("generates ID when empty", func(t *testing.T) {
		pg := &PropertyGroup{Name: "test_group", Version: PropertyGroupVersionV1}
		pg.PreSave()
		assert.NotEmpty(t, pg.ID)
		assert.True(t, IsValidId(pg.ID))
	})

	t.Run("does not overwrite existing ID", func(t *testing.T) {
		existingID := NewId()
		pg := &PropertyGroup{ID: existingID, Name: "test_group", Version: PropertyGroupVersionV1}
		pg.PreSave()
		assert.Equal(t, existingID, pg.ID)
	})

	t.Run("defaults version to v1 when zero", func(t *testing.T) {
		pg := &PropertyGroup{Name: "test_group"}
		pg.PreSave()
		assert.Equal(t, PropertyGroupVersionV1, pg.Version)
	})

	t.Run("does not overwrite existing version", func(t *testing.T) {
		pg := &PropertyGroup{Name: "test_group", Version: PropertyGroupVersionV2}
		pg.PreSave()
		assert.Equal(t, PropertyGroupVersionV2, pg.Version)
	})
}
