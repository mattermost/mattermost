// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"sync/atomic"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// UserChannel is a {userID, channelID} membership.
type UserChannel = [2]string

// MembershipChangeListener is told, on the originating node only, when channel memberships or
// their roles change.
type MembershipChangeListener interface {
	// ChannelMembershipsChanged: each membership was added, removed or re-roled. A batch write
	// reports all of its memberships in one call. The listener must not keep the slice.
	ChannelMembershipsChanged(memberships []UserChannel)
	// UserChannelMembershipsChanged: any of userID's memberships may have changed, such as on a
	// guest promotion.
	UserChannelMembershipsChanged(userID string)
	// ChannelMembersChanged: any membership in channelID may have changed.
	ChannelMembersChanged(channelID string)
	// AllChannelMembershipsChanged: a bulk change across users and channels, such as a migration.
	AllChannelMembershipsChanged()
}

type membershipListenerHolder struct {
	listener MembershipChangeListener
}

type membershipListenerSlot struct {
	p atomic.Pointer[membershipListenerHolder]
}

func (s LocalCacheStore) SetMembershipChangeListener(l MembershipChangeListener) {
	if s.membership != nil {
		s.membership.p.Store(&membershipListenerHolder{listener: l})
	}
}

func (s *LocalCacheStore) membershipListener() MembershipChangeListener {
	if s.membership == nil {
		return nil
	}
	if h := s.membership.p.Load(); h != nil {
		return h.listener
	}
	return nil
}

func (s *LocalCacheStore) notifyChannelMembershipsChanged(memberships []UserChannel) {
	if l := s.membershipListener(); l != nil && len(memberships) > 0 {
		l.ChannelMembershipsChanged(memberships)
	}
}

func (s *LocalCacheStore) notifyUserChannelMembershipsChanged(userID string) {
	if l := s.membershipListener(); l != nil {
		l.UserChannelMembershipsChanged(userID)
	}
}

func (s *LocalCacheStore) notifyChannelMembersChanged(channelID string) {
	if l := s.membershipListener(); l != nil {
		l.ChannelMembersChanged(channelID)
	}
}

func (s *LocalCacheStore) notifyAllChannelMembershipsChanged() {
	if l := s.membershipListener(); l != nil {
		l.AllChannelMembershipsChanged()
	}
}

// RemoveChannelMemberRolesLocal drops the cached roles of the given memberships on this node
// only, for a peer's membership change whose own best-effort eviction may not arrive.
func (s LocalCacheStore) RemoveChannelMemberRolesLocal(memberships []UserChannel) {
	if len(memberships) == 0 {
		return
	}
	keys := make([]string, len(memberships))
	for i, m := range memberships {
		keys[i] = channelMemberRolesKey(m[0], m[1])
	}
	if err := s.channelMemberRolesCache.RemoveMulti(keys); err != nil {
		s.logger.Warn("Error while removing cache entry", mlog.Err(err), mlog.String("cache_name", s.channelMemberRolesCache.Name()))
	}
}

// PurgeChannelMemberRolesLocal is RemoveChannelMemberRolesLocal for every membership.
func (s LocalCacheStore) PurgeChannelMemberRolesLocal() {
	if err := s.channelMemberRolesCache.Purge(); err != nil {
		s.logger.Warn("Error while purging cache", mlog.Err(err), mlog.String("cache_name", s.channelMemberRolesCache.Name()))
	}
}
