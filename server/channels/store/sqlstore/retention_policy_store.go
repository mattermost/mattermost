// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

type SqlRetentionPolicyStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface
}

func newSqlRetentionPolicyStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.RetentionPolicyStore {
	return &SqlRetentionPolicyStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}
}

// executePossiblyEmptyQuery only executes the query if it is non-empty. This helps avoid
// having to check for MySQL, which, unlike Postgres, does not allow empty queries.
func executePossiblyEmptyQuery(txn *sqlxTxWrapper, query string, args ...any) (sql.Result, error) {
	if query == "" {
		return nil, nil
	}
	return txn.Exec(query, args...)
}

func (s *SqlRetentionPolicyStore) Save(policy *model.RetentionPolicyWithTeamAndChannelIDs) (_ *model.RetentionPolicyWithTeamAndChannelCounts, err error) {
	// Strategy:
	// 1. Insert new policy
	// 2. Insert new channels into policy
	// 3. Insert new teams into policy

	if err = s.checkTeamsExist(policy.TeamIDs); err != nil {
		return nil, err
	}
	if err = s.checkChannelsExist(policy.ChannelIDs); err != nil {
		return nil, err
	}

	policy.ID = model.NewId()

	policyInsertQuery, policyInsertArgs, err := s.getQueryBuilder().
		Insert("RetentionPolicies").
		Columns("Id", "DisplayName", "PostDuration").
		Values(policy.ID, policy.DisplayName, policy.PostDurationDays).
		ToSql()
	if err != nil {
		return nil, err
	}

	channelsInsertQuery, channelsInsertArgs, err := s.buildInsertRetentionPoliciesChannelsQuery(policy.ID, policy.ChannelIDs)
	if err != nil {
		return nil, err
	}

	teamsInsertQuery, teamsInsertArgs, err := s.buildInsertRetentionPoliciesTeamsQuery(policy.ID, policy.TeamIDs)
	if err != nil {
		return nil, err
	}

	queryString, args, err := s.buildGetPolicyQuery(policy.ID)
	if err != nil {
		return nil, err
	}

	txn, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(txn, &err)

	// Create a new policy in RetentionPolicies
	if _, err = txn.Exec(policyInsertQuery, policyInsertArgs...); err != nil {
		return nil, err
	}
	// Insert the channel IDs into RetentionPoliciesChannels
	if _, err = executePossiblyEmptyQuery(txn, channelsInsertQuery, channelsInsertArgs...); err != nil {
		return nil, err
	}
	// Insert the team IDs into RetentionPoliciesTeams
	if _, err = executePossiblyEmptyQuery(txn, teamsInsertQuery, teamsInsertArgs...); err != nil {
		return nil, err
	}
	// Select the new policy (with team/channel counts) which we just created
	var newPolicy model.RetentionPolicyWithTeamAndChannelCounts

	if err = txn.Get(&newPolicy, queryString, args...); err != nil {
		return nil, err
	}
	if err = txn.Commit(); err != nil {
		return nil, err
	}
	return &newPolicy, nil
}

func (s *SqlRetentionPolicyStore) checkTeamsExist(teamIDs []string) error {
	if len(teamIDs) > 0 {
		teamsSelectQuery, teamsSelectArgs, err := s.getQueryBuilder().
			Select("Id").
			From("Teams").
			Where(sq.Eq{"Id": teamIDs}).
			ToSql()
		if err != nil {
			return err
		}
		rows := []*string{}
		err = s.GetReplicaX().Select(&rows, teamsSelectQuery, teamsSelectArgs...)
		if err != nil {
			return err
		}
		if len(rows) == len(teamIDs) {
			return nil
		}
		retrievedIDs := make(map[string]bool)
		for _, teamID := range rows {
			retrievedIDs[*teamID] = true
		}
		for _, teamID := range teamIDs {
			if _, ok := retrievedIDs[teamID]; !ok {
				return store.NewErrNotFound("Team", teamID)
			}
		}
	}
	return nil
}

func (s *SqlRetentionPolicyStore) checkChannelsExist(channelIDs []string) error {
	if len(channelIDs) > 0 {
		channelsSelectQuery, channelsSelectArgs, err := s.getQueryBuilder().
			Select("Id").
			From("Channels").
			Where(sq.Eq{"Id": channelIDs}).
			ToSql()
		if err != nil {
			return err
		}
		rows := []*string{}
		err = s.GetReplicaX().Select(&rows, channelsSelectQuery, channelsSelectArgs...)
		if err != nil {
			return err
		}
		if len(rows) == len(channelIDs) {
			return nil
		}
		retrievedIDs := make(map[string]bool)
		for _, channelID := range rows {
			retrievedIDs[*channelID] = true
		}
		for _, channelID := range channelIDs {
			if _, ok := retrievedIDs[channelID]; !ok {
				return store.NewErrNotFound("Channel", channelID)
			}
		}
	}
	return nil
}

