// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type LocalCacheChannelStore struct {
	store.ChannelStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheChannelStore) handleClusterInvalidateChannelMemberCounts(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.channelMemberCountsCache.Purge()
	} else {
		s.rootStore.channelMemberCountsCache.Remove(msg.Data)
	}
}

func (s *LocalCacheChannelStore) handleClusterInvalidateChannelPinnedPostCount(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.channelPinnedPostCountsCache.Purge()
	} else {
		s.rootStore.channelPinnedPostCountsCache.Remove(msg.Data)
	}
}

func (s *LocalCacheChannelStore) handleClusterInvalidateChannelGuestCounts(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.channelGuestCountCache.Purge()
	} else {
		s.rootStore.channelGuestCountCache.Remove(msg.Data)
	}
}

func (s *LocalCacheChannelStore) handleClusterInvalidateChannelById(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.channelByIdCache.Purge()
	} else {
		s.rootStore.channelByIdCache.Remove(msg.Data)
	}
}

func (s *LocalCacheChannelStore) handleClusterInvalidateChannelMembersForUser(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.channelMembersForUserCache.Purge()
		return
	}

	// Remove keys with prefix msg.Data
	s.rootStore.channelMembersForUserCache.RemoveByPrefix(msg.Data)
}

func (s LocalCacheChannelStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.channelMemberCountsCache)
	s.rootStore.doClearCacheCluster(s.rootStore.channelPinnedPostCountsCache)
	s.rootStore.doClearCacheCluster(s.rootStore.channelGuestCountCache)
	s.rootStore.doClearCacheCluster(s.rootStore.channelByIdCache)
	s.rootStore.doClearCacheCluster(s.rootStore.channelMembersForUserCache)
	s.ChannelStore.ClearCaches()
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Pinned Post Counts - Purge")
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Purge")
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Guest Count - Purge")
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel - Purge")
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Members For User - Purge")
	}
}

func (s LocalCacheChannelStore) InvalidatePinnedPostCount(channelId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelPinnedPostCountsCache, channelId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Pinned Post Counts - Remove by ChannelId")
	}
}

func (s LocalCacheChannelStore) InvalidateMemberCount(channelId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelMemberCountsCache, channelId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Remove by ChannelId")
	}
}

// invalidateMembersForUser removes all keys from channelMembersForUserCache
// with the prefix of the given userID.
// We cannot simply call doInvalidateCacheCluster because we need to remove
// keys with a prefix rather than remove a single key.
func (s LocalCacheChannelStore) invalidateMembersForUser(userId string) {
	s.rootStore.channelMembersForUserCache.RemoveByPrefix(userId)
	if s.rootStore.cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_FOR_USER,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     userId,
		}
		s.rootStore.cluster.SendClusterMessage(msg)
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Members For User - Remove by UserId")
	}
}

// invalidateMembersForAllUsers purges the entire channelMembersForUserCache cache.
func (s LocalCacheChannelStore) invalidateMembersForAllUsers() {
	s.rootStore.channelMembersForUserCache.Purge()

	if s.rootStore.cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_FOR_USER,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     CLEAR_CACHE_MESSAGE_DATA,
		}
		s.rootStore.cluster.SendClusterMessage(msg)
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Members For User - Purge")
	}
}

func (s LocalCacheChannelStore) InvalidateGuestCount(channelId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelGuestCountCache, channelId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Guests Count - Remove by channelId")
	}
}

func (s LocalCacheChannelStore) InvalidateChannel(channelId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelByIdCache, channelId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel - Remove by ChannelId")
	}
}

func (s LocalCacheChannelStore) GetMemberCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
	if allowFromCache {
		if count := s.rootStore.doStandardReadCache(s.rootStore.channelMemberCountsCache, channelId); count != nil {
			return count.(int64), nil
		}
	}
	count, err := s.ChannelStore.GetMemberCount(channelId, allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.channelMemberCountsCache, channelId, count)
	}

	return count, err
}

func (s LocalCacheChannelStore) GetGuestCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
	if allowFromCache {
		if count := s.rootStore.doStandardReadCache(s.rootStore.channelGuestCountCache, channelId); count != nil {
			return count.(int64), nil
		}
	}
	count, err := s.ChannelStore.GetGuestCount(channelId, allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.channelGuestCountCache, channelId, count)
	}

	return count, err
}

