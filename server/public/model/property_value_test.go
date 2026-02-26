// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyValue_PreSave(t *testing.T) {
	t.Run("sets ID if empty", func(t *testing.T) {
		pv := &PropertyValue{}
		pv.PreSave()
		assert.NotEmpty(t, pv.ID)
		assert.Len(t, pv.ID, 26) // Length of NewId()
	})

	t.Run("keeps existing ID", func(t *testing.T) {
		pv := &PropertyValue{ID: "existing_id"}
		pv.PreSave()
		assert.Equal(t, "existing_id", pv.ID)
	})

	t.Run("sets CreateAt if zero", func(t *testing.T) {
		pv := &PropertyValue{}
		pv.PreSave()
		assert.NotZero(t, pv.CreateAt)
	})

	t.Run("sets UpdateAt equal to CreateAt", func(t *testing.T) {
		pv := &PropertyValue{}
		pv.PreSave()
		assert.Equal(t, pv.CreateAt, pv.UpdateAt)
	})
}

func TestPropertyValue_IsValid(t *testing.T) {
	t.Run("valid value", func(t *testing.T) {
		value := json.RawMessage(`{"test": "value"}`)
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: "test_type",
			GroupID:    NewId(),
			FieldID:    NewId(),
			Value:      value,
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pv.IsValid())
	})

	t.Run("invalid ID", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         "invalid",
			TargetID:   NewId(),
			TargetType: "test_type",
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("invalid TargetID", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   "invalid",
			TargetType: "test_type",
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("empty TargetType", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: "",
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("invalid GroupID", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: "test_type",
			GroupID:    "invalid",
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("invalid FieldID", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: "test_type",
			GroupID:    NewId(),
			FieldID:    "invalid",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("zero CreateAt", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: "test_type",
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   0,
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("zero UpdateAt", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: "test_type",
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   0,
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("TargetType exceeds maximum length", func(t *testing.T) {
		longTargetType := strings.Repeat("a", PropertyValueTargetTypeMaxRunes+1)
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: longTargetType,
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("TargetType at maximum length is valid", func(t *testing.T) {
		maxLengthTargetType := strings.Repeat("a", PropertyValueTargetTypeMaxRunes)
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: maxLengthTargetType,
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pv.IsValid())
	})
}

func TestPropertyValueSearchCursor_IsValid(t *testing.T) {
	t.Run("empty cursor is valid", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{}
		assert.NoError(t, cursor.IsValid())
	})

	t.Run("valid cursor", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{
			PropertyValueID: NewId(),
			CreateAt:        GetMillis(),
		}
		assert.NoError(t, cursor.IsValid())
	})

	t.Run("invalid PropertyValueID", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{
			PropertyValueID: "invalid",
			CreateAt:        GetMillis(),
		}
		assert.Error(t, cursor.IsValid())
	})

	t.Run("zero CreateAt", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{
			PropertyValueID: NewId(),
			CreateAt:        0,
		}
		assert.Error(t, cursor.IsValid())
	})

	t.Run("negative CreateAt", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{
			PropertyValueID: NewId(),
			CreateAt:        -1,
		}
		assert.Error(t, cursor.IsValid())
	})
}
