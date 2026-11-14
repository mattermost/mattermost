// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
)

// Websocket event constants disabled until we implement proper user targeting
// const (
// 	conditionCreatedWSEvent = "condition_created"
// 	conditionUpdatedWSEvent = "condition_updated"
// 	conditionDeletedWSEvent = "condition_deleted"
// )

type conditionService struct {
	store           ConditionStore
	propertyService PropertyService
	poster          bot.Poster
	auditor         Auditor
}

func NewConditionService(store ConditionStore, propertyService PropertyService, poster bot.Poster, auditor Auditor) ConditionService {
	return &conditionService{
		store:           store,
		propertyService: propertyService,
		poster:          poster,
		auditor:         auditor,
	}
}

// CopyPlaybookConditionsToRun copies conditions from a playbook to a run, translating field IDs
func (s *conditionService) CopyPlaybookConditionsToRun(playbookID, runID string, propertyMappings *PropertyCopyResult) (map[string]*Condition, error) {
	// Get all conditions for the playbook
	playbookConditions, err := s.store.GetPlaybookConditions(playbookID, 0, MaxConditionsPerPlaybook)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get playbook conditions")
	}

	// Map from old condition ID to new copied condition
	conditionMapping := make(map[string]*Condition)
	if len(playbookConditions) == 0 {
		return conditionMapping, nil
	}

	// Copy each condition with translated field IDs
	for _, condition := range playbookConditions {
		runCondition := condition
		runCondition.ID = ""
		runCondition.RunID = runID // Set the run ID, keep original PlaybookID
		runCondition.CreateAt = model.GetMillis()
		runCondition.UpdateAt = runCondition.CreateAt

		// Translate field IDs in the condition expression
		if err := runCondition.ConditionExpr.SwapPropertyIDs(propertyMappings); err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"condition_id": condition.ID,
				"playbook_id":  playbookID,
				"run_id":       runID,
			}).Warn("failed to translate field IDs in condition, skipping")
			continue
		}

		// Create the condition for the run
		createdCondition, err := s.store.CreateCondition(playbookID, runCondition)
		if err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"condition_id": condition.ID,
				"playbook_id":  playbookID,
				"run_id":       runID,
			}).Warn("failed to create run condition, skipping")
			continue
		}

		// Map old condition ID to new copied condition
		conditionMapping[condition.ID] = createdCondition
	}

	logrus.WithFields(logrus.Fields{
		"playbook_id":       playbookID,
		"run_id":            runID,
		"conditions_copied": len(playbookConditions),
	}).Info("copied playbook conditions to run")

	return conditionMapping, nil
}

// CreatePlaybookCondition creates a new stored condition for a playbook
func (s *conditionService) CreatePlaybookCondition(userID string, condition Condition, teamID string) (*Condition, error) {
	auditRec := s.auditor.MakeAuditRecord("createCondition", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterToAuditRec(auditRec, "teamID", teamID)
	model.AddEventParameterToAuditRec(auditRec, "playbookID", condition.PlaybookID)

	propertyFields, err := s.propertyService.GetPropertyFields(condition.PlaybookID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return nil, errors.Wrap(err, "failed to get property fields for validation")
	}

	// Set metadata for creation
	now := model.GetMillis()
	condition.CreateAt = now
	condition.UpdateAt = now
	condition.DeleteAt = 0

	if err := condition.IsValid(true, propertyFields); err != nil {
		auditRec.AddErrorDesc(err.Error())
		return nil, errors.Wrap(ErrMalformedCondition, err.Error())
	}

	if condition.RunID != "" {
		err := errors.New("cannot create conditions with RunID - run conditions are system managed")
		auditRec.AddErrorDesc(err.Error())
		return nil, err
	}

	// Check condition limit for playbook
	currentCount, err := s.store.GetPlaybookConditionCount(condition.PlaybookID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return nil, errors.Wrap(err, "failed to get current condition count")
	}

	if currentCount >= MaxConditionsPerPlaybook {
		err := errors.Errorf("cannot create condition: playbook already has the maximum allowed number of conditions (%d)", MaxConditionsPerPlaybook)
		auditRec.AddErrorDesc(err.Error())
		return nil, err
	}

	condition.Sanitize()

	createdCondition, err := s.store.CreateCondition(condition.PlaybookID, condition)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return nil, err
	}

	// Websocket events disabled until we implement proper user targeting to avoid leaking condition info
	// if err := s.sendConditionCreatedWS(createdCondition, teamID); err != nil {
	// 	// Log but don't fail the operation for websocket errors
	// 	logrus.WithError(err).WithField("condition_id", createdCondition.ID).Error("failed to send condition created websocket event")
	// }

	auditRec.Success()
	auditRec.AddEventResultState(createdCondition)

	return createdCondition, nil
}

// GetPlaybookCondition retrieves a stored playbook condition by ID
func (s *conditionService) GetPlaybookCondition(userID, playbookID, conditionID string) (*Condition, error) {
	condition, err := s.store.GetCondition(playbookID, conditionID)
	if err != nil {
		return nil, err
	}
	return condition, nil
}

