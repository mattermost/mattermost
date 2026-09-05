// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app_test

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestConditionService_Create_Limit(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	playbookID := model.NewId()
	teamID := model.NewId()
	userID := model.NewId()

	condition := &app.Condition{
		PlaybookID: playbookID,
		ConditionExpr: &app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		},
	}

	t.Run("success when under limit", func(t *testing.T) {
		// Mock audit record creation and logging
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("createCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return under limit
		mockStore.EXPECT().
			GetPlaybookConditionCount(playbookID).
			Return(app.MaxConditionsPerPlaybook-1, nil)

		// Mock successful creation
		createdCondition := *condition
		createdCondition.ID = model.NewId()
		createdCondition.CreateAt = model.GetMillis()
		createdCondition.UpdateAt = model.GetMillis()

		mockStore.EXPECT().
			CreateCondition(playbookID, gomock.Any()).
			Return(&createdCondition, nil)

		result, err := service.CreatePlaybookCondition(userID, *condition, teamID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, createdCondition.ID, result.ID)
	})

	t.Run("failure when at limit", func(t *testing.T) {
		// Mock audit record creation and logging
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("createCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return at limit
		mockStore.EXPECT().
			GetPlaybookConditionCount(playbookID).
			Return(app.MaxConditionsPerPlaybook, nil)

		result, err := service.CreatePlaybookCondition(userID, *condition, teamID)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "cannot create condition: playbook already has the maximum allowed number of conditions")
		require.Contains(t, err.Error(), "1000")
	})

	t.Run("failure when over limit", func(t *testing.T) {
		// Mock audit record creation and logging
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("createCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return over limit
		mockStore.EXPECT().
			GetPlaybookConditionCount(playbookID).
			Return(app.MaxConditionsPerPlaybook+5, nil)

		result, err := service.CreatePlaybookCondition(userID, *condition, teamID)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "cannot create condition: playbook already has the maximum allowed number of conditions")
		require.Contains(t, err.Error(), "1000")
	})

	t.Run("DeleteAt is always set to 0 on creation", func(t *testing.T) {
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("createCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		mockStore.EXPECT().
			GetPlaybookConditionCount(playbookID).
			Return(0, nil)

		conditionWithDeleteAt := *condition
		conditionWithDeleteAt.DeleteAt = model.GetMillis()

		mockStore.EXPECT().
			CreateCondition(playbookID, gomock.Any()).
			DoAndReturn(func(playbookID string, cond app.Condition) (*app.Condition, error) {
				require.Equal(t, int64(0), cond.DeleteAt, "DeleteAt should be cleared on creation")
				cond.ID = model.NewId()
				return &cond, nil
			})

		result, err := service.CreatePlaybookCondition(userID, conditionWithDeleteAt, teamID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, int64(0), result.DeleteAt)
	})
}

func TestConditionService_Update(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	playbookID := model.NewId()
	teamID := model.NewId()
	userID := model.NewId()
	conditionID := model.NewId()

	existingCondition := &app.Condition{
		ID:         conditionID,
		PlaybookID: playbookID,
		CreateAt:   model.GetMillis() - 1000,
		UpdateAt:   model.GetMillis() - 1000,
		ConditionExpr: &app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["low_id"]`),
			},
		},
	}

	updatedCondition := &app.Condition{
		ID:         conditionID,
		PlaybookID: playbookID,
		CreateAt:   existingCondition.CreateAt,
		UpdateAt:   model.GetMillis(),
		ConditionExpr: &app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		},
	}

	t.Run("success update", func(t *testing.T) {
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("updateCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		mockStore.EXPECT().
			GetCondition(playbookID, conditionID).
			Return(existingCondition, nil)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		mockStore.EXPECT().
			UpdateCondition(playbookID, gomock.Any()).
			Return(updatedCondition, nil)

		result, err := service.UpdatePlaybookCondition(userID, *updatedCondition, teamID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, conditionID, result.ID)
	})

	t.Run("DeleteAt is preserved from existing condition", func(t *testing.T) {
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("updateCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		existingDeletedCondition := &app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			CreateAt:   model.GetMillis() - 2000,
			UpdateAt:   model.GetMillis() - 2000,
			DeleteAt:   model.GetMillis() - 1000,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["low_id"]`),
				},
			},
		}

		mockStore.EXPECT().
			GetCondition(playbookID, conditionID).
			Return(existingDeletedCondition, nil)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		updateWithDifferentDeleteAt := *updatedCondition
		updateWithDifferentDeleteAt.DeleteAt = 0

		mockStore.EXPECT().
			UpdateCondition(playbookID, gomock.Any()).
			DoAndReturn(func(playbookID string, cond app.Condition) (*app.Condition, error) {
				require.Equal(t, existingDeletedCondition.DeleteAt, cond.DeleteAt, "DeleteAt should be preserved from existing condition")
				return &cond, nil
			})

		result, err := service.UpdatePlaybookCondition(userID, updateWithDifferentDeleteAt, teamID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, existingDeletedCondition.DeleteAt, result.DeleteAt)
	})
}

