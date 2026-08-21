// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestPropertyField_SupportsOptions(t *testing.T) {
	tests := []struct {
		name         string
		fieldType    model.PropertyFieldType
		expectResult bool
	}{
		{
			name:         "select type supports options",
			fieldType:    model.PropertyFieldTypeSelect,
			expectResult: true,
		},
		{
			name:         "multiselect type supports options",
			fieldType:    model.PropertyFieldTypeMultiselect,
			expectResult: true,
		},
		{
			name:         "text type does not support options",
			fieldType:    model.PropertyFieldTypeText,
			expectResult: false,
		},
		{
			name:         "date type does not support options",
			fieldType:    model.PropertyFieldTypeDate,
			expectResult: false,
		},
		{
			name:         "user type supports options",
			fieldType:    model.PropertyFieldTypeUser,
			expectResult: true,
		},
		{
			name:         "multiuser type supports options",
			fieldType:    model.PropertyFieldTypeMultiuser,
			expectResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pf := &PropertyField{
				PropertyField: model.PropertyField{
					Type: tt.fieldType,
				},
			}
			result := pf.SupportsOptions()
			require.Equal(t, tt.expectResult, result)
		})
	}
}

func TestPropertyField_SanitizeAndValidate(t *testing.T) {
	t.Run("removes options for non-option field types", func(t *testing.T) {
		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeText,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("id1", "Option 1"),
				},
			},
		}

		err := pf.SanitizeAndValidate()
		require.NoError(t, err)
		require.Nil(t, pf.Attrs.Options)
	})

	t.Run("adds IDs to options without IDs", func(t *testing.T) {
		option1 := model.NewPluginPropertyOption("", "Option 1")
		existingID := model.NewId()
		option2 := model.NewPluginPropertyOption(existingID, "Option 2")

		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{option1, option2},
			},
		}

		err := pf.SanitizeAndValidate()
		require.NoError(t, err)
		require.Len(t, pf.Attrs.Options, 2)
		require.NotEmpty(t, pf.Attrs.Options[0].GetID())
		require.Equal(t, existingID, pf.Attrs.Options[1].GetID())
	})

	t.Run("sets default visibility when empty", func(t *testing.T) {
		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeText,
			},
			Attrs: Attrs{
				Visibility: "",
			},
		}

		err := pf.SanitizeAndValidate()
		require.NoError(t, err)
		require.Equal(t, PropertyFieldVisibilityDefault, pf.Attrs.Visibility)
	})

	t.Run("validates visibility values", func(t *testing.T) {
		validVisibilities := []string{
			PropertyFieldVisibilityHidden,
			PropertyFieldVisibilityWhenSet,
			PropertyFieldVisibilityAlways,
		}

		for _, visibility := range validVisibilities {
			pf := &PropertyField{
				PropertyField: model.PropertyField{
					Type: model.PropertyFieldTypeText,
				},
				Attrs: Attrs{
					Visibility: visibility,
				},
			}

			err := pf.SanitizeAndValidate()
			require.NoError(t, err)
			require.Equal(t, visibility, pf.Attrs.Visibility)
		}
	})

	t.Run("returns error for invalid visibility", func(t *testing.T) {
		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeText,
			},
			Attrs: Attrs{
				Visibility: "invalid_visibility",
			},
		}

		err := pf.SanitizeAndValidate()
		require.Error(t, err)
		require.Contains(t, err.Error(), "unknown visibility value")
	})

	t.Run("validates option name length", func(t *testing.T) {
		longName := string(make([]byte, PropertyOptionNameMaxLength+1))
		option := model.NewPluginPropertyOption(model.NewId(), longName)

		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{option},
			},
		}

		err := pf.SanitizeAndValidate()
		require.Error(t, err)
		require.Contains(t, err.Error(), "option name exceeds maximum length")
	})

	t.Run("validates option color length", func(t *testing.T) {
		longColor := string(make([]byte, PropertyOptionColorMaxLength+1))
		option := model.NewPluginPropertyOption(model.NewId(), "Valid Name")
		option.SetValue("color", longColor)

		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{option},
			},
		}

		err := pf.SanitizeAndValidate()
		require.Error(t, err)
		require.Contains(t, err.Error(), "option color exceeds maximum length")
	})

	t.Run("allows valid option name and color", func(t *testing.T) {
		validName := "Valid Option"
		validColor := "blue"
		option := model.NewPluginPropertyOption(model.NewId(), validName)
		option.SetValue("color", validColor)

		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{option},
			},
		}

		err := pf.SanitizeAndValidate()
		require.NoError(t, err)
		require.Len(t, pf.Attrs.Options, 1)
		require.Equal(t, validName, pf.Attrs.Options[0].GetName())
		require.Equal(t, validColor, pf.Attrs.Options[0].GetValue("color"))
	})

	t.Run("preserves valid value_type url", func(t *testing.T) {
		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeText,
			},
			Attrs: Attrs{
				ValueType: "url",
			},
		}

		err := pf.SanitizeAndValidate()
		require.NoError(t, err)
		require.Equal(t, "url", pf.Attrs.ValueType)
	})

	t.Run("preserves empty value_type", func(t *testing.T) {
		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeText,
			},
			Attrs: Attrs{
				ValueType: "",
			},
		}

		err := pf.SanitizeAndValidate()
		require.NoError(t, err)
		require.Equal(t, "", pf.Attrs.ValueType)
	})

	t.Run("converts invalid value_type to empty string", func(t *testing.T) {
		pf := &PropertyField{
			PropertyField: model.PropertyField{
				Type: model.PropertyFieldTypeText,
			},
			Attrs: Attrs{
				ValueType: "invalid_type",
			},
		}

		err := pf.SanitizeAndValidate()
		require.NoError(t, err)
		require.Equal(t, "", pf.Attrs.ValueType)
	})
}

