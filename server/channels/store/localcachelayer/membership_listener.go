// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import "sync/atomic"

// MembershipChangeListener is told when channel memberships, or the roles they carry, change
// through this store. It runs on the node that made the change only; the listener is
// responsible for reaching the rest of the cluster.
type MembershipChangeListener interface {
	// ChannelMembershipsChanged reports that userIDs' memberships of channelID were added,
	// removed or had their roles changed.
	ChannelMembershipsChanged(channelID string, userIDs []string)
	// AllChannelMembershipsChanged reports a change that touched memberships without saying
	// which, such as a guest promotion or a bulk delete.
	AllChannelMembershipsChanged()
}

type membershipListenerHolder struct {
	listener MembershipChangeListener
}

type membershipListenerSlot struct {
	p atomic.Pointer[membershipListenerHolder]
}

// SetMembershipChangeListener sets the listener told about membership changes.
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

func (s *LocalCacheStore) notifyAllChannelMembershipsChanged() {
	if l := s.membershipListener(); l != nil {
		l.AllChannelMembershipsChanged()
	}
}
