// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func initSqlSupplierReactions(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Reaction{}, "Reactions").SetKeys(false, "UserId", "PostId", "EmojiName")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("PostId").SetMaxSize(26)
		table.ColMap("EmojiName").SetMaxSize(64)
	}
}

func (s *SqlSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	reaction.PreSave()
	if result.Err = reaction.IsValid(); result.Err != nil {
		return result
	}

	if transaction, err := s.GetMaster().Begin(); err != nil {
		result.Err = model.NewAppError("SqlReactionStore.Save", "store.sql_reaction.save.begin.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else {
		err := saveReactionAndUpdatePost(transaction, reaction)

		if err != nil {
			transaction.Rollback()

			// We don't consider duplicated save calls as an error
			if !IsUniqueConstraintError(err, []string{"reactions_pkey", "PRIMARY"}) {
				result.Err = model.NewAppError("SqlPreferenceStore.Save", "store.sql_reaction.save.save.app_error", nil, err.Error(), http.StatusBadRequest)
			}
		} else {
			if err := transaction.Commit(); err != nil {
				// don't need to rollback here since the transaction is already closed
				result.Err = model.NewAppError("SqlPreferenceStore.Save", "store.sql_reaction.save.commit.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		if result.Err == nil {
			result.Data = reaction
		}
	}

	return result
}

func (s *SqlSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if transaction, err := s.GetMaster().Begin(); err != nil {
		result.Err = model.NewAppError("SqlReactionStore.Delete", "store.sql_reaction.delete.begin.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else {
		err := deleteReactionAndUpdatePost(transaction, reaction)

		if err != nil {
			transaction.Rollback()

			result.Err = model.NewAppError("SqlPreferenceStore.Delete", "store.sql_reaction.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if err := transaction.Commit(); err != nil {
			// don't need to rollback here since the transaction is already closed
			result.Err = model.NewAppError("SqlPreferenceStore.Delete", "store.sql_reaction.delete.commit.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = reaction
		}
	}

	return result
}

func (s *SqlSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var reactions []*model.Reaction

	if _, err := s.GetReplica().Select(&reactions,
		`SELECT
				*
			FROM
				Reactions
			WHERE
				PostId = :PostId
			ORDER BY
				CreateAt`, map[string]interface{}{"PostId": postId}); err != nil {
		result.Err = model.NewAppError("SqlReactionStore.GetForPost", "store.sql_reaction.get_for_post.app_error", nil, "", http.StatusInternalServerError)
	} else {
		result.Data = reactions
	}

	return result
}

func (s *SqlSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var reactions []*model.Reaction

	if _, err := s.GetReplica().Select(&reactions,
		`SELECT
				*
			FROM
				Reactions
			WHERE
				EmojiName = :EmojiName`, map[string]interface{}{"EmojiName": emojiName}); err != nil {
		result.Err = model.NewAppError("SqlReactionStore.DeleteAllWithEmojiName",
			"store.sql_reaction.delete_all_with_emoji_name.get_reactions.app_error", nil,
			"emoji_name="+emojiName+", error="+err.Error(), http.StatusInternalServerError)
		return result
	}

	if _, err := s.GetMaster().Exec(
		`DELETE FROM
				Reactions
			WHERE
				EmojiName = :EmojiName`, map[string]interface{}{"EmojiName": emojiName}); err != nil {
		result.Err = model.NewAppError("SqlReactionStore.DeleteAllWithEmojiName",
			"store.sql_reaction.delete_all_with_emoji_name.delete_reactions.app_error", nil,
			"emoji_name="+emojiName+", error="+err.Error(), http.StatusInternalServerError)
		return result
	}

	for _, reaction := range reactions {
		if _, err := s.GetMaster().Exec(UPDATE_POST_HAS_REACTIONS_ON_DELETE_QUERY,
			map[string]interface{}{"PostId": reaction.PostId, "UpdateAt": model.GetMillis()}); err != nil {
			mlog.Warn(fmt.Sprintf("Unable to update Post.HasReactions while removing reactions post_id=%v, error=%v", reaction.PostId, err.Error()))
		}
	}

	return result
}

func (s *SqlSupplier) ReactionPermanentDeleteBatch(ctx context.Context, endTime int64, limit int64, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var query string
	if s.DriverName() == "postgres" {
		query = "DELETE from Reactions WHERE CreateAt = any (array (SELECT CreateAt FROM Reactions WHERE CreateAt < :EndTime LIMIT :Limit))"
	} else {
		query = "DELETE from Reactions WHERE CreateAt < :EndTime LIMIT :Limit"
	}

	sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
	if err != nil {
		result.Err = model.NewAppError("SqlReactionStore.PermanentDeleteBatch", "store.sql_reaction.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	} else {
		rowsAffected, err1 := sqlResult.RowsAffected()
		if err1 != nil {
			result.Err = model.NewAppError("SqlReactionStore.PermanentDeleteBatch", "store.sql_reaction.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
			result.Data = int64(0)
		} else {
			result.Data = rowsAffected
		}
	}

	return result
}

func saveReactionAndUpdatePost(transaction *gorp.Transaction, reaction *model.Reaction) error {
	if err := transaction.Insert(reaction); err != nil {
		return err
	}

	return updatePostForReactionsOnInsert(transaction, reaction.PostId)
}

func deleteReactionAndUpdatePost(transaction *gorp.Transaction, reaction *model.Reaction) error {
	if _, err := transaction.Exec(
		`DELETE FROM
			Reactions
		WHERE
			PostId = :PostId AND
			UserId = :UserId AND
			EmojiName = :EmojiName`,
		map[string]interface{}{"PostId": reaction.PostId, "UserId": reaction.UserId, "EmojiName": reaction.EmojiName}); err != nil {
		return err
	}

	return updatePostForReactionsOnDelete(transaction, reaction.PostId)
}

const (
	// Set HasReactions = true if and only if the post has reactions, update UpdateAt only if HasReactions changes
	UPDATE_POST_HAS_REACTIONS_ON_DELETE_QUERY = `UPDATE
			Posts
		SET
			UpdateAt = (CASE
				WHEN HasReactions != (SELECT count(0) > 0 FROM Reactions WHERE PostId = :PostId) THEN :UpdateAt
				ELSE UpdateAt
			END),
			HasReactions = (SELECT count(0) > 0 FROM Reactions WHERE PostId = :PostId)
		WHERE
			Id = :PostId`
)

func updatePostForReactionsOnDelete(transaction *gorp.Transaction, postId string) error {
	_, err := transaction.Exec(UPDATE_POST_HAS_REACTIONS_ON_DELETE_QUERY, map[string]interface{}{"PostId": postId, "UpdateAt": model.GetMillis()})

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
			Id = :PostId AND HasReactions = False`,
		map[string]interface{}{"PostId": postId, "UpdateAt": model.GetMillis()})

	return err
}
