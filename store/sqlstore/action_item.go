// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v5/actionitem"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/pkg/errors"
)

type SqlActionItemStore struct {
	*SqlStore
}

func newSqlActionItemStore(sqlStore *SqlStore) store.ActionItemStore {
	s := &SqlActionItemStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(actionitem.ActionItem{}, "ActionItem").SetKeys(true, "Id")
		table.ColMap("UserId").SetMaxSize(26)
	}

	return s
}

func (s SqlActionItemStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_action_item_user_id", "ActionItem", "UserId")
}

func (s SqlActionItemStore) Save(item actionitem.ActionItem) error {
	err := s.GetMaster().Insert(&item)
	return err
}

func (s SqlActionItemStore) GetForUser(userid string) ([]actionitem.ActionItem, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("ActionItem").
		Where(sq.Eq{"UserId": userid})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "bad query in GetForUser")
	}

	var items []actionitem.ActionItem
	if _, err := s.GetReplica().Select(&items, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "unable to get action items for user")
	}

	return items, nil
}

func (s SqlActionItemStore) GetCountsForUser(userid string) ([]actionitem.ActionItemCount, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*) as Value, Type, Provider").
		From("ActionItem").
		Where(sq.Eq{"UserId": userid}).
		GroupBy("Type", "Provider")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "bad query in GetForUser")
	}

	var items []actionitem.ActionItemCount
	if _, err := s.GetReplica().Select(&items, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "unable to get action item counts for user")
	}

	return items, nil
}