func TestPropertyField_ToMattermostPropertyField(t *testing.T) {
	optionID1 := model.NewId()
	optionID2 := model.NewId()
	option1 := model.NewPluginPropertyOption(optionID1, "Option 1")
	option2 := model.NewPluginPropertyOption(optionID2, "Option 2")

	pf := &PropertyField{
		PropertyField: model.PropertyField{
			ID:         "field-id",
			Name:       "Test Field",
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    "group-id",
			TargetType: "playbook",
			TargetID:   "playbook-id",
			CreateAt:   1234567890,
			UpdateAt:   1234567891,
		},
		Attrs: Attrs{
			Visibility: PropertyFieldVisibilityAlways,
			SortOrder:  5.0,
			Options:    model.PropertyOptions[*model.PluginPropertyOption]{option1, option2},
			ParentID:   "parent-id",
			ValueType:  "url",
		},
	}

	result := pf.ToMattermostPropertyField()

	require.Equal(t, "field-id", result.ID)
	require.Equal(t, "Test Field", result.Name)
	require.Equal(t, model.PropertyFieldTypeSelect, result.Type)
	require.Equal(t, "group-id", result.GroupID)
	require.Equal(t, "playbook", result.TargetType)
	require.Equal(t, "playbook-id", result.TargetID)
	require.Equal(t, int64(1234567890), result.CreateAt)
	require.Equal(t, int64(1234567891), result.UpdateAt)

	// Check attrs
	require.Equal(t, PropertyFieldVisibilityAlways, result.Attrs[PropertyAttrsVisibility])
	require.Equal(t, 5.0, result.Attrs[PropertyAttrsSortOrder])
	require.Equal(t, "parent-id", result.Attrs[PropertyAttrsParentID])
	require.Equal(t, "url", result.Attrs[PropertyAttrsValueType])

	options, ok := result.Attrs[model.PropertyFieldAttributeOptions].(model.PropertyOptions[*model.PluginPropertyOption])
	require.True(t, ok)
	require.Len(t, options, 2)
	require.Equal(t, optionID1, options[0].GetID())
	require.Equal(t, "Option 1", options[0].GetName())
	require.Equal(t, optionID2, options[1].GetID())
	require.Equal(t, "Option 2", options[1].GetName())
}

