// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/lib/pq"
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
		Select("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "ObjectType", "Protected", "PermissionField", "PermissionValues", "PermissionOptions", "LinkedFieldID", "CreateAt", "UpdateAt", "DeleteAt", "COALESCE(CreatedBy, '') as CreatedBy", "COALESCE(UpdatedBy, '') as UpdatedBy", "Permissions").
		From("PropertyFields")

	return &s
}

func (s *SqlPropertyFieldStore) Create(field *model.PropertyField) (*model.PropertyField, error) {
	if field.ID != "" {
		return nil, store.NewErrInvalidInput("PropertyField", "id", field.ID)
	}

	field.PreSave()
	if err := field.EnsureOptionIDs(); err != nil {
		return nil, errors.Wrap(err, "property_field_create_ensure_option_ids")
	}

	if err := field.IsValid(); err != nil {
		return nil, errors.Wrap(err, "property_field_create_isvalid")
	}

	if field.Permissions != nil && field.Permissions.Masking != nil && field.Permissions.Masking.MaskByFieldID != "" {
		if err := s.ValidateMaskByFieldID(context.Background(), field.GroupID, field.ID, field.Permissions.Masking.MaskByFieldID); err != nil {
			return nil, errors.Wrap(err, "property_field_create_validate_mask_by_field_id")
		}
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_create_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	builder := s.getQueryBuilder().
		Insert("PropertyFields").
		Columns("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "ObjectType", "Protected", "PermissionField", "PermissionValues", "PermissionOptions", "LinkedFieldID", "CreateAt", "UpdateAt", "DeleteAt", "CreatedBy", "UpdatedBy", "Permissions").
		Values(field.ID, field.GroupID, field.Name, field.Type, storedFieldAttrs(field), field.TargetID, field.TargetType, field.ObjectType, field.Protected, field.PermissionField, field.PermissionValues, field.PermissionOptions, field.LinkedFieldID, field.CreateAt, field.UpdateAt, field.DeleteAt, field.CreatedBy, field.UpdatedBy, storedFieldPermissions(field))

	if _, err = transaction.ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "property_field_create_insert")
	}

	// The field's options become rows of their own. A field linking to a
	// template is created holding a copy of that template's option list, and
	// those options stay owned by the template.
	if _, err = s.syncPropertyFieldOptions(transaction, []*model.PropertyField{field}, field.CreateAt); err != nil {
		return nil, errors.Wrap(err, "property_field_create_options")
	}

	if err = s.syncPropertyFieldGrants(transaction, field.ID, field.Permissions, field.CreateAt); err != nil {
		return nil, errors.Wrap(err, "property_field_create_grants")
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_field_create_commit_transaction")
	}

	return field, nil
}

func (s *SqlPropertyFieldStore) Get(ctx context.Context, groupID, id string) (*model.PropertyField, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": id})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	db := s.DBXFromContext(ctx)

	var field model.PropertyField
	if err := db.GetBuilder(&field, builder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("PropertyField", id)
		}
		return nil, errors.Wrap(err, "property_field_get_select")
	}

	if err := s.hydratePropertyFieldOptions(db, []*model.PropertyField{&field}); err != nil {
		return nil, errors.Wrap(err, "property_field_get_hydrate_options")
	}

	return &field, nil
}

// ValidateMaskByFieldID enforces the store-dependent half of a masking
// field's mask_by_field_id: the named field must exist, be live, be
// object_type:user, and be linked back to fieldID. The shape-only half
// (template-only, must resolve holdings somewhere) is checked without a
// store by Masking.isValid.
func (s *SqlPropertyFieldStore) ValidateMaskByFieldID(ctx context.Context, groupID, fieldID, maskByFieldID string) error {
	target, err := s.Get(store.WithMaster(ctx), groupID, maskByFieldID)
	if err != nil {
		var notFound *store.ErrNotFound
		if errors.As(err, &notFound) {
			return fmt.Errorf("mask_by_field_id references non-existent field %s", maskByFieldID)
		}
		return errors.Wrap(err, "property_field_validate_mask_by_field_id_get")
	}

	if target.DeleteAt != 0 {
		return fmt.Errorf("mask_by_field_id references a deleted field")
	}

	if target.ObjectType != model.PropertyFieldObjectTypeUser {
		return fmt.Errorf("mask_by_field_id must reference an object_type:user field")
	}

	if target.LinkedFieldID == nil || *target.LinkedFieldID != fieldID {
		return fmt.Errorf("mask_by_field_id references a field not linked to this template")
	}

	return nil
}

