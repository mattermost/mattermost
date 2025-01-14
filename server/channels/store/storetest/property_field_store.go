// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"database/sql"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func TestPropertyFieldStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("CreatePropertyField", func(t *testing.T) { testCreatePropertyField(t, rctx, ss) })
	t.Run("GetPropertyField", func(t *testing.T) { testGetPropertyField(t, rctx, ss) })
	t.Run("GetManyPropertyFields", func(t *testing.T) { testGetManyPropertyFields(t, rctx, ss) })
	t.Run("UpdatePropertyField", func(t *testing.T) { testUpdatePropertyField(t, rctx, ss) })
	t.Run("DeletePropertyField", func(t *testing.T) { testDeletePropertyField(t, rctx, ss) })
	t.Run("SearchPropertyFields", func(t *testing.T) { testSearchPropertyFields(t, rctx, ss) })
}

func testCreatePropertyField(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail if the property field already has an ID set", func(t *testing.T) {
		newField := &model.PropertyField{ID: "sampleid"}
		field, err := ss.PropertyField().Create(newField)
		require.Zero(t, field)
		var eii *store.ErrInvalidInput
		require.ErrorAs(t, err, &eii)
	})

	t.Run("should fail if the property field is not valid", func(t *testing.T) {
		newField := &model.PropertyField{GroupID: ""}
		field, err := ss.PropertyField().Create(newField)
		require.Zero(t, field)
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")

		newField = &model.PropertyField{GroupID: model.NewId(), Name: ""}
		field, err = ss.PropertyField().Create(newField)
		require.Zero(t, field)
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")
	})

	newField := &model.PropertyField{
		GroupID: model.NewId(),
		Name:    "My new property field",
		Type:    model.PropertyFieldTypeText,
		Attrs: map[string]any{
			"locked":  true,
			"special": "value",
		},
	}

	t.Run("should be able to create a property field", func(t *testing.T) {
		field, err := ss.PropertyField().Create(newField)
		require.NoError(t, err)
		require.NotZero(t, field.ID)
		require.NotZero(t, field.CreateAt)
		require.NotZero(t, field.UpdateAt)
		require.Zero(t, field.DeleteAt)
	})

	t.Run("should enforce the field's uniqueness", func(t *testing.T) {
		newField.ID = ""
		field, err := ss.PropertyField().Create(newField)
		require.Error(t, err)
		require.Empty(t, field)
	})
}

func testGetPropertyField(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		field, err := ss.PropertyField().Get(model.NewId())
		require.Zero(t, field)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	t.Run("should be able to retrieve an existing property field", func(t *testing.T) {
		newField := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "My new property field",
			Type:    model.PropertyFieldTypeText,
			Attrs: map[string]any{
				"locked":  true,
				"special": "value",
			},
		}
		_, err := ss.PropertyField().Create(newField)
		require.NoError(t, err)
		require.NotZero(t, newField.ID)

		field, err := ss.PropertyField().Get(newField.ID)
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.True(t, field.Attrs["locked"].(bool))
		require.Equal(t, "value", field.Attrs["special"])
	})
}

func testGetManyPropertyFields(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting fields", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany([]string{model.NewId(), model.NewId()})
		require.Empty(t, fields)
		require.ErrorContains(t, err, "missmatch results")
	})

	newFields := []*model.PropertyField{}
	for _, fieldName := range []string{"field1", "field2", "field3"} {
		newField := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    fieldName,
			Type:    model.PropertyFieldTypeText,
		}
		_, err := ss.PropertyField().Create(newField)
		require.NoError(t, err)
		require.NotZero(t, newField.ID)

		newFields = append(newFields, newField)
	}

	t.Run("should fail if at least one of the ids is nonexistent", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany([]string{newFields[0].ID, newFields[1].ID, model.NewId()})
		require.Empty(t, fields)
		require.ErrorContains(t, err, "missmatch results")
	})

	t.Run("should be able to retrieve existing property fields", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany([]string{newFields[0].ID, newFields[1].ID, newFields[2].ID})
		require.NoError(t, err)
		require.Len(t, fields, 3)
		require.ElementsMatch(t, newFields, fields)
	})
}

