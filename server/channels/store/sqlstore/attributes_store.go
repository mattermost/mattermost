// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

type SqlAttributesStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface

	selectQueryBuilder sq.SelectBuilder
}

// attributeViewsByObjectType is the single source of truth for the
// object-type-to-materialized-view mapping: both the per-type lookup and the
// refresh sweep read it, so adding an object type cannot leave a new view
// perpetually stale. The view is per-object-type (migration 000212) so a
// refresh of one type's attributes doesn't recompute the others.
var attributeViewsByObjectType = map[string]string{
	model.PropertyFieldObjectTypeChannel: "ChannelAttributeView",
	model.PropertyFieldObjectTypeUser:    "UserAttributeView",
}

// attributeViewFor maps a property-field object type to its materialized view.
// An unrecognized type is an error rather than a fallback to the user view: a
// silent coercion would surface a future miswire as a wrong-but-successful user
// lookup.
func attributeViewFor(objectType string) (string, error) {
	view, ok := attributeViewsByObjectType[objectType]
	if !ok {
		return "", errors.Errorf("unknown object type %q for attribute view", objectType)
	}
	return view, nil
}

func attributesSliceColumns(prefix ...string) []string {
	var p string
	if len(prefix) == 1 {
		p = prefix[0] + "."
	} else if len(prefix) > 1 {
		panic("cannot accept multiple prefixes")
	}

	return []string{
		p + "TargetID as ID",
		p + "TargetType as Type",
		p + "Attributes",
	}
}

// qualify prefixes each column with the given table name. The members-to-remove
// queries join Users, whose columns (Roles, DeleteAt, CreateAt) collide with the
// member columns, so the member SELECT must be table-qualified to stay unambiguous.
func qualify(table string, columns []string) []string {
	qualified := make([]string, len(columns))
	for i, c := range columns {
		qualified[i] = table + "." + c
	}
	return qualified
}

func newSqlAttributesStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.AttributesStore {
	s := &SqlAttributesStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	// The From clause is chosen per call by object type (GetSubject), so the
	// shared builder carries only the Select.
	s.selectQueryBuilder = s.getQueryBuilder().Select(attributesSliceColumns()...)

	return s
}

func (s *SqlAttributesStore) RefreshAttributes() error {
	// Both per-object-type views (migration 000212) refresh on one cadence, so a
	// caller does not have to know which object types it is about to read. They
	// refresh in separate statements, though, so this is not an atomic snapshot:
	// a read straddling a refresh can see the two views a generation apart. Every
	// consumer tolerates that — values are eventually consistent and the
	// membership sync re-runs on cadence and converges. Refreshing only the view
	// whose attributes actually changed is a scale follow-up. Refresh order is
	// unspecified (map iteration) and does not matter: each REFRESH is its own
	// independent statement.
	for _, view := range attributeViewsByObjectType {
		if _, err := s.GetMaster().Exec("REFRESH MATERIALIZED VIEW " + view); err != nil {
			return errors.Wrapf(err, "error refreshing materialized view %s", view)
		}
	}

	return nil
}

func (s *SqlAttributesStore) GetSubject(rctx request.CTX, ID, groupID, objectType string) (*model.Subject, error) {
	view, err := attributeViewFor(objectType)
	if err != nil {
		return nil, err
	}
	query := s.selectQueryBuilder.From(view).Where(sq.And{sq.Eq{"TargetID": ID}, sq.Eq{"GroupID": groupID}})

	q, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build query for subject")
	}

	row := s.GetReplica().QueryRowContext(rctx.Context(), q, args...)

	var subject model.Subject
	var properties []byte

	if err := row.Scan(&subject.ID, &subject.Type, &properties); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Attributes", ID)
		}
		return nil, errors.Wrap(err, "failed to scan subject row")
	}

	if err := json.Unmarshal(properties, &subject.Attributes); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal attributes")
	}

	return &subject, nil
}

