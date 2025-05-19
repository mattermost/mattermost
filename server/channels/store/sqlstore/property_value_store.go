// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPropertyValueStore struct {
	*SqlStore

	tableSelectQuery sq.SelectBuilder
}

func newPropertyValueStore(sqlStore *SqlStore) store.PropertyValueStore {
	s := SqlPropertyValueStore{SqlStore: sqlStore}

	s.tableSelectQuery = s.getQueryBuilder().
		Select("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt").
		From("PropertyValues")

	return &s
}

func (s *SqlPropertyValueStore) Create(value *model.PropertyValue) (*model.PropertyValue, error) {
	if value.ID != "" {
		return nil, store.NewErrInvalidInput("PropertyValue", "id", value.ID)
	}

	value.PreSave()

	if err := value.IsValid(); err != nil {
		return nil, errors.Wrap(err, "property_value_create_isvalid")
	}

	valueJSON := value.Value
	if s.IsBinaryParamEnabled() {
		valueJSON = AppendBinaryFlag(valueJSON)
	}

	builder := s.getQueryBuilder().
		Insert("PropertyValues").
		Columns("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt").
		Values(value.ID, value.TargetID, value.TargetType, value.GroupID, value.FieldID, valueJSON, value.CreateAt, value.UpdateAt, value.DeleteAt)
	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "property_value_create_insert")
	}

	return value, nil
}

func (s *SqlPropertyValueStore) Get(groupID, id string) (*model.PropertyValue, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": id})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	var value model.PropertyValue
	if err := s.GetReplica().GetBuilder(&value, builder); err != nil {
		return nil, errors.Wrap(err, "property_value_get_select")
	}

	return &value, nil
}

func (s *SqlPropertyValueStore) GetMany(groupID string, ids []string) ([]*model.PropertyValue, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": ids})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	var values []*model.PropertyValue
	if err := s.GetReplica().SelectBuilder(&values, builder); err != nil {
		return nil, errors.Wrap(err, "property_value_get_many_query")
	}

	if len(values) < len(ids) {
		return nil, fmt.Errorf("missmatch results: got %d results of the %d ids passed", len(values), len(ids))
	}

	return values, nil
}

func (s *SqlPropertyValueStore) SearchPropertyValues(opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	if err := opts.Cursor.IsValid(); err != nil {
		return nil, fmt.Errorf("cursor is invalid: %w", err)
	}

	if opts.PerPage < 1 {
		return nil, errors.New("per page must be positive integer greater than zero")
	}

	builder := s.tableSelectQuery.
		OrderBy("CreateAt ASC, Id ASC").
		Limit(uint64(opts.PerPage))

	if !opts.Cursor.IsEmpty() {
		builder = builder.Where(sq.Or{
			sq.Gt{"CreateAt": opts.Cursor.CreateAt},
			sq.And{
				sq.Eq{"CreateAt": opts.Cursor.CreateAt},
				sq.Gt{"Id": opts.Cursor.PropertyValueID},
			},
		})
	}

	if !opts.IncludeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	if opts.GroupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": opts.GroupID})
	}

	if opts.TargetType != "" {
		builder = builder.Where(sq.Eq{"TargetType": opts.TargetType})
	}

	if opts.TargetID != "" {
		builder = builder.Where(sq.Eq{"TargetID": opts.TargetID})
	}

	if opts.FieldID != "" {
		builder = builder.Where(sq.Eq{"FieldID": opts.FieldID})
	}

	var values []*model.PropertyValue
	if err := s.GetReplica().SelectBuilder(&values, builder); err != nil {
		return nil, errors.Wrap(err, "property_value_search_query")
	}

	return values, nil
}

func (s *SqlPropertyValueStore) Update(groupID string, values []*model.PropertyValue) (_ []*model.PropertyValue, err error) {
	if len(values) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_update_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updateTime := model.GetMillis()
	isPostgres := s.DriverName() == model.DatabaseDriverPostgres
	valueCase := sq.Case("id")
	deleteAtCase := sq.Case("id")
	ids := make([]string, len(values))

	for i, value := range values {
		value.UpdateAt = updateTime
		if vErr := value.IsValid(); vErr != nil {
			return nil, errors.Wrap(vErr, "property_value_update_isvalid")
		}

		ids[i] = value.ID
		valueJSON := value.Value
		if s.IsBinaryParamEnabled() {
			valueJSON = AppendBinaryFlag(valueJSON)
		}

		if isPostgres {
			valueCase = valueCase.When(sq.Expr("?", value.ID), sq.Expr("?::jsonb", valueJSON))
			deleteAtCase = deleteAtCase.When(sq.Expr("?", value.ID), sq.Expr("?::bigint", value.DeleteAt))
		} else {
			valueCase = valueCase.When(sq.Expr("?", value.ID), sq.Expr("?", valueJSON))
			deleteAtCase = deleteAtCase.When(sq.Expr("?", value.ID), sq.Expr("?", value.DeleteAt))
		}
	}

	builder := s.getQueryBuilder().
		Update("PropertyValues").
		Set("Value", valueCase).
		Set("DeleteAt", deleteAtCase).
		Set("UpdateAt", updateTime).
		Where(sq.Eq{"id": ids})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	result, err := transaction.ExecBuilder(builder)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_update_exec")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_update_rowsaffected")
	}
	if count != int64(len(values)) {
		return nil, errors.Errorf("failed to update, some property values were not found, got %d of %d", count, len(values))
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_value_update_commit_transaction")
	}

	return values, nil
}

