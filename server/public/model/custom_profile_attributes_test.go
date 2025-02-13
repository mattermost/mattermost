// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewCustomProfileAttributeSelectOption(t *testing.T) {
	t.Run("creates valid option with generated ID", func(t *testing.T) {
		option := NewCustomProfileAttributesSelectOption("", "Test Option", "#FF0000")

		assert.NotEmpty(t, option.ID)
		assert.True(t, IsValidId(option.ID))
		assert.Equal(t, "Test Option", option.Name)
		assert.Equal(t, "#FF0000", option.Color)
	})

	t.Run("trims spaces from name and color", func(t *testing.T) {
		option := NewCustomProfileAttributesSelectOption("", "  Test Option  ", "  #FF0000  ")

		assert.Equal(t, "Test Option", option.Name)
		assert.Equal(t, "#FF0000", option.Color)
	})

	t.Run("preserves provided ID", func(t *testing.T) {
		providedID := NewId()
		option := NewCustomProfileAttributesSelectOption(providedID, "Test Option", "#FF0000")

		assert.Equal(t, providedID, option.ID)
		assert.Equal(t, "Test Option", option.Name)
		assert.Equal(t, "#FF0000", option.Color)
	})

	t.Run("trims spaces from ID", func(t *testing.T) {
		validID := NewId()
		option := NewCustomProfileAttributesSelectOption("  "+validID+"  ", "Test Option", "#FF0000")

		assert.Equal(t, validID, option.ID)
		assert.Equal(t, "Test Option", option.Name)
		assert.Equal(t, "#FF0000", option.Color)
	})
}

func TestCustomProfileAttributeSelectOptionIsValid(t *testing.T) {
	tests := []struct {
		name    string
		option  CustomProfileAttributesSelectOption
		wantErr string
	}{
		{
			name: "valid option with color",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  "Test Option",
				Color: "#FF0000",
			},
			wantErr: "",
		},
		{
			name: "valid option without color",
			option: CustomProfileAttributesSelectOption{
				ID:   NewId(),
				Name: "Test Option",
			},
			wantErr: "",
		},
		{
			name: "empty ID",
			option: CustomProfileAttributesSelectOption{
				ID:    "",
				Name:  "Test Option",
				Color: "#FF0000",
			},
			wantErr: "id cannot be empty",
		},
		{
			name: "invalid ID",
			option: CustomProfileAttributesSelectOption{
				ID:    "invalid-id",
				Name:  "Test Option",
				Color: "#FF0000",
			},
			wantErr: "id is not a valid ID",
		},
		{
			name: "empty name",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  "",
				Color: "#FF0000",
			},
			wantErr: "name cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.option.IsValid()
			if tt.wantErr != "" {
				assert.EqualError(t, err, tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestNewCustomProfileAttributesSelectOptionFromMap(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]any
		expected CustomProfileAttributesSelectOption
	}{
		{
			name: "valid option",
			input: map[string]any{
				"name":  "Test Option",
				"color": "#FF0000",
			},
			expected: CustomProfileAttributesSelectOption{
				Name:  "Test Option",
				Color: "#FF0000",
			},
		},
		{
			name: "with spaces to trim",
			input: map[string]any{
				"name":  "  Test Option  ",
				"color": "  #FF0000  ",
			},
			expected: CustomProfileAttributesSelectOption{
				Name:  "Test Option",
				Color: "#FF0000",
			},
		},
		{
			name: "with provided id",
			input: map[string]any{
				"id":    "existingid123456789012345678",
				"name":  "Test Option",
				"color": "#FF0000",
			},
			expected: CustomProfileAttributesSelectOption{
				ID:    "existingid123456789012345678",
				Name:  "Test Option",
				Color: "#FF0000",
			},
		},
		{
			name: "with non-string values",
			input: map[string]any{
				"name":  123,
				"color": true,
			},
			expected: CustomProfileAttributesSelectOption{
				Name:  "",
				Color: "",
			},
		},
		{
			name:  "empty map",
			input: map[string]any{},
			expected: CustomProfileAttributesSelectOption{
				Name:  "",
				Color: "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NewCustomProfileAttributesSelectOptionFromMap(tt.input)
			if tt.expected.ID != "" {
				// When an ID is expected, verify it matches exactly
				assert.Equal(t, tt.expected.ID, result.ID)
			} else {
				// When no ID is provided, verify generated ID is valid
				assert.True(t, IsValidId(result.ID))
			}
			assert.Equal(t, tt.expected.Name, result.Name)
			assert.Equal(t, tt.expected.Color, result.Color)
		})
	}
}

func TestCustomProfileAttributesSelectOptionsIsValid(t *testing.T) {
	tests := []struct {
		name    string
		options CustomProfileAttributesSelectOptions
		wantErr string
	}{
		{
			name:    "empty options",
			options: CustomProfileAttributesSelectOptions{},
			wantErr: "options list cannot be empty",
		},
		{
			name: "valid options with and without color",
			options: CustomProfileAttributesSelectOptions{
				{
					ID:    NewId(),
					Name:  "Option 1",
					Color: "#FF0000",
				},
				{
					ID:   NewId(),
					Name: "Option 2",
				},
			},
			wantErr: "",
		},
		{
			name: "invalid option",
			options: CustomProfileAttributesSelectOptions{
				{
					ID:    NewId(),
					Name:  "Option 1",
					Color: "#FF0000",
				},
				{
					ID:   "",
					Name: "Option 2",
				},
			},
			wantErr: "invalid option at index 1: id cannot be empty",
		},
		{
			name: "duplicate names",
			options: CustomProfileAttributesSelectOptions{
				{
					ID:    NewId(),
					Name:  "Option 1",
					Color: "#FF0000",
				},
				{
					ID:    NewId(),
					Name:  "Option 1",
					Color: "#00FF00",
				},
			},
			wantErr: "duplicate option name found at index 1: Option 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.options.IsValid()
			if tt.wantErr != "" {
				assert.EqualError(t, err, tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
