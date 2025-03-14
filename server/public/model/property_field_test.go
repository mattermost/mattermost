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

func TestPropertyField_SanitizeInput(t *testing.T) {
	t.Run("trims spaces from name", func(t *testing.T) {
		pf := &PropertyField{Name: "  test field  "}
		pf.SanitizeInput()
		assert.Equal(t, "test field", pf.Name)
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
