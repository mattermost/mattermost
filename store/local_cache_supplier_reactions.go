// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/platform/model"
)

func (s *LocalCacheSupplier) handleClusterInvalidateReaction(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.reactionCache.Purge()
	} else {
		s.reactionCache.Remove(msg.Data)
	}
}

func (s *LocalCacheSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	doInvalidateCacheCluster(s.reactionCache, reaction.PostId)
	return s.Next().ReactionSave(ctx, reaction, hints...)
}

func (s *LocalCacheSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	doInvalidateCacheCluster(s.reactionCache, reaction.PostId)
	return s.Next().ReactionDelete(ctx, reaction, hints...)
}

func (s *LocalCacheSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if result := doStandardReadCache(ctx, s.reactionCache, postId, hints...); result != nil {
		return result
	}

	result := s.Next().ReactionGetForPost(ctx, postId, hints...)

	doStandardAddToCache(ctx, s.reactionCache, postId, result, hints...)

	return result
}

func (s *LocalCacheSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// This could be improved. Right now we just clear the whole
	// cache because we don't have a way find what post Ids have this emoji name.
	doClearCacheCluster(s.reactionCache)
	return s.Next().ReactionDeleteAllWithEmojiName(ctx, emojiName, hints...)
}
