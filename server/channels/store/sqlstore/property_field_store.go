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
		Select("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "ObjectType", "CreateAt", "UpdateAt", "DeleteAt", "CreatedBy", "UpdatedBy").
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
		Columns("ID", "GroupID", "Name", "Type", "Attrs", "TargetID", "TargetType", "ObjectType", "CreateAt", "UpdateAt", "DeleteAt", "CreatedBy", "UpdatedBy").
		Values(field.ID, field.GroupID, field.Name, field.Type, field.Attrs, field.TargetID, field.TargetType, field.ObjectType, field.CreateAt, field.UpdateAt, field.DeleteAt, field.CreatedBy, field.UpdatedBy)

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

	if opts.SinceUpdateAt > 0 {
		builder = builder.Where(sq.Gt{"UpdateAt": opts.SinceUpdateAt})
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
	nameCase := sq.Case("id")
	typeCase := sq.Case("id")
	attrsCase := sq.Case("id")
	targetIDCase := sq.Case("id")
	targetTypeCase := sq.Case("id")
	deleteAtCase := sq.Case("id")
	updatedByCase := sq.Case("id")
	ids := make([]string, len(fields))

	for i, field := range fields {
		field.UpdateAt = updateTime
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
		Set("UpdateAt", updateTime).
		Set("DeleteAt", deleteAtCase).
		Set("UpdatedBy", updatedByCase).
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
// existing properties in the hierarchy. It should be called before creating
// or updating a property field to enforce hierarchical uniqueness.
//
// The hierarchy works as follows:
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
	// Legacy properties (ObjectType = "") use old uniqueness via DB constraint
	if field.ObjectType == "" {
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
// any team or channel property with the same name in the same ObjectType and GroupID.
func (s *SqlPropertyFieldStore) checkSystemLevelConflict(field *model.PropertyField, excludeID string) (model.PropertyFieldTargetLevel, error) {
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
	query := fmt.Sprintf("SELECT COALESCE((%s), (%s), '')", teamSQL, channelSQL)
	args := append(teamArgs, channelArgs...)

	var conflictLevel model.PropertyFieldTargetLevel
	if err := s.GetReplica().DB.Get(&conflictLevel, s.GetReplica().DB.Rebind(query), args...); err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_system")
	}

	return conflictLevel, nil
}

// checkTeamLevelConflict checks if a team-level property would conflict with
// system properties or channel properties within that team.
func (s *SqlPropertyFieldStore) checkTeamLevelConflict(field *model.PropertyField, excludeID string) (model.PropertyFieldTargetLevel, error) {
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
	query := fmt.Sprintf("SELECT COALESCE((%s), (%s), '')", systemSQL, channelSQL)
	args := append(systemArgs, channelArgs...)

	var conflictLevel model.PropertyFieldTargetLevel
	if err := s.GetReplica().DB.Get(&conflictLevel, s.GetReplica().DB.Rebind(query), args...); err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_team")
	}

	return conflictLevel, nil
}

// checkChannelLevelConflict checks if a channel-level property would conflict with
// system properties or the team property of the channel's team.
// Uses a subquery to get TeamId from Channels table - handles DM channels naturally
// (DM channels have empty TeamId, so TargetID will be empty and won't match any team-level property).
func (s *SqlPropertyFieldStore) checkChannelLevelConflict(field *model.PropertyField, excludeID string) (model.PropertyFieldTargetLevel, error) {
	// Build system subquery
	systemSubquery := s.buildConflictSubquery("system", field.ObjectType, field.GroupID, field.Name, excludeID)
	systemSQL, systemArgs, err := systemSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_channel_system_sql")
	}

	// Build team subquery (requires subquery to get TeamId from Channels)
	// Use Question placeholder format for proper parameter merging
	teamSubquery := sq.StatementBuilder.PlaceholderFormat(sq.Question).
		Select("'team'").
		From("PropertyFields").
		Where(sq.Eq{"ObjectType": field.ObjectType}).
		Where(sq.Eq{"GroupID": field.GroupID}).
		Where(sq.Eq{"TargetType": "team"}).
		Where(sq.Eq{"Name": field.Name}).
		Where(sq.Expr("TargetID = (SELECT TeamId FROM Channels WHERE Id = ?)", field.TargetID)).
		Where(sq.Eq{"DeleteAt": 0}).
		Limit(1)

	if excludeID != "" {
		teamSubquery = teamSubquery.Where(sq.NotEq{"ID": excludeID})
	}

	teamSQL, teamArgs, err := teamSubquery.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_channel_team_sql")
	}

	// Combine with COALESCE, use Rebind to convert ? placeholders to $1, $2, etc.
	query := fmt.Sprintf("SELECT COALESCE((%s), (%s), '')", systemSQL, teamSQL)
	args := append(systemArgs, teamArgs...)

	var conflictLevel model.PropertyFieldTargetLevel
	if err := s.GetReplica().DB.Get(&conflictLevel, s.GetReplica().DB.Rebind(query), args...); err != nil {
		return "", errors.Wrap(err, "property_field_check_conflict_channel")
	}

	return conflictLevel, nil
}
