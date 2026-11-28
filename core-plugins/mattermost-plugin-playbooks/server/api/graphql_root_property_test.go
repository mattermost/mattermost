// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertPropertyFieldGraphQLInputToPropertyField(t *testing.T) {
	t.Run("basic text field with minimal attrs", func(t *testing.T) {
		input := PropertyFieldGraphQLInput{
			Name: "Test Field",
			Type: model.PropertyFieldTypeText,
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Test Field", result.Name)
		assert.Equal(t, model.PropertyFieldTypeText, result.Type)
		assert.Equal(t, app.PropertyFieldVisibilityDefault, result.Attrs.Visibility)
		assert.Zero(t, result.Attrs.SortOrder)
		assert.Nil(t, result.Attrs.Options)
		assert.Empty(t, result.Attrs.ParentID)
	})

	t.Run("basic field with nil attrs", func(t *testing.T) {
		input := PropertyFieldGraphQLInput{
			Name:  "Test Field",
			Type:  model.PropertyFieldTypeText,
			Attrs: nil,
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Test Field", result.Name)
		assert.Equal(t, model.PropertyFieldType("text"), result.Type)
		assert.Equal(t, app.PropertyFieldVisibilityDefault, result.Attrs.Visibility)
		assert.Zero(t, result.Attrs.SortOrder)
		assert.Nil(t, result.Attrs.Options)
		assert.Empty(t, result.Attrs.ParentID)
	})

	t.Run("field with complete attrs", func(t *testing.T) {
		visibility := "always"
		sortOrder := 10.5
		parentID := "parent-123"

		input := PropertyFieldGraphQLInput{
			Name: "Complete Field",
			Type: model.PropertyFieldTypeSelect,
			Attrs: &PropertyFieldAttrsGraphQLInput{
				Visibility: &visibility,
				SortOrder:  &sortOrder,
				ParentID:   &parentID,
			},
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Complete Field", result.Name)
		assert.Equal(t, model.PropertyFieldTypeSelect, result.Type)
		assert.Equal(t, "always", result.Attrs.Visibility)
		assert.Equal(t, 10.5, result.Attrs.SortOrder)
		assert.Equal(t, "parent-123", result.Attrs.ParentID)
	})

	t.Run("field with options without IDs", func(t *testing.T) {
		color1 := "red"
		color2 := "blue"
		options := []PropertyOptionGraphQLInput{
			{
				Name:  "Option 1",
				Color: &color1,
			},
			{
				Name:  "Option 2",
				Color: &color2,
			},
		}

		input := PropertyFieldGraphQLInput{
			Name: "Select Field",
			Type: model.PropertyFieldTypeSelect,
			Attrs: &PropertyFieldAttrsGraphQLInput{
				Options: &options,
			},
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Select Field", result.Name)
		assert.Equal(t, model.PropertyFieldType("select"), result.Type)
		require.Len(t, result.Attrs.Options, 2)

		option1 := result.Attrs.Options[0]
		assert.Equal(t, "Option 1", option1.GetName())
		assert.Empty(t, option1.GetID())
		assert.Equal(t, "red", option1.GetValue("color"))

		option2 := result.Attrs.Options[1]
		assert.Equal(t, "Option 2", option2.GetName())
		assert.Empty(t, option2.GetID())
		assert.Equal(t, "blue", option2.GetValue("color"))
	})

	t.Run("field with options with IDs", func(t *testing.T) {
		id1 := "opt-1"
		id2 := "opt-2"
		color1 := "green"
		options := []PropertyOptionGraphQLInput{
			{
				ID:    &id1,
				Name:  "Existing Option 1",
				Color: &color1,
			},
			{
				ID:   &id2,
				Name: "Existing Option 2",
			},
		}

		input := PropertyFieldGraphQLInput{
			Name: "Select Field",
			Type: "select",
			Attrs: &PropertyFieldAttrsGraphQLInput{
				Options: &options,
			},
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		require.Len(t, result.Attrs.Options, 2)

		option1 := result.Attrs.Options[0]
		assert.Equal(t, "Existing Option 1", option1.GetName())
		assert.Equal(t, "opt-1", option1.GetID())
		assert.Equal(t, "green", option1.GetValue("color"))

		option2 := result.Attrs.Options[1]
		assert.Equal(t, "Existing Option 2", option2.GetName())
		assert.Equal(t, "opt-2", option2.GetID())
		assert.Equal(t, "", option2.GetValue("color"))
	})

	t.Run("field with options without colors", func(t *testing.T) {
		options := []PropertyOptionGraphQLInput{
			{
				Name: "Plain Option 1",
			},
			{
				Name: "Plain Option 2",
			},
		}

		input := PropertyFieldGraphQLInput{
			Name: "Select Field",
			Type: "select",
			Attrs: &PropertyFieldAttrsGraphQLInput{
				Options: &options,
			},
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		require.Len(t, result.Attrs.Options, 2)

		option1 := result.Attrs.Options[0]
		assert.Equal(t, "Plain Option 1", option1.GetName())
		assert.Equal(t, "", option1.GetValue("color"))

		option2 := result.Attrs.Options[1]
		assert.Equal(t, "Plain Option 2", option2.GetName())
		assert.Equal(t, "", option2.GetValue("color"))
	})

	t.Run("field with empty options array", func(t *testing.T) {
		options := []PropertyOptionGraphQLInput{}

		input := PropertyFieldGraphQLInput{
			Name: "Select Field",
			Type: "select",
			Attrs: &PropertyFieldAttrsGraphQLInput{
				Options: &options,
			},
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Empty(t, result.Attrs.Options)
	})

	t.Run("different field types", func(t *testing.T) {
		testCases := []struct {
			name         string
			fieldType    model.PropertyFieldType
			expectedType model.PropertyFieldType
		}{
			{"text field", model.PropertyFieldTypeText, model.PropertyFieldTypeText},
			{"select field", model.PropertyFieldTypeSelect, model.PropertyFieldTypeSelect},
			{"multiselect field", model.PropertyFieldTypeMultiselect, model.PropertyFieldTypeMultiselect},
			{"date field", model.PropertyFieldTypeDate, model.PropertyFieldTypeDate},
			{"user field", model.PropertyFieldTypeUser, model.PropertyFieldTypeUser},
			{"multiuser field", model.PropertyFieldTypeMultiuser, model.PropertyFieldTypeMultiuser},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				input := PropertyFieldGraphQLInput{
					Name: "Test Field",
					Type: tc.fieldType,
				}

				result := convertPropertyFieldGraphQLInputToPropertyField(input)

				require.NotNil(t, result)
				assert.Equal(t, tc.expectedType, result.Type)
			})
		}
	})

	t.Run("attrs with partial values", func(t *testing.T) {
		sortOrder := 5.0

		input := PropertyFieldGraphQLInput{
			Name: "Partial Attrs Field",
			Type: model.PropertyFieldTypeText,
			Attrs: &PropertyFieldAttrsGraphQLInput{
				SortOrder: &sortOrder,
			},
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, app.PropertyFieldVisibilityDefault, result.Attrs.Visibility)
		assert.Equal(t, 5.0, result.Attrs.SortOrder)
		assert.Empty(t, result.Attrs.ParentID)
		assert.Nil(t, result.Attrs.Options)
	})

	t.Run("complex field with all attrs", func(t *testing.T) {
		visibility := "edit_only"
		sortOrder := 15.5
		parentID := "complex-parent"
		id1 := "complex-opt-1"
		color1 := "purple"
		color2 := "orange"

		options := []PropertyOptionGraphQLInput{
			{
				ID:    &id1,
				Name:  "Complex Option 1",
				Color: &color1,
			},
			{
				Name:  "Complex Option 2",
				Color: &color2,
			},
		}

		input := PropertyFieldGraphQLInput{
			Name: "Complex Field",
			Type: model.PropertyFieldTypeMultiselect,
			Attrs: &PropertyFieldAttrsGraphQLInput{
				Visibility: &visibility,
				SortOrder:  &sortOrder,
				ParentID:   &parentID,
				Options:    &options,
			},
		}

		result := convertPropertyFieldGraphQLInputToPropertyField(input)

		require.NotNil(t, result)
		assert.Equal(t, "Complex Field", result.Name)
		assert.Equal(t, model.PropertyFieldTypeMultiselect, result.Type)
		assert.Equal(t, "edit_only", result.Attrs.Visibility)
		assert.Equal(t, 15.5, result.Attrs.SortOrder)
		assert.Equal(t, "complex-parent", result.Attrs.ParentID)
		require.Len(t, result.Attrs.Options, 2)

		option1 := result.Attrs.Options[0]
		assert.Equal(t, "Complex Option 1", option1.GetName())
		assert.Equal(t, "complex-opt-1", option1.GetID())
		assert.Equal(t, "purple", option1.GetValue("color"))

		option2 := result.Attrs.Options[1]
		assert.Equal(t, "Complex Option 2", option2.GetName())
		assert.Empty(t, option2.GetID())
		assert.Equal(t, "orange", option2.GetValue("color"))
	})

	t.Run("visibility constants", func(t *testing.T) {
		testCases := []struct {
			name       string
			visibility string
		}{
			{"hidden visibility", app.PropertyFieldVisibilityHidden},
			{"when_set visibility", app.PropertyFieldVisibilityWhenSet},
			{"always visibility", app.PropertyFieldVisibilityAlways},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				input := PropertyFieldGraphQLInput{
					Name: "Test Field",
					Type: model.PropertyFieldTypeText,
					Attrs: &PropertyFieldAttrsGraphQLInput{
						Visibility: &tc.visibility,
					},
				}

				result := convertPropertyFieldGraphQLInputToPropertyField(input)

				require.NotNil(t, result)
				assert.Equal(t, tc.visibility, result.Attrs.Visibility)
			})
		}
	})

	t.Run("edge cases", func(t *testing.T) {
		t.Run("empty field name", func(t *testing.T) {
			input := PropertyFieldGraphQLInput{
				Name: "",
				Type: model.PropertyFieldTypeText,
			}

			result := convertPropertyFieldGraphQLInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, "", result.Name)
			assert.Equal(t, model.PropertyFieldType("text"), result.Type)
		})

		t.Run("empty field type", func(t *testing.T) {
			input := PropertyFieldGraphQLInput{
				Name: "Test Field",
				Type: "",
			}

			result := convertPropertyFieldGraphQLInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, "Test Field", result.Name)
			assert.Equal(t, model.PropertyFieldType(""), result.Type)
		})

		t.Run("zero sort order", func(t *testing.T) {
			sortOrder := 0.0

			input := PropertyFieldGraphQLInput{
				Name: "Test Field",
				Type: "text",
				Attrs: &PropertyFieldAttrsGraphQLInput{
					SortOrder: &sortOrder,
				},
			}

			result := convertPropertyFieldGraphQLInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, 0.0, result.Attrs.SortOrder)
		})

		t.Run("negative sort order", func(t *testing.T) {
			sortOrder := -5.5

			input := PropertyFieldGraphQLInput{
				Name: "Test Field",
				Type: "text",
				Attrs: &PropertyFieldAttrsGraphQLInput{
					SortOrder: &sortOrder,
				},
			}

			result := convertPropertyFieldGraphQLInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, -5.5, result.Attrs.SortOrder)
		})

		t.Run("empty parent ID", func(t *testing.T) {
			parentID := ""

			input := PropertyFieldGraphQLInput{
				Name: "Test Field",
				Type: "text",
				Attrs: &PropertyFieldAttrsGraphQLInput{
					ParentID: &parentID,
				},
			}

			result := convertPropertyFieldGraphQLInputToPropertyField(input)

			require.NotNil(t, result)
			assert.Equal(t, "", result.Attrs.ParentID)
		})

		t.Run("option with empty name", func(t *testing.T) {
			options := []PropertyOptionGraphQLInput{
				{
					Name: "",
				},
			}

			input := PropertyFieldGraphQLInput{
				Name: "Select Field",
				Type: "select",
				Attrs: &PropertyFieldAttrsGraphQLInput{
					Options: &options,
				},
			}

			result := convertPropertyFieldGraphQLInputToPropertyField(input)

			require.NotNil(t, result)
			require.Len(t, result.Attrs.Options, 1)
			assert.Equal(t, "", result.Attrs.Options[0].GetName())
		})

		t.Run("option with empty ID", func(t *testing.T) {
			emptyID := ""
			options := []PropertyOptionGraphQLInput{
				{
					ID:   &emptyID,
					Name: "Option with empty ID",
				},
			}

			input := PropertyFieldGraphQLInput{
				Name: "Select Field",
				Type: "select",
				Attrs: &PropertyFieldAttrsGraphQLInput{
					Options: &options,
				},
			}

			result := convertPropertyFieldGraphQLInputToPropertyField(input)

			require.NotNil(t, result)
			require.Len(t, result.Attrs.Options, 1)
			assert.Equal(t, "", result.Attrs.Options[0].GetID())
		})

		t.Run("option with empty color", func(t *testing.T) {
			emptyColor := ""
			options := []PropertyOptionGraphQLInput{
				{
					Name:  "Option with empty color",
					Color: &emptyColor,
				},
			}

			input := PropertyFieldGraphQLInput{
				Name: "Select Field",
				Type: "select",
				Attrs: &PropertyFieldAttrsGraphQLInput{
					Options: &options,
				},
			}

			result := convertPropertyFieldGraphQLInputToPropertyField(input)

			require.NotNil(t, result)
			require.Len(t, result.Attrs.Options, 1)
			assert.Equal(t, "", result.Attrs.Options[0].GetValue("color"))
		})
	})
}
