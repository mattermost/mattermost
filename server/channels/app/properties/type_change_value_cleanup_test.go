// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestTypeChangeValueCleanupHook verifies the post-update hook detects a Type
// change and deletes the field's dependent property values, surfacing the
// cleared field IDs to the caller.
func TestTypeChangeValueCleanupHook(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.AddHook(NewTypeChangeValueCleanupHook(th.service))

	t.Run("type change deletes values and reports cleared field id", func(t *testing.T) {
		// Create a select field with two options.
		optionAID := model.NewId()
		optionBID := model.NewId()
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "select-field-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []map[string]any{
					{"id": optionAID, "name": "Option A"},
					{"id": optionBID, "name": "Option B"},
				},
			},
		}
		created, err := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, err)

		// Seed a value referencing one of the options.
		userID := model.NewId()
		raw, err := json.Marshal(optionAID)
		require.NoError(t, err)
		_, err = th.service.UpsertPropertyValue(th.Context, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetID:   userID,
			TargetType: model.PropertyValueTargetTypeUser,
			Value:      raw,
		})
		require.NoError(t, err)

		// Confirm the value exists pre-patch.
		preValues, err := th.service.SearchPropertyValues(th.Context, th.CPAGroupID, model.PropertyValueSearchOpts{
			FieldID: created.ID,
			PerPage: 10,
		})
		require.NoError(t, err)
		require.Len(t, preValues, 1)

		// Patch to type=text. AccessControlAttributeValidationHook strips the now-invalid
		// options attr; TypeChangeValueCleanupHook deletes the dependent value.
		created.Type = model.PropertyFieldTypeText
		_, clearedIDs, err := th.service.UpdatePropertyField(th.Context, th.CPAGroupID, created)
		require.NoError(t, err)
		assert.Equal(t, []string{created.ID}, clearedIDs, "expected post-hook to report the type-changed field as cleared")

		// Confirm the value is gone.
		postValues, err := th.service.SearchPropertyValues(th.Context, th.CPAGroupID, model.PropertyValueSearchOpts{
			FieldID: created.ID,
			PerPage: 10,
		})
		require.NoError(t, err)
		assert.Empty(t, postValues, "expected dependent values to be cleared")
	})

	t.Run("multiselect type change deletes values and reports cleared field id", func(t *testing.T) {
		// Same shape as the select case above, but for multiselect.
		optionAID := model.NewId()
		optionBID := model.NewId()
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "multiselect-field-" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []map[string]any{
					{"id": optionAID, "name": "Option A"},
					{"id": optionBID, "name": "Option B"},
				},
			},
		}
		created, err := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, err)

		// Multiselect value is a JSON array of option IDs.
		userID := model.NewId()
		raw, err := json.Marshal([]string{optionAID, optionBID})
		require.NoError(t, err)
		_, err = th.service.UpsertPropertyValue(th.Context, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetID:   userID,
			TargetType: model.PropertyValueTargetTypeUser,
			Value:      raw,
		})
		require.NoError(t, err)

		preValues, err := th.service.SearchPropertyValues(th.Context, th.CPAGroupID, model.PropertyValueSearchOpts{
			FieldID: created.ID,
			PerPage: 10,
		})
		require.NoError(t, err)
		require.Len(t, preValues, 1)

		created.Type = model.PropertyFieldTypeText
		_, clearedIDs, err := th.service.UpdatePropertyField(th.Context, th.CPAGroupID, created)
		require.NoError(t, err)
		assert.Equal(t, []string{created.ID}, clearedIDs, "expected post-hook to report the type-changed field as cleared")

		postValues, err := th.service.SearchPropertyValues(th.Context, th.CPAGroupID, model.PropertyValueSearchOpts{
			FieldID: created.ID,
			PerPage: 10,
		})
		require.NoError(t, err)
		assert.Empty(t, postValues, "expected dependent values to be cleared")
	})

	t.Run("same-type patch is a no-op for cleanup", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "text-field-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, err := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, err)

		raw, err := json.Marshal("hello")
		require.NoError(t, err)
		_, err = th.service.UpsertPropertyValue(th.Context, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypeUser,
			Value:      raw,
		})
		require.NoError(t, err)

		// Rename only — no Type change.
		created.Name = "text-field-renamed-" + model.NewId()
		_, clearedIDs, err := th.service.UpdatePropertyField(th.Context, th.CPAGroupID, created)
		require.NoError(t, err)
		assert.Empty(t, clearedIDs, "rename without type change must not clear values")

		values, err := th.service.SearchPropertyValues(th.Context, th.CPAGroupID, model.PropertyValueSearchOpts{
			FieldID: created.ID,
			PerPage: 10,
		})
		require.NoError(t, err)
		assert.Len(t, values, 1, "value must survive a rename")
	})

	t.Run("select<->rank transition preserves values", func(t *testing.T) {
		optionAID := model.NewId()
		optionBID := model.NewId()

		for _, tc := range []struct {
			name     string
			fromType model.PropertyFieldType
			toType   model.PropertyFieldType
		}{
			{"select->rank", model.PropertyFieldTypeSelect, model.PropertyFieldTypeRank},
			{"rank->select", model.PropertyFieldTypeRank, model.PropertyFieldTypeSelect},
		} {
			t.Run(tc.name, func(t *testing.T) {
				field := &model.PropertyField{
					GroupID:    th.CPAGroupID,
					Name:       tc.name + "-" + model.NewId(),
					Type:       tc.fromType,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Attrs: model.StringInterface{
						model.PropertyFieldAttributeOptions: []map[string]any{
							{"id": optionAID, "name": "Option A"},
							{"id": optionBID, "name": "Option B"},
						},
					},
				}
				created, err := th.service.CreatePropertyField(th.Context, field)
				require.NoError(t, err)

				raw, err := json.Marshal(optionAID)
				require.NoError(t, err)
				_, err = th.service.UpsertPropertyValue(th.Context, &model.PropertyValue{
					GroupID:    th.CPAGroupID,
					FieldID:    created.ID,
					TargetID:   model.NewId(),
					TargetType: model.PropertyValueTargetTypeUser,
					Value:      raw,
				})
				require.NoError(t, err)

				created.Type = tc.toType
				_, clearedIDs, err := th.service.UpdatePropertyField(th.Context, th.CPAGroupID, created)
				require.NoError(t, err)
				assert.Empty(t, clearedIDs, "select<->rank transition must not clear values")

				values, err := th.service.SearchPropertyValues(th.Context, th.CPAGroupID, model.PropertyValueSearchOpts{
					FieldID: created.ID,
					PerPage: 10,
				})
				require.NoError(t, err)
				assert.Len(t, values, 1, "value must survive a select<->rank type change")
			})
		}
	})

	t.Run("plural batch reports cleared ids per affected field", func(t *testing.T) {
		// Field 1: select with a value, will be patched to text → cleanup expected.
		optID := model.NewId()
		f1 := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "batch-select-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []map[string]any{
					{"id": optID, "name": "Only Option"},
				},
			},
		}
		created1, err := th.service.CreatePropertyField(th.Context, f1)
		require.NoError(t, err)

		// Field 2: text, will be renamed only → no cleanup expected.
		f2 := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "batch-text-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created2, err := th.service.CreatePropertyField(th.Context, f2)
		require.NoError(t, err)

		raw, err := json.Marshal(optID)
		require.NoError(t, err)
		_, err = th.service.UpsertPropertyValue(th.Context, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created1.ID,
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypeUser,
			Value:      raw,
		})
		require.NoError(t, err)

		// Mutate both: f1 changes Type, f2 changes Name only.
		created1.Type = model.PropertyFieldTypeText
		created2.Name = "batch-text-renamed-" + model.NewId()

		_, _, clearedIDs, err := th.service.UpdatePropertyFields(th.Context, th.CPAGroupID, []*model.PropertyField{created1, created2})
		require.NoError(t, err)
		assert.Equal(t, []string{created1.ID}, clearedIDs, "only the type-changed field should be in clearedIDs")
	})
}
