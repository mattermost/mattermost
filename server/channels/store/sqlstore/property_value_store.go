// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/lib/pq"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// uniqueValueIndex allows one live value per field and target.
const uniqueValueIndex = "idx_propertyvalues_unique"

// wrapCreateError reports a second live value for one field and target as a
// conflict, not a driver error, so a lost race is an answer and not a 500.
func wrapCreateError(err error, msg string) error {
	if IsUniqueConstraintError(err, []string{uniqueValueIndex}) {
		return store.NewErrConflict("PropertyValue", err, "a live value already exists for this field and target")
	}
	return errors.Wrap(err, msg)
}

// expectedValueArg encodes a value the way the Value column is written.
func (s *SqlPropertyValueStore) expectedValueArg(expected json.RawMessage) []byte {
	if s.IsBinaryParamEnabled() {
		return AppendBinaryFlag(expected)
	}
	return expected
}

type SqlPropertyValueStore struct {
	*SqlStore

	tableSelectQuery sq.SelectBuilder
}

func newPropertyValueStore(sqlStore *SqlStore) store.PropertyValueStore {
	s := SqlPropertyValueStore{SqlStore: sqlStore}

	s.tableSelectQuery = s.getQueryBuilder().
		Select("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt", "COALESCE(CreatedBy, '') as CreatedBy", "COALESCE(UpdatedBy, '') as UpdatedBy").
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
		Columns("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt", "CreatedBy", "UpdatedBy").
		Values(value.ID, value.TargetID, value.TargetType, value.GroupID, value.FieldID, valueJSON, value.CreateAt, value.UpdateAt, value.DeleteAt, value.CreatedBy, value.UpdatedBy)
	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return nil, wrapCreateError(err, "property_value_create_insert")
	}

	return value, nil
}

func (s *SqlPropertyValueStore) CreateMany(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_create_many_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	for _, value := range values {
		value.PreSave()

		if err := value.IsValid(); err != nil {
			return nil, errors.Wrap(err, "property_value_create_many_isvalid")
		}

		valueJSON := value.Value
		if s.IsBinaryParamEnabled() {
			valueJSON = AppendBinaryFlag(valueJSON)
		}

		builder := s.getQueryBuilder().
			Insert("PropertyValues").
			Columns("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt", "CreatedBy", "UpdatedBy").
			Values(value.ID, value.TargetID, value.TargetType, value.GroupID, value.FieldID, valueJSON, value.CreateAt, value.UpdateAt, value.DeleteAt, value.CreatedBy, value.UpdatedBy)

		if _, err := transaction.ExecBuilder(builder); err != nil {
			return nil, wrapCreateError(err, "property_value_create_many_exec")
		}
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_value_create_many_commit_transaction")
	}

	return values, nil
}

func (s *SqlPropertyValueStore) Get(groupID, id string) (*model.PropertyValue, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": id})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	var value model.PropertyValue
	if err := s.GetReplica().GetBuilder(&value, builder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("PropertyValue", id)
		}
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
		return nil, store.NewErrResultsMismatch(len(values), len(ids))
	}

	return values, nil
}

func (s *SqlPropertyValueStore) SearchPropertyValues(rctx request.CTX, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	if err := opts.IsValid(); err != nil {
		return nil, fmt.Errorf("opts is invalid: %w", err)
	}

	if opts.PerPage < 1 {
		return nil, errors.New("per page must be positive integer greater than zero")
	}

	deltaMode := opts.SinceUpdateAt > 0

	builder := s.tableSelectQuery.Limit(uint64(opts.PerPage))
	if deltaMode {
		builder = builder.OrderBy("UpdateAt ASC, Id ASC")
	} else {
		builder = builder.OrderBy("CreateAt ASC, Id ASC")
	}

	if !opts.Cursor.IsEmpty() {
		if deltaMode {
			builder = builder.Where(sq.Or{
				sq.Gt{"UpdateAt": opts.Cursor.UpdateAt},
				sq.And{
					sq.Eq{"UpdateAt": opts.Cursor.UpdateAt},
					sq.Gt{"Id": opts.Cursor.PropertyValueID},
				},
			})
		} else {
			builder = builder.Where(sq.Or{
				sq.Gt{"CreateAt": opts.Cursor.CreateAt},
				sq.And{
					sq.Eq{"CreateAt": opts.Cursor.CreateAt},
					sq.Gt{"Id": opts.Cursor.PropertyValueID},
				},
			})
		}
	}

	if !deltaMode && !opts.IncludeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	if opts.GroupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": opts.GroupID})
	}

	if len(opts.IDs) > 0 {
		builder = builder.Where(sq.Eq{"Id": opts.IDs})
	}

	if opts.TargetType != "" {
		builder = builder.Where(sq.Eq{"TargetType": opts.TargetType})
	}

	if len(opts.TargetIDs) > 0 {
		builder = builder.Where(sq.Eq{"TargetID": opts.TargetIDs})
	}

	if opts.FieldID != "" {
		builder = builder.Where(sq.Eq{"FieldID": opts.FieldID})
	}

	if deltaMode {
		// Inclusive boundary so rows updated at exactly `since` are
		// returned on the first page. The cursor clause above then
		// disambiguates same-millisecond rows by Id across pages.
		builder = builder.Where(sq.GtOrEq{"UpdateAt": opts.SinceUpdateAt})
	}

	if opts.Value != nil {
		builder = builder.Where(sq.Eq{"Value": string(opts.Value)})
	}

	var values []*model.PropertyValue
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&values, builder); err != nil {
		return nil, errors.Wrap(err, "property_value_search_query")
	}

	return values, nil
}

