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
	t.Run("DeletePropertyValue", func(t *testing.T) { testDeletePropertyValue(t, rctx, ss) })
	t.Run("SearchPropertyValues", func(t *testing.T) { testSearchPropertyValues(t, rctx, ss) })
	t.Run("DeleteForField", func(t *testing.T) { testDeleteForField(t, rctx, ss) })
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
		value, err := ss.PropertyValue().Get(model.NewId())
		require.Zero(t, value)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	t.Run("should be able to retrieve an existing property value", func(t *testing.T) {
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(`"test value"`),
		}
		_, err := ss.PropertyValue().Create(newValue)
		require.NoError(t, err)
		require.NotZero(t, newValue.ID)

		value, err := ss.PropertyValue().Get(newValue.ID)
		require.NoError(t, err)
		require.Equal(t, newValue.ID, value.ID)
		require.Equal(t, newValue.Value, value.Value)
	})
}

func testGetManyPropertyValues(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting values", func(t *testing.T) {
		values, err := ss.PropertyValue().GetMany([]string{model.NewId(), model.NewId()})
		require.Empty(t, values)
		require.ErrorContains(t, err, "missmatch results")
	})

	newValues := []*model.PropertyValue{}
	for i := 0; i < 3; i++ {
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "test_type",
			GroupID:    model.NewId(),
			FieldID:    model.NewId(),
			Value:      json.RawMessage(fmt.Sprintf(`"test value %d"`, i)),
		}
		_, err := ss.PropertyValue().Create(newValue)
		require.NoError(t, err)
		require.NotZero(t, newValue.ID)

		newValues = append(newValues, newValue)
	}

	t.Run("should fail if at least one of the ids is nonexistent", func(t *testing.T) {
		values, err := ss.PropertyValue().GetMany([]string{newValues[0].ID, newValues[1].ID, model.NewId()})
		require.Empty(t, values)
		require.ErrorContains(t, err, "missmatch results")
	})

	t.Run("should be able to retrieve existing property values", func(t *testing.T) {
		values, err := ss.PropertyValue().GetMany([]string{newValues[0].ID, newValues[1].ID, newValues[2].ID})
		require.NoError(t, err)
		require.Len(t, values, 3)
		require.ElementsMatch(t, newValues, values)
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
		updatedValue, err := ss.PropertyValue().Update([]*model.PropertyValue{value})
		require.Zero(t, updatedValue)
		var enf *store.ErrNotFound
		require.ErrorAs(t, err, &enf)
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
		updatedValue, err := ss.PropertyValue().Update([]*model.PropertyValue{value})
		require.Zero(t, updatedValue)
		require.ErrorContains(t, err, "model.property_value.is_valid.app_error")

		value.TargetID = model.NewId()
		value.GroupID = ""
		updatedValue, err = ss.PropertyValue().Update([]*model.PropertyValue{value})
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

		_, err := ss.PropertyValue().Update([]*model.PropertyValue{value1, value2})
		require.NoError(t, err)

		// Verify first value
		updated1, err := ss.PropertyValue().Get(value1.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"updated value 1"`), updated1.Value)
		require.Greater(t, updated1.UpdateAt, updated1.CreateAt)

		// Verify second value
		updated2, err := ss.PropertyValue().Get(value2.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"updated value 2"`), updated2.Value)
		require.Greater(t, updated2.UpdateAt, updated2.CreateAt)
	})

	t.Run("should not update any fields if one update is invalid", func(t *testing.T) {
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

		_, err := ss.PropertyValue().Update([]*model.PropertyValue{value1, value2})
		require.Error(t, err)
		require.Contains(t, err.Error(), "model.property_value.is_valid.app_error")

		// Check that values were not updated
		updated1, err := ss.PropertyValue().Get(value1.ID)
		require.NoError(t, err)
		require.Equal(t, json.RawMessage(`"Value 1"`), updated1.Value)
		require.Equal(t, originalUpdateAt1, updated1.UpdateAt)

		updated2, err := ss.PropertyValue().Get(value2.ID)
		require.NoError(t, err)
		require.Equal(t, groupID, updated2.GroupID)
		require.Equal(t, originalUpdateAt2, updated2.UpdateAt)
	})
}

