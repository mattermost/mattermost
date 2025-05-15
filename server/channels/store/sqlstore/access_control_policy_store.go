// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/pkg/errors"

	sq "github.com/mattermost/squirrel"
)

const MaxPerPage = 1000

// Usually rules are how we define the policy, hence the versioning. For v0.1, we also
// have the imports field which is used to link with the parent policy.
type accessControlPolicyV0_1 struct {
	Imports []string                        `json:"imports"`
	Rules   []model.AccessControlPolicyRule `json:"rules"`
}

// These are the fields that meant to be unchanged with the policy versions.
type storeAccessControlPolicy struct {
	ID       string
	Name     string
	Type     string
	Active   bool
	CreateAt int64
	Revision int
	Version  string
	Data     []byte
	Props    []byte
}

// This needs to be updated with the new version of the policy.
// with the new name as this only supports v0.1
func (s *storeAccessControlPolicy) toModel() (*model.AccessControlPolicy, error) {
	policy := &model.AccessControlPolicy{
		ID:       s.ID,
		Name:     s.Name,
		Type:     s.Type,
		Active:   s.Active,
		CreateAt: s.CreateAt,
		Revision: s.Revision,
		Version:  s.Version,
	}

	var p accessControlPolicyV0_1
	if err := json.Unmarshal(s.Data, &p); err != nil {
		return nil, err
	}

	policy.Imports = p.Imports
	policy.Rules = p.Rules

	if err := json.Unmarshal(s.Props, &policy.Props); err != nil {
		return nil, err
	}

	return policy, nil
}

func fromModel(policy *model.AccessControlPolicy) (*storeAccessControlPolicy, error) {
	data, err := json.Marshal(&accessControlPolicyV0_1{
		Imports: policy.Imports,
		Rules:   policy.Rules,
	})
	if err != nil {
		return nil, err
	}

	props, err := json.Marshal(policy.Props)
	if err != nil {
		return nil, err
	}

	return &storeAccessControlPolicy{
		ID:       policy.ID,
		Name:     policy.Name,
		Type:     policy.Type,
		Active:   policy.Active,
		CreateAt: policy.CreateAt,
		Revision: policy.Revision,
		Version:  policy.Version,
		Data:     data,
		Props:    props,
	}, nil
}

func accessControlPolicySliceColumns(prefix ...string) []string {
	var p string
	if len(prefix) == 1 {
		p = prefix[0] + "."
	} else if len(prefix) > 1 {
		panic("cannot accept multiple prefixes")
	}

	return []string{
		p + "ID",
		p + "Name",
		p + "Type",
		p + "Active",
		p + "CreateAt",
		p + "Revision",
		p + "Version",
		p + "Data",
		p + "Props",
	}
}

func accessControlPolicyHistorySliceColumns(prefix ...string) []string {
	var p string
	if len(prefix) == 1 {
		p = prefix[0] + "."
	} else if len(prefix) > 1 {
		panic("cannot accept multiple prefixes")
	}

	return []string{
		p + "ID",
		p + "Name",
		p + "Type",
		p + "CreateAt",
		p + "Revision",
		p + "Version",
		p + "Data",
		p + "Props",
	}
}

type SqlAccessControlPolicyStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface

	selectQueryBuilder sq.SelectBuilder
}

// newSqlAccessControlPolicyStore creates an instance of AccessControlPolicyStorea.
func newSqlAccessControlPolicyStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.AccessControlPolicyStore {
	s := &SqlAccessControlPolicyStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	s.selectQueryBuilder = s.getQueryBuilder().Select(accessControlPolicySliceColumns()...).From("AccessControlPolicies")

	return s
}

func preSaveAccessControlPolicy(policy *storeAccessControlPolicy, existingPolicy *model.AccessControlPolicy) {
	// since policies are immutable, we need to create a new revision
	// also if it's going to be saved, eventually it will be the new one
	// we overwrite createAt to make sure it gets the correct timestamp before saving
	// if there is no existing policy, we set the revision to 1
	policy.CreateAt = model.GetMillis()
	if existingPolicy != nil {
		policy.Revision = existingPolicy.Revision + 1
	} else {
		policy.Revision = 1
	}
}

