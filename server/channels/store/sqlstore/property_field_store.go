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

	builder := s.getQueryBuilder().
		Insert("PropertyFields").
		Columns("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "CreateAt", "UpdateAt", "DeleteAt").
		Values(field.ID, field.GroupID, field.Name, field.Type, field.Attrs, field.TargetID, field.TargetType, field.CreateAt, field.UpdateAt, field.DeleteAt)

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "property_field_create_insert")
	}

	return field, nil
}

func (s *SqlPropertyFieldStore) Get(groupID, id string) (*model.PropertyField, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": id})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	var field model.PropertyField
	if err := s.GetReplica().GetBuilder(&field, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_select")
	}

	return &field, nil
}

func (s *SqlPropertyFieldStore) GetFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	builder := s.tableSelectQuery.
		Where(sq.Eq{"GroupID": groupID}).
		Where(sq.Eq{"TargetID": targetID}).
		Where(sq.Eq{"Name": name}).
		Where(sq.Eq{"DeleteAt": 0})

	var field model.PropertyField
	if err := s.GetReplica().GetBuilder(&field, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_by_name_select")
	}

	return &field, nil
}

func (s *SqlPropertyFieldStore) GetMany(groupID string, ids []string) ([]*model.PropertyField, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": ids})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	fields := []*model.PropertyField{}
	if err := s.GetReplica().SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_many_query")
	}

	if len(fields) < len(ids) {
		return nil, fmt.Errorf("missmatch results: got %d results of the %d ids passed", len(fields), len(ids))
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) CountForGroup(groupID string, includeDeleted bool) (int64, error) {
	var count int64
	builder := s.getQueryBuilder().
		Select("COUNT(id)").
		From("PropertyFields").
		Where(sq.Eq{"GroupID": groupID})

	if !includeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	if err := s.GetReplica().GetBuilder(&count, builder); err != nil {
		return int64(0), errors.Wrap(err, "failed to count Sessions")
	}
	return count, nil
}

func (s *SqlPropertyFieldStore) SearchPropertyFields(opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
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
				sq.Gt{"Id": opts.Cursor.PropertyFieldID},
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

	fields := []*model.PropertyField{}
	if err := s.GetReplica().SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_search_query")
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) Update(groupID string, fields []*model.PropertyField) (_ []*model.PropertyField, err error) {
	if len(fields) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_update_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updateTime := model.GetMillis()
	isPostgres := s.DriverName() == model.DatabaseDriverPostgres
	nameCase := sq.Case("id")
	typeCase := sq.Case("id")
	attrsCase := sq.Case("id")
	targetIDCase := sq.Case("id")
	targetTypeCase := sq.Case("id")
	deleteAtCase := sq.Case("id")
	ids := make([]string, len(fields))

	for i, field := range fields {
		field.UpdateAt = updateTime
		if vErr := field.IsValid(); vErr != nil {
			return nil, errors.Wrap(vErr, "property_field_update_isvalid")
		}

		ids[i] = field.ID
		whenID := sq.Expr("?", field.ID)
		if isPostgres {
			nameCase = nameCase.When(whenID, sq.Expr("?::text", field.Name))
			typeCase = typeCase.When(whenID, sq.Expr("?::property_field_type", field.Type))
			attrsCase = attrsCase.When(whenID, sq.Expr("?::jsonb", field.Attrs))
			targetIDCase = targetIDCase.When(whenID, sq.Expr("?::text", field.TargetID))
			targetTypeCase = targetTypeCase.When(whenID, sq.Expr("?::text", field.TargetType))
			deleteAtCase = deleteAtCase.When(whenID, sq.Expr("?::bigint", field.DeleteAt))
		} else {
			nameCase = nameCase.When(whenID, sq.Expr("?", field.Name))
			typeCase = typeCase.When(whenID, sq.Expr("?", field.Type))
			attrsCase = attrsCase.When(whenID, sq.Expr("?", field.Attrs))
			targetIDCase = targetIDCase.When(whenID, sq.Expr("?", field.TargetID))
			targetTypeCase = targetTypeCase.When(whenID, sq.Expr("?", field.TargetType))
			deleteAtCase = deleteAtCase.When(whenID, sq.Expr("?", field.DeleteAt))
		}
	}

	builder := s.getQueryBuilder().
		Update("PropertyFields").
		Set("Name", nameCase).
		Set("Type", typeCase).
		Set("Attrs", attrsCase).
		Set("TargetID", targetIDCase).
		Set("TargetType", targetTypeCase).
		Set("UpdateAt", updateTime).
		Set("DeleteAt", deleteAtCase).
		Where(sq.Eq{"id": ids})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	result, err := transaction.ExecBuilder(builder)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_update_exec")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_update_rowsaffected")
	}
	if count != int64(len(fields)) {
		return nil, errors.Errorf("failed to update, some property fields were not found, got %d of %d", count, len(fields))
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_field_update_commit_transaction")
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) Delete(groupID string, id string) error {
	builder := s.getQueryBuilder().
		Update("PropertyFields").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"id": id})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

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