// GetFieldByName retrieves a single property field by group, target, and name,
// matching any object type.
//
// Deprecated: a (groupID, targetID, name) tuple is not unique when fields of
// different object types share a name within a group, in which case this
// returns an arbitrary match (the query has no ORDER BY/LIMIT). Use
// GetFieldByNameForObjectType for a deterministic result. Retained because it
// is exposed on the (stable) plugin API.
func (s *SqlPropertyFieldStore) GetFieldByName(ctx context.Context, groupID, targetID, name string) (*model.PropertyField, error) {
	return s.getFieldByName(ctx, s.fieldByNameQuery(groupID, targetID, name), name)
}

// GetFieldByNameForObjectType retrieves a single property field by group,
// target, object type, and name. objectType is matched exactly — including the
// empty string, which is itself a valid object type, not a match-any wildcard —
// so together with the typed unique index the result is deterministic.
func (s *SqlPropertyFieldStore) GetFieldByNameForObjectType(ctx context.Context, groupID, targetID, objectType, name string) (*model.PropertyField, error) {
	builder := s.fieldByNameQuery(groupID, targetID, name).Where(sq.Eq{"ObjectType": objectType})
	return s.getFieldByName(ctx, builder, name)
}

func (s *SqlPropertyFieldStore) fieldByNameQuery(groupID, targetID, name string) sq.SelectBuilder {
	return s.tableSelectQuery.
		Where(sq.Eq{"GroupID": groupID}).
		Where(sq.Eq{"TargetID": targetID}).
		Where(sq.Eq{"Name": name}).
		Where(sq.Eq{"DeleteAt": 0})
}

func (s *SqlPropertyFieldStore) getFieldByName(ctx context.Context, builder sq.SelectBuilder, name string) (*model.PropertyField, error) {
	db := s.DBXFromContext(ctx)

	var field model.PropertyField
	if err := db.GetBuilder(&field, builder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("PropertyField", name)
		}
		return nil, errors.Wrap(err, "property_field_get_by_name_select")
	}

	if err := s.hydratePropertyFieldOptions(db, []*model.PropertyField{&field}); err != nil {
		return nil, errors.Wrap(err, "property_field_get_by_name_hydrate_options")
	}

	return &field, nil
}

func (s *SqlPropertyFieldStore) GetMany(ctx context.Context, groupID string, ids []string) ([]*model.PropertyField, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": ids})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	db := s.DBXFromContext(ctx)

	fields := []*model.PropertyField{}
	if err := db.SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_many_query")
	}

	if len(fields) < len(ids) {
		return nil, store.NewErrResultsMismatch(len(fields), len(ids))
	}

	if err := s.hydratePropertyFieldOptions(db, fields); err != nil {
		return nil, errors.Wrap(err, "property_field_get_many_hydrate_options")
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

func (s *SqlPropertyFieldStore) CountForGroupObjectType(groupID, objectType string, includeDeleted bool) (int64, error) {
	var count int64
	builder := s.getQueryBuilder().
		Select("COUNT(id)").
		From("PropertyFields").
		Where(sq.Eq{"GroupID": groupID}).
		Where(sq.Eq{"ObjectType": objectType})

	if !includeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	if err := s.GetReplica().GetBuilder(&count, builder); err != nil {
		return int64(0), errors.Wrap(err, "failed to count property fields for group and object type")
	}
	return count, nil
}

func (s *SqlPropertyFieldStore) CountForTarget(groupID, targetType, targetID string, includeDeleted bool) (int64, error) {
	var count int64
	builder := s.getQueryBuilder().
		Select("COUNT(id)").
		From("PropertyFields").
		Where(sq.Eq{"GroupID": groupID}).
		Where(sq.Eq{"TargetType": targetType}).
		Where(sq.Eq{"TargetID": targetID})

	if !includeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	if err := s.GetReplica().GetBuilder(&count, builder); err != nil {
		return int64(0), errors.Wrap(err, "failed to count property fields for target")
	}
	return count, nil
}

func (s *SqlPropertyFieldStore) GetForGroup(ctx context.Context, groupID string) ([]*model.PropertyField, error) {
	builder := s.tableSelectQuery.
		Where(sq.Eq{"GroupID": groupID}).
		Where(sq.Eq{"DeleteAt": 0})

	db := s.DBXFromContext(ctx)

	fields := []*model.PropertyField{}
	if err := db.SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_for_group_query")
	}

	if err := s.hydratePropertyFieldOptions(db, fields); err != nil {
		return nil, errors.Wrap(err, "property_field_get_for_group_hydrate_options")
	}

	return fields, nil
}

