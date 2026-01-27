// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"database/sql"
	"fmt"
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
	t.Run("GetFieldByName", func(t *testing.T) { testGetFieldByName(t, rctx, ss) })
	t.Run("UpdatePropertyField", func(t *testing.T) { testUpdatePropertyField(t, rctx, ss) })
	t.Run("DeletePropertyField", func(t *testing.T) { testDeletePropertyField(t, rctx, ss) })
	t.Run("SearchPropertyFields", func(t *testing.T) { testSearchPropertyFields(t, rctx, ss) })
	t.Run("SearchPropertyFieldsSince", func(t *testing.T) { testSearchPropertyFieldsSince(t, rctx, ss) })
	t.Run("CountForGroup", func(t *testing.T) { testCountForGroup(t, rctx, ss) })
	t.Run("CheckPropertyNameConflict", func(t *testing.T) { testCheckPropertyNameConflict(t, rctx, ss) })
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

	creatorUserID := model.NewId()

	newField := &model.PropertyField{
		GroupID:   model.NewId(),
		Name:      "My new property field",
		Type:      model.PropertyFieldTypeText,
		CreatedBy: creatorUserID,
		UpdatedBy: creatorUserID,
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
		require.Equal(t, creatorUserID, field.CreatedBy)
		require.Equal(t, creatorUserID, field.UpdatedBy)
	})

	t.Run("should enforce the field's uniqueness", func(t *testing.T) {
		newField.ID = ""
		field, err := ss.PropertyField().Create(newField)
		require.Error(t, err)
		require.Empty(t, field)
	})

	t.Run("should allow empty CreatedBy and UpdatedBy", func(t *testing.T) {
		fieldWithoutTracking := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "Field without user tracking",
			Type:    model.PropertyFieldTypeText,
		}
		field, err := ss.PropertyField().Create(fieldWithoutTracking)
		require.NoError(t, err)
		require.Empty(t, field.CreatedBy)
		require.Empty(t, field.UpdatedBy)
	})

	t.Run("should be able to create a property field with ObjectType", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Field with ObjectType",
			Type:       model.PropertyFieldTypeText,
			ObjectType: "create_test_type",
			TargetID:   model.NewId(),
			TargetType: string(model.PropertyFieldTargetLevelChannel),
		}
		created, err := ss.PropertyField().Create(field)
		require.NoError(t, err)
		require.NotZero(t, created.ID)
		require.Equal(t, "create_test_type", created.ObjectType)

		// Verify it can be retrieved with ObjectType intact
		retrieved, err := ss.PropertyField().Get("", created.ID)
		require.NoError(t, err)
		require.Equal(t, "create_test_type", retrieved.ObjectType)
	})

	t.Run("should be able to create a property field without ObjectType for backwards compatibility", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Field without ObjectType",
			Type:       model.PropertyFieldTypeText,
			TargetID:   model.NewId(),
			TargetType: string(model.PropertyFieldTargetLevelChannel),
		}
		created, err := ss.PropertyField().Create(field)
		require.NoError(t, err)
		require.NotZero(t, created.ID)
		require.Empty(t, created.ObjectType)

		// Verify it can be retrieved
		retrieved, err := ss.PropertyField().Get("", created.ID)
		require.NoError(t, err)
		require.Empty(t, retrieved.ObjectType)
	})
}

func testGetPropertyField(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		field, err := ss.PropertyField().Get("", model.NewId())
		require.Zero(t, field)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	groupID := model.NewId()
	newField := &model.PropertyField{
		GroupID: groupID,
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

	t.Run("should be able to retrieve an existing property field", func(t *testing.T) {
		field, err := ss.PropertyField().Get(groupID, newField.ID)
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.True(t, field.Attrs["locked"].(bool))
		require.Equal(t, "value", field.Attrs["special"])

		// should work without specifying the group ID as well
		field, err = ss.PropertyField().Get("", newField.ID)
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.True(t, field.Attrs["locked"].(bool))
		require.Equal(t, "value", field.Attrs["special"])
	})

	t.Run("should not be able to retrieve an existing field when specifying a different group ID", func(t *testing.T) {
		field, err := ss.PropertyField().Get(model.NewId(), newField.ID)
		require.Zero(t, field)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})
}

func testGetManyPropertyFields(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting fields", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany("", []string{model.NewId(), model.NewId()})
		require.Empty(t, fields)
		require.ErrorContains(t, err, "missmatch results")
	})

	groupID := model.NewId()
	newFields := []*model.PropertyField{}
	for _, fieldName := range []string{"field1", "field2", "field3"} {
		newField := &model.PropertyField{
			GroupID: groupID,
			Name:    fieldName,
			Type:    model.PropertyFieldTypeText,
		}
		_, err := ss.PropertyField().Create(newField)
		require.NoError(t, err)
		require.NotZero(t, newField.ID)

		newFields = append(newFields, newField)
	}

	newFieldOutsideGroup := &model.PropertyField{
		GroupID: model.NewId(),
		Name:    "field outside the groupID",
		Type:    model.PropertyFieldTypeText,
	}
	_, err := ss.PropertyField().Create(newFieldOutsideGroup)
	require.NoError(t, err)
	require.NotZero(t, newFieldOutsideGroup.ID)

	t.Run("should fail if at least one of the ids is nonexistent", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany(groupID, []string{newFields[0].ID, newFields[1].ID, model.NewId()})
		require.Empty(t, fields)
		require.ErrorContains(t, err, "missmatch results")
	})

	t.Run("should be able to retrieve existing property fields", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany(groupID, []string{newFields[0].ID, newFields[1].ID, newFields[2].ID})
		require.NoError(t, err)
		require.Len(t, fields, 3)
		require.ElementsMatch(t, newFields, fields)
	})

	t.Run("should fail if asked for valid IDs but outside the group", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany(groupID, []string{newFields[0].ID, newFieldOutsideGroup.ID})
		require.Empty(t, fields)
		require.ErrorContains(t, err, "missmatch results")
	})

	t.Run("should be able to retrieve existing property fields from multiple groups", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany("", []string{newFields[0].ID, newFieldOutsideGroup.ID})
		require.NoError(t, err)
		require.Len(t, fields, 2)
	})
}

