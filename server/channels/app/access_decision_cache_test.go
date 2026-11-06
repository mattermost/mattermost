// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type fakeAccessClock struct{ now int64 }

func (f *fakeAccessClock) get() int64 { return f.now }

func (f *fakeAccessClock) advance(d time.Duration) { f.now += int64(d) }

func newTestAccessDecisionCache(t *testing.T, size int, maxAge time.Duration) (*accessDecisionCache, *fakeAccessClock) {
	t.Helper()
	clock := &fakeAccessClock{now: time.Unix(1_700_000_000, 0).UnixNano()}
	c := newAccessDecisionCache(size, maxAge)
	c.now = clock.get
	return c, clock
}

func readLookup(t *testing.T, c *accessDecisionCache, kind accessSubjectKind, subjectID, userID, resourceID string) accessDecisionLookup {
	t.Helper()
	l, ok := c.prepare(kind, subjectID, userID, model.AccessControlPolicyTypeChannel, resourceID, model.AccessControlPolicyActionChannelReadAccess)
	require.True(t, ok)
	return l
}

// store caches a decision the way evaluateAccessCached does: a get that misses, then a put.
func storeDecision(t *testing.T, c *accessDecisionCache, l accessDecisionLookup, allowed bool) {
	t.Helper()
	_, hit := c.get(&l)
	require.False(t, hit)
	c.put(&l, allowed)
}

func cached(c *accessDecisionCache, l accessDecisionLookup) (bool, bool) {
	return c.get(&l)
}

func TestAccessDecisionCacheHitAndMiss(t *testing.T) {
	c, _ := newTestAccessDecisionCache(t, 10_000, time.Minute)
	sessionID, userID, channelID := model.NewId(), model.NewId(), model.NewId()
	l := readLookup(t, c, accessSubjectSession, sessionID, userID, channelID)

	_, hit := cached(c, l)
	require.False(t, hit)

	storeDecision(t, c, l, true)
	allowed, hit := cached(c, l)
	require.True(t, hit)
	require.True(t, allowed)

	second := readLookup(t, c, accessSubjectSession, sessionID, userID, model.NewId())
	storeDecision(t, c, second, false)
	allowed, hit = cached(c, second)
	require.True(t, hit)
	require.False(t, allowed, "denies are cached too")

	st := c.stats()
	assert.Equal(t, uint64(2), st.hits)
	assert.Equal(t, uint64(3), st.misses)
}

func TestAccessDecisionCacheKeepsKindsAndActionsApart(t *testing.T) {
	c, _ := newTestAccessDecisionCache(t, 10_000, time.Minute)
	userID, channelID := model.NewId(), model.NewId()

	// A user subject keyed by the user's ID, and a session subject whose session ID happens to
	// equal it, must not share an entry.
	userRef := readLookup(t, c, accessSubjectUser, userID, userID, channelID)
	sessionRef := readLookup(t, c, accessSubjectSession, userID, userID, channelID)
	storeDecision(t, c, userRef, true)
	_, hit := cached(c, sessionRef)
	require.False(t, hit)

	write, ok := c.prepare(accessSubjectUser, userID, userID, model.AccessControlPolicyTypeChannel, channelID, model.AccessControlPolicyActionChannelWriteAccess)
	require.True(t, ok)
	_, hit = cached(c, write)
	require.False(t, hit, "another action on the same channel is a separate decision")

	team, ok := c.prepare(accessSubjectUser, userID, userID, model.AccessControlPolicyTypeTeam, channelID, model.AccessControlPolicyActionMembership)
	require.True(t, ok)
	_, hit = cached(c, team)
	require.False(t, hit, "another resource type with the same ID is a separate decision")
}

