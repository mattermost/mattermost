// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewCustomProfileAttributeSelectOption(t *testing.T) {
	t.Run("creates valid option with generated ID", func(t *testing.T) {
		option := NewCustomProfileAttributesSelectOption("Test Option", "#FF0000")

		assert.NotEmpty(t, option.ID)
		assert.True(t, IsValidId(option.ID))
		assert.Equal(t, "Test Option", option.Name)
		assert.Equal(t, "#FF0000", option.Color)
	})

	t.Run("trims spaces from name and color", func(t *testing.T) {
		option := NewCustomProfileAttributesSelectOption("  Test Option  ", "  #FF0000  ")

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
			name: "valid option",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  "Test Option",
				Color: "#FF0000",
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
		{
			name: "empty color",
			option: CustomProfileAttributesSelectOption{
				ID:    NewId(),
				Name:  "Test Option",
				Color: "",
			},
			wantErr: "color cannot be empty",
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
			name: "valid options",
			options: CustomProfileAttributesSelectOptions{
				{
					ID:    NewId(),
					Name:  "Option 1",
					Color: "#FF0000",
				},
				{
					ID:    NewId(),
					Name:  "Option 2",
					Color: "#00FF00",
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
					ID:    "",
					Name:  "Option 2",
					Color: "#00FF00",
				},
			},
			wantErr: "id cannot be empty",
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
			wantErr: "duplicate option name found",
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
