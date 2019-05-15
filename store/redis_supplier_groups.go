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

func (s *RedisSupplier) GroupGetByRemoteID(ctx context.Context, remoteID string, groupSource model.GroupSource, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetByRemoteID(ctx, remoteID, groupSource, hints...)
}

func (s *RedisSupplier) GroupGetAllBySource(ctx context.Context, groupSource model.GroupSource, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetAllBySource(ctx, groupSource, hints...)
}

func (s *RedisSupplier) GroupUpdate(ctx context.Context, group *model.Group, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupUpdate(ctx, group, hints...)
}

func (s *RedisSupplier) GroupDelete(ctx context.Context, groupID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupDelete(ctx, groupID, hints...)
}

func (s *RedisSupplier) GroupGetMemberUsers(ctx context.Context, groupID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetMemberUsers(ctx, groupID, hints...)
}

func (s *RedisSupplier) GroupGetMemberUsersPage(ctx context.Context, groupID string, offset int, limit int, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetMemberUsersPage(ctx, groupID, offset, limit, hints...)
}

func (s *RedisSupplier) GroupGetMemberCount(ctx context.Context, groupID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetMemberCount(ctx, groupID, hints...)
}

func (s *RedisSupplier) GroupCreateOrRestoreMember(ctx context.Context, groupID string, userID string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupCreateOrRestoreMember(ctx, groupID, userID, hints...)
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

func (s *RedisSupplier) GroupGetAllGroupSyncablesByGroup(ctx context.Context, groupID string, syncableType model.GroupSyncableType, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupGetAllGroupSyncablesByGroup(ctx, groupID, syncableType, hints...)
}

func (s *RedisSupplier) GroupUpdateGroupSyncable(ctx context.Context, groupSyncable *model.GroupSyncable, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupUpdateGroupSyncable(ctx, groupSyncable, hints...)
}

func (s *RedisSupplier) GroupDeleteGroupSyncable(ctx context.Context, groupID string, syncableID string, syncableType model.GroupSyncableType, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GroupDeleteGroupSyncable(ctx, groupID, syncableID, syncableType, hints...)
}

func (s *RedisSupplier) TeamMembersToAdd(ctx context.Context, since int64, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().TeamMembersToAdd(ctx, since, hints...)
}

func (s *RedisSupplier) ChannelMembersToAdd(ctx context.Context, since int64, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().ChannelMembersToAdd(ctx, since, hints...)
}

func (s *RedisSupplier) TeamMembersToRemove(ctx context.Context, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().TeamMembersToRemove(ctx, hints...)
}

func (s *RedisSupplier) ChannelMembersToRemove(ctx context.Context, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().ChannelMembersToRemove(ctx, hints...)
}

func (s *RedisSupplier) GetGroupsByChannel(ctx context.Context, channelId string, opts model.GroupSearchOpts, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GetGroupsByChannel(ctx, channelId, opts, hints...)
}

func (s *RedisSupplier) CountGroupsByChannel(ctx context.Context, channelId string, opts model.GroupSearchOpts, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().CountGroupsByChannel(ctx, channelId, opts, hints...)
}

func (s *RedisSupplier) GetGroupsByTeam(ctx context.Context, teamId string, opts model.GroupSearchOpts, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GetGroupsByTeam(ctx, teamId, opts, hints...)
}

func (s *RedisSupplier) CountGroupsByTeam(ctx context.Context, teamId string, opts model.GroupSearchOpts, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().CountGroupsByTeam(ctx, teamId, opts, hints...)
}

func (s *RedisSupplier) GetGroups(ctx context.Context, page, perPage int, opts model.GroupSearchOpts, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().GetGroups(ctx, page, perPage, opts, hints...)
}
