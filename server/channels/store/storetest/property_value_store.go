// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func TestPropertyValueStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("CreatePropertyValue", func(t *testing.T) { testCreatePropertyValue(t, rctx, ss) })
	t.Run("CreatePropertyValueWithArray", func(t *testing.T) { testCreatePropertyValueWithArray(t, rctx, ss) })
	t.Run("GetPropertyValue", func(t *testing.T) { testGetPropertyValue(t, rctx, ss) })
	t.Run("GetManyPropertyValues", func(t *testing.T) { testGetManyPropertyValues(t, rctx, ss) })
	t.Run("UpdatePropertyValue", func(t *testing.T) { testUpdatePropertyValue(t, rctx, ss) })
	t.Run("UpsertPropertyValue", func(t *testing.T) { testUpsertPropertyValue(t, rctx, ss) })
	t.Run("DeletePropertyValue", func(t *testing.T) { testDeletePropertyValue(t, rctx, ss) })
	t.Run("SearchPropertyValues", func(t *testing.T) { testSearchPropertyValues(t, rctx, ss) })
	t.Run("DeleteForField", func(t *testing.T) { testDeleteForField(t, rctx, ss) })
	t.Run("DeleteForTarget", func(t *testing.T) { testDeleteForTarget(t, rctx, ss) })
}

func testCreatePropertyValue(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail if the property value already has an ID set", func(t *testing.T) {
		newValue := &model.PropertyValue{ID: "sampleid"}
		value, err := ss.PropertyValue().Create(newValue)
		require.Zero(t, value)
		var eii *store.ErrInvalidInput
		require.ErrorAs(t, err, &eii)
	})

	t.Run("should fail if the property value is not valid", func(t *testing.T) {
		newValue := &model.PropertyValue{TargetID: ""}
		value, err := ss.PropertyValue().Create(newValue)
		require.Zero(t, value)
		require.ErrorContains(t, err, "model.property_value.is_valid.app_error")

		newValue = &model.PropertyValue{TargetID: model.NewId(), TargetType: ""}
		value, err = ss.PropertyValue().Create(newValue)
		require.Zero(t, value)
		require.ErrorContains(t, err, "model.property_value.is_valid.app_error")
	})

	newValue := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    model.NewId(),
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"test value"`),
	}

	t.Run("should be able to create a property value", func(t *testing.T) {
		value, err := ss.PropertyValue().Create(newValue)
		require.NoError(t, err)
		require.NotZero(t, value.ID)
		require.NotZero(t, value.CreateAt)
		require.NotZero(t, value.UpdateAt)
		require.Zero(t, value.DeleteAt)
	})

	t.Run("should enforce the value's uniqueness", func(t *testing.T) {
		newValue.ID = ""
		value, err := ss.PropertyValue().Create(newValue)
		require.Error(t, err)
		require.Zero(t, value)
	})
}

func testGetPropertyValue(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting value", func(t *testing.T) {
		value, err := ss.PropertyValue().Get("", model.NewId())
		require.Zero(t, value)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	groupID := model.NewId()
	newValue := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    groupID,
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"test value"`),
	}
	_, err := ss.PropertyValue().Create(newValue)
	require.NoError(t, err)
	require.NotZero(t, newValue.ID)

	t.Run("should be able to retrieve an existing property value", func(t *testing.T) {
		value, err := ss.PropertyValue().Get(groupID, newValue.ID)
		require.NoError(t, err)
		require.Equal(t, newValue.ID, value.ID)
		require.Equal(t, newValue.Value, value.Value)

		// should work without specifying the group ID as well
		value, err = ss.PropertyValue().Get("", newValue.ID)
		require.NoError(t, err)
		require.Equal(t, newValue.ID, value.ID)
		require.Equal(t, newValue.Value, value.Value)
	})

	t.Run("should not be able to retrieve an existing value when specifying a different group ID", func(t *testing.T) {
		value, err := ss.PropertyValue().Get(model.NewId(), newValue.ID)
		require.Zero(t, value)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	t.Run("should be able to retrieve an existing property value with matching groupID", func(t *testing.T) {
		groupID := model.NewId()
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"test value with group"`),
		}
		_, err := ss.PropertyValue().Create(newValue)
		require.NoError(t, err)
		require.NotZero(t, newValue.ID)

		value, err := ss.PropertyValue().Get(groupID, newValue.ID)
		require.NoError(t, err)
		require.Equal(t, newValue.ID, value.ID)
		require.Equal(t, newValue.Value, value.Value)
	})

	t.Run("should fail when retrieving a value with non-matching groupID", func(t *testing.T) {
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"test value with specific group"`),
		}
		_, err := ss.PropertyValue().Create(newValue)
		require.NoError(t, err)
		require.NotZero(t, newValue.ID)

		// Try to get the value with a different group ID
		value, err := ss.PropertyValue().Get(model.NewId(), newValue.ID)
		require.Zero(t, value)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})
}