func (s *SqlAttributesStore) SearchUsers(rctx request.CTX, opts model.SubjectSearchOptions) ([]*model.User, int64, error) {
	query := s.getQueryBuilder().
		Select(getUsersColumns()...).From("Users").LeftJoin("UserAttributeView ON Users.Id = UserAttributeView.TargetID").
		OrderBy("Users.Id ASC")

	count := s.getQueryBuilder().Select("COUNT(*)").From("Users").LeftJoin("UserAttributeView ON Users.Id = UserAttributeView.TargetID")

	if opts.Query != "" {
		// Wrap the CEL-derived expression in parentheses so that any top-level
		// OR (e.g. produced by "has any of [a, b]") does not bind across the
		// AND-joined WHERE clauses appended below (SubjectID, DeleteAt,
		// TeamID, ExcludeChannelMembers, Cursor, Term). Without these
		// parens, "A OR B AND Users.Id = $X" would be parsed as
		// "A OR (B AND Users.Id = $X)" because AND binds tighter than OR.
		wrapped := "(" + opts.Query + ")"
		query = query.Where(sq.Expr(wrapped, opts.Args...))
		count = count.Where(sq.Expr(wrapped, opts.Args...))
	}

	argCount := len(opts.Args)

	if opts.Limit > 0 {
		query = query.Limit(uint64(opts.Limit))
	} else if opts.Limit > MaxPerPage {
		query = query.Limit(uint64(MaxPerPage))
	}

	if !opts.AllowInactive {
		query = query.Where("Users.DeleteAt = 0")
		count = count.Where("Users.DeleteAt = 0")
	}

	if opts.TeamID != "" {
		argCount++
		query = query.Where(sq.Expr(fmt.Sprintf("Users.Id IN (SELECT UserId FROM TeamMembers WHERE TeamId = $%d AND DeleteAt = 0)", argCount), opts.TeamID))
		count = count.Where(sq.Expr(fmt.Sprintf("Users.Id IN (SELECT UserId FROM TeamMembers WHERE TeamId = $%d AND DeleteAt = 0)", argCount), opts.TeamID))
	}

	if opts.ExcludeChannelMembers != "" {
		argCount++
		query = query.Where(sq.Expr(fmt.Sprintf("NOT EXISTS (SELECT 1 FROM ChannelMembers WHERE ChannelMembers.UserId = Users.Id AND ChannelMembers.ChannelId = $%d)", argCount), opts.ExcludeChannelMembers))
	}

	if opts.SubjectID != "" {
		argCount++
		query = query.Where(sq.Expr(fmt.Sprintf("Users.Id = $%d", argCount), opts.SubjectID))
		count = count.Where(sq.Expr(fmt.Sprintf("Users.Id = $%d", argCount), opts.SubjectID))
	}

	if opts.Cursor.TargetID != "" {
		argCount++
		// Paginate on Users.Id (the ORDER BY column), not UserAttributeView.TargetID.
		// The cursor value is a user id, and TargetID comes from a LEFT JOIN so it
		// is NULL for users with no custom-attribute row — comparing against it
		// silently drops those users (e.g. matches of a native-only policy).
		query = query.Where(sq.Expr(fmt.Sprintf("Users.Id > $%d", argCount), opts.Cursor.TargetID))
	}

	termFields := UserSearchTypeNames
	if opts.ExcludeFullNames {
		termFields = UserSearchTypeNamesNoFullName
	}
	searchFields := make([]string, 0, len(termFields))
	for _, field := range termFields {
		searchFields = append(searchFields, strings.Join([]string{"Users", field}, "."))
	}

	if term := opts.Term; strings.TrimSpace(term) != "" {
		_, query = generateSearchQueryForExpression(query, strings.Fields(term), searchFields, argCount)
		_, count = generateSearchQueryForExpression(count, strings.Fields(term), searchFields, argCount)
	}

	q, args, err := query.ToSql()
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to build query for subjects")
	}

	users := []*model.User{}
	if err = s.GetReplica().Select(&users, q, args...); err != nil {
		return nil, 0, errors.Wrapf(err, "failed to find Users with term=%s and searchType=%v", opts.Term, searchFields)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	var total int64

	if !opts.IgnoreCount {
		err = s.GetReplica().GetBuilder(&total, count)
		if err != nil {
			return nil, 0, errors.Wrapf(err, "failed to count Users with term=%s and searchType=%v", opts.Term, searchFields)
		}
	}

	return users, total, nil
}

