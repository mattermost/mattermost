// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type conditionForDB struct {
	ID                 string
	PlaybookID         string
	RunID              string
	Version            int
	CreateAt           int64
	UpdateAt           int64
	DeleteAt           int64
	ConditionExpr      string
	PropertyFieldIDs   string
	PropertyOptionsIDs string
}

// conditionStore is a sql store for conditions. Use NewConditionStore to create it.
type conditionStore struct {
	pluginAPI       PluginAPIClient
	store           *SQLStore
	queryBuilder    sq.StatementBuilderType
	conditionSelect sq.SelectBuilder
}

// Ensure conditionStore implements the app.ConditionStore interface.
var _ app.ConditionStore = (*conditionStore)(nil)

// NewConditionStore creates a new store for condition service.
func NewConditionStore(pluginAPI PluginAPIClient, sqlStore *SQLStore) app.ConditionStore {
	conditionSelect := sqlStore.builder.
		Select(
			"ID",
			"ConditionExpr",
			"PlaybookID",
			"RunID",
			"Version",
			"PropertyFieldIDs",
			"PropertyOptionsIDs",
			"CreateAt",
			"UpdateAt",
			"DeleteAt",
		).
		From("IR_Condition").
		Where(sq.Eq{"DeleteAt": 0})

	newStore := &conditionStore{
		pluginAPI:       pluginAPI,
		store:           sqlStore,
		queryBuilder:    sqlStore.builder,
		conditionSelect: conditionSelect,
	}
	return newStore
}

// CreateCondition creates a new stored condition
func (c *conditionStore) CreateCondition(playbookID string, condition app.Condition) (*app.Condition, error) {
	if condition.ID == "" {
		condition.ID = model.NewId()
	}

	// Set timestamps if not provided
	now := model.GetMillis()
	if condition.CreateAt == 0 {
		condition.CreateAt = now
	}
	if condition.UpdateAt == 0 {
		condition.UpdateAt = now
	}

	// Ensure condition belongs to the specified playbook
	condition.PlaybookID = playbookID

	// Convert to database representation
	dbCondition, err := c.toConditionForDB(condition)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert condition for database")
	}

	_, err = c.store.execBuilder(c.store.db, c.queryBuilder.
		Insert("IR_Condition").
		SetMap(map[string]any{
			"ID":                 dbCondition.ID,
			"ConditionExpr":      dbCondition.ConditionExpr,
			"PlaybookID":         dbCondition.PlaybookID,
			"RunID":              dbCondition.RunID,
			"Version":            dbCondition.Version,
			"PropertyFieldIDs":   dbCondition.PropertyFieldIDs,
			"PropertyOptionsIDs": dbCondition.PropertyOptionsIDs,
			"CreateAt":           dbCondition.CreateAt,
			"UpdateAt":           dbCondition.UpdateAt,
			"DeleteAt":           dbCondition.DeleteAt,
		}))

	if err != nil {
		return nil, errors.Wrap(err, "failed to store condition")
	}

	return &condition, nil
}

// GetCondition retrieves a stored condition by ID
func (c *conditionStore) GetCondition(playbookID, conditionID string) (*app.Condition, error) {
	var sqlCondition conditionForDB

	err := c.store.getBuilder(c.store.db, &sqlCondition, c.conditionSelect.
		Where(sq.Eq{
			"ID":         conditionID,
			"PlaybookID": playbookID,
		}))

	if err == sql.ErrNoRows {
		return nil, errors.New("condition not found")
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to get condition")
	}

	condition, err := c.fromConditionForDB(sqlCondition)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert condition from database")
	}

	return &condition, nil
}

// UpdateCondition updates an existing stored condition
func (c *conditionStore) UpdateCondition(playbookID string, condition app.Condition) (*app.Condition, error) {
	// Set UpdateAt if not provided
	if condition.UpdateAt == 0 {
		condition.UpdateAt = model.GetMillis()
	}

	// Convert to database representation
	dbCondition, err := c.toConditionForDB(condition)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert condition for database")
	}

	_, err = c.store.execBuilder(c.store.db, c.queryBuilder.
		Update("IR_Condition").
		SetMap(map[string]any{
			"ConditionExpr":      dbCondition.ConditionExpr,
			"RunID":              dbCondition.RunID,
			"Version":            dbCondition.Version,
			"PropertyFieldIDs":   dbCondition.PropertyFieldIDs,
			"PropertyOptionsIDs": dbCondition.PropertyOptionsIDs,
			"UpdateAt":           dbCondition.UpdateAt,
		}).
		Where(sq.Eq{
			"ID":         dbCondition.ID,
			"PlaybookID": playbookID,
			"DeleteAt":   0,
		}))

	if err != nil {
		return nil, errors.Wrap(err, "failed to update condition")
	}

	return &condition, nil
}

