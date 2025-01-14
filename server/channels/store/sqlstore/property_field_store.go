// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (s *SqlPropertyFieldStore) propertyFieldToInsertMap(field *model.PropertyField) (map[string]any, error) {
	if field.Attrs == nil {
		field.Attrs = make(map[string]any)
	}

	attrsJSON, err := json.Marshal(field.Attrs)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_to_insert_map_marshal_attrs")
	}
	if s.IsBinaryParamEnabled() {
		attrsJSON = AppendBinaryFlag(attrsJSON)
	}

	return map[string]any{
		"ID":         field.ID,
		"GroupID":    field.GroupID,
		"Name":       field.Name,
		"Type":       field.Type,
		"Attrs":      attrsJSON,
		"TargetID":   field.TargetID,
		"TargetType": field.TargetType,
		"CreateAt":   field.CreateAt,
		"UpdateAt":   field.UpdateAt,
		"DeleteAt":   field.DeleteAt,
	}, nil
}

func (s *SqlPropertyFieldStore) propertyFieldToUpdateMap(field *model.PropertyField) (map[string]any, error) {
	if field.Attrs == nil {
		field.Attrs = make(map[string]any)
	}

	attrsJSON, err := json.Marshal(field.Attrs)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_to_update_map_marshal_attrs")
	}
	if s.IsBinaryParamEnabled() {
		attrsJSON = AppendBinaryFlag(attrsJSON)
	}

	return map[string]any{
		"Name":       field.Name,
		"Type":       field.Type,
		"Attrs":      attrsJSON,
		"TargetID":   field.TargetID,
		"TargetType": field.TargetType,
		"UpdateAt":   field.UpdateAt,
		"DeleteAt":   field.DeleteAt,
	}, nil
}

func propertyFieldsFromRows(rows *sql.Rows) ([]*model.PropertyField, error) {
	results := []*model.PropertyField{}

	for rows.Next() {
		var field model.PropertyField
		var attrsJSON string

		err := rows.Scan(
			&field.ID,
			&field.GroupID,
			&field.Name,
			&field.Type,
			&attrsJSON,
			&field.TargetID,
			&field.TargetType,
			&field.CreateAt,
			&field.UpdateAt,
			&field.DeleteAt,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(attrsJSON), &field.Attrs); err != nil {
			return nil, errors.Wrap(err, "property_fields_from_rows_unmarshal_attrs")
		}

		results = append(results, &field)
	}

	return results, nil
}

func propertyFieldFromRows(rows *sql.Rows) (*model.PropertyField, error) {
	fields, err := propertyFieldsFromRows(rows)
	if err != nil {
		return nil, err
	}

	if len(fields) > 0 {
		return fields[0], nil
	}

	return nil, sql.ErrNoRows
}

type SqlPropertyFieldStore struct {
	*SqlStore

	tableSelectQuery sq.SelectBuilder
}

func newPropertyFieldStore(sqlStore *SqlStore) store.PropertyFieldStore {
	s := SqlPropertyFieldStore{SqlStore: sqlStore}

	s.tableSelectQuery = s.getQueryBuilder().
		Select("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "CreateAt", "UpdateAt", "DeleteAt").
		From("PropertyFields")

	return &s
}

func (s *SqlPropertyFieldStore) Create(field *model.PropertyField) (*model.PropertyField, error) {
	if field.ID != "" {
		return nil, store.NewErrInvalidInput("PropertyField", "id", field.ID)
	}

	field.PreSave()

	if err := field.IsValid(); err != nil {
		return nil, errors.Wrap(err, "property_field_create_isvalid")
	}

	insertMap, err := s.propertyFieldToInsertMap(field)
	if err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().
		Insert("PropertyFields").
		SetMap(insertMap)

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "property_field_create_insert")
	}

	return field, nil
}

func (s *SqlPropertyFieldStore) Get(id string) (*model.PropertyField, error) {
	queryString, args, err := s.tableSelectQuery.
		Where(sq.Eq{"id": id}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_get_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_get_select")
	}
	defer rows.Close()

	field, err := propertyFieldFromRows(rows)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_get_propertyfieldfromrows")
	}

	return field, nil
}

func (s *SqlPropertyFieldStore) GetMany(ids []string) ([]*model.PropertyField, error) {
	queryString, args, err := s.tableSelectQuery.
		Where(sq.Eq{"id": ids}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_get_many_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_get_many_query")
	}
	defer rows.Close()

	fields, err := propertyFieldsFromRows(rows)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_get_many_propertyfieldfromrows")
	}

	if len(fields) < len(ids) {
		return nil, fmt.Errorf("missmatch results: got %d results of the %d ids passed", len(fields), len(ids))
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) SearchPropertyFields(opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	if opts.Page < 0 {
		return nil, errors.New("page must be positive integer")
	}

	if opts.PerPage < 1 {
		return nil, errors.New("per page must be positive integer greater than zero")
	}

	query := s.tableSelectQuery.
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

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_search_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_search_query")
	}
	defer rows.Close()

	fields, err := propertyFieldsFromRows(rows)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_search_propertyfieldfromrows")
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) Update(fields []*model.PropertyField) (_ []*model.PropertyField, err error) {
	if len(fields) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_update_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updateTime := model.GetMillis()
	for _, field := range fields {
		field.UpdateAt = updateTime

		if vErr := field.IsValid(); vErr != nil {
			return nil, errors.Wrap(vErr, "property_field_update_isvalid")
		}

		updateMap, err := s.propertyFieldToUpdateMap(field)
		if err != nil {
			return nil, err
		}

		queryString, args, err := s.getQueryBuilder().
			Update("PropertyFields").
			SetMap(updateMap).
			Where(sq.Eq{"id": field.ID}).
			ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "property_field_update_tosql")
		}

		result, err := transaction.Exec(queryString, args...)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to update property field with id: %s", field.ID)
		}

		count, err := result.RowsAffected()
		if err != nil {
			return nil, errors.Wrap(err, "property_field_update_rowsaffected")
		}
		if count == 0 {
			return nil, store.NewErrNotFound("PropertyField", field.ID)
		}
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_field_update_commit")
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) Delete(id string) error {
	builder := s.getQueryBuilder().
		Update("PropertyFields").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"id": id})

	result, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return errors.Wrapf(err, "failed to delete property field with id: %s", id)
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "property_field_delete_rowsaffected")
	}
	if count == 0 {
		return store.NewErrNotFound("PropertyField", id)
	}

	return nil
}