func testUpdatePropertyField(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		field := &model.PropertyField{
			ID:       model.NewId(),
			GroupID:  model.NewId(),
			Name:     "My property field",
			Type:     model.PropertyFieldTypeText,
			CreateAt: model.GetMillis(),
		}
		updatedField, err := ss.PropertyField().Update([]*model.PropertyField{field})
		require.Zero(t, updatedField)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
	})

	t.Run("should fail if the property field is not valid", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "My property field",
			Type:    model.PropertyFieldTypeText,
		}
		_, err := ss.PropertyField().Create(field)
		require.NoError(t, err)
		require.NotZero(t, field.ID)

		field.GroupID = ""
		updatedField, err := ss.PropertyField().Update([]*model.PropertyField{field})
		require.Zero(t, updatedField)
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")

		field.GroupID = model.NewId()
		field.Name = ""
		updatedField, err = ss.PropertyField().Update([]*model.PropertyField{field})
		require.Zero(t, updatedField)
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")
	})

	t.Run("should be able to update multiple property fields", func(t *testing.T) {
		field1 := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "First field",
			Type:    model.PropertyFieldTypeText,
			Attrs: map[string]any{
				"locked":  true,
				"special": "value",
			},
		}

		field2 := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "Second field",
			Type:    model.PropertyFieldTypeSelect,
			Attrs: map[string]any{
				"options": []string{"a", "b"},
			},
		}

		for _, field := range []*model.PropertyField{field1, field2} {
			_, err := ss.PropertyField().Create(field)
			require.NoError(t, err)
			require.NotZero(t, field.ID)
		}
		time.Sleep(10 * time.Millisecond)

		field1.Name = "Updated first"
		field1.Type = model.PropertyFieldTypeSelect
		field1.Attrs = map[string]any{
			"locked":    false,
			"new_field": "new_value",
		}

		field2.Name = "Updated second"
		field2.Attrs = map[string]any{
			"options": []string{"x", "y", "z"},
		}

		_, err := ss.PropertyField().Update([]*model.PropertyField{field1, field2})
		require.NoError(t, err)

		// Verify first field
		updated1, err := ss.PropertyField().Get(field1.ID)
		require.NoError(t, err)
		require.Equal(t, "Updated first", updated1.Name)
		require.Equal(t, model.PropertyFieldTypeSelect, updated1.Type)
		require.False(t, updated1.Attrs["locked"].(bool))
		require.NotContains(t, updated1.Attrs, "special")
		require.Equal(t, "new_value", updated1.Attrs["new_field"])
		require.Greater(t, updated1.UpdateAt, updated1.CreateAt)

		// Verify second field
		updated2, err := ss.PropertyField().Get(field2.ID)
		require.NoError(t, err)
		require.Equal(t, "Updated second", updated2.Name)
		require.Equal(t, model.PropertyFieldTypeSelect, updated2.Type)
		require.ElementsMatch(t, []string{"x", "y", "z"}, updated2.Attrs["options"])
		require.Greater(t, updated2.UpdateAt, updated2.CreateAt)
	})

	t.Run("should not update any fields if one update is invalid", func(t *testing.T) {
		// Create two valid fields
		groupID := model.NewId()
		field1 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field 1",
			Type:    model.PropertyFieldTypeText,
			Attrs: map[string]any{
				"key": "value",
			},
		}

		field2 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field 2",
			Type:    model.PropertyFieldTypeText,
			Attrs: map[string]any{
				"key": "value",
			},
		}

		for _, field := range []*model.PropertyField{field1, field2} {
			_, err := ss.PropertyField().Create(field)
			require.NoError(t, err)
		}

		originalUpdateAt1 := field1.UpdateAt
		originalUpdateAt2 := field2.UpdateAt

		// Try to update both fields, but make one invalid
		field1.Name = "Valid update"
		field2.GroupID = "Invalid ID"

		_, err := ss.PropertyField().Update([]*model.PropertyField{field1, field2})
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")

		// Check that fields were not updated
		updated1, err := ss.PropertyField().Get(field1.ID)
		require.NoError(t, err)
		require.Equal(t, "Field 1", updated1.Name)
		require.Equal(t, originalUpdateAt1, updated1.UpdateAt)

		updated2, err := ss.PropertyField().Get(field2.ID)
		require.NoError(t, err)
		require.Equal(t, groupID, updated2.GroupID)
		require.Equal(t, originalUpdateAt2, updated2.UpdateAt)
	})
}

