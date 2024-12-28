// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var propertyValueColumns = []string{
	"ID",
	"TargetID",
	"TargetType",
	"GroupID",
	"FieldID",
	"Value",
	"CreateAt",
	"UpdateAt",
	"DeleteAt",
}

func propertyValueToInsertMap(value *model.PropertyValue) (map[string]any, error) {
	valueJSON, err := json.Marshal(value.Value)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_to_insert_map_marshal_value")
	}

	// todo: investigate/handle string(attrsJSON) similar to
	// https://github.com/mattermost/mattermost/pull/19898
	return map[string]any{
		"ID":         value.ID,
		"TargetID":   value.TargetID,
		"TargetType": value.TargetType,
		"GroupID":    value.GroupID,
		"FieldID":    value.FieldID,
		"Value":      string(valueJSON),
		"CreateAt":   value.CreateAt,
		"UpdateAt":   value.UpdateAt,
		"DeleteAt":   value.DeleteAt,
	}, nil
}

func propertyValueToUpdateMap(value *model.PropertyValue) (map[string]any, error) {
	valueJSON, err := json.Marshal(value.Value)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_to_udpate_map_marshal_value")
	}

	return map[string]any{
		"Value":    string(valueJSON),
		"UpdateAt": value.UpdateAt,
		"DeleteAt": value.DeleteAt,
	}, nil
}

func propertyValuesFromRows(rows *sql.Rows) ([]*model.PropertyValue, error) {
	results := []*model.PropertyValue{}

	for rows.Next() {
		var value model.PropertyValue
		var valueJSON string

		err := rows.Scan(
			&value.ID,
			&value.TargetID,
			&value.TargetType,
			&value.GroupID,
			&value.FieldID,
			&valueJSON,
			&value.CreateAt,
			&value.UpdateAt,
			&value.DeleteAt,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(valueJSON), &value.Value); err != nil {
			return nil, errors.Wrap(err, "property_values_from_rows_unmarshal_value")
		}

		results = append(results, &value)
	}

	return results, nil
}

func propertyValueFromRows(rows *sql.Rows) (*model.PropertyValue, error) {
	values, err := propertyValuesFromRows(rows)
	if err != nil {
		return nil, err
	}

	if len(values) > 0 {
		return values[0], nil
	}

	return nil, sql.ErrNoRows
}

type SqlPropertyValueStore struct {
	*SqlStore
}

func newPropertyValueStore(sqlStore *SqlStore) store.PropertyValueStore {
	return &SqlPropertyValueStore{sqlStore}
}

func (s *SqlPropertyValueStore) Create(value *model.PropertyValue) (*model.PropertyValue, error) {
	if value.ID != "" {
		return nil, store.NewErrInvalidInput("PropertyValue", "id", value.ID)
	}

	value.PreSave()

	if err := value.IsValid(); err != nil {
		return nil, errors.Wrap(err, "property_value_create_isvalid")
	}

	insertMap, err := propertyValueToInsertMap(value)
	if err != nil {
		return nil, err
	}

	queryString, args, err := s.getQueryBuilder().
		Insert("PropertyValues").
		SetMap(insertMap).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_create_tosql")
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return nil, errors.Wrap(err, "property_value_create_insert")
	}

	return value, nil
}

func (s *SqlPropertyValueStore) Get(id string) (*model.PropertyValue, error) {
	queryString, args, err := s.getQueryBuilder().
		Select(propertyValueColumns...).
		From("PropertyValues").
		Where(sq.Eq{"id": id}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_get_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_get_select")
	}
	defer rows.Close()

	value, err := propertyValueFromRows(rows)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_get_propertyvaluefromrows")
	}

	return value, nil
}

func (s *SqlPropertyValueStore) GetMany(ids []string) ([]*model.PropertyValue, error) {
	queryString, args, err := s.getQueryBuilder().
		Select(propertyValueColumns...).
		From("PropertyValues").
		Where(sq.Eq{"id": ids}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_get_many_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_get_many_query")
	}
	defer rows.Close()

	values, err := propertyValuesFromRows(rows)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_get_many_propertyvaluesfromrows")
	}

	if len(values) < len(ids) {
		return nil, errors.New("property_value_get_many_missmatch_results")
	}

	return values, nil
}

func (s *SqlPropertyValueStore) SearchPropertyValues(opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	if opts.Page < 0 {
		return nil, errors.New("page must be positive integer")
	}

	if opts.PerPage < 0 {
		return nil, errors.New("per page must be positive integer")
	}

	query := s.getQueryBuilder().
		Select(propertyValueColumns...).
		From("PropertyValues").
		OrderBy("CreateAt ASC").
		Offset(uint64(opts.Page * opts.PerPage)).
		Limit(uint64(opts.PerPage))

	if !opts.IncludeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	if opts.GroupID != "" {
		query = query.Where(sq.Eq{"GroupID": opts.GroupID})
	}

	if opts.TargetType != "" {
		query = query.Where(sq.Eq{"TargetType": opts.TargetType})
	}

	if opts.TargetID != "" {
		query = query.Where(sq.Eq{"TargetID": opts.TargetID})
	}

	if opts.FieldID != "" {
		query = query.Where(sq.Eq{"FieldID": opts.FieldID})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_search_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_search_query")
	}
	defer rows.Close()

	values, err := propertyValuesFromRows(rows)
	if err != nil {
		return nil, errors.Wrap(err, "property_value_search_propertyvaluesfromrows")
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

		updateMap, err := propertyValueToUpdateMap(value)
		if err != nil {
			return nil, err
		}

		queryString, args, err := s.getQueryBuilder().
			Update("PropertyValues").
			SetMap(updateMap).
			Where(sq.Eq{"id": value.ID}).
			ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "property_value_update_tosql")
		}

		result, err := transaction.Exec(queryString, args...)
		if err != nil {
			return nil, errors.Wrap(err, "property_value_update_exec")
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

func (s *SqlPropertyValueStore) Delete(id string) error {
	queryString, args, err := s.getQueryBuilder().
		Update("PropertyValues").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "property_value_delete_tosql")
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return errors.Wrap(err, "property_value_delete_exec")
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
	queryString, args, err := s.getQueryBuilder().
		Update("PropertyValues").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"FieldID": fieldID}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "property_value_delete_for_field_tosql")
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "property_value_delete_for_field_exec")
	}

	return nil
}