func (s *SqlRetentionPolicyStore) buildInsertRetentionPoliciesChannelsQuery(policyID string, channelIDs []string) (query string, args []any, err error) {
	if len(channelIDs) > 0 {
		builder := s.getQueryBuilder().
			Insert("RetentionPoliciesChannels").
			Columns("PolicyId", "ChannelId")
		for _, channelID := range channelIDs {
			builder = builder.Values(policyID, channelID)
		}
		query, args, err = builder.ToSql()
	}
	return
}

func (s *SqlRetentionPolicyStore) buildInsertRetentionPoliciesTeamsQuery(policyID string, teamIDs []string) (query string, args []any, err error) {
	if len(teamIDs) > 0 {
		builder := s.getQueryBuilder().
			Insert("RetentionPoliciesTeams").
			Columns("PolicyId", "TeamId")
		for _, teamID := range teamIDs {
			builder = builder.Values(policyID, teamID)
		}
		query, args, err = builder.ToSql()
	}
	return
}

func (s *SqlRetentionPolicyStore) Patch(patch *model.RetentionPolicyWithTeamAndChannelIDs) (_ *model.RetentionPolicyWithTeamAndChannelCounts, err error) {
	// Strategy:
	// 1. Update policy attributes
	// 2. Delete existing channels from policy
	// 3. Insert new channels into policy
	// 4. Delete existing teams from policy
	// 5. Insert new teams into policy
	// 6. Read new policy

	if err = s.checkTeamsExist(patch.TeamIDs); err != nil {
		return nil, err
	}
	if err = s.checkChannelsExist(patch.ChannelIDs); err != nil {
		return nil, err
	}

	policyUpdateQuery := ""
	policyUpdateArgs := []any{}
	if patch.DisplayName != "" || patch.PostDurationDays != nil {
		builder := s.getQueryBuilder().Update("RetentionPolicies")
		if patch.DisplayName != "" {
			builder = builder.Set("DisplayName", patch.DisplayName)
		}
		if patch.PostDurationDays != nil {
			builder = builder.Set("PostDuration", *patch.PostDurationDays)
		}
		policyUpdateQuery, policyUpdateArgs, err = builder.
			Where(sq.Eq{"Id": patch.ID}).
			ToSql()
		if err != nil {
			return nil, err
		}
	}

	channelsDeleteQuery := ""
	channelsDeleteArgs := []any{}
	channelsInsertQuery := ""
	channelsInsertArgs := []any{}
	if patch.ChannelIDs != nil {
		channelsDeleteQuery, channelsDeleteArgs, err = s.getQueryBuilder().
			Delete("RetentionPoliciesChannels").
			Where(sq.Eq{"PolicyId": patch.ID}).
			ToSql()
		if err != nil {
			return nil, err
		}

		channelsInsertQuery, channelsInsertArgs, err = s.buildInsertRetentionPoliciesChannelsQuery(patch.ID, patch.ChannelIDs)
		if err != nil {
			return nil, err
		}
	}

	teamsDeleteQuery := ""
	teamsDeleteArgs := []any{}
	teamsInsertQuery := ""
	teamsInsertArgs := []any{}
	if patch.TeamIDs != nil {
		teamsDeleteQuery, teamsDeleteArgs, err = s.getQueryBuilder().
			Delete("RetentionPoliciesTeams").
			Where(sq.Eq{"PolicyId": patch.ID}).
			ToSql()
		if err != nil {
			return nil, err
		}

		teamsInsertQuery, teamsInsertArgs, err = s.buildInsertRetentionPoliciesTeamsQuery(patch.ID, patch.TeamIDs)
		if err != nil {
			return nil, err
		}
	}

	queryString, args, err := s.buildGetPolicyQuery(patch.ID)
	if err != nil {
		return nil, err
	}

	txn, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(txn, &err)

	// Update the fields of the policy in RetentionPolicies
	if _, err = executePossiblyEmptyQuery(txn, policyUpdateQuery, policyUpdateArgs...); err != nil {
		return nil, err
	}
	// Remove all channels from the policy in RetentionPoliciesChannels
	if _, err = executePossiblyEmptyQuery(txn, channelsDeleteQuery, channelsDeleteArgs...); err != nil {
		return nil, err
	}
	// Insert the new channels for the policy in RetentionPoliciesChannels
	if _, err = executePossiblyEmptyQuery(txn, channelsInsertQuery, channelsInsertArgs...); err != nil {
		return nil, err
	}
	// Remove all teams from the policy in RetentionPoliciesTeams
	if _, err = executePossiblyEmptyQuery(txn, teamsDeleteQuery, teamsDeleteArgs...); err != nil {
		return nil, err
	}
	// Insert the new teams for the policy in RetentionPoliciesTeams
	if _, err = executePossiblyEmptyQuery(txn, teamsInsertQuery, teamsInsertArgs...); err != nil {
		return nil, err
	}
	// Select the policy which we just updated
	var newPolicy model.RetentionPolicyWithTeamAndChannelCounts
	if err = txn.Get(&newPolicy, queryString, args...); err != nil {
		return nil, err
	}
	if err = txn.Commit(); err != nil {
		return nil, err
	}
	return &newPolicy, nil
}

func (s *SqlRetentionPolicyStore) buildGetPolicyQuery(id string) (string, []any, error) {
	return s.buildGetPoliciesQuery(id, 0, 1)
}