func testGetManyPropertyValues(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting values", func(t *testing.T) {
		values, err := ss.PropertyValue().GetMany("", []string{model.NewId(), model.NewId()})
		require.Empty(t, values)
		require.ErrorContains(t, err, "missmatch results")
	})

	groupID := model.NewId()
	newValues := []*model.PropertyValue{}
	for i := 0; i < 3; i++ {
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(fmt.Sprintf(`"test value %d"`, i)),
		}
		_, err := ss.PropertyValue().Create(newValue)
		require.NoError(t, err)
		require.NotZero(t, newValue.ID)

		newValues = append(newValues, newValue)
	}

	newValueOutsideGroup := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    model.NewId(),
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value outside the groupID"`),
	}
	_, err := ss.PropertyValue().Create(newValueOutsideGroup)
	require.NoError(t, err)
	require.NotZero(t, newValueOutsideGroup.ID)

	t.Run("should fail if at least one of the ids is nonexistent", func(t *testing.T) {
		values, err := ss.PropertyValue().GetMany(groupID, []string{newValues[0].ID, newValues[1].ID, model.NewId()})
		require.Empty(t, values)
		require.ErrorContains(t, err, "missmatch results")
	})

	t.Run("should be able to retrieve existing property values", func(t *testing.T) {
		values, err := ss.PropertyValue().GetMany(groupID, []string{newValues[0].ID, newValues[1].ID, newValues[2].ID})
		require.NoError(t, err)
		require.Len(t, values, 3)
		require.ElementsMatch(t, newValues, values)
	})

	t.Run("should fail if asked for valid IDs but outside the group", func(t *testing.T) {
		values, err := ss.PropertyValue().GetMany(groupID, []string{newValues[0].ID, newValueOutsideGroup.ID})
		require.Empty(t, values)
		require.ErrorContains(t, err, "missmatch results")
	})

	t.Run("should be able to retrieve existing property values from multiple groups", func(t *testing.T) {
		fields, err := ss.PropertyValue().GetMany("", []string{newValues[0].ID, newValueOutsideGroup.ID})
		require.NoError(t, err)
		require.Len(t, fields, 2)
	})
}

