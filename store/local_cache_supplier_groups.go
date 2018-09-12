// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost-server/model"
)

func (s *LocalCacheSupplier) handleClusterInvalidateGroup(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.groupCache.Purge()
	} else {
		s.groupCache.Remove(msg.Data)
	}
}

func (s *LocalCacheSupplier) GroupCreate(ctx context.Context, group *model.Group, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupCreate(ctx, group, hints...)
}

func (s *LocalCacheSupplier) GroupGet(ctx context.Context, groupId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if result := s.doStandardReadCache(ctx, s.groupCache, groupId, hints...); result != nil {
		return result
	}

	result := s.Next().GroupGet(ctx, groupId, hints...)

	s.doStandardAddToCache(ctx, s.groupCache, groupId, result, hints...)

	return result
}

func (s *LocalCacheSupplier) GroupGetAllPage(ctx context.Context, offset int, limit int, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupGetAllPage(ctx, offset, limit, hints...)
}

func (s *LocalCacheSupplier) GroupUpdate(ctx context.Context, group *model.Group, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	defer s.doInvalidateCacheCluster(s.groupCache, group.Id)
	return s.Next().GroupUpdate(ctx, group, hints...)
}

func (s *LocalCacheSupplier) GroupDelete(ctx context.Context, groupId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	defer s.doInvalidateCacheCluster(s.groupCache, groupId)
	defer s.doClearCacheCluster(s.roleCache)

	return s.Next().GroupDelete(ctx, groupId, hints...)
}

func (s *LocalCacheSupplier) GroupCreateMember(ctx context.Context, groupID string, userID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupCreateMember(ctx, groupID, userID, hints...)
}

func (s *LocalCacheSupplier) GroupDeleteMember(ctx context.Context, groupID string, userID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupDeleteMember(ctx, groupID, userID, hints...)
}

func (s *LocalCacheSupplier) GroupCreateGroupSyncable(ctx context.Context, groupSyncable *model.GroupSyncable, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupCreateGroupSyncable(ctx, groupSyncable, hints...)
}

func (s *LocalCacheSupplier) GroupGetGroupSyncable(ctx context.Context, groupID string, syncableID string, syncableType model.GroupSyncableType, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupGetGroupSyncable(ctx, groupID, syncableID, syncableType, hints...)
}

func (s *LocalCacheSupplier) GroupGetAllGroupSyncablesByGroupPage(ctx context.Context, groupID string, syncableType model.GroupSyncableType, offset int, limit int, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupGetAllGroupSyncablesByGroupPage(ctx, groupID, syncableType, offset, limit, hints...)
}

func (s *LocalCacheSupplier) GroupUpdateGroupSyncable(ctx context.Context, groupSyncable *model.GroupSyncable, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupUpdateGroupSyncable(ctx, groupSyncable, hints...)
}

func (s *LocalCacheSupplier) GroupDeleteGroupSyncable(ctx context.Context, groupID string, syncableID string, syncableType model.GroupSyncableType, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().GroupDeleteGroupSyncable(ctx, groupID, syncableID, syncableType, hints...)
}