// buildGetPoliciesQuery builds a query to select information for the policy with the specified
// ID, or, if `id` is the empty string, from all policies. The results returned will be sorted by
// policy display name and ID.
func (s *SqlRetentionPolicyStore) buildGetPoliciesQuery(id string, offset, limit int) (string, []any, error) {
	rpcSubQuery := s.getQueryBuilder().
		Select("RetentionPolicies.Id, COUNT(RetentionPoliciesChannels.ChannelId) AS Count").
		From("RetentionPolicies").
		LeftJoin("RetentionPoliciesChannels ON RetentionPolicies.Id = RetentionPoliciesChannels.PolicyId").
		GroupBy("RetentionPolicies.Id").
		OrderBy("RetentionPolicies.DisplayName, RetentionPolicies.Id").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if id != "" {
		rpcSubQuery = rpcSubQuery.Where(sq.Eq{"RetentionPolicies.Id": id})
	}

	rpcSubQueryString, args, err := rpcSubQuery.ToSql()
	if err != nil {
		return "", nil, errors.Wrap(err, "retention_policies_tosql")
	}

	rptSubQuery := s.getQueryBuilder().
		Select("RetentionPolicies.Id, COUNT(RetentionPoliciesTeams.TeamId) AS Count").
		From("RetentionPolicies").
		LeftJoin("RetentionPoliciesTeams ON RetentionPolicies.Id = RetentionPoliciesTeams.PolicyId").
		GroupBy("RetentionPolicies.Id").
		OrderBy("RetentionPolicies.DisplayName, RetentionPolicies.Id").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if id != "" {
		rptSubQuery = rptSubQuery.Where(sq.Eq{"RetentionPolicies.Id": id})
	}

	rptSubQueryString, _, err := rptSubQuery.ToSql()
	if err != nil {
		return "", nil, errors.Wrap(err, "retention_policies_tosql")
	}

	query := s.getQueryBuilder().
		Select(`
			RetentionPolicies.Id as "Id",
			RetentionPolicies.DisplayName,
			RetentionPolicies.PostDuration as "PostDuration",
			A.Count AS ChannelCount,
			B.Count AS TeamCount
	  `).
		From("RetentionPolicies").
		InnerJoin(`(` + rpcSubQueryString + `) AS A ON RetentionPolicies.Id = A.Id`).
		InnerJoin(`(` + rptSubQueryString + `) AS B ON RetentionPolicies.Id = B.Id`).
		OrderBy("RetentionPolicies.DisplayName, RetentionPolicies.Id")

	queryString, _, err := query.ToSql()
	if err != nil {
		return "", nil, errors.Wrap(err, "retention_policies_tosql")
	}

	// MySQL does not support positional params, so we add one param for each WHERE clause.
	if s.DriverName() == model.DatabaseDriverMysql {
		args = append(args, args...)
	}

	return queryString, args, nil
}

func (s *SqlRetentionPolicyStore) Get(id string) (*model.RetentionPolicyWithTeamAndChannelCounts, error) {
	queryString, args, err := s.buildGetPolicyQuery(id)
	if err != nil {
		return nil, err
	}

	var policy model.RetentionPolicyWithTeamAndChannelCounts
	if err := s.GetReplicaX().Get(&policy, queryString, args...); err != nil {
		return nil, err
	}
	return &policy, nil
}

func (s *SqlRetentionPolicyStore) GetAll(offset, limit int) ([]*model.RetentionPolicyWithTeamAndChannelCounts, error) {
	policies := []*model.RetentionPolicyWithTeamAndChannelCounts{}
	queryString, args, err := s.buildGetPoliciesQuery("", offset, limit)
	if err != nil {
		return policies, err
	}
	err = s.GetReplicaX().Select(&policies, queryString, args...)
	return policies, err
}

func (s *SqlRetentionPolicyStore) GetCount() (int64, error) {
	var count int64
	err := s.GetReplicaX().Get(&count, "SELECT COUNT(*) FROM RetentionPolicies")
	if err != nil {
		return count, err
	}

	return count, nil
}

func (s *SqlRetentionPolicyStore) Delete(id string) error {
	query := s.getQueryBuilder().
		Delete("RetentionPolicies").
		Where(sq.Eq{"Id": id})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "retention_policies_tosql")
	}

	sqlResult, err := s.GetMasterX().Exec(queryString, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to permanent delete retention policy with id=%s", id)
	}

	numRowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "unable to get rows affected")
	} else if numRowsAffected == 0 {
		return errors.New("policy not found")
	}

	return nil
}