func testDeletePropertyField(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		err := ss.PropertyField().Delete(model.NewId())
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
	})

	newField := &model.PropertyField{
		GroupID: model.NewId(),
		Name:    "My property field",
		Type:    model.PropertyFieldTypeText,
	}

	t.Run("should be able to delete an existing property field", func(t *testing.T) {
		field, err := ss.PropertyField().Create(newField)
		require.NoError(t, err)
		require.NotEmpty(t, field.ID)

		err = ss.PropertyField().Delete(field.ID)
		require.NoError(t, err)

		// Verify the field was soft-deleted
		deletedField, err := ss.PropertyField().Get(field.ID)
		require.NoError(t, err)
		require.NotZero(t, deletedField.DeleteAt)
	})

	t.Run("should be able to create a new field with the same details as the deleted one", func(t *testing.T) {
		newField.ID = ""
		field, err := ss.PropertyField().Create(newField)
		require.NoError(t, err)
		require.NotEmpty(t, field.ID)
	})
}

func testSearchPropertyFields(t *testing.T, _ request.CTX, ss store.Store) {
	groupID := model.NewId()
	targetID := model.NewId()

	// Define test property fields
	field1 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 1",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID,
		TargetType: "test_type",
	}

	field2 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 2",
		Type:       model.PropertyFieldTypeSelect,
		TargetID:   targetID,
		TargetType: "other_type",
	}

	field3 := &model.PropertyField{
		GroupID:    model.NewId(),
		Name:       "Field 3",
		Type:       model.PropertyFieldTypeText,
		TargetType: "test_type",
	}

	field4 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 4",
		Type:       model.PropertyFieldTypeText,
		TargetType: "test_type",
	}

	for _, field := range []*model.PropertyField{field1, field2, field3, field4} {
		_, err := ss.PropertyField().Create(field)
		require.NoError(t, err)
		time.Sleep(10 * time.Millisecond)
	}

	// Delete one field for deletion tests
	require.NoError(t, ss.PropertyField().Delete(field4.ID))

	tests := []struct {
		name          string
		opts          model.PropertyFieldSearchOpts
		expectedError bool
		expectedIDs   []string
	}{
		{
			name: "negative page",
			opts: model.PropertyFieldSearchOpts{
				Page:    -1,
				PerPage: 10,
			},
			expectedError: true,
		},
		{
			name: "negative per_page",
			opts: model.PropertyFieldSearchOpts{
				Page:    0,
				PerPage: -1,
			},
			expectedError: true,
		},
		{
			name: "filter by group_id",
			opts: model.PropertyFieldSearchOpts{
				GroupID: groupID,
				Page:    0,
				PerPage: 10,
			},
			expectedIDs: []string{field1.ID, field2.ID},
		},
		{
			name: "filter by group_id including deleted",
			opts: model.PropertyFieldSearchOpts{
				GroupID:        groupID,
				Page:           0,
				PerPage:        10,
				IncludeDeleted: true,
			},
			expectedIDs: []string{field1.ID, field2.ID, field4.ID},
		},
		{
			name: "filter by target_type",
			opts: model.PropertyFieldSearchOpts{
				TargetType: "test_type",
				Page:       0,
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID, field3.ID},
		},
		{
			name: "filter by target_id",
			opts: model.PropertyFieldSearchOpts{
				TargetID: targetID,
				Page:     0,
				PerPage:  10,
			},
			expectedIDs: []string{field1.ID, field2.ID},
		},
		{
			name: "pagination page 0",
			opts: model.PropertyFieldSearchOpts{
				GroupID:        groupID,
				Page:           0,
				PerPage:        2,
				IncludeDeleted: true,
			},
			expectedIDs: []string{field1.ID, field2.ID},
		},
		{
			name: "pagination page 1",
			opts: model.PropertyFieldSearchOpts{
				GroupID:        groupID,
				Page:           1,
				PerPage:        2,
				IncludeDeleted: true,
			},
			expectedIDs: []string{field4.ID},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			results, err := ss.PropertyField().SearchPropertyFields(tc.opts)
			if tc.expectedError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			var ids = make([]string, len(results))
			for i, field := range results {
				ids[i] = field.ID
			}
			require.ElementsMatch(t, tc.expectedIDs, ids)
		})
	}
}
