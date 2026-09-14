// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"encoding/json"
	"fmt"
	"slices"
	"testing"
	"time"

	sq "github.com/mattermost/squirrel"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPropertyFieldStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("CreatePropertyField", func(t *testing.T) { testCreatePropertyField(t, rctx, ss) })
	t.Run("GetPropertyField", func(t *testing.T) { testGetPropertyField(t, rctx, ss, s) })
	t.Run("GetManyPropertyFields", func(t *testing.T) { testGetManyPropertyFields(t, rctx, ss) })
	t.Run("GetFieldByName", func(t *testing.T) { testGetFieldByName(t, rctx, ss) })
	t.Run("GetFieldByNameForObjectType", func(t *testing.T) { testGetFieldByNameForObjectType(t, rctx, ss) })
	t.Run("UpdatePropertyField", func(t *testing.T) { testUpdatePropertyField(t, rctx, ss) })
	t.Run("DeletePropertyField", func(t *testing.T) { testDeletePropertyField(t, rctx, ss, s) })
	t.Run("SearchPropertyFields", func(t *testing.T) { testSearchPropertyFields(t, rctx, ss, s) })
	t.Run("CountForGroup", func(t *testing.T) { testCountForGroup(t, rctx, ss) })
	t.Run("CheckPropertyNameConflict", func(t *testing.T) { testCheckPropertyNameConflict(t, rctx, ss) })
	t.Run("CountLinkedFields", func(t *testing.T) { testCountLinkedFields(t, rctx, ss) })
	t.Run("GetLinkedFields", func(t *testing.T) { testGetLinkedFields(t, rctx, ss) })
	t.Run("UpdateWithLinkedDependents", func(t *testing.T) { testUpdateWithLinkedDependents(t, rctx, ss) })
	t.Run("SearchByLinkedFieldID", func(t *testing.T) { testSearchByLinkedFieldID(t, rctx, ss) })
	t.Run("OptionStorage", func(t *testing.T) { testPropertyFieldOptionStorage(t, rctx, ss, s) })
	t.Run("OptionEdges", func(t *testing.T) { testPropertyFieldOptionEdges(t, rctx, ss, s) })
	t.Run("OptionHierarchy", func(t *testing.T) { testPropertyFieldOptionHierarchy(t, rctx, ss) })
}

func testCreatePropertyField(t *testing.T, rctx request.CTX, ss store.Store) {
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
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetID:   model.NewId(),
			TargetType: string(model.PropertyFieldTargetLevelChannel),
		}
		created, err := ss.PropertyField().Create(field)
		require.NoError(t, err)
		require.NotZero(t, created.ID)
		require.Equal(t, model.PropertyFieldObjectTypeChannel, created.ObjectType)

		// Verify it can be retrieved with ObjectType intact
		retrieved, err := ss.PropertyField().Get(rctx, "", created.ID)
		require.NoError(t, err)
		require.Equal(t, model.PropertyFieldObjectTypeChannel, retrieved.ObjectType)
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
		retrieved, err := ss.PropertyField().Get(rctx, "", created.ID)
		require.NoError(t, err)
		require.Empty(t, retrieved.ObjectType)
	})

	t.Run("should generate option IDs for multiselect fields without IDs", func(t *testing.T) {
		multiselectField := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "Test Multiselect",
			Type:    model.PropertyFieldTypeMultiselect,
			Attrs: map[string]any{
				"options": []any{
					map[string]any{"name": "Option 1"},
					map[string]any{"name": "Option 2"},
					map[string]any{"name": "Option 3"},
				},
			},
		}

		field, err := ss.PropertyField().Create(multiselectField)
		require.NoError(t, err)
		require.NotZero(t, field.ID)

		// Verify options have IDs generated
		options := field.Attrs["options"].([]any)
		require.Len(t, options, 3)

		for i, opt := range options {
			optMap := opt.(map[string]any)
			require.NotEmpty(t, optMap["id"], "Option %d should have an ID", i)
			require.Len(t, optMap["id"].(string), 26, "Option %d ID should be 26 characters", i)
		}
	})

	t.Run("should preserve existing option IDs for multiselect fields", func(t *testing.T) {
		existingID1 := model.NewId()
		existingID2 := model.NewId()

		multiselectField := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "Test Multiselect with IDs",
			Type:    model.PropertyFieldTypeMultiselect,
			Attrs: map[string]any{
				"options": []any{
					map[string]any{"id": existingID1, "name": "Option 1"},
					map[string]any{"id": existingID2, "name": "Option 2"},
				},
			},
		}

		field, err := ss.PropertyField().Create(multiselectField)
		require.NoError(t, err)

		// Verify existing IDs are preserved
		options := field.Attrs["options"].([]any)
		require.Len(t, options, 2)
		require.Equal(t, existingID1, options[0].(map[string]any)["id"])
		require.Equal(t, existingID2, options[1].(map[string]any)["id"])
	})
}

// insertPropertyFieldWithNullColumns inserts a property field row that
// simulates a record created before the migrations that added Protected,
// Permission*, CreatedBy, and UpdatedBy columns. Those columns are left
// NULL so that the store's COALESCE and pointer-scanning logic is exercised.
func insertPropertyFieldWithNullColumns(t *testing.T, ss store.Store, s SqlStore) (string, string) {
	t.Helper()

	fieldID := model.NewId()
	groupID := model.NewId()
	db := ss.GetInternalMasterDB()

	builder := sq.StatementBuilder.PlaceholderFormat(s.GetQueryPlaceholder()).
		Insert("PropertyFields").
		Columns("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "ObjectType", "CreateAt", "UpdateAt", "DeleteAt").
		Values(fieldID, groupID, "null-columns-field", "text", "{}", "", "", "", model.GetMillis(), model.GetMillis(), 0)

	query, args, err := builder.ToSql()
	require.NoError(t, err)

	_, err = db.Exec(query, args...)
	require.NoError(t, err)

	return groupID, fieldID
}

func testGetPropertyField(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		field, err := ss.PropertyField().Get(rctx, "", model.NewId())
		require.Zero(t, field)
		var notFoundErr *store.ErrNotFound
		require.ErrorAs(t, err, &notFoundErr)
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
		field, err := ss.PropertyField().Get(rctx, groupID, newField.ID)
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.True(t, field.Attrs["locked"].(bool))
		require.Equal(t, "value", field.Attrs["special"])

		// should work without specifying the group ID as well
		field, err = ss.PropertyField().Get(rctx, "", newField.ID)
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.True(t, field.Attrs["locked"].(bool))
		require.Equal(t, "value", field.Attrs["special"])
	})

	t.Run("should not be able to retrieve an existing field when specifying a different group ID", func(t *testing.T) {
		field, err := ss.PropertyField().Get(rctx, model.NewId(), newField.ID)
		require.Zero(t, field)
		var notFoundErr *store.ErrNotFound
		require.ErrorAs(t, err, &notFoundErr)
	})

	t.Run("null columns, before createdBy, updatedBy, protected and permissions migrations", func(t *testing.T) {
		groupID, fieldID := insertPropertyFieldWithNullColumns(t, ss, s)

		field, err := ss.PropertyField().Get(rctx, groupID, fieldID)
		require.NoError(t, err)
		require.Equal(t, fieldID, field.ID)
		require.Empty(t, field.CreatedBy)
		require.Empty(t, field.UpdatedBy)
		require.False(t, field.Protected)
		require.Nil(t, field.PermissionField)
		require.Nil(t, field.PermissionValues)
		require.Nil(t, field.PermissionOptions)
	})
}

func testGetManyPropertyFields(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting fields", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany(rctx, "", []string{model.NewId(), model.NewId()})
		require.Empty(t, fields)
		var target *store.ErrResultsMismatch
		require.ErrorAs(t, err, &target)
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
		fields, err := ss.PropertyField().GetMany(rctx, groupID, []string{newFields[0].ID, newFields[1].ID, model.NewId()})
		require.Empty(t, fields)
		var target *store.ErrResultsMismatch
		require.ErrorAs(t, err, &target)
	})

	t.Run("should be able to retrieve existing property fields", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany(rctx, groupID, []string{newFields[0].ID, newFields[1].ID, newFields[2].ID})
		require.NoError(t, err)
		require.Len(t, fields, 3)
		require.ElementsMatch(t, newFields, fields)
	})

	t.Run("should fail if asked for valid IDs but outside the group", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany(rctx, groupID, []string{newFields[0].ID, newFieldOutsideGroup.ID})
		require.Empty(t, fields)
		var target *store.ErrResultsMismatch
		require.ErrorAs(t, err, &target)
	})

	t.Run("should be able to retrieve existing property fields from multiple groups", func(t *testing.T) {
		fields, err := ss.PropertyField().GetMany(rctx, "", []string{newFields[0].ID, newFieldOutsideGroup.ID})
		require.NoError(t, err)
		require.Len(t, fields, 2)
	})
}

func testGetFieldByName(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByName(rctx, "", "", "nonexistent-field-name")
		require.Zero(t, field)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
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
		field, err := ss.PropertyField().GetFieldByName(rctx, groupID, targetID, "unique-field-name")
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.Equal(t, "unique-field-name", field.Name)
		require.True(t, field.Attrs["locked"].(bool))
		require.Equal(t, "value", field.Attrs["special"])
	})

	t.Run("should not be able to retrieve an existing field when specifying a different group ID", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByName(rctx, model.NewId(), targetID, "unique-field-name")
		require.Zero(t, field)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
	})

	t.Run("should not be able to retrieve an existing field when specifying a different target ID", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByName(rctx, groupID, model.NewId(), "unique-field-name")
		require.Zero(t, field)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
	})

	// Test with multiple fields with the same name but different groups
	anotherGroupID := model.NewId()
	duplicateNameField := &model.PropertyField{
		GroupID:  anotherGroupID,
		TargetID: targetID,
		Name:     "unique-field-name", // Same name as the first field
		Type:     model.PropertyFieldTypeSelect,
		Attrs: map[string]any{
			"options": []any{
				map[string]any{"name": "a"},
				map[string]any{"name": "b"},
				map[string]any{"name": "c"},
			},
		},
	}
	_, cErr = ss.PropertyField().Create(duplicateNameField)
	require.NoError(t, cErr)
	require.NotZero(t, duplicateNameField.ID)

	t.Run("should retrieve the correct field when multiple fields have the same name but different groups", func(t *testing.T) {
		// Get the field from the first group
		field, err := ss.PropertyField().GetFieldByName(rctx, groupID, targetID, "unique-field-name")
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.Equal(t, model.PropertyFieldTypeText, field.Type)

		// Get the field from the second group
		field, err = ss.PropertyField().GetFieldByName(rctx, anotherGroupID, targetID, "unique-field-name")
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
		field, err := ss.PropertyField().GetFieldByName(rctx, groupID, targetID, "unique-field-name")
		require.NoError(t, err)
		require.Equal(t, newField.ID, field.ID)
		require.Equal(t, model.PropertyFieldTypeText, field.Type)

		// Get the field with the second target ID
		field, err = ss.PropertyField().GetFieldByName(rctx, groupID, anotherTargetID, "unique-field-name")
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
		field, err := ss.PropertyField().GetFieldByName(rctx, groupID, targetID, "to-be-deleted-field")
		require.NoError(t, err)
		require.Equal(t, deletedField.ID, field.ID)

		// Delete the field
		err = ss.PropertyField().Delete("", deletedField.ID)
		require.NoError(t, err)

		// Verify it can't be retrieved after deletion
		field, err = ss.PropertyField().GetFieldByName(rctx, groupID, targetID, "to-be-deleted-field")
		require.Zero(t, field)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
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
		field, err := ss.PropertyField().GetFieldByName(rctx, groupID, targetID, "to-be-deleted-field")
		require.NoError(t, err)
		require.Equal(t, replacementField.ID, field.ID)
		require.Equal(t, model.PropertyFieldTypeText, field.Type)
		require.Zero(t, field.DeleteAt)
	})
}

func testGetFieldByNameForObjectType(t *testing.T, rctx request.CTX, ss store.Store) {
	// Two system-scoped fields share group and name, differing only by
	// ObjectType — the collision the scoped lookup must disambiguate.
	groupID := model.NewId()
	targetType := string(model.PropertyFieldTargetLevelSystem)

	userField := &model.PropertyField{
		GroupID:    groupID,
		Name:       "classification",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: targetType,
	}
	_, cErr := ss.PropertyField().Create(userField)
	require.NoError(t, cErr)
	require.NotZero(t, userField.ID)

	systemField := &model.PropertyField{
		GroupID:    groupID,
		Name:       "classification",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeSystem,
		TargetType: targetType,
	}
	_, cErr = ss.PropertyField().Create(systemField)
	require.NoError(t, cErr)
	require.NotZero(t, systemField.ID)

	t.Run("should resolve to the field matching the requested object type", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByNameForObjectType(rctx, groupID, "", model.PropertyFieldObjectTypeUser, "classification")
		require.NoError(t, err)
		require.Equal(t, userField.ID, field.ID)
		require.Equal(t, model.PropertyFieldObjectTypeUser, field.ObjectType)

		field, err = ss.PropertyField().GetFieldByNameForObjectType(rctx, groupID, "", model.PropertyFieldObjectTypeSystem, "classification")
		require.NoError(t, err)
		require.Equal(t, systemField.ID, field.ID)
		require.Equal(t, model.PropertyFieldObjectTypeSystem, field.ObjectType)
	})

	t.Run("should not match a field of a different object type", func(t *testing.T) {
		field, err := ss.PropertyField().GetFieldByNameForObjectType(rctx, groupID, "", model.PropertyFieldObjectTypeChannel, "classification")
		require.Zero(t, field)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
	})

	t.Run("empty object type is matched exactly, not as match-any", func(t *testing.T) {
		// Neither field has an empty object type, so an empty-object-type lookup
		// must miss rather than return an arbitrary match.
		field, err := ss.PropertyField().GetFieldByNameForObjectType(rctx, groupID, "", "", "classification")
		require.Zero(t, field)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
	})
}

