// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"fmt"
	"net/http"
	"strings"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type selectType int

const (
	selectGroups selectType = iota
	selectCountGroups
)

type PgGroupStore struct {
	*sqlstore.SqlGroupStore
	rootStore *PgLayer
}

func (s PgGroupStore) CountGroupsByChannel(channelId string, opts model.GroupSearchOpts) (int64, *model.AppError) {
	countQuery := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeChannel, selectCountGroups, channelId, opts)

	countQueryString, args, err := countQuery.ToSql()
	if err != nil {
		return int64(0), model.NewAppError("SqlGroupStore.CountGroupsByChannel", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	count, err := s.GetReplica().SelectInt(countQueryString, args...)
	if err != nil {
		return int64(0), model.NewAppError("SqlGroupStore.CountGroupsByChannel", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}

func (s PgGroupStore) GetGroupsByChannel(channelId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, *model.AppError) {
	query := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeChannel, selectGroups, channelId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		query = query.OrderBy("ug.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlGroupStore.GetGroupsByChannel", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var groups []*model.GroupWithSchemeAdmin

	_, err = s.GetReplica().Select(&groups, queryString, args...)
	if err != nil {
		return nil, model.NewAppError("SqlGroupStore.GetGroupsByChannel", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return groups, nil
}

func (s PgGroupStore) groupsBySyncableBaseQuery(st model.GroupSyncableType, t selectType, syncableID string, opts model.GroupSearchOpts) sq.SelectBuilder {
	selectStrs := map[selectType]string{
		selectGroups:      "ug.*, gs.SchemeAdmin AS SyncableSchemeAdmin",
		selectCountGroups: "COUNT(*)",
	}

	var table string
	var idCol string
	if st == model.GroupSyncableTypeTeam {
		table = "GroupTeams"
		idCol = "TeamId"
	} else {
		table = "GroupChannels"
		idCol = "ChannelId"
	}

	query := s.rootStore.getQueryBuilder().
		Select(selectStrs[t]).
		From(fmt.Sprintf("%s gs", table)).
		LeftJoin("UserGroups ug ON gs.GroupId = ug.Id").
		Where(fmt.Sprintf("ug.DeleteAt = 0 AND gs.%s = ? AND gs.DeleteAt = 0", idCol), syncableID)

	if opts.IncludeMemberCount && t == selectGroups {
		query = s.rootStore.getQueryBuilder().
			Select(fmt.Sprintf("ug.*, coalesce(Members.MemberCount, 0) AS MemberCount, Group%ss.SchemeAdmin AS SyncableSchemeAdmin", st)).
			From("UserGroups ug").
			LeftJoin("(SELECT GroupMembers.GroupId, COUNT(*) AS MemberCount FROM GroupMembers LEFT JOIN Users ON Users.Id = GroupMembers.UserId WHERE GroupMembers.DeleteAt = 0 AND Users.DeleteAt = 0 GROUP BY GroupId) AS Members ON Members.GroupId = ug.Id").
			LeftJoin(fmt.Sprintf("%[1]s ON %[1]s.GroupId = ug.Id", table)).
			Where(fmt.Sprintf("%[1]s.DeleteAt = 0 AND %[1]s.%[2]s = ?", table, idCol), syncableID).
			OrderBy("ug.DisplayName")
	}

	if len(opts.Q) > 0 {
		pattern := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(opts.Q, "\\"))
		operatorKeyword := "ILIKE"
		query = query.Where(fmt.Sprintf("(ug.Name %[1]s ? OR ug.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	return query
}

func (s PgGroupStore) CountGroupsByTeam(teamId string, opts model.GroupSearchOpts) (int64, *model.AppError) {
	countQuery := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeTeam, selectCountGroups, teamId, opts)

	countQueryString, args, err := countQuery.ToSql()
	if err != nil {
		return int64(0), model.NewAppError("SqlGroupStore.CountGroupsByTeam", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	count, err := s.GetReplica().SelectInt(countQueryString, args...)
	if err != nil {
		return int64(0), model.NewAppError("SqlGroupStore.CountGroupsByTeam", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}

func (s PgGroupStore) GetGroupsByTeam(teamId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, *model.AppError) {
	query := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeTeam, selectGroups, teamId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		query = query.OrderBy("ug.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlGroupStore.GetGroupsByTeam", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var groups []*model.GroupWithSchemeAdmin

	_, err = s.GetReplica().Select(&groups, queryString, args...)
	if err != nil {
		return nil, model.NewAppError("SqlGroupStore.GetGroupsByTeam", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return groups, nil
}

func (s PgGroupStore) GetGroups(page, perPage int, opts model.GroupSearchOpts) ([]*model.Group, *model.AppError) {
	var groups []*model.Group

	groupsQuery := s.rootStore.getQueryBuilder().Select("g.*")

	if opts.IncludeMemberCount {
		groupsQuery = s.rootStore.getQueryBuilder().
			Select("g.*, coalesce(Members.MemberCount, 0) AS MemberCount").
			LeftJoin("(SELECT GroupMembers.GroupId, COUNT(*) AS MemberCount FROM GroupMembers LEFT JOIN Users ON Users.Id = GroupMembers.UserId WHERE GroupMembers.DeleteAt = 0 AND Users.DeleteAt = 0 GROUP BY GroupId) AS Members ON Members.GroupId = g.Id")
	}

	groupsQuery = groupsQuery.
		From("UserGroups g").
		Where("g.DeleteAt = 0").
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage)).
		OrderBy("g.DisplayName")

	if len(opts.Q) > 0 {
		pattern := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(opts.Q, "\\"))
		operatorKeyword := "ILIKE"
		groupsQuery = groupsQuery.Where(fmt.Sprintf("(g.Name %[1]s ? OR g.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	if len(opts.NotAssociatedToTeam) == 26 {
		groupsQuery = groupsQuery.Where(`
			g.Id NOT IN (
				SELECT
					Id
				FROM
					UserGroups
					JOIN GroupTeams ON GroupTeams.GroupId = UserGroups.Id
				WHERE
					GroupTeams.DeleteAt = 0
					AND UserGroups.DeleteAt = 0
					AND GroupTeams.TeamId = ?
			)
		`, opts.NotAssociatedToTeam)
	}

	if len(opts.NotAssociatedToChannel) == 26 {
		groupsQuery = groupsQuery.Where(`
			g.Id NOT IN (
				SELECT
					Id
				FROM
					UserGroups
					JOIN GroupChannels ON GroupChannels.GroupId = UserGroups.Id
				WHERE
					GroupChannels.DeleteAt = 0
					AND UserGroups.DeleteAt = 0
					AND GroupChannels.ChannelId = ?
			)
		`, opts.NotAssociatedToChannel)
	}

	queryString, args, err := groupsQuery.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlGroupStore.GetGroups", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err = s.GetReplica().Select(&groups, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlGroupStore.GetGroups", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return groups, nil
}

func (s PgGroupStore) teamMembersMinusGroupMembersQuery(teamID string, groupIDs []string, isCount bool) sq.SelectBuilder {
	var selectStr string

	if isCount {
		selectStr = "count(DISTINCT Users.Id)"
	} else {
		tmpl := "Users.*, coalesce(TeamMembers.SchemeGuest, false), TeamMembers.SchemeAdmin, TeamMembers.SchemeUser, %s AS GroupIDs"
		selectStr = fmt.Sprintf(tmpl, "string_agg(UserGroups.Id, ',')")
	}

	subQuery := s.rootStore.getQueryBuilder().Select("GroupMembers.UserId").
		From("GroupMembers").
		Join("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("GroupMembers.DeleteAt = 0").
		Where(fmt.Sprintf("GroupMembers.GroupId IN ('%s')", strings.Join(groupIDs, "', '")))

	sql, _ := subQuery.MustSql()

	query := s.rootStore.getQueryBuilder().Select(selectStr).
		From("TeamMembers").
		Join("Teams ON Teams.Id = TeamMembers.TeamId").
		Join("Users ON Users.Id = TeamMembers.UserId").
		LeftJoin("Bots ON Bots.UserId = TeamMembers.UserId").
		LeftJoin("GroupMembers ON GroupMembers.UserId = Users.Id").
		LeftJoin("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("TeamMembers.DeleteAt = 0").
		Where("Teams.DeleteAt = 0").
		Where("Users.DeleteAt = 0").
		Where("Bots.UserId IS NULL").
		Where("Teams.Id = ?", teamID).
		Where(fmt.Sprintf("Users.Id NOT IN (%s)", sql))

	if !isCount {
		query = query.GroupBy("Users.Id, TeamMembers.SchemeGuest, TeamMembers.SchemeAdmin, TeamMembers.SchemeUser")
	}

	return query
}

// TeamMembersMinusGroupMembers returns the set of users on the given team minus the set of users in the given
// groups.
func (s PgGroupStore) TeamMembersMinusGroupMembers(teamID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, *model.AppError) {
	query := s.teamMembersMinusGroupMembersQuery(teamID, groupIDs, false)
	query = query.OrderBy("Users.Username ASC").Limit(uint64(perPage)).Offset(uint64(page * perPage))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlGroupStore.TeamMembersMinusGroupMembers", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.UserWithGroups
	if _, err = s.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlGroupStore.TeamMembersMinusGroupMembers", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

// CountTeamMembersMinusGroupMembers returns the count of the set of users on the given team minus the set of users
// in the given groups.
func (s PgGroupStore) CountTeamMembersMinusGroupMembers(teamID string, groupIDs []string) (int64, *model.AppError) {
	queryString, args, err := s.teamMembersMinusGroupMembersQuery(teamID, groupIDs, true).ToSql()
	if err != nil {
		return 0, model.NewAppError("SqlGroupStore.CountTeamMembersMinusGroupMembers", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var count int64
	if count, err = s.GetReplica().SelectInt(queryString, args...); err != nil {
		return 0, model.NewAppError("SqlGroupStore.CountTeamMembersMinusGroupMembers", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}

func (s PgGroupStore) channelMembersMinusGroupMembersQuery(channelID string, groupIDs []string, isCount bool) sq.SelectBuilder {
	var selectStr string

	if isCount {
		selectStr = "count(DISTINCT Users.Id)"
	} else {
		tmpl := "Users.*, coalesce(ChannelMembers.SchemeGuest, false), ChannelMembers.SchemeAdmin, ChannelMembers.SchemeUser, %s AS GroupIDs"
		selectStr = fmt.Sprintf(tmpl, "string_agg(UserGroups.Id, ',')")
	}

	subQuery := s.rootStore.getQueryBuilder().Select("GroupMembers.UserId").
		From("GroupMembers").
		Join("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("GroupMembers.DeleteAt = 0").
		Where(fmt.Sprintf("GroupMembers.GroupId IN ('%s')", strings.Join(groupIDs, "', '")))

	sql, _ := subQuery.MustSql()

	query := s.rootStore.getQueryBuilder().Select(selectStr).
		From("ChannelMembers").
		Join("Channels ON Channels.Id = ChannelMembers.ChannelId").
		Join("Users ON Users.Id = ChannelMembers.UserId").
		LeftJoin("Bots ON Bots.UserId = ChannelMembers.UserId").
		LeftJoin("GroupMembers ON GroupMembers.UserId = Users.Id").
		LeftJoin("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("Channels.DeleteAt = 0").
		Where("Users.DeleteAt = 0").
		Where("Bots.UserId IS NULL").
		Where("Channels.Id = ?", channelID).
		Where(fmt.Sprintf("Users.Id NOT IN (%s)", sql))

	if !isCount {
		query = query.GroupBy("Users.Id, ChannelMembers.SchemeGuest, ChannelMembers.SchemeAdmin, ChannelMembers.SchemeUser")
	}

	return query
}

// ChannelMembersMinusGroupMembers returns the set of users in the given channel minus the set of users in the given
// groups.
func (s PgGroupStore) ChannelMembersMinusGroupMembers(channelID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, *model.AppError) {
	query := s.channelMembersMinusGroupMembersQuery(channelID, groupIDs, false)
	query = query.OrderBy("Users.Username ASC").Limit(uint64(perPage)).Offset(uint64(page * perPage))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlGroupStore.ChannelMembersMinusGroupMembers", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.UserWithGroups
	if _, err = s.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlGroupStore.ChannelMembersMinusGroupMembers", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

// CountChannelMembersMinusGroupMembers returns the count of the set of users in the given channel minus the set of users
// in the given groups.
func (s PgGroupStore) CountChannelMembersMinusGroupMembers(channelID string, groupIDs []string) (int64, *model.AppError) {
	queryString, args, err := s.channelMembersMinusGroupMembersQuery(channelID, groupIDs, true).ToSql()
	if err != nil {
		return 0, model.NewAppError("SqlGroupStore.CountChannelMembersMinusGroupMembers", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var count int64
	if count, err = s.GetReplica().SelectInt(queryString, args...); err != nil {
		return 0, model.NewAppError("SqlGroupStore.CountChannelMembersMinusGroupMembers", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}
