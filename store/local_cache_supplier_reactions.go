// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/platform/model"
)

func (s *LocalCacheSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) LayeredStoreSupplierResult {
	s.reactionCache.AddWithExpiresInSecs(postId, reactions, REACTION_CACHE_SEC)
}

func (s *LocalCacheSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) LayeredStoreSupplierResult {
	panic("not implemented")
}

func (s *LocalCacheSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) LayeredStoreSupplierResult {
	panic("not implemented")
}

func (s *LocalCacheSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) LayeredStoreSupplierResult {
	panic("not implemented")
}
