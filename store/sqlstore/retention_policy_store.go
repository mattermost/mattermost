package sqlstore

import (
	"errors"

	sq "github.com/Masterminds/squirrel"
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
	s.CreateCheckConstraintIfNotExists("RetentionPolicies", "PostDuration", "PostDuration > 0")
	s.CreateForeignKeyIfNotExists("RetentionPoliciesChannels", "PolicyId", "RetentionPolicies", "Id", true)
	s.CreateForeignKeyIfNotExists("RetentionPoliciesChannels", "ChannelId", "Channels", "Id", true)
	s.CreateForeignKeyIfNotExists("RetentionPoliciesTeams", "PolicyId", "RetentionPolicies", "Id", true)
	s.CreateForeignKeyIfNotExists("RetentionPoliciesTeams", "TeamId", "Teams", "Id", true)
}

// TODO: check whether the raw queries work with MySQL and SQLite (only tested with PostgreSQL)

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
		rpSelectProps  map[string]string
	)
	policy.Id = model.NewId()

	rpInsertQuery, rpInsertArgs, _ = s.getQueryBuilder().
		Insert("RetentionPolicies").
		Columns("Id", "DisplayName", "PostDuration").
		Values(policy.Id, policy.DisplayName, policy.PostDuration).
		ToSql()

	if len(policy.ChannelIds) > 0 {
		builder := s.getQueryBuilder().
			Insert("RetentionPoliciesChannels").
			Columns("PolicyId", "ChannelId")
		for _, channelId := range policy.ChannelIds {
			builder = builder.Values(policy.Id, channelId)
		}
		rpcInsertQuery, rpcInsertArgs, _ = builder.ToSql()
	}

	if len(policy.TeamIds) > 0 {
		builder := s.getQueryBuilder().
			Insert("RetentionPoliciesTeams").
			Columns("PolicyId", "TeamId")
		for _, teamId := range policy.TeamIds {
			builder = builder.Values(policy.Id, teamId)
		}
		rptInsertQuery, rptInsertArgs, _ = builder.ToSql()
	}

	rpSelectQuery, rpSelectProps = s.buildGetPoliciesQuery(policy.Id)

	txn, err := s.GetMaster().Begin()
	if err != nil {
		return nil, err
	}
	defer finalizeTransaction(txn)
	_, err = txn.Exec(rpInsertQuery, rpInsertArgs...)
	if err != nil {
		return nil, err
	}
	_, err = txn.Exec(rpcInsertQuery, rpcInsertArgs...)
	if err != nil {
		return nil, err
	}
	_, err = txn.Exec(rptInsertQuery, rptInsertArgs...)
	if err != nil {
		return nil, err
	}
	var rows []*retentionPolicyRow
	_, err = txn.Select(&rows, rpSelectQuery, rpSelectProps)
	if err != nil {
		return nil, err
	}
	err = txn.Commit()
	if err != nil {
		return nil, err
	}
	newPolicy, err := s.getPolicyFromRows(rows)
	if err != nil {
		return nil, err
	}
	return newPolicy, nil
}

func (s *SqlRetentionPolicyStore) Patch(patch *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, error) {
	return s.Update(patch)
}

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
		rpSelectProps  map[string]string
	)
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
		if len(update.ChannelIds) > 0 {
			builder := s.getQueryBuilder().
				Insert("RetentionPoliciesChannels").
				Columns("PolicyId", "ChannelId")
			for _, channelId := range update.ChannelIds {
				builder = builder.Values(update.Id, channelId)
			}
			rpcInsertQuery, rpcInsertArgs, _ = builder.ToSql()
		}
	}

	if update.TeamIds != nil {
		rptDeleteQuery, rptDeleteArgs, _ = s.getQueryBuilder().
			Delete("RetentionPoliciesTeams").
			Where(sq.Eq{"PolicyId": update.Id}).
			ToSql()
		if len(update.TeamIds) > 0 {
			builder := s.getQueryBuilder().
				Insert("RetentionPoliciesTeams").
				Columns("PolicyId", "TeamId")
			for _, teamId := range update.TeamIds {
				builder = builder.Values(update.Id, teamId)
			}
			rptInsertQuery, rptInsertArgs, _ = builder.ToSql()
		}
	}

	rpSelectQuery, rpSelectProps = s.buildGetPoliciesQuery(update.Id)

	txn, err := s.GetMaster().Begin()
	if err != nil {
		return nil, err
	}
	defer finalizeTransaction(txn)
	_, err = txn.Exec(rpUpdateQuery, rpUpdateArgs...)
	if err != nil {
		return nil, err
	}
	_, err = txn.Exec(rpcDeleteQuery, rpcDeleteArgs...)
	if err != nil {
		return nil, err
	}
	_, err = txn.Exec(rpcInsertQuery, rpcInsertArgs...)
	if err != nil {
		return nil, err
	}
	_, err = txn.Exec(rptDeleteQuery, rptDeleteArgs...)
	if err != nil {
		return nil, err
	}
	_, err = txn.Exec(rptInsertQuery, rptInsertArgs...)
	if err != nil {
		return nil, err
	}
	var rows []*retentionPolicyRow
	_, err = txn.Select(&rows, rpSelectQuery, rpSelectProps)
	if err != nil {
		return nil, err
	}
	txn.Commit()
	newPolicy, err := s.getPolicyFromRows(rows)
	if err != nil {
		return nil, err
	}
	return newPolicy, nil
}

