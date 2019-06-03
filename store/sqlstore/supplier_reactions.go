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

func (s *SqlSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...store.LayeredStoreHint) (*model.Reaction, *model.AppError) {
	reaction.PreSave()
	if err := reaction.IsValid(); err != nil {
		return nil, err
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, model.NewAppError("SqlReactionStore.Save", "store.sql_reaction.save.begin.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)
	appErr := saveReactionAndUpdatePost(transaction, reaction)
	if appErr != nil {
		// We don't consider duplicated save calls as an error
		if !IsUniqueConstraintError(appErr, []string{"reactions_pkey", "PRIMARY"}) {
			return nil, model.NewAppError("SqlPreferenceStore.Save", "store.sql_reaction.save.save.app_error", nil, appErr.Error(), http.StatusBadRequest)
		}
	} else {
		if err := transaction.Commit(); err != nil {
			return nil, model.NewAppError("SqlPreferenceStore.Save", "store.sql_reaction.save.commit.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return reaction, nil
}

func (s *SqlSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...store.LayeredStoreHint) (*model.Reaction, *model.AppError) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, model.NewAppError("SqlReactionStore.Delete", "store.sql_reaction.delete.begin.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	appErr := deleteReactionAndUpdatePost(transaction, reaction)
	if appErr != nil {
		return nil, model.NewAppError("SqlPreferenceStore.Delete", "store.sql_reaction.delete.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	if err := transaction.Commit(); err != nil {
		return nil, model.NewAppError("SqlPreferenceStore.Delete", "store.sql_reaction.delete.commit.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return reaction, nil
}

func (s *SqlSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...store.LayeredStoreHint) ([]*model.Reaction, *model.AppError) {
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
		return nil, model.NewAppError("SqlReactionStore.GetForPost", "store.sql_reaction.get_for_post.app_error", nil, "", http.StatusInternalServerError)
	}

	return reactions, nil
}

func (s *SqlSupplier) ReactionsBulkGetForPosts(ctx context.Context, postIds []string, hints ...store.LayeredStoreHint) ([]*model.Reaction, *model.AppError) {
	keys, params := MapStringsToQueryParams(postIds, "postId")
	var reactions []*model.Reaction

	if _, err := s.GetReplica().Select(&reactions, `SELECT
				*
			FROM
				Reactions
			WHERE
				PostId IN `+keys+`
			ORDER BY
				CreateAt`, params); err != nil {
		return nil, model.NewAppError("SqlReactionStore.GetForPost", "store.sql_reaction.bulk_get_for_post_ids.app_error", nil, "", http.StatusInternalServerError)
	}
	return reactions, nil
}

func (s *SqlSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...store.LayeredStoreHint) *model.AppError {
	var reactions []*model.Reaction

	if _, err := s.GetReplica().Select(&reactions,
		`SELECT
				*
			FROM
				Reactions
			WHERE
				EmojiName = :EmojiName`, map[string]interface{}{"EmojiName": emojiName}); err != nil {
		return model.NewAppError("SqlReactionStore.DeleteAllWithEmojiName",
			"store.sql_reaction.delete_all_with_emoji_name.get_reactions.app_error", nil,
			"emoji_name="+emojiName+", error="+err.Error(), http.StatusInternalServerError)
	}

	if _, err := s.GetMaster().Exec(
		`DELETE FROM
				Reactions
			WHERE
				EmojiName = :EmojiName`, map[string]interface{}{"EmojiName": emojiName}); err != nil {
		return model.NewAppError("SqlReactionStore.DeleteAllWithEmojiName",
			"store.sql_reaction.delete_all_with_emoji_name.delete_reactions.app_error", nil,
			"emoji_name="+emojiName+", error="+err.Error(), http.StatusInternalServerError)
	}

	for _, reaction := range reactions {
		if _, err := s.GetMaster().Exec(UPDATE_POST_HAS_REACTIONS_ON_DELETE_QUERY,
			map[string]interface{}{"PostId": reaction.PostId, "UpdateAt": model.GetMillis()}); err != nil {
			mlog.Warn(fmt.Sprintf("Unable to update Post.HasReactions while removing reactions post_id=%v, error=%v", reaction.PostId, err.Error()))
		}
	}

	return nil
}

func (s *SqlSupplier) ReactionPermanentDeleteBatch(ctx context.Context, endTime int64, limit int64, hints ...store.LayeredStoreHint) (int64, *model.AppError) {
	var query string
	if s.DriverName() == "postgres" {
		query = "DELETE from Reactions WHERE CreateAt = any (array (SELECT CreateAt FROM Reactions WHERE CreateAt < :EndTime LIMIT :Limit))"
	} else {
		query = "DELETE from Reactions WHERE CreateAt < :EndTime LIMIT :Limit"
	}

	sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
	if err != nil {
		return 0, model.NewAppError("SqlReactionStore.PermanentDeleteBatch", "store.sql_reaction.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}

	rowsAffected, err1 := sqlResult.RowsAffected()
	if err1 != nil {
		return 0, model.NewAppError("SqlReactionStore.PermanentDeleteBatch", "store.sql_reaction.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}
	return rowsAffected, nil
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
	UPDATE_POST_HAS_REACTIONS_ON_DELETE_QUERY = `UPDATE
			Posts
		SET
			UpdateAt = :UpdateAt,
			HasReactions = (SELECT count(0) > 0 FROM Reactions WHERE PostId = :PostId)
		WHERE
			Id = :PostId`
)

func updatePostForReactionsOnDelete(transaction *gorp.Transaction, postId string) error {
	updateAt := model.GetMillis()
	_, err := transaction.Exec(UPDATE_POST_HAS_REACTIONS_ON_DELETE_QUERY, map[string]interface{}{"PostId": postId, "UpdateAt": updateAt})
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
