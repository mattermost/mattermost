// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (s *RedisSupplier) ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) (*model.Reaction, *model.AppError) {
	if err := s.client.Del("reactions:" + reaction.PostId).Err(); err != nil {
		mlog.Error("Redis failed to remove key reactions:" + reaction.PostId + " Error: " + err.Error())
	}
	return s.Next().ReactionSave(ctx, reaction, hints...)
}

func (s *RedisSupplier) ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) (*model.Reaction, *model.AppError) {
	if err := s.client.Del("reactions:" + reaction.PostId).Err(); err != nil {
		mlog.Error("Redis failed to remove key reactions:" + reaction.PostId + " Error: " + err.Error())
	}
	return s.Next().ReactionDelete(ctx, reaction, hints...)
}

func (s *RedisSupplier) ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) ([]*model.Reaction, *model.AppError) {
	var reaction []*model.Reaction
	found, err := s.load("reactions:"+postId, &reaction)
	if found {
		return reaction, nil
	}

	if err != nil {
		mlog.Error("Redis encountered an error on read: " + err.Error())
	}

	reaction, appErr := s.Next().ReactionGetForPost(ctx, postId, hints...)
	if appErr != nil {
		return nil, appErr
	}

	if err := s.save("reactions:"+postId, reaction, REDIS_EXPIRY_TIME); err != nil {
		mlog.Error("Redis encountered and error on write: " + err.Error())
	}

	return reaction, nil
}

func (s *RedisSupplier) ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) *model.AppError {
	// Ignoring this. It's probably OK to have the emoji slowly expire from Redis.
	return s.Next().ReactionDeleteAllWithEmojiName(ctx, emojiName, hints...)
}

func (s *RedisSupplier) ReactionPermanentDeleteBatch(ctx context.Context, endTime int64, limit int64, hints ...LayeredStoreHint) (int64, *model.AppError) {
	// Ignoring this. It's probably OK to have the emoji slowly expire from Redis.
	return s.Next().ReactionPermanentDeleteBatch(ctx, endTime, limit, hints...)
}

func (s *RedisSupplier) ReactionsBulkGetForPosts(ctx context.Context, postIds []string, hints ...LayeredStoreHint) ([]*model.Reaction, *model.AppError) {
	// Ignoring this.
	return s.Next().ReactionsBulkGetForPosts(ctx, postIds, hints...)
}