// SearchPropertyFields runs the PSAv2 field listing query.
//
// The store operates in two modes determined by opts.SinceUpdateAt:
//
//   - Delta mode (SinceUpdateAt > 0): orders by UpdateAt ASC, Id ASC; paginates
//     with the (UpdateAt, Id) cursor key; auto-includes soft-deleted rows. The
//     DeleteAt filter is NOT applied in this mode.
//   - Directory mode (SinceUpdateAt <= 0): orders by CreateAt ASC, Id ASC;
//     paginates with the (CreateAt, Id) cursor key; honors opts.IncludeDeleted.
//
// The scope filter has two mutually exclusive shapes, enforced by
// opts.IsValid(): either we search through the hierarchy (channel or team and up,
// if ChannelID or TeamID are set) or we filter on a single target using
// TargetType/TargetIDs.
func (s *SqlPropertyFieldStore) SearchPropertyFields(opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
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
					sq.Gt{"Id": opts.Cursor.PropertyFieldID},
				},
			})
		} else {
			builder = builder.Where(sq.Or{
				sq.Gt{"CreateAt": opts.Cursor.CreateAt},
				sq.And{
					sq.Eq{"CreateAt": opts.Cursor.CreateAt},
					sq.Gt{"Id": opts.Cursor.PropertyFieldID},
				},
			})
		}
	}

	// Delta mode auto-includes tombstones; directory mode keeps the explicit
	// IncludeDeleted opt-in.
	if !deltaMode && !opts.IncludeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	if opts.GroupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": opts.GroupID})
	}

	// Prefer ObjectTypes (renders as IN); fall back to the deprecated
	// single-value ObjectType for backwards compatibility.
	if len(opts.ObjectTypes) > 0 {
		builder = builder.Where(sq.Eq{"ObjectType": opts.ObjectTypes})
	} else if opts.ObjectType != "" {
		builder = builder.Where(sq.Eq{"ObjectType": opts.ObjectType})
	}

	// Four mutually exclusive scopes (enforced by opts.IsValid()):
	//   - Channel + team: OR{system, team=TeamID, channel=ChannelID}
	//   - Channel only (DM/GM, no team): OR{system, channel=ChannelID}
	//   - Team-only: OR{system, team=TeamID}
	//   - Single target: WHERE TargetType = ? and/or TargetID IN (?) — either
	//     filter may be applied independently for backwards compatibility.
	switch {
	case opts.ChannelID != "" && opts.TeamID != "":
		builder = builder.Where(sq.Or{
			sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelSystem)},
			sq.And{
				sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelTeam)},
				sq.Eq{"TargetID": opts.TeamID},
			},
			sq.And{
				sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelChannel)},
				sq.Eq{"TargetID": opts.ChannelID},
			},
		})
	case opts.ChannelID != "":
		// DM/GM channels have no parent team, so the hierarchy is just
		// system → channel.
		builder = builder.Where(sq.Or{
			sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelSystem)},
			sq.And{
				sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelChannel)},
				sq.Eq{"TargetID": opts.ChannelID},
			},
		})
	case opts.TeamID != "":
		builder = builder.Where(sq.Or{
			sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelSystem)},
			sq.And{
				sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelTeam)},
				sq.Eq{"TargetID": opts.TeamID},
			},
		})
	default:
		if opts.TargetType != "" {
			builder = builder.Where(sq.Eq{"TargetType": opts.TargetType})
		}
		if len(opts.TargetIDs) > 0 {
			builder = builder.Where(sq.Eq{"TargetID": opts.TargetIDs})
		}
	}

	if opts.LinkedFieldID != "" {
		builder = builder.Where(sq.Eq{"LinkedFieldID": opts.LinkedFieldID})
	}

	if deltaMode {
		// Inclusive boundary so rows updated at exactly `since`
		// are returned on the first page. The cursor clause above
		// then disambiguates same-millisecond rows by Id across
		// subsequent pages.
		builder = builder.Where(sq.GtOrEq{"UpdateAt": opts.SinceUpdateAt})
	}

	fields := []*model.PropertyField{}
	if err := s.GetReplica().SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_search_query")
	}

	if err := s.hydratePropertyFieldOptions(s.GetReplica(), fields); err != nil {
		return nil, errors.Wrap(err, "property_field_search_hydrate_options")
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) Update(groupID string, fields []*model.PropertyField, expectedUpdateAts map[string]int64) ([]*model.PropertyField, error) {
	if len(fields) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_update_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updateTime := model.GetMillis()
	nameCase := sq.Case("id")
	typeCase := sq.Case("id")
	attrsCase := sq.Case("id")
	targetIDCase := sq.Case("id")
	targetTypeCase := sq.Case("id")
	protectedCase := sq.Case("id")
	permissionFieldCase := sq.Case("id")
	permissionValuesCase := sq.Case("id")
	permissionOptionsCase := sq.Case("id")
	linkedFieldIDCase := sq.Case("id")
	deleteAtCase := sq.Case("id")
	updatedByCase := sq.Case("id")
	permissionsCase := sq.Case("id")
	ids := make([]string, len(fields))

	for i, field := range fields {
		field.UpdateAt = updateTime
		if ensureErr := field.EnsureOptionIDs(); ensureErr != nil {
			return nil, errors.Wrap(ensureErr, "property_field_update_ensure_option_ids")
		}
		if vErr := field.IsValid(); vErr != nil {
			return nil, errors.Wrap(vErr, "property_field_update_isvalid")
		}

		if field.Permissions != nil && field.Permissions.Masking != nil && field.Permissions.Masking.MaskByFieldID != "" {
			if maskErr := s.ValidateMaskByFieldID(context.Background(), field.GroupID, field.ID, field.Permissions.Masking.MaskByFieldID); maskErr != nil {
				return nil, errors.Wrap(maskErr, "property_field_update_validate_mask_by_field_id")
			}
		}

		ids[i] = field.ID
		whenID := sq.Expr("?", field.ID)
		nameCase = nameCase.When(whenID, sq.Expr("?::text", field.Name))
		typeCase = typeCase.When(whenID, sq.Expr("?::property_field_type", field.Type))
		attrsCase = attrsCase.When(whenID, sq.Expr("?::jsonb", storedFieldAttrs(field)))
		targetIDCase = targetIDCase.When(whenID, sq.Expr("?::text", field.TargetID))
		targetTypeCase = targetTypeCase.When(whenID, sq.Expr("?::text", field.TargetType))
		protectedCase = protectedCase.When(whenID, sq.Expr("?::boolean", field.Protected))
		permissionFieldCase = permissionFieldCase.When(whenID, sq.Expr("?::permission_level", field.PermissionField))
		permissionValuesCase = permissionValuesCase.When(whenID, sq.Expr("?::permission_level", field.PermissionValues))
		permissionOptionsCase = permissionOptionsCase.When(whenID, sq.Expr("?::permission_level", field.PermissionOptions))
		linkedFieldIDCase = linkedFieldIDCase.When(whenID, sq.Expr("?", field.LinkedFieldID))
		deleteAtCase = deleteAtCase.When(whenID, sq.Expr("?::bigint", field.DeleteAt))
		updatedByCase = updatedByCase.When(whenID, sq.Expr("?::text", field.UpdatedBy))
		permissionsCase = permissionsCase.When(whenID, sq.Expr("?::jsonb", storedFieldPermissions(field)))
	}

	// Read before the UPDATE overwrites it: a field that stops linking has to take
	// over the options it was deriving, and the row is the only place the template
	// it was deriving them from is still recorded.
	clearedSources, err := s.linkSourcesBeingCleared(transaction, fields)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_update_link_sources")
	}

	builder := s.getQueryBuilder().
		Update("PropertyFields").
		Set("Name", nameCase).
		Set("Type", typeCase).
		Set("Attrs", attrsCase).
		Set("TargetID", targetIDCase).
		Set("TargetType", targetTypeCase).
		Set("Protected", protectedCase).
		Set("PermissionField", permissionFieldCase).
		Set("PermissionValues", permissionValuesCase).
		Set("PermissionOptions", permissionOptionsCase).
		Set("LinkedFieldID", linkedFieldIDCase).
		Set("UpdateAt", updateTime).
		Set("DeleteAt", deleteAtCase).
		Set("UpdatedBy", updatedByCase).
		Set("Permissions", permissionsCase).
		Where(sq.Eq{"id": ids})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	// Optimistic concurrency: if expectedUpdateAts is provided, only update
	// rows whose UpdateAt still matches the value read before validation.
	// This closes the TOCTOU window between validation and the UPDATE.
	if len(expectedUpdateAts) > 0 {
		updateAtCase := sq.Case("id")
		for _, id := range ids {
			if expected, ok := expectedUpdateAts[id]; ok {
				updateAtCase = updateAtCase.When(sq.Expr("?", id), sq.Expr("?::bigint", expected))
			}
		}
		caseSql, caseArgs, caseErr := updateAtCase.ToSql()
		if caseErr != nil {
			return nil, errors.Wrap(caseErr, "property_field_update_build_update_at_check")
		}
		builder = builder.Where("UpdateAt = "+caseSql, caseArgs...)
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
		if len(expectedUpdateAts) > 0 {
			return nil, store.NewErrConflict("PropertyField", nil, "concurrent modification detected; retry the update")
		}
		return nil, errors.Errorf("failed to update, some property fields were not found, got %d of %d", count, len(fields))
	}

	for _, field := range fields {
		if err = s.syncPropertyFieldGrants(transaction, field.ID, field.Permissions, updateTime); err != nil {
			return nil, errors.Wrap(err, "property_field_update_grants")
		}
	}

	// Before the option lists are reconciled: a field that has just stopped
	// linking owns the options it was deriving from now on -- and, on a graph
	// field, the hierarchy between them -- and its property values already point
	// at them.
	for _, field := range fields {
		sourceID, ok := clearedSources[field.ID]
		if !ok {
			continue
		}
		if err = s.takeOverLinkSourceOptions(transaction, field, sourceID, updateTime); err != nil {
			return nil, errors.Wrap(err, "property_field_update_take_over_options")
		}
		if err = s.takeOverLinkSourceOptionEdges(transaction, field, sourceID); err != nil {
			return nil, errors.Wrap(err, "property_field_update_take_over_option_edges")
		}
	}

	// Bring each field's option rows in line with the option list it was
	// submitted with.
	changedFieldIDs, err := s.syncPropertyFieldOptions(transaction, fields, updateTime)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_update_options")
	}

	// A field that links to a template derives that template's options rather
	// than holding a copy of them, so changing a template's options changes what
	// every dependent serves without touching a single dependent row. Return the
	// dependents anyway: a caller broadcasting these fields has to tell the
	// dependents' clients that their option list moved.
	var dependents []*model.PropertyField
	if len(changedFieldIDs) > 0 {
		dependents, err = s.getLinkedFields(transaction, changedFieldIDs, ids)
		if err != nil {
			return nil, errors.Wrap(err, "property_field_update_select_dependents")
		}
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_field_update_commit_transaction")
	}

	return append(fields, dependents...), nil
}