func testUpdatePropertyValue(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting value", func(t *testing.T) {
		value := &model.PropertyValue{
			ID:         model.NewId(),
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"test value"`),
			CreateAt:   model.GetMillis(),
		}
		updatedValue, err := ss.PropertyValue().Update("", []*model.PropertyValue{value})
		require.Zero(t, updatedValue)
		require.ErrorContains(t, err, "failed to update, some property values were not found, got 0 of 1")
	})

	t.Run("should fail if the property value is not valid", func(t *testing.T) {
		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"test value"`),
		}
		_, err := ss.PropertyValue().Create(value)
		require.NoError(t, err)
		require.NotZero(t, value.ID)

		value.TargetID = ""
		updatedValue, err := ss.PropertyValue().Update("", []*model.PropertyValue{value})
		require.Zero(t, updatedValue)
		require.ErrorContains(t, err, "model.property_value.is_valid.app_error")

		value.TargetID = model.NewId()
		value.GroupID = ""
		updatedValue, err = ss.PropertyValue().Update("", []*model.PropertyValue{value})
		require.Zero(t, updatedValue)
		require.ErrorContains(t, err, "model.property_value.is_valid.app_error")
	})

	t.Run("should be able to update multiple property values", func(t *testing.T) {
		value1 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"value 1"`),
		}

		value2 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"value 2"`),
		}

		for _, value := range []*model.PropertyValue{value1, value2} {
			_, err := ss.PropertyValue().Create(value)
			require.NoError(t, err)
			require.NotZero(t, value.ID)
		}
		time.Sleep(10 * time.Millisecond)

		value1.Value = json.RawMessage(`"updated value 1"`)
		value2.Value = json.RawMessage(`"updated value 2"`)

		_, err := ss.PropertyValue().Update("", []*model.PropertyValue{value1, value2})
		require.NoError(t, err)

		// Verify first value
		updated1, err := ss.PropertyValue().Get("", value1.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"updated value 1"`), updated1.Value)
		require.Greater(t, updated1.UpdateAt, updated1.CreateAt)

		// Verify second value
		updated2, err := ss.PropertyValue().Get("", value2.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"updated value 2"`), updated2.Value)
		require.Greater(t, updated2.UpdateAt, updated2.CreateAt)
	})

	t.Run("should not update any values if one update is invalid", func(t *testing.T) {
		// Create two valid values
		groupID := model.NewId()
		value1 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"Value 1"`),
		}

		value2 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"Value 2"`),
		}

		for _, value := range []*model.PropertyValue{value1, value2} {
			_, err := ss.PropertyValue().Create(value)
			require.NoError(t, err)
		}

		originalUpdateAt1 := value1.UpdateAt
		originalUpdateAt2 := value2.UpdateAt

		// Try to update both value, but make one invalid
		value1.Value = json.RawMessage(`"Valid update"`)
		value2.GroupID = "Invalid ID"

		_, err := ss.PropertyValue().Update("", []*model.PropertyValue{value1, value2})
		require.Error(t, err)
		require.Contains(t, err.Error(), "model.property_value.is_valid.app_error")

		// Check that values were not updated
		updated1, err := ss.PropertyValue().Get("", value1.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"Value 1"`), updated1.Value)
		require.Equal(t, originalUpdateAt1, updated1.UpdateAt)

		updated2, err := ss.PropertyValue().Get("", value2.ID)
		require.NoError(t, err)
		require.Equal(t, groupID, updated2.GroupID)
		require.Equal(t, originalUpdateAt2, updated2.UpdateAt)
	})

	t.Run("should not update any values if one update points to a nonexisting one", func(t *testing.T) {
		// Create a valid value
		value1 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"Value 1"`),
		}

		_, err := ss.PropertyValue().Create(value1)
		require.NoError(t, err)

		originalUpdateAt := value1.UpdateAt

		// Try to update both the valid value and a nonexistent one
		value2 := &model.PropertyValue{
			ID:         model.NewId(),
			TargetID:   model.NewId(),
			CreateAt:   1,
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"Value 2"`),
		}

		value1.Value = json.RawMessage(`"Updated Value 1"`)

		_, err = ss.PropertyValue().Update("", []*model.PropertyValue{value1, value2})
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to update, some property values were not found")

		// Check that the valid value was not updated
		updated1, err := ss.PropertyValue().Get("", value1.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"Value 1"`), updated1.Value)
		require.Equal(t, originalUpdateAt, updated1.UpdateAt)
	})

	t.Run("should update values with matching groupID", func(t *testing.T) {
		// Create values with the same groupID
		groupID := model.NewId()
		value1 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"Group Value 1"`),
		}
		value2 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"Group Value 2"`),
		}

		for _, value := range []*model.PropertyValue{value1, value2} {
			_, err := ss.PropertyValue().Create(value)
			require.NoError(t, err)
		}

		// Update the values with the matching groupID
		value1.Value = json.RawMessage(`"Updated Group Value 1"`)
		value2.Value = json.RawMessage(`"Updated Group Value 2"`)

		updatedValues, err := ss.PropertyValue().Update(groupID, []*model.PropertyValue{value1, value2})
		require.NoError(t, err)
		require.Len(t, updatedValues, 2)

		// Verify the values were updated
		for _, value := range []*model.PropertyValue{value1, value2} {
			updated, err := ss.PropertyValue().Get("", value.ID)
			require.NoError(t, err)
			require.Contains(t, string(updated.Value), "Updated Group Value")
		}
	})

	t.Run("should not update values with non-matching groupID", func(t *testing.T) {
		// Create values with different groupIDs
		groupID1 := model.NewId()
		groupID2 := model.NewId()

		value1 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID1,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"Value in Group 1"`),
		}
		value2 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID2,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"Value in Group 2"`),
		}

		for _, value := range []*model.PropertyValue{value1, value2} {
			_, err := ss.PropertyValue().Create(value)
			require.NoError(t, err)
		}

		originalValue1 := string(value1.Value)
		originalValue2 := string(value2.Value)

		// Try to update both values but filter by groupID1
		value1.Value = json.RawMessage(`"Updated Value in Group 1"`)
		value2.Value = json.RawMessage(`"Updated Value in Group 2"`)

		_, err := ss.PropertyValue().Update(groupID1, []*model.PropertyValue{value1, value2})
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to update, some property values were not found")

		// Verify neither value was updated due to transaction rollback
		updated1, err := ss.PropertyValue().Get("", value1.ID)
		require.NoError(t, err)
		require.Equal(t, originalValue1, string(updated1.Value))

		updated2, err := ss.PropertyValue().Get("", value2.ID)
		require.NoError(t, err)
		require.Equal(t, originalValue2, string(updated2.Value))
	})
}

