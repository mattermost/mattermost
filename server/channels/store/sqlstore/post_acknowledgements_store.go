// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
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

	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	query := s.getQueryBuilder().
		Insert("PostAcknowledgements").
		Columns("PostId", "UserId", "AcknowledgedAt").
		Values(acknowledgement.PostId, acknowledgement.UserId, acknowledgement.AcknowledgedAt)

	if s.DriverName() == model.DatabaseDriverMysql {
		query = query.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE AcknowledgedAt = ?", acknowledgement.AcknowledgedAt))
	} else {
		query = query.SuffixExpr(sq.Expr("ON CONFLICT (postid, userid) DO UPDATE SET AcknowledgedAt = ?", acknowledgement.AcknowledgedAt))
	}

	_, err = transaction.ExecBuilder(query)
	if err != nil {
		return nil, err
	}

	err = updatePost(transaction, acknowledgement.PostId)
	if err != nil {
		return nil, err
	}

	err = transaction.Commit()
	if err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return acknowledgement, nil
}

func (s *SqlPostAcknowledgementStore) Delete(acknowledgement *model.PostAcknowledgement) error {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	query := s.getQueryBuilder().
		Update("PostAcknowledgements").
		Set("AcknowledgedAt", 0).
		Where(sq.And{
			sq.Eq{"PostId": acknowledgement.PostId},
			sq.Eq{"UserId": acknowledgement.UserId},
		})

	_, err = transaction.ExecBuilder(query)
	if err != nil {
		return err
	}

	err = updatePost(transaction, acknowledgement.PostId)
	if err != nil {
		return err
	}

	err = transaction.Commit()
	if err != nil {
		return errors.Wrap(err, "commit_transaction")
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

func updatePost(transaction *sqlxTxWrapper, postId string) error {
	_, err := transaction.Exec(
		`UPDATE
			Posts
		SET
			UpdateAt = ?
		WHERE
			Id = ?`,
		model.GetMillis(),
		postId,
	)

	return err
}