func TestAccessDecisionCacheInvalidationScopes(t *testing.T) {
	c, _ := newTestAccessDecisionCache(t, 10_000, time.Minute)

	userA, userB := model.NewId(), model.NewId()
	sessionA1, sessionA2, sessionB := model.NewId(), model.NewId(), model.NewId()
	channel1, channel2 := model.NewId(), model.NewId()

	type entry struct {
		name string
		l    accessDecisionLookup
	}
	entries := []entry{
		{"A1/ch1", readLookup(t, c, accessSubjectSession, sessionA1, userA, channel1)},
		{"A1/ch2", readLookup(t, c, accessSubjectSession, sessionA1, userA, channel2)},
		{"A2/ch1", readLookup(t, c, accessSubjectSession, sessionA2, userA, channel1)},
		{"A user/ch1", readLookup(t, c, accessSubjectUser, userA, userA, channel1)},
		{"B/ch1", readLookup(t, c, accessSubjectSession, sessionB, userB, channel1)},
		{"B/ch2", readLookup(t, c, accessSubjectSession, sessionB, userB, channel2)},
	}

	reset := func() {
		for _, e := range entries {
			l := e.l
			if _, hit := c.get(&l); !hit {
				c.put(&l, true)
			}
		}
	}
	expectMisses := func(t *testing.T, invalidate func(), missing ...string) {
		t.Helper()
		reset()
		invalidate()
		want := map[string]bool{}
		for _, m := range missing {
			want[m] = true
		}
		for _, e := range entries {
			_, hit := cached(c, e.l)
			assert.Equal(t, !want[e.name], hit, e.name)
		}
	}

	t.Run("user", func(t *testing.T) {
		expectMisses(t, func() { c.invalidateUser(userA) }, "A1/ch1", "A1/ch2", "A2/ch1", "A user/ch1")
	})
	t.Run("session", func(t *testing.T) {
		expectMisses(t, func() { c.invalidateSession(sessionA1) }, "A1/ch1", "A1/ch2")
	})
	t.Run("resource", func(t *testing.T) {
		expectMisses(t, func() { c.invalidateResource(channel2) }, "A1/ch2", "B/ch2")
	})
	t.Run("user and resource", func(t *testing.T) {
		expectMisses(t, func() { c.invalidateUserResource(userA, channel1) }, "A1/ch1", "A2/ch1", "A user/ch1")
	})
	t.Run("global", func(t *testing.T) {
		expectMisses(t, func() { c.invalidateAll() }, "A1/ch1", "A1/ch2", "A2/ch1", "A user/ch1", "B/ch1", "B/ch2")
	})
}

func TestAccessDecisionCacheInvalidationDuringBuildIsNotStored(t *testing.T) {
	c, _ := newTestAccessDecisionCache(t, 10_000, time.Minute)
	sessionID, userID, channelID := model.NewId(), model.NewId(), model.NewId()
	l := readLookup(t, c, accessSubjectSession, sessionID, userID, channelID)

	_, hit := c.get(&l)
	require.False(t, hit)

	// The user changes while the decision is being computed.
	c.invalidateUser(userID)
	c.put(&l, true)

	_, hit = cached(c, readLookup(t, c, accessSubjectSession, sessionID, userID, channelID))
	require.False(t, hit, "a decision computed from pre-invalidation inputs must not be served")
}

func TestAccessDecisionCacheExpiry(t *testing.T) {
	c, clock := newTestAccessDecisionCache(t, 10_000, time.Minute)
	l := readLookup(t, c, accessSubjectSession, model.NewId(), model.NewId(), model.NewId())
	storeDecision(t, c, l, true)

	clock.advance(59 * time.Second)
	_, hit := cached(c, l)
	require.True(t, hit)

	clock.advance(time.Second)
	_, hit = cached(c, l)
	require.False(t, hit)
}

