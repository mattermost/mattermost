// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var propertyGroupColumns = []string{"ID", "Name"}

type SqlPropertyGroupStore struct {
	*SqlStore
}

func newPropertyGroupStore(sqlStore *SqlStore) store.PropertyGroupStore {
	return &SqlPropertyGroupStore{sqlStore}
}

func (s *SqlPropertyGroupStore) Register(name string) (*model.PropertyGroup, error) {
	if name == "" {
		return nil, store.NewErrInvalidInput("PropertyGroup", "name", name)
	}

	group := &model.PropertyGroup{Name: name}
	group.PreSave()

	builder := s.getQueryBuilder().
		Insert("PropertyGroups").
		Columns("ID", "Name").
		Values(group.ID, group.Name)

	if s.DriverName() == model.DatabaseDriverMysql {
		builder = builder.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE Name=Name"))
	} else {
		builder = builder.SuffixExpr(sq.Expr("ON CONFLICT (Name) DO NOTHING"))
	}

	r, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return nil, errors.Wrap(err, "property_group_register_insert")
	}

	rowsAffected, err := r.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "property_group_register_rows_affected")
	}

	// there was a conflict during the insert, so we need to fetch the
	// group to get its data
	if rowsAffected == 0 {
		return s.Get(name)
	}

	return group, nil
}

func (s *SqlPropertyGroupStore) Get(name string) (*model.PropertyGroup, error) {
	queryString, args, err := s.getQueryBuilder().
		Select(propertyGroupColumns...).
		From("PropertyGroups").
		Where(sq.Eq{"Name": name}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "property_group_get_tosql")
	}

	var propertyGroup model.PropertyGroup
	if err := s.GetReplica().Get(&propertyGroup, queryString, args...); err != nil {
		return nil, store.NewErrNotFound("PropertyGroup", name)
	}

	return &propertyGroup, nil
}