func TestNewPropertyFieldFromMattermostPropertyField(t *testing.T) {
	optionID1 := model.NewId()
	optionID2 := model.NewId()
	option1 := model.NewPluginPropertyOption(optionID1, "Option 1")
	option2 := model.NewPluginPropertyOption(optionID2, "Option 2")

	mmpf := &model.PropertyField{
		ID:         "field-id",
		Name:       "Test Field",
		Type:       model.PropertyFieldTypeSelect,
		GroupID:    "group-id",
		TargetType: "playbook",
		TargetID:   "playbook-id",
		CreateAt:   1234567890,
		UpdateAt:   1234567891,
		Attrs: model.StringInterface{
			PropertyAttrsVisibility:             PropertyFieldVisibilityAlways,
			PropertyAttrsSortOrder:              5.0,
			model.PropertyFieldAttributeOptions: model.PropertyOptions[*model.PluginPropertyOption]{option1, option2},
			PropertyAttrsParentID:               "parent-id",
			PropertyAttrsValueType:              "url",
		},
	}

	result, err := NewPropertyFieldFromMattermostPropertyField(mmpf)
	require.NoError(t, err)
	require.NotNil(t, result)

	require.Equal(t, "field-id", result.ID)
	require.Equal(t, "Test Field", result.Name)
	require.Equal(t, model.PropertyFieldTypeSelect, result.Type)
	require.Equal(t, "group-id", result.GroupID)
	require.Equal(t, "playbook", result.TargetType)
	require.Equal(t, "playbook-id", result.TargetID)
	require.Equal(t, int64(1234567890), result.CreateAt)
	require.Equal(t, int64(1234567891), result.UpdateAt)

	// Check attrs
	require.Equal(t, PropertyFieldVisibilityAlways, result.Attrs.Visibility)
	require.Equal(t, 5.0, result.Attrs.SortOrder)
	require.Equal(t, "parent-id", result.Attrs.ParentID)
	require.Equal(t, "url", result.Attrs.ValueType)
	require.Len(t, result.Attrs.Options, 2)
	require.Equal(t, optionID1, result.Attrs.Options[0].GetID())
	require.Equal(t, "Option 1", result.Attrs.Options[0].GetName())
	require.Equal(t, optionID2, result.Attrs.Options[1].GetID())
	require.Equal(t, "Option 2", result.Attrs.Options[1].GetName())
}

func TestNewPropertyFieldFromMattermostPropertyField_InvalidAttrs(t *testing.T) {
	t.Run("handles attrs that cannot be marshaled", func(t *testing.T) {
		// Create attrs with a channel that cannot be marshaled to JSON
		mmpf := &model.PropertyField{
			ID:   "field-id",
			Name: "Test Field",
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				"invalid": make(chan int), // Channels cannot be marshaled to JSON
			},
		}

		_, err := NewPropertyFieldFromMattermostPropertyField(mmpf)
		require.Error(t, err)
	})

	t.Run("handles empty attrs", func(t *testing.T) {
		mmpf := &model.PropertyField{
			ID:    "field-id",
			Name:  "Test Field",
			Type:  model.PropertyFieldTypeText,
			Attrs: model.StringInterface{},
		}

		result, err := NewPropertyFieldFromMattermostPropertyField(mmpf)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, "field-id", result.ID)
		require.Equal(t, "Test Field", result.Name)
		require.Equal(t, "", result.Attrs.Visibility)
		require.Equal(t, float64(0), result.Attrs.SortOrder)
		require.Equal(t, "", result.Attrs.ParentID)
		require.Nil(t, result.Attrs.Options)
	})
}