func testUpdatePropertyField(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting field", func(t *testing.T) {
		field := &model.PropertyField{
			ID:       model.NewId(),
			GroupID:  model.NewId(),
			Name:     "My property field",
			Type:     model.PropertyFieldTypeText,
			CreateAt: model.GetMillis(),
		}
		updatedField, err := ss.PropertyField().Update("", []*model.PropertyField{field}, nil)
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
		updatedField, err := ss.PropertyField().Update("", []*model.PropertyField{field}, nil)
		require.Zero(t, updatedField)
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")

		field.GroupID = model.NewId()
		field.Name = ""
		updatedField, err = ss.PropertyField().Update("", []*model.PropertyField{field}, nil)
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
				"options": []any{
					map[string]any{"name": "a"},
					map[string]any{"name": "b"},
				},
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
			"options": []any{
				map[string]any{"name": "x"},
				map[string]any{"name": "y"},
				map[string]any{"name": "z"},
			},
		}

		_, err := ss.PropertyField().Update("", []*model.PropertyField{field1, field2}, nil)
		require.NoError(t, err)

		// Verify first field
		updated1, err := ss.PropertyField().Get(rctx, "", field1.ID)
		require.NoError(t, err)
		require.Equal(t, "Updated first", updated1.Name)
		require.Equal(t, model.PropertyFieldTypeSelect, updated1.Type)
		require.False(t, updated1.Attrs["locked"].(bool))
		require.NotContains(t, updated1.Attrs, "special")
		require.Equal(t, "new_value", updated1.Attrs["new_field"])
		require.Greater(t, updated1.UpdateAt, updated1.CreateAt)

		// Verify second field
		updated2, err := ss.PropertyField().Get(rctx, "", field2.ID)
		require.NoError(t, err)
		require.Equal(t, "Updated second", updated2.Name)
		require.Equal(t, model.PropertyFieldTypeSelect, updated2.Type)
		options := updated2.Attrs["options"].([]any)
		require.Len(t, options, 3)
		optionNames := []string{}
		for _, opt := range options {
			optMap := opt.(map[string]any)
			require.NotEmpty(t, optMap["id"], "Option should have an ID")
			optionNames = append(optionNames, optMap["name"].(string))
		}
		require.ElementsMatch(t, []string{"x", "y", "z"}, optionNames)
		require.Greater(t, updated2.UpdateAt, updated2.CreateAt)
	})

	t.Run("should generate option IDs for multiselect fields on update", func(t *testing.T) {
		// Create a multiselect field
		multiselectField := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "Test Multiselect Update",
			Type:    model.PropertyFieldTypeMultiselect,
			Attrs: map[string]any{
				"options": []any{
					map[string]any{"name": "Original 1"},
					map[string]any{"name": "Original 2"},
				},
			},
		}

		_, err := ss.PropertyField().Create(multiselectField)
		require.NoError(t, err)
		require.NotZero(t, multiselectField.ID)

		// Update with new options without IDs
		multiselectField.Attrs = map[string]any{
			"options": []any{
				map[string]any{"name": "Updated 1"},
				map[string]any{"name": "Updated 2"},
				map[string]any{"name": "Updated 3"},
			},
		}

		updatedFields, err := ss.PropertyField().Update("", []*model.PropertyField{multiselectField}, nil)
		require.NoError(t, err)
		require.Len(t, updatedFields, 1)

		// Verify options have IDs generated
		options := updatedFields[0].Attrs["options"].([]any)
		require.Len(t, options, 3)

		for i, opt := range options {
			optMap := opt.(map[string]any)
			require.NotEmpty(t, optMap["id"], "Updated option %d should have an ID", i)
			require.Len(t, optMap["id"].(string), 26, "Updated option %d ID should be 26 characters", i)
		}
	})

	t.Run("should preserve existing option IDs on update", func(t *testing.T) {
		existingID1 := model.NewId()
		existingID2 := model.NewId()

		// Create a multiselect field with IDs
		multiselectField := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "Test Multiselect Preserve IDs",
			Type:    model.PropertyFieldTypeMultiselect,
			Attrs: map[string]any{
				"options": []any{
					map[string]any{"id": existingID1, "name": "Option 1"},
					map[string]any{"id": existingID2, "name": "Option 2"},
				},
			},
		}

		_, err := ss.PropertyField().Create(multiselectField)
		require.NoError(t, err)

		// Update with same IDs
		multiselectField.Attrs = map[string]any{
			"options": []any{
				map[string]any{"id": existingID1, "name": "Option 1 Updated"},
				map[string]any{"id": existingID2, "name": "Option 2 Updated"},
			},
		}

		updatedFields, err := ss.PropertyField().Update("", []*model.PropertyField{multiselectField}, nil)
		require.NoError(t, err)
		require.Len(t, updatedFields, 1)

		// Verify existing IDs are preserved
		options := updatedFields[0].Attrs["options"].([]any)
		require.Len(t, options, 2)
		require.Equal(t, existingID1, options[0].(map[string]any)["id"])
		require.Equal(t, existingID2, options[1].(map[string]any)["id"])
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

		_, err := ss.PropertyField().Update("", []*model.PropertyField{field1, field2}, nil)
		require.ErrorContains(t, err, "model.property_field.is_valid.app_error")

		// Check that fields were not updated
		updated1, err := ss.PropertyField().Get(rctx, "", field1.ID)
		require.NoError(t, err)
		require.Equal(t, "Field 1", updated1.Name)
		require.Equal(t, originalUpdateAt1, updated1.UpdateAt)

		updated2, err := ss.PropertyField().Get(rctx, "", field2.ID)
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

		_, err = ss.PropertyField().Update("", []*model.PropertyField{field1, field2}, nil)
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to update, some property fields were not found")

		// Check that the valid field was not updated
		updated1, err := ss.PropertyField().Get(rctx, "", field1.ID)
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

		updatedFields, err := ss.PropertyField().Update(groupID, []*model.PropertyField{field1, field2}, nil)
		require.NoError(t, err)
		require.Len(t, updatedFields, 2)

		// Verify the fields were updated
		for _, field := range []*model.PropertyField{field1, field2} {
			updated, err := ss.PropertyField().Get(rctx, "", field.ID)
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

		_, err := ss.PropertyField().Update(groupID1, []*model.PropertyField{field1, field2}, nil)
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to update, some property fields were not found")

		// Verify neither field was updated due to transaction rollback
		updated1, err := ss.PropertyField().Get(rctx, "", field1.ID)
		require.NoError(t, err)
		require.Equal(t, originalName1, updated1.Name)

		updated2, err := ss.PropertyField().Get(rctx, "", field2.ID)
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

		_, err = ss.PropertyField().Update("", []*model.PropertyField{field}, nil)
		require.NoError(t, err)

		// Verify CreatedBy stays the same but UpdatedBy changes
		fetched, err := ss.PropertyField().Get(rctx, "", field.ID)
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

		_, err = ss.PropertyField().Update("", []*model.PropertyField{field1, field2}, nil)
		require.NoError(t, err)

		// Verify both fields have correct UpdatedBy
		fetched1, err := ss.PropertyField().Get(rctx, "", field1.ID)
		require.NoError(t, err)
		require.Equal(t, user1, fetched1.UpdatedBy)
		require.Equal(t, creatorUserID, fetched1.CreatedBy)

		fetched2, err := ss.PropertyField().Get(rctx, "", field2.ID)
		require.NoError(t, err)
		require.Equal(t, user2, fetched2.UpdatedBy)
		require.Equal(t, creatorUserID, fetched2.CreatedBy)
	})
}

func testDeletePropertyField(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
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
		deletedField, err := ss.PropertyField().Get(rctx, "", field.ID)
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
		deletedField, err := ss.PropertyField().Get(rctx, groupID, field.ID)
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
		nonDeletedField, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		require.Zero(t, nonDeletedField.DeleteAt)
	})

	t.Run("deleting a field takes the options it owns and the hierarchy between them", func(t *testing.T) {
		groupID := model.NewId()

		// Two fields of the same shape, so that what the delete leaves alone is
		// checked as well as what it removes: an option is identified by its field and
		// its ID together, and every statement behind the delete is scoped by field.
		newGraphField := func(t *testing.T) *model.PropertyField {
			t.Helper()
			field, err := ss.PropertyField().Create(&model.PropertyField{
				GroupID:    groupID,
				Name:       "Programs-" + model.NewId(),
				Type:       model.PropertyFieldTypeGraph,
				ObjectType: model.PropertyFieldObjectTypeTemplate,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Attrs: model.StringInterface{"options": []any{
					map[string]any{"name": "Air Program"},
					map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
					map[string]any{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
				}},
			})
			require.NoError(t, err)
			return field
		}

		countOptions := func(t *testing.T, fieldID, where string) int {
			t.Helper()
			var count int
			require.NoError(t, s.GetMaster().Get(&count,
				"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1 AND "+where, fieldID))
			return count
		}

		deleted := newGraphField(t)
		kept := newGraphField(t)
		require.Equal(t, 3, countOptions(t, deleted.ID, "DeleteAt = 0"))

		require.NoError(t, ss.PropertyField().Delete(groupID, deleted.ID))

		// Soft-deleted like the field itself, not removed: nothing in the property
		// system hard-deletes an option row, and a cascade is not the place to become
		// the exception.
		require.Zero(t, countOptions(t, deleted.ID, "DeleteAt = 0"))
		require.Equal(t, 3, countOptions(t, deleted.ID, "DeleteAt <> 0"))

		// The hierarchy goes outright -- an edge has no delete marker of its own.
		edges, err := ss.PropertyField().GetOptionEdges(deleted.ID)
		require.NoError(t, err)
		require.Empty(t, edges)

		require.Equal(t, 3, countOptions(t, kept.ID, "DeleteAt = 0"))
		edges, err = ss.PropertyField().GetOptionEdges(kept.ID)
		require.NoError(t, err)
		require.Len(t, edges, 2)
	})

	t.Run("a delete that finds no field writes nothing", func(t *testing.T) {
		groupID := model.NewId()
		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "Programs-" + model.NewId(),
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{"options": []any{
				map[string]any{"name": "Air Program"},
				map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
			}},
		})
		require.NoError(t, err)

		// The field row is matched by ID and group together, and the option statements
		// only by field ID -- so a delete naming the wrong group has to be refused
		// before they run, not after.
		err = ss.PropertyField().Delete(model.NewId(), field.ID)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)

		var live int
		require.NoError(t, s.GetMaster().Get(&live,
			"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1 AND DeleteAt = 0", field.ID))
		require.Equal(t, 2, live)
		edges, err := ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Len(t, edges, 1)
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