func (s *SqlPropertyValueStore) Update(groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return s.update(groupID, values, nil)
}

func (s *SqlPropertyValueStore) UpdateIfUnchanged(groupID string, values []*model.PropertyValue, read map[store.PropertyValueKey]json.RawMessage) ([]*model.PropertyValue, error) {
	return s.update(groupID, values, read)
}

func (s *SqlPropertyValueStore) update(groupID string, values []*model.PropertyValue, read map[store.PropertyValueKey]json.RawMessage) (_ []*model.PropertyValue, err error) {
	if len(values) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_update_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updateTime := model.GetMillis()
	valueCase := sq.Case("id")
	deleteAtCase := sq.Case("id")
	updatedByCase := sq.Case("id")
	ids := make([]string, len(values))
	var conditions []sq.Sqlizer

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

		valueCase = valueCase.When(sq.Expr("?", value.ID), sq.Expr("?::jsonb", valueJSON))
		deleteAtCase = deleteAtCase.When(sq.Expr("?", value.ID), sq.Expr("?::bigint", value.DeleteAt))
		updatedByCase = updatedByCase.When(sq.Expr("?", value.ID), sq.Expr("?::text", value.UpdatedBy))

		// Only the named row is held to its condition: the others are free.
		if expected, ok := read[store.PropertyValueKey{FieldID: value.FieldID, TargetID: value.TargetID}]; ok {
			if len(expected) == 0 {
				conditions = append(conditions, sq.Expr("(id <> ? OR DeleteAt <> 0)", value.ID))
			} else {
				conditions = append(conditions, sq.Expr("(id <> ? OR (DeleteAt = 0 AND Value = ?::jsonb))", value.ID, s.expectedValueArg(expected)))
			}
		}
	}

	builder := s.getQueryBuilder().
		Update("PropertyValues").
		Set("Value", valueCase).
		Set("DeleteAt", deleteAtCase).
		Set("UpdateAt", updateTime).
		Set("UpdatedBy", updatedByCase).
		Where(sq.Eq{"id": ids})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	for _, condition := range conditions {
		builder = builder.Where(condition)
	}

	result, err := transaction.ExecBuilder(builder)
	if err != nil {
		if len(conditions) > 0 {
			return nil, wrapCreateError(err, "property_value_update_exec")
		}
		return nil, errors.Wrap(err, "property_value_update_exec")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_update_rowsaffected")
	}
	if count != int64(len(values)) {
		if len(conditions) > 0 {
			return nil, store.NewErrConflict("PropertyValue", nil, "concurrent modification detected; retry the update")
		}
		return nil, errors.Errorf("failed to update, some property values were not found, got %d of %d", count, len(values))
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_value_update_commit_transaction")
	}

	return values, nil
}

func (s *SqlPropertyValueStore) Upsert(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return s.upsert(values, nil)
}

func (s *SqlPropertyValueStore) UpsertIfUnchanged(values []*model.PropertyValue, read map[store.PropertyValueKey]json.RawMessage) ([]*model.PropertyValue, error) {
	return s.upsert(values, read)
}