// Delete soft-deletes a field and takes the options it owns with it, in one
// transaction: the options are soft-deleted alongside it and the hierarchy
// between them is deleted outright.
//
// The options have to go with the field rather than being left behind: every
// query about an option filters on the option's own DeleteAt and none of them
// joins to the field's, so an option row left live under a deleted field goes on
// answering as a live option -- to a value being validated against it, and to a
// hierarchy walk seeded from it.
//
// Nothing checks the field's type first: a field with no options runs two
// statements that match nothing, which is cheaper than the read it would take to
// find out, and both are served by a primary key leading with FieldID.
func (s *SqlPropertyFieldStore) Delete(groupID string, id string) (err error) {
	now := model.GetMillis()

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "property_field_delete_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	builder := s.getQueryBuilder().
		Update("PropertyFields").
		Set("DeleteAt", now).
		Where(sq.Eq{"id": id})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	result, err := transaction.ExecBuilder(builder)
	if err != nil {
		return errors.Wrapf(err, "failed to delete property field with id: %s", id)
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "property_field_delete_rowsaffected")
	}
	if count == 0 {
		// Either no such field or one in another group. Nothing has been written yet
		// beyond this statement, which the rollback undoes with it.
		return store.NewErrNotFound("PropertyField", id)
	}

	if err = s.deleteOwnedOptions(transaction, id, now); err != nil {
		return err
	}

	// Soft-delete cascades only on hard deletes, so explicit cleanup is needed.
	if _, err = transaction.ExecBuilder(s.getQueryBuilder().
		Delete("PropertyFieldGrants").
		Where(sq.Eq{"FieldID": id})); err != nil {
		return errors.Wrap(err, "property_field_delete_grants")
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "property_field_delete_commit_transaction")
	}

	return nil
}

