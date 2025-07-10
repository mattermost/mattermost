// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyField_PreSave(t *testing.T) {
	t.Run("sets ID if empty", func(t *testing.T) {
		pf := &PropertyField{}
		pf.PreSave()
		assert.NotEmpty(t, pf.ID)
		assert.Len(t, pf.ID, 26) // Length of NewId()
	})

	t.Run("keeps existing ID", func(t *testing.T) {
		pf := &PropertyField{ID: "existing_id"}
		pf.PreSave()
		assert.Equal(t, "existing_id", pf.ID)
	})

	t.Run("sets CreateAt if zero", func(t *testing.T) {
		pf := &PropertyField{}
		pf.PreSave()
		assert.NotZero(t, pf.CreateAt)
	})

	t.Run("sets UpdateAt equal to CreateAt", func(t *testing.T) {
		pf := &PropertyField{}
		pf.PreSave()
		assert.Equal(t, pf.CreateAt, pf.UpdateAt)
	})
}

func TestPropertyField_IsValid(t *testing.T) {
	t.Run("valid field", func(t *testing.T) {
		pf := &PropertyField{
			ID:       NewId(),
			GroupID:  NewId(),
			Name:     "test field",
			Type:     PropertyFieldTypeText,
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("invalid ID", func(t *testing.T) {
		pf := &PropertyField{
			ID:       "invalid",
			GroupID:  NewId(),
			Name:     "test field",
			Type:     PropertyFieldTypeText,
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("invalid GroupID", func(t *testing.T) {
		pf := &PropertyField{
			ID:       NewId(),
			GroupID:  "invalid",
			Name:     "test field",
			Type:     PropertyFieldTypeText,
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("empty name", func(t *testing.T) {
		pf := &PropertyField{
			ID:       NewId(),
			GroupID:  NewId(),
			Name:     "",
			Type:     PropertyFieldTypeText,
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("invalid type", func(t *testing.T) {
		pf := &PropertyField{
			ID:       NewId(),
			GroupID:  NewId(),
			Name:     "test field",
			Type:     "invalid",
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("zero CreateAt", func(t *testing.T) {
		pf := &PropertyField{
			ID:       NewId(),
			GroupID:  NewId(),
			Name:     "test field",
			Type:     PropertyFieldTypeText,
			CreateAt: 0,
			UpdateAt: GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("zero UpdateAt", func(t *testing.T) {
		pf := &PropertyField{
			ID:       NewId(),
			GroupID:  NewId(),
			Name:     "test field",
			Type:     PropertyFieldTypeText,
			CreateAt: GetMillis(),
			UpdateAt: 0,
		}
		require.Error(t, pf.IsValid())
	})
}

func TestPropertyFieldPatch_IsValid(t *testing.T) {
	t.Run("valid patch", func(t *testing.T) {
		patch := &PropertyFieldPatch{
			Name: NewPointer("test field"),
			Type: NewPointer(PropertyFieldTypeText),
		}
		require.NoError(t, patch.IsValid())
	})

	t.Run("empty name", func(t *testing.T) {
		patch := &PropertyFieldPatch{
			Name: NewPointer(""),
			Type: NewPointer(PropertyFieldTypeText),
		}
		require.Error(t, patch.IsValid())
	})

	t.Run("invalid type", func(t *testing.T) {
		invalidType := PropertyFieldType("invalid")
		patch := &PropertyFieldPatch{
			Name: NewPointer("test field"),
			Type: &invalidType,
		}
		require.Error(t, patch.IsValid())
	})

	t.Run("nil values are valid", func(t *testing.T) {
		patch := &PropertyFieldPatch{
			Name: nil,
			Type: nil,
		}
		require.NoError(t, patch.IsValid())
	})
}

func TestPropertyField_Patch(t *testing.T) {
	t.Run("patches all fields", func(t *testing.T) {
		pf := &PropertyField{
			Name:       "original name",
			Type:       PropertyFieldTypeText,
			TargetID:   "original_target",
			TargetType: "original_type",
		}

		patch := &PropertyFieldPatch{
			Name:       NewPointer("new name"),
			Type:       NewPointer(PropertyFieldTypeSelect),
			TargetID:   NewPointer("new_target"),
			TargetType: NewPointer("new_type"),
			Attrs:      &StringInterface{"key": "value"},
		}

		pf.Patch(patch)

		assert.Equal(t, "new name", pf.Name)
		assert.Equal(t, PropertyFieldTypeSelect, pf.Type)
		assert.Equal(t, "new_target", pf.TargetID)
		assert.Equal(t, "new_type", pf.TargetType)
		assert.EqualValues(t, StringInterface{"key": "value"}, pf.Attrs)
	})

	t.Run("patches only specified fields", func(t *testing.T) {
		pf := &PropertyField{
			Name:       "original name",
			Type:       PropertyFieldTypeText,
			TargetID:   "original_target",
			TargetType: "original_type",
		}

		patch := &PropertyFieldPatch{
			Name: NewPointer("new name"),
		}

		pf.Patch(patch)

		assert.Equal(t, "new name", pf.Name)
		assert.Equal(t, PropertyFieldTypeText, pf.Type)
		assert.Equal(t, "original_target", pf.TargetID)
		assert.Equal(t, "original_type", pf.TargetType)
	})
}

func TestPropertyFieldSearchCursor_IsValid(t *testing.T) {
	t.Run("empty cursor is valid", func(t *testing.T) {
		cursor := PropertyFieldSearchCursor{}
		assert.NoError(t, cursor.IsValid())
	})

	t.Run("valid cursor", func(t *testing.T) {
		cursor := PropertyFieldSearchCursor{
			PropertyFieldID: NewId(),
			CreateAt:        GetMillis(),
		}
		assert.NoError(t, cursor.IsValid())
	})

	t.Run("invalid PropertyFieldID", func(t *testing.T) {
		cursor := PropertyFieldSearchCursor{
			PropertyFieldID: "invalid",
			CreateAt:        GetMillis(),
		}
		assert.Error(t, cursor.IsValid())
	})

	t.Run("zero CreateAt", func(t *testing.T) {
		cursor := PropertyFieldSearchCursor{
			PropertyFieldID: NewId(),
			CreateAt:        0,
		}
		assert.Error(t, cursor.IsValid())
	})

	t.Run("negative CreateAt", func(t *testing.T) {
		cursor := PropertyFieldSearchCursor{
			PropertyFieldID: NewId(),
			CreateAt:        -1,
		}
		assert.Error(t, cursor.IsValid())
	})
}

func TestPluginPropertyOption(t *testing.T) {
	t.Run("NewPluginPropertyOption", func(t *testing.T) {
		id := NewId()
		option := NewPluginPropertyOption(id, "test-name")

		assert.Equal(t, id, option.GetID())
		assert.Equal(t, "test-name", option.GetName())
		assert.NoError(t, option.IsValid())
	})

	t.Run("SetID", func(t *testing.T) {
		option := &PluginPropertyOption{}
		newId := NewId()
		option.SetID(newId)

		assert.Equal(t, newId, option.GetID())
	})

	t.Run("GetValue and SetValue", func(t *testing.T) {
		option := NewPluginPropertyOption(NewId(), "test-name")

		option.SetValue("color", "red")
		option.SetValue("description", "test description")

		assert.Equal(t, "red", option.GetValue("color"))
		assert.Equal(t, "test description", option.GetValue("description"))
		assert.Equal(t, "", option.GetValue("nonexistent"))
	})

	t.Run("IsValid", func(t *testing.T) {
		tests := []struct {
			name    string
			option  *PluginPropertyOption
			wantErr bool
		}{
			{
				name:   "valid option",
				option: NewPluginPropertyOption(NewId(), "test-name"),
			},
			{
				name:    "nil data",
				option:  &PluginPropertyOption{},
				wantErr: true,
			},
			{
				name: "empty id",
				option: &PluginPropertyOption{
					Data: map[string]string{"name": "test"},
				},
				wantErr: true,
			},
			{
				name: "empty name",
				option: &PluginPropertyOption{
					Data: map[string]string{"id": NewId()},
				},
				wantErr: true,
			},
			{
				name: "invalid id",
				option: &PluginPropertyOption{
					Data: map[string]string{
						"id":   "invalid-id-format",
						"name": "test",
					},
				},
				wantErr: true,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.option.IsValid()
				if tt.wantErr {
					assert.Error(t, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("PropertyOptions with PluginPropertyOption", func(t *testing.T) {
		options := PropertyOptions[*PluginPropertyOption]{
			NewPluginPropertyOption(NewId(), "Option 1"),
			NewPluginPropertyOption(NewId(), "Option 2"),
		}

		// Add custom data
		options[0].SetValue("color", "blue")
		options[1].SetValue("description", "Second option")

		assert.NoError(t, options.IsValid())
		assert.Equal(t, "blue", options[0].GetValue("color"))
		assert.Equal(t, "Second option", options[1].GetValue("description"))
	})

	t.Run("PropertyField with PluginPropertyOptions", func(t *testing.T) {
		fieldID := NewId()
		groupID := NewId()
		fieldName := "Test Field"
		fieldType := PropertyFieldTypeSelect

		field := &PropertyField{
			ID:      fieldID,
			GroupID: groupID,
			Name:    fieldName,
			Type:    fieldType,
			Attrs:   make(StringInterface),
		}

		options := PropertyOptions[*PluginPropertyOption]{
			NewPluginPropertyOption(NewId(), "Option 1"),
			NewPluginPropertyOption(NewId(), "Option 2"),
		}

		field.Attrs[PropertyFieldAttributeOptions] = options

		// Verify the field properties are set correctly
		assert.Equal(t, fieldID, field.ID)
		assert.Equal(t, groupID, field.GroupID)
		assert.Equal(t, fieldName, field.Name)
		assert.Equal(t, fieldType, field.Type)

		// Test that we can retrieve the options
		if optionsFromField, err := NewPropertyOptionsFromFieldAttrs[*PluginPropertyOption](field.Attrs[PropertyFieldAttributeOptions]); err == nil {
			require.Len(t, optionsFromField, 2)
			assert.Equal(t, "Option 1", optionsFromField[0].GetName())
			assert.Equal(t, "Option 2", optionsFromField[1].GetName())
		} else {
			t.Fatalf("Failed to retrieve options from field: %v", err)
		}
	})
}
