// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

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
		Select("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "ObjectType", "Protected", "PermissionField", "PermissionValues", "PermissionOptions", "LinkedFieldID", "CreateAt", "UpdateAt", "DeleteAt", "COALESCE(CreatedBy, '') as CreatedBy", "COALESCE(UpdatedBy, '') as UpdatedBy").
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

	builder := s.getQueryBuilder().
		Insert("PropertyFields").
		Columns("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "ObjectType", "Protected", "PermissionField", "PermissionValues", "PermissionOptions", "LinkedFieldID", "CreateAt", "UpdateAt", "DeleteAt", "CreatedBy", "UpdatedBy").
		Values(field.ID, field.GroupID, field.Name, field.Type, field.Attrs, field.TargetID, field.TargetType, field.ObjectType, field.Protected, field.PermissionField, field.PermissionValues, field.PermissionOptions, field.LinkedFieldID, field.CreateAt, field.UpdateAt, field.DeleteAt, field.CreatedBy, field.UpdatedBy)

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "property_field_create_insert")
	}

	return field, nil
}

func (s *SqlPropertyFieldStore) Get(ctx context.Context, groupID, id string) (*model.PropertyField, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": id})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	var field model.PropertyField
	if err := s.DBXFromContext(ctx).GetBuilder(&field, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PropertyField", id)
		}
		return nil, errors.Wrap(err, "property_field_get_select")
	}

	return &field, nil
}

func (s *SqlPropertyFieldStore) GetFieldByName(ctx context.Context, groupID, targetID, name string) (*model.PropertyField, error) {
	builder := s.tableSelectQuery.
		Where(sq.Eq{"GroupID": groupID}).
		Where(sq.Eq{"TargetID": targetID}).
		Where(sq.Eq{"Name": name}).
		Where(sq.Eq{"DeleteAt": 0})

	var field model.PropertyField
	if err := s.DBXFromContext(ctx).GetBuilder(&field, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_by_name_select")
	}

	return &field, nil
}

func (s *SqlPropertyFieldStore) GetMany(ctx context.Context, groupID string, ids []string) ([]*model.PropertyField, error) {
	builder := s.tableSelectQuery.Where(sq.Eq{"id": ids})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	fields := []*model.PropertyField{}
	if err := s.DBXFromContext(ctx).SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_many_query")
	}

	if len(fields) < len(ids) {
		return nil, store.NewErrResultsMismatch(len(fields), len(ids))
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

	if opts.ObjectType != "" {
		builder = builder.Where(sq.Eq{"ObjectType": opts.ObjectType})
	}

	if opts.TargetType != "" {
		builder = builder.Where(sq.Eq{"TargetType": opts.TargetType})
	}

	if len(opts.TargetIDs) > 0 {
		builder = builder.Where(sq.Eq{"TargetID": opts.TargetIDs})
	}

	if opts.LinkedFieldID != "" {
		builder = builder.Where(sq.Eq{"LinkedFieldID": opts.LinkedFieldID})
	}

	if opts.SinceUpdateAt > 0 {
		builder = builder.Where(sq.Gt{"UpdateAt": opts.SinceUpdateAt})
	}

	fields := []*model.PropertyField{}
	if err := s.GetReplica().SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_search_query")
	}

	return fields, nil
}