// buildConflictSubquery creates a subquery to check for property conflicts at a given level.
// The excludeID is only added to the WHERE clause when non-empty.
// Uses Question placeholder format (?) for proper parameter merging when combining queries.
func (s *SqlPropertyFieldStore) buildConflictSubquery(level string, objectType, groupID, name, excludeID string) sq.SelectBuilder {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question).
		Select(fmt.Sprintf("'%s'", level)).
		From("PropertyFields").
		Where(sq.Eq{"ObjectType": objectType}).
		Where(sq.Eq{"GroupID": groupID}).
		Where(sq.Eq{"TargetType": level}).
		Where(sq.Eq{"Name": name}).
		Where(sq.Eq{"DeleteAt": 0}).
		Limit(1)

	if excludeID != "" {
		builder = builder.Where(sq.NotEq{"ID": excludeID})
	}

	return builder
}

// CheckPropertyNameConflict checks if a property field would conflict with
// existing properties at the same level or in the hierarchy. It should be called
// before creating or updating a property field to enforce uniqueness.
//
// Same-level uniqueness: two properties at the same TargetType (and same TargetID
// for team/channel) with the same Name, ObjectType, and GroupID conflict. This
// prevents duplicate names within the same scope (e.g., two templates named
// "Classification" at system level in the same group).
//
// The hierarchy additionally works as follows:
//   - System-level properties (TargetType="system") conflict with any team or channel
//     property with the same name in the same ObjectType and GroupID
//   - Team-level properties (TargetType="team") conflict with system properties and
//     channel properties within that team
//   - Channel-level properties (TargetType="channel") conflict with system properties
//     and the team property of the channel's team
//
// Returns the conflict level ("system", "team", or "channel") if a conflict exists,
// or an empty string if no conflict. Legacy properties (ObjectType="") skip the
// check entirely and rely on the database constraint for uniqueness.
//
// For channel-level properties, the method uses a subquery to look up the channel's
// TeamId, which handles DM channels naturally (they have empty TeamId).
//
// The excludeID parameter allows excluding a specific property field ID from the
// conflict check. This is useful when updating a property field, where the field
// being updated should not conflict with itself. Pass an empty string when creating
// new fields.
func (s *SqlPropertyFieldStore) CheckPropertyNameConflict(field *model.PropertyField, excludeID string) (model.PropertyFieldTargetLevel, error) {
	// Legacy properties (PSAv1) use old uniqueness via DB constraint
	if field.IsPSAv1() {
		return "", nil
	}

	switch field.TargetType {
	case string(model.PropertyFieldTargetLevelSystem):
		return s.checkSystemLevelConflict(field, excludeID)
	case string(model.PropertyFieldTargetLevelTeam):
		return s.checkTeamLevelConflict(field, excludeID)
	case string(model.PropertyFieldTargetLevelChannel):
		return s.checkChannelLevelConflict(field, excludeID)
	default:
		// Unknown target type - let DB constraint handle
		return "", nil
	}
}

