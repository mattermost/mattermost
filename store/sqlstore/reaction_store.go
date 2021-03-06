// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/mattermost/gorp"
	"github.com/pkg/errors"
)

type SqlReactionStore struct {
	*SqlStore
}

func newSqlReactionStore(sqlStore *SqlStore) store.ReactionStore {
	s := &SqlReactionStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Reaction{}, "Reactions").SetKeys(false, "PostId", "UserId", "EmojiName")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("PostId").SetMaxSize(26)
		table.ColMap("EmojiName").SetMaxSize(64)
	}

	return s
}

func (s *SqlReactionStore) Save(reaction *model.Reaction) (*model.Reaction, error) {
	reaction.PreSave()
	if err := reaction.IsValid(); err != nil {
		return nil, err
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransaction(transaction)
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

func (s *SqlReactionStore) Delete(reaction *model.Reaction) (*model.Reaction, error) {
	reaction.PreUpdate()

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransaction(transaction)

	if err := deleteReactionAndUpdatePost(transaction, reaction); err != nil {
		return nil, errors.Wrap(err, "deleteReactionAndUpdatePost")
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return reaction, nil
}

func (s *SqlReactionStore) GetForPost(postId string, allowFromCache bool) ([]*model.Reaction, error) {
	var reactions []*model.Reaction

	if _, err := s.GetReplica().Select(&reactions,
		`SELECT
				UserId,
				PostId,
				EmojiName,
				CreateAt,
				COALESCE(UpdateAt, CreateAt) As UpdateAt,
				COALESCE(DeleteAt, 0) As DeleteAt
			FROM
				Reactions
			WHERE
				PostId = :PostId AND COALESCE(DeleteAt, 0) = 0
			ORDER BY
				CreateAt`, map[string]interface{}{"PostId": postId}); err != nil {
		return nil, errors.Wrapf(err, "failed to get Reactions with postId=%s", postId)
	}

	return reactions, nil
}

func (s *SqlReactionStore) BulkGetForPosts(postIds []string) ([]*model.Reaction, error) {
	keys, params := MapStringsToQueryParams(postIds, "postId")
	var reactions []*model.Reaction

	if _, err := s.GetReplica().Select(&reactions,
		`SELECT
				UserId,
				PostId,
				EmojiName,
				CreateAt,
				COALESCE(UpdateAt, CreateAt) As UpdateAt,
				COALESCE(DeleteAt, 0) As DeleteAt
			FROM
				Reactions
			WHERE
				PostId IN `+keys+` AND COALESCE(DeleteAt, 0) = 0
			ORDER BY
				CreateAt`, params); err != nil {
		return nil, errors.Wrap(err, "failed to get Reactions")
	}
	return reactions, nil
}

func (s *SqlReactionStore) DeleteAllWithEmojiName(emojiName string) error {
	var reactions []*model.Reaction
	now := model.GetMillis()

	params := map[string]interface{}{
		"EmojiName": emojiName,
		"UpdateAt":  now,
		"DeleteAt":  now,
	}

	if _, err := s.GetReplica().Select(&reactions,
		`SELECT
					UserId,
					PostId,
					EmojiName,
					CreateAt,
					COALESCE(UpdateAt, CreateAt) As UpdateAt,
					COALESCE(DeleteAt, 0) As DeleteAt
				FROM
					Reactions
				WHERE
					EmojiName = :EmojiName AND COALESCE(DeleteAt, 0) = 0`, params); err != nil {
		return errors.Wrapf(err, "failed to get Reactions with emojiName=%s", emojiName)
	}

	_, err := s.GetMaster().Exec(
		`UPDATE
			Reactions
		SET
			UpdateAt = :UpdateAt, DeleteAt = :DeleteAt
		WHERE
			EmojiName = :EmojiName AND COALESCE(DeleteAt, 0) = 0`, params)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Reactions with emojiName=%s", emojiName)
	}

	for _, reaction := range reactions {
		reaction := reaction
		_, err := s.GetMaster().Exec(UpdatePostHasReactionsOnDeleteQuery,
			map[string]interface{}{
				"PostId":   reaction.PostId,
				"UpdateAt": model.GetMillis(),
			})
		if err != nil {
			mlog.Warn("Unable to update Post.HasReactions while removing reactions",
				mlog.String("post_id", reaction.PostId),
				mlog.Err(err))
		}
	}

	return nil
}

func (s *SqlReactionStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	var query string
	if s.DriverName() == "postgres" {
		query = "DELETE from Reactions WHERE CreateAt = any (array (SELECT CreateAt FROM Reactions WHERE CreateAt < :EndTime LIMIT :Limit))"
	} else {
		query = "DELETE from Reactions WHERE CreateAt < :EndTime LIMIT :Limit"
	}

	sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete Reactions")
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "unable to get rows affected for deleted Reactions")
	}
	return rowsAffected, nil
}