func (s *SqlPropertyFieldStore) Update(groupID string, fields []*model.PropertyField, expectedUpdateAts map[string]int64) ([]*model.PropertyField, error) {
	if len(fields) == 0 {
		return nil, nil
	}

	transaction, err := s.GetMaster().Beginx()
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
	ids := make([]string, len(fields))

	for i, field := range fields {
		field.UpdateAt = updateTime
		if ensureErr := field.EnsureOptionIDs(); ensureErr != nil {
			return nil, errors.Wrap(ensureErr, "property_field_update_ensure_option_ids")
		}
		if vErr := field.IsValid(); vErr != nil {
			return nil, errors.Wrap(vErr, "property_field_update_isvalid")
		}

		ids[i] = field.ID
		whenID := sq.Expr("?", field.ID)
		nameCase = nameCase.When(whenID, sq.Expr("?::text", field.Name))
		typeCase = typeCase.When(whenID, sq.Expr("?::property_field_type", field.Type))
		attrsCase = attrsCase.When(whenID, sq.Expr("?::jsonb", field.Attrs))
		targetIDCase = targetIDCase.When(whenID, sq.Expr("?::text", field.TargetID))
		targetTypeCase = targetTypeCase.When(whenID, sq.Expr("?::text", field.TargetType))
		protectedCase = protectedCase.When(whenID, sq.Expr("?::boolean", field.Protected))
		permissionFieldCase = permissionFieldCase.When(whenID, sq.Expr("?::permission_level", field.PermissionField))
		permissionValuesCase = permissionValuesCase.When(whenID, sq.Expr("?::permission_level", field.PermissionValues))
		permissionOptionsCase = permissionOptionsCase.When(whenID, sq.Expr("?::permission_level", field.PermissionOptions))
		linkedFieldIDCase = linkedFieldIDCase.When(whenID, sq.Expr("?", field.LinkedFieldID))
		deleteAtCase = deleteAtCase.When(whenID, sq.Expr("?::bigint", field.DeleteAt))
		updatedByCase = updatedByCase.When(whenID, sq.Expr("?::text", field.UpdatedBy))
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

	// Propagate type and options from updated source fields to all their
	// linked dependents. This self-joins PropertyFields: "source" is the
	// row we just updated, "linked" is any row whose LinkedFieldID points
	// to it. Only rows where type or options actually differ are touched,
	// so this is a no-op when none of the updated fields have dependents.
	//
	// We build the query manually because squirrel doesn't support
	// PostgreSQL's UPDATE ... FROM syntax, and use ExecRaw because the
	// placeholders are already in $N format (Exec would try to rebind them).
	//
	// For ids = ["aaa", "bbb"] the args and SQL expand to:
	//   propagateArgs = [updateTime, "aaa", "bbb"]  →  $1, $2, $3
	//   SQL: ... WHERE source.ID IN ($2, $3) ... UpdateAt = $1
	inPlaceholders := make([]string, len(ids))
	propagateArgs := make([]any, 0, len(ids)+1)
	propagateArgs = append(propagateArgs, updateTime)
	for i, id := range ids {
		inPlaceholders[i] = fmt.Sprintf("$%d", i+2)
		propagateArgs = append(propagateArgs, id)
	}

	propagateSQL := fmt.Sprintf(`
UPDATE PropertyFields AS linked
   SET Type = source.Type,
       Attrs = jsonb_set(COALESCE(linked.Attrs, '{}'::jsonb), '{options}',
                         COALESCE(source.Attrs->'options', '[]'::jsonb)),
       UpdateAt = $1
  FROM PropertyFields AS source
 WHERE source.ID IN (%s)
   AND linked.LinkedFieldID = source.ID
   AND linked.DeleteAt = 0
   AND (linked.Type != source.Type
        OR linked.Attrs->'options' IS DISTINCT FROM source.Attrs->'options')
`, strings.Join(inPlaceholders, ", "))

	if _, execErr := transaction.ExecRaw(propagateSQL, propagateArgs...); execErr != nil {
		return nil, errors.Wrap(execErr, "property_field_update_propagate")
	}

	// Retrieve propagated linked fields to include in the return value
	selectBuilder := s.tableSelectQuery.
		Where(sq.Eq{"LinkedFieldID": ids}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"UpdateAt": updateTime})

	var propagatedFields []*model.PropertyField
	if selectErr := transaction.SelectBuilder(&propagatedFields, selectBuilder); selectErr != nil {
		return nil, errors.Wrap(selectErr, "property_field_update_select_propagated")
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "property_field_update_commit_transaction")
	}

	return append(fields, propagatedFields...), nil
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
	// FIXME: explicitly excluding templates from the shortcircuit, should be removed after CPA is fully migrated to v2
	if field.IsPSAv1() && field.ObjectType != model.PropertyFieldObjectTypeTemplate {
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
	if err := s.GetMaster().DB.Get(&conflictLevel, s.GetMaster().DB.Rebind(query), args...); err != nil {
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
	if err := s.GetMaster().DB.Get(&conflictLevel, s.GetMaster().DB.Rebind(query), args...); err != nil {
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
	if err := s.GetMaster().DB.Get(&conflictLevel, s.GetMaster().DB.Rebind(query), args...); err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_channel")
	}

	return conflictLevel, nil
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