// checkSystemLevelConflict checks if a system-level property would conflict with
// another system-level property with the same name, or any team or channel property
// with the same name, in the same ObjectType and GroupID.
func (s *SqlPropertyFieldStore) checkSystemLevelConflict(field *model.PropertyField, excludeID string) (model.PropertyFieldTargetLevel, error) {
	// Build same-level (system) subquery — catches duplicate names at the same scope
	systemSubquery := s.buildConflictSubquery("system", field.ObjectType, field.GroupID, field.Name, excludeID)
	systemSQL, systemArgs, err := systemSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_system_system_sql")
	}

	// Build team subquery
	teamSubquery := s.buildConflictSubquery("team", field.ObjectType, field.GroupID, field.Name, excludeID)
	teamSQL, teamArgs, err := teamSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_system_team_sql")
	}

	// Build channel subquery
	channelSubquery := s.buildConflictSubquery("channel", field.ObjectType, field.GroupID, field.Name, excludeID)
	channelSQL, channelArgs, err := channelSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_system_channel_sql")
	}

	// Combine with COALESCE, use Rebind to convert ? placeholders to $1, $2, etc.
	query := fmt.Sprintf("SELECT COALESCE((%s), (%s), (%s), '')", systemSQL, teamSQL, channelSQL)
	args := append(systemArgs, teamArgs...)
	args = append(args, channelArgs...)

	var conflictLevel model.PropertyFieldTargetLevel
	if err := s.GetMaster().Get(&conflictLevel, query, args...); err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_system")
	}

	return conflictLevel, nil
}

// checkTeamLevelConflict checks if a team-level property would conflict with
// another team-level property with the same name and target, system properties,
// or channel properties within that team.
func (s *SqlPropertyFieldStore) checkTeamLevelConflict(field *model.PropertyField, excludeID string) (model.PropertyFieldTargetLevel, error) {
	// Build same-level (team) subquery — same name within the same team target
	teamSubquery := s.buildConflictSubquery("team", field.ObjectType, field.GroupID, field.Name, excludeID).
		Where(sq.Eq{"TargetID": field.TargetID})
	teamSQL, teamArgs, err := teamSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_team_team_sql")
	}

	// Build system subquery
	systemSubquery := s.buildConflictSubquery("system", field.ObjectType, field.GroupID, field.Name, excludeID)
	systemSQL, systemArgs, err := systemSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_team_system_sql")
	}

	// Build channel subquery (requires JOIN with Channels table)
	// Use Question placeholder format for proper parameter merging
	channelSubquery := sq.StatementBuilder.PlaceholderFormat(sq.Question).
		Select("'channel'").
		From("PropertyFields pf").
		Join("Channels c ON c.Id = pf.TargetID AND c.TeamId = ?", field.TargetID).
		Where(sq.Eq{"pf.ObjectType": field.ObjectType}).
		Where(sq.Eq{"pf.GroupID": field.GroupID}).
		Where(sq.Eq{"pf.TargetType": "channel"}).
		Where(sq.Eq{"pf.Name": field.Name}).
		Where(sq.Eq{"pf.DeleteAt": 0}).
		Limit(1)

	if excludeID != "" {
		channelSubquery = channelSubquery.Where(sq.NotEq{"pf.ID": excludeID})
	}

	channelSQL, channelArgs, err := channelSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_team_channel_sql")
	}

	// Combine with COALESCE, use Rebind to convert ? placeholders to $1, $2, etc.
	query := fmt.Sprintf("SELECT COALESCE((%s), (%s), (%s), '')", teamSQL, systemSQL, channelSQL)
	args := append(teamArgs, systemArgs...)
	args = append(args, channelArgs...)

	var conflictLevel model.PropertyFieldTargetLevel
	if err := s.GetMaster().Get(&conflictLevel, query, args...); err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_team")
	}

	return conflictLevel, nil
}