func testSearchPropertyFields(t *testing.T, _ request.CTX, ss store.Store, s SqlStore) {
	groupID := model.NewId()
	targetID := model.NewId()

	// Define test property fields
	field1 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 1",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID,
		TargetType: string(model.PropertyFieldTargetLevelChannel),
		ObjectType: "post",
	}

	field2 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 2",
		Type:       model.PropertyFieldTypeSelect,
		TargetID:   targetID,
		TargetType: string(model.PropertyFieldTargetLevelTeam),
		ObjectType: "user",
	}

	groupID2 := model.NewId()
	targetID3 := model.NewId()
	field3 := &model.PropertyField{
		GroupID:    groupID2,
		Name:       "Field 3",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID3,
		TargetType: string(model.PropertyFieldTargetLevelChannel),
		ObjectType: "post",
	}

	targetID2 := model.NewId()
	field4 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 4",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID2,
		TargetType: "test_type",
		ObjectType: "",
	}

	// field5 adds a second "post" field in groupID with a different
	// TargetType and TargetID so that the ObjectType+TargetType and
	// ObjectType+TargetIDs combined filters have something to exclude.
	targetID5 := model.NewId()
	field5 := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Field 5",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID5,
		TargetType: string(model.PropertyFieldTargetLevelTeam),
		ObjectType: "post",
	}

	// field6 adds a "user" field in groupID2 so the ObjectType filter
	// within groupID2 actually filters something out.
	field6 := &model.PropertyField{
		GroupID:    groupID2,
		Name:       "Field 6",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID3,
		TargetType: string(model.PropertyFieldTargetLevelChannel),
		ObjectType: "user",
	}

	for _, field := range []*model.PropertyField{field1, field2, field3, field4, field5, field6} {
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
			expectedIDs: []string{field1.ID, field2.ID, field5.ID},
		},
		{
			name: "filter by group_id including deleted",
			opts: model.PropertyFieldSearchOpts{
				GroupID:        groupID,
				PerPage:        10,
				IncludeDeleted: true,
			},
			expectedIDs: []string{field1.ID, field2.ID, field4.ID, field5.ID},
		},
		{
			name: "filter by target_type and groupID",
			opts: model.PropertyFieldSearchOpts{
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID},
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
			expectedIDs: []string{field4.ID, field5.ID},
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
			// SinceUpdateAt is inclusive (>=). With since=field5.UpdateAt
			// the only row in groupID with UpdateAt >= field5.UpdateAt is
			// field5 itself (delete does not touch UpdateAt, so field4
			// stays behind in time order).
			name: "filter by SinceUpdateAt timestamp - returns the boundary row",
			opts: model.PropertyFieldSearchOpts{
				GroupID:       groupID,
				SinceUpdateAt: field5.UpdateAt,
				PerPage:       10,
			},
			expectedIDs: []string{field5.ID},
		},
		{
			// Using field1.UpdateAt+1 demonstrates the `>=` boundary excludes
			// anything strictly before it: field1 is dropped while later rows
			// (including soft-deleted field4 as a tombstone) are surfaced.
			name: "filter by SinceUpdateAt timestamp - get fields strictly after field1",
			opts: model.PropertyFieldSearchOpts{
				GroupID:       groupID,
				SinceUpdateAt: field1.UpdateAt + 1,
				PerPage:       10,
			},
			expectedIDs: []string{field2.ID, field4.ID, field5.ID},
		},
		{
			name: "filter by SinceUpdateAt timestamp with group filter",
			opts: model.PropertyFieldSearchOpts{
				GroupID:       groupID2,
				SinceUpdateAt: field3.UpdateAt, // >= field3, should get field3 + field6 in groupID2
				PerPage:       10,
			},
			expectedIDs: []string{field3.ID, field6.ID},
		},
		{
			name: "filter by SinceUpdateAt timestamp including deleted",
			opts: model.PropertyFieldSearchOpts{
				GroupID:        groupID,
				SinceUpdateAt:  field2.UpdateAt, // >= field2 in groupID: field2, field4 (deleted), field5
				IncludeDeleted: true,
				PerPage:        10,
			},
			expectedIDs: []string{field2.ID, field4.ID, field5.ID},
		},
		{
			name: "filter by ObjectType post",
			opts: model.PropertyFieldSearchOpts{
				GroupID:    groupID,
				ObjectType: "post",
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID, field5.ID},
		},
		{
			name: "filter by ObjectType user",
			opts: model.PropertyFieldSearchOpts{
				GroupID:    groupID,
				ObjectType: "user",
				PerPage:    10,
			},
			expectedIDs: []string{field2.ID},
		},
		{
			name: "filter by ObjectType with group filter",
			opts: model.PropertyFieldSearchOpts{
				GroupID:    groupID2,
				ObjectType: "post",
				PerPage:    10,
			},
			expectedIDs: []string{field3.ID},
		},
		{
			name: "filter by ObjectType with target_type filter",
			opts: model.PropertyFieldSearchOpts{
				GroupID:    groupID,
				ObjectType: "post",
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				PerPage:    10,
			},
			expectedIDs: []string{field1.ID},
		},
		{
			name: "filter by ObjectType with target_ids filter",
			opts: model.PropertyFieldSearchOpts{
				GroupID:    groupID,
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

	t.Run("Since", func(t *testing.T) {
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
		updatedFields, err := ss.PropertyField().Update("", []*model.PropertyField{field2}, nil)
		require.NoError(t, err)
		require.Len(t, updatedFields, 1)
		updatedField2 := updatedFields[0]

		t.Run("SinceUpdateAt filters correctly by UpdateAt", func(t *testing.T) {
			// Get fields updated at-or-after field1: with `>=` semantics
			// field1 itself is included, plus field3 and the
			// post-update field2.
			results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:       groupID,
				SinceUpdateAt: field1.UpdateAt,
				PerPage:       10,
			})
			require.NoError(t, err)
			require.Len(t, results, 3)

			resultIDs := make([]string, len(results))
			for i, result := range results {
				resultIDs[i] = result.ID
			}
			require.ElementsMatch(t, []string{field1.ID, field2.ID, field3.ID}, resultIDs)
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

		t.Run("SinceUpdateAt at the most recent update returns just that row", func(t *testing.T) {
			// `>=` semantics: querying at the highest UpdateAt in the
			// group returns the row at exactly that timestamp.
			results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:       groupID,
				SinceUpdateAt: updatedField2.UpdateAt,
				PerPage:       10,
			})
			require.NoError(t, err)
			require.Len(t, results, 1)
			require.Equal(t, updatedField2.ID, results[0].ID)
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

		t.Run("same-millisecond rows are paged correctly via (UpdateAt, Id) cursor", func(t *testing.T) {
			// Three rows must share the same UpdateAt to exercise the
			// disambiguation clause. The Update store call pins UpdateAt
			// to a single GetMillis() value across all rows in the batch.
			tieGroup := model.NewId()
			tieFields := make([]*model.PropertyField, 0, 3)
			for range 3 {
				f, cerr := ss.PropertyField().Create(&model.PropertyField{
					GroupID:    tieGroup,
					Name:       model.NewId(),
					Type:       model.PropertyFieldTypeText,
					TargetID:   model.NewId(),
					TargetType: "test_type",
				})
				require.NoError(t, cerr)
				tieFields = append(tieFields, f)
				time.Sleep(2 * time.Millisecond)
			}

			// Bulk-update all three to give them the SAME UpdateAt.
			for _, f := range tieFields {
				f.Name = f.Name + "-bumped"
			}
			updated, err := ss.PropertyField().Update("", tieFields, nil)
			require.NoError(t, err)
			require.Len(t, updated, 3)
			tieUpdateAt := updated[0].UpdateAt
			require.Equal(t, tieUpdateAt, updated[1].UpdateAt)
			require.Equal(t, tieUpdateAt, updated[2].UpdateAt)

			// Page 1: include the boundary row at exactly tieUpdateAt.
			page1, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:       tieGroup,
				SinceUpdateAt: tieUpdateAt,
				PerPage:       2,
			})
			require.NoError(t, err)
			require.Len(t, page1, 2, "boundary row + one more must come back on the first page")

			// Page 2: cursor with the last row of page 1 must surface
			// the third tied row — proving (UpdateAt, Id) disambiguates.
			last := page1[len(page1)-1]
			page2, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:       tieGroup,
				SinceUpdateAt: tieUpdateAt,
				Cursor: model.PropertyFieldSearchCursor{
					PropertyFieldID: last.ID,
					UpdateAt:        last.UpdateAt,
				},
				PerPage: 2,
			})
			require.NoError(t, err)
			require.Len(t, page2, 1)

			// All three tied rows surfaced exactly once across both pages.
			seen := map[string]bool{}
			for _, r := range append(page1, page2...) {
				seen[r.ID] = true
			}
			require.Len(t, seen, 3)
			for _, f := range tieFields {
				require.True(t, seen[f.ID], "all tied rows must be returned exactly once across pagination")
			}
		})
	})

	t.Run("Scope", func(t *testing.T) {
		groupID := model.NewId()
		teamA := model.NewId()
		teamB := model.NewId()
		channelX := model.NewId()
		channelY := model.NewId()

		// Mixed fixtures: 1 system, 1 team-A, 1 team-B, 2 channel-X (team-A scoped),
		// 1 channel-Y (team-A scoped). ObjectType varies to exercise the IN filter.
		systemField := &model.PropertyField{
			GroupID:    groupID,
			Name:       "system-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			ObjectType: model.PropertyFieldObjectTypeSystem,
		}
		teamAField := &model.PropertyField{
			GroupID:    groupID,
			Name:       "team-a-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   teamA,
			ObjectType: model.PropertyFieldObjectTypeChannel,
		}
		teamBField := &model.PropertyField{
			GroupID:    groupID,
			Name:       "team-b-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   teamB,
			ObjectType: model.PropertyFieldObjectTypeChannel,
		}
		channelXField1 := &model.PropertyField{
			GroupID:    groupID,
			Name:       "channel-x-field-1",
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channelX,
			ObjectType: model.PropertyFieldObjectTypeChannel,
		}
		channelXField2 := &model.PropertyField{
			GroupID:    groupID,
			Name:       "channel-x-field-2",
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channelX,
			ObjectType: model.PropertyFieldObjectTypeUser,
		}
		channelYField := &model.PropertyField{
			GroupID:    groupID,
			Name:       "channel-y-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channelY,
			ObjectType: model.PropertyFieldObjectTypeChannel,
		}

		for _, f := range []*model.PropertyField{systemField, teamAField, teamBField, channelXField1, channelXField2, channelYField} {
			_, err := ss.PropertyField().Create(f)
			require.NoError(t, err)
			time.Sleep(2 * time.Millisecond)
		}

		t.Run("team-only scope returns system + team-A only", func(t *testing.T) {
			results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID: groupID,
				TeamID:  teamA,
				PerPage: 50,
			})
			require.NoError(t, err)

			ids := make([]string, len(results))
			for i, f := range results {
				ids[i] = f.ID
			}
			require.ElementsMatch(t, []string{systemField.ID, teamAField.ID}, ids)
		})

		t.Run("channel + team scope returns system + team-A + both channel-X rows", func(t *testing.T) {
			results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:   groupID,
				TeamID:    teamA,
				ChannelID: channelX,
				PerPage:   50,
			})
			require.NoError(t, err)

			ids := make([]string, len(results))
			for i, f := range results {
				ids[i] = f.ID
			}
			require.ElementsMatch(t,
				[]string{systemField.ID, teamAField.ID, channelXField1.ID, channelXField2.ID},
				ids,
			)
		})

		t.Run("ObjectTypes IN list returns rows of both kinds", func(t *testing.T) {
			results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:     groupID,
				ObjectTypes: []string{model.PropertyFieldObjectTypeChannel, model.PropertyFieldObjectTypeSystem},
				PerPage:     50,
			})
			require.NoError(t, err)

			ids := make([]string, len(results))
			objectTypes := make(map[string]string, len(results))
			for i, f := range results {
				ids[i] = f.ID
				objectTypes[f.ID] = f.ObjectType
			}
			// channelXField2 (user) and any non-channel/non-system rows must be absent.
			require.ElementsMatch(t,
				[]string{systemField.ID, teamAField.ID, teamBField.ID, channelXField1.ID, channelYField.ID},
				ids,
			)
			for _, ot := range objectTypes {
				require.Contains(t,
					[]string{model.PropertyFieldObjectTypeChannel, model.PropertyFieldObjectTypeSystem},
					ot,
					"unexpected object_type in IN-list result",
				)
			}
		})

		t.Run("ObjectType=system combined with ChannelID/TeamID still surfaces system rows", func(t *testing.T) {
			results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:    groupID,
				ObjectType: model.PropertyFieldObjectTypeSystem,
				TeamID:     teamA,
				ChannelID:  channelX,
				PerPage:    50,
			})
			require.NoError(t, err)

			// teamAField/channelXField* are not ObjectType=system, so they're filtered
			// out by the ObjectType clause. The OR scope clause still admits system rows
			// — the regression we're guarding against is the channel/team filter
			// accidentally excluding the system row.
			ids := make([]string, len(results))
			for i, f := range results {
				ids[i] = f.ID
			}
			require.ElementsMatch(t, []string{systemField.ID}, ids)
		})

		t.Run("ChannelID without TeamID returns system + channel rows (DM/GM scope)", func(t *testing.T) {
			// DM/GM channels have no parent team, so the hierarchy
			// collapses to system → channel. Team-scoped rows must not
			// leak in even though channelX itself happens to be in
			// teamA in this fixture.
			results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:   groupID,
				ChannelID: channelX,
				PerPage:   50,
			})
			require.NoError(t, err)

			ids := make([]string, len(results))
			for i, f := range results {
				ids[i] = f.ID
			}
			require.ElementsMatch(t,
				[]string{systemField.ID, channelXField1.ID, channelXField2.ID},
				ids,
			)
		})

		t.Run("scope conflict (TeamID + TargetType) is rejected by IsValid", func(t *testing.T) {
			_, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:    groupID,
				TeamID:     teamA,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				PerPage:    50,
			})
			require.Error(t, err)
			require.ErrorContains(t, err, "cannot be combined")
		})
	})

	t.Run("DeltaTombstones", func(t *testing.T) {
		// Covers the rule that SinceUpdateAt > 0 auto-includes soft-deleted rows,
		// while SinceUpdateAt == 0 (and the param being absent entirely) still
		// excludes them — and that the two "unfiltered" calls behave identically.
		groupID := model.NewId()

		// Pin the boundary at least one ms before the first create so all three
		// fields are guaranteed to satisfy UpdateAt > beforeAnyCreate. Without
		// the sleep the first create can land on the same millisecond and the
		// strict-greater filter would silently exclude it.
		beforeAnyCreate := model.GetMillis()
		time.Sleep(2 * time.Millisecond)

		// Two live fields and one we will tombstone.
		live1, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID: groupID, Name: "live-1", Type: model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem), ObjectType: model.PropertyFieldObjectTypeSystem,
		})
		require.NoError(t, err)
		time.Sleep(5 * time.Millisecond)

		live2, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID: groupID, Name: "live-2", Type: model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem), ObjectType: model.PropertyFieldObjectTypeSystem,
		})
		require.NoError(t, err)
		time.Sleep(5 * time.Millisecond)

		tombstoned, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID: groupID, Name: "tombstoned", Type: model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem), ObjectType: model.PropertyFieldObjectTypeSystem,
		})
		require.NoError(t, err)
		time.Sleep(5 * time.Millisecond)

		require.NoError(t, ss.PropertyField().Delete("", tombstoned.ID))

		t.Run("since > 0 returns UpdateAt > since including soft-deleted rows", func(t *testing.T) {
			results, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:       groupID,
				SinceUpdateAt: beforeAnyCreate,
				PerPage:       50,
			})
			require.NoError(t, err)

			ids := make([]string, len(results))
			for i, f := range results {
				ids[i] = f.ID
			}
			require.ElementsMatch(t, []string{live1.ID, live2.ID, tombstoned.ID}, ids)
		})

		t.Run("since=0 and since absent behave identically and exclude tombstones", func(t *testing.T) {
			withZeroSince, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:       groupID,
				SinceUpdateAt: 0,
				PerPage:       50,
			})
			require.NoError(t, err)

			withNoSince, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID: groupID,
				PerPage: 50,
			})
			require.NoError(t, err)

			zeroIDs := make([]string, len(withZeroSince))
			for i, f := range withZeroSince {
				zeroIDs[i] = f.ID
			}
			noIDs := make([]string, len(withNoSince))
			for i, f := range withNoSince {
				noIDs[i] = f.ID
			}

			// Both calls must exclude the tombstoned row and match each other.
			require.ElementsMatch(t, []string{live1.ID, live2.ID}, zeroIDs)
			require.ElementsMatch(t, zeroIDs, noIDs)
		})
	})

	t.Run("DeltaCursor", func(t *testing.T) {
		// Covers paginated iteration in delta mode when multiple fields share a
		// single UpdateAt millisecond — the (UpdateAt, Id) cursor tiebreaker must
		// return every row exactly once, in Id ASC order within the tied bucket.
		// We pin UpdateAt directly via SQL because Go's wall clock has
		// sub-millisecond resolution and three model.GetMillis() calls would
		// generally produce three distinct values.
		groupID := model.NewId()

		beforeBucket := model.GetMillis()
		time.Sleep(5 * time.Millisecond)

		f1, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID: groupID, Name: "tied-1", Type: model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem), ObjectType: model.PropertyFieldObjectTypeSystem,
		})
		require.NoError(t, err)
		f2, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID: groupID, Name: "tied-2", Type: model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem), ObjectType: model.PropertyFieldObjectTypeSystem,
		})
		require.NoError(t, err)
		f3, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID: groupID, Name: "tied-3", Type: model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem), ObjectType: model.PropertyFieldObjectTypeSystem,
		})
		require.NoError(t, err)

		// Force the three rows to share a single UpdateAt value above beforeBucket.
		// Without this, postgres millisecond resolution still usually produces
		// distinct timestamps and the tiebreaker would never fire.
		sharedUpdateAt := model.GetMillis() + 1
		updateQuery, updateArgs, err := sq.StatementBuilder.PlaceholderFormat(s.GetQueryPlaceholder()).
			Update("PropertyFields").
			Set("UpdateAt", sharedUpdateAt).
			Where(sq.Eq{"Id": []string{f1.ID, f2.ID, f3.ID}}).
			ToSql()
		require.NoError(t, err)
		_, execErr := s.GetMaster().Exec(updateQuery, updateArgs...)
		require.NoError(t, execErr)

		// Expected order in delta mode: UpdateAt ASC, then Id ASC. All three share
		// UpdateAt, so the final order is purely Id ASC.
		expectedIDsSorted := []string{f1.ID, f2.ID, f3.ID}
		slices.Sort(expectedIDsSorted)

		// Paginate per_page=1 across the boundary; we must walk all three rows
		// exactly once, never duplicate, never skip.
		collected := []string{}
		cursor := model.PropertyFieldSearchCursor{}
		for range 5 { // hard cap to avoid runaway loop if the cursor never advances
			batch, err := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
				GroupID:       groupID,
				SinceUpdateAt: beforeBucket,
				Cursor:        cursor,
				PerPage:       1,
			})
			require.NoError(t, err)
			if len(batch) == 0 {
				break
			}
			require.Len(t, batch, 1)
			collected = append(collected, batch[0].ID)
			cursor = model.PropertyFieldSearchCursor{
				PropertyFieldID: batch[0].ID,
				UpdateAt:        batch[0].UpdateAt,
			}
		}

		require.Equal(t, expectedIDsSorted, collected,
			"per_page=1 walk across a tied UpdateAt bucket must return each row exactly once in Id ASC order",
		)
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

	t.Run("same-level conflicts", func(t *testing.T) {
		t.Run("system-level should conflict with existing system-level same name", func(t *testing.T) {
			sameLevelName := "same-level-system-" + model.NewId()
			existing, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeText,
				Name:       sameLevelName,
			})
			require.NoError(t, cErr)

			// Another system-level field with the same name should conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       sameLevelName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict)

			// Excluding itself should not conflict
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       sameLevelName,
			}, existing.ID)
			require.NoError(t, err)
			require.Empty(t, conflict, "should not conflict with itself via excludeID")
		})

		t.Run("team-level should conflict with existing team-level same name and target", func(t *testing.T) {
			sameLevelName := "same-level-team-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       sameLevelName,
			})
			require.NoError(t, cErr)

			// Another team-level field with the same name and same TargetID should conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team.Id,
				Name:       sameLevelName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelTeam, conflict)

			// Same name but different team should NOT conflict
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelTeam),
				TargetID:   team2.Id,
				Name:       sameLevelName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "different teams should not conflict at same level")
		})

		t.Run("channel-level should conflict with existing channel-level same name and target", func(t *testing.T) {
			sameLevelName := "same-level-channel-" + model.NewId()
			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Type:       model.PropertyFieldTypeText,
				Name:       sameLevelName,
			})
			require.NoError(t, cErr)

			// Another channel-level field with the same name and same TargetID should conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel.Id,
				Name:       sameLevelName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelChannel, conflict)

			// Same name but different channel should NOT conflict
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelChannel),
				TargetID:   channel2.Id,
				Name:       sameLevelName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "different channels should not conflict at same level")
		})

		t.Run("template fields should conflict with existing template same name and target type", func(t *testing.T) {
			templateName := "same-level-template-" + model.NewId()
			templateGroupID := model.NewId()

			_, cErr := ss.PropertyField().Create(&model.PropertyField{
				ObjectType: model.PropertyFieldObjectTypeTemplate,
				GroupID:    templateGroupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Type:       model.PropertyFieldTypeSelect,
				Name:       templateName,
			})
			require.NoError(t, cErr)

			// Another template with the same name, group, and target_type should conflict
			conflict, err := ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: model.PropertyFieldObjectTypeTemplate,
				GroupID:    templateGroupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       templateName,
			}, "")
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTargetLevelSystem, conflict)

			// Template with same name but different group should NOT conflict
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: model.PropertyFieldObjectTypeTemplate,
				GroupID:    model.NewId(),
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       templateName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "different groups should not conflict")

			// Non-template field with the same name should NOT conflict
			// (different ObjectType)
			conflict, err = ss.PropertyField().CheckPropertyNameConflict(&model.PropertyField{
				ObjectType: objectType,
				GroupID:    templateGroupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				TargetID:   "",
				Name:       templateName,
			}, "")
			require.NoError(t, err)
			require.Empty(t, conflict, "different object types should not conflict")
		})
	})
}

