// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPostReadStatusStore struct {
	*SqlStore
}

func newSqlPostReadStatusStore(sqlStore *SqlStore) store.PostReadStatusStore {
	return &SqlPostReadStatusStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlPostReadStatusStore) SaveMultiple(statuses []*model.PostReadStatus) error {
	if len(statuses) == 0 {
		return nil
	}

	query := s.getQueryBuilder().
		Insert("PostReadStatus").
		Columns("PostId", "UserId", "CreateAt")

	for _, st := range statuses {
		query = query.Values(st.PostId, st.UserId, st.CreateAt)
	}

	query = query.SuffixExpr(sq.Expr("ON CONFLICT (PostId, UserId) DO NOTHING"))

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to insert PostReadStatus records")
	}

	return nil
}