func testUpsertPropertyValue(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail if the property value is not valid", func(t *testing.T) {
		value := &model.PropertyValue{
			TargetID:   "",
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"test value"`),
		}
		updatedValue, err := ss.PropertyValue().Upsert([]*model.PropertyValue{value})
		require.Zero(t, updatedValue)
		require.ErrorContains(t, err, "model.property_value.is_valid.app_error")

		value.TargetID = model.NewId()
		value.GroupID = ""
		updatedValue, err = ss.PropertyValue().Upsert([]*model.PropertyValue{value})
		require.Zero(t, updatedValue)
		require.ErrorContains(t, err, "model.property_value.is_valid.app_error")
	})

	t.Run("should be able to insert new property values", func(t *testing.T) {
		value1 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"value 1"`),
		}

		value2 := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"value 2"`),
		}

		values, err := ss.PropertyValue().Upsert([]*model.PropertyValue{value1, value2})
		require.NoError(t, err)
		require.Len(t, values, 2)
		require.NotEmpty(t, values[0].ID)
		require.NotEmpty(t, values[1].ID)
		require.NotZero(t, values[0].CreateAt)
		require.NotZero(t, values[1].CreateAt)

		valuesFromStore, err := ss.PropertyValue().GetMany("", []string{values[0].ID, values[1].ID})
		require.NoError(t, err)
		require.Len(t, valuesFromStore, 2)
	})

	t.Run("should be able to update existing property values", func(t *testing.T) {
		// Create initial value
		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"initial value"`),
		}
		_, err := ss.PropertyValue().Create(value)
		require.NoError(t, err)
		valueID := value.ID

		time.Sleep(10 * time.Millisecond)

		// Update via upsert
		value.ID = ""
		value.Value = json.RawMessage(`"updated value"`)
		values, err := ss.PropertyValue().Upsert([]*model.PropertyValue{value})
		require.NoError(t, err)
		require.Len(t, values, 1)
		require.Equal(t, valueID, values[0].ID)
		require.Equal(t, json.RawMessage(`"updated value"`), values[0].Value)
		require.Greater(t, values[0].UpdateAt, values[0].CreateAt)

		// Verify in database
		updated, err := ss.PropertyValue().Get("", valueID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"updated value"`), updated.Value)
		require.Greater(t, updated.UpdateAt, updated.CreateAt)
	})

	t.Run("should handle mixed insert and update operations", func(t *testing.T) {
		// Create first value
		existingValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"existing value"`),
		}
		_, err := ss.PropertyValue().Create(existingValue)
		require.NoError(t, err)

		// Prepare new value
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"new value"`),
		}

		// Update existing and insert new via upsert
		existingValue.Value = json.RawMessage(`"updated existing"`)
		values, err := ss.PropertyValue().Upsert([]*model.PropertyValue{existingValue, newValue})
		require.NoError(t, err)
		require.Len(t, values, 2)

		// Verify both values
		newValueUpserted, err := ss.PropertyValue().Get("", newValue.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"new value"`), newValueUpserted.Value)
		existingValueUpserted, err := ss.PropertyValue().Get("", existingValue.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"updated existing"`), existingValueUpserted.Value)
	})

	t.Run("should not perform any operation if one of the fields is invalid", func(t *testing.T) {
		// Create initial valid value
		existingValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"existing value"`),
		}
		_, err := ss.PropertyValue().Create(existingValue)
		require.NoError(t, err)

		originalValue := *existingValue

		// Prepare an invalid value
		invalidValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    "", // Invalid: empty group ID
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"new value"`),
		}

		// Try to update existing and insert invalid via upsert
		existingValue.Value = json.RawMessage(`"should not update"`)
		_, err = ss.PropertyValue().Upsert([]*model.PropertyValue{existingValue, invalidValue})
		require.Error(t, err)
		require.Contains(t, err.Error(), "model.property_value.is_valid.app_error")

		// Verify the existing value was not changed
		retrieved, err := ss.PropertyValue().Get("", existingValue.ID)
		require.NoError(t, err)
		require.Equal(t, originalValue.Value, retrieved.Value)
		require.Equal(t, originalValue.UpdateAt, retrieved.UpdateAt)

		// Verify the invalid value was not inserted
		results, err := ss.PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
			TargetID: invalidValue.TargetID,
			PerPage:  10,
		})
		require.NoError(t, err)
		require.Empty(t, results)
	})
}

func testDeletePropertyValue(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting value", func(t *testing.T) {
		err := ss.PropertyValue().Delete("", model.NewId())
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
	})

	t.Run("should be able to delete an existing property value", func(t *testing.T) {
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"test value"`),
		}
		value, err := ss.PropertyValue().Create(newValue)
		require.NoError(t, err)
		require.NotEmpty(t, value.ID)

		err = ss.PropertyValue().Delete("", value.ID)
		require.NoError(t, err)

		// Verify the value was soft-deleted
		deletedValue, err := ss.PropertyValue().Get("", value.ID)
		require.NoError(t, err)
		require.NotZero(t, deletedValue.DeleteAt)
	})

	t.Run("should be able to create a new value with the same details as the deleted one", func(t *testing.T) {
		sameDetailsValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"test value"`),
		}
		value, err := ss.PropertyValue().Create(sameDetailsValue)
		require.NoError(t, err)
		require.NotEmpty(t, value.ID)
		require.Equal(t, sameDetailsValue.Value, value.Value)
	})

	t.Run("should be able to delete a value with matching groupID", func(t *testing.T) {
		groupID := model.NewId()
		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"value with specific group"`),
		}
		_, err := ss.PropertyValue().Create(value)
		require.NoError(t, err)
		require.NotZero(t, value.ID)

		// Delete with matching groupID
		err = ss.PropertyValue().Delete(groupID, value.ID)
		require.NoError(t, err)

		// Verify the value was soft-deleted
		deletedValue, err := ss.PropertyValue().Get(groupID, value.ID)
		require.NoError(t, err)
		require.NotZero(t, deletedValue.DeleteAt)
	})

	t.Run("should fail when deleting with non-matching groupID", func(t *testing.T) {
		groupID := model.NewId()
		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    groupID,
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"another value with specific group"`),
		}
		_, err := ss.PropertyValue().Create(value)
		require.NoError(t, err)
		require.NotZero(t, value.ID)

		// Try to delete with wrong groupID
		err = ss.PropertyValue().Delete(model.NewId(), value.ID)
		require.Error(t, err)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)

		// Verify the value was not deleted
		nonDeletedValue, err := ss.PropertyValue().Get(groupID, value.ID)
		require.NoError(t, err)
		require.Zero(t, nonDeletedValue.DeleteAt)
	})
}

func testSearchPropertyValues(t *testing.T, _ request.CTX, ss store.Store) {
	groupID := model.NewId()
	targetID := model.NewId()
	fieldID := model.NewId()

	// Define test property values
	value1 := &model.PropertyValue{
		GroupID:    groupID,
		TargetID:   targetID,
		TargetType: "test_type",
		FieldID:    fieldID,
		Value:      json.RawMessage(`"value 1"`),
	}

	value2 := &model.PropertyValue{
		GroupID:    groupID,
		TargetID:   targetID,
		TargetType: "other_type",
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value 2"`),
	}

	value3 := &model.PropertyValue{
		GroupID:    model.NewId(),
		TargetID:   model.NewId(),
		TargetType: "test_type",
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value 3"`),
	}

	value4 := &model.PropertyValue{
		GroupID:    groupID,
		TargetID:   model.NewId(),
		TargetType: "test_type",
		FieldID:    fieldID,
		Value:      json.RawMessage(`"value 4"`),
	}

	for _, value := range []*model.PropertyValue{value1, value2, value3, value4} {
		_, err := ss.PropertyValue().Create(value)
		require.NoError(t, err)
		time.Sleep(10 * time.Millisecond)
	}

	// Delete one value for deletion tests
	require.NoError(t, ss.PropertyValue().Delete("", value4.ID))

	tests := []struct {
		name          string
		opts          model.PropertyValueSearchOpts
		expectedError bool
		expectedIDs   []string
	}{
		{
			name: "negative per_page",
			opts: model.PropertyValueSearchOpts{
				PerPage: -1,
			},
			expectedError: true,
		},
		{
			name: "filter by group_id",
			opts: model.PropertyValueSearchOpts{
				GroupID: groupID,
				PerPage: 10,
			},
			expectedIDs: []string{value1.ID, value2.ID},
		},
		{
			name: "filter by group_id and target_type",
			opts: model.PropertyValueSearchOpts{
				GroupID:    groupID,
				TargetType: "test_type",
				PerPage:    10,
			},
			expectedIDs: []string{value1.ID},
		},
		{
			name: "filter by group_id and target_type including deleted",
			opts: model.PropertyValueSearchOpts{
				GroupID:        groupID,
				TargetType:     "test_type",
				IncludeDeleted: true,
				PerPage:        10,
			},
			expectedIDs: []string{value1.ID, value4.ID},
		},
		{
			name: "filter by target_id",
			opts: model.PropertyValueSearchOpts{
				TargetID: targetID,
				PerPage:  10,
			},
			expectedIDs: []string{value1.ID, value2.ID},
		},
		{
			name: "filter by group_id and target_id",
			opts: model.PropertyValueSearchOpts{
				GroupID:  groupID,
				TargetID: targetID,
				PerPage:  10,
			},
			expectedIDs: []string{value1.ID, value2.ID},
		},
		{
			name: "filter by field_id",
			opts: model.PropertyValueSearchOpts{
				FieldID: fieldID,
				PerPage: 10,
			},
			expectedIDs: []string{value1.ID},
		},
		{
			name: "filter by field_id including deleted",
			opts: model.PropertyValueSearchOpts{
				FieldID:        fieldID,
				IncludeDeleted: true,
				PerPage:        10,
			},
			expectedIDs: []string{value1.ID, value4.ID},
		},
		{
			name: "pagination page 0",
			opts: model.PropertyValueSearchOpts{
				GroupID: groupID,
				PerPage: 1,
			},
			expectedIDs: []string{value1.ID},
		},
		{
			name: "pagination page 1",
			opts: model.PropertyValueSearchOpts{
				GroupID: groupID,
				Cursor: model.PropertyValueSearchCursor{
					CreateAt:        value1.CreateAt,
					PropertyValueID: value1.ID,
				},
				PerPage: 1,
			},
			expectedIDs: []string{value2.ID},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			results, err := ss.PropertyValue().SearchPropertyValues(tc.opts)
			if tc.expectedError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			ids := make([]string, len(results))
			for i, value := range results {
				ids[i] = value.ID
			}
			require.ElementsMatch(t, tc.expectedIDs, ids)
		})
	}
}

