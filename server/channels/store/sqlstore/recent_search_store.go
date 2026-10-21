// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlRecentSearchStore struct {
	*SqlStore
}

type recentSearchRow struct {
	Id         string `db:"id"`
	UserId     string `db:"userid"`
	Terms      string `db:"terms"`
	SearchType string `db:"searchtype"`
	TeamId     string `db:"teamid"`
	CreateAt   int64  `db:"createat"`
	UpdateAt   int64  `db:"updateat"`
}

func newSqlRecentSearchStore(sqlStore *SqlStore) store.RecentSearchStore {
	return &SqlRecentSearchStore{
		SqlStore: sqlStore,
	}
}

func (r recentSearchRow) toModel() *model.RecentSearch {
	return &model.RecentSearch{
		Id:         r.Id,
		UserId:     r.UserId,
		Terms:      r.Terms,
		SearchType: r.SearchType,
		TeamId:     r.TeamId,
		CreateAt:   r.CreateAt,
		UpdateAt:   r.UpdateAt,
	}
}

func (s *SqlRecentSearchStore) Save(search *model.RecentSearch) (*model.RecentSearch, error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	insertBuilder := s.getQueryBuilder().
		Insert("recentsearchqueries").
		Columns("id", "userid", "terms", "searchtype", "teamid", "createat", "updateat").
		Values(search.Id, search.UserId, search.Terms, search.SearchType, search.TeamId, search.CreateAt, search.UpdateAt).
		Suffix("ON CONFLICT (userid, terms, searchtype, teamid) DO UPDATE SET updateat = EXCLUDED.updateat RETURNING id, userid, terms, searchtype, teamid, createat, updateat")

	query, args, err := insertBuilder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "recent_search_save_tosql")
	}

	var row recentSearchRow
	if err = transaction.Get(&row, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to save recent search")
	}

	if _, err = transaction.Exec(`
		DELETE FROM recentsearchqueries
		WHERE userid = $1
		AND id NOT IN (
			SELECT id FROM (
				SELECT id FROM recentsearchqueries
				WHERE userid = $1
				ORDER BY updateat DESC
				LIMIT $2
			) keepers
		)`, search.UserId, model.RecentSearchLimit); err != nil {
		return nil, errors.Wrap(err, "failed to prune recent searches")
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return row.toModel(), nil
}

func (s *SqlRecentSearchStore) GetByUser(userID string, limit int) ([]*model.RecentSearch, error) {
	if limit <= 0 {
		limit = model.RecentSearchLimit
	}

	query := s.getQueryBuilder().
		Select("id", "userid", "terms", "searchtype", "teamid", "createat", "updateat").
		From("recentsearchqueries").
		Where(sq.Eq{"userid": userID}).
		OrderBy("updateat DESC").
		Limit(uint64(limit))

	var rows []recentSearchRow
	if err := s.GetReplica().SelectBuilder(&rows, query); err != nil {
		return nil, errors.Wrap(err, "failed to get recent searches")
	}

	searches := make([]*model.RecentSearch, 0, len(rows))
	for _, row := range rows {
		searches = append(searches, row.toModel())
	}
	return searches, nil
}

func (s *SqlRecentSearchStore) Delete(userID, id string) error {
	query := s.getQueryBuilder().
		Delete("recentsearchqueries").
		Where(sq.Eq{"id": id, "userid": userID})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrap(err, "failed to delete recent search")
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to read delete result")
	}
	if rows == 0 {
		return store.NewErrNotFound("RecentSearch", id)
	}
	return nil
}
