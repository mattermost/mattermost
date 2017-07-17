// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/platform/model"
)

func initSqlSupplierReactions(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Reaction{}, "Reactions").SetKeys(false, "UserId", "PostId", "EmojiName")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("PostId").SetMaxSize(26)
		table.ColMap("EmojiName").SetMaxSize(64)
	}
}

func (s *SqlSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) LayeredStoreSupplierResult {
	panic("not implemented")
}

func (s *SqlSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) LayeredStoreSupplierResult {
	panic("not implemented")
}

func (s *SqlSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) LayeredStoreSupplierResult {
	panic("not implemented")
}

func (s *SqlSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) LayeredStoreSupplierResult {
	panic("not implemented")
}
