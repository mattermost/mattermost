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
		table.ColMap("DisplayName").SetMaxSize(26)

		tableC := db.AddTableWithName(model.RetentionPolicyChannel{}, "RetentionPoliciesChannels")
		tableC.SetKeys(false, "ChannelId")
		tableC.ColMap("PolicyId").SetMaxSize(26)
		tableC.ColMap("ChannelId").SetMaxSize(26)

		tableP := db.AddTableWithName(model.RetentionPolicyTeam{}, "RetentionPoliciesTeams")
		tableP.SetKeys(false, "TeamId")
		tableP.ColMap("PolicyId").SetMaxSize(26)
		tableP.ColMap("TeamId").SetMaxSize(26)
	}

	return s
}

func (s *SqlRetentionPolicyStore) createIndexesIfNotExists() {
	s.CreateForeignKeyIfNotExists("RetentionPoliciesChannels", "PolicyId", "RetentionPolicies", "Id", true)
	s.CreateForeignKeyIfNotExists("RetentionPoliciesChannels", "ChannelId", "Channels", "Id", true)
	s.CreateForeignKeyIfNotExists("RetentionPoliciesTeams", "PolicyId", "RetentionPolicies", "Id", true)
	s.CreateForeignKeyIfNotExists("RetentionPoliciesTeams", "TeamId", "Teams", "Id", true)
}

// TODO: check whether the raw queries work with MySQL and SQLite (only tested with PostgreSQL)

func (s *SqlRetentionPolicyStore) Save(policy *model.RetentionPolicy) (*model.RetentionPolicy, error) {
	policy.Id = model.NewId()
	builder := s.getQueryBuilder().
		Insert("RetentionPolicies").
		Columns("Id", "DisplayName", "PostDuration").
		Values(policy.Id, policy.DisplayName, policy.PostDuration)
	_, err := builder.RunWith(s.GetMaster()).Exec()
	return policy, err
}

func (s *SqlRetentionPolicyStore) Patch(policy *model.RetentionPolicy) (*model.RetentionPolicy, error) {
	builder := s.getQueryBuilder().Update("RetentionPolicies")
	if policy.DisplayName != "" {
		builder = builder.Set("DisplayName", policy.DisplayName)
	}
	if policy.PostDuration != 0 {
		builder = builder.Set("PostDuration", policy.PostDuration)
	}
	builder = builder.
		Where("Id = ?", policy.Id).
		Suffix("RETURNING Id, DisplayName, PostDuration")
	sQuery, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}
	rows := make([]*model.RetentionPolicy, 0, 1)
	_, err = s.GetMaster().Select(&rows, sQuery, args...)
	if err != nil {
		return nil, err
	} else if len(rows) == 0 {
		return nil, errors.New("policy not found")
	}
	return rows[0], nil
}

func (s *SqlRetentionPolicyStore) Update(policy *model.RetentionPolicyUpdate) error {
	// The `ON DELETE CASCADE` part of the foreign key constraints should delete all
	// necessary channels and teams from RetentionPoliciesChannels and
	// RetentionPoliciesTeams respectively
	query := ""
	args := make([]interface{}, 0)
	rpDeleteQuery, rpDeleteArgs, _ := s.getQueryBuilder().
		Delete("RetentionPolicies").
		Where(sq.Eq{"Id": policy.Id}).
		ToSql()
	query += rpDeleteQuery
	args = append(args, rpDeleteArgs...)

	rpInsertQuery, rpInsertArgs, _ := s.getQueryBuilder().
		Insert("RetentionPolicies").
		Columns("Id, DisplayName, PostDuration").
		Values(policy.Id, policy.DisplayName, policy.PostDuration).
		ToSql()
	query += "; " + rpInsertQuery
	args = append(args, rpInsertArgs...)

	if len(policy.ChannelIds) > 0 {
		builder := s.getQueryBuilder().
			Insert("RetentionPoliciesChannels").
			Columns("PolicyId", "ChannelId")
		for _, channelId := range policy.ChannelIds {
			builder = builder.Values(policy.Id, channelId)
		}
		rpcInsertQuery, rpcInsertArgs, _ := builder.ToSql()
		query += "; " + rpcInsertQuery
		args = append(args, rpcInsertArgs...)
	}

	if len(policy.TeamIds) > 0 {
		builder := s.getQueryBuilder().
			Insert("RetentionPoliciesTeams").
			Columns("PolicyId", "TeamId")
		for _, teamId := range policy.TeamIds {
			builder = builder.Values(policy.Id, teamId)
		}
		rptInsertQuery, rptInsertArgs, _ := builder.ToSql()
		query += "; " + rptInsertQuery
		args = append(args, rptInsertArgs...)
	}

	txn, err := s.GetMaster().Begin()
	if err != nil {
		return err
	}
	_, err = txn.Exec(query, args...)
	if err != nil {
		txn.Rollback()
		return err
	}
	txn.Commit()
	return nil
}

func (s *SqlRetentionPolicyStore) Get(id string) (*model.RetentionPolicyEnriched, error) {
	policies, err := s.getAll(&id)
	if err != nil {
		return nil, err
	} else if len(policies) == 0 {
		return nil, errors.New("policy not found")
	}
	return policies[0], nil
}

func (s *SqlRetentionPolicyStore) getAll(id *string) ([]*model.RetentionPolicyEnriched, error) {
	props := make(map[string]string)
	if id != nil {
		props["policyId"] = *id
	}
	builder := s.getQueryBuilder().
		Select(`A.Id, A.DisplayName, A.PostDuration, B.ChannelId, C.DisplayName AS ChannelDisplayName,
			D.DisplayName AS ChannelTeamDisplayName, NULL AS TeamId, NULL AS TeamDisplayName`).
		From("RetentionPolicies AS A").
		LeftJoin("RetentionPoliciesChannels AS B ON A.Id = B.PolicyId").
		LeftJoin("Channels AS C ON B.ChannelId = C.Id").
		LeftJoin("Teams AS D ON C.TeamId = D.Id")
	if id != nil {
		builder = builder.Where("A.Id = :policyId")
	}
	sChannelQuery, _, _ := builder.ToSql()
	builder = s.getQueryBuilder().
		Select(`A.Id, A.DisplayName, A.PostDuration, NULL AS ChannelId, NULL AS ChannelDisplayName,
			NULL AS ChannelTeamDisplayName, E.TeamId, F.DisplayName AS TeamDisplayName`).
		From("RetentionPolicies AS A").
		LeftJoin("RetentionPoliciesTeams AS E ON A.Id = E.PolicyId").
		LeftJoin("Teams AS F ON E.TeamId = F.Id")
	if id != nil {
		builder = builder.Where("A.Id = :policyId")
	}
	sTeamQuery, _, _ := builder.ToSql()
	sQuery := sChannelQuery + " UNION " + sTeamQuery
	var rows []*retentionPolicyRow
	_, err := s.GetReplica().Select(&rows, sQuery, props)
	if err != nil {
		return nil, err
	}
	mPolicies := make(map[string]*model.RetentionPolicyEnriched)
	for _, row := range rows {
		policy, ok := mPolicies[row.Id]
		if !ok {
			policy = &model.RetentionPolicyEnriched{
				Id:           row.Id,
				DisplayName:  row.DisplayName,
				PostDuration: row.PostDuration,
				Channels:     make([]model.ChannelDisplayInfo, 0),
				Teams:        make([]model.TeamDisplayInfo, 0),
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
	return aPolicies, nil
}

func (s *SqlRetentionPolicyStore) GetAll() ([]*model.RetentionPolicyEnriched, error) {
	return s.getAll(nil)
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