// DeleteCondition soft-deletes a stored condition
func (c *conditionStore) DeleteCondition(playbookID, conditionID string) error {
	_, err := c.store.execBuilder(c.store.db, c.queryBuilder.
		Update("IR_Condition").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{
			"ID":         conditionID,
			"PlaybookID": playbookID,
			"DeleteAt":   0,
		}))

	if err != nil {
		return errors.Wrap(err, "failed to delete condition")
	}

	return nil
}

func (c *conditionStore) fromConditionForDB(sqlCondition conditionForDB) (app.Condition, error) {
	// Convert from JSON to appropriate version
	var conditionExpr app.ConditionExpression

	switch sqlCondition.Version {
	case 1:
		var expr app.ConditionExprV1
		if err := json.Unmarshal([]byte(sqlCondition.ConditionExpr), &expr); err != nil {
			return app.Condition{}, errors.Wrap(err, "failed to unmarshal condition expression")
		}
		conditionExpr = &expr
	default:
		return app.Condition{}, errors.Errorf("unsupported condition version: %d", sqlCondition.Version)
	}

	return app.Condition{
		ID:            sqlCondition.ID,
		ConditionExpr: conditionExpr,
		Version:       sqlCondition.Version,
		PlaybookID:    sqlCondition.PlaybookID,
		RunID:         sqlCondition.RunID,
		CreateAt:      sqlCondition.CreateAt,
		UpdateAt:      sqlCondition.UpdateAt,
		DeleteAt:      sqlCondition.DeleteAt,
	}, nil
}

// toConditionForDB converts an app.Condition to conditionForDB for database operations
func (c *conditionStore) toConditionForDB(condition app.Condition) (conditionForDB, error) {
	// Extract metadata for storage using the versioned expression
	propertyFieldIDs, propertyOptionsIDs := condition.ConditionExpr.ExtractPropertyIDs()

	// Marshal the condition expression to JSON for storage
	conditionExprJSON, err := json.Marshal(condition.ConditionExpr)
	if err != nil {
		return conditionForDB{}, errors.Wrap(err, "failed to marshal condition expression")
	}

	propertyFieldIDsJSON, err := json.Marshal(propertyFieldIDs)
	if err != nil {
		return conditionForDB{}, errors.Wrap(err, "failed to marshal property field IDs")
	}

	propertyOptionsIDsJSON, err := json.Marshal(propertyOptionsIDs)
	if err != nil {
		return conditionForDB{}, errors.Wrap(err, "failed to marshal property options IDs")
	}

	return conditionForDB{
		ID:                 condition.ID,
		PlaybookID:         condition.PlaybookID,
		RunID:              condition.RunID,
		Version:            condition.Version,
		CreateAt:           condition.CreateAt,
		UpdateAt:           condition.UpdateAt,
		DeleteAt:           condition.DeleteAt,
		ConditionExpr:      string(conditionExprJSON),
		PropertyFieldIDs:   string(propertyFieldIDsJSON),
		PropertyOptionsIDs: string(propertyOptionsIDsJSON),
	}, nil
}

// GetPlaybookConditions returns conditions for a playbook with pagination
func (c *conditionStore) GetPlaybookConditions(playbookID string, page, perPage int) ([]app.Condition, error) {
	return c.getConditionsWithFilter(playbookID, "", page, perPage)
}

// GetRunConditions returns conditions for a specific run with pagination
func (c *conditionStore) GetRunConditions(playbookID, runID string, page, perPage int) ([]app.Condition, error) {
	return c.getConditionsWithFilter(playbookID, runID, page, perPage)
}

// getConditionsWithFilter is a private helper method for getting conditions
func (c *conditionStore) getConditionsWithFilter(playbookID, runID string, page, perPage int) ([]app.Condition, error) {
	query := c.conditionSelect.
		Where(sq.Eq{"PlaybookID": playbookID}).
		Where(sq.Eq{"DeleteAt": 0})

	if runID != "" {
		query = query.Where(sq.Eq{"RunID": runID})
	} else {
		// For playbook conditions, explicitly filter for empty RunID
		query = query.Where(sq.Eq{"RunID": ""})
	}

	// Add pagination
	if perPage > 0 {
		query = query.Limit(uint64(perPage))
		if page > 0 {
			query = query.Offset(uint64(page * perPage))
		}
	}

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build condition query for playbook %s runID %s", playbookID, runID)
	}

	var sqlConditions []conditionForDB
	if err := c.store.db.Select(&sqlConditions, sqlQuery, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get conditions for playbook %s runID %s", playbookID, runID)
	}

	conditions := make([]app.Condition, 0, len(sqlConditions))
	for _, sqlCondition := range sqlConditions {
		condition, err := c.fromConditionForDB(sqlCondition)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to convert condition from DB for playbook %s", playbookID)
		}
		conditions = append(conditions, condition)
	}

	return conditions, nil
}

// GetPlaybookConditionCount returns the number of non-deleted conditions for a playbook
func (c *conditionStore) GetPlaybookConditionCount(playbookID string) (int, error) {
	return c.getConditionCount(playbookID, "")
}