func testCountLinkedFields(t *testing.T, _ request.CTX, ss store.Store) {
	groupID := model.NewId()

	// Create a source field (template, select type, with options)
	sourceField := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Source Template Field",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: map[string]any{
			"options": []any{
				map[string]any{"name": "Option A"},
				map[string]any{"name": "Option B"},
			},
		},
	}
	sourceField, err := ss.PropertyField().Create(sourceField)
	require.NoError(t, err)

	t.Run("should return 0 when no linked fields exist", func(t *testing.T) {
		count, cErr := ss.PropertyField().CountLinkedFields(sourceField.ID)
		require.NoError(t, cErr)
		require.Equal(t, int64(0), count)
	})

	// Create 2 linked fields pointing to source
	linked1 := &model.PropertyField{
		GroupID:       groupID,
		Name:          "Linked Field 1",
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    "user",
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &sourceField.ID,
		Attrs: map[string]any{
			"options": []any{
				map[string]any{"name": "Option A"},
				map[string]any{"name": "Option B"},
			},
		},
	}
	linked1, err = ss.PropertyField().Create(linked1)
	require.NoError(t, err)

	linked2 := &model.PropertyField{
		GroupID:       groupID,
		Name:          "Linked Field 2",
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    "user",
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &sourceField.ID,
		Attrs: map[string]any{
			"options": []any{
				map[string]any{"name": "Option A"},
				map[string]any{"name": "Option B"},
			},
		},
	}
	_, err = ss.PropertyField().Create(linked2)
	require.NoError(t, err)

	t.Run("should return 2 when two linked fields exist", func(t *testing.T) {
		count, cErr := ss.PropertyField().CountLinkedFields(sourceField.ID)
		require.NoError(t, cErr)
		require.Equal(t, int64(2), count)
	})

	t.Run("should not count soft-deleted linked fields", func(t *testing.T) {
		// Soft-delete one linked field
		err := ss.PropertyField().Delete("", linked1.ID)
		require.NoError(t, err)

		count, cErr := ss.PropertyField().CountLinkedFields(sourceField.ID)
		require.NoError(t, cErr)
		require.Equal(t, int64(1), count)
	})

	t.Run("should count newly created linked fields", func(t *testing.T) {
		linked3 := &model.PropertyField{
			GroupID:       groupID,
			Name:          "Linked Field 3",
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    "user",
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &sourceField.ID,
			Attrs: map[string]any{
				"options": []any{
					map[string]any{"name": "Option A"},
					map[string]any{"name": "Option B"},
				},
			},
		}
		_, cErr := ss.PropertyField().Create(linked3)
		require.NoError(t, cErr)

		count, cErr := ss.PropertyField().CountLinkedFields(sourceField.ID)
		require.NoError(t, cErr)
		require.Equal(t, int64(2), count)
	})
}

func testGetLinkedFields(t *testing.T, _ request.CTX, ss store.Store) {
	groupID := model.NewId()

	template, err := ss.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "Programs",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: map[string]any{
			"options": []any{map[string]any{"name": "Air Program"}},
		},
	})
	require.NoError(t, err)

	newLinkedField := func(t *testing.T, name string) *model.PropertyField {
		t.Helper()
		field, cErr := ss.PropertyField().Create(&model.PropertyField{
			GroupID:       groupID,
			Name:          name,
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    "user",
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, cErr)
		return field
	}

	fieldIDs := func(fields []*model.PropertyField) []string {
		ids := make([]string, 0, len(fields))
		for _, field := range fields {
			ids = append(ids, field.ID)
		}
		return ids
	}

	t.Run("should return nothing for a field nothing links to", func(t *testing.T) {
		fields, gErr := ss.PropertyField().GetLinkedFields([]string{template.ID}, nil)
		require.NoError(t, gErr)
		require.Empty(t, fields)
	})

	t.Run("should return nothing when asked about no fields", func(t *testing.T) {
		fields, gErr := ss.PropertyField().GetLinkedFields(nil, nil)
		require.NoError(t, gErr)
		require.Empty(t, fields)
	})

	first := newLinkedField(t, "First")
	second := newLinkedField(t, "Second")

	t.Run("should return each linking field with the options it derives", func(t *testing.T) {
		fields, gErr := ss.PropertyField().GetLinkedFields([]string{template.ID}, nil)
		require.NoError(t, gErr)
		require.ElementsMatch(t, []string{first.ID, second.ID}, fieldIDs(fields))

		// The options are the template's: a linking field owns none of its own, and
		// the point of this read is to hand a caller the field as its readers see it.
		for _, field := range fields {
			options, ok := field.Attrs["options"].([]any)
			require.True(t, ok, "field %s should carry an option list", field.Name)
			require.Len(t, options, 1)
			require.Equal(t, "Air Program", options[0].(map[string]any)["name"])
		}
	})

	t.Run("should leave out the fields named in excludeIDs", func(t *testing.T) {
		fields, gErr := ss.PropertyField().GetLinkedFields([]string{template.ID}, []string{first.ID})
		require.NoError(t, gErr)
		require.Equal(t, []string{second.ID}, fieldIDs(fields))
	})

	t.Run("should leave out a deleted field", func(t *testing.T) {
		require.NoError(t, ss.PropertyField().Delete("", second.ID))

		fields, gErr := ss.PropertyField().GetLinkedFields([]string{template.ID}, nil)
		require.NoError(t, gErr)
		require.Equal(t, []string{first.ID}, fieldIDs(fields))
	})
}