func (s *SqlRetentionPolicyStore) GetChannels(policyId string, offset, limit int) (model.ChannelListWithTeamData, error) {
	query := s.getQueryBuilder().Select(`Channels.*, Teams.DisplayName AS TeamDisplayName,
	  Teams.Name AS TeamName,Teams.UpdateAt AS TeamUpdateAt`).
		From("RetentionPoliciesChannels").
		InnerJoin("Channels ON RetentionPoliciesChannels.ChannelId = Channels.Id").
		InnerJoin("Teams ON Channels.TeamId = Teams.Id").
		Where(sq.Eq{"RetentionPoliciesChannels.PolicyId": policyId}).
		OrderBy("Channels.DisplayName, Channels.Id").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "retention_policies_channels_tosql")
	}

	channels := model.ChannelListWithTeamData{}
	if err := s.GetReplicaX().Select(&channels, queryString, args...); err != nil {
		return channels, errors.Wrap(err, "failed to find RetentionPoliciesChannels")
	}

	for _, channel := range channels {
		channel.PolicyID = model.NewString(policyId)
	}

	return channels, nil
}

func (s *SqlRetentionPolicyStore) GetChannelsCount(policyId string) (int64, error) {
	query := s.getQueryBuilder().
		Select("Count(*)").
		From("RetentionPolicies").
		InnerJoin("RetentionPoliciesChannels ON RetentionPolicies.Id = RetentionPoliciesChannels.PolicyId").
		Where(sq.Eq{"RetentionPolicies.Id": policyId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "retention_policies_tosql")
	}

	var count int64
	if err := s.GetReplicaX().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count RetentionPolicies")
	}

	return count, nil
}

func (s *SqlRetentionPolicyStore) AddChannels(policyId string, channelIds []string) error {
	if len(channelIds) == 0 {
		return nil
	}
	if err := s.checkChannelsExist(channelIds); err != nil {
		return err
	}
	query := s.getQueryBuilder().
		Insert("RetentionPoliciesChannels").
		Columns("policyId", "channelId")

	for _, channelId := range channelIds {
		query = query.Values(policyId, channelId)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "retention_policies_channels_tosql")
	}

	_, err = s.GetMasterX().Exec(queryString, args...)
	if err != nil {
		switch dbErr := err.(type) {
		case *pq.Error:
			if dbErr.Code == PGForeignKeyViolationErrorCode {
				return store.NewErrNotFound("RetentionPolicy", policyId)
			}
		case *mysql.MySQLError:
			if dbErr.Number == MySQLForeignKeyViolationErrorCode {
				return store.NewErrNotFound("RetentionPolicy", policyId)
			}
		}
	}

	return nil
}

func (s *SqlRetentionPolicyStore) RemoveChannels(policyId string, channelIds []string) error {
	if len(channelIds) == 0 {
		return nil
	}
	query := s.getQueryBuilder().
		Delete("RetentionPoliciesChannels").
		Where(sq.And{
			sq.Eq{"PolicyId": policyId},
			sq.Eq{"ChannelId": channelIds},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "retention_policies_channels_tosql")
	}

	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return errors.Wrapf(err, "failed to permanent delete retention policy channels with policyid=%s", policyId)
	}

	return nil
}

func (s *SqlRetentionPolicyStore) GetTeams(policyId string, offset, limit int) ([]*model.Team, error) {
	query := s.getQueryBuilder().
		Select("Teams.*").
		From("RetentionPoliciesTeams").
		InnerJoin("Teams ON RetentionPoliciesTeams.TeamId = Teams.Id").
		Where(sq.Eq{"RetentionPoliciesTeams.PolicyId": policyId}).
		OrderBy("Teams.DisplayName, Teams.Id").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "retention_policies_teams_tosql")
	}

	teams := []*model.Team{}
	if err = s.GetReplicaX().Select(&teams, queryString, args...); err != nil {
		return teams, errors.Wrap(err, "failed to find Teams")
	}

	return teams, nil
}

func (s *SqlRetentionPolicyStore) GetTeamsCount(policyId string) (int64, error) {
	query := s.getQueryBuilder().
		Select("Count(*)").
		From("RetentionPolicies").
		InnerJoin("RetentionPoliciesTeams ON RetentionPolicies.Id = RetentionPoliciesTeams.PolicyId").
		Where(sq.Eq{"RetentionPolicies.Id": policyId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "retention_policies_tosql")
	}

	var count int64
	if err := s.GetReplicaX().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count RetentionPolicies")
	}

	return count, nil
}

func (s *SqlRetentionPolicyStore) AddTeams(policyId string, teamIds []string) error {
	if len(teamIds) == 0 {
		return nil
	}
	if err := s.checkTeamsExist(teamIds); err != nil {
		return err
	}
	query := s.getQueryBuilder().
		Insert("RetentionPoliciesTeams").
		Columns("PolicyId", "TeamId")
	for _, teamId := range teamIds {
		query = query.Values(policyId, teamId)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "retention_policies_teams_tosql")
	}

	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to insert retention policies teams")
	}

	return nil
}

func (s *SqlRetentionPolicyStore) RemoveTeams(policyId string, teamIds []string) error {
	if len(teamIds) == 0 {
		return nil
	}
	query := s.getQueryBuilder().
		Delete("RetentionPoliciesTeams").
		Where(sq.And{
			sq.Eq{"PolicyId": policyId},
			sq.Eq{"TeamId": teamIds},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "retention_policies_teams_tosql")
	}

	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return errors.Wrapf(err, "unable to permanent delete retention policies teams with policyid=%s", policyId)
	}

	return nil
}

