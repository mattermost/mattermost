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

func (s *SqlPropertyValueStore) Get(id string) (*model.PropertyValue, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": id})

	var value model.PropertyValue
	if err := s.GetReplica().GetBuilder(&value, builder); err != nil {
		return nil, errors.Wrap(err, "property_value_get_select")
	}

	return &value, nil
}

func (s *SqlPropertyValueStore) GetMany(ids []string) ([]*model.PropertyValue, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": ids})

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
	if opts.Page < 0 {
		return nil, errors.New("page must be positive integer")
	}

	if opts.PerPage < 1 {
		return nil, errors.New("per page must be positive integer greater than zero")
	}

	builder := s.tableSelectQuery.
		OrderBy("CreateAt ASC").
		Offset(uint64(opts.Page * opts.PerPage)).
		Limit(uint64(opts.PerPage))

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

func (s *SqlPropertyValueStore) Update(values []*model.PropertyValue) (_ []*model.PropertyValue, err error) {
	if len(values) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_update_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updateTime := model.GetMillis()
	for _, value := range values {
		value.UpdateAt = updateTime

		if err := value.IsValid(); err != nil {
			return nil, errors.Wrap(err, "property_value_update_isvalid")
		}

		valueJSON := value.Value
		if s.IsBinaryParamEnabled() {
			valueJSON = AppendBinaryFlag(valueJSON)
		}

		queryString, args, err := s.getQueryBuilder().
			Update("PropertyValues").
			Set("Value", valueJSON).
			Set("UpdateAt", value.UpdateAt).
			Set("DeleteAt", value.DeleteAt).
			Where(sq.Eq{"id": value.ID}).
			ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "property_value_update_tosql")
		}

		result, err := transaction.Exec(queryString, args...)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to update property value with id: %s", value.ID)
		}

		count, err := result.RowsAffected()
		if err != nil {
			return nil, errors.Wrap(err, "property_value_update_rowsaffected")
		}
		if count == 0 {
			return nil, store.NewErrNotFound("PropertyValue", value.ID)
		}
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_value_update_commit")
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

func (s *SqlPropertyValueStore) Delete(id string) error {
	builder := s.getQueryBuilder().
		Update("PropertyValues").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"id": id})

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
