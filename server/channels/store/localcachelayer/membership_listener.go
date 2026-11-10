// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import "sync/atomic"

// MembershipChangeListener is told, on the originating node only, when channel memberships or
// their roles change.
type MembershipChangeListener interface {
	// ChannelMembershipsChanged: userIDs were added to, removed from or re-roled in channelID.
	ChannelMembershipsChanged(channelID string, userIDs []string)
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

func (s *LocalCacheStore) notifyChannelMembershipsChanged(channelID string, userIDs []string) {
	if l := s.membershipListener(); l != nil && len(userIDs) > 0 {
		l.ChannelMembershipsChanged(channelID, userIDs)
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