func subQueryIN(property string, query sq.SelectBuilder) sq.Sqlizer {
	queryString, args := query.MustSql()
	subQuery := fmt.Sprintf("%s IN (SELECT * FROM (%s) AS A)", property, queryString)
	return sq.Expr(subQuery, args...)
}

// DeleteOrphanedRows removes entries from RetentionPoliciesChannels and RetentionPoliciesTeams
// where a channel or team no longer exists.
func (s *SqlRetentionPolicyStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
	// We need the extra level of nesting to deal with MySQL's locking
	rpcSubQuery := sq.Select("ChannelId").
		From("RetentionPoliciesChannels").
		LeftJoin("Channels ON RetentionPoliciesChannels.ChannelId = Channels.Id").
		Where("Channels.Id IS NULL").
		Limit(uint64(limit))

	rpcDeleteQuery, rpcArgs, err := s.getQueryBuilder().
		Delete("RetentionPoliciesChannels").
		Where(subQueryIN("ChannelId", rpcSubQuery)).
		ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "retention_policies_channels_tosql")
	}

	rptSubQuery := sq.Select("TeamId").
		From("RetentionPoliciesTeams").
		LeftJoin("Teams ON RetentionPoliciesTeams.TeamId = Teams.Id").
		Where("Teams.Id IS NULL").
		Limit(uint64(limit))

	rptDeleteQuery, rptArgs, err := s.getQueryBuilder().
		Delete("RetentionPoliciesTeams").
		Where(subQueryIN("TeamId", rptSubQuery)).
		ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "retention_policies_teams_tosql")
	}

	result, err := s.GetMasterX().Exec(rpcDeleteQuery, rpcArgs...)
	if err != nil {
		return
	}
	rpcDeleted, err := result.RowsAffected()
	if err != nil {
		return
	}
	result, err = s.GetMasterX().Exec(rptDeleteQuery, rptArgs...)
	if err != nil {
		return
	}
	rptDeleted, err := result.RowsAffected()
	if err != nil {
		return
	}
	deleted = rpcDeleted + rptDeleted
	return
}

func (s *SqlRetentionPolicyStore) GetTeamPoliciesForUser(userID string, offset, limit int) ([]*model.RetentionPolicyForTeam, error) {
	query := s.getQueryBuilder().
		Select(`Teams.Id AS "Id", RetentionPolicies.PostDuration AS "PostDuration"`).
		From("Users").
		InnerJoin("TeamMembers ON Users.Id = TeamMembers.UserId").
		InnerJoin("Teams ON TeamMembers.TeamId = Teams.Id").
		InnerJoin("RetentionPoliciesTeams ON Teams.Id = RetentionPoliciesTeams.TeamId").
		InnerJoin("RetentionPolicies ON RetentionPoliciesTeams.PolicyId = RetentionPolicies.Id").
		Where(
			sq.And{
				sq.Eq{"Users.Id": userID},
				sq.Eq{"TeamMembers.DeleteAt": 0},
				sq.Eq{"Teams.DeleteAt": 0},
			},
		).
		OrderBy("Teams.Id").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_policies_for_user_tosql")
	}

	policies := []*model.RetentionPolicyForTeam{}
	if err := s.GetReplicaX().Select(&policies, queryString, args...); err != nil {
		return policies, errors.Wrap(err, "failed to find Users")
	}

	return policies, nil
}

func (s *SqlRetentionPolicyStore) GetTeamPoliciesCountForUser(userID string) (int64, error) {
	query := s.getQueryBuilder().
		Select("Count(*)").
		From("Users").
		InnerJoin("TeamMembers ON Users.Id = TeamMembers.UserId").
		InnerJoin("Teams ON TeamMembers.TeamId = Teams.Id").
		InnerJoin("RetentionPoliciesTeams ON Teams.Id = RetentionPoliciesTeams.TeamId").
		InnerJoin("RetentionPolicies ON RetentionPoliciesTeams.PolicyId = RetentionPolicies.Id").
		Where(
			sq.And{
				sq.Eq{"Users.Id": userID},
				sq.Eq{"TeamMembers.DeleteAt": 0},
				sq.Eq{"Teams.DeleteAt": 0},
			},
		)

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "team_policies_count_for_user_tosql")
	}

	var count int64
	if err := s.GetReplicaX().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count TeamPoliciesCountForUser")
	}

	return count, nil
}

func (s *SqlRetentionPolicyStore) GetChannelPoliciesForUser(userID string, offset, limit int) ([]*model.RetentionPolicyForChannel, error) {
	query := s.getQueryBuilder().
		Select(`Channels.Id as "Id", RetentionPolicies.PostDuration as "PostDuration"`).
		From("Users").
		InnerJoin("ChannelMembers ON Users.Id = ChannelMembers.UserId").
		InnerJoin("Channels ON ChannelMembers.ChannelId = Channels.Id").
		InnerJoin("RetentionPoliciesChannels ON Channels.Id = RetentionPoliciesChannels.ChannelId").
		InnerJoin("RetentionPolicies ON RetentionPoliciesChannels.PolicyId = RetentionPolicies.Id").
		Where(
			sq.And{
				sq.Eq{"Users.Id": userID},
				sq.Eq{"Channels.DeleteAt": 0},
			},
		).
		OrderBy("Channels.Id").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_policies_for_user_tosql")
	}

	policies := []*model.RetentionPolicyForChannel{}
	if err := s.GetReplicaX().Select(&policies, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	return policies, nil
}