func testCreatePropertyValueWithArray(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should create a property value with array", func(t *testing.T) {
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`["option1", "option2", "option3"]`),
		}

		value, err := ss.PropertyValue().Create(newValue)
		require.NoError(t, err)
		require.NotZero(t, value.ID)
		require.NotZero(t, value.CreateAt)
		require.NotZero(t, value.UpdateAt)
		require.Zero(t, value.DeleteAt)

		// Verify array values
		var arrayValues []string
		require.NoError(t, json.Unmarshal(value.Value, &arrayValues))
		require.Equal(t, []string{"option1", "option2", "option3"}, arrayValues)
	})

	t.Run("should update array values", func(t *testing.T) {
		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`["initial1", "initial2"]`),
		}

		created, err := ss.PropertyValue().Create(value)
		require.NoError(t, err)
		require.NotZero(t, created.ID)

		created.Value = json.RawMessage(`["updated1", "updated2", "updated3"]`)
		updated, err := ss.PropertyValue().Update("", []*model.PropertyValue{created})
		require.NoError(t, err)
		require.NotZero(t, updated)

		// Verify updated array values
		retrieved, err := ss.PropertyValue().Get("", created.ID)
		require.NoError(t, err)
		var arrayValues []string
		require.NoError(t, json.Unmarshal(retrieved.Value, &arrayValues))
		require.Equal(t, []string{"updated1", "updated2", "updated3"}, arrayValues)
	})
}

