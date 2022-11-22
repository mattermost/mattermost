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

func (s *SqlPostAcknowledgementStore) Get(postID, userID string) (*model.PostAcknowledgement, error) {
	query := s.getQueryBuilder().
		Select("PostId", "UserId", "AcknowledgedAt").
		From("PostAcknowledgements").
		Where(sq.And{
			sq.Eq{"PostId": postID},
			sq.Eq{"UserId": userID},
			sq.NotEq{"AcknowledgedAt": 0},
		})

	var acknowledgement model.PostAcknowledgement
	err := s.GetReplicaX().GetBuilder(&acknowledgement, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PostAcknowledgement", postID)
		}

		return nil, err
	}

	return &acknowledgement, nil
}

func (s *SqlPostAcknowledgementStore) Save(postID, userID string, acknowledgedAt int64) (*model.PostAcknowledgement, error) {
	if acknowledgedAt == 0 {
		acknowledgedAt = model.GetMillis()
	}

	acknowledgement := &model.PostAcknowledgement{
		UserId:         userID,
		PostId:         postID,
		AcknowledgedAt: acknowledgedAt,
	}

	if err := acknowledgement.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().
		Insert("PostAcknowledgements").
		Columns("PostId", "UserId", "AcknowledgedAt").
		Values(acknowledgement.PostId, acknowledgement.UserId, acknowledgement.AcknowledgedAt)

	if s.DriverName() == model.DatabaseDriverMysql {
		query = query.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE AcknowledgedAt = ?", acknowledgement.AcknowledgedAt))
	} else {
		query = query.SuffixExpr(sq.Expr("ON CONFLICT (postid, userid) DO UPDATE SET AcknowledgedAt = ?", acknowledgement.AcknowledgedAt))
	}

	_, err := s.GetMasterX().ExecBuilder(query)
	if err != nil {
		return nil, err
	}

	return acknowledgement, nil
}

func (s *SqlPostAcknowledgementStore) Delete(ack *model.PostAcknowledgement) error {
	query := s.getQueryBuilder().
		Update("PostAcknowledgements").
		Set("AcknowledgedAt", 0).
		Where(sq.And{
			sq.Eq{"PostId": ack.PostId},
			sq.Eq{"UserId": ack.UserId},
		})

	_, err := s.GetMasterX().ExecBuilder(query)
	if err != nil {
		return err
	}

	return nil
}

func (s *SqlPostAcknowledgementStore) GetForPost(postID string) ([]*model.PostAcknowledgement, error) {
	var acknowledgements []*model.PostAcknowledgement

	query := s.getQueryBuilder().
		Select("PostId", "UserId", "AcknowledgedAt").
		From("PostAcknowledgements").
		Where(sq.And{
			sq.NotEq{"AcknowledgedAt": 0},
			sq.Eq{"PostId": postID},
		})

	err := s.GetReplicaX().SelectBuilder(&acknowledgements, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PostAcknowledgements for postID=%s", postID)
	}

	return acknowledgements, nil
}

func (s *SqlPostAcknowledgementStore) GetForPosts(postIds []string) ([]*model.PostAcknowledgement, error) {
	var acknowledgements []*model.PostAcknowledgement

	perPage := 200
	for i := 0; i < len(postIds); i += perPage {
		j := i + perPage
		if len(postIds) < j {
			j = len(postIds)
		}

		query := s.getQueryBuilder().
			Select("PostId", "UserId", "AcknowledgedAt").
			From("PostAcknowledgements").
			Where(sq.And{
				sq.Eq{"PostId": postIds[i:j]},
				sq.NotEq{"AcknowledgedAt": 0},
			})

		var acknowledgementsBatch []*model.PostAcknowledgement
		err := s.GetReplicaX().SelectBuilder(&acknowledgementsBatch, query)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get PostAcknowledgements for post list")
		}

		acknowledgements = append(acknowledgements, acknowledgementsBatch...)
	}

	return acknowledgements, nil
}
