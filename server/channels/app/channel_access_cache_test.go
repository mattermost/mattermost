// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func TestChannelAccessDecisionCacheType(t *testing.T) {
	userID, otherUserID := model.NewId(), model.NewId()
	sessionID := model.NewId()
	channelID := model.NewId()
	action := model.AccessControlPolicyActionChannelReadAccess

	sessionKey := channelAccessDecisionKey{subject: "s:" + sessionID, channelID: channelID, action: action}
	otherKey := channelAccessDecisionKey{subject: "u:" + otherUserID, channelID: channelID, action: action}

	newCache := func() (*channelAccessDecisionCache, *time.Time) {
		c := newChannelAccessDecisionCache(10)
		now := time.Now()
		c.now = func() time.Time { return now }
		return c, &now
	}
	store := func(c *channelAccessDecisionCache, key channelAccessDecisionKey, user, session string, seq uint64) {
		c.set(key, channelAccessDecision{
			allowed:   true,
			userID:    user,
			sessionID: session,
			seq:       seq,
			expiresAt: c.now().Add(channelAccessDecisionMaxTTL),
		})
	}
	cached := func(c *channelAccessDecisionCache, key channelAccessDecisionKey) bool {
		_, ok := c.get(key)
		return ok
	}

	t.Run("serves a stored decision until it expires", func(t *testing.T) {
		c, now := newCache()
		store(c, sessionKey, userID, sessionID, c.snapshot())

		allowed, ok := c.get(sessionKey)
		require.True(t, ok)
		require.True(t, allowed)

		*now = now.Add(channelAccessDecisionMaxTTL)
		require.False(t, cached(c, sessionKey))
	})

	t.Run("invalidateAll drops every decision made before it", func(t *testing.T) {
		c, _ := newCache()
		store(c, sessionKey, userID, sessionID, c.snapshot())
		store(c, otherKey, otherUserID, "", c.snapshot())

		c.invalidateAll()
		require.False(t, cached(c, sessionKey))
		require.False(t, cached(c, otherKey))

		store(c, sessionKey, userID, sessionID, c.snapshot())
		require.True(t, cached(c, sessionKey), "a decision made after the invalidation is served")
	})

	t.Run("invalidateUser drops only that user's decisions", func(t *testing.T) {
		c, _ := newCache()
		store(c, sessionKey, userID, sessionID, c.snapshot())
		store(c, otherKey, otherUserID, "", c.snapshot())

		c.invalidateUser(userID)
		require.False(t, cached(c, sessionKey))
		require.True(t, cached(c, otherKey))
	})

	t.Run("invalidateSession drops only that session's decisions", func(t *testing.T) {
		c, _ := newCache()
		store(c, sessionKey, userID, sessionID, c.snapshot())
		store(c, otherKey, otherUserID, "", c.snapshot())

		c.invalidateSession(sessionID)
		require.False(t, cached(c, sessionKey))
		require.True(t, cached(c, otherKey))
	})

	t.Run("an invalidation during an evaluation discards its result", func(t *testing.T) {
		for name, invalidate := range map[string]func(*channelAccessDecisionCache){
			"all":     func(c *channelAccessDecisionCache) { c.invalidateAll() },
			"user":    func(c *channelAccessDecisionCache) { c.invalidateUser(userID) },
			"session": func(c *channelAccessDecisionCache) { c.invalidateSession(sessionID) },
		} {
			t.Run(name, func(t *testing.T) {
				c, _ := newCache()
				seq := c.snapshot() // the evaluation starts
				invalidate(c)       // a change lands while it runs
				store(c, sessionKey, userID, sessionID, seq)
				require.False(t, cached(c, sessionKey))
			})
		}
	})

	t.Run("sweeping marks never revives a decision", func(t *testing.T) {
		c, now := newCache()
		store(c, sessionKey, userID, sessionID, c.snapshot())
		c.invalidateUser(userID)
		require.False(t, cached(c, sessionKey))

		// A full TTL later the mark is swept, and the decision it invalidated has expired.
		*now = now.Add(channelAccessDecisionMaxTTL + time.Second)
		c.invalidateUser(otherUserID)
		c.mut.RLock()
		_, kept := c.users[userID]
		c.mut.RUnlock()
		require.False(t, kept, "the old mark should be swept")
		require.False(t, cached(c, sessionKey))
	})
}

func TestChannelAccessDecisionKeyFor(t *testing.T) {
	userID, otherUserID := model.NewId(), model.NewId()
	channelID := model.NewId()
	action := model.AccessControlPolicyActionChannelReadAccess
	session := &model.Session{Id: model.NewId(), UserId: userID}
	rctx := request.TestContext(t).WithSession(session)

	t.Run("the session's own user keys on the session", func(t *testing.T) {
		key, sessionID, ok := channelAccessDecisionKeyFor(rctx, userID, channelID, action)
		require.True(t, ok)
		require.Equal(t, session.Id, sessionID)
		require.Equal(t, "s:"+session.Id, key.subject)
	})

	t.Run("another user keys on the user", func(t *testing.T) {
		key, sessionID, ok := channelAccessDecisionKeyFor(rctx, otherUserID, channelID, action)
		require.True(t, ok)
		require.Empty(t, sessionID)
		require.Equal(t, "u:"+otherUserID, key.subject)
	})

	t.Run("a session with no ID for the same user isn't cached", func(t *testing.T) {
		bare := request.TestContext(t).WithSession(&model.Session{UserId: userID})
		_, _, ok := channelAccessDecisionKeyFor(bare, userID, channelID, action)
		require.False(t, ok)
	})
}