func (s *SqlPropertyValueStore) upsert(values []*model.PropertyValue, read map[store.PropertyValueKey]json.RawMessage) (_ []*model.PropertyValue, err error) {
	if len(values) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "property_value_upsert_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updatedValues := make([]*model.PropertyValue, len(values))
	updateTime := model.GetMillis()
	for i, value := range values {
		// Pin CreateAt to updateTime so PreSave does not capture a later
		// GetMillis() — keeping CreateAt == UpdateAt on insert.
		if value.CreateAt == 0 {
			value.CreateAt = updateTime
		}
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
			Columns("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt", "CreatedBy", "UpdatedBy").
			Values(value.ID, value.TargetID, value.TargetType, value.GroupID, value.FieldID, valueJSON, value.CreateAt, value.UpdateAt, value.DeleteAt, value.CreatedBy, value.UpdatedBy)

		// Guard on the live row, not UpdateAt: the check depends on the value,
		// and UpdateAt is a clock taken on whichever node wrote.
		conflictGuard := ""
		guardArgs := []any{}
		expected, conditional := read[store.PropertyValueKey{FieldID: value.FieldID, TargetID: value.TargetID}]
		if conditional {
			if len(expected) == 0 {
				conflictGuard = " WHERE false"
			} else {
				conflictGuard = " WHERE PropertyValues.Value = ?::jsonb"
				guardArgs = append(guardArgs, s.expectedValueArg(expected))
			}
		}

		args := append([]any{valueJSON, value.UpdateAt, 0, value.UpdatedBy}, guardArgs...)
		builder = builder.SuffixExpr(sq.Expr(
			"ON CONFLICT (GroupID, TargetID, FieldID) WHERE DeleteAt = 0 DO UPDATE SET Value = ?, UpdateAt = ?, DeleteAt = ?, UpdatedBy = ?"+conflictGuard+" RETURNING ID, TargetID, TargetType, GroupID, FieldID, Value, CreateAt, UpdateAt, DeleteAt, COALESCE(CreatedBy, '') as CreatedBy, COALESCE(UpdatedBy, '') as UpdatedBy",
			args...,
		))

		var values []*model.PropertyValue
		if err := transaction.SelectBuilder(&values, builder); err != nil {
			return nil, errors.Wrapf(err, "failed to upsert property value with id: %s", value.ID)
		}

		// The guard failed: the live row is not what the caller read.
		if conditional && len(values) == 0 {
			return nil, store.NewErrConflict("PropertyValue", nil, "concurrent modification detected; retry the write")
		}

		if len(values) != 1 {
			return nil, errors.New("property_value_upsert_select_length")
		}

		updatedValues[i] = values[0]
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

func (s *SqlPropertyValueStore) DeleteForField(groupID, fieldID string) error {
	builder := s.getQueryBuilder().
		Update("PropertyValues").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"FieldID": fieldID})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_value_delete_for_field_exec")
	}

	return nil
}

func (s *SqlPropertyValueStore) GetReferencedOptionIDs(groupID string, fieldIDs []string) ([]string, error) {
	if len(fieldIDs) == 0 || slices.Contains(fieldIDs, "") {
		return nil, store.NewErrInvalidInput("PropertyValue", "fieldIDs", fieldIDs)
	}

	// A select value is a JSON string and a multiselect value a JSON string
	// array; both are normalized to an array so one expansion covers them.
	// Anything else (null, objects) expands to nothing.
	builder := s.getQueryBuilder().
		Select("DISTINCT opt").
		From("PropertyValues pv").
		CrossJoin(`LATERAL jsonb_array_elements_text(
			CASE jsonb_typeof(pv.Value)
				WHEN 'array' THEN pv.Value
				WHEN 'string' THEN jsonb_build_array(pv.Value)
				ELSE '[]'::jsonb
			END
		) AS opt`).
		Where(sq.Eq{"pv.FieldID": fieldIDs, "pv.DeleteAt": 0}).
		Where("opt <> ''").
		OrderBy("opt")

	if groupID != "" {
		builder = builder.Where(sq.Eq{"pv.GroupID": groupID})
	}

	// Read from master: the caller decides whether to remove an option based
	// on this, so a lagging replica must not hide a value that was just written.
	ids := []string{}
	if err := s.GetMaster().SelectBuilder(&ids, builder); err != nil {
		return nil, errors.Wrap(err, "property_value_get_referenced_option_ids_select")
	}

	return ids, nil
}

// nonEmptyValueSQL is true for a value that is not empty: the same set
// model.IsEmptyPropertyValue treats as empty (null, "" and []) is excluded.
const nonEmptyValueSQL = `(%[1]s.Value IS NOT NULL AND jsonb_typeof(%[1]s.Value) <> 'null' AND %[1]s.Value NOT IN ('""'::jsonb, '[]'::jsonb))`