func TestConditionService_Delete(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	playbookID := model.NewId()
	teamID := model.NewId()
	userID := model.NewId()
	conditionID := model.NewId()

	existingCondition := &app.Condition{
		ID:         conditionID,
		PlaybookID: playbookID,
		CreateAt:   model.GetMillis() - 1000,
		UpdateAt:   model.GetMillis() - 1000,
		ConditionExpr: &app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		},
	}

	t.Run("success delete", func(t *testing.T) {
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("deleteCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		mockStore.EXPECT().
			GetCondition(playbookID, conditionID).
			Return(existingCondition, nil)

		mockStore.EXPECT().
			DeleteCondition(playbookID, conditionID).
			Return(nil)

		err := service.DeletePlaybookCondition(userID, playbookID, conditionID, teamID)
		require.NoError(t, err)
	})

	t.Run("failure to delete does not send websocket event", func(t *testing.T) {
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("deleteCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		mockStore.EXPECT().
			GetCondition(playbookID, conditionID).
			Return(existingCondition, nil)

		dbError := errors.New("database deletion failed")
		mockStore.EXPECT().
			DeleteCondition(playbookID, conditionID).
			Return(dbError)

		err := service.DeletePlaybookCondition(userID, playbookID, conditionID, teamID)
		require.Error(t, err)
		require.Equal(t, dbError, err)
	})
}

func TestConditionService_CopyPlaybookConditionsToRun(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	playbookID := model.NewId()
	runID := model.NewId()
	conditionID1 := model.NewId()
	conditionID2 := model.NewId()

	propertyMappings := &app.PropertyCopyResult{
		FieldMappings: map[string]string{
			"old_severity_id": "new_severity_id",
			"old_status_id":   "new_status_id",
		},
		OptionMappings: map[string]string{
			"old_critical_id": "new_critical_id",
			"old_open_id":     "new_open_id",
		},
		CopiedFields: []app.PropertyField{
			{
				PropertyField: model.PropertyField{
					ID:   "new_severity_id",
					Type: model.PropertyFieldTypeSelect,
				},
			},
			{
				PropertyField: model.PropertyField{
					ID:   "new_status_id",
					Type: model.PropertyFieldTypeSelect,
				},
			},
		},
	}

	playbookConditions := []app.Condition{
		{
			ID:         conditionID1,
			PlaybookID: playbookID,
			CreateAt:   model.GetMillis() - 1000,
			UpdateAt:   model.GetMillis() - 1000,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "old_severity_id",
					Value:   json.RawMessage(`["old_critical_id"]`),
				},
			},
		},
		{
			ID:         conditionID2,
			PlaybookID: playbookID,
			CreateAt:   model.GetMillis() - 500,
			UpdateAt:   model.GetMillis() - 500,
			ConditionExpr: &app.ConditionExprV1{
				IsNot: &app.ComparisonCondition{
					FieldID: "old_status_id",
					Value:   json.RawMessage(`["old_open_id"]`),
				},
			},
		},
	}

	t.Run("success copy conditions", func(t *testing.T) {
		mockStore.EXPECT().
			GetPlaybookConditions(playbookID, 0, app.MaxConditionsPerPlaybook).
			Return(playbookConditions, nil)

		newConditionID1 := model.NewId()
		newConditionID2 := model.NewId()

		// Mock successful creation for both conditions
		mockStore.EXPECT().
			CreateCondition(playbookID, gomock.Any()).
			DoAndReturn(func(playbookID string, condition app.Condition) (*app.Condition, error) {
				created := condition
				if condition.ConditionExpr.(*app.ConditionExprV1).Is != nil {
					created.ID = newConditionID1
				} else {
					created.ID = newConditionID2
				}
				created.CreateAt = model.GetMillis()
				created.UpdateAt = created.CreateAt
				return &created, nil
			}).
			Times(2)

		result, err := service.CopyPlaybookConditionsToRun(playbookID, runID, propertyMappings)
		require.NoError(t, err)
		require.Len(t, result, 2)
		require.Contains(t, result, conditionID1)
		require.Contains(t, result, conditionID2)
		require.Equal(t, runID, result[conditionID1].RunID)
		require.Equal(t, runID, result[conditionID2].RunID)
		require.Equal(t, "new_severity_id", result[conditionID1].ConditionExpr.(*app.ConditionExprV1).Is.FieldID)
		require.Equal(t, "new_status_id", result[conditionID2].ConditionExpr.(*app.ConditionExprV1).IsNot.FieldID)
	})

	t.Run("success with no playbook conditions", func(t *testing.T) {
		mockStore.EXPECT().
			GetPlaybookConditions(playbookID, 0, app.MaxConditionsPerPlaybook).
			Return([]app.Condition{}, nil)

		result, err := service.CopyPlaybookConditionsToRun(playbookID, runID, propertyMappings)
		require.NoError(t, err)
		require.Empty(t, result)
	})

	t.Run("error getting playbook conditions", func(t *testing.T) {
		mockStore.EXPECT().
			GetPlaybookConditions(playbookID, 0, app.MaxConditionsPerPlaybook).
			Return(nil, errors.New("database error"))

		result, err := service.CopyPlaybookConditionsToRun(playbookID, runID, propertyMappings)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "failed to get playbook conditions")
	})
}

