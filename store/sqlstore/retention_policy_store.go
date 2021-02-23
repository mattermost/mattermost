// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"errors"

	sq "github.com/Masterminds/squirrel"
	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlRetentionPolicyStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface
}

func newSqlRetentionPolicyStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.RetentionPolicyStore {
	s := &SqlRetentionPolicyStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.RetentionPolicy{}, "RetentionPolicies")
		table.SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("DisplayName").SetMaxSize(64)

		tableC := db.AddTableWithName(model.RetentionPolicyChannel{}, "RetentionPoliciesChannels")
		tableC.SetKeys(false, "ChannelId")
		tableC.ColMap("PolicyId").SetMaxSize(26)
		tableC.ColMap("ChannelId").SetMaxSize(26)

		tableT := db.AddTableWithName(model.RetentionPolicyTeam{}, "RetentionPoliciesTeams")
		tableT.SetKeys(false, "TeamId")
		tableT.ColMap("PolicyId").SetMaxSize(26)
		tableT.ColMap("TeamId").SetMaxSize(26)
	}

	return s
}

func (s *SqlRetentionPolicyStore) createIndexesIfNotExists() {
	s.CreateCompositeIndexIfNotExists("IDX_RetentionPolicies_DisplayName_Id", "RetentionPolicies",
		[]string{"DisplayName", "Id"})
	s.CreateIndexIfNotExists("IDX_RetentionPoliciesChannels_PolicyId", "RetentionPoliciesChannels", "PolicyId")
	s.CreateIndexIfNotExists("IDX_RetentionPoliciesTeams_PolicyId", "RetentionPoliciesTeams", "PolicyId")
	s.CreateCheckConstraintIfNotExists("RetentionPolicies", "PostDuration", "PostDuration > 0")
	s.CreateForeignKeyIfNotExists("RetentionPoliciesChannels", "PolicyId", "RetentionPolicies", "Id", true)
	s.CreateForeignKeyIfNotExists("RetentionPoliciesTeams", "PolicyId", "RetentionPolicies", "Id", true)
}

// executePossiblyEmptyQuery only executes the query if it is non-empty. This helps avoid
// having to check for MySQL, which, unlike Postgres, does not allow empty queries.
func executePossiblyEmptyQuery(txn *gorp.Transaction, query string, args ...interface{}) (sql.Result, error) {
	if query == "" {
		return nil, nil
	}
	return txn.Exec(query, args...)
}

func (s *SqlRetentionPolicyStore) Save(policy *model.RetentionPolicyWithTeamAndChannelIds) (*model.RetentionPolicyWithTeamAndChannelCounts, error) {
	// Strategy:
	// 1. Insert new policy
	// 2. Insert new channels into policy
	// 3. Insert new teams into policy
	var (
		rpInsertQuery  string
		rpInsertArgs   []interface{}
		rpcInsertQuery string
		rpcInsertArgs  []interface{}
		rptInsertQuery string
		rptInsertArgs  []interface{}
		rpSelectQuery  string
		rpSelectProps  map[string]interface{}
	)

	if err := s.checkTeamsExist(policy.TeamIds); err != nil {
		return nil, err
	}
	if err := s.checkChannelsExist(policy.ChannelIds); err != nil {
		return nil, err
	}

	policy.Id = model.NewId()

	rpInsertQuery, rpInsertArgs, _ = s.getQueryBuilder().
		Insert("RetentionPolicies").
		Columns("Id", "DisplayName", "PostDuration").
		Values(policy.Id, policy.DisplayName, policy.PostDuration).
		ToSql()

	rpcInsertQuery, rpcInsertArgs = s.buildInsertRetentionPoliciesChannelsQuery(policy.Id, policy.ChannelIds)

	rptInsertQuery, rptInsertArgs = s.buildInsertRetentionPoliciesTeamsQuery(policy.Id, policy.TeamIds)

	rpSelectQuery, rpSelectProps = s.buildGetPolicyWithCountsQuery(policy.Id)

	txn, err := s.GetMaster().Begin()
	if err != nil {
		return nil, err
	}
	defer finalizeTransaction(txn)
	if _, err = txn.Exec(rpInsertQuery, rpInsertArgs...); err != nil {
		return nil, err
	}
	if _, err = executePossiblyEmptyQuery(txn, rpcInsertQuery, rpcInsertArgs...); err != nil {
		return nil, err
	}
	if _, err = executePossiblyEmptyQuery(txn, rptInsertQuery, rptInsertArgs...); err != nil {
		return nil, err
	}
	var newPolicy model.RetentionPolicyWithTeamAndChannelCounts
	if err = txn.SelectOne(&newPolicy, rpSelectQuery, rpSelectProps); err != nil {
		return nil, err
	}
	if err = txn.Commit(); err != nil {
		return nil, err
	}
	return &newPolicy, nil
}

