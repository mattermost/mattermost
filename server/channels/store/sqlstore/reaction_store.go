// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"time"

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
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)
	if reaction.ChannelId == "" {
		// get channelId, if not already populated
		var channelIds []string
		query := "SELECT ChannelId from Posts where Id = ?"
		err = transaction.Select(&channelIds, query, reaction.PostId)
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

	transaction, err := s.GetMaster().Beginx()
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
	builder := s.getQueryBuilder().
		Select("UserId", "PostId", "EmojiName", "CreateAt", "COALESCE(UpdateAt, CreateAt) As UpdateAt",
			"COALESCE(DeleteAt, 0) As DeleteAt", "RemoteId", "ChannelId").
		From("Reactions").
		Where(sq.Eq{"PostId": postId}).
		Where(sq.Eq{"COALESCE(DeleteAt, 0)": 0}).
		OrderBy("CreateAt")

	var reactions []*model.Reaction
	if err := s.GetReplica().SelectBuilder(&reactions, builder); err != nil {
		return nil, errors.Wrapf(err, "failed to get Reactions with postId=%s", postId)
	}
	return reactions, nil
}

func (s *SqlReactionStore) ExistsOnPost(postId string, emojiName string) (bool, error) {
	query := s.getQueryBuilder().
		Select("1").
		From("Reactions").
		Where(sq.Eq{"PostId": postId}).
		Where(sq.Eq{"EmojiName": emojiName}).
		Where(sq.Eq{"COALESCE(DeleteAt, 0)": 0})

	var hasRows bool
	if err := s.GetReplica().GetBuilder(&hasRows, query); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, errors.Wrap(err, "failed to check for existing reaction")
	}

	return hasRows, nil
}

// GetForPostSince returns all reactions associated with `postId` updated after `since`.
func (s *SqlReactionStore) GetForPostSince(postId string, since int64, excludeRemoteId string, inclDeleted bool) ([]*model.Reaction, error) {
	query := s.getQueryBuilder().
		Select("UserId", "PostId", "EmojiName", "CreateAt", "COALESCE(UpdateAt, CreateAt) As UpdateAt",
			"COALESCE(DeleteAt, 0) As DeleteAt", "RemoteId").
		From("Reactions").
		Where(sq.Eq{"PostId": postId}).
		Where(sq.Gt{"UpdateAt": since}).
		OrderBy("CreateAt")

	if excludeRemoteId != "" {
		query = query.Where(sq.NotEq{"COALESCE(RemoteId, '')": excludeRemoteId})
	}

	if !inclDeleted {
		query = query.Where(sq.Eq{"COALESCE(DeleteAt, 0)": 0})
	}

	var reactions []*model.Reaction
	if err := s.GetReplica().SelectBuilder(&reactions, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find reactions")
	}
	return reactions, nil
}

func (s *SqlReactionStore) GetUniqueCountForPost(postId string) (int, error) {
	query := s.getQueryBuilder().
		Select("COUNT(DISTINCT EmojiName)").
		From("Reactions").
		Where(sq.Eq{"PostId": postId}).
		Where(sq.Eq{"DeleteAt": 0})

	var count int64
	err := s.GetReplica().GetBuilder(&count, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Reactions")
	}
	return int(count), nil
}