func testGetFieldByName(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByName("", "", "nonexistent-field-name")
		require.Zero(t, field)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	groupID := model.NewId()
	targetID := model.NewId()
	newField := &model.PropertyField{
		GroupID:  groupID,
		TargetID: targetID,
		Name:     "unique-field-name",
		Type:     model.PropertyFieldTypeText,
		Attrs: map[string]any{
			"locked":  true,
			"special": "value",
		},
	}
	_, cErr := ss.PropertyField().Create(newField)
	require.NoError(t, cErr)
	require.NotZero(t, newField.ID)

	t.Run("should be able to retrieve an existing property field by name", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByName(groupID, targetID, "unique-field-name")
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.Equal(t, "unique-field-name", field.Name)
		require.True(t, field.Attrs["locked"].(bool))
		require.Equal(t, "value", field.Attrs["special"])
	})

	t.Run("should not be able to retrieve an existing field when specifying a different group ID", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByName(model.NewId(), targetID, "unique-field-name")
		require.Zero(t, field)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	t.Run("should not be able to retrieve an existing field when specifying a different target ID", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByName(groupID, model.NewId(), "unique-field-name")
		require.Zero(t, field)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	// Test with multiple fields with the same name but different groups
	anotherGroupID := model.NewId()
	duplicateNameField := &model.PropertyField{
		GroupID:  anotherGroupID,
		TargetID: targetID,
		Name:     "unique-field-name", // Same name as the first field
		Type:     model.PropertyFieldTypeSelect,
		Attrs: map[string]any{
			"options": []string{"a", "b", "c"},
		},
	}
	_, cErr = ss.PropertyField().Create(duplicateNameField)
	require.NoError(t, cErr)
	require.NotZero(t, duplicateNameField.ID)

	t.Run("should retrieve the correct field when multiple fields have the same name but different groups", func(t *testing.T) {
		// Get the field from the first group
		field, err := ss.PropertyField().GetFieldByName(groupID, targetID, "unique-field-name")
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.Equal(t, model.PropertyFieldTypeText, field.Type)

		// Get the field from the second group
		field, err = ss.PropertyField().GetFieldByName(anotherGroupID, targetID, "unique-field-name")
		require.NoError(t, err)
		require.Equal(t, duplicateNameField.ID, field.ID)
		require.Equal(t, model.PropertyFieldTypeSelect, field.Type)
	})

	// Test with multiple fields with the same name and same group but different target IDs
	anotherTargetID := model.NewId()
	sameGroupDifferentTargetField := &model.PropertyField{
		GroupID:  groupID,
		TargetID: anotherTargetID,
		Name:     "unique-field-name", // Same name as the first field
		Type:     model.PropertyFieldTypeText,
		Attrs: map[string]any{
			"min": 1,
			"max": 100,
		},
	}
	_, cErr = ss.PropertyField().Create(sameGroupDifferentTargetField)
	require.NoError(t, cErr)
	require.NotZero(t, sameGroupDifferentTargetField.ID)

	t.Run("should retrieve the correct field when multiple fields have the same name and group but different target IDs", func(t *testing.T) {
		// Get the field with the first target ID
		field, err := ss.PropertyField().GetFieldByName(groupID, targetID, "unique-field-name")
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.Equal(t, model.PropertyFieldTypeText, field.Type)

		// Get the field with the second target ID
		field, err = ss.PropertyField().GetFieldByName(groupID, anotherTargetID, "unique-field-name")
		require.NoError(t, err)
		require.Equal(t, sameGroupDifferentTargetField.ID, field.ID)
		require.Equal(t, model.PropertyFieldTypeText, field.Type)
	})

	// Test with a deleted field
	t.Run("should not retrieve deleted fields", func(t *testing.T) {
		// Create another field with a unique name
		deletedField := &model.PropertyField{
			GroupID:  groupID,
			TargetID: targetID,
			Name:     "to-be-deleted-field",
			Type:     model.PropertyFieldTypeText,
		}
		_, cErr := ss.PropertyField().Create(deletedField)
		require.NoError(t, cErr)
		require.NotZero(t, deletedField.ID)

		// Verify it can be retrieved before deletion
		field, err := ss.PropertyField().GetFieldByName(groupID, targetID, "to-be-deleted-field")
		require.NoError(t, err)
		require.Equal(t, deletedField.ID, field.ID)

		// Delete the field
		err = ss.PropertyField().Delete("", deletedField.ID)
		require.NoError(t, err)

		// Verify it can't be retrieved after deletion
		field, err = ss.PropertyField().GetFieldByName(groupID, targetID, "to-be-deleted-field")
		require.Zero(t, field)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	t.Run("should not retrieve fields with matching name but different DeleteAt status", func(t *testing.T) {
		// Create a field with the same name/group/target as the deleted one
		replacementField := &model.PropertyField{
			GroupID:  groupID,
			TargetID: targetID,
			Name:     "to-be-deleted-field", // Same name as the deleted field
			Type:     model.PropertyFieldTypeText,
			Attrs: map[string]any{
				"min": 0,
				"max": 10,
			},
		}
		_, cErr := ss.PropertyField().Create(replacementField)
		require.NoError(t, cErr)
		require.NotZero(t, replacementField.ID)

		// Verify only the non-deleted field is retrieved
		field, err := ss.PropertyField().GetFieldByName(groupID, targetID, "to-be-deleted-field")
		require.NoError(t, err)
		require.Equal(t, replacementField.ID, field.ID)
		require.Equal(t, model.PropertyFieldTypeText, field.Type)
		require.Zero(t, field.DeleteAt)
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
		updatedField, err := ss.PropertyField().Update("", []*model.PropertyField{field})
		require.Zero(t, updatedField)
		require.ErrorContains(t, err, "failed to update, some property fields were not found, got 0 of 1")
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
		updatedField, err := ss.PropertyField().Update("", []*model.PropertyField{field})
		require.Zero(t, updatedField)
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")

		field.GroupID = model.NewId()
		field.Name = ""
		updatedField, err = ss.PropertyField().Update("", []*model.PropertyField{field})
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

		_, err := ss.PropertyField().Update("", []*model.PropertyField{field1, field2})
		require.NoError(t, err)

		// Verify first field
		updated1, err := ss.PropertyField().Get("", field1.ID)
		require.NoError(t, err)
		require.Equal(t, "Updated first", updated1.Name)
		require.Equal(t, model.PropertyFieldTypeSelect, updated1.Type)
		require.False(t, updated1.Attrs["locked"].(bool))
		require.NotContains(t, updated1.Attrs, "special")
		require.Equal(t, "new_value", updated1.Attrs["new_field"])
		require.Greater(t, updated1.UpdateAt, updated1.CreateAt)

		// Verify second field
		updated2, err := ss.PropertyField().Get("", field2.ID)
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

		_, err := ss.PropertyField().Update("", []*model.PropertyField{field1, field2})
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")

		// Check that fields were not updated
		updated1, err := ss.PropertyField().Get("", field1.ID)
		require.NoError(t, err)
		require.Equal(t, "Field 1", updated1.Name)
		require.Equal(t, originalUpdateAt1, updated1.UpdateAt)

		updated2, err := ss.PropertyField().Get("", field2.ID)
		require.NoError(t, err)
		require.Equal(t, groupID, updated2.GroupID)
		require.Equal(t, originalUpdateAt2, updated2.UpdateAt)
	})

	t.Run("should not update any fields if one update points to a nonexisting one", func(t *testing.T) {
		// Create a valid field
		field1 := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "First field",
			Type:    model.PropertyFieldTypeText,
		}

		_, err := ss.PropertyField().Create(field1)
		require.NoError(t, err)

		originalUpdateAt := field1.UpdateAt

		// Try to update both the valid field and a nonexistent one
		field2 := &model.PropertyField{
			ID:         model.NewId(),
			GroupID:    model.NewId(),
			Name:       "Second field",
			Type:       model.PropertyFieldTypeText,
			TargetID:   model.NewId(),
			TargetType: "test_type",
			CreateAt:   1,
			Attrs: map[string]any{
				"key": "value",
			},
		}

		field1.Name = "Updated First"

		_, err = ss.PropertyField().Update("", []*model.PropertyField{field1, field2})
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to update, some property fields were not found")

		// Check that the valid field was not updated
		updated1, err := ss.PropertyField().Get("", field1.ID)
		require.NoError(t, err)
		require.Equal(t, "First field", updated1.Name)
		require.Equal(t, originalUpdateAt, updated1.UpdateAt)
	})

	t.Run("should update fields with matching groupID", func(t *testing.T) {
		// Create fields with the same groupID
		groupID := model.NewId()
		field1 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Group Field 1",
			Type:    model.PropertyFieldTypeText,
		}
		field2 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Group Field 2",
			Type:    model.PropertyFieldTypeText,
		}

		for _, field := range []*model.PropertyField{field1, field2} {
			_, err := ss.PropertyField().Create(field)
			require.NoError(t, err)
		}

		// Update the fields with the matching groupID
		field1.Name = "Updated Group Field 1"
		field2.Name = "Updated Group Field 2"

		updatedFields, err := ss.PropertyField().Update(groupID, []*model.PropertyField{field1, field2})
		require.NoError(t, err)
		require.Len(t, updatedFields, 2)

		// Verify the fields were updated
		for _, field := range []*model.PropertyField{field1, field2} {
			updated, err := ss.PropertyField().Get("", field.ID)
			require.NoError(t, err)
			require.Contains(t, updated.Name, "Updated Group Field")
		}
	})

	t.Run("should not update fields with non-matching groupID", func(t *testing.T) {
		// Create fields with different groupIDs
		groupID1 := model.NewId()
		groupID2 := model.NewId()

		field1 := &model.PropertyField{
			GroupID: groupID1,
			Name:    "Field in Group 1",
			Type:    model.PropertyFieldTypeText,
		}
		field2 := &model.PropertyField{
			GroupID: groupID2,
			Name:    "Field in Group 2",
			Type:    model.PropertyFieldTypeText,
		}

		for _, field := range []*model.PropertyField{field1, field2} {
			_, err := ss.PropertyField().Create(field)
			require.NoError(t, err)
		}

		originalName1 := field1.Name
		originalName2 := field2.Name

		// Try to update both fields but filter by groupID1
		field1.Name = "Updated Field in Group 1"
		field2.Name = "Updated Field in Group 2"

		_, err := ss.PropertyField().Update(groupID1, []*model.PropertyField{field1, field2})
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to update, some property fields were not found")

		// Verify neither field was updated due to transaction rollback
		updated1, err := ss.PropertyField().Get("", field1.ID)
		require.NoError(t, err)
		require.Equal(t, originalName1, updated1.Name)

		updated2, err := ss.PropertyField().Get("", field2.ID)
		require.NoError(t, err)
		require.Equal(t, originalName2, updated2.Name)
	})

	t.Run("should update UpdatedBy but not CreatedBy on update", func(t *testing.T) {
		creatorUserID := model.NewId()
		updaterUserID := model.NewId()

		field := &model.PropertyField{
			GroupID:   model.NewId(),
			Name:      "Original Name",
			Type:      model.PropertyFieldTypeText,
			CreatedBy: creatorUserID,
			UpdatedBy: creatorUserID,
		}

		_, err := ss.PropertyField().Create(field)
		require.NoError(t, err)

		// Update the field with a different user
		field.Name = "Updated Name"
		field.UpdatedBy = updaterUserID

		_, err = ss.PropertyField().Update("", []*model.PropertyField{field})
		require.NoError(t, err)

		// Verify CreatedBy stays the same but UpdatedBy changes
		fetched, err := ss.PropertyField().Get("", field.ID)
		require.NoError(t, err)
		require.Equal(t, creatorUserID, fetched.CreatedBy, "CreatedBy should not change on update")
		require.Equal(t, updaterUserID, fetched.UpdatedBy, "UpdatedBy should change on update")
		require.Equal(t, "Updated Name", fetched.Name)
	})

	t.Run("should handle bulk updates with different UpdatedBy values", func(t *testing.T) {
		creatorUserID := model.NewId()
		user1 := model.NewId()
		user2 := model.NewId()
		groupID := model.NewId()

		field1 := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Field 1",
			Type:      model.PropertyFieldTypeText,
			CreatedBy: creatorUserID,
			UpdatedBy: creatorUserID,
		}
		field2 := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Field 2",
			Type:      model.PropertyFieldTypeText,
			CreatedBy: creatorUserID,
			UpdatedBy: creatorUserID,
		}

		_, err := ss.PropertyField().Create(field1)
		require.NoError(t, err)
		_, err = ss.PropertyField().Create(field2)
		require.NoError(t, err)

		// Update with different users
		field1.Name = "Field 1 Updated"
		field1.UpdatedBy = user1
		field2.Name = "Field 2 Updated"
		field2.UpdatedBy = user2

		_, err = ss.PropertyField().Update("", []*model.PropertyField{field1, field2})
		require.NoError(t, err)

		// Verify both fields have correct UpdatedBy
		fetched1, err := ss.PropertyField().Get("", field1.ID)
		require.NoError(t, err)
		require.Equal(t, user1, fetched1.UpdatedBy)
		require.Equal(t, creatorUserID, fetched1.CreatedBy)

		fetched2, err := ss.PropertyField().Get("", field2.ID)
		require.NoError(t, err)
		require.Equal(t, user2, fetched2.UpdatedBy)
		require.Equal(t, creatorUserID, fetched2.CreatedBy)
	})
}

