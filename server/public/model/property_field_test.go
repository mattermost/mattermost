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

	t.Run("sets DeleteAt to 0 for new fields", func(t *testing.T) {
		pf := &PropertyField{DeleteAt: 12345}
		pf.PreSave()
		assert.Zero(t, pf.DeleteAt)
	})

	t.Run("always sets DeleteAt to 0", func(t *testing.T) {
		existingCreateAt := int64(12345)
		existingDeleteAt := int64(67890)
		pf := &PropertyField{
			CreateAt: existingCreateAt,
			DeleteAt: existingDeleteAt,
		}
		pf.PreSave()
		assert.Zero(t, pf.DeleteAt)
	})
}

func TestPropertyField_IsValid(t *testing.T) {
	t.Run("valid field", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
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

	t.Run("Name exceeds maximum length", func(t *testing.T) {
		longName := strings.Repeat("a", PropertyFieldNameMaxRunes+1)
		pf := &PropertyField{
			ID:       NewId(),
			GroupID:  NewId(),
			Name:     longName,
			Type:     PropertyFieldTypeText,
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("TargetType exceeds maximum length", func(t *testing.T) {
		longTargetType := strings.Repeat("a", PropertyFieldTargetTypeMaxRunes+1)
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: longTargetType,
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 invalid TargetType", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: "invalid",
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv1 custom TargetType is valid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: "custom_target",
			ObjectType: "",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("PSAv1 empty TargetType is valid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: "",
			ObjectType: "",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("PSAv2 empty TargetType is invalid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: "",
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 valid TargetType system", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("PSAv2 valid TargetType team with valid TargetID", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelTeam),
			TargetID:   NewId(),
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("PSAv2 valid TargetType channel with valid TargetID", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelChannel),
			TargetID:   NewId(),
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("PSAv2 system TargetType with non-empty TargetID is invalid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			TargetID:   NewId(),
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 team TargetType with empty TargetID is invalid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelTeam),
			TargetID:   "",
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 channel TargetType with empty TargetID is invalid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelChannel),
			TargetID:   "",
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 system ObjectType with system TargetType is valid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			ObjectType: PropertyFieldObjectTypeSystem,
			TargetType: string(PropertyFieldTargetLevelSystem),
			TargetID:   "",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("PSAv2 system ObjectType with team TargetType is invalid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			ObjectType: PropertyFieldObjectTypeSystem,
			TargetType: string(PropertyFieldTargetLevelTeam),
			TargetID:   NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 system ObjectType with channel TargetType is invalid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			ObjectType: PropertyFieldObjectTypeSystem,
			TargetType: string(PropertyFieldTargetLevelChannel),
			TargetID:   NewId(),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 team TargetType with invalid TargetID is invalid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelTeam),
			TargetID:   "not-a-valid-id",
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 channel TargetType with invalid TargetID is invalid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelChannel),
			TargetID:   "not-a-valid-id",
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv1 team TargetType without TargetID is valid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: "team",
			TargetID:   "",
			ObjectType: "",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("TargetID exceeds maximum length", func(t *testing.T) {
		longTargetID := strings.Repeat("a", PropertyFieldTargetIDMaxRunes+1)
		pf := &PropertyField{
			ID:       NewId(),
			GroupID:  NewId(),
			Name:     "test field",
			Type:     PropertyFieldTypeText,
			TargetID: longTargetID,
			CreateAt: GetMillis(),
			UpdateAt: GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("Name at maximum length is valid", func(t *testing.T) {
		maxLengthName := strings.Repeat("a", PropertyFieldNameMaxRunes)
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       maxLengthName,
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("TargetID at maximum length is valid", func(t *testing.T) {
		maxLengthTargetID := strings.Repeat("a", PropertyFieldTargetIDMaxRunes)
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			TargetID:   maxLengthTargetID,
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("empty ObjectType is valid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			ObjectType: "",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("ObjectType with value is valid", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			ObjectType: "post",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("ObjectType exceeds maximum length", func(t *testing.T) {
		longObjectType := strings.Repeat("a", PropertyFieldObjectTypeMaxRunes+1)
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			ObjectType: longObjectType,
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 invalid ObjectType", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			ObjectType: "invalid",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv2 valid ObjectType post", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			ObjectType: PropertyFieldObjectTypePost,
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("PSAv2 valid ObjectType channel", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			ObjectType: PropertyFieldObjectTypeChannel,
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("PSAv2 valid ObjectType user", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			TargetType: string(PropertyFieldTargetLevelSystem),
			ObjectType: PropertyFieldObjectTypeUser,
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("template object type requires TargetType", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "template field",
			Type:       PropertyFieldTypeSelect,
			ObjectType: PropertyFieldObjectTypeTemplate,
			TargetType: "",
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("template object type with valid TargetType", func(t *testing.T) {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "template field",
			Type:       PropertyFieldTypeSelect,
			ObjectType: PropertyFieldObjectTypeTemplate,
			TargetType: string(PropertyFieldTargetLevelSystem),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("valid LinkedFieldID", func(t *testing.T) {
		linkedID := NewId()
		pf := &PropertyField{
			ID:            NewId(),
			GroupID:       NewId(),
			Name:          "linked field",
			Type:          PropertyFieldTypeSelect,
			ObjectType:    PropertyFieldObjectTypeUser,
			TargetType:    string(PropertyFieldTargetLevelSystem),
			LinkedFieldID: &linkedID,
			CreateAt:      GetMillis(),
			UpdateAt:      GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("invalid LinkedFieldID format", func(t *testing.T) {
		invalidID := "not-a-valid-id"
		pf := &PropertyField{
			ID:            NewId(),
			GroupID:       NewId(),
			Name:          "linked field",
			Type:          PropertyFieldTypeSelect,
			ObjectType:    PropertyFieldObjectTypeUser,
			TargetType:    string(PropertyFieldTargetLevelSystem),
			LinkedFieldID: &invalidID,
			CreateAt:      GetMillis(),
			UpdateAt:      GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv1 cannot have protected set", func(t *testing.T) {
		pf := &PropertyField{
			ID:        NewId(),
			GroupID:   NewId(),
			Name:      "test field",
			Type:      PropertyFieldTypeText,
			Protected: true,
			CreateAt:  GetMillis(),
			UpdateAt:  GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("nil LinkedFieldID is valid", func(t *testing.T) {
		pf := &PropertyField{
			ID:            NewId(),
			GroupID:       NewId(),
			Name:          "regular field",
			Type:          PropertyFieldTypeText,
			TargetType:    string(PropertyFieldTargetLevelSystem),
			LinkedFieldID: nil,
			CreateAt:      GetMillis(),
			UpdateAt:      GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("empty string LinkedFieldID is valid", func(t *testing.T) {
		emptyID := ""
		pf := &PropertyField{
			ID:            NewId(),
			GroupID:       NewId(),
			Name:          "regular field",
			Type:          PropertyFieldTypeText,
			TargetType:    string(PropertyFieldTargetLevelSystem),
			LinkedFieldID: &emptyID,
			CreateAt:      GetMillis(),
			UpdateAt:      GetMillis(),
		}
		require.NoError(t, pf.IsValid())
	})

	t.Run("template field with LinkedFieldID is invalid", func(t *testing.T) {
		linkedID := NewId()
		pf := &PropertyField{
			ID:            NewId(),
			GroupID:       NewId(),
			Name:          "template field",
			Type:          PropertyFieldTypeSelect,
			ObjectType:    PropertyFieldObjectTypeTemplate,
			TargetType:    string(PropertyFieldTargetLevelSystem),
			LinkedFieldID: &linkedID,
			CreateAt:      GetMillis(),
			UpdateAt:      GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv1 cannot have permission_field set", func(t *testing.T) {
		pf := &PropertyField{
			ID:              NewId(),
			GroupID:         NewId(),
			Name:            "test field",
			Type:            PropertyFieldTypeText,
			PermissionField: NewPointer(PermissionLevelMember),
			CreateAt:        GetMillis(),
			UpdateAt:        GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv1 cannot have permission_values set", func(t *testing.T) {
		pf := &PropertyField{
			ID:               NewId(),
			GroupID:          NewId(),
			Name:             "test field",
			Type:             PropertyFieldTypeText,
			PermissionValues: NewPointer(PermissionLevelMember),
			CreateAt:         GetMillis(),
			UpdateAt:         GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv1 cannot have permission_options set", func(t *testing.T) {
		pf := &PropertyField{
			ID:                NewId(),
			GroupID:           NewId(),
			Name:              "test field",
			Type:              PropertyFieldTypeText,
			PermissionOptions: NewPointer(PermissionLevelMember),
			CreateAt:          GetMillis(),
			UpdateAt:          GetMillis(),
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("protected field validation", func(t *testing.T) {
		baseField := func() *PropertyField {
			return &PropertyField{
				ID:         NewId(),
				GroupID:    NewId(),
				Name:       "test field",
				Type:       PropertyFieldTypeText,
				TargetType: string(PropertyFieldTargetLevelSystem),
				ObjectType: "post",
				CreateAt:   GetMillis(),
				UpdateAt:   GetMillis(),
			}
		}

		t.Run("non-protected field without permissions is valid", func(t *testing.T) {
			pf := baseField()
			pf.Protected = false
			pf.PermissionField = nil
			require.NoError(t, pf.IsValid())
		})

		t.Run("non-protected field with admin or member field permission is valid", func(t *testing.T) {
			for _, level := range []PermissionLevel{PermissionLevelSysadmin, PermissionLevelMember} {
				pf := baseField()
				pf.Protected = false
				pf.PermissionField = NewPointer(level)
				pf.PermissionValues = NewPointer(PermissionLevelMember)
				pf.PermissionOptions = NewPointer(PermissionLevelMember)
				require.NoError(t, pf.IsValid(), "should be valid with field permission %s", level)
			}
		})

		t.Run("non-protected field with field=none is invalid", func(t *testing.T) {
			pf := baseField()
			pf.Protected = false
			pf.PermissionField = NewPointer(PermissionLevelNone)
			pf.PermissionValues = NewPointer(PermissionLevelMember)
			pf.PermissionOptions = NewPointer(PermissionLevelMember)
			require.Error(t, pf.IsValid())
		})

		t.Run("protected field with field=none is valid", func(t *testing.T) {
			pf := baseField()
			pf.Protected = true
			pf.PermissionField = NewPointer(PermissionLevelNone)
			pf.PermissionValues = NewPointer(PermissionLevelMember)
			pf.PermissionOptions = NewPointer(PermissionLevelSysadmin)
			require.NoError(t, pf.IsValid())
		})

		t.Run("protected field with nil permissions is invalid", func(t *testing.T) {
			pf := baseField()
			pf.Protected = true
			pf.PermissionField = nil
			require.Error(t, pf.IsValid())
		})

		t.Run("protected field with field=admin is invalid", func(t *testing.T) {
			pf := baseField()
			pf.Protected = true
			pf.PermissionField = NewPointer(PermissionLevelSysadmin)
			pf.PermissionValues = NewPointer(PermissionLevelMember)
			pf.PermissionOptions = NewPointer(PermissionLevelMember)
			require.Error(t, pf.IsValid())
		})

		t.Run("protected field with field=member is invalid", func(t *testing.T) {
			pf := baseField()
			pf.Protected = true
			pf.PermissionField = NewPointer(PermissionLevelMember)
			pf.PermissionValues = NewPointer(PermissionLevelMember)
			pf.PermissionOptions = NewPointer(PermissionLevelMember)
			require.Error(t, pf.IsValid())
		})

		t.Run("invalid permission_field value is rejected", func(t *testing.T) {
			pf := baseField()
			pf.PermissionField = NewPointer(PermissionLevel("bogus"))
			require.Error(t, pf.IsValid())
		})

		t.Run("invalid permission_values value is rejected", func(t *testing.T) {
			pf := baseField()
			pf.PermissionField = NewPointer(PermissionLevelMember)
			pf.PermissionValues = NewPointer(PermissionLevel("bogus"))
			require.Error(t, pf.IsValid())
		})

		t.Run("invalid permission_options value is rejected", func(t *testing.T) {
			pf := baseField()
			pf.PermissionField = NewPointer(PermissionLevelMember)
			pf.PermissionValues = NewPointer(PermissionLevelMember)
			pf.PermissionOptions = NewPointer(PermissionLevel("bogus"))
			require.Error(t, pf.IsValid())
		})
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

	t.Run("Name exceeds maximum length", func(t *testing.T) {
		longName := strings.Repeat("a", PropertyFieldNameMaxRunes+1)
		patch := &PropertyFieldPatch{
			Name: &longName,
		}
		require.Error(t, patch.IsValid())
	})

	t.Run("TargetType exceeds maximum length", func(t *testing.T) {
		longTargetType := strings.Repeat("a", PropertyFieldTargetTypeMaxRunes+1)
		patch := &PropertyFieldPatch{
			TargetType: &longTargetType,
		}
		require.Error(t, patch.IsValid())
	})

	t.Run("TargetID exceeds maximum length", func(t *testing.T) {
		longTargetID := strings.Repeat("a", PropertyFieldTargetIDMaxRunes+1)
		patch := &PropertyFieldPatch{
			TargetID: &longTargetID,
		}
		require.Error(t, patch.IsValid())
	})

	t.Run("Name at maximum length is valid", func(t *testing.T) {
		maxLengthName := strings.Repeat("a", PropertyFieldNameMaxRunes)
		patch := &PropertyFieldPatch{
			Name: &maxLengthName,
		}
		require.NoError(t, patch.IsValid())
	})

	t.Run("TargetID at maximum length is valid", func(t *testing.T) {
		maxLengthTargetID := strings.Repeat("a", PropertyFieldTargetIDMaxRunes)
		patch := &PropertyFieldPatch{
			TargetID: &maxLengthTargetID,
		}
		require.NoError(t, patch.IsValid())
	})

	t.Run("empty TargetType is valid", func(t *testing.T) {
		emptyTargetType := ""
		patch := &PropertyFieldPatch{
			TargetType: &emptyTargetType,
		}
		require.NoError(t, patch.IsValid())
	})

	t.Run("custom TargetType is valid", func(t *testing.T) {
		customTargetType := "custom_value"
		patch := &PropertyFieldPatch{
			TargetType: &customTargetType,
		}
		require.NoError(t, patch.IsValid())
	})

	t.Run("enum TargetType is valid", func(t *testing.T) {
		targetType := string(PropertyFieldTargetLevelSystem)
		patch := &PropertyFieldPatch{
			TargetType: &targetType,
		}
		require.NoError(t, patch.IsValid())
	})
}

func TestPropertyField_Patch(t *testing.T) {
	t.Run("replace mode patches all fields", func(t *testing.T) {
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

		pf.Patch(patch, false)

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

		pf.Patch(patch, false)

		assert.Equal(t, "new name", pf.Name)
		assert.Equal(t, PropertyFieldTypeText, pf.Type)
		assert.Equal(t, "original_target", pf.TargetID)
		assert.Equal(t, "original_type", pf.TargetType)
	})

	t.Run("replace mode replaces attrs entirely", func(t *testing.T) {
		pf := &PropertyField{
			Name:  "test",
			Type:  PropertyFieldTypeSelect,
			Attrs: StringInterface{"subtype": "color", "options": []any{"red", "blue"}},
		}

		patch := &PropertyFieldPatch{
			Attrs: &StringInterface{"options": []any{"green"}},
		}

		pf.Patch(patch, false)

		assert.Equal(t, StringInterface{"options": []any{"green"}}, pf.Attrs)
		assert.Nil(t, pf.Attrs["subtype"])
	})

	t.Run("merge preserves existing keys when patching a subset", func(t *testing.T) {
		pf := &PropertyField{
			Name:  "test",
			Type:  PropertyFieldTypeSelect,
			Attrs: StringInterface{"subtype": "color", "options": []any{"red", "blue"}},
		}

		patch := &PropertyFieldPatch{
			Attrs: &StringInterface{"options": []any{"green"}},
		}

		pf.Patch(patch, true)

		assert.Equal(t, "color", pf.Attrs["subtype"])
		assert.EqualValues(t, []any{"green"}, pf.Attrs["options"])
	})

	t.Run("merge with nil value deletes a key", func(t *testing.T) {
		pf := &PropertyField{
			Name:  "test",
			Type:  PropertyFieldTypeSelect,
			Attrs: StringInterface{"subtype": "color", "options": []any{"red"}},
		}

		patch := &PropertyFieldPatch{
			Attrs: &StringInterface{"subtype": nil},
		}

		pf.Patch(patch, true)

		_, exists := pf.Attrs["subtype"]
		assert.False(t, exists)
		assert.EqualValues(t, []any{"red"}, pf.Attrs["options"])
	})

	t.Run("merge on nil existing attrs initializes the map", func(t *testing.T) {
		pf := &PropertyField{
			Name: "test",
			Type: PropertyFieldTypeText,
		}

		patch := &PropertyFieldPatch{
			Attrs: &StringInterface{"key": "value"},
		}

		pf.Patch(patch, true)

		assert.Equal(t, StringInterface{"key": "value"}, pf.Attrs)
	})

	t.Run("merge on nil existing attrs with a nil key in the patch doesn't store the nil key", func(t *testing.T) {
		pf := &PropertyField{
			Name: "test",
			Type: PropertyFieldTypeText,
		}

		patch := &PropertyFieldPatch{
			Attrs: &StringInterface{"keep": "value", "remove": nil},
		}

		pf.Patch(patch, true)

		assert.Equal(t, "value", pf.Attrs["keep"])
		_, exists := pf.Attrs["remove"]
		assert.False(t, exists)
		assert.Len(t, pf.Attrs, 1)
	})

	t.Run("patch with empty LinkedFieldID clears the link", func(t *testing.T) {
		linkedID := NewId()
		pf := &PropertyField{
			Name:          "test",
			Type:          PropertyFieldTypeSelect,
			LinkedFieldID: &linkedID,
		}

		emptyStr := ""
		patch := &PropertyFieldPatch{
			LinkedFieldID: &emptyStr,
		}

		pf.Patch(patch, false)

		assert.Nil(t, pf.LinkedFieldID)
	})

	t.Run("patch with nil LinkedFieldID does not change the link", func(t *testing.T) {
		linkedID := NewId()
		pf := &PropertyField{
			Name:          "test",
			Type:          PropertyFieldTypeSelect,
			LinkedFieldID: &linkedID,
		}

		patch := &PropertyFieldPatch{
			LinkedFieldID: nil,
		}

		pf.Patch(patch, false)

		require.NotNil(t, pf.LinkedFieldID)
		assert.Equal(t, linkedID, *pf.LinkedFieldID)
	})

	t.Run("patch with same LinkedFieldID is a no-op", func(t *testing.T) {
		linkedID := NewId()
		pf := &PropertyField{
			Name:          "test",
			Type:          PropertyFieldTypeSelect,
			LinkedFieldID: &linkedID,
		}

		patch := &PropertyFieldPatch{
			LinkedFieldID: &linkedID,
		}

		pf.Patch(patch, false)

		require.NotNil(t, pf.LinkedFieldID)
		assert.Equal(t, linkedID, *pf.LinkedFieldID)
	})
}

func TestPropertyField_IsPSAv1(t *testing.T) {
	t.Run("basic ObjectType tests", func(t *testing.T) {
		testCases := []struct {
			name       string
			objectType string
			want       bool
		}{
			{
				name:       "returns true for empty ObjectType (PSAv1 legacy schema)",
				objectType: "",
				want:       true,
			},
			{
				name:       "returns false for post ObjectType (PSAv2 typed schema)",
				objectType: "post",
				want:       false,
			},
			{
				name:       "returns false for user ObjectType",
				objectType: "user",
				want:       false,
			},
			{
				name:       "returns false for channel ObjectType",
				objectType: "channel",
				want:       false,
			},
			{
				name:       "returns false for team ObjectType",
				objectType: "team",
				want:       false,
			},
			{
				name:       "returns false for board ObjectType",
				objectType: "board",
				want:       false,
			},
			{
				name:       "returns false for card ObjectType",
				objectType: "card",
				want:       false,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				pf := &PropertyField{
					ObjectType: tc.objectType,
				}
				assert.Equal(t, tc.want, pf.IsPSAv1(), "Expected IsPSAv1() to return %v for ObjectType=%q", tc.want, tc.objectType)
			})
		}
	})

	t.Run("returns true for zero-value PropertyField", func(t *testing.T) {
		pf := &PropertyField{}
		assert.True(t, pf.IsPSAv1(), "Zero-value PropertyField should be treated as PSAv1")
	})

	t.Run("works correctly when used with other fields set", func(t *testing.T) {
		// PSAv1 field with all other fields populated
		psav1Field := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "Legacy Field",
			Type:       PropertyFieldTypeText,
			TargetID:   NewId(),
			TargetType: "channel",
			ObjectType: "", // PSAv1
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		assert.True(t, psav1Field.IsPSAv1())

		// PSAv2 field with all other fields populated
		psav2Field := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "Modern Field",
			Type:       PropertyFieldTypeText,
			TargetID:   NewId(),
			TargetType: "channel",
			ObjectType: "post", // PSAv2
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		assert.False(t, psav2Field.IsPSAv1())
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

	t.Run("PluginPropertyOption JSON marshaling", func(t *testing.T) {
		opt := NewPluginPropertyOption("test-id", "Test Option")
		opt.SetValue("custom", "custom-value")
		opt.SetValue("color", "blue")

		// Test marshaling - should not wrap in "data"
		data, err := json.Marshal(opt)
		require.NoError(t, err)

		// Parse the JSON to verify structure
		var jsonMap map[string]string
		err = json.Unmarshal(data, &jsonMap)
		require.NoError(t, err)

		// Verify the JSON doesn't have a "data" wrapper
		assert.Equal(t, "test-id", jsonMap["id"])
		assert.Equal(t, "Test Option", jsonMap["name"])
		assert.Equal(t, "custom-value", jsonMap["custom"])
		assert.Equal(t, "blue", jsonMap["color"])

		// Test unmarshaling
		var newOpt PluginPropertyOption
		err = json.Unmarshal(data, &newOpt)
		require.NoError(t, err)

		assert.Equal(t, "test-id", newOpt.GetID())
		assert.Equal(t, "Test Option", newOpt.GetName())
		assert.Equal(t, "custom-value", newOpt.GetValue("custom"))
		assert.Equal(t, "blue", newOpt.GetValue("color"))
	})

	t.Run("PluginPropertyOption slice JSON marshaling", func(t *testing.T) {
		options := PropertyOptions[*PluginPropertyOption]{
			NewPluginPropertyOption("id1", "Option 1"),
			NewPluginPropertyOption("id2", "Option 2"),
		}
		options[0].SetValue("priority", "high")
		options[1].SetValue("priority", "low")

		// Test marshaling
		data, err := json.Marshal(options)
		require.NoError(t, err)

		// Verify the JSON structure doesn't have "data" wrappers
		var jsonArray []map[string]string
		err = json.Unmarshal(data, &jsonArray)
		require.NoError(t, err)
		require.Len(t, jsonArray, 2)

		assert.Equal(t, "id1", jsonArray[0]["id"])
		assert.Equal(t, "Option 1", jsonArray[0]["name"])
		assert.Equal(t, "high", jsonArray[0]["priority"])

		assert.Equal(t, "id2", jsonArray[1]["id"])
		assert.Equal(t, "Option 2", jsonArray[1]["name"])
		assert.Equal(t, "low", jsonArray[1]["priority"])

		// Test unmarshaling
		var newOptions PropertyOptions[*PluginPropertyOption]
		err = json.Unmarshal(data, &newOptions)
		require.NoError(t, err)
		require.Len(t, newOptions, 2)

		assert.Equal(t, "id1", newOptions[0].GetID())
		assert.Equal(t, "Option 1", newOptions[0].GetName())
		assert.Equal(t, "high", newOptions[0].GetValue("priority"))

		assert.Equal(t, "id2", newOptions[1].GetID())
		assert.Equal(t, "Option 2", newOptions[1].GetName())
		assert.Equal(t, "low", newOptions[1].GetValue("priority"))
	})
}

func TestPropertyField_EnsureOptionIDs(t *testing.T) {
	t.Run("generates IDs for multiselect options without IDs", func(t *testing.T) {
		pf := &PropertyField{
			Type: PropertyFieldTypeMultiselect,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Option 1"},
					map[string]any{"name": "Option 2"},
					map[string]any{"name": "Option 3"},
				},
			},
		}

		err := pf.EnsureOptionIDs()
		require.NoError(t, err)

		options := pf.Attrs[PropertyFieldAttributeOptions].([]any)
		require.Len(t, options, 3)

		for i, opt := range options {
			optMap := opt.(map[string]any)
			assert.NotEmpty(t, optMap["id"], "Option %d should have an ID", i)
			assert.Len(t, optMap["id"].(string), 26, "Option %d ID should be 26 characters", i)
		}
	})

	t.Run("generates IDs for select options without IDs", func(t *testing.T) {
		pf := &PropertyField{
			Type: PropertyFieldTypeSelect,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Option A"},
					map[string]any{"name": "Option B"},
				},
			},
		}

		err := pf.EnsureOptionIDs()
		require.NoError(t, err)

		options := pf.Attrs[PropertyFieldAttributeOptions].([]any)
		require.Len(t, options, 2)

		for i, opt := range options {
			optMap := opt.(map[string]any)
			assert.NotEmpty(t, optMap["id"], "Option %d should have an ID", i)
		}
	})

	t.Run("preserves existing IDs", func(t *testing.T) {
		existingID1 := "existing_id_1"
		existingID2 := "existing_id_2"

		pf := &PropertyField{
			Type: PropertyFieldTypeMultiselect,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: []any{
					map[string]any{"id": existingID1, "name": "Option 1"},
					map[string]any{"id": existingID2, "name": "Option 2"},
				},
			},
		}

		err := pf.EnsureOptionIDs()
		require.NoError(t, err)

		options := pf.Attrs[PropertyFieldAttributeOptions].([]any)
		assert.Equal(t, existingID1, options[0].(map[string]any)["id"])
		assert.Equal(t, existingID2, options[1].(map[string]any)["id"])
	})

	t.Run("mixes existing and new IDs", func(t *testing.T) {
		existingID := "existing_id"

		pf := &PropertyField{
			Type: PropertyFieldTypeMultiselect,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: []any{
					map[string]any{"id": existingID, "name": "Option 1"},
					map[string]any{"name": "Option 2"},
					map[string]any{"name": "Option 3"},
				},
			},
		}

		err := pf.EnsureOptionIDs()
		require.NoError(t, err)

		options := pf.Attrs[PropertyFieldAttributeOptions].([]any)

		// First option should keep existing ID
		assert.Equal(t, existingID, options[0].(map[string]any)["id"])

		// Other options should have generated IDs
		assert.NotEmpty(t, options[1].(map[string]any)["id"])
		assert.NotEmpty(t, options[2].(map[string]any)["id"])
		assert.NotEqual(t, existingID, options[1].(map[string]any)["id"])
		assert.NotEqual(t, existingID, options[2].(map[string]any)["id"])
	})

	t.Run("handles option with non-string ID field", func(t *testing.T) {
		pf := &PropertyField{
			Type: PropertyFieldTypeMultiselect,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Option 1", "id": 12345},
					map[string]any{"name": "Option 2", "id": nil},
				},
			},
		}

		err := pf.EnsureOptionIDs()
		require.NoError(t, err)

		options := pf.Attrs[PropertyFieldAttributeOptions].([]any)

		// Non-string IDs should be replaced with valid IDs
		id1 := options[0].(map[string]any)["id"]
		assert.IsType(t, "", id1)
		assert.Len(t, id1.(string), 26)

		id2 := options[1].(map[string]any)["id"]
		assert.IsType(t, "", id2)
		assert.Len(t, id2.(string), 26)
	})

	t.Run("returns error when options attribute is not a slice", func(t *testing.T) {
		pf := &PropertyField{
			ID:   "field123",
			Type: PropertyFieldTypeSelect,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: "not a slice",
			},
		}

		err := pf.EnsureOptionIDs()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "field123")
	})

	t.Run("returns error when option is not a map", func(t *testing.T) {
		pf := &PropertyField{
			ID:   "field456",
			Type: PropertyFieldTypeMultiselect,
			Attrs: StringInterface{
				PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Valid Option", "id": "valid_id"},
					"not a map",
				},
			},
		}

		err := pf.EnsureOptionIDs()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "field456")
	})
}
