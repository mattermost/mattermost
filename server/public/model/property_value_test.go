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

	t.Run("system TargetType with system sentinel TargetID is valid", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   PropertyValueSystemTargetID,
			TargetType: PropertyValueTargetTypeSystem,
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pv.IsValid())
	})

	t.Run("system TargetType with arbitrary TargetID is invalid", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   NewId(),
			TargetType: PropertyValueTargetTypeSystem,
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})

	t.Run("non-system TargetType with system sentinel TargetID is invalid", func(t *testing.T) {
		pv := &PropertyValue{
			ID:         NewId(),
			TargetID:   PropertyValueSystemTargetID,
			TargetType: PropertyValueTargetTypeChannel,
			GroupID:    NewId(),
			FieldID:    NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pv.IsValid())
	})
}

func TestPropertyValueSearchCursor_IsValid(t *testing.T) {
	t.Run("empty cursor is valid", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{}
		assert.NoError(t, cursor.IsValid())
	})

	t.Run("valid cursor with CreateAt", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{
			PropertyValueID: NewId(),
			CreateAt:        GetMillis(),
		}
		assert.NoError(t, cursor.IsValid())
	})

	t.Run("valid cursor with UpdateAt", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{
			PropertyValueID: NewId(),
			UpdateAt:        GetMillis(),
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

	t.Run("neither CreateAt nor UpdateAt set", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{
			PropertyValueID: NewId(),
		}
		assert.Error(t, cursor.IsValid())
	})

	t.Run("both CreateAt and UpdateAt set", func(t *testing.T) {
		cursor := PropertyValueSearchCursor{
			PropertyValueID: NewId(),
			CreateAt:        GetMillis(),
			UpdateAt:        GetMillis(),
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

func TestPropertyValueSearchOpts_IsValid(t *testing.T) {
	t.Run("empty opts is valid", func(t *testing.T) {
		opts := PropertyValueSearchOpts{}
		assert.NoError(t, opts.IsValid())
	})

	t.Run("since without cursor is valid", func(t *testing.T) {
		opts := PropertyValueSearchOpts{SinceUpdateAt: 1000}
		assert.NoError(t, opts.IsValid())
	})

	t.Run("delta mode with matching cursor_update_at is valid", func(t *testing.T) {
		opts := PropertyValueSearchOpts{
			SinceUpdateAt: 1000,
			Cursor: PropertyValueSearchCursor{
				PropertyValueID: NewId(),
				UpdateAt:        1500,
			},
		}
		assert.NoError(t, opts.IsValid())
	})

	t.Run("directory mode with matching cursor_create_at is valid", func(t *testing.T) {
		opts := PropertyValueSearchOpts{
			Cursor: PropertyValueSearchCursor{
				PropertyValueID: NewId(),
				CreateAt:        1500,
			},
		}
		assert.NoError(t, opts.IsValid())
	})

	t.Run("delta mode with cursor_create_at is invalid", func(t *testing.T) {
		opts := PropertyValueSearchOpts{
			SinceUpdateAt: 1000,
			Cursor: PropertyValueSearchCursor{
				PropertyValueID: NewId(),
				CreateAt:        1500,
			},
		}
		assert.Error(t, opts.IsValid())
	})

	t.Run("directory mode with cursor_update_at is invalid", func(t *testing.T) {
		opts := PropertyValueSearchOpts{
			Cursor: PropertyValueSearchCursor{
				PropertyValueID: NewId(),
				UpdateAt:        1500,
			},
		}
		assert.Error(t, opts.IsValid())
	})

	t.Run("invalid cursor surfaces error", func(t *testing.T) {
		opts := PropertyValueSearchOpts{
			Cursor: PropertyValueSearchCursor{
				PropertyValueID: "invalid",
				CreateAt:        1500,
			},
		}
		assert.Error(t, opts.IsValid())
	})

	t.Run("cursor with ID but neither create_at nor update_at is invalid", func(t *testing.T) {
		opts := PropertyValueSearchOpts{
			Cursor: PropertyValueSearchCursor{
				PropertyValueID: NewId(),
			},
		}
		assert.Error(t, opts.IsValid())
	})
}

func TestSanitizePropertyValue(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"empty bytes", "", ""},
		{"string trimmed", `"  hello  "`, `"hello"`},
		{"string unchanged", `"hello"`, `"hello"`},
		{"string all whitespace", `"   "`, `""`},
		{"string already empty", `""`, `""`},
		{"string array trimmed and filtered", `["  a  ", "", "  ", "b"]`, `["a","b"]`},
		{"string array unchanged", `["a","b"]`, `["a","b"]`},
		{"string array all empty", `["", "   ", ""]`, `[]`},
		{"number passthrough", `42`, `42`},
		{"boolean passthrough", `true`, `true`},
		{"null passthrough", `null`, `null`},
		{"object passthrough", `{"key":"  val  "}`, `{"key":"  val  "}`},
		{"nested array passthrough", `[["a","b"]]`, `[["a","b"]]`},
		{"mixed array passthrough", `["a",1]`, `["a",1]`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := SanitizePropertyValue(json.RawMessage(tc.in))
			assert.Equal(t, tc.want, string(got))
		})
	}

	t.Run("returns identity when no change", func(t *testing.T) {
		raw := json.RawMessage(`"hello"`)
		got := SanitizePropertyValue(raw)
		assert.Equal(t, &raw[0], &got[0], "expected same backing array when unchanged")
	})
}