func (s LocalCacheChannelStore) GetMemberCountFromCache(channelId string) int64 {
	if count := s.rootStore.doStandardReadCache(s.rootStore.channelMemberCountsCache, channelId); count != nil {
		return count.(int64)
	}

	count, err := s.GetMemberCount(channelId, true)
	if err != nil {
		return 0
	}

	return count
}

func (s LocalCacheChannelStore) GetPinnedPostCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
	if allowFromCache {
		if count := s.rootStore.doStandardReadCache(s.rootStore.channelPinnedPostCountsCache, channelId); count != nil {
			return count.(int64), nil
		}
	}

	count, err := s.ChannelStore.GetPinnedPostCount(channelId, allowFromCache)

	if err != nil {
		return 0, err
	}

	if allowFromCache {
		s.rootStore.doStandardAddToCache(s.rootStore.channelPinnedPostCountsCache, channelId, count)
	}

	return count, nil
}

// SaveMember is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) SaveMember(member *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	defer s.invalidateMembersForUser(member.UserId)
	return s.ChannelStore.SaveMember(member)
}

// UpdateMember is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) UpdateMember(member *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	defer s.invalidateMembersForUser(member.UserId)
	return s.ChannelStore.UpdateMember(member)
}

// RemoveMember is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) RemoveMember(channelId, userId string) *model.AppError {
	defer s.invalidateMembersForUser(userId)
	return s.ChannelStore.RemoveMember(channelId, userId)
}

// UpdateLastViewedAt is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) UpdateLastViewedAt(channelIds []string, userId string) (map[string]int64, *model.AppError) {
	defer s.invalidateMembersForUser(userId)
	return s.ChannelStore.UpdateLastViewedAt(channelIds, userId)
}

// UpdateLastViewedAtPost is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) UpdateLastViewedAtPost(unreadPost *model.Post, userID string, mentionCount int) (*model.ChannelUnreadAt, *model.AppError) {
	defer s.invalidateMembersForUser(userID)
	return s.ChannelStore.UpdateLastViewedAtPost(unreadPost, userID, mentionCount)
}

// PermanentDeleteMembersByChannel is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) PermanentDeleteMembersByChannel(channelId string) *model.AppError {
	defer s.invalidateMembersForAllUsers()
	return s.ChannelStore.PermanentDeleteMembersByChannel(channelId)
}

// PermanentDeleteMembersByUser is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) PermanentDeleteMembersByUser(userId string) *model.AppError {
	defer s.invalidateMembersForUser(userId)
	return s.ChannelStore.PermanentDeleteMembersByUser(userId)
}

// RemoveAllDeactivatedMembers is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) RemoveAllDeactivatedMembers(channelId string) *model.AppError {
	defer s.invalidateMembersForAllUsers()
	return s.ChannelStore.RemoveAllDeactivatedMembers(channelId)
}

// ClearAllCustomRoleAssignments is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) ClearAllCustomRoleAssignments() *model.AppError {
	defer s.invalidateMembersForAllUsers()
	return s.ChannelStore.ClearAllCustomRoleAssignments()
}

// IncrementMentionCount is a wrapper method for the underlying store which just takes
// care of the cache invalidation.
func (s LocalCacheChannelStore) IncrementMentionCount(channelId, userId string) *model.AppError {
	defer s.invalidateMembersForUser(userId)
	return s.ChannelStore.IncrementMentionCount(channelId, userId)
}

// GetMembersForUser is a cache wrapper method for ChannelStore.
func (s LocalCacheChannelStore) GetMembersForUser(teamId, userId string) (*model.ChannelMembers, *model.AppError) {
	key := userId + "-" + teamId
	if members := s.rootStore.doStandardReadCache(s.rootStore.channelMembersForUserCache, key); members != nil {
		return members.(*model.ChannelMembers), nil
	}

	members, err := s.ChannelStore.GetMembersForUser(teamId, userId)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.channelMembersForUserCache, key, members)
	return members, nil
}

func (s LocalCacheChannelStore) Get(id string, allowFromCache bool) (*model.Channel, *model.AppError) {

	if allowFromCache {
		if cacheItem := s.rootStore.doStandardReadCache(s.rootStore.channelByIdCache, id); cacheItem != nil {
			ch := cacheItem.(*model.Channel).DeepCopy()
			return ch, nil
		}
	}

	ch, err := s.ChannelStore.Get(id, allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.channelByIdCache, id, ch)
	}

	return ch, err
}