func (s *SqlRetentionPolicyStore) checkTeamsExist(teamIds []string) error {
	if len(teamIds) > 0 {
		teamIdsMap := make(map[string]bool)
		for _, teamId := range teamIds {
			teamIdsMap[teamId] = false
		}
		teamsSelectQuery, teamSelectArgs, _ := s.getQueryBuilder().
			Select("Id").
			From("Teams").
			Where(inStrings("Id", teamIds)).
			ToSql()
		var rows []*string
		_, err := s.GetReplica().Select(&rows, teamsSelectQuery, teamSelectArgs...)
		if err != nil {
			return err
		}
		for _, teamId := range rows {
			delete(teamIdsMap, *teamId)
		}
		for teamId := range teamIdsMap {
			return store.NewErrNotFound("Team", teamId)
		}
	}
	return nil
}

func (s *SqlRetentionPolicyStore) checkChannelsExist(channelIds []string) error {
	if len(channelIds) > 0 {
		channelIdsMap := make(map[string]bool)
		for _, channelId := range channelIds {
			channelIdsMap[channelId] = false
		}
		channelSelectQuery, channelSelectArgs, _ := s.getQueryBuilder().
			Select("Id").
			From("Channels").
			Where(inStrings("Id", channelIds)).
			ToSql()
		var rows []*string
		_, err := s.GetReplica().Select(&rows, channelSelectQuery, channelSelectArgs...)
		if err != nil {
			return err
		}
		for _, channelId := range rows {
			delete(channelIdsMap, *channelId)
		}
		for channelId := range channelIdsMap {
			return store.NewErrNotFound("Channel", channelId)
		}
	}
	return nil
}

func (s *SqlRetentionPolicyStore) buildInsertRetentionPoliciesChannelsQuery(policyId string, channelIds []string) (query string, args []interface{}) {
	if len(channelIds) > 0 {
		builder := s.getQueryBuilder().
			Insert("RetentionPoliciesChannels").
			Columns("PolicyId", "ChannelId")
		for _, channelId := range channelIds {
			builder = builder.Values(policyId, channelId)
		}
		query, args, _ = builder.ToSql()
	}
	return
}

func (s *SqlRetentionPolicyStore) buildInsertRetentionPoliciesTeamsQuery(policyId string, teamIds []string) (query string, args []interface{}) {
	if len(teamIds) > 0 {
		builder := s.getQueryBuilder().
			Insert("RetentionPoliciesTeams").
			Columns("PolicyId", "TeamId")
		for _, teamId := range teamIds {
			builder = builder.Values(policyId, teamId)
		}
		query, args, _ = builder.ToSql()
	}
	return
}

