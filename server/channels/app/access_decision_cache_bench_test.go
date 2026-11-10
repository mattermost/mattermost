// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

type benchAccessIDs struct {
	sessions, users, channels []string
}

func newBenchAccessIDs(sessions, channels int) benchAccessIDs {
	ids := benchAccessIDs{}
	for range sessions {
		ids.sessions = append(ids.sessions, model.NewId())
		ids.users = append(ids.users, model.NewId())
	}
	for range channels {
		ids.channels = append(ids.channels, model.NewId())
	}
	return ids
}

func fillBenchAccessCache(b *testing.B, c *accessDecisionCache, ids benchAccessIDs) {
	b.Helper()
	for i, sessionID := range ids.sessions {
		for _, channelID := range ids.channels {
			l, ok := c.prepare(accessSubjectSession, sessionID, ids.users[i], model.AccessControlPolicyTypeChannel, channelID, model.AccessControlPolicyActionChannelReadAccess)
			if !ok {
				b.Fatal("not cacheable")
			}
			c.get(&l)
			c.put(&l, true, 0, true)
		}
	}
}

func BenchmarkAccessDecisionCacheHit(b *testing.B) {
	c := newAccessDecisionCache(1_000_000, time.Minute)
	ids := newBenchAccessIDs(1000, 20)
	fillBenchAccessCache(b, c, ids)

	b.ReportAllocs()
	b.ResetTimer()
	i := 0
	for b.Loop() {
		s := i % len(ids.sessions)
		ch := ids.channels[i%len(ids.channels)]
		l, _ := c.prepare(accessSubjectSession, ids.sessions[s], ids.users[s], model.AccessControlPolicyTypeChannel, ch, model.AccessControlPolicyActionChannelReadAccess)
		if _, hit := c.get(&l); !hit {
			b.Fatal("expected a hit")
		}
		i++
	}
}

func BenchmarkAccessDecisionCacheHitParallel(b *testing.B) {
	c := newAccessDecisionCache(1_000_000, time.Minute)
	ids := newBenchAccessIDs(1000, 20)
	fillBenchAccessCache(b, c, ids)

	b.ReportAllocs()
	b.SetParallelism(16)
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			s := i % len(ids.sessions)
			ch := ids.channels[i%len(ids.channels)]
			l, _ := c.prepare(accessSubjectSession, ids.sessions[s], ids.users[s], model.AccessControlPolicyTypeChannel, ch, model.AccessControlPolicyActionChannelReadAccess)
			if _, hit := c.get(&l); !hit {
				b.Fatal("expected a hit")
			}
			i++
		}
	})
}

// BenchmarkAccessDecisionCacheMiss measures a miss followed by a put into a full cache, which
// evicts on every insert.
func BenchmarkAccessDecisionCacheMiss(b *testing.B) {
	c := newAccessDecisionCache(10_000, time.Minute)
	ids := newBenchAccessIDs(2000, 20)
	fillBenchAccessCache(b, c, ids)

	b.ReportAllocs()
	b.ResetTimer()
	i := 0
	for b.Loop() {
		s := i % len(ids.sessions)
		ch := ids.channels[(i/len(ids.sessions))%len(ids.channels)]
		l, _ := c.prepare(accessSubjectSession, ids.sessions[s], ids.users[s], model.AccessControlPolicyTypeChannel, ch, model.AccessControlPolicyActionChannelReadAccess)
		c.get(&l)
		c.put(&l, true, 0, true)
		i++
	}
}

func BenchmarkAccessDecisionCacheInvalidateUser(b *testing.B) {
	c := newAccessDecisionCache(10_000, time.Minute)
	ids := newBenchAccessIDs(1000, 1)

	b.ReportAllocs()
	b.ResetTimer()
	i := 0
	for b.Loop() {
		c.invalidateUser(ids.users[i%len(ids.users)])
		i++
	}
}
