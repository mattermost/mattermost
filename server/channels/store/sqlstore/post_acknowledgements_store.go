// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPostAcknowledgementStore struct {
	*SqlStore
}

func newSqlPostAcknowledgementStore(sqlStore *SqlStore) store.PostAcknowledgementStore {
	return &SqlPostAcknowledgementStore{sqlStore}
}

func (s *SqlPostAcknowledgementStore) Get(postID, userID string) (*model.PostAcknowledgement, error) {
	query := s.getQueryBuilder().
		Select("PostId", "UserId", "ChannelId", "AcknowledgedAt", "RemoteId").
		From("PostAcknowledgements").
		Where(sq.And{
			sq.Eq{"PostId": postID},
			sq.Eq{"UserId": userID},
			sq.NotEq{"AcknowledgedAt": 0},
		})

	var acknowledgement model.PostAcknowledgement
	err := s.GetReplica().GetBuilder(&acknowledgement, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PostAcknowledgement", postID)
		}

		return nil, err
	}

	return &acknowledgement, nil
}

func (s *SqlPostAcknowledgementStore) SaveWithModel(acknowledgement *model.PostAcknowledgement) (*model.PostAcknowledgement, error) {
	if err := acknowledgement.IsValid(); err != nil {
		return nil, err
	}

	acknowledgement.PreSave()

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	query := s.buildUpsertQuery(acknowledgement)
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
	transaction, err := s.GetMaster().Beginx()
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

func (s *SqlPostAcknowledgementStore) DeleteAllForPost(postID string) error {
	query := s.getQueryBuilder().
		Delete("PostAcknowledgements").
		Where(sq.Eq{"PostId": postID})

	_, err := s.GetMaster().ExecBuilder(query)
	return err
}

func (s *SqlPostAcknowledgementStore) GetForPost(postID string) ([]*model.PostAcknowledgement, error) {
	var acknowledgements []*model.PostAcknowledgement

	query := s.getQueryBuilder().
		Select("PostId", "UserId", "ChannelId", "AcknowledgedAt", "RemoteId").
		From("PostAcknowledgements").
		Where(sq.And{
			sq.NotEq{"AcknowledgedAt": 0},
			sq.Eq{"PostId": postID},
		})

	err := s.GetReplica().SelectBuilder(&acknowledgements, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PostAcknowledgements for postID=%s", postID)
	}

	return acknowledgements, nil
}

func (s *SqlPostAcknowledgementStore) GetForPosts(postIds []string) ([]*model.PostAcknowledgement, error) {
	var acknowledgements []*model.PostAcknowledgement

	perPage := 200
	for i := 0; i < len(postIds); i += perPage {
		j := min(len(postIds), i+perPage)

		query := s.getQueryBuilder().
			Select("PostId", "UserId", "ChannelId", "AcknowledgedAt", "RemoteId").
			From("PostAcknowledgements").
			Where(sq.And{
				sq.Eq{"PostId": postIds[i:j]},
				sq.NotEq{"AcknowledgedAt": 0},
			})

		var acknowledgementsBatch []*model.PostAcknowledgement
		err := s.GetReplica().SelectBuilder(&acknowledgementsBatch, query)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get PostAcknowledgements for post list")
		}

		acknowledgements = append(acknowledgements, acknowledgementsBatch...)
	}

	return acknowledgements, nil
}

func (s *SqlPostAcknowledgementStore) GetForPostSince(postID string, since int64, excludeRemoteID string, inclDeleted bool) ([]*model.PostAcknowledgement, error) {
	var acknowledgements []*model.PostAcknowledgement

	query := s.getQueryBuilder().
		Select("PostId", "UserId", "ChannelId", "AcknowledgedAt", "RemoteId").
		From("PostAcknowledgements").
		Where(sq.Eq{"PostId": postID})

	if !inclDeleted {
		query = query.Where(sq.NotEq{"AcknowledgedAt": 0})
	}

	if since > 0 {
		query = query.Where(sq.Gt{"AcknowledgedAt": since})
	}

	if excludeRemoteID != "" {
		query = query.Where(sq.NotEq{"COALESCE(RemoteId, '')": excludeRemoteID})
	}

	err := s.GetReplica().SelectBuilder(&acknowledgements, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PostAcknowledgements for postID=%s since=%d", postID, since)
	}

	return acknowledgements, nil
}