func TestConditionService_EvaluateConditionsOnValueChanged(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	runID := model.NewId()
	playbookID := model.NewId()
	conditionID := model.NewId()
	changedFieldID := "severity_id"

	propertyFields := []app.PropertyField{
		{
			PropertyField: model.PropertyField{
				ID:   "severity_id",
				Name: "Severity",
				Type: model.PropertyFieldTypeSelect,
			},
		},
	}

	t.Run("condition met - hidden item becomes visible", func(t *testing.T) {
		// Condition that evaluates to true (met)
		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"critical_id"`), // Matches condition
			},
		}

		initialItemUpdateAt := model.GetMillis() - 5000
		initialChecklistUpdateAt := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Test Checklist",
					UpdateAt: initialChecklistUpdateAt,
					Items: []app.ChecklistItem{
						{
							ID:              model.NewId(),
							Title:           "Test Item",
							ConditionID:     conditionID,
							ConditionAction: app.ConditionActionHidden, // Initially hidden
							UpdateAt:        initialItemUpdateAt,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetConditionsByRunAndFieldID(runID, changedFieldID).
			Return([]app.Condition{condition}, nil)

		result, err := service.EvaluateConditionsOnValueChanged(playbookRun, changedFieldID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, app.ConditionActionNone, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 1, result.ChecklistChanges["Test Checklist"].Added)
		require.True(t, result.AnythingChanged())
		require.True(t, result.AnythingAdded())
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt)
		require.Equal(t, playbookRun.Checklists[0].Items[0].UpdateAt, playbookRun.Checklists[0].UpdateAt)
	})

	t.Run("condition not met - visible item becomes hidden (no recent modifications)", func(t *testing.T) {
		// Condition that evaluates to false (not met)
		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"low_id"`), // Does not match condition
			},
		}

		initialItemUpdateAt := model.GetMillis() - 5000
		initialChecklistUpdateAt := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Test Checklist",
					UpdateAt: initialChecklistUpdateAt,
					Items: []app.ChecklistItem{
						{
							ID:               model.NewId(),
							Title:            "Test Item",
							ConditionID:      conditionID,
							ConditionAction:  app.ConditionActionNone, // Initially visible
							AssigneeModified: 0,                       // Not modified
							StateModified:    0,                       // Not modified
							UpdateAt:         initialItemUpdateAt,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetConditionsByRunAndFieldID(runID, changedFieldID).
			Return([]app.Condition{condition}, nil)

		result, err := service.EvaluateConditionsOnValueChanged(playbookRun, changedFieldID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, app.ConditionActionHidden, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 1, result.ChecklistChanges["Test Checklist"].Hidden)
		require.True(t, result.AnythingChanged())
		require.False(t, result.AnythingAdded())
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt)
		require.Equal(t, playbookRun.Checklists[0].Items[0].UpdateAt, playbookRun.Checklists[0].UpdateAt)
	})

	t.Run("condition met - item already visible (no change)", func(t *testing.T) {
		// Condition that evaluates to true (met)
		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"critical_id"`), // Matches condition
			},
		}

		initialItemUpdateAt := model.GetMillis() - 5000
		initialChecklistUpdateAt := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Test Checklist",
					UpdateAt: initialChecklistUpdateAt,
					Items: []app.ChecklistItem{
						{
							ID:              model.NewId(),
							Title:           "Test Item",
							ConditionID:     conditionID,
							ConditionAction: app.ConditionActionNone, // Already visible
							UpdateAt:        initialItemUpdateAt,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetConditionsByRunAndFieldID(runID, changedFieldID).
			Return([]app.Condition{condition}, nil)

		result, err := service.EvaluateConditionsOnValueChanged(playbookRun, changedFieldID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, app.ConditionActionNone, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 0, result.ChecklistChanges["Test Checklist"].Added)
		require.Equal(t, 0, result.ChecklistChanges["Test Checklist"].Hidden)
		require.False(t, result.AnythingChanged())
		require.Equal(t, initialItemUpdateAt, playbookRun.Checklists[0].Items[0].UpdateAt)
		require.Equal(t, initialChecklistUpdateAt, playbookRun.Checklists[0].UpdateAt)
	})

	t.Run("condition not met - item with recent assignee modification shown_because_modified", func(t *testing.T) {
		// Condition that evaluates to false (not met)
		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"low_id"`), // Does not match condition
			},
		}

		initialItemUpdateAt := model.GetMillis() - 5000
		initialChecklistUpdateAt := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Test Checklist",
					UpdateAt: initialChecklistUpdateAt,
					Items: []app.ChecklistItem{
						{
							ID:               model.NewId(),
							Title:            "Test Item",
							ConditionID:      conditionID,
							ConditionAction:  app.ConditionActionNone,
							AssigneeModified: model.GetMillis(), // Recently modified
							StateModified:    0,
							UpdateAt:         initialItemUpdateAt,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetConditionsByRunAndFieldID(runID, changedFieldID).
			Return([]app.Condition{condition}, nil)

		result, err := service.EvaluateConditionsOnValueChanged(playbookRun, changedFieldID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, app.ConditionActionShownBecauseModified, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 0, result.ChecklistChanges["Test Checklist"].Added)
		require.Equal(t, 0, result.ChecklistChanges["Test Checklist"].Hidden)
		require.True(t, result.AnythingChanged())
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt)
		require.Equal(t, playbookRun.Checklists[0].Items[0].UpdateAt, playbookRun.Checklists[0].UpdateAt)
	})

	t.Run("condition not met - item with recent state modification shown_because_modified", func(t *testing.T) {
		// Condition that evaluates to false (not met)
		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"low_id"`), // Does not match condition
			},
		}

		initialItemUpdateAt := model.GetMillis() - 5000
		initialChecklistUpdateAt := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Test Checklist",
					UpdateAt: initialChecklistUpdateAt,
					Items: []app.ChecklistItem{
						{
							ID:               model.NewId(),
							Title:            "Test Item",
							ConditionID:      conditionID,
							ConditionAction:  app.ConditionActionNone,
							AssigneeModified: 0,
							StateModified:    model.GetMillis(), // Recently modified
							UpdateAt:         initialItemUpdateAt,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetConditionsByRunAndFieldID(runID, changedFieldID).
			Return([]app.Condition{condition}, nil)

		result, err := service.EvaluateConditionsOnValueChanged(playbookRun, changedFieldID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, app.ConditionActionShownBecauseModified, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 0, result.ChecklistChanges["Test Checklist"].Added)
		require.Equal(t, 0, result.ChecklistChanges["Test Checklist"].Hidden)
		require.True(t, result.AnythingChanged())
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt)
		require.Equal(t, playbookRun.Checklists[0].Items[0].UpdateAt, playbookRun.Checklists[0].UpdateAt)
	})

	t.Run("no conditions for field", func(t *testing.T) {
		playbookRun := &app.PlaybookRun{
			ID:         runID,
			PlaybookID: playbookID,
			Checklists: []app.Checklist{
				{
					Title: "Test Checklist",
					Items: []app.ChecklistItem{
						{
							ID:    model.NewId(),
							Title: "Test Item",
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetConditionsByRunAndFieldID(runID, changedFieldID).
			Return([]app.Condition{}, nil)

		result, err := service.EvaluateConditionsOnValueChanged(playbookRun, changedFieldID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Empty(t, result.ChecklistChanges)
		require.False(t, result.AnythingChanged())
		require.False(t, result.AnythingAdded())
	})

	t.Run("error getting conditions", func(t *testing.T) {
		playbookRun := &app.PlaybookRun{
			ID:         runID,
			PlaybookID: playbookID,
		}

		mockStore.EXPECT().
			GetConditionsByRunAndFieldID(runID, changedFieldID).
			Return(nil, errors.New("database error"))

		result, err := service.EvaluateConditionsOnValueChanged(playbookRun, changedFieldID)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "failed to get conditions for playbook run")
	})

	t.Run("multiple checklists and items", func(t *testing.T) {
		// Condition that evaluates to true for first item, false for second
		condition1 := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		condition2 := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["high_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"critical_id"`),
			},
		}

		initialItemUpdateAt1 := model.GetMillis() - 5000
		initialChecklistUpdateAt1 := model.GetMillis() - 5000
		initialItemUpdateAt2 := model.GetMillis() - 5000
		initialChecklistUpdateAt2 := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Checklist 1",
					UpdateAt: initialChecklistUpdateAt1,
					Items: []app.ChecklistItem{
						{
							ID:              model.NewId(),
							Title:           "Item 1",
							ConditionID:     condition1.ID,
							ConditionAction: app.ConditionActionHidden,
							UpdateAt:        initialItemUpdateAt1,
						},
					},
				},
				{
					Title:    "Checklist 2",
					UpdateAt: initialChecklistUpdateAt2,
					Items: []app.ChecklistItem{
						{
							ID:               model.NewId(),
							Title:            "Item 2",
							ConditionID:      condition2.ID,
							ConditionAction:  app.ConditionActionNone,
							AssigneeModified: 0,
							StateModified:    0,
							UpdateAt:         initialItemUpdateAt2,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetConditionsByRunAndFieldID(runID, changedFieldID).
			Return([]app.Condition{condition1, condition2}, nil)

		result, err := service.EvaluateConditionsOnValueChanged(playbookRun, changedFieldID)
		require.NoError(t, err)
		require.NotNil(t, result)

		// First item: condition met, should become visible
		require.Equal(t, app.ConditionActionNone, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 1, result.ChecklistChanges["Checklist 1"].Added)
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt1)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt1)

		// Second item: condition not met, should become hidden
		require.Equal(t, app.ConditionActionHidden, playbookRun.Checklists[1].Items[0].ConditionAction)
		require.Equal(t, 1, result.ChecklistChanges["Checklist 2"].Hidden)
		require.Greater(t, playbookRun.Checklists[1].Items[0].UpdateAt, initialItemUpdateAt2)
		require.Greater(t, playbookRun.Checklists[1].UpdateAt, initialChecklistUpdateAt2)

		require.True(t, result.AnythingChanged())
		require.True(t, result.AnythingAdded())
	})
}

