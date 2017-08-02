// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/gorp"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func initSqlSupplierReactions(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Reaction{}, "Reactions").SetKeys(false, "UserId", "PostId", "EmojiName")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("PostId").SetMaxSize(26)
		table.ColMap("EmojiName").SetMaxSize(64)
	}
}

func (s *SqlSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	result := NewSupplierResult()

	reaction.PreSave()
	if result.Err = reaction.IsValid(); result.Err != nil {
		return result
	}

	if transaction, err := s.GetMaster().Begin(); err != nil {
		result.Err = model.NewLocAppError("SqlReactionStore.Save", "store.sql_reaction.save.begin.app_error", nil, err.Error())
	} else {
		err := saveReactionAndUpdatePost(transaction, reaction)

		if err != nil {
			transaction.Rollback()

			// We don't consider duplicated save calls as an error
			if !IsUniqueConstraintError(err.Error(), []string{"reactions_pkey", "PRIMARY"}) {
				result.Err = model.NewLocAppError("SqlPreferenceStore.Save", "store.sql_reaction.save.save.app_error", nil, err.Error())
			}
		} else {
			if err := transaction.Commit(); err != nil {
				// don't need to rollback here since the transaction is already closed
				result.Err = model.NewLocAppError("SqlPreferenceStore.Save", "store.sql_reaction.save.commit.app_error", nil, err.Error())
			}
		}

		if result.Err == nil {
			result.Data = reaction
		}
	}

	return result
}

func (s *SqlSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	result := NewSupplierResult()

	if transaction, err := s.GetMaster().Begin(); err != nil {
		result.Err = model.NewLocAppError("SqlReactionStore.Delete", "store.sql_reaction.delete.begin.app_error", nil, err.Error())
	} else {
		err := deleteReactionAndUpdatePost(transaction, reaction)

		if err != nil {
			transaction.Rollback()

			result.Err = model.NewLocAppError("SqlPreferenceStore.Delete", "store.sql_reaction.delete.app_error", nil, err.Error())
		} else if err := transaction.Commit(); err != nil {
			// don't need to rollback here since the transaction is already closed
			result.Err = model.NewLocAppError("SqlPreferenceStore.Delete", "store.sql_reaction.delete.commit.app_error", nil, err.Error())
		} else {
			result.Data = reaction
		}
	}

	return result
}

func (s *SqlSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	result := NewSupplierResult()

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
		result.Err = model.NewLocAppError("SqlReactionStore.GetForPost", "store.sql_reaction.get_for_post.app_error", nil, "")
	} else {
		result.Data = reactions
	}

	return result
}

func (s *SqlSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	result := NewSupplierResult()

	var reactions []*model.Reaction

	if _, err := s.GetReplica().Select(&reactions,
		`SELECT
				*
			FROM
				Reactions
			WHERE
				EmojiName = :EmojiName`, map[string]interface{}{"EmojiName": emojiName}); err != nil {
		result.Err = model.NewLocAppError("SqlReactionStore.DeleteAllWithEmojiName",
			"store.sql_reaction.delete_all_with_emoji_name.get_reactions.app_error", nil,
			"emoji_name="+emojiName+", error="+err.Error())
		return result
	}

	if _, err := s.GetMaster().Exec(
		`DELETE FROM
				Reactions
			WHERE
				EmojiName = :EmojiName`, map[string]interface{}{"EmojiName": emojiName}); err != nil {
		result.Err = model.NewLocAppError("SqlReactionStore.DeleteAllWithEmojiName",
			"store.sql_reaction.delete_all_with_emoji_name.delete_reactions.app_error", nil,
			"emoji_name="+emojiName+", error="+err.Error())
		return result
	}

	for _, reaction := range reactions {
		if _, err := s.GetMaster().Exec(UPDATE_POST_HAS_REACTIONS_QUERY,
			map[string]interface{}{"PostId": reaction.PostId, "UpdateAt": model.GetMillis()}); err != nil {
			l4g.Warn(utils.T("store.sql_reaction.delete_all_with_emoji_name.update_post.warn"), reaction.PostId, err.Error())
		}
	}

	return result
}

func saveReactionAndUpdatePost(transaction *gorp.Transaction, reaction *model.Reaction) error {
	if err := transaction.Insert(reaction); err != nil {
		return err
	}

	return updatePostForReactions(transaction, reaction.PostId)
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

	return updatePostForReactions(transaction, reaction.PostId)
}

const (
	// Set HasReactions = true if and only if the post has reactions, update UpdateAt only if HasReactions changes
	UPDATE_POST_HAS_REACTIONS_QUERY = `UPDATE
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

func updatePostForReactions(transaction *gorp.Transaction, postId string) error {
	_, err := transaction.Exec(UPDATE_POST_HAS_REACTIONS_QUERY, map[string]interface{}{"PostId": postId, "UpdateAt": model.GetMillis()})

	return err
}