func testDeletePropertyField(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		err := ss.PropertyField().Delete("", model.NewId())
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

		err = ss.PropertyField().Delete("", field.ID)
		require.NoError(t, err)

		// Verify the field was soft-deleted
		deletedField, err := ss.PropertyField().Get("", field.ID)
		require.NoError(t, err)
		require.NotZero(t, deletedField.DeleteAt)
	})

	t.Run("should be able to create a new field with the same details as the deleted one", func(t *testing.T) {
		newField.ID = ""
		field, err := ss.PropertyField().Create(newField)
		require.NoError(t, err)
		require.NotEmpty(t, field.ID)
	})

	t.Run("should be able to delete a field with matching groupID", func(t *testing.T) {
		groupID := model.NewId()
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field with specific group",
			Type:    model.PropertyFieldTypeText,
		}
		_, err := ss.PropertyField().Create(field)
		require.NoError(t, err)
		require.NotZero(t, field.ID)

		err = ss.PropertyField().Delete(groupID, field.ID)
		require.NoError(t, err)

		// Verify the field was soft-deleted
		deletedField, err := ss.PropertyField().Get(groupID, field.ID)
		require.NoError(t, err)
		require.NotZero(t, deletedField.DeleteAt)
	})

	t.Run("should fail when deleting with non-matching groupID", func(t *testing.T) {
		groupID := model.NewId()
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Another field with specific group",
			Type:    model.PropertyFieldTypeText,
		}
		_, err := ss.PropertyField().Create(field)
		require.NoError(t, err)
		require.NotZero(t, field.ID)

		// Try to delete with wrong groupID
		err = ss.PropertyField().Delete(model.NewId(), field.ID)
		require.Error(t, err)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)

		// Verify the field was not deleted
		nonDeletedField, err := ss.PropertyField().Get(groupID, field.ID)
		require.NoError(t, err)
		require.Zero(t, nonDeletedField.DeleteAt)
	})
}