func (s *SqlAccessControlPolicyStore) Save(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, error) {
	if err := policy.IsValid(); err != nil {
		return nil, err
	}

	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "failed to start transaction")
	}
	defer finalizeTransactionX(tx, &err)

	existingPolicy, err := s.getT(rctx, tx, policy.ID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, errors.Wrapf(err, "failed to fetch policy with id=%s", policy.ID)
	}

	storePolicy, err := fromModel(policy)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse policy with Id=%s", policy.ID)
	}

	data := storePolicy.Data
	props := storePolicy.Props
	if s.IsBinaryParamEnabled() {
		data = AppendBinaryFlag(data)
		props = AppendBinaryFlag(props)
	}

	if existingPolicy != nil {
		if existingPolicy.Type != policy.Type {
			return nil, errors.New("cannot change type of existing policy")
		}

		// move existing policy to history
		tmp, err2 := fromModel(existingPolicy)
		if err2 != nil {
			return nil, errors.Wrapf(err2, "failed to parse policy with id=%s", policy.ID)
		}

		// Check if the policy has actually changed
		// We compare data, name, and version fields, and ensure type hasn't changed
		if bytes.Equal(storePolicy.Data, tmp.Data) &&
			storePolicy.Name == tmp.Name &&
			storePolicy.Version == tmp.Version {
			return existingPolicy, nil
		}

		existingData := tmp.Data
		existingProps := tmp.Props
		if s.IsBinaryParamEnabled() {
			existingData = AppendBinaryFlag(existingData)
			existingProps = AppendBinaryFlag(existingProps)
		}

		query := s.getQueryBuilder().
			Insert("AccessControlPolicyHistory").
			Columns(accessControlPolicyHistorySliceColumns()...).
			Values(tmp.ID, tmp.Name, tmp.Type, tmp.CreateAt, tmp.Revision, tmp.Version, existingData, existingProps)

		_, err = tx.ExecBuilder(query)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to save policy with id=%s to history", policy.ID)
		}

		err = s.deleteT(rctx, tx, existingPolicy.ID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to delete policy with id=%s", policy.ID)
		}
	} else {
		// if there is no existing policy, also check the history table
		// to make sure we are not overwriting an existing policy
		existingPolicy, err = s.getHistoryT(rctx, tx, policy.ID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, errors.Wrapf(err, "failed to fetch policy with id=%s", policy.ID)
		}
	}

	preSaveAccessControlPolicy(storePolicy, existingPolicy)

	query := s.getQueryBuilder().
		Insert("AccessControlPolicies").
		Columns(accessControlPolicySliceColumns()...).
		Values(storePolicy.ID, storePolicy.Name, storePolicy.Type, storePolicy.Active, storePolicy.CreateAt, storePolicy.Revision, storePolicy.Version, data, props)

	_, err = tx.ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to save policy with id=%s", policy.ID)
	}

	cp, err := storePolicy.toModel()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse policy with id=%s", policy.ID)
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return cp, nil
}

func (s *SqlAccessControlPolicyStore) Delete(rctx request.CTX, id string) error {
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "failed to start transaction")
	}
	defer finalizeTransactionX(tx, &err)

	existingPolicy, err := s.getT(rctx, tx, id)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return errors.Wrapf(err, "failed to fetch policy with id=%s", id)
	}

	if existingPolicy != nil {
		tmp, err2 := fromModel(existingPolicy)
		if err2 != nil {
			return errors.Wrapf(err2, "failed to parse policy with id=%s", id)
		}
		data := tmp.Data
		props := tmp.Props
		if s.IsBinaryParamEnabled() {
			data = AppendBinaryFlag(data)
			props = AppendBinaryFlag(props)
		}

		query := s.getQueryBuilder().
			Insert("AccessControlPolicyHistory").
			Columns(accessControlPolicyHistorySliceColumns()...).
			Values(tmp.ID, tmp.Name, tmp.Type, tmp.CreateAt, tmp.Revision, tmp.Version, data, props)

		_, err = tx.ExecBuilder(query)
		if err != nil {
			return errors.Wrapf(err, "failed to save policy with id=%s to history", id)
		}

		err = s.deleteT(rctx, tx, existingPolicy.ID)
		if err != nil {
			return errors.Wrapf(err, "failed to delete policy with id=%s", id)
		}
	}

	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s *SqlAccessControlPolicyStore) deleteT(_ request.CTX, tx *sqlxTxWrapper, id string) error {
	query := s.getQueryBuilder().Delete("AccessControlPolicies").Where(sq.Eq{"ID": id})
	_, err := tx.ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete policy with id=%s", id)
	}

	return nil
}

