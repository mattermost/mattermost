// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore/mocks"
)

func setupConditionStore(t *testing.T, db *sqlx.DB) (app.ConditionStore, app.PlaybookStore) {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	sqlStore := setupSQLStore(t, db)
	conditionStore := NewConditionStore(pluginAPIClient, sqlStore)
	playbookStore := NewPlaybookStore(pluginAPIClient, sqlStore)

	return conditionStore, playbookStore
}

func TestConditionStore(t *testing.T) {
	db := setupTestDB(t)
	_ = setupTables(t, db)
	conditionStore, playbookStore := setupConditionStore(t, db)

	t.Run("create and get condition", func(t *testing.T) {
		conditionID := model.NewId()

		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      "",
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id", "high_id"]`),
				},
			},
			Version:  1,
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
			DeleteAt: 0,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)
		require.NotNil(t, created)
		require.NotEmpty(t, created.ID)
		require.Equal(t, playbookID, created.PlaybookID)
		require.Equal(t, condition.ConditionExpr, created.ConditionExpr)
		require.Equal(t, condition.Version, created.Version)

		retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		require.Equal(t, created.ID, retrieved.ID)
		require.Equal(t, playbookID, retrieved.PlaybookID)
		require.EqualValues(t, condition.ConditionExpr, retrieved.ConditionExpr)
		require.Equal(t, condition.Version, retrieved.Version)
	})

	t.Run("create condition with complex nested expression", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			ConditionExpr: &app.ConditionExprV1{
				And: []app.ConditionExprV1{
					{
						Is: &app.ComparisonCondition{
							FieldID: "severity_id",
							Value:   json.RawMessage(`["critical_id"]`),
						},
					},
					{
						Or: []app.ConditionExprV1{
							{
								IsNot: &app.ComparisonCondition{
									FieldID: "acknowledged_id",
									Value:   json.RawMessage(`"true"`),
								},
							},
							{
								Is: &app.ComparisonCondition{
									FieldID: "categories_id",
									Value:   json.RawMessage(`["cat_a_id", "cat_b_id"]`),
								},
							},
						},
					},
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)
		require.NotNil(t, created)

		retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		require.Equal(t, created.ID, retrieved.ID)
		require.Equal(t, playbookID, retrieved.PlaybookID)
		require.Equal(t, condition.Version, retrieved.Version)

		// Verify the complex nested structure is preserved
		retrievedExprV1, ok := retrieved.ConditionExpr.(*app.ConditionExprV1)
		require.True(t, ok)
		require.NotNil(t, retrievedExprV1.And)
		require.Len(t, retrievedExprV1.And, 2)
		require.NotNil(t, retrievedExprV1.And[0].Is)
		require.Equal(t, "severity_id", retrievedExprV1.And[0].Is.FieldID)
		require.NotNil(t, retrievedExprV1.And[1].Or)
		require.Len(t, retrievedExprV1.And[1].Or, 2)
	})

	t.Run("update condition", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["low_id"]`),
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)

		// Update the condition
		created.ConditionExpr = &app.ConditionExprV1{
			IsNot: &app.ComparisonCondition{
				FieldID: "status_id",
				Value:   json.RawMessage(`["closed_id", "archived_id"]`),
			},
		}

		updated, err := conditionStore.UpdateCondition(playbookID, *created)
		require.NoError(t, err)
		require.NotNil(t, updated)
		require.Equal(t, created.ID, updated.ID)
		require.GreaterOrEqual(t, updated.UpdateAt, created.UpdateAt)
		updatedExprV1, ok := updated.ConditionExpr.(*app.ConditionExprV1)
		require.True(t, ok)
		require.Equal(t, "status_id", updatedExprV1.IsNot.FieldID)

		// Verify changes persisted
		retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
		require.NoError(t, err)
		require.Equal(t, updated.ConditionExpr, retrieved.ConditionExpr)
	})

	t.Run("delete condition", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "priority_id",
					Value:   json.RawMessage(`["urgent_id"]`),
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)

		err = conditionStore.DeleteCondition(playbookID, created.ID)
		require.NoError(t, err)

		// Should not be retrievable after deletion
		_, err = conditionStore.GetCondition(playbookID, created.ID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition not found")
	})

	t.Run("get multiple conditions", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Create multiple conditions
		conditions := []app.Condition{
			{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				CreateAt: 1000,
				UpdateAt: 1000,
			},
			{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					IsNot: &app.ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["closed_id"]`),
					},
				},
				CreateAt: 2000,
				UpdateAt: 2000,
			},
		}

		for _, condition := range conditions {
			_, err := conditionStore.CreateCondition(playbookID, condition)
			require.NoError(t, err)
		}

		retrieved, err := conditionStore.GetPlaybookConditions(playbookID, 0, 20)
		require.NoError(t, err)
		require.Len(t, retrieved, 2)

		// Test pagination
		retrieved, err = conditionStore.GetPlaybookConditions(playbookID, 0, 1)
		require.NoError(t, err)
		require.Len(t, retrieved, 1)
	})

	t.Run("get conditions with run filter", func(t *testing.T) {
		runID := model.NewId()

		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Create conditions - one for playbook, one for run
		playbookCondition := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			RunID:      "",
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["high_id"]`),
				},
			},
			CreateAt: 1000,
			UpdateAt: 1000,
		}

		runCondition := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				IsNot: &app.ComparisonCondition{
					FieldID: "status_id",
					Value:   json.RawMessage(`["resolved_id"]`),
				},
			},
			CreateAt: 2000,
			UpdateAt: 2000,
		}

		_, err = conditionStore.CreateCondition(playbookID, playbookCondition)
		require.NoError(t, err)
		_, err = conditionStore.CreateCondition(playbookID, runCondition)
		require.NoError(t, err)

		// Get only run conditions
		runConditions, err := conditionStore.GetRunConditions(playbookID, runID, 0, 20)
		require.NoError(t, err)
		require.Len(t, runConditions, 1)
		require.Equal(t, runID, runConditions[0].RunID)

		// Get only playbook conditions - should exclude run conditions
		playbookConditions, err := conditionStore.GetPlaybookConditions(playbookID, 0, 20)
		require.NoError(t, err)
		require.Len(t, playbookConditions, 1)
		require.Equal(t, "", playbookConditions[0].RunID)
		require.Equal(t, playbookCondition.ID, playbookConditions[0].ID)
	})

	t.Run("condition not found error", func(t *testing.T) {
		playbookID := model.NewId()
		nonExistentID := model.NewId()

		_, err := conditionStore.GetCondition(playbookID, nonExistentID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition not found")
	})

	t.Run("auto-generate ID on create", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         "", // Empty ID should be auto-generated
			Version:    1,
			PlaybookID: playbookID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "test_field",
					Value:   json.RawMessage(`["test_value"]`),
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)
		require.NotEmpty(t, created.ID)
		require.Len(t, created.ID, 26) // Mattermost ID length
	})

	t.Run("verify database storage of extracted field and option IDs", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Create a complex condition with multiple fields and options
		condition := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			ConditionExpr: &app.ConditionExprV1{
				And: []app.ConditionExprV1{
					{
						Is: &app.ComparisonCondition{
							FieldID: "severity_id",
							Value:   json.RawMessage(`["critical_id", "high_id"]`),
						},
					},
					{
						IsNot: &app.ComparisonCondition{
							FieldID: "status_id",
							Value:   json.RawMessage(`["closed_id", "archived_id"]`),
						},
					},
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		// Store the condition
		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)
		require.NotNil(t, created)

		// Manually query the database to check the JSON fields
		var result struct {
			PropertyFieldIDs   json.RawMessage `db:"propertyfieldids"`
			PropertyOptionsIDs json.RawMessage `db:"propertyoptionsids"`
		}
		query := "SELECT propertyfieldids, propertyoptionsids FROM IR_Condition WHERE id = $1"
		err = db.Get(&result, query, created.ID)
		require.NoError(t, err)

		// Parse the stored JSON and verify the extracted field IDs
		var fieldIDs []string
		err = json.Unmarshal(result.PropertyFieldIDs, &fieldIDs)
		require.NoError(t, err)
		require.Len(t, fieldIDs, 2)
		require.Contains(t, fieldIDs, "severity_id")
		require.Contains(t, fieldIDs, "status_id")

		// Parse the stored JSON and verify the extracted option IDs
		var optionIDs []string
		err = json.Unmarshal(result.PropertyOptionsIDs, &optionIDs)
		require.NoError(t, err)
		require.Len(t, optionIDs, 4)
		require.Contains(t, optionIDs, "critical_id")
		require.Contains(t, optionIDs, "high_id")
		require.Contains(t, optionIDs, "closed_id")
		require.Contains(t, optionIDs, "archived_id")
	})

	t.Run("get condition count", func(t *testing.T) {
		// Create test playbook
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Initially should have 0 conditions
		count, err := conditionStore.GetPlaybookConditionCount(playbookID)
		require.NoError(t, err)
		require.Equal(t, 0, count)

		// Create first condition
		condition1 := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		_, err = conditionStore.CreateCondition(playbookID, condition1)
		require.NoError(t, err)

		// Should now have 1 condition
		count, err = conditionStore.GetPlaybookConditionCount(playbookID)
		require.NoError(t, err)
		require.Equal(t, 1, count)

		// Create second condition
		condition2 := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			ConditionExpr: &app.ConditionExprV1{
				IsNot: &app.ComparisonCondition{
					FieldID: "status_id",
					Value:   json.RawMessage(`"resolved"`),
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		_, err = conditionStore.CreateCondition(playbookID, condition2)
		require.NoError(t, err)

		// Should now have 2 conditions
		count, err = conditionStore.GetPlaybookConditionCount(playbookID)
		require.NoError(t, err)
		require.Equal(t, 2, count)

		// Soft delete first condition
		err = conditionStore.DeleteCondition(playbookID, condition1.ID)
		require.NoError(t, err)

		// Should now have 1 condition (deleted ones don't count)
		count, err = conditionStore.GetPlaybookConditionCount(playbookID)
		require.NoError(t, err)
		require.Equal(t, 1, count)
	})

	t.Run("count conditions using property field", func(t *testing.T) {
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		propertyFieldID1 := "field_123"
		propertyFieldID2 := "field_456"

		t.Run("no conditions returns zero", func(t *testing.T) {
			count, err := conditionStore.CountConditionsUsingPropertyField(playbookID, propertyFieldID1)
			require.NoError(t, err)
			require.Equal(t, 0, count)
		})

		t.Run("single condition using field", func(t *testing.T) {
			condition1 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID1,
						Value:   json.RawMessage(`["value1"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, condition1)
			require.NoError(t, err)

			count, err := conditionStore.CountConditionsUsingPropertyField(playbookID, propertyFieldID1)
			require.NoError(t, err)
			require.Equal(t, 1, count)
		})

		t.Run("multiple conditions using same field", func(t *testing.T) {
			condition2 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					And: []app.ConditionExprV1{
						{
							Is: &app.ComparisonCondition{
								FieldID: propertyFieldID1,
								Value:   json.RawMessage(`["value2"]`),
							},
						},
						{
							IsNot: &app.ComparisonCondition{
								FieldID: propertyFieldID2,
								Value:   json.RawMessage(`["value3"]`),
							},
						},
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, condition2)
			require.NoError(t, err)

			count, err := conditionStore.CountConditionsUsingPropertyField(playbookID, propertyFieldID1)
			require.NoError(t, err)
			require.Equal(t, 2, count)

			count, err = conditionStore.CountConditionsUsingPropertyField(playbookID, propertyFieldID2)
			require.NoError(t, err)
			require.Equal(t, 1, count)
		})

		t.Run("deleted conditions not counted", func(t *testing.T) {
			conditions, err := conditionStore.GetPlaybookConditions(playbookID, 0, 10)
			require.NoError(t, err)
			require.NotEmpty(t, conditions)

			err = conditionStore.DeleteCondition(playbookID, conditions[0].ID)
			require.NoError(t, err)

			count, err := conditionStore.CountConditionsUsingPropertyField(playbookID, propertyFieldID1)
			require.NoError(t, err)
			require.Equal(t, 1, count)
		})

		t.Run("run conditions are not counted", func(t *testing.T) {
			runID := model.NewId()
			runCondition := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				RunID:      runID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID1,
						Value:   json.RawMessage(`["run_value"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, runCondition)
			require.NoError(t, err)

			count, err := conditionStore.CountConditionsUsingPropertyField(playbookID, propertyFieldID1)
			require.NoError(t, err)
			require.Equal(t, 1, count)
		})
	})

	t.Run("count conditions using property options", func(t *testing.T) {
		playbook := NewPBBuilder().WithTitle("Test Playbook Options").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		propertyFieldID := "field_with_options"
		optionID1 := "option_abc"
		optionID2 := "option_def"
		optionID3 := "option_ghi"

		t.Run("empty option list returns empty map", func(t *testing.T) {
			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{})
			require.NoError(t, err)
			require.Empty(t, result)
		})

		t.Run("no conditions returns empty map", func(t *testing.T) {
			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{optionID1, optionID2})
			require.NoError(t, err)
			require.Empty(t, result)
		})

		t.Run("single condition using one option", func(t *testing.T) {
			condition1 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID,
						Value:   json.RawMessage(`["` + optionID1 + `"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, condition1)
			require.NoError(t, err)

			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{optionID1, optionID2})
			require.NoError(t, err)
			require.Equal(t, 1, len(result))
			require.Equal(t, 1, result[optionID1])
		})

		t.Run("multiple conditions using same option", func(t *testing.T) {
			condition2 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID,
						Value:   json.RawMessage(`["` + optionID1 + `"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, condition2)
			require.NoError(t, err)

			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{optionID1})
			require.NoError(t, err)
			require.Equal(t, 1, len(result))
			require.Equal(t, 2, result[optionID1])
		})

		t.Run("condition using multiple options", func(t *testing.T) {
			condition3 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID,
						Value:   json.RawMessage(`["` + optionID2 + `", "` + optionID3 + `"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, condition3)
			require.NoError(t, err)

			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{optionID1, optionID2, optionID3})
			require.NoError(t, err)
			require.Equal(t, 3, len(result))
			require.Equal(t, 2, result[optionID1])
			require.Equal(t, 1, result[optionID2])
			require.Equal(t, 1, result[optionID3])
		})

		t.Run("deleted conditions not counted", func(t *testing.T) {
			conditions, err := conditionStore.GetPlaybookConditions(playbookID, 0, 10)
			require.NoError(t, err)
			require.NotEmpty(t, conditions)

			err = conditionStore.DeleteCondition(playbookID, conditions[0].ID)
			require.NoError(t, err)

			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{optionID1})
			require.NoError(t, err)
			require.Equal(t, 1, result[optionID1])
		})

		t.Run("run conditions are not counted", func(t *testing.T) {
			runID := model.NewId()
			runCondition := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				RunID:      runID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID,
						Value:   json.RawMessage(`["` + optionID1 + `"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, runCondition)
			require.NoError(t, err)

			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{optionID1})
			require.NoError(t, err)
			require.Equal(t, 1, result[optionID1])
		})
	})

	t.Run("complex option update scenarios", func(t *testing.T) {
		playbook := NewPBBuilder().WithTitle("Test Complex Scenarios").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		propertyFieldID := "field_complex"
		optionA := "option_a"
		optionB := "option_b"
		optionC := "option_c"
		optionD := "option_d"
		optionE := "option_e"

		t.Run("removing multiple options with mixed usage", func(t *testing.T) {
			condition1 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID,
						Value:   json.RawMessage(`["` + optionA + `"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			condition2 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID,
						Value:   json.RawMessage(`["` + optionC + `"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, condition1)
			require.NoError(t, err)
			_, err = conditionStore.CreateCondition(playbookID, condition2)
			require.NoError(t, err)

			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{optionA, optionB, optionC, optionD})
			require.NoError(t, err)
			require.Equal(t, 2, len(result))
			require.Equal(t, 1, result[optionA])
			require.Equal(t, 1, result[optionC])
			require.NotContains(t, result, optionB)
			require.NotContains(t, result, optionD)
		})

		t.Run("same option referenced by multiple conditions", func(t *testing.T) {
			condition3 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: propertyFieldID,
						Value:   json.RawMessage(`["` + optionE + `"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			condition4 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					IsNot: &app.ComparisonCondition{
						FieldID: propertyFieldID,
						Value:   json.RawMessage(`["` + optionE + `"]`),
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			condition5 := app.Condition{
				ID:         model.NewId(),
				Version:    1,
				PlaybookID: playbookID,
				ConditionExpr: &app.ConditionExprV1{
					And: []app.ConditionExprV1{
						{
							Is: &app.ComparisonCondition{
								FieldID: propertyFieldID,
								Value:   json.RawMessage(`["` + optionE + `"]`),
							},
						},
					},
				},
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}

			_, err := conditionStore.CreateCondition(playbookID, condition3)
			require.NoError(t, err)
			_, err = conditionStore.CreateCondition(playbookID, condition4)
			require.NoError(t, err)
			_, err = conditionStore.CreateCondition(playbookID, condition5)
			require.NoError(t, err)

			result, err := conditionStore.CountConditionsUsingPropertyOptions(playbookID, []string{optionE})
			require.NoError(t, err)
			require.Equal(t, 1, len(result))
			require.Equal(t, 3, result[optionE])
		})
	})

	t.Run("get conditions by run and field ID", func(t *testing.T) {
		runID := model.NewId()
		fieldID := "severity_id"

		// Create test playbook
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Create condition 1: matches both runID and fieldID
		condition1 := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: fieldID,
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		// Create condition 2: matches runID and fieldID (complex condition)
		condition2 := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				And: []app.ConditionExprV1{
					{
						Is: &app.ComparisonCondition{
							FieldID: fieldID,
							Value:   json.RawMessage(`["high_id"]`),
						},
					},
					{
						IsNot: &app.ComparisonCondition{
							FieldID: "status_id",
							Value:   json.RawMessage(`["resolved_id"]`),
						},
					},
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		// Create condition 3: matches runID but different fieldID
		condition3 := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "priority_id",
					Value:   json.RawMessage(`["urgent_id"]`),
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		// Create condition 4: matches fieldID but different runID
		condition4 := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			RunID:      model.NewId(), // Different run ID
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: fieldID,
					Value:   json.RawMessage(`["medium_id"]`),
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		// Store all conditions
		_, err = conditionStore.CreateCondition(playbookID, condition1)
		require.NoError(t, err)
		_, err = conditionStore.CreateCondition(playbookID, condition2)
		require.NoError(t, err)
		_, err = conditionStore.CreateCondition(playbookID, condition3)
		require.NoError(t, err)
		_, err = conditionStore.CreateCondition(playbookID, condition4)
		require.NoError(t, err)

		// Query conditions by runID and fieldID
		results, err := conditionStore.GetConditionsByRunAndFieldID(runID, fieldID)
		require.NoError(t, err)
		require.Len(t, results, 2) // Should return conditions 1 and 2

		// Verify we got the correct conditions
		resultIDs := make([]string, len(results))
		for i, result := range results {
			resultIDs[i] = result.ID
			require.Equal(t, playbookID, result.PlaybookID)
			require.Equal(t, runID, result.RunID)
		}
		require.Contains(t, resultIDs, condition1.ID)
		require.Contains(t, resultIDs, condition2.ID)
		require.NotContains(t, resultIDs, condition3.ID)
		require.NotContains(t, resultIDs, condition4.ID)
	})

	t.Run("get conditions by run and field ID - no matches", func(t *testing.T) {
		nonExistentRunID := model.NewId()
		nonExistentFieldID := "non_existent_field"

		results, err := conditionStore.GetConditionsByRunAndFieldID(nonExistentRunID, nonExistentFieldID)
		require.NoError(t, err)
		require.Empty(t, results)
	})

	t.Run("get conditions by run and field ID - ignores deleted conditions", func(t *testing.T) {
		runID := model.NewId()
		fieldID := "severity_id"

		// Create test playbook
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Create condition
		condition := app.Condition{
			ID:         model.NewId(),
			Version:    1,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: fieldID,
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		// Store condition
		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)

		// Should find the condition
		results, err := conditionStore.GetConditionsByRunAndFieldID(runID, fieldID)
		require.NoError(t, err)
		require.Len(t, results, 1)
		require.Equal(t, created.ID, results[0].ID)

		// Delete the condition
		err = conditionStore.DeleteCondition(playbookID, created.ID)
		require.NoError(t, err)

		// Should not find the deleted condition
		results, err = conditionStore.GetConditionsByRunAndFieldID(runID, fieldID)
		require.NoError(t, err)
		require.Empty(t, results)
	})
}