func (s *SqlPostAcknowledgementStore) GetSingle(userID, postID, remoteID string) (*model.PostAcknowledgement, error) {
	query := s.getQueryBuilder().
		Select("PostId", "UserId", "ChannelId", "AcknowledgedAt", "RemoteId").
		From("PostAcknowledgements").
		Where(sq.And{
			sq.Eq{"PostId": postID},
			sq.Eq{"UserId": userID},
		})

	if remoteID != "" {
		query = query.Where(sq.Eq{"RemoteId": remoteID})
	} else {
		query = query.Where(sq.Or{
			sq.Eq{"RemoteId": ""},
			sq.Eq{"RemoteId": nil},
		})
	}

	var acknowledgement model.PostAcknowledgement
	err := s.GetReplica().GetBuilder(&acknowledgement, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PostAcknowledgement", postID)
		}
		return nil, err
	}

	return &acknowledgement, nil
}

// buildUpsertQuery creates an upsert query for a PostAcknowledgement
func (s *SqlPostAcknowledgementStore) buildUpsertQuery(acknowledgement *model.PostAcknowledgement) sq.InsertBuilder {
	columnsToInsert := []string{"PostId", "UserId", "ChannelId", "AcknowledgedAt", "RemoteId"}
	var remoteIdValue any
	if acknowledgement.RemoteId != nil {
		remoteIdValue = *acknowledgement.RemoteId
	} else {
		remoteIdValue = nil
	}
	valuesToInsert := []any{acknowledgement.PostId, acknowledgement.UserId, acknowledgement.ChannelId, acknowledgement.AcknowledgedAt, remoteIdValue}

	query := s.getQueryBuilder().
		Insert("PostAcknowledgements").
		Columns(columnsToInsert...).
		Values(valuesToInsert...)

	query = query.SuffixExpr(sq.Expr("ON CONFLICT (postid, userid) DO UPDATE SET AcknowledgedAt = ?", acknowledgement.AcknowledgedAt))

	return query
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

func (s *SqlPostAcknowledgementStore) BatchSave(acknowledgements []*model.PostAcknowledgement) ([]*model.PostAcknowledgement, error) {
	if len(acknowledgements) == 0 {
		return []*model.PostAcknowledgement{}, nil
	}

	// Populate missing ChannelId fields and validate all acknowledgements
	for _, ack := range acknowledgements {
		// If ChannelId is not set, look it up from the post
		if ack.ChannelId == "" {
			postQuery := s.getQueryBuilder().
				Select("ChannelId").
				From("Posts").
				Where(sq.Eq{"Id": ack.PostId})

			var channelId string
			err := s.GetReplica().GetBuilder(&channelId, postQuery)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to get channel id for post %s", ack.PostId)
			}
			ack.ChannelId = channelId
		}

		if err := ack.IsValid(); err != nil {
			return nil, err
		}
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Keep track of which posts need to be updated
	postsToUpdate := make(map[string]bool)

	// Insert all acknowledgements
	for _, ack := range acknowledgements {
		ack.PreSave()

		query := s.buildUpsertQuery(ack)
		_, err = transaction.ExecBuilder(query)
		if err != nil {
			return nil, err
		}

		postsToUpdate[ack.PostId] = true
	}

	// Update the UpdateAt timestamp for all affected posts
	for postID := range postsToUpdate {
		err = updatePost(transaction, postID)
		if err != nil {
			return nil, err
		}
	}

	err = transaction.Commit()
	if err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return acknowledgements, nil
}

func (s *SqlPostAcknowledgementStore) BatchDelete(acknowledgements []*model.PostAcknowledgement) error {
	if len(acknowledgements) == 0 {
		return nil
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Keep track of which posts need to be updated
	postsToUpdate := make(map[string]bool)

	// Set AcknowledgedAt to 0 for all acknowledgements
	for _, ack := range acknowledgements {
		query := s.getQueryBuilder().
			Update("PostAcknowledgements").
			Set("AcknowledgedAt", 0).
			Where(sq.And{
				sq.Eq{"PostId": ack.PostId},
				sq.Eq{"UserId": ack.UserId},
			})

		_, err = transaction.ExecBuilder(query)
		if err != nil {
			return err
		}

		postsToUpdate[ack.PostId] = true
	}

	// Update the UpdateAt timestamp for all affected posts
	for postID := range postsToUpdate {
		err = updatePost(transaction, postID)
		if err != nil {
			return err
		}
	}

	err = transaction.Commit()
	if err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}