func testDeleteForField(t *testing.T, _ request.CTX, ss store.Store) {
	fieldID := model.NewId()
	groupID := model.NewId()

	// Create test values
	value1 := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    groupID,
		FieldID:    fieldID,
		Value:      json.RawMessage(`"value 1"`),
	}

	value2 := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    groupID,
		FieldID:    fieldID,
		Value:      json.RawMessage(`"value 2"`),
	}

	value3 := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    groupID,
		FieldID:    model.NewId(), // Different field ID
		Value:      json.RawMessage(`"value 3"`),
	}

	for _, value := range []*model.PropertyValue{value1, value2, value3} {
		_, err := ss.PropertyValue().Create(value)
		require.NoError(t, err)
	}

	// Delete values for the field
	err := ss.PropertyValue().DeleteForField(fieldID)
	require.NoError(t, err)

	// Verify values were soft-deleted
	deletedValues, err := ss.PropertyValue().GetMany(groupID, []string{value1.ID, value2.ID})
	require.NoError(t, err)
	require.Len(t, deletedValues, 2)
	require.NotZero(t, deletedValues[0].DeleteAt)
	require.NotZero(t, deletedValues[1].DeleteAt)

	// Verify value with different field ID was not deleted
	nonDeletedValue, err := ss.PropertyValue().Get(groupID, value3.ID)
	require.NoError(t, err)
	require.Zero(t, nonDeletedValue.DeleteAt)
}