func (s *SqlRetentionPolicyStore) Patch(patch *model.RetentionPolicyWithTeamAndChannelIds) (*model.RetentionPolicyWithTeamAndChannelCounts, error) {
	// Strategy:
	// 1. Update policy attributes
	// 2. Delete existing channels in policy
	// 3. Insert new channels into policy
	// 4. Delete existing teams in policy
	// 5. Insert new teams into policy
	// 6. Read new policy
	var (
		rpUpdateQuery  string
		rpUpdateArgs   []interface{}
		rpcDeleteQuery string
		rpcDeleteArgs  []interface{}
		rpcInsertQuery string
		rpcInsertArgs  []interface{}
		rptInsertQuery string
		rptInsertArgs  []interface{}
		rptDeleteQuery string
		rptDeleteArgs  []interface{}
		rpSelectQuery  string
		rpSelectProps  map[string]interface{}
	)

	if err := s.checkTeamsExist(patch.TeamIds); err != nil {
		return nil, err
	}
	if err := s.checkChannelsExist(patch.ChannelIds); err != nil {
		return nil, err
	}

	if patch.DisplayName != "" || patch.PostDuration > 0 {
		builder := s.getQueryBuilder().Update("RetentionPolicies")
		if patch.DisplayName != "" {
			builder = builder.Set("DisplayName", patch.DisplayName)
		}
		if patch.PostDuration > 0 {
			builder = builder.Set("PostDuration", patch.PostDuration)
		}
		rpUpdateQuery, rpUpdateArgs, _ = builder.
			Where(sq.Eq{"Id": patch.Id}).
			ToSql()
	}

	if patch.ChannelIds != nil {
		rpcDeleteQuery, rpcDeleteArgs, _ = s.getQueryBuilder().
			Delete("RetentionPoliciesChannels").
			Where(sq.Eq{"PolicyId": patch.Id}).
			ToSql()

		rpcInsertQuery, rpcInsertArgs = s.buildInsertRetentionPoliciesChannelsQuery(patch.Id, patch.ChannelIds)
	}

	if patch.TeamIds != nil {
		rptDeleteQuery, rptDeleteArgs, _ = s.getQueryBuilder().
			Delete("RetentionPoliciesTeams").
			Where(sq.Eq{"PolicyId": patch.Id}).
			ToSql()

		rptInsertQuery, rptInsertArgs = s.buildInsertRetentionPoliciesTeamsQuery(patch.Id, patch.TeamIds)
	}

	rpSelectQuery, rpSelectProps = s.buildGetPolicyWithCountsQuery(patch.Id)

	txn, err := s.GetMaster().Begin()
	if err != nil {
		return nil, err
	}
	defer finalizeTransaction(txn)
	if _, err = executePossiblyEmptyQuery(txn, rpUpdateQuery, rpUpdateArgs...); err != nil {
		return nil, err
	}
	if _, err = executePossiblyEmptyQuery(txn, rpcDeleteQuery, rpcDeleteArgs...); err != nil {
		return nil, err
	}
	if _, err = executePossiblyEmptyQuery(txn, rpcInsertQuery, rpcInsertArgs...); err != nil {
		return nil, err
	}
	if _, err = executePossiblyEmptyQuery(txn, rptDeleteQuery, rptDeleteArgs...); err != nil {
		return nil, err
	}
	if _, err = executePossiblyEmptyQuery(txn, rptInsertQuery, rptInsertArgs...); err != nil {
		return nil, err
	}
	var newPolicy model.RetentionPolicyWithTeamAndChannelCounts
	if err = txn.SelectOne(&newPolicy, rpSelectQuery, rpSelectProps); err != nil {
		return nil, err
	}
	if err = txn.Commit(); err != nil {
		return nil, err
	}
	return &newPolicy, nil
}

func (s *SqlRetentionPolicyStore) buildGetPolicyWithCountsQuery(id string) (query string, props map[string]interface{}) {
	return s.buildGetPoliciesWithCountsQuery(id, 0, 1)
}