func (s *SqlRetentionPolicyStore) GetChannelPoliciesCountForUser(userID string) (int64, error) {
	query := s.getQueryBuilder().
		Select("Count(*)").
		From("Users").
		InnerJoin("ChannelMembers ON Users.Id = ChannelMembers.UserId").
		InnerJoin("Channels ON ChannelMembers.ChannelId = Channels.Id").
		InnerJoin("RetentionPoliciesChannels ON Channels.Id = RetentionPoliciesChannels.ChannelId").
		InnerJoin("RetentionPolicies ON RetentionPoliciesChannels.PolicyId = RetentionPolicies.Id").
		Where(
			sq.And{
				sq.Eq{"Users.Id": userID},
				sq.Eq{"Channels.DeleteAt": 0},
			},
		)

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "channel_policies_count_users_tosql")
	}

	var count int64
	if err := s.GetReplicaX().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count ChannelPoliciesCountForUser")
	}

	return count, nil
}

func scanRetentionIdsForDeletion(rows *sql.Rows, isPostgres bool) ([]*model.RetentionIdsForDeletion, error) {
	idsForDeletion := []*model.RetentionIdsForDeletion{}
	for rows.Next() {
		var row model.RetentionIdsForDeletion
		if isPostgres {
			if err := rows.Scan(
				&row.Id, &row.TableName, pq.Array(&row.Ids),
			); err != nil {
				return nil, errors.Wrap(err, "unable to scan columns")
			}
		} else {
			var ids []byte
			if err := rows.Scan(
				&row.Id, &row.TableName, &ids,
			); err != nil {
				return nil, errors.Wrap(err, "unable to scan columns")
			}
			if err := json.Unmarshal(ids, &row.Ids); err != nil {
				return nil, errors.Wrap(err, "failed to unmarshal ids")
			}
		}

		idsForDeletion = append(idsForDeletion, &row)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error while iterating over rows")
	}
	return idsForDeletion, nil
}

func (s *SqlRetentionPolicyStore) GetIdsForDeletionByTableName(tableName string, limit int) ([]*model.RetentionIdsForDeletion, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("RetentionIdsForDeletion").
		Where(
			sq.Eq{"TableName": tableName},
		).
		Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_ids_for_deletion_tosql")
	}

	rows, err := s.GetReplicaX().DB.Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get ids for deletion")
	}
	defer rows.Close()

	isPostgres := s.DriverName() == model.DatabaseDriverPostgres
	idsForDeletion, err := scanRetentionIdsForDeletion(rows, isPostgres)
	if err != nil {
		return nil, errors.Wrap(err, "failed to scan ids for deletion")
	}

	return idsForDeletion, nil
}

func insertRetentionIdsForDeletion(txn *sqlxTxWrapper, row *model.RetentionIdsForDeletion, s *SqlStore) error {
	row.PreSave()
	insertBuilder := s.getQueryBuilder().
		Insert("RetentionIdsForDeletion").
		Columns("Id", "TableName", "Ids")
	if s.DriverName() == model.DatabaseDriverPostgres {
		insertBuilder = insertBuilder.
			Values(row.Id, row.TableName, pq.Array(row.Ids))
	} else {
		jsonIds, err := json.Marshal(row.Ids)
		if err != nil {
			return err
		}
		insertBuilder = insertBuilder.
			Values(row.Id, row.TableName, jsonIds)
	}
	insertQuery, insertArgs, err := insertBuilder.ToSql()
	if err != nil {
		return err
	}

	if _, err = txn.Exec(insertQuery, insertArgs...); err != nil {
		return err
	}
	return nil
}

// RetentionPolicyBatchDeletionInfo gives information on how to delete records
// under a retention policy; see `genericPermanentDeleteBatchForRetentionPolicies`.
//
// `BaseBuilder` should already have selected the primary key(s) for the main table
// and should be joined to a table with a ChannelId column, which will be used to join
// on the Channels table.
// `Table` is the name of the table from which records are being deleted.
// `TimeColumn` is the name of the column which contains the timestamp of the record.
// `PrimaryKeys` contains the primary keys of `table`. It should be the same as the
// `From` clause in `baseBuilder`.
// `ChannelIDTable` is the table which contains the ChannelId column, it may be the
// same as `table`, or will be different if a join was used.
// `NowMillis` must be a Unix timestamp in milliseconds and is used by the granular
// policies; if `nowMillis - timestamp(record)` is greater than
// the post duration of a granular policy, than the record will be deleted.
// `GlobalPolicyEndTime` is used by the global policy; any record older than this time
// will be deleted by the global policy if it does not fall under a granular policy.
// To disable the granular policies, set `NowMillis` to 0.
// To disable the global policy, set `GlobalPolicyEndTime` to 0.
type RetentionPolicyBatchDeletionInfo struct {
	BaseBuilder         sq.SelectBuilder
	Table               string
	TimeColumn          string
	PrimaryKeys         []string
	ChannelIDTable      string
	NowMillis           int64
	GlobalPolicyEndTime int64
	Limit               int64
	StoreDeletedIds     bool
}