func testCountForGroup(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should return 0 for group with no properties", func(t *testing.T) {
		count, err := ss.PropertyField().CountForGroup(model.NewId(), false)
		require.NoError(t, err)
		require.Equal(t, int64(0), count)
	})

	t.Run("should return correct count for group with properties", func(t *testing.T) {
		groupID := model.NewId()

		// Create 5 property fields
		for i := range 5 {
			field := &model.PropertyField{
				GroupID: groupID,
				Name:    fmt.Sprintf("Field %d", i),
				Type:    model.PropertyFieldTypeText,
			}
			_, err := ss.PropertyField().Create(field)
			require.NoError(t, err)
		}

		count, err := ss.PropertyField().CountForGroup(groupID, false)
		require.NoError(t, err)
		require.Equal(t, int64(5), count)
	})

	t.Run("should not count deleted properties when includeDeleted is false", func(t *testing.T) {
		groupID := model.NewId()

		// Create 5 property fields
		for i := range 5 {
			field := &model.PropertyField{
				GroupID: groupID,
				Name:    fmt.Sprintf("Field %d", i),
				Type:    model.PropertyFieldTypeText,
			}
			_, err := ss.PropertyField().Create(field)
			require.NoError(t, err)
		}

		// Create one more and delete it
		deletedField := &model.PropertyField{
			GroupID: groupID,
			Name:    "To be deleted",
			Type:    model.PropertyFieldTypeText,
		}
		_, err := ss.PropertyField().Create(deletedField)
		require.NoError(t, err)

		err = ss.PropertyField().Delete("", deletedField.ID)
		require.NoError(t, err)

		// Count should be 5 since the deleted field shouldn't be counted
		count, err := ss.PropertyField().CountForGroup(groupID, false)
		require.NoError(t, err)
		require.Equal(t, int64(5), count)
	})

	t.Run("should count deleted properties when includeDeleted is true", func(t *testing.T) {
		groupID := model.NewId()

		// Create 5 property fields
		for i := range 5 {
			field := &model.PropertyField{
				GroupID: groupID,
				Name:    fmt.Sprintf("Field %d", i),
				Type:    model.PropertyFieldTypeText,
			}
			_, err := ss.PropertyField().Create(field)
			require.NoError(t, err)
		}

		// Create one more and delete it
		deletedField := &model.PropertyField{
			GroupID: groupID,
			Name:    "To be deleted",
			Type:    model.PropertyFieldTypeText,
		}
		_, err := ss.PropertyField().Create(deletedField)
		require.NoError(t, err)

		err = ss.PropertyField().Delete("", deletedField.ID)
		require.NoError(t, err)

		// Count should be 6 since we're including deleted fields
		count, err := ss.PropertyField().CountForGroup(groupID, true)
		require.NoError(t, err)
		require.Equal(t, int64(6), count)
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
		ObjectType: "post",
	}

	field2 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 2",
		Type:       model.PropertyFieldTypeSelect,
		TargetID:   targetID,
		TargetType: "other_type",
		ObjectType: "user",
	}

	field3 := &model.PropertyField{
		GroupID:    model.NewId(),
		Name:       "Field 3",
		Type:       model.PropertyFieldTypeText,
		TargetType: "test_type",
		ObjectType: "post",
	}

	targetID2 := model.NewId()
	field4 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 4",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID2,
		TargetType: "test_type",
	}

	for _, field := range []*model.PropertyField{field1, field2, field3, field4} {
		_, err := ss.PropertyField().Create(field)
		require.NoError(t, err)
		time.Sleep(10 * time.Millisecond)
	}

	// Delete one field for deletion tests
	require.NoError(t, ss.PropertyField().Delete("", field4.ID))

	tests := []struct {
		name          string
		opts          model.PropertyFieldSearchOpts
		expectedError bool
		expectedIDs   []string
	}{
		{
			name: "negative per_page",
			opts: model.PropertyFieldSearchOpts{
				PerPage: -1,
			},
			expectedError: true,
		},
		{
			name: "filter by group_id",
			opts: model.PropertyFieldSearchOpts{
				GroupID: groupID,
				PerPage: 10,
			},
			expectedIDs: []string{field1.ID, field2.ID},
		},
		{
			name: "filter by group_id including deleted",
			opts: model.PropertyFieldSearchOpts{
				GroupID:        groupID,
				PerPage:        10,
				IncludeDeleted: true,
			},
			expectedIDs: []string{field1.ID, field2.ID, field4.ID},
		},
		{
			name: "filter by target_type",
			opts: model.PropertyFieldSearchOpts{
				TargetType: "test_type",
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID, field3.ID},
		},
		{
			name: "filter by target_id",
			opts: model.PropertyFieldSearchOpts{
				TargetIDs: []string{targetID},
				PerPage:   10,
			},
			expectedIDs: []string{field1.ID, field2.ID},
		},
		{
			name: "pagination page 0",
			opts: model.PropertyFieldSearchOpts{
				GroupID:        groupID,
				PerPage:        2,
				IncludeDeleted: true,
			},
			expectedIDs: []string{field1.ID, field2.ID},
		},
		{
			name: "pagination page 1",
			opts: model.PropertyFieldSearchOpts{
				GroupID: groupID,
				Cursor: model.PropertyFieldSearchCursor{
					CreateAt:        field2.CreateAt,
					PropertyFieldID: field2.ID,
				},
				PerPage:        2,
				IncludeDeleted: true,
			},
			expectedIDs: []string{field4.ID},
		},
		{
			name: "filter by multiple target_ids",
			opts: model.PropertyFieldSearchOpts{
				TargetIDs: []string{targetID, targetID2},
				PerPage:   10,
			},
			expectedIDs: []string{field1.ID, field2.ID},
		},
		{
			name: "filter by multiple target_ids including deleted",
			opts: model.PropertyFieldSearchOpts{
				TargetIDs:      []string{targetID, targetID2},
				IncludeDeleted: true,
				PerPage:        10,
			},
			expectedIDs: []string{field1.ID, field2.ID, field4.ID},
		},
		{
			name: "filter by multiple target_ids with group filter",
			opts: model.PropertyFieldSearchOpts{
				GroupID:   groupID,
				TargetIDs: []string{targetID, targetID2},
				PerPage:   10,
			},
			expectedIDs: []string{field1.ID, field2.ID},
		},
		{
			name: "filter by SinceUpdateAt timestamp - no results before",
			opts: model.PropertyFieldSearchOpts{
				SinceUpdateAt: field3.UpdateAt, // After all existing fields
				PerPage:       10,
			},
			expectedIDs: []string{},
		},
		{
			name: "filter by SinceUpdateAt timestamp - get fields after specific time",
			opts: model.PropertyFieldSearchOpts{
				SinceUpdateAt: field1.UpdateAt, // After field1, should get field2 and field3
				PerPage:       10,
			},
			expectedIDs: []string{field2.ID, field3.ID},
		},
		{
			name: "filter by SinceUpdateAt timestamp with group filter",
			opts: model.PropertyFieldSearchOpts{
				GroupID:       groupID,
				SinceUpdateAt: field1.UpdateAt, // After field1, should only get field2 from same group
				PerPage:       10,
			},
			expectedIDs: []string{field2.ID},
		},
		{
			name: "filter by SinceUpdateAt timestamp including deleted",
			opts: model.PropertyFieldSearchOpts{
				SinceUpdateAt:  field3.UpdateAt, // After field3, should get field4 (deleted)
				IncludeDeleted: true,
				PerPage:        10,
			},
			expectedIDs: []string{field4.ID},
		},
		{
			name: "filter by ObjectType post",
			opts: model.PropertyFieldSearchOpts{
				ObjectType: "post",
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID, field3.ID},
		},
		{
			name: "filter by ObjectType user",
			opts: model.PropertyFieldSearchOpts{
				ObjectType: "user",
				PerPage:    10,
			},
			expectedIDs: []string{field2.ID},
		},
		{
			name: "filter by ObjectType with group filter",
			opts: model.PropertyFieldSearchOpts{
				GroupID:    groupID,
				ObjectType: "post",
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID},
		},
		{
			name: "filter by ObjectType with target_type filter",
			opts: model.PropertyFieldSearchOpts{
				ObjectType: "post",
				TargetType: "test_type",
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID, field3.ID},
		},
		{
			name: "filter by ObjectType with target_ids filter",
			opts: model.PropertyFieldSearchOpts{
				ObjectType: "post",
				TargetIDs:  []string{targetID},
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID},
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
			ids := make([]string, len(results))
			for i, field := range results {
				ids[i] = field.ID
			}
			require.ElementsMatch(t, tc.expectedIDs, ids)
		})
	}
}