// GetRunConditionCount returns the number of non-deleted conditions for a specific run
func (c *conditionStore) GetRunConditionCount(playbookID, runID string) (int, error) {
	return c.getConditionCount(playbookID, runID)
}

// getConditionCount is a private helper method for counting conditions
func (c *conditionStore) getConditionCount(playbookID, runID string) (int, error) {
	query := c.queryBuilder.
		Select("COUNT(*)").
		From("IR_Condition").
		Where(sq.Eq{"PlaybookID": playbookID}).
		Where(sq.Eq{"DeleteAt": 0})

	if runID != "" {
		query = query.Where(sq.Eq{"RunID": runID})
	} else {
		// For playbook conditions, explicitly filter for empty RunID
		query = query.Where(sq.Eq{"RunID": ""})
	}

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrapf(err, "failed to build condition count query for playbook %s runID %s", playbookID, runID)
	}

	var count int
	if err := c.store.db.Get(&count, sqlQuery, args...); err != nil {
		return 0, errors.Wrapf(err, "failed to get condition count for playbook %s runID %s", playbookID, runID)
	}

	return count, nil
}

func (c *conditionStore) CountConditionsUsingPropertyField(playbookID, propertyFieldID string) (int, error) {
	propertyFieldIDJSON, err := json.Marshal([]string{propertyFieldID})
	if err != nil {
		return 0, errors.Wrapf(err, "failed to marshal property field ID %s", propertyFieldID)
	}

	query := c.queryBuilder.
		Select("COUNT(*)").
		From("IR_Condition").
		Where(sq.Eq{"PlaybookID": playbookID}).
		Where(sq.Eq{"RunID": ""}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Expr("PropertyFieldIDs @> ?::jsonb", string(propertyFieldIDJSON)))

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrapf(err, "failed to build count query for property field %s in playbook %s", propertyFieldID, playbookID)
	}

	var count int
	if err := c.store.db.Get(&count, sqlQuery, args...); err != nil {
		return 0, errors.Wrapf(err, "failed to count conditions using property field %s in playbook %s", propertyFieldID, playbookID)
	}

	return count, nil
}

func (c *conditionStore) CountConditionsUsingPropertyOptions(playbookID string, propertyOptionIDs []string) (map[string]int, error) {
	if len(propertyOptionIDs) == 0 {
		return make(map[string]int), nil
	}

	placeholders := sq.Placeholders(len(propertyOptionIDs))
	args := make([]any, len(propertyOptionIDs))
	for i, optionID := range propertyOptionIDs {
		args[i] = optionID
	}

	query := c.queryBuilder.
		Select("PropertyOptionsIDs").
		From("IR_Condition").
		Where(sq.Eq{"PlaybookID": playbookID}).
		Where(sq.Eq{"RunID": ""}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Expr("PropertyOptionsIDs ??| ARRAY["+placeholders+"]", args...))

	sqlQuery, sqlArgs, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query for conditions in playbook %s", playbookID)
	}

	var propertyOptionsIDsList []json.RawMessage
	if err := c.store.db.Select(&propertyOptionsIDsList, sqlQuery, sqlArgs...); err != nil {
		return nil, errors.Wrapf(err, "failed to get conditions for playbook %s", playbookID)
	}

	result := make(map[string]int)
	optionIDSet := make(map[string]bool)
	for _, optionID := range propertyOptionIDs {
		optionIDSet[optionID] = true
	}

	for _, propertyOptionsIDsBytes := range propertyOptionsIDsList {
		if len(propertyOptionsIDsBytes) == 0 {
			continue
		}

		var optionIDs []string
		if err := json.Unmarshal(propertyOptionsIDsBytes, &optionIDs); err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"playbook_id": playbookID,
				"raw_data":    string(propertyOptionsIDsBytes),
			}).Warn("failed to unmarshal PropertyOptionsIDs from condition, skipping")
			continue
		}

		for _, optionID := range optionIDs {
			if optionIDSet[optionID] {
				result[optionID]++
			}
		}
	}

	return result, nil
}

// GetConditionsByRunAndFieldID retrieves all conditions for a given run and field ID
func (c *conditionStore) GetConditionsByRunAndFieldID(runID, fieldID string) ([]app.Condition, error) {
	fieldIDArray, err := json.Marshal([]string{fieldID})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal fieldID array for runID %s fieldID %s", runID, fieldID)
	}

	query := c.conditionSelect.
		Where(sq.Eq{"RunID": runID}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where("PropertyFieldIDs @> ?", string(fieldIDArray))

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build condition query for runID %s fieldID %s", runID, fieldID)
	}

	var sqlConditions []conditionForDB
	if err := c.store.db.Select(&sqlConditions, sqlQuery, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get conditions for runID %s fieldID %s", runID, fieldID)
	}

	conditions := make([]app.Condition, 0, len(sqlConditions))
	for _, sqlCondition := range sqlConditions {
		condition, err := c.fromConditionForDB(sqlCondition)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to convert condition from DB for runID %s", runID)
		}
		conditions = append(conditions, condition)
	}

	return conditions, nil
}