func (s *SqlAttributesStore) GetChannelMembersToRemove(rctx request.CTX, channelID string, opts model.SubjectSearchOptions) ([]*model.ChannelMember, error) {
	query := s.getQueryBuilder().
		Select(qualify("ChannelMembers", channelMemberSliceColumns())...).From("ChannelMembers").
		// Join Users so native-attribute expressions (e.g. Users.EmailVerified)
		// resolve here, mirroring SearchUsers on the add path.
		LeftJoin("Users ON Users.Id = ChannelMembers.UserId").
		LeftJoin("UserAttributeView ON ChannelMembers.UserId = UserAttributeView.TargetID").
		OrderBy("ChannelMembers.UserId ASC")

	if opts.Query != "" {
		// A member is removed when they do NOT satisfy the policy; a NULL result
		// (e.g. a missing custom attribute) counts as "does not satisfy" via
		// COALESCE. We must not additionally remove members just because they
		// lack a UserAttributeView row — a native-only policy matches against the
		// Users table, so a user with zero custom attributes can still satisfy it.
		query = query.Where(sq.Expr(fmt.Sprintf("NOT COALESCE((%s), FALSE)", opts.Query), opts.Args...))
	}

	argCount := len(opts.Args)

	argCount++
	query = query.Where(sq.Expr(fmt.Sprintf("ChannelMembers.ChannelId = $%d", argCount), channelID))

	if opts.Limit > 0 {
		query = query.Limit(uint64(opts.Limit))
	} else if opts.Limit > MaxPerPage {
		query = query.Limit(uint64(MaxPerPage))
	}

	if opts.Cursor.TargetID != "" {
		argCount++
		query = query.Where(sq.Expr(fmt.Sprintf("ChannelMembers.UserId > $%d", argCount), opts.Cursor.TargetID))
	}

	q, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build query for subjects")
	}

	members := []*model.ChannelMember{}
	if err := s.GetReplica().Select(&members, q, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find channel members with for channel id=%s", channelID)
	}

	return members, nil
}

func (s *SqlAttributesStore) GetTeamMembersToRemove(rctx request.CTX, teamID string, opts model.SubjectSearchOptions) ([]*model.TeamMember, error) {
	query := s.getQueryBuilder().
		Select(qualify("TeamMembers", teamMemberSliceColumns())...).From("TeamMembers").
		// Join Users so native-attribute expressions (e.g. Users.EmailVerified)
		// resolve here, mirroring SearchUsers on the add path.
		LeftJoin("Users ON Users.Id = TeamMembers.UserId").
		LeftJoin("UserAttributeView ON TeamMembers.UserId = UserAttributeView.TargetID").
		Where("TeamMembers.DeleteAt = 0").
		OrderBy("TeamMembers.UserId ASC")

	if opts.Query != "" {
		// A member is removed when they do NOT satisfy the policy; a NULL result
		// (e.g. a missing custom attribute) counts as "does not satisfy" via
		// COALESCE. We must not additionally remove members just because they
		// lack a UserAttributeView row — a native-only policy matches against the
		// Users table, so a user with zero custom attributes can still satisfy it.
		query = query.Where(sq.Expr(fmt.Sprintf("NOT COALESCE((%s), FALSE)", opts.Query), opts.Args...))
	}

	argCount := len(opts.Args)

	argCount++
	query = query.Where(sq.Expr(fmt.Sprintf("TeamMembers.TeamId = $%d", argCount), teamID))

	// An explicit limit is capped at MaxPerPage; an unset limit (0) intentionally
	// returns every removal candidate for the team. The membership-sync caller
	// consumes the full set in one pass, so capping an unset limit here would
	// permanently leave members beyond the cap in a team they no longer qualify
	// for. The result is naturally bounded by the team's membership.
	if opts.Limit > 0 {
		limit := min(opts.Limit, MaxPerPage)
		query = query.Limit(uint64(limit))
	}

	if opts.Cursor.TargetID != "" {
		argCount++
		query = query.Where(sq.Expr(fmt.Sprintf("TeamMembers.UserId > $%d", argCount), opts.Cursor.TargetID))
	}

	q, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build query for subjects")
	}

	members := []*model.TeamMember{}
	if err := s.GetReplica().Select(&members, q, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find team members for team id=%s", teamID)
	}

	return members, nil
}

func generateSearchQueryForExpression(query sq.SelectBuilder, terms []string, fields []string, prevArgs int) (int, sq.SelectBuilder) {
	for _, term := range terms {
		searchFields := []string{}
		termArgs := []any{}
		for _, field := range fields {
			prevArgs++
			searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower($%d) escape '*' ", field, prevArgs))
			termArgs = append(termArgs, fmt.Sprintf("%%%s%%", strings.TrimLeft(term, "@")))
		}
		prevArgs++
		searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower($%d) escape '*' ", "Id", prevArgs))
		termArgs = append(termArgs, strings.TrimLeft(term, "@"))
		query = query.Where(fmt.Sprintf("(%s)", strings.Join(searchFields, " OR ")), termArgs...)
	}

	return prevArgs, query
}