func testSearchPropertyFieldsSince(t *testing.T, _ request.CTX, ss store.Store) {
	// Create fields with controlled timestamps for precise testing
	groupID := model.NewId()

	// Create field 1 (will remain unchanged)
	field1, err := ss.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 1",
		Type:       model.PropertyFieldTypeText,
		TargetID:   model.NewId(),
		TargetType: "test_type",
	})
	require.NoError(t, err)

	time.Sleep(10 * time.Millisecond) // Ensure different timestamps

	// Create field 2 (will be updated later)
	field2, err := ss.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 2",
		Type:       model.PropertyFieldTypeText,
		TargetID:   model.NewId(),
		TargetType: "test_type",
	})
	require.NoError(t, err)

	time.Sleep(10 * time.Millisecond)

	// Create field 3 (will remain unchanged)
	field3, err := ss.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 3",
		Type:       model.PropertyFieldTypeText,
		TargetID:   model.NewId(),
		TargetType: "test_type",
	})
	require.NoError(t, err)

	// Update field2 to change its UpdateAt timestamp
	time.Sleep(10 * time.Millisecond)
	field2.Name = "Field 2 Updated"
	updatedFields, err := ss.PropertyField().Update("", []*model.PropertyField{field2})
	require.NoError(t, err)
	require.Len(t, updatedFields, 1)
	updatedField2 := updatedFields[0]

	t.Run("SinceUpdateAt filters correctly by UpdateAt", func(t *testing.T) {
		// Get fields updated after field1 (should get field2 and field3)
		results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
			GroupID:       groupID,
			SinceUpdateAt: field1.UpdateAt,
			PerPage:       10,
		})
		require.NoError(t, err)
		require.Len(t, results, 2)

		resultIDs := make([]string, len(results))
		for i, result := range results {
			resultIDs[i] = result.ID
		}
		require.ElementsMatch(t, []string{field2.ID, field3.ID}, resultIDs)
	})

	t.Run("SinceUpdateAt with boundary condition", func(t *testing.T) {
		// Get fields updated after just before field3's timestamp
		// Should get both field3 and field2 (which was updated last and now has the most recent UpdateAt), so expect 2 results
		results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
			GroupID:       groupID,
			SinceUpdateAt: field3.UpdateAt - 1, // Slightly before field3's timestamp
			PerPage:       10,
		})
		require.NoError(t, err)
		require.Len(t, results, 2)

		resultIDs := make([]string, len(results))
		for i, result := range results {
			resultIDs[i] = result.ID
		}
		// Should get both field2 (updated with new timestamp) and field3
		require.ElementsMatch(t, []string{field2.ID, field3.ID}, resultIDs)
	})

	t.Run("SinceUpdateAt after all updates", func(t *testing.T) {
		// Get fields updated after the most recent update
		results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
			GroupID:       groupID,
			SinceUpdateAt: updatedField2.UpdateAt, // After the update
			PerPage:       10,
		})
		require.NoError(t, err)
		require.Len(t, results, 0) // Should be empty
	})

	t.Run("SinceUpdateAt with very recent timestamp", func(t *testing.T) {
		// Get fields updated since current time
		results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
			GroupID:       groupID,
			SinceUpdateAt: model.GetMillis(),
			PerPage:       10,
		})
		require.NoError(t, err)
		require.Len(t, results, 0)
	})
}

