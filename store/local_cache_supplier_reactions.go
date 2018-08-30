// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost-server/model"
)

func (s *LocalCacheSupplier) handleClusterInvalidateReaction(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.reactionCache.Purge()
	} else {
		s.reactionCache.Remove(msg.Data)
	}
}

func (s *LocalCacheSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	defer s.doInvalidateCacheCluster(s.reactionCache, reaction.PostId)
	return s.Next().ReactionSave(ctx, reaction, hints...)
}

func (s *LocalCacheSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	defer s.doInvalidateCacheCluster(s.reactionCache, reaction.PostId)
	return s.Next().ReactionDelete(ctx, reaction, hints...)
}

func (s *LocalCacheSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if result := s.doStandardReadCache(ctx, s.reactionCache, postId, hints...); result != nil {
		return result
	}

	result := s.Next().ReactionGetForPost(ctx, postId, hints...)

	s.doStandardAddToCache(ctx, s.reactionCache, postId, result, hints...)

	return result
}

func (s *LocalCacheSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// This could be improved. Right now we just clear the whole
	// cache because we don't have a way find what post Ids have this emoji name.
	defer s.doClearCacheCluster(s.reactionCache)
	return s.Next().ReactionDeleteAllWithEmojiName(ctx, emojiName, hints...)
}

func (s *LocalCacheSupplier) ReactionPermanentDeleteBatch(ctx context.Context, endTime int64, limit int64, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// Don't bother to clear the cache as the posts will be gone anyway and the reactions being deleted will
	// expire from the cache in due course.
	return s.Next().ReactionPermanentDeleteBatch(ctx, endTime, limit)
}