// genericPermanentDeleteBatchForRetentionPolicies is a helper function for tables
// which need to delete records for granular and global policies.
func genericPermanentDeleteBatchForRetentionPolicies(
	r RetentionPolicyBatchDeletionInfo,
	s *SqlStore,
	cursor model.RetentionPolicyCursor,
) (int64, model.RetentionPolicyCursor, error) {
	baseBuilder := r.BaseBuilder.InnerJoin("Channels ON " + r.ChannelIDTable + ".ChannelId = Channels.Id")

	scopedTimeColumn := r.Table + "." + r.TimeColumn
	nowStr := strconv.FormatInt(r.NowMillis, 10)
	// A record falls under the scope of a granular retention policy if:
	// 1. The policy's post duration is >= 0
	// 2. The record's lifespan has not exceeded the policy's post duration
	const millisecondsInADay = 24 * 60 * 60 * 1000
	fallsUnderGranularPolicy := sq.And{
		sq.GtOrEq{"RetentionPolicies.PostDuration": 0},
		sq.Expr(nowStr + " - " + scopedTimeColumn + " > RetentionPolicies.PostDuration * " + strconv.FormatInt(millisecondsInADay, 10)),
	}

	// If the caller wants to disable the global policy from running
	if r.GlobalPolicyEndTime <= 0 {
		cursor.GlobalPoliciesDone = true
	}
	// If the caller wants to disable the granular policies from running
	if r.NowMillis <= 0 {
		cursor.ChannelPoliciesDone = true
		cursor.TeamPoliciesDone = true
	}

	var totalRowsAffected int64

	// First, delete all of the records which fall under the scope of a channel-specific policy
	if !cursor.ChannelPoliciesDone {
		channelPoliciesBuilder := baseBuilder.
			InnerJoin("RetentionPoliciesChannels ON " + r.ChannelIDTable + ".ChannelId = RetentionPoliciesChannels.ChannelId").
			InnerJoin("RetentionPolicies ON RetentionPoliciesChannels.PolicyId = RetentionPolicies.Id").
			Where(fallsUnderGranularPolicy).
			Limit(uint64(r.Limit))
		rowsAffected, err := genericRetentionPoliciesDeletion(channelPoliciesBuilder, r, s)
		if err != nil {
			return 0, cursor, err
		}
		if rowsAffected < r.Limit {
			cursor.ChannelPoliciesDone = true
		}
		totalRowsAffected += rowsAffected
		r.Limit -= rowsAffected
	}

	// Next, delete all of the records which fall under the scope of a team-specific policy
	if cursor.ChannelPoliciesDone && !cursor.TeamPoliciesDone {
		// Channel-specific policies override team-specific policies.
		teamPoliciesBuilder := baseBuilder.
			LeftJoin("RetentionPoliciesChannels ON " + r.ChannelIDTable + ".ChannelId = RetentionPoliciesChannels.ChannelId").
			InnerJoin("RetentionPoliciesTeams ON Channels.TeamId = RetentionPoliciesTeams.TeamId").
			InnerJoin("RetentionPolicies ON RetentionPoliciesTeams.PolicyId = RetentionPolicies.Id").
			Where(sq.And{
				sq.Eq{"RetentionPoliciesChannels.PolicyId": nil},
				sq.Expr("RetentionPoliciesTeams.PolicyId = RetentionPolicies.Id"),
			}).
			Where(fallsUnderGranularPolicy).
			Limit(uint64(r.Limit))
		rowsAffected, err := genericRetentionPoliciesDeletion(teamPoliciesBuilder, r, s)
		if err != nil {
			return 0, cursor, err
		}
		if rowsAffected < r.Limit {
			cursor.TeamPoliciesDone = true
		}
		totalRowsAffected += rowsAffected
		r.Limit -= rowsAffected
	}

	// Finally, delete all of the records which fall under the scope of the global policy
	if cursor.ChannelPoliciesDone && cursor.TeamPoliciesDone && !cursor.GlobalPoliciesDone {
		// Granular policies override the global policy.
		globalPolicyBuilder := baseBuilder.
			LeftJoin("RetentionPoliciesChannels ON " + r.ChannelIDTable + ".ChannelId = RetentionPoliciesChannels.ChannelId").
			LeftJoin("RetentionPoliciesTeams ON Channels.TeamId = RetentionPoliciesTeams.TeamId").
			LeftJoin("RetentionPolicies ON RetentionPoliciesChannels.PolicyId = RetentionPolicies.Id").
			Where(sq.And{
				sq.Eq{"RetentionPoliciesChannels.PolicyId": nil},
				sq.Eq{"RetentionPoliciesTeams.PolicyId": nil},
			}).
			Where(sq.Lt{scopedTimeColumn: r.GlobalPolicyEndTime}).
			Limit(uint64(r.Limit))
		rowsAffected, err := genericRetentionPoliciesDeletion(globalPolicyBuilder, r, s)
		if err != nil {
			return 0, cursor, err
		}
		if rowsAffected < r.Limit {
			cursor.GlobalPoliciesDone = true
		}
		totalRowsAffected += rowsAffected
	}

	return totalRowsAffected, cursor, nil
}