func testUpdateWithLinkedDependents(t *testing.T, rctx request.CTX, ss store.Store) {
	groupID := model.NewId()

	optA := map[string]any{"id": model.NewId(), "name": "A"}
	optB := map[string]any{"id": model.NewId(), "name": "B"}

	// Create a source field with options [A, B]
	sourceField := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Propagation Source",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: map[string]any{
			"options": []any{optA, optB},
		},
	}
	sourceField, err := ss.PropertyField().Create(sourceField)
	require.NoError(t, err)

	// Create 2 linked fields pointing to source
	linked1 := &model.PropertyField{
		GroupID:       groupID,
		Name:          "Propagation Linked 1",
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    "user",
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &sourceField.ID,
		Attrs: map[string]any{
			"options": []any{optA, optB},
		},
	}
	linked1, err = ss.PropertyField().Create(linked1)
	require.NoError(t, err)

	linked2 := &model.PropertyField{
		GroupID:       groupID,
		Name:          "Propagation Linked 2",
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    "user",
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &sourceField.ID,
		Attrs: map[string]any{
			"options": []any{optA, optB},
		},
	}
	linked2, err = ss.PropertyField().Create(linked2)
	require.NoError(t, err)

	t.Run("added options are visible through all linked fields", func(t *testing.T) {
		optC := map[string]any{"id": model.NewId(), "name": "C"}
		newOptions := []any{optA, optB, optC}

		// Update source field's options to [A, B, C]
		sourceField.Attrs = map[string]any{
			"options": newOptions,
		}

		result, uErr := ss.PropertyField().Update("", []*model.PropertyField{sourceField}, nil)
		require.NoError(t, uErr)

		// The result should contain the source field + both linked fields (3 total)
		require.Len(t, result, 3)

		// Verify both linked fields now have the updated options
		retrievedLinked1, gErr := ss.PropertyField().Get(rctx, "", linked1.ID)
		require.NoError(t, gErr)
		options1 := retrievedLinked1.Attrs["options"].([]any)
		require.Len(t, options1, 3)

		retrievedLinked2, gErr := ss.PropertyField().Get(rctx, "", linked2.ID)
		require.NoError(t, gErr)
		options2 := retrievedLinked2.Attrs["options"].([]any)
		require.Len(t, options2, 3)
	})

	t.Run("removed options disappear from all linked fields", func(t *testing.T) {
		// Remove option B, keep only A and the previously-added C
		optC := map[string]any{"id": model.NewId(), "name": "C"} // re-create to have a fresh ID
		reducedOptions := []any{optA, optC}

		sourceField.Attrs = map[string]any{
			"options": reducedOptions,
		}

		result, uErr := ss.PropertyField().Update("", []*model.PropertyField{sourceField}, nil)
		require.NoError(t, uErr)
		require.Len(t, result, 3) // source + 2 linked

		// Verify linked fields have exactly 2 options
		retrievedLinked1, gErr := ss.PropertyField().Get(rctx, "", linked1.ID)
		require.NoError(t, gErr)
		options1 := retrievedLinked1.Attrs["options"].([]any)
		require.Len(t, options1, 2)

		retrievedLinked2, gErr := ss.PropertyField().Get(rctx, "", linked2.ID)
		require.NoError(t, gErr)
		options2 := retrievedLinked2.Attrs["options"].([]any)
		require.Len(t, options2, 2)
	})

	t.Run("renamed options are visible through linked fields", func(t *testing.T) {
		// Update option A's name
		optAUpdated := map[string]any{"id": optA["id"], "name": "A-Renamed"}
		updatedOptions := []any{optAUpdated}

		sourceField.Attrs = map[string]any{
			"options": updatedOptions,
		}

		_, uErr := ss.PropertyField().Update("", []*model.PropertyField{sourceField}, nil)
		require.NoError(t, uErr)

		// Verify linked fields have the renamed option
		retrievedLinked1, gErr := ss.PropertyField().Get(rctx, "", linked1.ID)
		require.NoError(t, gErr)
		options1 := retrievedLinked1.Attrs["options"].([]any)
		require.Len(t, options1, 1)
		firstOpt := options1[0].(map[string]any)
		require.Equal(t, "A-Renamed", firstOpt["name"])
	})

	t.Run("name-only update does not return linked fields when options unchanged", func(t *testing.T) {
		sourceField.Name = "Updated Name"
		result, uErr := ss.PropertyField().Update("", []*model.PropertyField{sourceField}, nil)
		require.NoError(t, uErr)
		require.Len(t, result, 1) // only source, no linked fields
		require.Equal(t, "Updated Name", result[0].Name)
	})

	t.Run("should reject update when expectedUpdateAts do not match (optimistic concurrency)", func(t *testing.T) {
		// Read the current state of the source field
		current, gErr := ss.PropertyField().Get(rctx, "", sourceField.ID)
		require.NoError(t, gErr)

		// Simulate a concurrent update by directly modifying the field
		current.Name = "Concurrent Update"
		_, uErr := ss.PropertyField().Update("", []*model.PropertyField{current}, nil)
		require.NoError(t, uErr)

		// Now try to update with stale expectedUpdateAts (using the old UpdateAt)
		staleUpdateAts := map[string]int64{sourceField.ID: sourceField.UpdateAt}
		sourceField.Name = "Stale Update"
		_, uErr = ss.PropertyField().Update("", []*model.PropertyField{sourceField}, staleUpdateAts)
		require.Error(t, uErr)

		var conflictErr *store.ErrConflict
		require.ErrorAs(t, uErr, &conflictErr)

		// Verify the field was NOT updated (concurrent update's value persists)
		after, gErr := ss.PropertyField().Get(rctx, "", sourceField.ID)
		require.NoError(t, gErr)
		require.Equal(t, "Concurrent Update", after.Name)
	})

	t.Run("should succeed when expectedUpdateAts match current state", func(t *testing.T) {
		// Read the current state
		current, gErr := ss.PropertyField().Get(rctx, "", sourceField.ID)
		require.NoError(t, gErr)

		// Update with correct expectedUpdateAts
		expectedUpdateAts := map[string]int64{current.ID: current.UpdateAt}
		current.Name = "Valid Update"
		result, uErr := ss.PropertyField().Update("", []*model.PropertyField{current}, expectedUpdateAts)
		require.NoError(t, uErr)
		require.Len(t, result, 1)
		require.Equal(t, "Valid Update", result[0].Name)
	})

	t.Run("batch update should reject entirely when one field has stale expectedUpdateAt", func(t *testing.T) {
		// Create a second independent field for batch testing
		batchField := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Batch OCC Field",
			Type:       model.PropertyFieldTypeText,
			ObjectType: "user",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		batchField, cErr := ss.PropertyField().Create(batchField)
		require.NoError(t, cErr)

		// Get fresh state of batch field
		freshBatch, gErr := ss.PropertyField().Get(rctx, "", batchField.ID)
		require.NoError(t, gErr)

		// Save the pre-update UpdateAt before the concurrent modification
		staleBatchUpdateAt := freshBatch.UpdateAt

		// Ensure the concurrent update gets a different timestamp
		time.Sleep(2 * time.Millisecond)

		// Concurrently modify only batchField (advance its UpdateAt)
		freshBatch.Name = "Concurrent Batch Change"
		_, uErr := ss.PropertyField().Update("", []*model.PropertyField{freshBatch}, nil)
		require.NoError(t, uErr)

		// Re-fetch the source since it wasn't modified (its UpdateAt is still valid)
		freshSource, gErr := ss.PropertyField().Get(rctx, "", sourceField.ID)
		require.NoError(t, gErr)

		// Attempt batch update using stale UpdateAt for batchField but fresh for source
		expectedUpdateAts := map[string]int64{
			freshSource.ID: freshSource.UpdateAt,
			batchField.ID:  staleBatchUpdateAt, // stale — batchField was modified concurrently
		}
		freshSource.Name = "Should Not Stick"
		freshBatch.Name = "Should Also Not Stick"
		_, uErr = ss.PropertyField().Update("", []*model.PropertyField{freshSource, freshBatch}, expectedUpdateAts)
		require.Error(t, uErr)

		var conflictErr *store.ErrConflict
		require.ErrorAs(t, uErr, &conflictErr)

		// Verify neither field was updated (transaction rolled back)
		afterSource, gErr := ss.PropertyField().Get(rctx, "", sourceField.ID)
		require.NoError(t, gErr)
		require.NotEqual(t, "Should Not Stick", afterSource.Name)

		afterBatch, gErr := ss.PropertyField().Get(rctx, "", batchField.ID)
		require.NoError(t, gErr)
		require.Equal(t, "Concurrent Batch Change", afterBatch.Name)
	})

	t.Run("should return linked dependents and enforce optimistic concurrency together", func(t *testing.T) {
		// Get fresh state of source field for OCC
		freshSource, gErr := ss.PropertyField().Get(rctx, "", sourceField.ID)
		require.NoError(t, gErr)

		optNew := map[string]any{"id": model.NewId(), "name": "PropagateOCC"}
		newOptions := []any{optNew}
		freshSource.Attrs = map[string]any{"options": newOptions}

		expectedUpdateAts := map[string]int64{freshSource.ID: freshSource.UpdateAt}
		result, uErr := ss.PropertyField().Update("", []*model.PropertyField{freshSource}, expectedUpdateAts)
		require.NoError(t, uErr)
		// source + 2 linked fields
		require.Len(t, result, 3)

		retrievedLinked1, gErr := ss.PropertyField().Get(rctx, "", linked1.ID)
		require.NoError(t, gErr)
		opts := retrievedLinked1.Attrs["options"].([]any)
		require.Len(t, opts, 1)
		require.Equal(t, "PropagateOCC", opts[0].(map[string]any)["name"])
	})

	t.Run("should reject an option change when source has stale expectedUpdateAt", func(t *testing.T) {
		freshSource, gErr := ss.PropertyField().Get(rctx, "", sourceField.ID)
		require.NoError(t, gErr)

		// Save the pre-update UpdateAt
		staleSourceUpdateAt := freshSource.UpdateAt

		// Advance the source field's UpdateAt with a concurrent update
		freshSource.Name = "Advanced Source"
		_, uErr := ss.PropertyField().Update("", []*model.PropertyField{freshSource}, nil)
		require.NoError(t, uErr)

		optStale := map[string]any{"id": model.NewId(), "name": "ShouldNotPropagate"}
		staleOptions := []any{optStale}
		freshSource.Attrs = map[string]any{"options": staleOptions}

		staleUpdateAts := map[string]int64{freshSource.ID: staleSourceUpdateAt} // stale
		_, uErr = ss.PropertyField().Update("", []*model.PropertyField{freshSource}, staleUpdateAts)
		require.Error(t, uErr)

		var conflictErr *store.ErrConflict
		require.ErrorAs(t, uErr, &conflictErr)

		retrievedLinked1, gErr := ss.PropertyField().Get(rctx, "", linked1.ID)
		require.NoError(t, gErr)
		opts := retrievedLinked1.Attrs["options"].([]any)
		firstOpt := opts[0].(map[string]any)
		require.NotEqual(t, "ShouldNotPropagate", firstOpt["name"])
	})

	t.Run("nil expectedUpdateAts should skip concurrency check (backwards compat)", func(t *testing.T) {
		freshSource, gErr := ss.PropertyField().Get(rctx, "", sourceField.ID)
		require.NoError(t, gErr)

		// Update without any concurrency check — should always succeed
		freshSource.Name = "No OCC Check"
		result, uErr := ss.PropertyField().Update("", []*model.PropertyField{freshSource}, nil)
		require.NoError(t, uErr)
		require.Len(t, result, 1)
		require.Equal(t, "No OCC Check", result[0].Name)

		// Do it again immediately — still no check
		result[0].Name = "Still No OCC Check"
		result2, uErr := ss.PropertyField().Update("", []*model.PropertyField{result[0]}, nil)
		require.NoError(t, uErr)
		require.Len(t, result2, 1)
		require.Equal(t, "Still No OCC Check", result2[0].Name)
	})
}

func testSearchByLinkedFieldID(t *testing.T, _ request.CTX, ss store.Store) {
	groupID := model.NewId()

	// Create a source field
	sourceField := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Search Source Field",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: map[string]any{
			"options": []any{
				map[string]any{"name": "X"},
			},
		},
	}
	sourceField, err := ss.PropertyField().Create(sourceField)
	require.NoError(t, err)

	// Create 3 linked fields pointing to source
	for i := range 3 {
		linked := &model.PropertyField{
			GroupID:       groupID,
			Name:          fmt.Sprintf("Search Linked %d", i),
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    "user",
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &sourceField.ID,
			Attrs: map[string]any{
				"options": []any{
					map[string]any{"name": "X"},
				},
			},
		}
		_, cErr := ss.PropertyField().Create(linked)
		require.NoError(t, cErr)
		time.Sleep(time.Millisecond)
	}

	t.Run("should find all linked fields by LinkedFieldID", func(t *testing.T) {
		results, sErr := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
			LinkedFieldID: sourceField.ID,
			PerPage:       10,
		})
		require.NoError(t, sErr)
		require.Len(t, results, 3)
	})

	t.Run("should return 0 results for non-existent LinkedFieldID", func(t *testing.T) {
		results, sErr := ss.PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
			LinkedFieldID: model.NewId(),
			PerPage:       10,
		})
		require.NoError(t, sErr)
		require.Len(t, results, 0)
	})
}