// checkChannelLevelConflict checks if a channel-level property would conflict with
// another channel-level property with the same name and target, system properties,
// or the team property of the channel's team.
// Uses a subquery to get TeamId from Channels table - handles DM channels naturally
// (DM channels have empty TeamId, so TargetID will be empty and won't match any team-level property).
func (s *SqlPropertyFieldStore) checkChannelLevelConflict(field *model.PropertyField, excludeID string) (model.PropertyFieldTargetLevel, error) {
	// Build same-level (channel) subquery — same name within the same channel target
	channelSubquery := s.buildConflictSubquery("channel", field.ObjectType, field.GroupID, field.Name, excludeID).
		Where(sq.Eq{"TargetID": field.TargetID})
	channelSQL, channelArgs, err := channelSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_channel_channel_sql")
	}

	// Build system subquery
	systemSubquery := s.buildConflictSubquery("system", field.ObjectType, field.GroupID, field.Name, excludeID)
	systemSQL, systemArgs, err := systemSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_channel_system_sql")
	}

	// Build team subquery (requires subquery to get TeamId from Channels)
	// Use Question placeholder format for proper parameter merging
	teamSubquery := s.buildConflictSubquery("team", field.ObjectType, field.GroupID, field.Name, excludeID).
		Where(sq.Expr("TargetID = (SELECT TeamId FROM Channels WHERE Id = ?)", field.TargetID))

	teamSQL, teamArgs, err := teamSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_channel_team_sql")
	}

	// Combine with COALESCE, use Rebind to convert ? placeholders to $1, $2, etc.
	query := fmt.Sprintf("SELECT COALESCE((%s), (%s), (%s), '')", channelSQL, systemSQL, teamSQL)
	args := append(channelArgs, systemArgs...)
	args = append(args, teamArgs...)

	var conflictLevel model.PropertyFieldTargetLevel
	if err := s.GetMaster().Get(&conflictLevel, query, args...); err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_channel")
	}

	return conflictLevel, nil
}

// GetExistingOptionIDs returns which of the given option IDs exist, and are not
// deleted, in the field's effective option set: the options it owns plus those
// owned by the template it links to.
//
// This is how a caller holding option identifiers checks them. The option list
// inlined into a field on read is absent above
// model.PropertyFieldMaxHydratedOptions options, so checking against that list
// rejects every identifier once a field grows past the cap. Reads from the master
// because it gates writes, matching CountLinkedFields.
func (s *SqlPropertyFieldStore) GetExistingOptionIDs(field *model.PropertyField, optionIDs []string) ([]string, error) {
	return s.getExistingOptionIDs(s.GetMaster(), optionOwnerIDs(field), optionIDs)
}

// GetLinkedFields returns the live fields linking to any of the given fields,
// each with its own effective option set inlined. Fields named in excludeIDs are
// left out, so a caller already holding some of them is not handed the same field
// twice.
//
// A field linking to a template serves that template's options as its own without
// holding a copy, so a change to the template changes what the dependent serves
// while leaving the dependent's row untouched. This is how the fields that change
// with it are found.
//
// Reads the master. Every caller is a write path asking what else its write
// affected, and a replica could answer with the option list from before it.
func (s *SqlPropertyFieldStore) GetLinkedFields(fieldIDs, excludeIDs []string) ([]*model.PropertyField, error) {
	return s.getLinkedFields(s.GetMaster(), fieldIDs, excludeIDs)
}

func (s *SqlPropertyFieldStore) getLinkedFields(db sqlxExecutor, fieldIDs, excludeIDs []string) ([]*model.PropertyField, error) {
	if len(fieldIDs) == 0 {
		return nil, nil
	}

	builder := s.tableSelectQuery.
		Where(sq.Eq{"LinkedFieldID": fieldIDs}).
		Where(sq.Eq{"DeleteAt": 0})
	if len(excludeIDs) > 0 {
		builder = builder.Where(sq.NotEq{"ID": excludeIDs})
	}

	var fields []*model.PropertyField
	if err := db.SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_linked_fields")
	}

	if err := s.hydratePropertyFieldOptions(db, fields); err != nil {
		return nil, errors.Wrap(err, "property_field_get_linked_fields_hydrate_options")
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) CountLinkedFields(fieldID string) (int64, error) {
	var count int64
	builder := s.getQueryBuilder().
		Select("COUNT(id)").
		From("PropertyFields").
		Where(sq.Eq{"LinkedFieldID": fieldID}).
		Where(sq.Eq{"DeleteAt": 0})

	if err := s.GetMaster().GetBuilder(&count, builder); err != nil {
		return 0, errors.Wrap(err, "property_field_count_linked_fields")
	}
	return count, nil
}