func testDeletePropertyValue(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("should fail on nonexisting value", func(t *testing.T) {
		err := ss.PropertyValue().Delete(model.NewId())
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

		err = ss.PropertyValue().Delete(value.ID)
		require.NoError(t, err)

		// Verify the value was soft-deleted
		deletedValue, err := ss.PropertyValue().Get(value.ID)
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
	require.NoError(t, ss.PropertyValue().Delete(value4.ID))

	tests := []struct {
		name          string
		opts          model.PropertyValueSearchOpts
		expectedError bool
		expectedIDs   []string
	}{
		{
			name: "negative page",
			opts: model.PropertyValueSearchOpts{
				Page:    -1,
				PerPage: 10,
			},
			expectedError: true,
		},
		{
			name: "negative per_page",
			opts: model.PropertyValueSearchOpts{
				Page:    0,
				PerPage: -1,
			},
			expectedError: true,
		},
		{
			name: "filter by group_id",
			opts: model.PropertyValueSearchOpts{
				GroupID: groupID,
				Page:    0,
				PerPage: 10,
			},
			expectedIDs: []string{value1.ID, value2.ID},
		},
		{
			name: "filter by group_id and target_type",
			opts: model.PropertyValueSearchOpts{
				GroupID:    groupID,
				TargetType: "test_type",
				Page:       0,
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
				Page:           0,
				PerPage:        10,
			},
			expectedIDs: []string{value1.ID, value4.ID},
		},
		{
			name: "filter by target_id",
			opts: model.PropertyValueSearchOpts{
				TargetID: targetID,
				Page:     0,
				PerPage:  10,
			},
			expectedIDs: []string{value1.ID, value2.ID},
		},
		{
			name: "filter by group_id and target_id",
			opts: model.PropertyValueSearchOpts{
				GroupID:  groupID,
				TargetID: targetID,
				Page:     0,
				PerPage:  10,
			},
			expectedIDs: []string{value1.ID, value2.ID},
		},
		{
			name: "filter by field_id",
			opts: model.PropertyValueSearchOpts{
				FieldID: fieldID,
				Page:    0,
				PerPage: 10,
			},
			expectedIDs: []string{value1.ID},
		},
		{
			name: "filter by field_id including deleted",
			opts: model.PropertyValueSearchOpts{
				FieldID:        fieldID,
				IncludeDeleted: true,
				Page:           0,
				PerPage:        10,
			},
			expectedIDs: []string{value1.ID, value4.ID},
		},
		{
			name: "pagination page 0",
			opts: model.PropertyValueSearchOpts{
				GroupID: groupID,
				Page:    0,
				PerPage: 1,
			},
			expectedIDs: []string{value1.ID},
		},
		{
			name: "pagination page 1",
			opts: model.PropertyValueSearchOpts{
				GroupID: groupID,
				Page:    1,
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
			var ids = make([]string, len(results))
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
		updated, err := ss.PropertyValue().Update([]*model.PropertyValue{created})
		require.NoError(t, err)
		require.NotZero(t, updated)

		// Verify updated array values
		retrieved, err := ss.PropertyValue().Get(created.ID)
		require.NoError(t, err)
		var arrayValues []string
		require.NoError(t, json.Unmarshal(retrieved.Value, &arrayValues))
		require.Equal(t, []string{"updated1", "updated2", "updated3"}, arrayValues)
	})
}

func testDeleteForField(t *testing.T, _ request.CTX, ss store.Store) {
	fieldID := model.NewId()

	// Create test values
	value1 := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    model.NewId(),
		FieldID:    fieldID,
		Value:      json.RawMessage(`"value 1"`),
	}

	value2 := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    model.NewId(),
		FieldID:    fieldID,
		Value:      json.RawMessage(`"value 2"`),
	}

	value3 := &model.PropertyValue{
		TargetID:   model.NewId(),
		TargetType: "test_type",
		GroupID:    model.NewId(),
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
	deletedValues, err := ss.PropertyValue().GetMany([]string{value1.ID, value2.ID})
	require.NoError(t, err)
	require.Len(t, deletedValues, 2)
	require.NotZero(t, deletedValues[0].DeleteAt)
	require.NotZero(t, deletedValues[1].DeleteAt)

	// Verify value with different field ID was not deleted
	nonDeletedValue, err := ss.PropertyValue().Get(value3.ID)
	require.NoError(t, err)
	require.Zero(t, nonDeletedValue.DeleteAt)
}
