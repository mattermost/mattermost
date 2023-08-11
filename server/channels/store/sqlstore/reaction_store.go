// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"

	"github.com/pkg/errors"
)

type SqlReactionStore struct {
	*SqlStore
}

func newSqlReactionStore(sqlStore *SqlStore) store.ReactionStore {
	return &SqlReactionStore{sqlStore}
}

func (s *SqlReactionStore) Save(reaction *model.Reaction) (re *model.Reaction, err error) {
	reaction.PreSave()
	if err := reaction.IsValid(); err != nil {
		return nil, err
	}
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)
	if reaction.ChannelId == "" {
		// get channelId, if not already populated
		var channelIds []string
		var args []interface{}
		query := "SELECT ChannelId from Posts where Id = ?"
		args = append(args, reaction.PostId)
		err = transaction.Select(&channelIds, query, args...)
		if err != nil {
			return nil, errors.Wrap(err, "failed while getting channelId from Posts")
		}

		if len(channelIds) == 0 {
			return nil, store.NewErrNotFound("Post", reaction.PostId)
		}

		reaction.ChannelId = channelIds[0]
	}
	err = s.saveReactionAndUpdatePost(transaction, reaction)
	if err != nil {
		// We don't consider duplicated save calls as an error
		if !IsUniqueConstraintError(err, []string{"reactions_pkey", "PRIMARY"}) {
			return nil, errors.Wrap(err, "failed while saving reaction or updating post")
		}
	} else {
		if err := transaction.Commit(); err != nil {
			return nil, errors.Wrap(err, "commit_transaction")
		}
	}

	return reaction, nil
}

func (s *SqlReactionStore) Delete(reaction *model.Reaction) (re *model.Reaction, err error) {
	reaction.PreUpdate()

	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	if err := deleteReactionAndUpdatePost(transaction, reaction); err != nil {
		return nil, errors.Wrap(err, "deleteReactionAndUpdatePost")
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return reaction, nil
}

// GetForPost returns all reactions associated with `postId` that are not deleted.
func (s *SqlReactionStore) GetForPost(postId string, allowFromCache bool) ([]*model.Reaction, error) {
	queryString, args, err := s.getQueryBuilder().
		Select("UserId", "PostId", "EmojiName", "CreateAt", "COALESCE(UpdateAt, CreateAt) As UpdateAt",
			"COALESCE(DeleteAt, 0) As DeleteAt", "RemoteId", "ChannelId").
		From("Reactions").
		Where(sq.Eq{"PostId": postId}).
		Where(sq.Eq{"COALESCE(DeleteAt, 0)": 0}).
		OrderBy("CreateAt").
		ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "reactions_getforpost_tosql")
	}

	var reactions []*model.Reaction
	if err := s.GetReplicaX().Select(&reactions, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get Reactions with postId=%s", postId)
	}
	return reactions, nil
}

// GetForPostSince returns all reactions associated with `postId` updated after `since`.
func (s *SqlReactionStore) GetForPostSince(postId string, since int64, excludeRemoteId string, inclDeleted bool) ([]*model.Reaction, error) {
	query := s.getQueryBuilder().
		Select("UserId", "PostId", "EmojiName", "CreateAt", "COALESCE(UpdateAt, CreateAt) As UpdateAt",
			"COALESCE(DeleteAt, 0) As DeleteAt", "RemoteId").
		From("Reactions").
		Where(sq.Eq{"PostId": postId}).
		Where(sq.Gt{"UpdateAt": since})

	if excludeRemoteId != "" {
		query = query.Where(sq.NotEq{"COALESCE(RemoteId, '')": excludeRemoteId})
	}

	if !inclDeleted {
		query = query.Where(sq.Eq{"COALESCE(DeleteAt, 0)": 0})
	}

	query.OrderBy("CreateAt")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "reactions_getforpostsince_tosql")
	}

	var reactions []*model.Reaction
	if err := s.GetReplicaX().Select(&reactions, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find reactions")
	}
	return reactions, nil
}