// testPropertyFieldOptionStorage covers the seam between a field's inline option
// list and the PropertyOptions rows behind it: the list a caller writes has to
// read back unchanged, a field's options have to include the ones its link source
// owns, and a list too large to inline has to degrade instead of erroring.
func testPropertyFieldOptionStorage(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	groupID := model.NewId()

	newSelectField := func(t *testing.T, name string, options []any) *model.PropertyField {
		t.Helper()
		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       name + "-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": options},
		})
		require.NoError(t, err)
		return field
	}

	// countOwnedOptions reports how many live options the field owns itself, as
	// opposed to the ones it derives from its link source.
	countOwnedOptions := func(t *testing.T, fieldID string) int {
		t.Helper()
		var count int
		err := s.GetMaster().Get(&count,
			"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1 AND DeleteAt = 0", fieldID)
		require.NoError(t, err)
		return count
	}

	optionNames := func(field *model.PropertyField) []string {
		var names []string
		for _, raw := range field.Attrs["options"].([]any) {
			opt := raw.(map[string]any)
			name, _ := opt["name"].(string)
			names = append(names, name)
		}
		return names
	}

	t.Run("an option list reads back exactly as written", func(t *testing.T) {
		// Every shape the option list is known to carry: the canonical
		// id/name/color triple, a rank, an option with no color key at all, an
		// explicitly empty color, extra keys a plugin attached, and -- from
		// callers that write the store directly -- a short id and no name key.
		options := []any{
			map[string]any{"id": model.NewId(), "name": "Canonical", "color": "#112233"},
			map[string]any{"id": model.NewId(), "name": "Ranked", "color": "", "rank": 3},
			map[string]any{"id": model.NewId(), "name": "NoColorKey"},
			map[string]any{"id": model.NewId(), "name": "Extras", "color": "#445566", "shape": "circle", "meta": map[string]any{"k": 1}},
			map[string]any{"id": "short-id", "value": "NoNameKey"},
		}
		field := newSelectField(t, "RoundTrip", options)

		written, err := json.Marshal(field.Attrs)
		require.NoError(t, err)

		read, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		readBack, err := json.Marshal(read.Attrs)
		require.NoError(t, err)
		require.JSONEq(t, string(written), string(readBack), "a field must read back the option list it was written with")

		// The blob key itself is gone from the row: the rows are the only copy.
		var stored int
		require.NoError(t, s.GetMaster().Get(&stored,
			"SELECT COUNT(*) FROM PropertyFields WHERE ID = $1 AND Attrs->'options' IS NOT NULL", field.ID))
		require.Zero(t, stored, "the options key must not be stored on the field row")

		// Reordering and renaming through an update round-trips too, order
		// included -- the order options are written in is the order they display
		// in.
		reordered := []any{options[4], options[2], options[0], options[3], options[1]}
		read.Attrs["options"] = reordered
		updated, err := ss.PropertyField().Update(groupID, []*model.PropertyField{read}, nil)
		require.NoError(t, err)
		require.Len(t, updated, 1)

		reread, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		expected, err := json.Marshal(model.StringInterface{"options": reordered})
		require.NoError(t, err)
		actual, err := json.Marshal(model.StringInterface{"options": reread.Attrs["options"]})
		require.NoError(t, err)
		require.JSONEq(t, string(expected), string(actual))
	})

	t.Run("a field with no options has no options key", func(t *testing.T) {
		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "NoOptions-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, err)

		read, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		require.NotContains(t, read.Attrs, "options")
		require.NotContains(t, read.Attrs, "options_omitted")
		// And a field written with no attrs at all does not come back with an
		// empty object: hydration adds a key only when it has one to add.
		require.Nil(t, read.Attrs)
	})

	t.Run("an oversized option list is reported rather than inlined", func(t *testing.T) {
		total := model.PropertyFieldMaxHydratedOptions + 1
		options := make([]any, 0, total)
		for i := range total {
			options = append(options, map[string]any{"id": model.NewId(), "name": fmt.Sprintf("Option %d", i)})
		}
		field := newSelectField(t, "Oversized", options)

		read, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		require.NotContains(t, read.Attrs, "options", "an oversized list must be left out, not truncated")
		require.Equal(t, true, read.Attrs["options_omitted"])
		require.Equal(t, total, read.Attrs["options_count"])

		// Writing that field back must not be read as "this field has no
		// options": the caller never saw them and cannot be asked to resend them.
		read.Name = "Oversized-Renamed-" + model.NewId()
		_, err = ss.PropertyField().Update(groupID, []*model.PropertyField{read}, nil)
		require.NoError(t, err)
		require.Equal(t, total, countOwnedOptions(t, field.ID))

		// Neither must the marker keys reach the row.
		var stored int
		require.NoError(t, s.GetMaster().Get(&stored,
			"SELECT COUNT(*) FROM PropertyFields WHERE ID = $1 AND (Attrs->'options_omitted' IS NOT NULL OR Attrs->'options_count' IS NOT NULL)", field.ID))
		require.Zero(t, stored, "the read-side marker keys must not be stored on the field row")
	})

	t.Run("a list at the cap is still inlined", func(t *testing.T) {
		options := make([]any, 0, model.PropertyFieldMaxHydratedOptions)
		for i := range model.PropertyFieldMaxHydratedOptions {
			options = append(options, map[string]any{"id": model.NewId(), "name": fmt.Sprintf("Option %d", i)})
		}
		field := newSelectField(t, "AtCap", options)

		read, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		require.Len(t, read.Attrs["options"].([]any), model.PropertyFieldMaxHydratedOptions)
		require.NotContains(t, read.Attrs, "options_omitted")
	})

	t.Run("linked fields derive their options from the template", func(t *testing.T) {
		optA := map[string]any{"id": model.NewId(), "name": "A"}
		optB := map[string]any{"id": model.NewId(), "name": "B"}
		template := newSelectField(t, "DeriveTemplate", []any{optA, optB})

		// Both linked fields are created the way the app layer creates them:
		// carrying a copy of the template's list, same option IDs.
		linked := make([]*model.PropertyField, 2)
		for i := range linked {
			field, err := ss.PropertyField().Create(&model.PropertyField{
				GroupID:       groupID,
				Name:          fmt.Sprintf("DeriveLinked%d-%s", i, model.NewId()),
				Type:          model.PropertyFieldTypeSelect,
				ObjectType:    model.PropertyFieldObjectTypeUser,
				TargetType:    string(model.PropertyFieldTargetLevelSystem),
				LinkedFieldID: &template.ID,
				Attrs:         model.StringInterface{"options": []any{optA, optB}},
			})
			require.NoError(t, err)
			linked[i] = field
		}

		// The copy created no rows of its own: the template owns all of them.
		require.Equal(t, 2, countOwnedOptions(t, template.ID))
		for _, field := range linked {
			require.Zero(t, countOwnedOptions(t, field.ID), "a linked field must not store a copy of its template's options")

			read, err := ss.PropertyField().Get(rctx, groupID, field.ID)
			require.NoError(t, err)
			require.Equal(t, []string{"A", "B"}, optionNames(read))
		}

		// A template edit reaches both linked fields without writing to them.
		beforeUpdateAt := map[string]int64{}
		for _, field := range linked {
			beforeUpdateAt[field.ID] = field.UpdateAt
		}

		optC := map[string]any{"id": model.NewId(), "name": "C"}
		template.Attrs["options"] = []any{optA, optB, optC}
		returned, err := ss.PropertyField().Update(groupID, []*model.PropertyField{template}, nil)
		require.NoError(t, err)
		require.Len(t, returned, 3, "the update must return the template and both dependents")

		for _, field := range linked {
			read, gErr := ss.PropertyField().Get(rctx, groupID, field.ID)
			require.NoError(t, gErr)
			require.Equal(t, []string{"A", "B", "C"}, optionNames(read))
			require.Equal(t, beforeUpdateAt[field.ID], read.UpdateAt, "a template option change must not write to its dependents")
			require.Zero(t, countOwnedOptions(t, field.ID))
		}
	})

	t.Run("a linked field keeps options the template does not have", func(t *testing.T) {
		shared := map[string]any{"id": model.NewId(), "name": "Shared"}
		template := newSelectField(t, "DivergeTemplate", []any{shared})

		local := map[string]any{"id": model.NewId(), "name": "Local"}
		linked, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:       groupID,
			Name:          "DivergeLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Attrs:         model.StringInterface{"options": []any{shared, local}},
		})
		require.NoError(t, err)

		// Only the option the template does not have becomes a row of the linked
		// field's own; the shared one stays the template's.
		require.Equal(t, 1, countOwnedOptions(t, linked.ID))
		require.Equal(t, 1, countOwnedOptions(t, template.ID))

		readLinked, err := ss.PropertyField().Get(rctx, groupID, linked.ID)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"Shared", "Local"}, optionNames(readLinked))

		readTemplate, err := ss.PropertyField().Get(rctx, groupID, template.ID)
		require.NoError(t, err)
		require.Equal(t, []string{"Shared"}, optionNames(readTemplate), "a linked field's own option must not appear on the template")
	})

	t.Run("unlinking a field keeps the options it was deriving", func(t *testing.T) {
		optA := map[string]any{"id": model.NewId(), "name": "A"}
		optB := map[string]any{"id": model.NewId(), "name": "B"}
		template := newSelectField(t, "UnlinkTemplate", []any{optA, optB})

		linked, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:       groupID,
			Name:          "UnlinkLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Attrs:         model.StringInterface{"options": []any{optA, optB}},
		})
		require.NoError(t, err)
		require.Zero(t, countOwnedOptions(t, linked.ID))

		// Unlinking takes over the derived options under the IDs the field's
		// property values already point at, and leaves the template's alone.
		linked.LinkedFieldID = nil
		_, err = ss.PropertyField().Update(groupID, []*model.PropertyField{linked}, nil)
		require.NoError(t, err)

		require.Equal(t, 2, countOwnedOptions(t, linked.ID))
		require.Equal(t, 2, countOwnedOptions(t, template.ID))

		read, err := ss.PropertyField().Get(rctx, groupID, linked.ID)
		require.NoError(t, err)
		require.Equal(t, []string{"A", "B"}, optionNames(read))

		readIDs := []string{}
		for _, raw := range read.Attrs["options"].([]any) {
			readIDs = append(readIDs, raw.(map[string]any)["id"].(string))
		}
		require.Equal(t, []string{optA["id"].(string), optB["id"].(string)}, readIDs)
	})

	t.Run("unlinking a field whose options were withheld keeps them too", func(t *testing.T) {
		// The takeover cannot be driven from the option list on the submitted
		// field: above the cap a read leaves that list out, so a caller unlinking
		// such a field has nothing to send. The rows have to be copied from the
		// link source instead, or the field unlinks into a field with no options
		// at all while its property values still point at the template's.
		total := model.PropertyFieldMaxHydratedOptions + 1
		options := make([]any, 0, total)
		for i := range total {
			options = append(options, map[string]any{"id": model.NewId(), "name": fmt.Sprintf("Unlink %d", i)})
		}
		template := newSelectField(t, "UnlinkOversizedTemplate", options)

		linked, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:       groupID,
			Name:          "UnlinkOversizedLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Attrs:         model.StringInterface{"options": options},
		})
		require.NoError(t, err)
		require.Zero(t, countOwnedOptions(t, linked.ID))

		// Unlink the way a caller has to: read the field, which comes back with
		// its option list withheld, then clear the link on what was read.
		read, err := ss.PropertyField().Get(rctx, groupID, linked.ID)
		require.NoError(t, err)
		require.Equal(t, true, read.Attrs["options_omitted"], "the field has to be over the cap for this to be the interesting case")

		read.LinkedFieldID = nil
		_, err = ss.PropertyField().Update(groupID, []*model.PropertyField{read}, nil)
		require.NoError(t, err)

		require.Equal(t, total, countOwnedOptions(t, linked.ID), "the unlinked field must own every option it was deriving")
		require.Equal(t, total, countOwnedOptions(t, template.ID), "the template must keep its own")

		// Same identifiers, because the field's property values point at them.
		var carried int
		require.NoError(t, s.GetMaster().Get(&carried, `SELECT COUNT(*) FROM PropertyOptions own
			JOIN PropertyOptions src ON src.ID = own.ID AND src.FieldID = $1
			WHERE own.FieldID = $2 AND own.DeleteAt = 0 AND src.DeleteAt = 0`, template.ID, linked.ID))
		require.Equal(t, total, carried, "the taken-over options must keep their identifiers")
	})

	t.Run("a type that carries no options keeps its attrs untouched", func(t *testing.T) {
		// Nothing ever read "options" on a text field, so whatever sits there is
		// not an option list and must not be moved or dropped.
		attrs := model.StringInterface{"options": []any{"not", "an", "object"}, "value_type": "email"}
		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "TextWithOptionsKey-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      attrs,
		})
		require.NoError(t, err)

		read, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		written, err := json.Marshal(attrs)
		require.NoError(t, err)
		readBack, err := json.Marshal(read.Attrs)
		require.NoError(t, err)
		require.JSONEq(t, string(written), string(readBack))
		require.Zero(t, countOwnedOptions(t, field.ID))
	})
}