func (s *SqlRetentionPolicyStore) buildGetPoliciesQuery(id string) (string, map[string]string) {
	props := map[string]string{}
	rpcBuilder := s.getQueryBuilder().
		Select(`A.Id, A.DisplayName, A.PostDuration, B.ChannelId, C.DisplayName AS ChannelDisplayName,
			D.DisplayName AS ChannelTeamDisplayName, NULL AS TeamId, NULL AS TeamDisplayName`).
		From("RetentionPolicies AS A").
		LeftJoin("RetentionPoliciesChannels AS B ON A.Id = B.PolicyId").
		LeftJoin("Channels AS C ON B.ChannelId = C.Id").
		LeftJoin("Teams AS D ON C.TeamId = D.Id")
	rptBuilder := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select(`A.Id, A.DisplayName, A.PostDuration, NULL AS ChannelId, NULL AS ChannelDisplayName,
			NULL AS ChannelTeamDisplayName, E.TeamId, F.DisplayName AS TeamDisplayName`).
		From("RetentionPolicies AS A").
		LeftJoin("RetentionPoliciesTeams AS E ON A.Id = E.PolicyId").
		LeftJoin("Teams AS F ON E.TeamId = F.Id")
	if id != "" {
		rpcBuilder = rpcBuilder.Where("A.Id = :policyId")
		rptBuilder = rptBuilder.Where("A.id = :policyId")
		props["policyId"] = id
	}
	sChannelQuery, _, _ := rpcBuilder.ToSql()
	sTeamQuery, _, _ := rptBuilder.ToSql()
	query := sChannelQuery + " UNION " + sTeamQuery
	return query, props
}

func (s *SqlRetentionPolicyStore) getPoliciesFromRows(rows []*retentionPolicyRow) []*model.RetentionPolicyEnriched {
	mPolicies := make(map[string]*model.RetentionPolicyEnriched)
	for _, row := range rows {
		policy, ok := mPolicies[row.Id]
		if !ok {
			policy = &model.RetentionPolicyEnriched{
				RetentionPolicy: model.RetentionPolicy{
					Id:           row.Id,
					DisplayName:  row.DisplayName,
					PostDuration: row.PostDuration,
				},
				Channels: make([]model.ChannelDisplayInfo, 0),
				Teams:    make([]model.TeamDisplayInfo, 0),
			}
			mPolicies[row.Id] = policy
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
	aPolicies := make([]*model.RetentionPolicyEnriched, len(mPolicies))
	i := 0
	for _, policy := range mPolicies {
		aPolicies[i] = policy
		i++
	}
	return aPolicies
}

func (s *SqlRetentionPolicyStore) getPolicyFromRows(rows []*retentionPolicyRow) (*model.RetentionPolicyEnriched, error) {
	policies := s.getPoliciesFromRows(rows)
	if len(policies) == 0 {
		return nil, errors.New("policy not found")
	}
	return policies[0], nil
}

func (s *SqlRetentionPolicyStore) Get(id string) (*model.RetentionPolicyEnriched, error) {
	query, props := s.buildGetPoliciesQuery(id)
	var rows []*retentionPolicyRow
	_, err := s.GetReplica().Select(&rows, query, props)
	if err != nil {
		return nil, err
	}
	policy, err := s.getPolicyFromRows(rows)
	if err != nil {
		return nil, err
	}
	return policy, nil
}

func (s *SqlRetentionPolicyStore) GetAll() ([]*model.RetentionPolicyEnriched, error) {
	query, props := s.buildGetPoliciesQuery("")
	var rows []*retentionPolicyRow
	_, err := s.GetReplica().Select(&rows, query, props)
	if err != nil {
		return nil, err
	}
	policies := s.getPoliciesFromRows(rows)
	return policies, nil
}

func (s *SqlRetentionPolicyStore) GetAllWithCounts() ([]*model.RetentionPolicyWithCounts, error) {
	const sQuery = `
	SELECT Id, DisplayName, PostDuration,
		SUM(CASE WHEN ChannelId IS NOT NULL THEN 1 ELSE 0 END) AS ChannelCount,
		SUM(CASE WHEN TeamId IS NOT NULL THEN 1 ELSE 0 END) AS TeamCount
	FROM (
		SELECT A.Id, A.DisplayName, A.PostDuration, B.ChannelId, NULL AS TeamId
		FROM RetentionPolicies AS A
		LEFT JOIN RetentionPoliciesChannels AS B ON A.Id = B.PolicyId
		UNION
		SELECT A.Id, A.DisplayName, A.PostDuration, NULL AS ChannelId, C.TeamId
		FROM RetentionPolicies AS A
		LEFT JOIN RetentionPoliciesTeams AS C ON A.Id = C.PolicyId
	) AS D
	GROUP BY Id, DisplayName, PostDuration`
	var rows []*model.RetentionPolicyWithCounts
	_, err := s.GetReplica().Select(&rows, sQuery)
	return rows, err
}

func (s *SqlRetentionPolicyStore) Delete(id string) error {
	builder := s.getQueryBuilder().
		Delete("RetentionPolicies").
		Where("Id = ?", id)
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
	builder := s.getQueryBuilder().
		Insert("RetentionPoliciesChannels").
		Columns("policyId", "channelId")
	for _, channelId := range channelIds {
		builder = builder.Values(policyId, channelId)
	}
	_, err := builder.RunWith(s.GetMaster()).Exec()
	return err
}

func (s *SqlRetentionPolicyStore) RemoveChannels(policyId string, channelIds []string) error {
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
	builder := s.getQueryBuilder().
		Delete("RetentionPoliciesTeams").
		Where(sq.And{
			sq.Eq{"PolicyId": policyId},
			inStrings("TeamId", teamIds),
		})
	_, err := builder.RunWith(s.GetMaster()).Exec()
	return err
}