func TestConditionService_EvaluateAllConditionsForRun(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	runID := model.NewId()
	playbookID := model.NewId()
	conditionID := model.NewId()

	propertyFields := []app.PropertyField{
		{
			PropertyField: model.PropertyField{
				ID:   "severity_id",
				Name: "Severity",
				Type: model.PropertyFieldTypeSelect,
			},
		},
	}

	t.Run("condition met - hidden item becomes visible", func(t *testing.T) {
		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"critical_id"`),
			},
		}

		initialItemUpdateAt := model.GetMillis() - 5000
		initialChecklistUpdateAt := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Test Checklist",
					UpdateAt: initialChecklistUpdateAt,
					Items: []app.ChecklistItem{
						{
							ID:              model.NewId(),
							Title:           "Test Item",
							ConditionID:     conditionID,
							ConditionAction: app.ConditionActionHidden,
							UpdateAt:        initialItemUpdateAt,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetRunConditions(playbookID, runID, 0, app.MaxConditionsPerPlaybook).
			Return([]app.Condition{condition}, nil)

		result, err := service.EvaluateAllConditionsForRun(playbookRun)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, app.ConditionActionNone, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 1, result.ChecklistChanges["Test Checklist"].Added)
		require.True(t, result.AnythingChanged())
		require.True(t, result.AnythingAdded())
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt)
		require.Equal(t, playbookRun.Checklists[0].Items[0].UpdateAt, playbookRun.Checklists[0].UpdateAt)
	})

	t.Run("condition not met - visible item becomes hidden", func(t *testing.T) {
		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"low_id"`),
			},
		}

		initialItemUpdateAt := model.GetMillis() - 5000
		initialChecklistUpdateAt := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Test Checklist",
					UpdateAt: initialChecklistUpdateAt,
					Items: []app.ChecklistItem{
						{
							ID:               model.NewId(),
							Title:            "Test Item",
							ConditionID:      conditionID,
							ConditionAction:  app.ConditionActionNone,
							AssigneeModified: 0,
							StateModified:    0,
							UpdateAt:         initialItemUpdateAt,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetRunConditions(playbookID, runID, 0, app.MaxConditionsPerPlaybook).
			Return([]app.Condition{condition}, nil)

		result, err := service.EvaluateAllConditionsForRun(playbookRun)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, app.ConditionActionHidden, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 1, result.ChecklistChanges["Test Checklist"].Hidden)
		require.True(t, result.AnythingChanged())
		require.False(t, result.AnythingAdded())
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt)
		require.Equal(t, playbookRun.Checklists[0].Items[0].UpdateAt, playbookRun.Checklists[0].UpdateAt)
	})

	t.Run("condition not met - item with recent modification shown_because_modified", func(t *testing.T) {
		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"low_id"`),
			},
		}

		initialItemUpdateAt := model.GetMillis() - 5000
		initialChecklistUpdateAt := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Test Checklist",
					UpdateAt: initialChecklistUpdateAt,
					Items: []app.ChecklistItem{
						{
							ID:               model.NewId(),
							Title:            "Test Item",
							ConditionID:      conditionID,
							ConditionAction:  app.ConditionActionNone,
							AssigneeModified: model.GetMillis(),
							StateModified:    0,
							UpdateAt:         initialItemUpdateAt,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetRunConditions(playbookID, runID, 0, app.MaxConditionsPerPlaybook).
			Return([]app.Condition{condition}, nil)

		result, err := service.EvaluateAllConditionsForRun(playbookRun)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, app.ConditionActionShownBecauseModified, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 0, result.ChecklistChanges["Test Checklist"].Added)
		require.Equal(t, 0, result.ChecklistChanges["Test Checklist"].Hidden)
		require.True(t, result.AnythingChanged())
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt)
		require.Equal(t, playbookRun.Checklists[0].Items[0].UpdateAt, playbookRun.Checklists[0].UpdateAt)
	})

	t.Run("no conditions for run", func(t *testing.T) {
		playbookRun := &app.PlaybookRun{
			ID:         runID,
			PlaybookID: playbookID,
			Checklists: []app.Checklist{
				{
					Title: "Test Checklist",
					Items: []app.ChecklistItem{
						{
							ID:    model.NewId(),
							Title: "Test Item",
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetRunConditions(playbookID, runID, 0, app.MaxConditionsPerPlaybook).
			Return([]app.Condition{}, nil)

		result, err := service.EvaluateAllConditionsForRun(playbookRun)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Empty(t, result.ChecklistChanges)
		require.False(t, result.AnythingChanged())
		require.False(t, result.AnythingAdded())
	})

	t.Run("error getting conditions", func(t *testing.T) {
		playbookRun := &app.PlaybookRun{
			ID:         runID,
			PlaybookID: playbookID,
		}

		mockStore.EXPECT().
			GetRunConditions(playbookID, runID, 0, app.MaxConditionsPerPlaybook).
			Return(nil, errors.New("database error"))

		result, err := service.EvaluateAllConditionsForRun(playbookRun)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "failed to get conditions for playbook run")
	})

	t.Run("empty playbook ID", func(t *testing.T) {
		playbookRun := &app.PlaybookRun{
			ID:         runID,
			PlaybookID: "",
		}

		result, err := service.EvaluateAllConditionsForRun(playbookRun)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Empty(t, result.ChecklistChanges)
	})

	t.Run("multiple checklists and items", func(t *testing.T) {
		condition1 := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
		}

		condition2 := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["high_id"]`),
				},
			},
		}

		propertyValues := []app.PropertyValue{
			{
				FieldID: "severity_id",
				Value:   json.RawMessage(`"critical_id"`),
			},
		}

		initialItemUpdateAt1 := model.GetMillis() - 5000
		initialChecklistUpdateAt1 := model.GetMillis() - 5000
		initialItemUpdateAt2 := model.GetMillis() - 5000
		initialChecklistUpdateAt2 := model.GetMillis() - 5000

		playbookRun := &app.PlaybookRun{
			ID:             runID,
			PlaybookID:     playbookID,
			PropertyFields: propertyFields,
			PropertyValues: propertyValues,
			Checklists: []app.Checklist{
				{
					Title:    "Checklist 1",
					UpdateAt: initialChecklistUpdateAt1,
					Items: []app.ChecklistItem{
						{
							ID:              model.NewId(),
							Title:           "Item 1",
							ConditionID:     condition1.ID,
							ConditionAction: app.ConditionActionHidden,
							UpdateAt:        initialItemUpdateAt1,
						},
					},
				},
				{
					Title:    "Checklist 2",
					UpdateAt: initialChecklistUpdateAt2,
					Items: []app.ChecklistItem{
						{
							ID:               model.NewId(),
							Title:            "Item 2",
							ConditionID:      condition2.ID,
							ConditionAction:  app.ConditionActionNone,
							AssigneeModified: 0,
							StateModified:    0,
							UpdateAt:         initialItemUpdateAt2,
						},
					},
				},
			},
		}

		mockStore.EXPECT().
			GetRunConditions(playbookID, runID, 0, app.MaxConditionsPerPlaybook).
			Return([]app.Condition{condition1, condition2}, nil)

		result, err := service.EvaluateAllConditionsForRun(playbookRun)
		require.NoError(t, err)
		require.NotNil(t, result)

		require.Equal(t, app.ConditionActionNone, playbookRun.Checklists[0].Items[0].ConditionAction)
		require.Equal(t, 1, result.ChecklistChanges["Checklist 1"].Added)
		require.Greater(t, playbookRun.Checklists[0].Items[0].UpdateAt, initialItemUpdateAt1)
		require.Greater(t, playbookRun.Checklists[0].UpdateAt, initialChecklistUpdateAt1)

		require.Equal(t, app.ConditionActionHidden, playbookRun.Checklists[1].Items[0].ConditionAction)
		require.Equal(t, 1, result.ChecklistChanges["Checklist 2"].Hidden)
		require.Greater(t, playbookRun.Checklists[1].Items[0].UpdateAt, initialItemUpdateAt2)
		require.Greater(t, playbookRun.Checklists[1].UpdateAt, initialChecklistUpdateAt2)

		require.True(t, result.AnythingChanged())
		require.True(t, result.AnythingAdded())
	})
}