func testPropertyFieldOptionEdges(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	groupID := model.NewId()

	// newField creates a field owning one option per name. The option IDs are
	// passed in rather than generated so a test can give two fields options under
	// the same identifiers, which is legal: an option is identified by its field
	// and its ID together.
	newField := func(t *testing.T, fieldType model.PropertyFieldType, optionIDsByName map[string]string) *model.PropertyField {
		t.Helper()
		options := make([]any, 0, len(optionIDsByName))
		for name, id := range optionIDsByName {
			options = append(options, map[string]any{"id": id, "name": name})
		}
		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "Edges-" + model.NewId(),
			Type:       fieldType,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": options},
		})
		require.NoError(t, err)
		return field
	}

	// A three-node chain: Fighter Jet is below Air, F-18 below Fighter Jet.
	programIDs := func() map[string]string {
		return map[string]string{
			"Air Program":         model.NewId(),
			"Fighter Jet Program": model.NewId(),
			"F-18 Program":        model.NewId(),
		}
	}

	edge := func(fieldID, child, parent string) *model.PropertyOptionEdge {
		return &model.PropertyOptionEdge{FieldID: fieldID, ChildOptionID: child, ParentOptionID: parent}
	}

	// asPairs reduces an edge set to child->parent pairs so a test can compare it
	// without caring about row order or timestamps.
	asPairs := func(edges []*model.PropertyOptionEdge) [][2]string {
		pairs := make([][2]string, 0, len(edges))
		for _, e := range edges {
			pairs = append(pairs, [2]string{e.ChildOptionID, e.ParentOptionID})
		}
		return pairs
	}

	// mutate changes a field's hierarchy the way a caller that has just read the
	// field does: under the UpdateAt the read saw. Re-reading here rather than
	// using the field the test holds keeps a fixture built in several calls from
	// tripping the check that exists for concurrent writers.
	mutate := func(t *testing.T, field *model.PropertyField, add, remove []*model.PropertyOptionEdge) error {
		t.Helper()
		current, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		return ss.PropertyField().MutateOptions(groupID, field.ID, current.UpdateAt, nil, add, remove)
	}

	t.Run("edges are stored, read back, and deleted", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)

		edges := []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
			edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
		}
		require.NoError(t, mutate(t, field, edges, nil))

		read, err := ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.ElementsMatch(t, asPairs(edges), asPairs(read))
		for _, e := range read {
			require.NotZero(t, e.CreateAt)
		}

		// Re-asserting an edge that is already there is not an error, and does not
		// duplicate it: a caller stating an option's parents does not have to work
		// out which of them are new.
		require.NoError(t, mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
		}, nil))
		read, err = ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Len(t, read, 2)

		require.NoError(t, mutate(t, field, nil, []*model.PropertyOptionEdge{
			edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
		}))
		read, err = ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Equal(t, [][2]string{{ids["Fighter Jet Program"], ids["Air Program"]}}, asPairs(read))

		// And deleting an edge that is not there leaves the rest alone.
		require.NoError(t, mutate(t, field, nil, []*model.PropertyOptionEdge{
			edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
		}))
		read, err = ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Len(t, read, 1)
	})

	t.Run("one change removes and adds together", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)

		require.NoError(t, mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
			edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
		}, nil))

		// Re-parenting the lowest option straight onto the top one: a single change
		// that drops one link and makes another, which is what asserting an option's
		// parents amounts to.
		require.NoError(t, mutate(t,
			field,
			[]*model.PropertyOptionEdge{edge(field.ID, ids["F-18 Program"], ids["Air Program"])},
			[]*model.PropertyOptionEdge{edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"])},
		))

		read, err := ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.ElementsMatch(t, [][2]string{
			{ids["Fighter Jet Program"], ids["Air Program"]},
			{ids["F-18 Program"], ids["Air Program"]},
		}, asPairs(read))

		// An edge in both lists ends up present: the removals go first.
		both := []*model.PropertyOptionEdge{edge(field.ID, ids["F-18 Program"], ids["Air Program"])}
		require.NoError(t, mutate(t, field, both, both))
		read, err = ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Len(t, read, 2)
	})

	t.Run("both endpoints must be options the edge's own field owns", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)
		other := newField(t, model.PropertyFieldTypeGraph, map[string]string{"Sea Program": model.NewId()})
		otherIDs := map[string]string{}
		for _, raw := range other.Attrs["options"].([]any) {
			opt := raw.(map[string]any)
			otherIDs[opt["name"].(string)] = opt["id"].(string)
		}

		// An option of another field, in either position, and an option of no
		// field at all.
		for name, e := range map[string]*model.PropertyOptionEdge{
			"parent belongs to another field": edge(field.ID, ids["F-18 Program"], otherIDs["Sea Program"]),
			"child belongs to another field":  edge(field.ID, otherIDs["Sea Program"], ids["Air Program"]),
			"parent does not exist":           edge(field.ID, ids["F-18 Program"], model.NewId()),
		} {
			err := mutate(t, field, []*model.PropertyOptionEdge{e}, nil)
			require.Error(t, err, name)
			var invalidErr *store.ErrInvalidInput
			require.ErrorAs(t, err, &invalidErr, name)
		}

		// A soft-deleted option is not one the field can link either: its
		// hierarchy is made of the options it still has.
		field.Attrs["options"] = []any{
			map[string]any{"id": ids["Air Program"], "name": "Air Program"},
			map[string]any{"id": ids["Fighter Jet Program"], "name": "Fighter Jet Program"},
		}
		_, err := ss.PropertyField().Update(groupID, []*model.PropertyField{field}, nil)
		require.NoError(t, err)

		err = mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["F-18 Program"], ids["Air Program"]),
		}, nil)
		require.Error(t, err)

		// Nothing was written by any of the rejected calls.
		read, err := ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Empty(t, read)
	})

	t.Run("a rejected change leaves the hierarchy it started with", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)

		require.NoError(t, mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
		}, nil))
		before, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)

		// A change is one thing: this one would have removed a link and added two,
		// the second of which names an option that does not exist. None of it lands
		// -- not the removal, not the first addition, and not the record on the
		// field that its options changed.
		err = mutate(t,
			field,
			[]*model.PropertyOptionEdge{
				edge(field.ID, ids["F-18 Program"], ids["Air Program"]),
				edge(field.ID, ids["F-18 Program"], model.NewId()),
			},
			[]*model.PropertyOptionEdge{edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"])},
		)
		require.Error(t, err)

		read, err := ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Equal(t, [][2]string{{ids["Fighter Jet Program"], ids["Air Program"]}}, asPairs(read))

		after, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		require.Equal(t, before.UpdateAt, after.UpdateAt)
	})

	t.Run("a hierarchy change records itself on the field it belongs to", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)

		// Nothing on the field's own row changes when its options' hierarchy does,
		// so without this a client syncing on UpdateAt would never hear about it.
		require.NoError(t, mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
		}, nil))
		read, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		require.Greater(t, read.UpdateAt, field.UpdateAt)

		// And it only ever moves forwards. A row already at or past the current
		// millisecond is what two changes inside one millisecond look like, and
		// leaving UpdateAt where it was would let the second of them compare against
		// a value the first had rewritten to the same number -- so both would be
		// applied, each having been checked without the other.
		ahead := model.GetMillis() + 60000
		_, err = s.GetMaster().Exec("UPDATE PropertyFields SET UpdateAt = $1 WHERE ID = $2", ahead, field.ID)
		require.NoError(t, err)

		require.NoError(t, ss.PropertyField().MutateOptions(groupID, field.ID, ahead, nil, []*model.PropertyOptionEdge{
			edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
		}, nil))
		read, err = ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		require.Greater(t, read.UpdateAt, ahead)
	})

	t.Run("a change decided against a hierarchy that has since moved is refused", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)

		// Two writers reading the same field, each deciding on a link that is fine
		// against what it read and that together with the other's puts an option
		// below itself. The first lands; the second is checking a hierarchy that no
		// longer exists, and gets a conflict rather than writing the cycle.
		stale := field.UpdateAt
		require.NoError(t, ss.PropertyField().MutateOptions(groupID, field.ID, stale, nil, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
		}, nil))

		err := ss.PropertyField().MutateOptions(groupID, field.ID, stale, nil, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Air Program"], ids["Fighter Jet Program"]),
		}, nil)
		require.Error(t, err)
		var conflictErr *store.ErrConflict
		require.ErrorAs(t, err, &conflictErr)

		read, err := ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Equal(t, [][2]string{{ids["Fighter Jet Program"], ids["Air Program"]}}, asPairs(read))
	})

	t.Run("every edge in a change belongs to the field being changed", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)
		otherIDs := programIDs()
		other := newField(t, model.PropertyFieldTypeGraph, otherIDs)

		// A change is applied to one field, because it is written under that field's
		// UpdateAt: an edge belonging to another field is refused rather than
		// written outside the check that serializes the change.
		err := mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
			edge(other.ID, otherIDs["F-18 Program"], otherIDs["Air Program"]),
		}, nil)
		require.Error(t, err)
		var invalidErr *store.ErrInvalidInput
		require.ErrorAs(t, err, &invalidErr)

		for _, fieldID := range []string{field.ID, other.ID} {
			read, rErr := ss.PropertyField().GetOptionEdges(fieldID)
			require.NoError(t, rErr)
			require.Empty(t, read)
		}
	})

	t.Run("only a graph field's options have a hierarchy", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeMultiselect, ids)

		err := mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["F-18 Program"], ids["Air Program"]),
		}, nil)
		require.Error(t, err)
		var invalidErr *store.ErrInvalidInput
		require.ErrorAs(t, err, &invalidErr)

		// A field that does not exist is a different failure, and neither is a
		// silent no-op.
		missingID := model.NewId()
		err = ss.PropertyField().MutateOptions(groupID, missingID, 0, nil, []*model.PropertyOptionEdge{
			edge(missingID, ids["F-18 Program"], ids["Air Program"]),
		}, nil)
		require.Error(t, err)
		var notFoundErr *store.ErrNotFound
		require.ErrorAs(t, err, &notFoundErr)
	})

	t.Run("an option cannot be its own parent", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)

		err := mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Air Program"], ids["Air Program"]),
		}, nil)
		require.Error(t, err)
		var invalidErr *store.ErrInvalidInput
		require.ErrorAs(t, err, &invalidErr)
	})

	t.Run("deleting an option deletes the edges it appears in", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)

		require.NoError(t, mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
			edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
		}, nil))

		// Dropping the middle option from the field's option list soft-deletes it.
		// It is a child in one edge and a parent in the other, and both go: an
		// edge has no delete marker of its own, so a link to an option that is
		// gone would otherwise still be walked.
		field.Attrs["options"] = []any{
			map[string]any{"id": ids["Air Program"], "name": "Air Program"},
			map[string]any{"id": ids["F-18 Program"], "name": "F-18 Program"},
		}
		_, err := ss.PropertyField().Update(groupID, []*model.PropertyField{field}, nil)
		require.NoError(t, err)

		read, err := ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Empty(t, read, "both edges touched the deleted option")
	})

	t.Run("edges are scoped to their field even when option IDs collide", func(t *testing.T) {
		// Option IDs are unique within a field, not across fields -- unlinking a
		// field from its template deliberately produces two fields whose options
		// share identifiers. A query that read the edges of one field into the
		// other would report a hierarchy that field does not have.
		shared := programIDs()
		withEdges := newField(t, model.PropertyFieldTypeGraph, shared)
		withoutEdges := newField(t, model.PropertyFieldTypeGraph, shared)

		require.NoError(t, mutate(t, withEdges, []*model.PropertyOptionEdge{
			edge(withEdges.ID, shared["Fighter Jet Program"], shared["Air Program"]),
		}, nil))

		read, err := ss.PropertyField().GetOptionEdges(withoutEdges.ID)
		require.NoError(t, err)
		require.Empty(t, read, "an identically-identified option in another field must not bring that field's edges")

		children, err := ss.PropertyField().GetOptionChildEdges(withoutEdges.ID, []string{shared["Air Program"]})
		require.NoError(t, err)
		require.Empty(t, children)

		children, err = ss.PropertyField().GetOptionChildEdges(withEdges.ID, []string{shared["Air Program"]})
		require.NoError(t, err)
		require.Len(t, children, 1)

		// Removing links is scoped the same way, and with more than one removal in
		// the change: the field is one condition and the pairs of options are
		// another, so a change asking for two of them must not reach past its field
		// to a link between options carrying the same two identifiers.
		require.NoError(t, mutate(t, withoutEdges, []*model.PropertyOptionEdge{
			edge(withoutEdges.ID, shared["Fighter Jet Program"], shared["Air Program"]),
			edge(withoutEdges.ID, shared["F-18 Program"], shared["Air Program"]),
		}, nil))
		require.NoError(t, mutate(t, withoutEdges, nil, []*model.PropertyOptionEdge{
			edge(withoutEdges.ID, shared["Fighter Jet Program"], shared["Air Program"]),
			edge(withoutEdges.ID, shared["F-18 Program"], shared["Air Program"]),
		}))

		read, err = ss.PropertyField().GetOptionEdges(withoutEdges.ID)
		require.NoError(t, err)
		require.Empty(t, read)

		read, err = ss.PropertyField().GetOptionEdges(withEdges.ID)
		require.NoError(t, err)
		require.Len(t, read, 1, "the other field's identically-identified link is untouched")
	})

	t.Run("child edges report which options are not leaves", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)

		require.NoError(t, mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
			edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
		}, nil))

		// The lowest option has nothing below it.
		children, err := ss.PropertyField().GetOptionChildEdges(field.ID, []string{ids["F-18 Program"]})
		require.NoError(t, err)
		require.Empty(t, children)

		// Asked about the whole chain, every child it reports is inside the set
		// itself -- which is how removing a subtree in one call is checked.
		children, err = ss.PropertyField().GetOptionChildEdges(field.ID, []string{
			ids["Air Program"], ids["Fighter Jet Program"], ids["F-18 Program"],
		})
		require.NoError(t, err)
		require.ElementsMatch(t, [][2]string{
			{ids["Fighter Jet Program"], ids["Air Program"]},
			{ids["F-18 Program"], ids["Fighter Jet Program"]},
		}, asPairs(children))

		// Asked about the top alone, the child it reports is outside the set, so
		// the option is not a leaf and cannot go on its own.
		children, err = ss.PropertyField().GetOptionChildEdges(field.ID, []string{ids["Air Program"]})
		require.NoError(t, err)
		require.Equal(t, [][2]string{{ids["Fighter Jet Program"], ids["Air Program"]}}, asPairs(children))
	})

	t.Run("parent edges and the edge total report what a change would become", func(t *testing.T) {
		ids := programIDs()
		field := newField(t, model.PropertyFieldTypeGraph, ids)
		otherIDs := programIDs()
		other := newField(t, model.PropertyFieldTypeGraph, otherIDs)

		require.NoError(t, mutate(t, field, []*model.PropertyOptionEdge{
			edge(field.ID, ids["Fighter Jet Program"], ids["Air Program"]),
			edge(field.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
			edge(field.ID, ids["F-18 Program"], ids["Air Program"]),
		}, nil))
		require.NoError(t, mutate(t, other, []*model.PropertyOptionEdge{
			edge(other.ID, otherIDs["F-18 Program"], otherIDs["Air Program"]),
		}, nil))

		// Asked about several options at once, because the caller is checking a
		// whole change: what each option it names sits below, and nothing else.
		parents, err := ss.PropertyField().GetOptionParentEdges(field.ID, []string{
			ids["F-18 Program"], ids["Air Program"],
		})
		require.NoError(t, err)
		require.ElementsMatch(t, [][2]string{
			{ids["F-18 Program"], ids["Fighter Jet Program"]},
			{ids["F-18 Program"], ids["Air Program"]},
		}, asPairs(parents), "the top option has no parents, and the other field's edges are not this field's")

		count, err := ss.PropertyField().CountOptionEdges(field.ID)
		require.NoError(t, err)
		require.Equal(t, 3, count)

		count, err = ss.PropertyField().CountOptionEdges(other.ID)
		require.NoError(t, err)
		require.Equal(t, 1, count, "an identically-identified option in another field brings none of that field's edges")
	})

	t.Run("unlinking a graph field keeps the hierarchy it was deriving", func(t *testing.T) {
		ids := programIDs()
		template := newField(t, model.PropertyFieldTypeGraph, ids)
		templateOptions := template.Attrs["options"].([]any)

		require.NoError(t, mutate(t, template, []*model.PropertyOptionEdge{
			edge(template.ID, ids["Fighter Jet Program"], ids["Air Program"]),
			edge(template.ID, ids["F-18 Program"], ids["Fighter Jet Program"]),
		}, nil))

		linked, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:       groupID,
			Name:          "EdgesLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeGraph,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Attrs:         model.StringInterface{"options": templateOptions},
		})
		require.NoError(t, err)

		// While it links, the field owns neither the options nor the edges: it
		// derives both from the template.
		edges, err := ss.PropertyField().GetOptionEdges(linked.ID)
		require.NoError(t, err)
		require.Empty(t, edges)

		linked.LinkedFieldID = nil
		_, err = ss.PropertyField().Update(groupID, []*model.PropertyField{linked}, nil)
		require.NoError(t, err)

		// Now it owns both, under the same option identifiers -- without the
		// edges it would keep every option and lose every relationship between
		// them, which reads as a flat list of options that cover nothing but
		// themselves.
		edges, err = ss.PropertyField().GetOptionEdges(linked.ID)
		require.NoError(t, err)
		require.ElementsMatch(t, [][2]string{
			{ids["Fighter Jet Program"], ids["Air Program"]},
			{ids["F-18 Program"], ids["Fighter Jet Program"]},
		}, asPairs(edges))

		var count int
		require.NoError(t, s.GetMaster().Get(&count,
			"SELECT COUNT(*) FROM PropertyOptionEdges WHERE FieldID = $1", template.ID))
		require.Equal(t, 2, count, "the template keeps its own edges")

		// A field of a type with no hierarchy unlinks with no edges to copy.
		selectTemplate := newField(t, model.PropertyFieldTypeSelect, map[string]string{"Only": model.NewId()})
		selectLinked, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:       groupID,
			Name:          "EdgesSelectLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &selectTemplate.ID,
			Attrs:         model.StringInterface{"options": selectTemplate.Attrs["options"]},
		})
		require.NoError(t, err)

		selectLinked.LinkedFieldID = nil
		_, err = ss.PropertyField().Update(groupID, []*model.PropertyField{selectLinked}, nil)
		require.NoError(t, err)

		edges, err = ss.PropertyField().GetOptionEdges(selectLinked.ID)
		require.NoError(t, err)
		require.Empty(t, edges)
	})

	t.Run("a field write applies the parents its option list states", func(t *testing.T) {
		ids := programIDs()
		options := []any{
			// Named before the option it sits under appears, which a list building a
			// hierarchy in one write has to allow.
			map[string]any{"id": ids["Fighter Jet Program"], "name": "Fighter Jet Program", "parents": []string{"Air Program"}},
			map[string]any{"id": ids["Air Program"], "name": "Air Program"},
			map[string]any{"id": ids["F-18 Program"], "name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
		}
		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "EdgesFromList-" + model.NewId(),
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": options},
		})
		require.NoError(t, err)

		// The links landed in the same write as the options they join, so an option
		// never existed without them.
		stored, err := ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.ElementsMatch(t, [][2]string{
			{ids["Fighter Jet Program"], ids["Air Program"]},
			{ids["F-18 Program"], ids["Fighter Jet Program"]},
		}, asPairs(stored))

		// The parents are not an attribute of the option: they became rows, and the
		// option reads back exactly as one written without them would.
		read, err := ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		for _, raw := range read.Attrs["options"].([]any) {
			require.NotContains(t, raw.(map[string]any), "parents")
		}

		// A list stating a parent set replaces that option's set and leaves every
		// other option's alone.
		read.Attrs["options"] = []any{
			map[string]any{"id": ids["Air Program"], "name": "Air Program"},
			map[string]any{"id": ids["Fighter Jet Program"], "name": "Fighter Jet Program"},
			map[string]any{"id": ids["F-18 Program"], "name": "F-18 Program", "parents": []string{"Air Program"}},
		}
		_, err = ss.PropertyField().Update(groupID, []*model.PropertyField{read}, nil)
		require.NoError(t, err)

		stored, err = ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.ElementsMatch(t, [][2]string{
			{ids["Fighter Jet Program"], ids["Air Program"]},
			{ids["F-18 Program"], ids["Air Program"]},
		}, asPairs(stored))

		// A list that says nothing about parents leaves the hierarchy as it is, which
		// is what a read-modify-write of a field looks like: an option reads back
		// without its parents.
		read, err = ss.PropertyField().Get(rctx, groupID, field.ID)
		require.NoError(t, err)
		read.Name = "EdgesFromListRenamed-" + model.NewId()
		_, err = ss.PropertyField().Update(groupID, []*model.PropertyField{read}, nil)
		require.NoError(t, err)

		stored, err = ss.PropertyField().GetOptionEdges(field.ID)
		require.NoError(t, err)
		require.Len(t, stored, 2, "a write that states no parents must not flatten the hierarchy")
	})

	t.Run("an option list can only state parents on a field that owns a hierarchy", func(t *testing.T) {
		// The service refuses both of these first, with a message naming the option
		// at fault. They are refused here as well because the field as the store has
		// it is the only place its real type and its link are known -- a field created
		// by linking to a graph template arrives with neither in the request.
		selectID := model.NewId()
		_, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "EdgesFromListSelect-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{"options": []any{
				map[string]any{"id": selectID, "name": "Only"},
				map[string]any{"id": model.NewId(), "name": "Below", "parents": []string{"Only"}},
			}},
		})
		require.Error(t, err)
		require.ErrorContains(t, err, "form no hierarchy")

		// A field linking to a graph template owns none of the hierarchy it serves,
		// so an option of the template's is not one it may link to anything.
		ids := programIDs()
		template := newField(t, model.PropertyFieldTypeGraph, ids)
		_, err = ss.PropertyField().Create(&model.PropertyField{
			GroupID:       groupID,
			Name:          "EdgesFromListLinked-" + model.NewId(),
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Type:          model.PropertyFieldTypeGraph,
			LinkedFieldID: &template.ID,
			Attrs: model.StringInterface{"options": []any{
				map[string]any{"id": ids["Air Program"], "name": "Air Program"},
				map[string]any{"id": ids["F-18 Program"], "name": "F-18 Program", "parents": []string{"Air Program"}},
			}},
		})
		require.Error(t, err)
		require.ErrorContains(t, err, "no live option")

		edges, err := ss.PropertyField().GetOptionEdges(template.ID)
		require.NoError(t, err)
		require.Empty(t, edges, "a refused write leaves the template's hierarchy alone")
	})
}

