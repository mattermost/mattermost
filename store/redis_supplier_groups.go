// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost-server/model"
)

func (s *RedisSupplier) GroupCreate(ctx context.Context, group *model.Group, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupCreate(ctx, group, hints...)
}

func (s *RedisSupplier) GroupGet(ctx context.Context, groupID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGet(ctx, groupID, hints...)
}

func (s *RedisSupplier) GroupGetByRemoteID(ctx context.Context, remoteID string, groupType model.GroupType, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetByRemoteID(ctx, remoteID, groupType, hints...)
}

func (s *RedisSupplier) GroupGetAllPage(ctx context.Context, offset int, limit int, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetAllPage(ctx, offset, limit, hints...)
}

func (s *RedisSupplier) GroupUpdate(ctx context.Context, group *model.Group, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupUpdate(ctx, group, hints...)
}

func (s *RedisSupplier) GroupDelete(ctx context.Context, groupID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupDelete(ctx, groupID, hints...)
}

func (s *RedisSupplier) GroupCreateMember(ctx context.Context, groupID string, userID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupCreateMember(ctx, groupID, userID, hints...)
}

func (s *RedisSupplier) GroupDeleteMember(ctx context.Context, groupID string, userID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupDeleteMember(ctx, groupID, userID, hints...)
}

func (s *RedisSupplier) GroupCreateGroupSyncable(ctx context.Context, groupSyncable *model.GroupSyncable, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupCreateGroupSyncable(ctx, groupSyncable, hints...)
}

func (s *RedisSupplier) GroupGetGroupSyncable(ctx context.Context, groupID string, syncableID string, syncableType model.GroupSyncableType, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetGroupSyncable(ctx, groupID, syncableID, syncableType, hints...)
}

func (s *RedisSupplier) GroupGetAllGroupSyncablesByGroupPage(ctx context.Context, groupID string, syncableType model.GroupSyncableType, offset int, limit int, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetAllGroupSyncablesByGroupPage(ctx, groupID, syncableType, offset, limit, hints...)
}

func (s *RedisSupplier) GroupUpdateGroupSyncable(ctx context.Context, groupSyncable *model.GroupSyncable, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupUpdateGroupSyncable(ctx, groupSyncable, hints...)
}

func (s *RedisSupplier) GroupDeleteGroupSyncable(ctx context.Context, groupID string, syncableID string, syncableType model.GroupSyncableType, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupDeleteGroupSyncable(ctx, groupID, syncableID, syncableType, hints...)
}