func testCheckPropertyNameConflict(t *testing.T, _ request.CTX, ss store.Store) {
	// Create a team for testing
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "Test Team",
		Name:        "test-team-" + model.NewId(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	// Create another team for isolation tests
	team2, err := ss.Team().Save(&model.Team{
		DisplayName: "Test Team 2",
		Name:        "test-team2-" + model.NewId(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	// Create a channel in team for testing
	channel, err := ss.Channel().Save(nil, &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        "test-channel-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, 1000)
	require.NoError(t, err)

	// Create another channel in team for same-team conflict tests
	channel2, err := ss.Channel().Save(nil, &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel 2",
		Name:        "test-channel2-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, 1000)
	require.NoError(t, err)

	// Create a channel in team2 for isolation tests
	channelInTeam2, err := ss.Channel().Save(nil, &model.Channel{
		TeamId:      team2.Id,
		DisplayName: "Test Channel in Team 2",
		Name:        "test-channel-team2-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, 1000)
	require.NoError(t, err)

	groupID := model.NewId()
	objectType := "post"
	propertyName := "test-property-" + model.NewId()

	t.Run("legacy properties with empty ObjectType should skip conflict check", func(t *testing.T) {
		// Create a system-level legacy property
		_, cErr := ss.PropertyField().Create(&model.PropertyField{
			ObjectType: "", // Legacy property
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			TargetID:   "",
			Type:       model.PropertyFieldTypeText,
			Name:       "legacy-property",
		})
		require.NoError(t, cErr)

		// Check conflict for legacy property should always return empty (skip check)
		conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
			ObjectType: "",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Name:       "legacy-property",
		}, "")
		require.NoError(t, err)
		require.Empty(t, conflict, "legacy properties should skip conflict check")
	})

	t.Run("unknown target type should return empty string", func(t *testing.T) {
		conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
			ObjectType: objectType,
			GroupID:    groupID,
			TargetType: "unknown",
			TargetID:   model.NewId(),
			Name:       propertyName,
		}, "")
		require.NoError(t, err)
		require.Empty(t, conflict, "unknown target type should return empty string")
	})

	t.Run("system-level property creation", func(t *testing.T) {
		systemPropertyName := "system-property-" + model.NewId()

		t.Run("should return empty when no conflict exists", func(t *testing.T) {
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       systemPropertyName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict)
		})

		t.Run("should detect conflict with existing team-level property", func(t *testing.T) {
			// Create a team-level property
			teamPropName := "team-prop-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       teamPropName,
			})
			require.NoError(t, cErr)

			// Try to create system-level with same name and objectType
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       teamPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelTeam, conflict)
		})

		t.Run("should detect conflict with existing channel-level property", func(t *testing.T) {
			// Create a channel-level property
			channelPropName := "channel-prop-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       channelPropName,
			})
			require.NoError(t, cErr)

			// Try to create system-level with same name and objectType
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       channelPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelChannel, conflict)
		})

		t.Run("should prioritize team over channel conflict (COALESCE order)", func(t *testing.T) {
			// Create both team and channel properties with same name
			bothPropName := "both-prop-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       bothPropName,
			})
			require.NoError(t, cErr)

			_, cErr = ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channelInTeam2.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       bothPropName,
			})
			require.NoError(t, cErr)

			// System-level should detect team first
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       bothPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelTeam, conflict)
		})

		t.Run("should not conflict with different ObjectType", func(t *testing.T) {
			differentObjectTypeProp := "diff-obj-type-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: "user", // Different object type
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       differentObjectTypeProp,
			})
			require.NoError(t, cErr)

			// Should not conflict with "post" objectType
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       differentObjectTypeProp,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict)
		})

		t.Run("should not conflict with deleted property", func(t *testing.T) {
			deletedPropName := "deleted-prop-" + model.NewId()
			deletedProp, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       deletedPropName,
			})
			require.NoError(t, cErr)

			// Delete the property
			require.NoError(t, ss.PropertyField().Delete("", deletedProp.ID))

			// Should not conflict with deleted property
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       deletedPropName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict)
		})
	})

	t.Run("team-level property creation", func(t *testing.T) {
		t.Run("should return empty when no conflict exists", func(t *testing.T) {
			teamPropName := "new-team-prop-" + model.NewId()
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       teamPropName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict)
		})

		t.Run("should detect conflict with existing system-level property", func(t *testing.T) {
			// Create a system-level property
			systemPropName := "system-prop-for-team-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeText,
				Name:       systemPropName,
			})
			require.NoError(t, cErr)

			// Try to create team-level with same name and objectType
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       systemPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict)
		})

		t.Run("should detect conflict with channel-level property in the same team", func(t *testing.T) {
			// Create a channel-level property in the team
			channelInTeamPropName := "channel-in-team-prop-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       channelInTeamPropName,
			})
			require.NoError(t, cErr)

			// Try to create team-level with same name in the same team
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       channelInTeamPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelChannel, conflict)
		})

		t.Run("should NOT conflict with channel-level property in different team", func(t *testing.T) {
			// Create a channel-level property in team2
			channelInOtherTeamPropName := "channel-other-team-prop-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channelInTeam2.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       channelInOtherTeamPropName,
			})
			require.NoError(t, cErr)

			// Try to create team-level in team (not team2) - should NOT conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       channelInOtherTeamPropName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict)
		})

		t.Run("should NOT conflict with team-level property in different team", func(t *testing.T) {
			// Create a team-level property in team2
			teamPropInOtherTeam := "team-prop-other-team-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team2.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       teamPropInOtherTeam,
			})
			require.NoError(t, cErr)

			// Try to create team-level in team (not team2) - should NOT conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       teamPropInOtherTeam,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "team-level properties in different teams should not conflict")
		})

		t.Run("should prioritize system over channel conflict (COALESCE order)", func(t *testing.T) {
			// Create both system and channel properties with same name, should
			// never happen outside of testing
			bothPropName := "both-sys-chan-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeText,
				Name:       bothPropName,
			})
			require.NoError(t, cErr)

			_, cErr = ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       bothPropName,
			})
			require.NoError(t, cErr)

			// Team-level should detect system first
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       bothPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict)
		})
	})

	t.Run("channel-level property creation", func(t *testing.T) {
		t.Run("should return empty when no conflict exists", func(t *testing.T) {
			channelPropName := "new-channel-prop-" + model.NewId()
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Name:       channelPropName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict)
		})

		t.Run("should detect conflict with existing system-level property", func(t *testing.T) {
			// Create a system-level property
			systemPropName := "system-prop-for-channel-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeText,
				Name:       systemPropName,
			})
			require.NoError(t, cErr)

			// Try to create channel-level with same name and objectType
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Name:       systemPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict)
		})

		t.Run("should detect conflict with team-level property of the same team", func(t *testing.T) {
			// Create a team-level property in the channel's team
			teamPropName := "team-prop-for-channel-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       teamPropName,
			})
			require.NoError(t, cErr)

			// Try to create channel-level with same name in a channel of the same team
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Name:       teamPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelTeam, conflict)
		})

		t.Run("should NOT conflict with team-level property of different team", func(t *testing.T) {
			// Create a team-level property in team2
			teamPropInOtherTeam := "team-prop-other-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team2.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       teamPropInOtherTeam,
			})
			require.NoError(t, cErr)

			// Try to create channel-level in team (not team2) - should NOT conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Name:       teamPropInOtherTeam,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict)
		})

		t.Run("should NOT conflict with channel-level property of different team", func(t *testing.T) {
			// Create a channel-level property in team2's channel
			channelPropInOtherTeam := "channel-prop-other-team-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channelInTeam2.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       channelPropInOtherTeam,
			})
			require.NoError(t, cErr)

			// Try to create channel-level in team's channel - should NOT conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Name:       channelPropInOtherTeam,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "channel-level properties in different teams should not conflict")
		})

		t.Run("should NOT conflict with channel-level property in different channel of same team", func(t *testing.T) {
			// Create a channel-level property in channel (belongs to team)
			channelPropSameTeam := "channel-prop-same-team-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       channelPropSameTeam,
			})
			require.NoError(t, cErr)

			// Try to create channel-level in channel2 (also belongs to team) - should NOT conflict
			// Channel-level properties are independent, only system and team levels block them
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel2.Id,
				Name:       channelPropSameTeam,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "channel-level properties in different channels should not conflict")
		})

		t.Run("should prioritize system over team conflict (COALESCE order)", func(t *testing.T) {
			// Create both system and team properties with same name
			bothPropName := "both-sys-team-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeText,
				Name:       bothPropName,
			})
			require.NoError(t, cErr)

			_, cErr = ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       bothPropName,
			})
			require.NoError(t, cErr)

			// Channel-level should detect system first
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Name:       bothPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict)
		})

		t.Run("non-existent channel should only check system-level (simulates DM behavior)", func(t *testing.T) {
			// Create a team-level property
			teamOnlyPropName := "team-only-prop-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       teamOnlyPropName,
			})
			require.NoError(t, cErr)

			// Non-existent channel (subquery returns NULL) should NOT conflict with team-level property
			// This simulates DM channel behavior where the TeamId lookup returns nothing
			fakeChannelID := model.NewId()
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   fakeChannelID,
				Name:       teamOnlyPropName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "channels without team association should not check team-level conflicts")
		})

		t.Run("non-existent channel should still detect system-level conflict (simulates DM behavior)", func(t *testing.T) {
			// Create a system-level property
			systemPropForDM := "system-prop-dm-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeText,
				Name:       systemPropForDM,
			})
			require.NoError(t, cErr)

			// Non-existent channel should still detect system-level conflict
			fakeChannelID := model.NewId()
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   fakeChannelID,
				Name:       systemPropForDM,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict)
		})
	})

	t.Run("groupID isolation", func(t *testing.T) {
		group1 := model.NewId()
		group2 := model.NewId()
		isolationPropName := "isolation-prop-" + model.NewId()

		t.Run("should NOT conflict with property in different group", func(t *testing.T) {
			// Create a system-level property in group1
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    group1,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeText,
				Name:       isolationPropName,
			})
			require.NoError(t, cErr)

			// Try to create system-level with same name in group2 - should NOT conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    group2,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       isolationPropName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "different groups should not conflict")

			// But same group should conflict
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    group1,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       isolationPropName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict, "same group should conflict")
		})

		t.Run("team-level in different groups should not conflict", func(t *testing.T) {
			teamIsolationProp := "team-isolation-" + model.NewId()

			// Create a team-level property in group1
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    group1,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       teamIsolationProp,
			})
			require.NoError(t, cErr)

			// Try to create system-level with same name in group2 - should NOT conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    group2,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       teamIsolationProp,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "different groups should not conflict")
		})

		t.Run("channel-level in different groups should not conflict", func(t *testing.T) {
			channelIsolationProp := "channel-isolation-" + model.NewId()

			// Create a channel-level property in group1
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    group1,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       channelIsolationProp,
			})
			require.NoError(t, cErr)

			// Try to create system-level with same name in group2 - should NOT conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    group2,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       channelIsolationProp,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "different groups should not conflict")

			// Try to create team-level with same name in group2 - should NOT conflict
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    group2,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       channelIsolationProp,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "different groups should not conflict")
		})
	})

	t.Run("excludeID parameter", func(t *testing.T) {
		t.Run("should exclude specified ID from conflict check", func(t *testing.T) {
			// Create a system-level property
			systemProp, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeText,
				Name:       "exclude-test-prop-" + model.NewId(),
			})
			require.NoError(t, cErr)

			// Without excludeID, checking for same name at team level should conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       systemProp.Name,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict)

			// With excludeID set to the system property's ID, conflict should still be found
			// because we're checking from team level and the system property is NOT excluded
			// (exclusion only works for properties at different levels if they match)
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       systemProp.Name,
			}, systemProp.ID)
			require.NoError(t, err)
			require.Empty(t, conflict, "should not conflict when excludeID matches the conflicting property")
		})

		t.Run("property can update to itself without conflict", func(t *testing.T) {
			// Create a team-level property
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       "self-update-test-" + model.NewId(),
			})
			require.NoError(t, cErr)

			// Create a channel property with the same name in the same team
			channelProp, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       "self-update-channel-" + model.NewId(),
			})
			require.NoError(t, cErr)

			// Without excludeID, checking channel property name at team level should not conflict
			// because they have different names
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       channelProp.Name,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelChannel, conflict)

			// Simulating an update where we're checking if the team property can
			// be renamed to something that would conflict with a channel property,
			// but the channel property is excluded (as if we're updating that channel property)
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       channelProp.Name,
			}, channelProp.ID)
			require.NoError(t, err)
			require.Empty(t, conflict, "should not conflict when checking against excluded property")
		})

		t.Run("excludeID only excludes matching property", func(t *testing.T) {
			// Create two channel properties with same name in different teams
			name := "multi-exclude-test-" + model.NewId()
			channelProp1, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       name,
			})
			require.NoError(t, cErr)

			channelProp2, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channelInTeam2.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       name,
			})
			require.NoError(t, cErr)

			// Creating system-level with excludeID for channelProp1 should still
			// conflict with channelProp2
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       name,
			}, channelProp1.ID)
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelChannel, conflict, "should still conflict with non-excluded property")

			// Excluding channelProp2 should still conflict with channelProp1
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       name,
			}, channelProp2.ID)
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelChannel, conflict, "should still conflict with non-excluded property")
		})
	})
}