// buildGetPoliciesWithCountsQuery builds a query to select information for the policy with the specified
// ID, or, if `id` is the empty string, from all policies. The results returned will be sorted by
// policy display name and ID.
func (s *SqlRetentionPolicyStore) buildGetPoliciesWithCountsQuery(id string, offset, limit int) (query string, props map[string]interface{}) {
	props = map[string]interface{}{"Offset": offset, "Limit": limit}
	whereIdEqualsPolicyId := ""
	if id != "" {
		whereIdEqualsPolicyId = "WHERE RetentionPolicies.Id = :PolicyId"
		props["PolicyId"] = id
	}
	query = `
	SELECT RetentionPolicies.Id,
	       RetentionPolicies.DisplayName,
	       RetentionPolicies.PostDuration,
	       A.Count AS ChannelCount,
	       B.Count AS TeamCount
	FROM RetentionPolicies
	INNER JOIN (
		SELECT RetentionPolicies.Id,
		       COUNT(RetentionPoliciesChannels.ChannelId) AS Count
		FROM RetentionPolicies
		LEFT JOIN RetentionPoliciesChannels ON RetentionPolicies.Id = RetentionPoliciesChannels.PolicyId
		` + whereIdEqualsPolicyId + `
		GROUP BY RetentionPolicies.Id
		ORDER BY RetentionPolicies.DisplayName, RetentionPolicies.Id
		LIMIT :Limit
		OFFSET :Offset
	) AS A ON RetentionPolicies.Id = A.Id
	INNER JOIN (
		SELECT RetentionPolicies.Id,
		       COUNT(RetentionPoliciesTeams.TeamId) AS Count
		FROM RetentionPolicies
		LEFT JOIN RetentionPoliciesTeams ON RetentionPolicies.Id = RetentionPoliciesTeams.PolicyId
		` + whereIdEqualsPolicyId + `
		GROUP BY RetentionPolicies.Id
		ORDER BY RetentionPolicies.DisplayName, RetentionPolicies.Id
		LIMIT :Limit
		OFFSET :Offset
	) AS B ON RetentionPolicies.Id = B.Id
	ORDER BY RetentionPolicies.DisplayName, RetentionPolicies.Id`
	return
}

func (s *SqlRetentionPolicyStore) Get(id string) (*model.RetentionPolicyWithTeamAndChannelCounts, error) {
	query, props := s.buildGetPolicyWithCountsQuery(id)
	var policy model.RetentionPolicyWithTeamAndChannelCounts
	if err := s.GetReplica().SelectOne(&policy, query, props); err != nil {
		return nil, err
	}
	return &policy, nil
}

func (s *SqlRetentionPolicyStore) GetAll(offset, limit int) (policies []*model.RetentionPolicyWithTeamAndChannelCounts, err error) {
	query, props := s.buildGetPoliciesWithCountsQuery("", offset, limit)
	_, err = s.GetReplica().Select(&policies, query, props)
	return
}

func (s *SqlRetentionPolicyStore) GetCount() (int64, error) {
	return s.GetReplica().SelectInt("SELECT COUNT(*) FROM RetentionPolicies")
}

func (s *SqlRetentionPolicyStore) Delete(id string) error {
	builder := s.getQueryBuilder().
		Delete("RetentionPolicies").
		Where(sq.Eq{"Id": id})
	result, err := builder.RunWith(s.GetMaster()).Exec()
	if err != nil {
		return err
	}
	numRowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	} else if numRowsAffected == 0 {
		return errors.New("policy not found")
	}
	return nil
}

func (s *SqlRetentionPolicyStore) GetChannels(policyId string, offset, limit int) (channels []*model.Channel, err error) {
	const query = `
	SELECT Channels.* FROM RetentionPoliciesChannels
	INNER JOIN Channels ON RetentionPoliciesChannels.ChannelId = Channels.Id
	WHERE RetentionPoliciesChannels.PolicyId = :PolicyId
	ORDER BY Channels.DisplayName, Channels.Id
	LIMIT :Limit
	OFFSET :Offset`
	props := map[string]interface{}{"PolicyId": policyId, "Limit": limit, "Offset": offset}
	_, err = s.GetReplica().Select(&channels, query, props)
	return
}