// UpdatePlaybookCondition updates an existing stored condition for a playbook
func (s *conditionService) UpdatePlaybookCondition(userID string, condition Condition, teamID string) (*Condition, error) {
	auditRec := s.auditor.MakeAuditRecord("updateCondition", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterToAuditRec(auditRec, "teamID", teamID)
	model.AddEventParameterToAuditRec(auditRec, "playbookID", condition.PlaybookID)
	model.AddEventParameterAuditableToAuditRec(auditRec, "condition", &condition)

	existing, err := s.store.GetCondition(condition.PlaybookID, condition.ID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return nil, err
	}

	if existing.RunID != "" {
		err := errors.New("cannot modify conditions associated with a run - run conditions are read-only")
		auditRec.AddErrorDesc(err.Error())
		return nil, err
	}

	if condition.RunID != "" {
		err := errors.New("cannot associate existing condition with a run - run conditions are system managed")
		auditRec.AddErrorDesc(err.Error())
		return nil, err
	}

	// Preserve immutable fields from existing condition
	condition.CreateAt = existing.CreateAt
	condition.UpdateAt = model.GetMillis()
	condition.DeleteAt = existing.DeleteAt

	propertyFields, err := s.propertyService.GetPropertyFields(condition.PlaybookID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return nil, errors.Wrap(err, "failed to get property fields for validation")
	}

	if err := condition.IsValid(false, propertyFields); err != nil {
		auditRec.AddErrorDesc(err.Error())
		return nil, errors.Wrap(ErrMalformedCondition, err.Error())
	}

	condition.Sanitize()

	updatedCondition, err := s.store.UpdateCondition(condition.PlaybookID, condition)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return nil, err
	}

	// Websocket events disabled until we implement proper user targeting to avoid leaking condition info
	// if err := s.sendConditionUpdatedWS(updatedCondition, teamID); err != nil {
	// 	// Log but don't fail the operation for websocket errors
	// 	logrus.WithError(err).WithField("condition_id", updatedCondition.ID).Error("failed to send condition updated websocket event")
	// }

	auditRec.Success()
	auditRec.AddEventResultState(updatedCondition)

	return updatedCondition, nil
}