func (s *SqlReactionStore) saveReactionAndUpdatePost(transaction *gorp.Transaction, reaction *model.Reaction) error {
	params := map[string]interface{}{
		"UserId":    reaction.UserId,
		"PostId":    reaction.PostId,
		"EmojiName": reaction.EmojiName,
		"CreateAt":  reaction.CreateAt,
		"UpdateAt":  reaction.UpdateAt,
	}

	if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		if _, err := transaction.Exec(
			`INSERT INTO
				Reactions
				(UserId, PostId, EmojiName, CreateAt, UpdateAt, DeleteAt)
			VALUES
				(:UserId, :PostId, :EmojiName, :CreateAt, :UpdateAt, 0)
			ON DUPLICATE KEY UPDATE
				UpdateAt = :UpdateAt, DeleteAt = 0`, params); err != nil {
			return err
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		if _, err := transaction.Exec(
			`INSERT INTO
				Reactions
				(UserId, PostId, EmojiName, CreateAt, UpdateAt, DeleteAt)
			VALUES
				(:UserId, :PostId, :EmojiName, :CreateAt, :UpdateAt, 0)
			ON CONFLICT (UserId, PostId, EmojiName) 
				DO UPDATE SET UpdateAt = :UpdateAt, DeleteAt = 0`, params); err != nil {
			return err
		}
	}
	return updatePostForReactionsOnInsert(transaction, reaction.PostId)
}

func deleteReactionAndUpdatePost(transaction *gorp.Transaction, reaction *model.Reaction) error {
	params := map[string]interface{}{
		"UserId":    reaction.UserId,
		"PostId":    reaction.PostId,
		"EmojiName": reaction.EmojiName,
		"CreateAt":  reaction.CreateAt,
		"UpdateAt":  reaction.UpdateAt,
		"DeleteAt":  reaction.UpdateAt, // DeleteAt = UpdateAt
	}

	if _, err := transaction.Exec(
		`UPDATE
			Reactions
		SET 
			UpdateAt = :UpdateAt, DeleteAt = :DeleteAt
		WHERE
			PostId = :PostId AND
			UserId = :UserId AND
			EmojiName = :EmojiName`, params); err != nil {
		return err
	}

	return updatePostForReactionsOnDelete(transaction, reaction.PostId)
}

const (
	UpdatePostHasReactionsOnDeleteQuery = `UPDATE
			Posts
		SET
			UpdateAt = :UpdateAt,
			HasReactions = (SELECT count(0) > 0 FROM Reactions WHERE PostId = :PostId AND COALESCE(DeleteAt, 0) = 0)
		WHERE
			Id = :PostId`
)

func updatePostForReactionsOnDelete(transaction *gorp.Transaction, postId string) error {
	updateAt := model.GetMillis()
	_, err := transaction.Exec(UpdatePostHasReactionsOnDeleteQuery, map[string]interface{}{"PostId": postId, "UpdateAt": updateAt})
	return err
}

func updatePostForReactionsOnInsert(transaction *gorp.Transaction, postId string) error {
	_, err := transaction.Exec(
		`UPDATE
			Posts
		SET
			HasReactions = True,
			UpdateAt = :UpdateAt
		WHERE
			Id = :PostId`,
		map[string]interface{}{"PostId": postId, "UpdateAt": model.GetMillis()})

	return err
}