func (s *SqlPropertyValueStore) Upsert(values []*model.PropertyValue) (_ []*model.PropertyValue, err error) {
	if len(values) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_upsert_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updatedValues := make([]*model.PropertyValue, len(values))
	updateTime := model.GetMillis()
	for i, value := range values {
		value.PreSave()
		value.UpdateAt = updateTime

		if err := value.IsValid(); err != nil {
			return nil, errors.Wrap(err, "property_value_upsert_isvalid")
		}

		valueJSON := value.Value
		if s.IsBinaryParamEnabled() {
			valueJSON = AppendBinaryFlag(valueJSON)
		}

		builder := s.getQueryBuilder().
			Insert("PropertyValues").
			Columns("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt").
			Values(value.ID, value.TargetID, value.TargetType, value.GroupID, value.FieldID, valueJSON, value.CreateAt, value.UpdateAt, value.DeleteAt)

		if s.DriverName() == model.DatabaseDriverMysql {
			builder = builder.SuffixExpr(sq.Expr(
				"ON DUPLICATE KEY UPDATE Value = ?, UpdateAt = ?, DeleteAt = ?",
				valueJSON,
				value.UpdateAt,
				0,
			))

			if _, err := transaction.ExecBuilder(builder); err != nil {
				return nil, errors.Wrap(err, "property_value_upsert_exec")
			}

			// MySQL doesn't support RETURNING, so we need to fetch
			// the new field to get its ID in case we hit a DUPLICATED
			// KEY and the value.ID we have is not the right one
			gBuilder := s.tableSelectQuery.Where(sq.Eq{
				"GroupID":  value.GroupID,
				"TargetID": value.TargetID,
				"FieldID":  value.FieldID,
				"DeleteAt": 0,
			})

			var values []*model.PropertyValue
			if gErr := transaction.SelectBuilder(&values, gBuilder); gErr != nil {
				return nil, errors.Wrap(gErr, "property_value_upsert_select")
			}

			if len(values) != 1 {
				return nil, errors.New("property_value_upsert_select_length")
			}

			updatedValues[i] = values[0]
		} else {
			builder = builder.SuffixExpr(sq.Expr(
				"ON CONFLICT (GroupID, TargetID, FieldID) WHERE DeleteAt = 0 DO UPDATE SET Value = ?, UpdateAt = ?, DeleteAt = ? RETURNING *",
				valueJSON,
				value.UpdateAt,
				0,
			))

			var values []*model.PropertyValue
			if err := transaction.SelectBuilder(&values, builder); err != nil {
				return nil, errors.Wrapf(err, "failed to upsert property value with id: %s", value.ID)
			}

			if len(values) != 1 {
				return nil, errors.New("property_value_upsert_select_length")
			}

			updatedValues[i] = values[0]
		}
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_value_upsert_commit")
	}

	return updatedValues, nil
}

func (s *SqlPropertyValueStore) Delete(groupID string, id string) error {
	builder := s.getQueryBuilder().
		Update("PropertyValues").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"id": id})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	result, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return errors.Wrapf(err, "failed to delete property value with id: %s", id)
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "property_value_delete_rowsaffected")
	}
	if count == 0 {
		return store.NewErrNotFound("PropertyValue", id)
	}

	return nil
}

func (s *SqlPropertyValueStore) DeleteForField(fieldID string) error {
	builder := s.getQueryBuilder().
		Update("PropertyValues").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"FieldID": fieldID})

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_value_delete_for_field_exec")
	}

	return nil
}

func (s *SqlPropertyValueStore) DeleteForTarget(groupID string, targetType string, targetID string) error {
	if targetType == "" || targetID == "" {
		return store.NewErrInvalidInput("PropertyValue", "target", "type or id empty")
	}

	builder := s.getQueryBuilder().
		Delete("PropertyValues").
		Where(sq.Eq{
			"TargetType": targetType,
			"TargetID":   targetID,
		})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_value_delete_for_target_exec")
	}

	return nil
}