// syncPropertyFieldGrants deletes all existing grants for a field and inserts new
// ones based on field.Permissions.Grants. Each grant's allow list is expanded into
// individual rows, one per action. If Permissions is nil or has no grants, only the
// delete is run (which is a no-op if the field had no prior grants).
func (s *SqlPropertyFieldStore) syncPropertyFieldGrants(transaction *sqlxTxWrapper, fieldID string, permissions *model.Permissions, now int64) error {
	// Delete all existing grants for this field.
	builder := s.getQueryBuilder().
		Delete("PropertyFieldGrants").
		Where(sq.Eq{"FieldID": fieldID})

	if _, err := transaction.ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_field_sync_grants_delete")
	}

	// Nothing more to do if permissions is nil or has no grants.
	if permissions == nil || len(permissions.Grants) == 0 {
		return nil
	}

	// Insert one row per (grant, action) pair.
	insertBuilder := s.getQueryBuilder().Insert("PropertyFieldGrants").
		Columns("FieldID", "Type", "ID", "Action")

	for _, grant := range permissions.Grants {
		for _, action := range grant.Allow {
			insertBuilder = insertBuilder.Values(fieldID, grant.Type, grant.ID, action)
		}
	}

	if _, err := transaction.ExecBuilder(insertBuilder); err != nil {
		return errors.Wrap(err, "property_field_sync_grants_insert")
	}

	return nil
}

// GetFieldsByGrant returns the IDs of fields where (ownerType, ownerID) holds a
// grant for action, used by delegated-admin and system-console tooling to
// answer "which fields can this caller act on".
func (s *SqlPropertyFieldStore) GetFieldsByGrant(ctx context.Context, ownerType, ownerID, action string) ([]string, error) {
	builder := s.getQueryBuilder().
		Select("DISTINCT FieldID").
		From("PropertyFieldGrants").
		Where(sq.Eq{"Type": ownerType, "ID": ownerID, "Action": action}).
		OrderBy("FieldID")

	fieldIDs := []string{}
	if err := s.DBXFromContext(ctx).SelectBuilder(&fieldIDs, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_fields_by_grant")
	}

	return fieldIDs, nil
}

// GetGrantsForField reconstructs a field's grants from the normalized
// PropertyFieldGrants table, one model.Grant per (type, id) pair with Allow
// populated from its aggregated actions.
func (s *SqlPropertyFieldStore) GetGrantsForField(ctx context.Context, fieldID string) ([]model.Grant, error) {
	query, args, err := s.getQueryBuilder().
		Select("Type", "ID", "Array_Agg(Action ORDER BY Action) as Actions").
		From("PropertyFieldGrants").
		Where(sq.Eq{"FieldID": fieldID}).
		GroupBy("Type", "ID").
		OrderBy("Type", "ID").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_field_get_grants_for_field_tosql")
	}

	rows, err := s.DBXFromContext(ctx).Query(query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "property_field_get_grants_for_field_query")
	}
	defer rows.Close()

	grants := []model.Grant{}
	for rows.Next() {
		var grant model.Grant
		if err := rows.Scan(&grant.Type, &grant.ID, pq.Array(&grant.Allow)); err != nil {
			return nil, errors.Wrap(err, "property_field_get_grants_for_field_scan")
		}
		grants = append(grants, grant)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "property_field_get_grants_for_field_rows")
	}

	return grants, nil
}

// HasGrantForIdentity returns whether (ownerType, ownerID) holds a grant on any
// field, used by delegated-admin's quick "does this user hold any grant" check.
func (s *SqlPropertyFieldStore) HasGrantForIdentity(ctx context.Context, ownerType, ownerID string) (bool, error) {
	builder := s.getQueryBuilder().
		Select("1").
		Prefix("SELECT EXISTS (").
		From("PropertyFieldGrants").
		Where(sq.Eq{"Type": ownerType, "ID": ownerID}).
		Suffix(")")

	var exists bool
	if err := s.DBXFromContext(ctx).GetBuilder(&exists, builder); err != nil {
		return false, errors.Wrap(err, "property_field_has_grant_for_identity")
	}

	return exists, nil
}
