// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

type SqlPostAcknowledgementStore struct {
	*SqlStore
}

func newSqlPostAcknowledgementStore(sqlStore *SqlStore) store.PostAcknowledgementStore {
	return &SqlPostAcknowledgementStore{sqlStore}
}

func (s *SqlPostAcknowledgementStore) Get(userID, postID string) (*model.PostAcknowledgement, error) {
	query, args, err := s.getQueryBuilder().
		Select().
		From("PostAcknowledgements").
		Where(sq.And{
			sq.Eq{"DeleteAt": 0},
			sq.Eq{"PostId": postID},
			sq.Eq{"UserId": userID},
		}).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "getPostAcknowledgement_ToSql")
	}

	var acknowledgement *model.PostAcknowledgement
	err = s.GetReplicaX().Get(&acknowledgement, query, args...)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PostAcknowledgement", postID)
		}

		return nil, errors.Wrapf(err, "failed to get PostAcknowledgement postID=%s, for userID=%s", postID, userID)
	}

	return acknowledgement, nil
}

func (s *SqlPostAcknowledgementStore) Save(userID, postID string) (*model.PostAcknowledgement, error) {
	acknowledgement := &model.PostAcknowledgement{
		UserId:         userID,
		PostId:         postID,
		CreateAt:       model.GetMillis(),
		AcknowledgedAt: model.GetMillis(),
		DeleteAt:       0,
	}

	if err := acknowledgement.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().
		Insert("PostAcknowledgements").
		Columns("PostId", "UserId", "CreateAt", "AcknowledgedAt", "DeleteAt").
		Values(acknowledgement.PostId, acknowledgement.UserId, acknowledgement.CreateAt, acknowledgement.AcknowledgedAt, acknowledgement.DeleteAt)

	if s.DriverName() == model.DatabaseDriverMysql {
		query = query.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE AcknowledgedAt = ?, DeleteAt = ?", acknowledgement.AcknowledgedAt, acknowledgement.DeleteAt))
	} else {
		query = query.SuffixExpr(sq.Expr("ON CONFLICT (postid, userid) DO UPDATE SET AcknowledgedAt = ?, DeleteAt = ?", acknowledgement.AcknowledgedAt, acknowledgement.DeleteAt))
	}

	sql, args, err := query.ToSql()

	if err != nil {
		return nil, err
	}

	_, err = s.GetMasterX().Exec(sql, args...)

	if err != nil {
		return nil, err
	}

	return acknowledgement, nil
}

func (s *SqlPostAcknowledgementStore) Delete(userID, postID string) (*model.PostAcknowledgement, error) {
	acknowledgement, err := s.Get(userID, postID)

	if err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().Update("PostAcknowledgement").Set("DeleteAt", model.GetMillis()).ToSql()

	if err != nil {
		return nil, err
	}

	_, err = s.GetMasterX().Exec(query, args...)

	if err != nil {
		return nil, err
	}

	acknowledgement.DeleteAt = 0

	return acknowledgement, nil
}

func (s *SqlPostAcknowledgementStore) GetForPost(postID string) ([]*model.PostAcknowledgement, error) {
	query, args, err := s.getQueryBuilder().
		Select().
		From("PostAcknowledgements").
		Where(sq.And{
			sq.Eq{"DeleteAt": 0},
			sq.Eq{"PostId": postID},
		}).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "getPostAcknowledgement_ToSql")
	}

	var acknowledgements []*model.PostAcknowledgement
	err = s.GetReplicaX().Select(&acknowledgements, query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PostAcknowledgements for postID=%s", postID)
	}

	return acknowledgements, nil
}