func (s *SqlRetentionPolicyStore) AddChannels(policyId string, channelIds []string) error {
	if len(channelIds) == 0 {
		return nil
	}
	if err := s.checkChannelsExist(channelIds); err != nil {
		return err
	}
	builder := s.getQueryBuilder().
		Insert("RetentionPoliciesChannels").
		Columns("policyId", "channelId")
	for _, channelId := range channelIds {
		builder = builder.Values(policyId, channelId)
	}
	_, err := builder.RunWith(s.GetMaster()).Exec()
	if err != nil {
		// check FK constraint violation
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23503" {
			return store.NewErrNotFound("RetentionPolicy", policyId)
		} else if mysqlErr, ok := err.(*mysql.MySQLError); ok && mysqlErr.Number == 0x5ac {
			return store.NewErrNotFound("RetentionPolicy", policyId)
		}
	}
	return err
}

func (s *SqlRetentionPolicyStore) RemoveChannels(policyId string, channelIds []string) error {
	if len(channelIds) == 0 {
		return nil
	}
	builder := s.getQueryBuilder().
		Delete("RetentionPoliciesChannels").
		Where(sq.And{
			sq.Eq{"PolicyId": policyId},
			inStrings("ChannelId", channelIds),
		})
	_, err := builder.RunWith(s.GetMaster()).Exec()
	return err
}

func (s *SqlRetentionPolicyStore) GetTeams(policyId string, offset, limit int) (teams []*model.Team, err error) {
	const query = `
	SELECT Teams.* FROM RetentionPoliciesTeams
	INNER JOIN Teams ON RetentionPoliciesTeams.TeamId = Teams.Id
	WHERE RetentionPoliciesTeams.PolicyId = :PolicyId
	ORDER BY Teams.DisplayName, Teams.Id
	LIMIT :Limit
	OFFSET :Offset`
	props := map[string]interface{}{"PolicyId": policyId, "Limit": limit, "Offset": offset}
	_, err = s.GetReplica().Select(&teams, query, props)
	return
}

func (s *SqlRetentionPolicyStore) AddTeams(policyId string, teamIds []string) error {
	if len(teamIds) == 0 {
		return nil
	}
	if err := s.checkTeamsExist(teamIds); err != nil {
		return err
	}
	builder := s.getQueryBuilder().
		Insert("RetentionPoliciesTeams").
		Columns("PolicyId", "TeamId")
	for _, teamId := range teamIds {
		builder = builder.Values(policyId, teamId)
	}
	_, err := builder.RunWith(s.GetMaster()).Exec()
	return err
}

func (s *SqlRetentionPolicyStore) RemoveTeams(policyId string, teamIds []string) error {
	if len(teamIds) == 0 {
		return nil
	}
	builder := s.getQueryBuilder().
		Delete("RetentionPoliciesTeams").
		Where(sq.And{
			sq.Eq{"PolicyId": policyId},
			inStrings("TeamId", teamIds),
		})
	_, err := builder.RunWith(s.GetMaster()).Exec()
	return err
}

// DeleteOrphanedRows removes entries from RetentionPoliciesChannels and RetentionPoliciesTeams
// where a channel or team no longer exists.
func (s *SqlRetentionPolicyStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
	// We need the extra level of nesting to deal with MySQL's locking
	const rpcDeleteQuery = `
	DELETE FROM RetentionPoliciesChannels WHERE ChannelId IN (
		SELECT * FROM (
			SELECT ChannelId FROM RetentionPoliciesChannels
			LEFT JOIN Channels ON RetentionPoliciesChannels.ChannelId = Channels.Id
			WHERE Channels.Id IS NULL
			LIMIT :Limit
		) AS A
	)`
	const rptDeleteQuery = `
	DELETE FROM RetentionPoliciesTeams WHERE TeamId IN (
		SELECT * FROM (
			SELECT TeamId FROM RetentionPoliciesTeams
			LEFT JOIN Teams ON RetentionPoliciesTeams.TeamId = Teams.Id
			WHERE Teams.Id IS NULL
			LIMIT :Limit
		) AS A
	)`
	props := map[string]interface{}{"Limit": limit}
	result, err := s.GetMaster().Exec(rpcDeleteQuery, props)
	if err != nil {
		return
	}
	rpcDeleted, err := result.RowsAffected()
	if err != nil {
		return
	}
	result, err = s.GetMaster().Exec(rptDeleteQuery, props)
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