func (s *SqlAccessControlPolicyStore) SetActiveStatus(rctx request.CTX, id string, active bool) (*model.AccessControlPolicy, error) {
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "failed to start transaction")
	}
	defer finalizeTransactionX(tx, &err)

	existingPolicy, err := s.getT(rctx, tx, id)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch policy with id=%s", id)
	} else if errors.Is(err, sql.ErrNoRows) {
		return nil, store.NewErrNotFound("AccessControlPolicy", id)
	}

	// also make sure if the policy is valid before updating active status
	// just in case
	existingPolicy.Active = active
	if appErr := existingPolicy.IsValid(); err != nil {
		return nil, appErr
	}

	query, args, err := s.getQueryBuilder().Update("AccessControlPolicies").Set("Active", active).Where(sq.Eq{"ID": id}).ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query for policy with id=%s", id)
	}
	_, err = tx.Exec(query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update policy with id=%s", id)
	}

	if existingPolicy.Type == model.AccessControlPolicyTypeParent {
		// if the policy is a parent, we need to update the child policies
		var expr sq.Sqlizer
		if s.DriverName() == model.DatabaseDriverPostgres {
			expr = sq.Expr("Data->'imports' @> ?::jsonb", fmt.Sprintf("%q", id))
		} else {
			expr = sq.Expr("JSON_CONTAINS(JSON_EXTRACT(Data, '$.imports'), ?)", fmt.Sprintf("%q", id))
		}
		query, args, err = s.getQueryBuilder().Update("AccessControlPolicies").Set("Active", active).Where(expr).ToSql()
		if err != nil {
			return nil, errors.Wrapf(err, "failed to build query for policy with id=%s", id)
		}
		_, err = tx.Exec(query, args...)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to update child policies with id=%s", id)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return existingPolicy, nil
}

func (s *SqlAccessControlPolicyStore) Get(_ request.CTX, id string) (*model.AccessControlPolicy, error) {
	p := storeAccessControlPolicy{}
	query := s.selectQueryBuilder.Where(sq.Eq{"ID": id})

	err := s.GetMaster().GetBuilder(&p, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("AccessControlPolicy", id)
		}
		return nil, errors.Wrapf(err, "failed to find policy with id=%s", id)
	}

	policy, err := p.toModel()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse policy with id=%s", id)
	}

	return policy, nil
}

func (s *SqlAccessControlPolicyStore) getT(_ request.CTX, tx *sqlxTxWrapper, id string) (*model.AccessControlPolicy, error) {
	query := s.getQueryBuilder().
		Select(accessControlPolicySliceColumns()...).
		From("AccessControlPolicies").
		Where(
			sq.Eq{"ID": id},
		)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query for policy with id=%s", id)
	}

	var storePolicy storeAccessControlPolicy
	err = tx.Get(&storePolicy, sql, args...)
	if err != nil {
		return nil, err
	}

	policy, err := storePolicy.toModel()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse policy with id=%s", id)
	}

	return policy, nil
}

func (s *SqlAccessControlPolicyStore) getHistoryT(_ request.CTX, tx *sqlxTxWrapper, id string) (*model.AccessControlPolicy, error) {
	query := s.getQueryBuilder().
		Select(accessControlPolicyHistorySliceColumns()...).
		From("AccessControlPolicyHistory").
		Where(
			sq.Eq{"ID": id},
		).OrderBy("Revision DESC").
		Limit(1)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query for policy with id=%s", id)
	}

	var storePolicy storeAccessControlPolicy
	err = tx.Get(&storePolicy, sql, args...)
	if err != nil {
		return nil, err
	}

	policy, err := storePolicy.toModel()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse policy with id=%s", id)
	}

	return policy, nil
}

func (s *SqlAccessControlPolicyStore) GetAll(_ request.CTX, opts model.GetAccessControlPolicyOptions) ([]*model.AccessControlPolicy, model.AccessControlPolicyCursor, error) {
	p := []storeAccessControlPolicy{}
	query := s.selectQueryBuilder

	if opts.ParentID != "" {
		if s.DriverName() == model.DatabaseDriverPostgres {
			query = query.Where(sq.Expr("Data->'imports' @> ?", fmt.Sprintf("%q", opts.ParentID)))
		} else {
			query = query.Where(sq.Expr("JSON_CONTAINS(JSON_EXTRACT(Data, '$.imports'), ?)", fmt.Sprintf("%q", opts.ParentID)))
		}
	}

	if opts.Type != "" {
		query = query.Where(sq.Eq{"Type": opts.Type})
	}

	cursor := opts.Cursor

	if !cursor.IsEmpty() {
		query = query.Where(sq.Or{
			sq.Gt{"Id": cursor.ID},
		})
	}

	limit := uint64(opts.Limit)
	if limit < 1 {
		limit = 10
	} else if limit > MaxPerPage {
		limit = MaxPerPage
	}

	query = query.Limit(limit)

	err := s.GetReplica().SelectBuilder(&p, query)
	if err != nil {
		return nil, cursor, errors.Wrapf(err, "failed to find policies with opts={\"parentID\"=%q, \"resourceType\"=%q", opts.ParentID, opts.Type)
	}

	policies := make([]*model.AccessControlPolicy, len(p))
	for i := range p {
		policies[i], err = p[i].toModel()
		if err != nil {
			return nil, cursor, errors.Wrapf(err, "failed to parse policy with id=%s", p[i].ID)
		}
	}

	if len(policies) != 0 {
		cursor.ID = policies[len(policies)-1].ID
	}

	return policies, cursor, nil
}

