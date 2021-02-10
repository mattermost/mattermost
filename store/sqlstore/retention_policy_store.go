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

type retentionPolicyRow struct {
	Id                     string
	DisplayName            string
	PostDuration           int64
	ChannelId              *string
	ChannelDisplayName     *string
	ChannelTeamDisplayName *string
	TeamId                 *string
	TeamDisplayName        *string
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

func (s *SqlRetentionPolicyStore) Save(policy *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, error) {
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

	rpSelectQuery, rpSelectProps = s.buildGetPolicyQuery(policy.Id)

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
	var rows []*retentionPolicyRow
	if _, err = txn.Select(&rows, rpSelectQuery, rpSelectProps); err != nil {
		return nil, err
	}
	newPolicy, err := s.getPolicyFromRows(rows, policy.Id)
	if err != nil {
		return nil, err
	}
	if err = txn.Commit(); err != nil {
		return nil, err
	}
	return newPolicy, nil
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

func (s *SqlRetentionPolicyStore) Patch(patch *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, error) {
	return s.Update(patch)
}

// Update updates the policy with the same ID as `update`. For each field of `update`, if that field
// has a zero value, then it will not be changed.
func (s *SqlRetentionPolicyStore) Update(update *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, error) {
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

	if err := s.checkTeamsExist(update.TeamIds); err != nil {
		return nil, err
	}
	if err := s.checkChannelsExist(update.ChannelIds); err != nil {
		return nil, err
	}

	if update.DisplayName != "" || update.PostDuration > 0 {
		builder := s.getQueryBuilder().Update("RetentionPolicies")
		if update.DisplayName != "" {
			builder = builder.Set("DisplayName", update.DisplayName)
		}
		if update.PostDuration > 0 {
			builder = builder.Set("PostDuration", update.PostDuration)
		}
		rpUpdateQuery, rpUpdateArgs, _ = builder.
			Where(sq.Eq{"Id": update.Id}).
			ToSql()
	}

	if update.ChannelIds != nil {
		rpcDeleteQuery, rpcDeleteArgs, _ = s.getQueryBuilder().
			Delete("RetentionPoliciesChannels").
			Where(sq.Eq{"PolicyId": update.Id}).
			ToSql()

		rpcInsertQuery, rpcInsertArgs = s.buildInsertRetentionPoliciesChannelsQuery(update.Id, update.ChannelIds)
	}

	if update.TeamIds != nil {
		rptDeleteQuery, rptDeleteArgs, _ = s.getQueryBuilder().
			Delete("RetentionPoliciesTeams").
			Where(sq.Eq{"PolicyId": update.Id}).
			ToSql()

		rptInsertQuery, rptInsertArgs = s.buildInsertRetentionPoliciesTeamsQuery(update.Id, update.TeamIds)
	}

	rpSelectQuery, rpSelectProps = s.buildGetPolicyQuery(update.Id)

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
	var rows []*retentionPolicyRow
	if _, err = txn.Select(&rows, rpSelectQuery, rpSelectProps); err != nil {
		return nil, err
	}
	txn.Commit()
	return s.getPolicyFromRows(rows, update.Id)
}

func (s *SqlRetentionPolicyStore) buildGetPolicyQuery(id string) (query string, props map[string]interface{}) {
	return s.buildGetPoliciesQuery(id, 0, 1)
}

// buildGetPoliciesQuery builds a query to select information for the policy with the specified
// ID, or, if `id` is the empty string, from all policies. The results returned will be sorted by
// policy display name and ID.
func (s *SqlRetentionPolicyStore) buildGetPoliciesQuery(id string, offset uint64, limit uint64) (query string, props map[string]interface{}) {
	props = map[string]interface{}{"Offset": offset, "Limit": limit}
	whereIdEqualsPolicyId := ""
	if id != "" {
		whereIdEqualsPolicyId = "WHERE Id = :PolicyId"
		props["PolicyId"] = id
	}
	rpSelectQuery := `
		SELECT Id, DisplayName, PostDuration
		FROM RetentionPolicies
		` + whereIdEqualsPolicyId + `
		ORDER BY DisplayName, Id
		LIMIT :Limit
		OFFSET :Offset`
	cte := ""
	rpTable := ""
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		cte = "WITH RP AS (" + rpSelectQuery + ")"
		rpTable = "RP"
	} else {
		// For MySQL, repeat the query twice
		rpTable = "(" + rpSelectQuery + ") AS RP"
	}
	query = cte + `
	SELECT RP.Id,
	       RP.DisplayName,
	       RP.PostDuration,
	       RetentionPoliciesChannels.ChannelId,
	       Channels.DisplayName AS ChannelDisplayName,
	       Teams.DisplayName AS ChannelTeamDisplayName,
	       NULL AS TeamId,
	       NULL AS TeamDisplayName
	FROM ` + rpTable + `
	LEFT JOIN RetentionPoliciesChannels ON RP.Id = RetentionPoliciesChannels.PolicyId
	LEFT JOIN Channels ON RetentionPoliciesChannels.ChannelId = Channels.Id
	LEFT JOIN Teams ON Channels.TeamId = Teams.Id

	UNION

	SELECT RP.Id,
	       RP.DisplayName,
	       RP.PostDuration,
	       NULL AS ChannelId,
	       NULL AS ChannelDisplayName,
	       NULL AS ChannelTeamDisplayName,
	       RetentionPoliciesTeams.TeamId,
	       Teams.DisplayName AS TeamDisplayName
	FROM ` + rpTable + `
	LEFT JOIN RetentionPoliciesTeams ON RP.Id = RetentionPoliciesTeams.PolicyId
	LEFT JOIN Teams ON RetentionPoliciesTeams.TeamId = Teams.Id
	
	ORDER BY DisplayName, Id`
	return
}

// getPoliciesFromRows builds enriched policy objects using rows obtained by a query from `buildGetPoliciesQuery`.
// The rows must be sorted by (DisplayName, Id).
func (s *SqlRetentionPolicyStore) getPoliciesFromRows(rows []*retentionPolicyRow) []*model.RetentionPolicyEnriched {
	policies := make([]*model.RetentionPolicyEnriched, 0)
	for _, row := range rows {
		var policy *model.RetentionPolicyEnriched
		size := len(policies)
		if size == 0 || policies[size-1].Id != row.Id {
			policy = &model.RetentionPolicyEnriched{
				RetentionPolicy: model.RetentionPolicy{
					Id:           row.Id,
					DisplayName:  row.DisplayName,
					PostDuration: row.PostDuration,
				},
				Channels: make([]model.ChannelDisplayInfo, 0),
				Teams:    make([]model.TeamDisplayInfo, 0),
			}
			policies = append(policies, policy)
		} else {
			policy = policies[size-1]
		}
		if row.ChannelId != nil {
			policy.Channels = append(
				policy.Channels, model.ChannelDisplayInfo{
					Id: *row.ChannelId, DisplayName: *row.ChannelDisplayName,
					TeamDisplayName: *row.ChannelTeamDisplayName})
		} else if row.TeamId != nil {
			policy.Teams = append(
				policy.Teams, model.TeamDisplayInfo{
					Id: *row.TeamId, DisplayName: *row.TeamDisplayName})
		}
	}
	return policies
}

func (s *SqlRetentionPolicyStore) getPolicyFromRows(rows []*retentionPolicyRow, policyID string) (*model.RetentionPolicyEnriched, error) {
	policies := s.getPoliciesFromRows(rows)
	if len(policies) == 0 {
		return nil, store.NewErrNotFound("RetentionPolicy", policyID)
	}
	return policies[0], nil
}

func (s *SqlRetentionPolicyStore) Get(id string) (*model.RetentionPolicyEnriched, error) {
	query, props := s.buildGetPolicyQuery(id)
	var rows []*retentionPolicyRow
	_, err := s.GetReplica().Select(&rows, query, props)
	if err != nil {
		return nil, err
	}
	policy, err := s.getPolicyFromRows(rows, id)
	if err != nil {
		return nil, err
	}
	return policy, nil
}

func (s *SqlRetentionPolicyStore) GetAll(offset, limit uint64) ([]*model.RetentionPolicyEnriched, error) {
	query, props := s.buildGetPoliciesQuery("", offset, limit)
	var rows []*retentionPolicyRow
	_, err := s.GetReplica().Select(&rows, query, props)
	if err != nil {
		return nil, err
	}
	policies := s.getPoliciesFromRows(rows)
	return policies, nil
}

func (s *SqlRetentionPolicyStore) GetAllWithCounts(offset, limit uint64) ([]*model.RetentionPolicyWithCounts, error) {
	props := map[string]interface{}{"Offset": offset, "Limit": limit}
	rpSelectQuery := `
		SELECT Id, DisplayName, PostDuration
		FROM RetentionPolicies
		ORDER BY DisplayName, Id
		LIMIT :Limit
		OFFSET :Offset`
	cte := ""
	rpTable := ""
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		cte = "WITH RP AS (" + rpSelectQuery + ")"
		rpTable = "RP"
	} else {
		// For MySQL, repeat the query twice
		rpTable = "(" + rpSelectQuery + ") AS RP"
	}
	query := cte + `
	SELECT Id,
	       DisplayName,
	       PostDuration,
	       SUM(CASE WHEN ChannelId IS NOT NULL THEN 1 ELSE 0 END) AS ChannelCount,
	       SUM(CASE WHEN TeamId IS NOT NULL THEN 1 ELSE 0 END) AS TeamCount
	FROM (
		SELECT RP.Id,
		       RP.DisplayName,
		       RP.PostDuration,
		       RetentionPoliciesChannels.ChannelId,
		       NULL AS TeamId
		FROM ` + rpTable + `
		LEFT JOIN RetentionPoliciesChannels ON RP.Id = RetentionPoliciesChannels.PolicyId
		UNION
		SELECT RP.Id,
		       RP.DisplayName,
		       RP.PostDuration,
		       NULL AS ChannelId,
		       RetentionPoliciesTeams.TeamId
		FROM ` + rpTable + `
		LEFT JOIN RetentionPoliciesTeams ON RP.Id = RetentionPoliciesTeams.PolicyId
	) AS A
	GROUP BY Id, DisplayName, PostDuration
	ORDER BY DisplayName, Id`
	var rows []*model.RetentionPolicyWithCounts
	_, err := s.GetReplica().Select(&rows, query, props)
	return rows, err
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

// RemoveStaleRows removes entries from RetentionPoliciesChannels and RetentionPoliciesTeams
// where a channel or team no longer exists.
func (s *SqlRetentionPolicyStore) RemoveStaleRows() error {
	// We need the extra level of nesting to deal with MySQL's locking
	const rpcDeleteQuery = `
	DELETE FROM RetentionPoliciesChannels WHERE ChannelId IN (
		SELECT * FROM (
			SELECT ChannelId FROM RetentionPoliciesChannels
			LEFT JOIN Channels ON RetentionPoliciesChannels.ChannelId = Channels.Id
			WHERE Channels.Id IS NULL
		) AS A
	)`
	const rptDeleteQuery = `
	DELETE FROM RetentionPoliciesTeams WHERE TeamId IN (
		SELECT * FROM (
			SELECT TeamId FROM RetentionPoliciesTeams
			LEFT JOIN Teams ON RetentionPoliciesTeams.TeamId = Teams.Id
			WHERE Teams.Id IS NULL
		) AS A
	)`
	_, err := s.GetMaster().Exec(rpcDeleteQuery)
	if err != nil {
		return err
	}
	_, err = s.GetMaster().Exec(rptDeleteQuery)
	return err
}