// genericRetentionPoliciesDeletion actually executes the DELETE query using a sq.SelectBuilder
// which selects the rows to delete.
func genericRetentionPoliciesDeletion(
	builder sq.SelectBuilder,
	r RetentionPolicyBatchDeletionInfo,
	s *SqlStore,
) (rowsAffected int64, err error) {
	query, args, err := builder.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, r.Table+"_tosql")
	}

	if r.StoreDeletedIds {
		txn, err := s.GetMasterX().Beginx()
		if err != nil {
			return 0, err
		}
		defer finalizeTransactionX(txn, &err)

		if s.DriverName() == model.DatabaseDriverPostgres {
			primaryKeysStr := "(" + strings.Join(r.PrimaryKeys, ",") + ")"
			query = `
			DELETE FROM ` + r.Table + ` WHERE ` + primaryKeysStr + ` IN (
			` + query + `
			) RETURNING ` + r.Table + `.` + r.PrimaryKeys[0]
			var rows *sql.Rows
			rows, err = txn.Query(query, args...)
			if err != nil {
				return 0, errors.Wrap(err, "failed to delete "+r.Table)
			}

			defer rows.Close()
			ids := []string{}
			for rows.Next() {
				var id string
				if err = rows.Scan(&id); err != nil {
					return 0, errors.Wrap(err, "unable to scan from rows")
				}
				ids = append(ids, id)
			}
			if err = rows.Err(); err != nil {
				return 0, errors.Wrap(err, "failed while iterating over rows")
			}
			rowsAffected = int64(len(ids))

			if len(ids) > 0 {
				retentionIdsRow := model.RetentionIdsForDeletion{
					TableName: r.Table,
					Ids:       ids,
				}
				err = insertRetentionIdsForDeletion(txn, &retentionIdsRow, s)
				if err != nil {
					return 0, err
				}
			}
		} else {
			retentionIdsRow := model.RetentionIdsForDeletion{
				TableName: r.Table,
				Ids:       []string{},
			}
			// 1. Select rows that will be deleted
			if err = txn.Select(&retentionIdsRow.Ids, query, args...); err != nil {
				return 0, err
			}

			if len(retentionIdsRow.Ids) > 0 {
				err = insertRetentionIdsForDeletion(txn, &retentionIdsRow, s)
				if err != nil {
					return 0, err
				}

				// MySQL does not support the LIMIT clause in a subquery with IN
				clauses := make([]string, len(r.PrimaryKeys))
				for i, key := range r.PrimaryKeys {
					clauses[i] = r.Table + "." + key + " = A." + key
				}
				joinClause := strings.Join(clauses, " AND ")
				query = `
				DELETE ` + r.Table + ` FROM ` + r.Table + ` INNER JOIN (
				` + query + `
				) AS A ON ` + joinClause

				// 3. Delete from Parent table
				var result sql.Result
				result, err = txn.Exec(query, args...)
				if err != nil {
					return 0, errors.Wrap(err, "failed to delete "+r.Table)
				}

				rowsAffected, err = result.RowsAffected()
				if err != nil {
					return 0, errors.Wrap(err, "failed to get rows affected for "+r.Table)
				}
			}
		}
		if err = txn.Commit(); err != nil {
			return 0, err
		}
	} else {
		if s.DriverName() == model.DatabaseDriverPostgres {
			primaryKeysStr := "(" + strings.Join(r.PrimaryKeys, ",") + ")"
			query = `
			DELETE FROM ` + r.Table + ` WHERE ` + primaryKeysStr + ` IN (
			` + query + `
			)`
		} else {
			// MySQL does not support the LIMIT clause in a subquery with IN
			clauses := make([]string, len(r.PrimaryKeys))
			for i, key := range r.PrimaryKeys {
				clauses[i] = r.Table + "." + key + " = A." + key
			}
			joinClause := strings.Join(clauses, " AND ")
			query = `
			DELETE ` + r.Table + ` FROM ` + r.Table + ` INNER JOIN (
			` + query + `
			) AS A ON ` + joinClause
		}
		result, err := s.GetMasterX().Exec(query, args...)
		if err != nil {
			return 0, errors.Wrap(err, "failed to delete "+r.Table)
		}
		rowsAffected, err = result.RowsAffected()
		if err != nil {
			return 0, errors.Wrap(err, "failed to get rows affected for "+r.Table)
		}
	}
	return
}

func deleteFromRetentionIdsTx(txn *sqlxTxWrapper, id string) (err error) {
	if _, err := txn.Exec("DELETE FROM RetentionIdsForDeletion WHERE Id = ?", id); err != nil {
		return errors.Wrap(err, "Failed to delete from RetentionIdsForDeletion")
	}
	return nil
}