func (s *SqlReactionStore) BulkGetForPosts(postIds []string) ([]*model.Reaction, error) {
	placeholder, values := constructArrayArgs(postIds)
	var reactions []*model.Reaction

	if err := s.GetReplicaX().Select(&reactions,
		`SELECT
				UserId,
				PostId,
				EmojiName,
				CreateAt,
				COALESCE(UpdateAt, CreateAt) As UpdateAt,
				COALESCE(DeleteAt, 0) As DeleteAt,
				RemoteId,
				ChannelId
			FROM
				Reactions
			WHERE
				PostId IN `+placeholder+` AND COALESCE(DeleteAt, 0) = 0
			ORDER BY
				CreateAt`, values...); err != nil {
		return nil, errors.Wrap(err, "failed to get Reactions")
	}
	return reactions, nil
}

func (s *SqlReactionStore) DeleteAllWithEmojiName(emojiName string) error {
	var reactions []*model.Reaction
	now := model.GetMillis()

	if err := s.GetReplicaX().Select(&reactions,
		`SELECT
			UserId,
			PostId,
			EmojiName,
			CreateAt,
			COALESCE(UpdateAt, CreateAt) As UpdateAt,
			COALESCE(DeleteAt, 0) As DeleteAt,
			RemoteId
		FROM
			Reactions
		WHERE
			EmojiName = ? AND COALESCE(DeleteAt, 0) = 0`, emojiName); err != nil {
		return errors.Wrapf(err, "failed to get Reactions with emojiName=%s", emojiName)
	}

	_, err := s.GetMasterX().Exec(
		`UPDATE
			Reactions
		SET
			UpdateAt = ?, DeleteAt = ?
		WHERE
			EmojiName = ? AND COALESCE(DeleteAt, 0) = 0`, now, now, emojiName)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Reactions with emojiName=%s", emojiName)
	}

	for _, reaction := range reactions {
		reaction := reaction
		_, err := s.GetMasterX().Exec(UpdatePostHasReactionsOnDeleteQuery, now, reaction.PostId, reaction.PostId)
		if err != nil {
			mlog.Warn("Unable to update Post.HasReactions while removing reactions",
				mlog.String("post_id", reaction.PostId),
				mlog.Err(err))
		}
	}

	return nil
}

func (s SqlReactionStore) PermanentDeleteByUser(userId string) error {
	now := model.GetMillis()
	postIds := []string{}

	err := s.GetReplicaX().Select(&postIds, "SELECT PostId FROM Reactions WHERE UserId = ?", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to get Reactions with userId=%s", userId)
	}

	txn, err := s.GetMasterX().Beginx()
	if err != nil {
		return err
	}
	defer finalizeTransactionX(txn, &err)

	query := s.getQueryBuilder().
		Delete("Reactions").
		Where(sq.Eq{"UserId": userId})

	_, err = txn.ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete reactions with userId=%s", userId)
	}

	for _, postId := range postIds {
		_, err := txn.Exec(UpdatePostHasReactionsOnDeleteQuery, now, postId, postId)
		if err != nil {
			mlog.Warn("Unable to update Post.HasReactions while removing reactions",
				mlog.String("post_id", postId),
				mlog.Err(err))
		}
	}

	if err = txn.Commit(); err != nil {
		return err
	}
	return nil
}

// DeleteOrphanedRows removes entries from Reactions when a corresponding post no longer exists.
func (s *SqlReactionStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
	// We need the extra level of nesting to deal with MySQL's locking
	const query = `
	DELETE FROM Reactions WHERE PostId IN (
		SELECT * FROM (
			SELECT PostId FROM Reactions
			LEFT JOIN Posts ON Reactions.PostId = Posts.Id
			WHERE Posts.Id IS NULL
			LIMIT ?
		) AS A
	)`
	result, err := s.GetMasterX().Exec(query, limit)
	if err != nil {
		return
	}
	deleted, err = result.RowsAffected()
	return
}