func testPropertyFieldOptionHierarchy(t *testing.T, _ request.CTX, ss store.Store) {
	groupID := model.NewId()

	// newGraphField creates a graph field owning one option per name, under the
	// identifiers the caller supplies: two fields may hold options under the same
	// identifiers, since an option is named by its field and its ID together.
	newGraphField := func(t *testing.T, optionIDsByName map[string]string) *model.PropertyField {
		t.Helper()
		options := make([]any, 0, len(optionIDsByName))
		for name, id := range optionIDsByName {
			options = append(options, map[string]any{"id": id, "name": name})
		}
		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "Hierarchy-" + model.NewId(),
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": options},
		})
		require.NoError(t, err)
		return field
	}

	link := func(t *testing.T, field *model.PropertyField, ids map[string]string, pairs ...[2]string) {
		t.Helper()
		edges := make([]*model.PropertyOptionEdge, 0, len(pairs))
		for _, pair := range pairs {
			edges = append(edges, &model.PropertyOptionEdge{
				FieldID:        field.ID,
				ChildOptionID:  ids[pair[0]],
				ParentOptionID: ids[pair[1]],
			})
		}
		require.NoError(t, ss.PropertyField().MutateOptions(groupID, field.ID, field.UpdateAt, nil, edges, nil))
	}

	// named turns a walk's result back into option names, so a failure reads as
	// the hierarchy the test wrote rather than as two lists of identifiers.
	named := func(ids map[string]string, reached []string) []string {
		byID := make(map[string]string, len(ids))
		for name, id := range ids {
			byID[id] = name
		}
		out := make([]string, 0, len(reached))
		for _, id := range reached {
			out = append(out, byID[id])
		}
		return out
	}

	t.Run("a walk reports every option above and below each of its seeds", func(t *testing.T) {
		// A ─┬─ B ── C
		//    └─ D
		ids := map[string]string{"A": model.NewId(), "B": model.NewId(), "C": model.NewId(), "D": model.NewId()}
		field := newGraphField(t, ids)
		link(t, field, ids, [2]string{"B", "A"}, [2]string{"C", "B"}, [2]string{"D", "A"})

		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(field, []string{ids["C"], ids["D"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"C", "B", "A"}, named(ids, above[ids["C"]]))
		require.ElementsMatch(t, []string{"D", "A"}, named(ids, above[ids["D"]]))
		require.Len(t, above, 2, "only the options asked about are keys")

		below, err := ss.PropertyField().GetOptionDescendantsOrSelf(field, []string{ids["A"], ids["B"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"A", "B", "C", "D"}, named(ids, below[ids["A"]]))
		require.ElementsMatch(t, []string{"B", "C"}, named(ids, below[ids["B"]]))

		// A root reaches only itself upwards, and a leaf only itself downwards:
		// the relation is reflexive, so neither is absent from the result.
		above, err = ss.PropertyField().GetOptionAncestorsOrSelf(field, []string{ids["A"]})
		require.NoError(t, err)
		require.Equal(t, []string{"A"}, named(ids, above[ids["A"]]))

		below, err = ss.PropertyField().GetOptionDescendantsOrSelf(field, []string{ids["C"]})
		require.NoError(t, err)
		require.Equal(t, []string{"C"}, named(ids, below[ids["C"]]))

		children, err := ss.PropertyField().GetOptionChildren(field, []string{ids["A"], ids["C"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"B", "D"}, named(ids, children[ids["A"]]))
		require.NotContains(t, children, ids["C"], "an option with nothing below it is absent")
	})

	t.Run("an option reached by several routes is reported once", func(t *testing.T) {
		// Two roots over one option, which is the shape an overlay dimension
		// produces: F-18 is both a program and a clearance level.
		ids := map[string]string{"Air": model.NewId(), "Secret": model.NewId(), "F-18": model.NewId()}
		field := newGraphField(t, ids)
		link(t, field, ids, [2]string{"F-18", "Air"}, [2]string{"F-18", "Secret"})

		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(field, []string{ids["F-18"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18", "Air", "Secret"}, named(ids, above[ids["F-18"]]))

		below, err := ss.PropertyField().GetOptionDescendantsOrSelf(field, []string{ids["Air"], ids["Secret"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"Air", "F-18"}, named(ids, below[ids["Air"]]))
		require.ElementsMatch(t, []string{"Secret", "F-18"}, named(ids, below[ids["Secret"]]))
	})

	t.Run("a walk over a grid returns options, not routes to them", func(t *testing.T) {
		// An 11x11 grid: every option below the top row and right of the first
		// column has two parents, which is what representing a second dimension as
		// extra parents produces. Everything above the far corner is 121 options,
		// reachable along 705,431 distinct routes -- so a walk that enumerated
		// routes rather than options would return five thousand times as many rows
		// here, and worse on anything larger.
		const side = 11
		ids := map[string]string{}
		for row := range side {
			for column := range side {
				ids[fmt.Sprintf("%d-%d", row, column)] = model.NewId()
			}
		}
		field := newGraphField(t, ids)

		var pairs [][2]string
		for row := range side {
			for column := range side {
				if row > 0 {
					pairs = append(pairs, [2]string{fmt.Sprintf("%d-%d", row, column), fmt.Sprintf("%d-%d", row-1, column)})
				}
				if column > 0 {
					pairs = append(pairs, [2]string{fmt.Sprintf("%d-%d", row, column), fmt.Sprintf("%d-%d", row, column-1)})
				}
			}
		}
		require.Len(t, pairs, 2*side*(side-1))
		link(t, field, ids, pairs...)

		corner := ids[fmt.Sprintf("%d-%d", side-1, side-1)]
		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(field, []string{corner})
		require.NoError(t, err)
		require.Len(t, above[corner], side*side)

		// And seeding the walk with a whole row costs one query and one row per
		// option reached from each seed, which is what makes the interface take a
		// set: the middle option of the row reaches its own quarter of the grid.
		var lastRow []string
		for column := range side {
			lastRow = append(lastRow, ids[fmt.Sprintf("%d-%d", side-1, column)])
		}
		above, err = ss.PropertyField().GetOptionAncestorsOrSelf(field, lastRow)
		require.NoError(t, err)
		require.Len(t, above, side)
		require.Len(t, above[ids[fmt.Sprintf("%d-%d", side-1, 5)]], side*6)
	})

	t.Run("a deleted option is not a seed, and nothing reaches one", func(t *testing.T) {
		ids := map[string]string{"Air": model.NewId(), "Fighter Jet": model.NewId(), "F-18": model.NewId()}
		field := newGraphField(t, ids)
		link(t, field, ids, [2]string{"Fighter Jet", "Air"}, [2]string{"F-18", "Fighter Jet"})

		// Dropping the middle option from the option list soft-deletes it, which
		// deletes both of its edges: the two options left are unrelated.
		field.Attrs["options"] = []any{
			map[string]any{"id": ids["Air"], "name": "Air"},
			map[string]any{"id": ids["F-18"], "name": "F-18"},
		}
		_, err := ss.PropertyField().Update(groupID, []*model.PropertyField{field}, nil)
		require.NoError(t, err)

		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(field, []string{ids["F-18"], ids["Fighter Jet"]})
		require.NoError(t, err)
		require.Equal(t, []string{"F-18"}, named(ids, above[ids["F-18"]]))
		require.NotContains(t, above, ids["Fighter Jet"], "a deleted option is absent, not present and alone")
	})

	t.Run("an option the field does not have reaches nothing", func(t *testing.T) {
		ids := map[string]string{"Air": model.NewId()}
		field := newGraphField(t, ids)

		absent := model.NewId()
		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(field, []string{ids["Air"], absent})
		require.NoError(t, err)
		require.Contains(t, above, ids["Air"])
		require.NotContains(t, above, absent)

		below, err := ss.PropertyField().GetOptionDescendantsOrSelf(field, []string{absent})
		require.NoError(t, err)
		require.Empty(t, below)
	})

	t.Run("a walk stays inside its field when two fields use the same option IDs", func(t *testing.T) {
		// Unlinking a field from its template deliberately leaves two fields whose
		// options carry the same identifiers. A walk that read one field's edges
		// while resolving the other would report a hierarchy the field has not got.
		shared := map[string]string{"Air": model.NewId(), "Fighter Jet": model.NewId()}
		withEdges := newGraphField(t, shared)
		withoutEdges := newGraphField(t, shared)
		link(t, withEdges, shared, [2]string{"Fighter Jet", "Air"})

		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(withoutEdges, []string{shared["Fighter Jet"]})
		require.NoError(t, err)
		require.Equal(t, []string{"Fighter Jet"}, named(shared, above[shared["Fighter Jet"]]))

		children, err := ss.PropertyField().GetOptionChildren(withoutEdges, []string{shared["Air"]})
		require.NoError(t, err)
		require.Empty(t, children)

		above, err = ss.PropertyField().GetOptionAncestorsOrSelf(withEdges, []string{shared["Fighter Jet"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"Fighter Jet", "Air"}, named(shared, above[shared["Fighter Jet"]]))
	})

	t.Run("a linked field resolves the hierarchy of the template it derives", func(t *testing.T) {
		// The load-bearing case for the driving use case: the graph is on a
		// template and the fields users and channels carry are linked to it. A
		// linked field owns no options and no edges, so a walk scoped to its own ID
		// would find nothing above anything and answer every coverage question
		// with "no" -- denying access with nothing to show for it.
		ids := map[string]string{"Air": model.NewId(), "Fighter Jet": model.NewId(), "F-18": model.NewId()}
		template := newGraphField(t, ids)
		link(t, template, ids, [2]string{"Fighter Jet", "Air"}, [2]string{"F-18", "Fighter Jet"})

		linked, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:       groupID,
			Name:          "HierarchyLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeGraph,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Attrs:         model.StringInterface{"options": template.Attrs["options"]},
		})
		require.NoError(t, err)
		require.Empty(t, mustGetOptionEdges(t, ss, linked.ID), "a linked field owns no edges of its own")

		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(linked, []string{ids["F-18"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18", "Fighter Jet", "Air"}, named(ids, above[ids["F-18"]]))

		children, err := ss.PropertyField().GetOptionChildren(linked, []string{ids["Air"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"Fighter Jet"}, named(ids, children[ids["Air"]]))

		// And once it stops linking it resolves its own copy, which the unlink
		// takeover has by then given it.
		linked.LinkedFieldID = nil
		_, err = ss.PropertyField().Update(groupID, []*model.PropertyField{linked}, nil)
		require.NoError(t, err)

		above, err = ss.PropertyField().GetOptionAncestorsOrSelf(linked, []string{ids["F-18"]})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18", "Fighter Jet", "Air"}, named(ids, above[ids["F-18"]]))
	})

	t.Run("more options than one statement can carry parameters for", func(t *testing.T) {
		// Postgres accepts 65,535 bind parameters per statement and refuses the
		// statement outright past that, while a field may hold far more options
		// than that -- so both queries batch their identifiers. The made-up
		// identifiers need not exist for this: what is being checked is that a
		// caller holding more options than one statement can name gets an answer
		// rather than an error.
		ids := map[string]string{"Air": model.NewId(), "Fighter Jet": model.NewId()}
		field := newGraphField(t, ids)
		link(t, field, ids, [2]string{"Fighter Jet", "Air"})

		asked := []string{ids["Fighter Jet"], ids["Air"]}
		for len(asked) <= 70000 {
			asked = append(asked, model.NewId())
		}

		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(field, asked)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"Fighter Jet", "Air"}, named(ids, above[ids["Fighter Jet"]]))
		require.Len(t, above, 2, "the options that do not exist reach nothing")

		children, err := ss.PropertyField().GetOptionChildren(field, asked)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"Fighter Jet"}, named(ids, children[ids["Air"]]))
		require.Len(t, children, 1)
	})

	t.Run("no seeds is no walk", func(t *testing.T) {
		field := newGraphField(t, map[string]string{"Air": model.NewId()})

		above, err := ss.PropertyField().GetOptionAncestorsOrSelf(field, nil)
		require.NoError(t, err)
		require.Empty(t, above)

		children, err := ss.PropertyField().GetOptionChildren(field, nil)
		require.NoError(t, err)
		require.Empty(t, children)
	})
}

func mustGetOptionEdges(t *testing.T, ss store.Store, fieldID string) []*model.PropertyOptionEdge {
	t.Helper()
	edges, err := ss.PropertyField().GetOptionEdges(fieldID)
	require.NoError(t, err)
	return edges
}