func TestAccessDecisionCacheSweep(t *testing.T) {
	c, clock := newTestAccessDecisionCache(t, 10_000, time.Minute)
	sessionID, userID, channelID := model.NewId(), model.NewId(), model.NewId()

	// Captured while the user had never been bumped (version 0).
	before := readLookup(t, c, accessSubjectSession, sessionID, userID, channelID)
	storeDecision(t, c, before, true)

	clock.advance(time.Second)
	c.invalidateUser(userID)
	require.Equal(t, 1, c.users.len())

	// Too recent to sweep: an entry captured before the bump could still be alive.
	require.Equal(t, 0, c.sweep())
	require.Equal(t, 1, c.users.len())

	clock.advance(time.Minute)
	require.Equal(t, 1, c.sweep())
	require.Equal(t, 0, c.users.len())

	// The version is gone again, but the old entry has expired by now, so it can't match.
	_, hit := cached(c, readLookup(t, c, accessSubjectSession, sessionID, userID, channelID))
	require.False(t, hit)
}

func TestAccessDecisionCacheLRUEviction(t *testing.T) {
	// 2 slots per shard.
	c, _ := newTestAccessDecisionCache(t, 2*accessDecisionLRUShards, time.Minute)
	userID, channelID := model.NewId(), model.NewId()

	// Find three sessions whose decisions land in the same shard.
	byShard := map[uint32][]accessDecisionLookup{}
	var same []accessDecisionLookup
	for len(same) < 3 {
		l := readLookup(t, c, accessSubjectSession, model.NewId(), userID, channelID)
		byShard[l.shard] = append(byShard[l.shard], l)
		if len(byShard[l.shard]) == 3 {
			same = byShard[l.shard]
		}
	}
	a, b, d := same[0], same[1], same[2]

	storeDecision(t, c, a, true)
	storeDecision(t, c, b, true)
	_, hit := cached(c, a) // a is now most recently used
	require.True(t, hit)

	storeDecision(t, c, d, true) // evicts b, the least recently used

	_, hit = cached(c, a)
	assert.True(t, hit)
	_, hit = cached(c, b)
	assert.False(t, hit)
	_, hit = cached(c, d)
	assert.True(t, hit)
	assert.Equal(t, uint64(1), c.stats().evictions)
	assert.Equal(t, 2, c.len())
}

func TestAccessDecisionCacheOverwriteKeepsOneSlot(t *testing.T) {
	c, _ := newTestAccessDecisionCache(t, 10_000, time.Minute)
	sessionID, userID, channelID := model.NewId(), model.NewId(), model.NewId()
	l := readLookup(t, c, accessSubjectSession, sessionID, userID, channelID)
	storeDecision(t, c, l, true)

	c.invalidateSession(sessionID)
	l = readLookup(t, c, accessSubjectSession, sessionID, userID, channelID)
	storeDecision(t, c, l, false)

	allowed, hit := cached(c, l)
	require.True(t, hit)
	require.False(t, allowed)
	require.Equal(t, 1, c.len())
}

func TestAccessDecisionCachePrepare(t *testing.T) {
	c, _ := newTestAccessDecisionCache(t, 10_000, time.Minute)
	id := model.NewId()

	_, ok := c.prepare(accessSubjectSession, "short", id, model.AccessControlPolicyTypeChannel, id, model.AccessControlPolicyActionChannelReadAccess)
	require.False(t, ok)
	_, ok = c.prepare(accessSubjectSession, id, id, model.AccessControlPolicyTypeChannel, "", model.AccessControlPolicyActionChannelReadAccess)
	require.False(t, ok)

	// Plugin pairs are interned until the cap, then bypass the cache.
	for i := c.ops.count; i < accessDecisionMaxOps; i++ {
		_, ok = c.prepare(accessSubjectUser, id, id, "plugin:thing", id, fmt.Sprintf("action_%d", i))
		require.True(t, ok)
	}
	_, ok = c.prepare(accessSubjectUser, id, id, "plugin:thing", id, "one_more")
	require.False(t, ok)

	// Pairs interned before the cap keep working.
	_, ok = c.prepare(accessSubjectUser, id, id, "plugin:thing", id, "action_100")
	require.True(t, ok)
	_, ok = c.prepare(accessSubjectUser, id, id, model.AccessControlPolicyTypeChannel, id, model.AccessControlPolicyActionChannelReadAccess)
	require.True(t, ok)
}