func (s *SqlAccessControlPolicyStore) SearchPolicies(rctx request.CTX, opts model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, error) {
	type wrapper struct {
		storeAccessControlPolicy
		ChildIDs json.RawMessage
	}

	p := []wrapper{}
	var query sq.SelectBuilder
	if opts.IncludeChildren && opts.ParentID == "" {
		columns := accessControlPolicySliceColumns("p")
		if s.DriverName() == model.DatabaseDriverPostgres {
			childIDs := `COALESCE((SELECT JSON_AGG(c.ID) 
     FROM AccessControlPolicies c
	 WHERE c.Type != 'parent' 
     AND c.Data->'imports' @> JSONB_BUILD_ARRAY(p.ID)), '[]'::json) AS ChildIDs`
			columns = append(columns, childIDs)
		} else {
			childIDs := `COALESCE((SELECT JSON_ARRAYAGG(c.ID) 
     FROM AccessControlPolicies c
     WHERE c.Type != 'parent' 
     AND JSON_SEARCH(c.Data->'$.imports', 'one', p.ID) IS NOT NULL), JSON_ARRAY()) AS ChildIDs`
			columns = append(columns, childIDs)
		}
		query = s.getQueryBuilder().Select(columns...).From("AccessControlPolicies p")
	} else {
		query = s.selectQueryBuilder
	}

	count := s.getQueryBuilder().Select("COUNT(*)").From("AccessControlPolicies")

	if opts.Term != "" {
		condition := sq.Like{"Name": fmt.Sprintf("%%%s%%", opts.Term)}
		query = query.Where(condition)
		count = count.Where(condition)
	}

	if opts.Type != "" {
		condition := sq.Eq{"Type": opts.Type}
		query = query.Where(condition)
		count = count.Where(condition)
	}

	if opts.ParentID != "" {
		if s.DriverName() == model.DatabaseDriverPostgres {
			condition := sq.Expr("Data->'imports' @> ?", fmt.Sprintf("%q", opts.ParentID))
			query = query.Where(condition)
			count = count.Where(condition)
		} else {
			condition := sq.Expr("JSON_CONTAINS(JSON_EXTRACT(Data, '$.imports'), ?)", fmt.Sprintf("%q", opts.ParentID))
			query = query.Where(condition)
			count = count.Where(condition)
		}
	}

	if opts.Active {
		query = query.Where(sq.Eq{"Active": true})
		count = count.Where(sq.Eq{"Active": true})
	}

	cursor := opts.Cursor

	if !cursor.IsEmpty() {
		query = query.Where(sq.Gt{"Id": cursor.ID})
	}

	limit := uint64(opts.Limit)
	if limit < 1 {
		limit = 10
	} else if limit > MaxPerPage {
		limit = MaxPerPage
	}

	query = query.Limit(limit)

	err := s.GetReplica().SelectBuilder(&p, query)
	if err != nil {
		return nil, 0, errors.Wrapf(err, "failed to find policies with opts={\"name\"=%q, \"resourceType\"=%q", opts.Term, opts.Type)
	}

	policies := make([]*model.AccessControlPolicy, len(p))
	for i := range p {
		m, err2 := p[i].toModel()
		if err2 != nil {
			return nil, 0, errors.Wrapf(err2, "failed to parse policy with id=%s", p[i].ID)
		}

		// Props field is not guaranteed to be persisted correctly, and it shouldn't be.
		// This is a field that we want to include metadata, some values may be stored but
		// not all of them. For example for the childs, we don't want to update it whenever a
		// child policy changes.
		if opts.IncludeChildren && opts.ParentID == "" {
			if m.Props == nil {
				m.Props = make(map[string]any)
			}
			// Unmarshal the JSON array into a slice of strings
			var childIDs []string
			if err = json.Unmarshal(p[i].ChildIDs, &childIDs); err != nil {
				return nil, 0, errors.Wrapf(err, "failed to unmarshal child IDs for policy with id=%s", p[i].ID)
			}
			m.Props["child_ids"] = childIDs
		}
		policies[i] = m
	}

	var total int64
	err = s.GetReplica().GetBuilder(&total, count)
	if err != nil {
		return nil, 0, errors.Wrapf(err, "failed to count policies with opts={\"name\"=%q, \"resourceType\"=%q", opts.Term, opts.Type)
	}

	if len(policies) != 0 {
		cursor.ID = policies[len(policies)-1].ID
	}

	return policies, total, nil
}