func (s *SqlReactionStore) BulkGetForPosts(postIds []string) ([]*model.Reaction, error) {
	placeholder, values := constructArrayArgs(postIds)
	var reactions []*model.Reaction

	if err := s.GetReplica().Select(&reactions,
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

func (s *SqlReactionStore) GetSingle(userID, postID, remoteID, emojiName string) (*model.Reaction, error) {
	query := s.getQueryBuilder().
		Select("UserId", "PostId", "EmojiName", "CreateAt",
			"COALESCE(UpdateAt, CreateAt) As UpdateAt", "COALESCE(DeleteAt, 0) As DeleteAt",
			"RemoteId", "ChannelId").
		From("Reactions").
		Where(sq.Eq{"UserId": userID}).
		Where(sq.Eq{"PostId": postID}).
		Where(sq.Eq{"COALESCE(RemoteId, '')": remoteID}).
		Where(sq.Eq{"EmojiName": emojiName})

	var reactions []*model.Reaction
	if err := s.GetReplica().SelectBuilder(&reactions, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find reaction")
	}
	if len(reactions) == 0 {
		return nil, store.NewErrNotFound("Reaction", fmt.Sprintf("user_id=%s, post_id=%s, remote_id=%s, emoji_name=%s",
			userID, postID, remoteID, emojiName))
	}
	return reactions[0], nil
}

func (s *SqlReactionStore) DeleteAllWithEmojiName(emojiName string) error {
	var reactions []*model.Reaction
	now := model.GetMillis()

	if err := s.GetReplica().Select(&reactions,
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

	_, err := s.GetMaster().Exec(
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
		_, err := s.GetMaster().Exec(UpdatePostHasReactionsOnDeleteQuery, now, reaction.PostId, reaction.PostId)
		if err != nil {
			mlog.Warn("Unable to update Post.HasReactions while removing reactions",
				mlog.String("post_id", reaction.PostId),
				mlog.Err(err))
		}
	}

	return nil
}

func (s *SqlReactionStore) permanentDeleteReactions(userId string) ([]string, error) {
	txn, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(txn, &err)

	postIds := []string{}
	err = txn.Select(&postIds, "SELECT PostId FROM Reactions WHERE UserId = ?", userId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get Reactions with userId=%s", userId)
	}

	query := s.getQueryBuilder().
		Delete("Reactions").
		Where(sq.And{
			sq.Eq{"PostId": postIds},
			sq.Eq{"UserId": userId},
		})

	_, err = txn.ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to delete reactions with userId=%s", userId)
	}
	if err = txn.Commit(); err != nil {
		return nil, err
	}
	return postIds, nil
}

func (s SqlReactionStore) PermanentDeleteByUser(userId string) error {
	now := model.GetMillis()

	postIds, err := s.permanentDeleteReactions(userId)
	if err != nil {
		return err
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return err
	}
	defer finalizeTransactionX(transaction, &err)

	for _, postId := range postIds {
		_, err = transaction.Exec(UpdatePostHasReactionsOnDeleteQuery, now, postId, postId)
		if err != nil {
			mlog.Warn("Unable to update Post.HasReactions while removing reactions",
				mlog.String("post_id", postId),
				mlog.Err(err))
		}
		time.Sleep(10 * time.Millisecond)
	}
	if err = transaction.Commit(); err != nil {
		return err
	}

	return nil
}

func (s *SqlReactionStore) DeleteOrphanedRowsByIds(r *model.RetentionIdsForDeletion) (int64, error) {
	txn, err := s.GetMaster().Beginx()
	if err != nil {
		return 0, err
	}
	defer finalizeTransactionX(txn, &err)

	query := s.getQueryBuilder().
		Delete("Reactions").
		Where(
			sq.Eq{"PostId": r.Ids},
		)

	sqlResult, err := txn.ExecBuilder(query)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to delete orphaned reactions with RetentionIdsForDeletion Id=%s", r.Id)
	}
	err = deleteFromRetentionIdsTx(txn, r.Id)
	if err != nil {
		return 0, err
	}
	if err = txn.Commit(); err != nil {
		return 0, err
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "unable to retrieve rows affected")
	}

	return rowsAffected, nil
}

func (s *SqlReactionStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	var query string
	if s.DriverName() == "postgres" {
		query = "DELETE from Reactions WHERE CreateAt = any (array (SELECT CreateAt FROM Reactions WHERE CreateAt < ? LIMIT ?))"
	} else {
		query = "DELETE from Reactions WHERE CreateAt < ? LIMIT ?"
	}

	sqlResult, err := s.GetMaster().Exec(query, endTime, limit)
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