// DeletePlaybookCondition soft-deletes a stored condition for a playbook
func (s *conditionService) DeletePlaybookCondition(userID, playbookID, conditionID string, teamID string) error {
	auditRec := s.auditor.MakeAuditRecord("deleteCondition", model.AuditStatusFail)
	defer s.auditor.LogAuditRec(auditRec)

	model.AddEventParameterToAuditRec(auditRec, "userID", userID)
	model.AddEventParameterToAuditRec(auditRec, "teamID", teamID)
	model.AddEventParameterToAuditRec(auditRec, "playbookID", playbookID)
	model.AddEventParameterToAuditRec(auditRec, "conditionID", conditionID)

	existing, err := s.store.GetCondition(playbookID, conditionID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	model.AddEventParameterAuditableToAuditRec(auditRec, "condition", existing)

	if existing.RunID != "" {
		err := errors.New("cannot delete conditions associated with a run - run conditions are read-only")
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	err = s.store.DeleteCondition(playbookID, conditionID)
	if err != nil {
		auditRec.AddErrorDesc(err.Error())
		return err
	}

	// Websocket events disabled until we implement proper user targeting to avoid leaking condition info
	// if err := s.sendConditionDeletedWS(existing, teamID); err != nil {
	// 	// Log but don't fail the operation for websocket errors
	// 	logrus.WithError(err).WithField("condition_id", existing.ID).Error("failed to send condition deleted websocket event")
	// }

	auditRec.Success()

	return nil
}

// GetPlaybookConditions retrieves stored conditions for a playbook
func (s *conditionService) GetPlaybookConditions(userID, playbookID string, page, perPage int) (*GetConditionsResults, error) {
	fetchConditions := func() ([]Condition, error) {
		return s.store.GetPlaybookConditions(playbookID, page, perPage)
	}

	fetchCount := func() (int, error) {
		return s.store.GetPlaybookConditionCount(playbookID)
	}

	return s.getConditions(fetchConditions, fetchCount, page, perPage)
}

// GetRunConditions retrieves stored conditions for a run
func (s *conditionService) GetRunConditions(userID, playbookID, runID string, page, perPage int) (*GetConditionsResults, error) {
	fetchConditions := func() ([]Condition, error) {
		return s.store.GetRunConditions(playbookID, runID, page, perPage)
	}

	fetchCount := func() (int, error) {
		return s.store.GetRunConditionCount(playbookID, runID)
	}

	return s.getConditions(fetchConditions, fetchCount, page, perPage)
}

// getConditions is a private helper that handles common pagination logic
func (s *conditionService) getConditions(
	fetchConditions func() ([]Condition, error),
	fetchCount func() (int, error),
	page, perPage int,
) (*GetConditionsResults, error) {
	conditions, err := fetchConditions()
	if err != nil {
		return nil, err
	}

	totalCount, err := fetchCount()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get total condition count")
	}

	// Calculate pagination info
	pageCount := (totalCount + perPage - 1) / perPage
	if pageCount == 0 {
		pageCount = 1
	}

	hasMore := (page+1)*perPage < totalCount

	return &GetConditionsResults{
		TotalCount: totalCount,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      conditions,
	}, nil
}

type conditionEvalResult struct {
	Met    bool
	Reason string
}

// applyConditionResults updates checklist items based on evaluated condition results
func (s *conditionService) applyConditionResults(
	playbookRun *PlaybookRun,
	conditionResults map[string]conditionEvalResult,
) *ConditionEvaluationResult {
	result := &ConditionEvaluationResult{
		ChecklistChanges: make(map[string]*ChecklistConditionChanges),
	}

	for c := range playbookRun.Checklists {
		checklist := &playbookRun.Checklists[c]

		for i := range checklist.Items {
			item := &checklist.Items[i]

			// Skip items without conditions
			if item.ConditionID == "" {
				continue
			}

			res, ok := conditionResults[item.ConditionID]
			if !ok {
				continue
			}

			// Initialize checklist changes if not exists
			if result.ChecklistChanges[checklist.Title] == nil {
				result.ChecklistChanges[checklist.Title] = &ChecklistConditionChanges{
					Added:      0,
					Hidden:     0,
					hasChanges: false,
				}
			}

			item.ConditionReason = res.Reason

			currentConditionAction := item.ConditionAction
			if res.Met {
				item.ConditionAction = ConditionActionNone
				if currentConditionAction == ConditionActionHidden {
					result.ChecklistChanges[checklist.Title].Added++
				}
			} else {
				// Check if item was recently modified (assignee or state change)
				wasRecentlyModified := (item.AssigneeModified > 0 || item.StateModified > 0)

				if wasRecentlyModified {
					item.ConditionReason = i18n.T("playbooks.checklist.condition.reason.modified")
					item.ConditionAction = ConditionActionShownBecauseModified
				} else {
					item.ConditionAction = ConditionActionHidden
					if currentConditionAction != ConditionActionHidden {
						result.ChecklistChanges[checklist.Title].Hidden++
					}
				}
			}

			if currentConditionAction != item.ConditionAction {
				result.ChecklistChanges[checklist.Title].hasChanges = true
				now := model.GetMillis()
				item.UpdateAt = now
				checklist.UpdateAt = now
			}
		}
	}

	return result
}

func (s *conditionService) evaluateConditions(playbookRun *PlaybookRun, conditions []Condition) map[string]conditionEvalResult {
	conditionResults := make(map[string]conditionEvalResult, len(conditions))
	for _, condition := range conditions {
		conditionResults[condition.ID] = conditionEvalResult{
			Met:    condition.ConditionExpr.Evaluate(playbookRun.PropertyFields, playbookRun.PropertyValues),
			Reason: condition.ConditionExpr.ToString(playbookRun.PropertyFields),
		}
	}
	return conditionResults
}

func (s *conditionService) EvaluateConditionsOnValueChanged(playbookRun *PlaybookRun, changedFieldID string) (*ConditionEvaluationResult, error) {
	conditions, err := s.store.GetConditionsByRunAndFieldID(playbookRun.ID, changedFieldID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get conditions for playbook run")
	}

	if len(conditions) == 0 {
		return &ConditionEvaluationResult{
			ChecklistChanges: make(map[string]*ChecklistConditionChanges),
		}, nil
	}

	conditionResults := s.evaluateConditions(playbookRun, conditions)
	return s.applyConditionResults(playbookRun, conditionResults), nil
}

func (s *conditionService) EvaluateAllConditionsForRun(playbookRun *PlaybookRun) (*ConditionEvaluationResult, error) {
	if playbookRun.PlaybookID == "" {
		return &ConditionEvaluationResult{
			ChecklistChanges: make(map[string]*ChecklistConditionChanges),
		}, nil
	}

	conditions, err := s.store.GetRunConditions(playbookRun.PlaybookID, playbookRun.ID, 0, MaxConditionsPerPlaybook)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get conditions for playbook run")
	}

	if len(conditions) == 0 {
		return &ConditionEvaluationResult{
			ChecklistChanges: make(map[string]*ChecklistConditionChanges),
		}, nil
	}

	conditionResults := s.evaluateConditions(playbookRun, conditions)
	return s.applyConditionResults(playbookRun, conditionResults), nil
}

// Websocket helper functions disabled until we implement proper user targeting
// func (s *conditionService) sendConditionCreatedWS(condition *Condition, teamID string) error {
// 	s.poster.PublishWebsocketEventToTeam(conditionCreatedWSEvent, condition, teamID)
// 	return nil
// }
//
// func (s *conditionService) sendConditionUpdatedWS(condition *Condition, teamID string) error {
// 	s.poster.PublishWebsocketEventToTeam(conditionUpdatedWSEvent, condition, teamID)
// 	return nil
// }
//
// func (s *conditionService) sendConditionDeletedWS(condition *Condition, teamID string) error {
// 	s.poster.PublishWebsocketEventToTeam(conditionDeletedWSEvent, condition, teamID)
// 	return nil
// }