func (s *SqlReactionStore) DeleteOrphanedRowsByIds(r *model.RetentionIdsForDeletion) error {
	txn, err := s.GetMasterX().Beginx()
	if err != nil {
		return err
	}
	defer finalizeTransactionX(txn, &err)

	query := s.getQueryBuilder().
		Delete("Reactions").
		Where(
			sq.Eq{"PostId": r.Ids},
		)

	_, err = txn.ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete orphaned reactions with postIds=%s", r.Ids)
	}
	err = deleteFromRetentionIdsTx(txn, r.Id)
	if err != nil {
		return err
	}
	if err = txn.Commit(); err != nil {
		return err
	}
	return nil
}

func (s *SqlReactionStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	var query string
	if s.DriverName() == "postgres" {
		query = "DELETE from Reactions WHERE CreateAt = any (array (SELECT CreateAt FROM Reactions WHERE CreateAt < ? LIMIT ?))"
	} else {
		query = "DELETE from Reactions WHERE CreateAt < ? LIMIT ?"
	}

	sqlResult, err := s.GetMasterX().Exec(query, endTime, limit)
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete Reactions")
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "unable to get rows affected for deleted Reactions")
	}
	return rowsAffected, nil
}

func (s *SqlReactionStore) saveReactionAndUpdatePost(transaction *sqlxTxWrapper, reaction *model.Reaction) error {
	reaction.DeleteAt = 0

	if s.DriverName() == model.DatabaseDriverMysql {
		if _, err := transaction.NamedExec(
			`INSERT INTO
				Reactions
				(UserId, PostId, EmojiName, CreateAt, UpdateAt, DeleteAt, RemoteId, ChannelId)
			VALUES
				(:UserId, :PostId, :EmojiName, :CreateAt, :UpdateAt, :DeleteAt, :RemoteId, :ChannelId)
			ON DUPLICATE KEY UPDATE
				UpdateAt = :UpdateAt, DeleteAt = :DeleteAt, RemoteId = :RemoteId, ChannelId = :ChannelId`, reaction); err != nil {
			return err
		}
	} else if s.DriverName() == model.DatabaseDriverPostgres {
		if _, err := transaction.NamedExec(
			`INSERT INTO
				Reactions
				(UserId, PostId, EmojiName, CreateAt, UpdateAt, DeleteAt, RemoteId, ChannelId)
			VALUES
				(:UserId, :PostId, :EmojiName, :CreateAt, :UpdateAt, :DeleteAt, :RemoteId, :ChannelId)
			ON CONFLICT (UserId, PostId, EmojiName)
				DO UPDATE SET UpdateAt = :UpdateAt, DeleteAt = :DeleteAt, RemoteId = :RemoteId, ChannelId = :ChannelId`, reaction); err != nil {
			return err
		}
	}
	return updatePostForReactionsOnInsert(transaction, reaction.PostId)
}

func deleteReactionAndUpdatePost(transaction *sqlxTxWrapper, reaction *model.Reaction) error {
	if _, err := transaction.Exec(
		`UPDATE
			Reactions
		SET
			UpdateAt = ?, DeleteAt = ?, RemoteId = ?
		WHERE
			PostId = ? AND
			UserId = ? AND
			EmojiName = ?`, reaction.UpdateAt, reaction.UpdateAt, reaction.RemoteId, reaction.PostId, reaction.UserId, reaction.EmojiName); err != nil {
		return err
	}

	return updatePostForReactionsOnDelete(transaction, reaction.PostId)
}

const (
	UpdatePostHasReactionsOnDeleteQuery = `UPDATE
			Posts
		SET
			UpdateAt = ?,
			HasReactions = (SELECT count(0) > 0 FROM Reactions WHERE PostId = ? AND COALESCE(DeleteAt, 0) = 0)
		WHERE
			Id = ?`
)

func updatePostForReactionsOnDelete(transaction *sqlxTxWrapper, postId string) error {
	updateAt := model.GetMillis()
	_, err := transaction.Exec(UpdatePostHasReactionsOnDeleteQuery, updateAt, postId, postId)
	return err
}

func updatePostForReactionsOnInsert(transaction *sqlxTxWrapper, postId string) error {
	_, err := transaction.Exec(
		`UPDATE
			Posts
		SET
			HasReactions = True,
			UpdateAt = ?
		WHERE
			Id = ?`,
		model.GetMillis(),
		postId,
	)

	return err
}
