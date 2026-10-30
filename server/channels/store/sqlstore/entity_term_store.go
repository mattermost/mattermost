// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlEntityTermStore struct {
	*SqlStore
}

func newSqlEntityTermStore(sqlStore *SqlStore) store.EntityTermStore {
	return &SqlEntityTermStore{SqlStore: sqlStore}
}

func (s *SqlEntityTermStore) Replace(pluginID, typeID string, terms []model.EntityTerm, generation int64) error {
	tx, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "failed to store entity terms")
	}
	defer func() { _ = tx.Rollback() }()

	del := s.getQueryBuilder().Delete("entityterms").Where(sq.Eq{"typeid": typeID})
	if _, err = tx.ExecBuilder(del); err != nil {
		return errors.Wrap(err, "failed to store entity terms")
	}
	for _, term := range terms {
		ins := s.getQueryBuilder().
			Insert("entityterms").
			Columns("typeid", "value", "title", "url").
			Values(typeID, term.Value, term.Title, term.URL)
		if _, err = tx.ExecBuilder(ins); err != nil {
			return errors.Wrap(err, "failed to store entity terms")
		}
	}
	dict := s.getQueryBuilder().
		Insert("entitydictionaries").
		Columns("typeid", "pluginid", "generation").
		Values(typeID, pluginID, generation).
		Suffix(`ON CONFLICT (typeid) DO UPDATE SET pluginid = EXCLUDED.pluginid, generation = EXCLUDED.generation`)
	if _, err = tx.ExecBuilder(dict); err != nil {
		return errors.Wrap(err, "failed to store entity terms")
	}
	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to store entity terms")
	}
	return nil
}

func (s *SqlEntityTermStore) List() ([]model.EntityTermRow, error) {
	query := s.getQueryBuilder().
		Select("d.typeid", "d.pluginid", "d.generation", "COALESCE(t.value, '')", "COALESCE(t.title, '')", "COALESCE(t.url, '')").
		From("entitydictionaries d").
		LeftJoin("entityterms t ON t.typeid = d.typeid").
		OrderBy("d.typeid", "t.value")
	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to list entity terms")
	}
	rows, err := s.GetReplica().Query(sql, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list entity terms")
	}
	defer rows.Close()

	var out []model.EntityTermRow
	for rows.Next() {
		var row model.EntityTermRow
		if err = rows.Scan(&row.TypeID, &row.PluginID, &row.Generation, &row.Value, &row.Title, &row.URL); err != nil {
			return nil, errors.Wrap(err, "failed to list entity terms")
		}
		out = append(out, row)
	}
	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to list entity terms")
	}
	return out, nil
}