func testDeleteForTarget(t *testing.T, _ request.CTX, ss store.Store) {
	groupID1 := model.NewId()
	groupID2 := model.NewId()
	groupID3 := model.NewId()
	targetID1 := model.NewId()
	targetID2 := model.NewId()
	targetType := "test_type"

	// Create test values for first group and first target
	value1 := &model.PropertyValue{
		TargetID:   targetID1,
		TargetType: targetType,
		GroupID:    groupID1,
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value 1"`),
	}

	value2 := &model.PropertyValue{
		TargetID:   targetID1,
		TargetType: targetType,
		GroupID:    groupID1,
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value 2"`),
	}

	// Create test value for second group but same target
	value3 := &model.PropertyValue{
		TargetID:   targetID1,
		TargetType: targetType,
		GroupID:    groupID2,
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value 3"`),
	}

	// Create test value for first group but different target
	value4 := &model.PropertyValue{
		TargetID:   targetID2,
		TargetType: targetType,
		GroupID:    groupID1,
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value 4"`),
	}

	// Create test value with different target type
	value5 := &model.PropertyValue{
		TargetID:   targetID1,
		TargetType: "other_type",
		GroupID:    groupID1,
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value 5"`),
	}

	// Create test value for third group and first target
	value6 := &model.PropertyValue{
		TargetID:   targetID1,
		TargetType: targetType,
		GroupID:    groupID3,
		FieldID:    model.NewId(),
		Value:      json.RawMessage(`"value 6"`),
	}

	for _, value := range []*model.PropertyValue{value1, value2, value3, value4, value5, value6} {
		_, err := ss.PropertyValue().Create(value)
		require.NoError(t, err)
	}

	t.Run("should return error if targetType or targetID is empty", func(t *testing.T) {
		err := ss.PropertyValue().DeleteForTarget(groupID1, "", targetID1)
		require.Error(t, err)
		var eii *store.ErrInvalidInput
		require.ErrorAs(t, err, &eii)

		err = ss.PropertyValue().DeleteForTarget(groupID1, targetType, "")
		require.Error(t, err)
		require.ErrorAs(t, err, &eii)

		// Verify values were not deleted
		values, err := ss.PropertyValue().GetMany("", []string{value1.ID, value2.ID})
		require.NoError(t, err)
		require.NotZero(t, values)
		require.Len(t, values, 2)
	})

	t.Run("should delete only property values for a target within the specified group", func(t *testing.T) {
		// Delete values for the first target in first group
		err := ss.PropertyValue().DeleteForTarget(groupID1, targetType, targetID1)
		require.NoError(t, err)

		// Verify values from first group and first target were hard-deleted
		deletedValues, err := ss.PropertyValue().GetMany("", []string{value1.ID, value2.ID})
		require.Error(t, err)
		require.Zero(t, deletedValues)

		// Verify value from second group was not deleted
		nonDeletedGroupValue, err := ss.PropertyValue().Get("", value3.ID)
		require.NoError(t, err)
		require.NotNil(t, nonDeletedGroupValue)

		// Verify value from first group but different target was not deleted
		nonDeletedTargetValue, err := ss.PropertyValue().Get("", value4.ID)
		require.NoError(t, err)
		require.NotNil(t, nonDeletedTargetValue)

		// Verify value with different target type was not deleted
		nonDeletedTypeValue, err := ss.PropertyValue().Get("", value5.ID)
		require.NoError(t, err)
		require.NotNil(t, nonDeletedTypeValue)
	})

	t.Run("should delete all values for a target regardless of group", func(t *testing.T) {
		err := ss.PropertyValue().DeleteForTarget("", targetType, targetID1)
		require.NoError(t, err)

		// Verify values from other groups with targetID1 were deleted
		deletedValues, err := ss.PropertyValue().GetMany("", []string{value3.ID, value6.ID})
		require.Error(t, err)
		require.Zero(t, deletedValues)

		// Verify value with different target ID was not deleted
		nonDeletedValue, err := ss.PropertyValue().Get("", value4.ID)
		require.NoError(t, err)
		require.NotNil(t, nonDeletedValue)

		// Verify value with different target type was not deleted
		nonDeletedTypeValue, err := ss.PropertyValue().Get("", value5.ID)
		require.NoError(t, err)
		require.NotNil(t, nonDeletedTypeValue)
	})
}