func (s *SqlPropertyValueStore) CountValuesOutsideOptions(groupID, fieldID string, optionIDs []string, scope *store.PostValueScope, examples int) (int64, []string, error) {
	if fieldID == "" {
		return 0, nil, store.NewErrInvalidInput("PropertyValue", "fieldID", fieldID)
	}
	if examples < 0 {
		return 0, nil, store.NewErrInvalidInput("PropertyValue", "examples", examples)
	}
	if scope != nil && scope.ChannelValue != "" && scope.ChannelFieldID == "" {
		return 0, nil, store.NewErrInvalidInput("PropertyValue", "scope", "channel value without a channel field")
	}

	// A nil slice would reach the database as NULL, and ANY/ALL over NULL
	// matches nothing.
	allowed := pq.Array(append([]string{}, optionIDs...))

	// A string value is outside the set when its text is not listed; an array
	// when one element is not (a null element is not listed either); anything
	// else that is not empty, such as a number or an object, names no option.
	outside := sq.Expr(`CASE jsonb_typeof(pv.Value)
		WHEN 'string' THEN NOT ((pv.Value #>> '{}') = ANY(?::text[]))
		WHEN 'array' THEN EXISTS (
			SELECT 1 FROM jsonb_array_elements_text(pv.Value) AS elem
			WHERE elem IS NULL OR elem <> ALL(?::text[])
		)
		ELSE TRUE
	END`, allowed, allowed)

	build := func(columns string) sq.SelectBuilder {
		builder := s.getQueryBuilder().
			Select(columns).
			From("PropertyValues pv").
			Where(sq.Eq{"pv.FieldID": fieldID, "pv.DeleteAt": 0}).
			Where(fmt.Sprintf(nonEmptyValueSQL, "pv")).
			Where(outside)

		if groupID != "" {
			builder = builder.Where(sq.Eq{"pv.GroupID": groupID})
		}

		if scope != nil {
			builder = builder.
				InnerJoin("Posts p ON p.Id = pv.TargetID AND p.DeleteAt = 0")
			if scope.ChannelID != "" {
				builder = builder.Where(sq.Eq{"p.ChannelId": scope.ChannelID})
			}
			if scope.ChannelFieldID != "" {
				holds := "SELECT 1 FROM PropertyValues cv WHERE cv.GroupID = pv.GroupID AND cv.TargetID = p.ChannelId AND cv.FieldID = ? AND cv.DeleteAt = 0 AND "
				if scope.ChannelValue != "" {
					builder = builder.Where("EXISTS ("+holds+"cv.Value = to_jsonb(?::text))", scope.ChannelFieldID, scope.ChannelValue)
				} else {
					builder = builder.Where("NOT EXISTS ("+holds+fmt.Sprintf(nonEmptyValueSQL, "cv")+")", scope.ChannelFieldID)
				}
			}
		}

		return builder
	}

	// Read from master: the caller decides whether to refuse a change based on
	// this, so a lagging replica must not hide a value that was just written.
	var count int64
	if err := s.GetMaster().GetBuilder(&count, build("COUNT(*)")); err != nil {
		return 0, nil, errors.Wrap(err, "property_value_count_values_outside_options_count")
	}

	targets := []string{}
	if count == 0 || examples == 0 {
		return count, targets, nil
	}

	if err := s.GetMaster().SelectBuilder(&targets, build("pv.TargetID").OrderBy("pv.TargetID").Limit(uint64(examples))); err != nil {
		return 0, nil, errors.Wrap(err, "property_value_count_values_outside_options_examples")
	}

	return count, targets, nil
}

func (s *SqlPropertyValueStore) DeleteForTarget(groupID string, targetType string, targetID string) error {
	return s.deleteForTarget(groupID, targetType, targetID, nil)
}

func (s *SqlPropertyValueStore) DeleteForTargetExceptFields(groupID, targetType, targetID string, keepFieldIDs []string) error {
	return s.deleteForTarget(groupID, targetType, targetID, keepFieldIDs)
}

func (s *SqlPropertyValueStore) deleteForTarget(groupID, targetType, targetID string, keepFieldIDs []string) error {
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

	if len(keepFieldIDs) > 0 {
		builder = builder.Where(sq.NotEq{"FieldID": keepFieldIDs})
	}

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_value_delete_for_target_exec")
	}

	return nil
}
