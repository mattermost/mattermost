// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	// channelAccessDecisionCacheSize bounds the cache at about 20 MB.
	channelAccessDecisionCacheSize = 200_000

	// channelAccessDecisionMaxTTL caps how long a decision lives without an invalidation. Some
	// inputs change with no event to invalidate on (user.createat.youngerThanDays flips with
	// time alone), so this is also the longest such a decision can be stale.
	channelAccessDecisionMaxTTL = 60 * time.Second

	channelAccessDecisionCacheName = "ChannelAccessDecision"

	clusterEventInvalidateChannelAccessDecisions = model.ClusterEvent("inv_channel_access_decisions")

	channelAccessInvalidationScopeAll  = "all"
	channelAccessInvalidationScopeUser = "user"
)

// channelAccessDecisionKey identifies one evaluation. subject is "s:"+sessionID when the user
// evaluated is the session's own user, whose subject carries the session's roles and
// attributes, and "u:"+userID when it is someone else, whose subject comes from the user record.
type channelAccessDecisionKey struct {
	subject   string
	channelID string
	action    string
}

type channelAccessDecision struct {
	allowed   bool
	userID    string
	sessionID string
	// seq is the invalidation sequence read before the evaluation started; see
	// channelAccessDecisionCache.
	seq       uint64
	expiresAt time.Time
}

type channelAccessInvalidation struct {
	seq uint64
	at  time.Time
}

// channelAccessDecisionCache memoises channel-access decisions across requests and websocket
// deliveries. It is consulted once a channel is known to be governed, so what it stores is the
// outcome of building the subject and evaluating it.
//
// Invalidation never walks the LRU. Every invalidation takes the next value of seq and records it
// as a mark: for everything, for one user, or for one session. A decision records the value of
// seq read before its evaluation started, and is valid only while that value is at least every
// mark that applies to it. An invalidation that lands during an evaluation therefore takes a seq
// above the one the evaluation recorded, and its result is never served.
//
// A mark only has to outlive the decisions it can invalidate, and none lives past
// channelAccessDecisionMaxTTL, so marks older than that are swept.
type channelAccessDecisionCache struct {
	decisions *lru.Cache[channelAccessDecisionKey, channelAccessDecision]

	seq    atomic.Uint64
	global atomic.Uint64

	mut       sync.RWMutex
	users     map[string]channelAccessInvalidation
	sessions  map[string]channelAccessInvalidation
	lastSweep time.Time

	now func() time.Time
}

func newChannelAccessDecisionCache(size int) *channelAccessDecisionCache {
	decisions, err := lru.New[channelAccessDecisionKey, channelAccessDecision](size)
	if err != nil {
		// lru.New fails only for a non-positive size.
		panic(err)
	}
	return &channelAccessDecisionCache{
		decisions: decisions,
		users:     map[string]channelAccessInvalidation{},
		sessions:  map[string]channelAccessInvalidation{},
		now:       time.Now,
	}
}

// snapshot returns the sequence to record on a decision whose evaluation starts now.
func (c *channelAccessDecisionCache) snapshot() uint64 {
	return c.seq.Load()
}

func (c *channelAccessDecisionCache) get(key channelAccessDecisionKey) (allowed, ok bool) {
	decision, ok := c.decisions.Get(key)
	if !ok || !c.now().Before(decision.expiresAt) || decision.seq < c.global.Load() {
		return false, false
	}

	c.mut.RLock()
	userMark := c.users[decision.userID]
	sessionMark := c.sessions[decision.sessionID]
	c.mut.RUnlock()
	if decision.seq < userMark.seq || (decision.sessionID != "" && decision.seq < sessionMark.seq) {
		return false, false
	}

	return decision.allowed, true
}

func (c *channelAccessDecisionCache) set(key channelAccessDecisionKey, decision channelAccessDecision) {
	c.decisions.Add(key, decision)
}

func (c *channelAccessDecisionCache) invalidateAll() {
	next := c.seq.Add(1)
	for {
		current := c.global.Load()
		if next <= current || c.global.CompareAndSwap(current, next) {
			return
		}
	}
}

func (c *channelAccessDecisionCache) invalidateUser(userID string) {
	c.mark(c.users, userID)
}

func (c *channelAccessDecisionCache) invalidateSession(sessionID string) {
	c.mark(c.sessions, sessionID)
}

func (c *channelAccessDecisionCache) mark(marks map[string]channelAccessInvalidation, id string) {
	if id == "" {
		return
	}

	c.mut.Lock()
	defer c.mut.Unlock()

	// Taking seq under the lock keeps each id's mark monotonic.
	now := c.now()
	marks[id] = channelAccessInvalidation{seq: c.seq.Add(1), at: now}
	c.sweepLocked(now)
}

// sweepLocked drops marks no live decision can be checked against, at most once per
// channelAccessDecisionMaxTTL. A decision older than a mark was evaluated before the mark was
// made, so once the mark is a full TTL old every such decision has expired. Must be called with
// mut held for writing.
func (c *channelAccessDecisionCache) sweepLocked(now time.Time) {
	if now.Sub(c.lastSweep) < channelAccessDecisionMaxTTL {
		return
	}
	c.lastSweep = now

	cutoff := now.Add(-channelAccessDecisionMaxTTL)
	for _, marks := range []map[string]channelAccessInvalidation{c.users, c.sessions} {
		for id, mark := range marks {
			if mark.at.Before(cutoff) {
				delete(marks, id)
			}
		}
	}
}

// channelAccessDecisionKeyFor returns the cache key for evaluating userID in rctx, and the
// session the decision depends on. ok is false when the subject can't be keyed: a session whose
// user is userID but which has no ID still builds the subject from its own roles, which no key
// distinguishes from the user's.
func channelAccessDecisionKeyFor(rctx request.CTX, userID, channelID, action string) (key channelAccessDecisionKey, sessionID string, ok bool) {
	session := rctx.Session()
	if session.UserId == userID {
		if session.Id == "" {
			return channelAccessDecisionKey{}, "", false
		}
		return channelAccessDecisionKey{subject: "s:" + session.Id, channelID: channelID, action: action}, session.Id, true
	}
	return channelAccessDecisionKey{subject: "u:" + userID, channelID: channelID, action: action}, "", true
}

// cachedChannelAccessDecision returns a cached decision for evaluating userID in channelID.
func (a *App) cachedChannelAccessDecision(key channelAccessDecisionKey) (allowed, ok bool) {
	allowed, ok = a.Srv().Channels().channelAccessDecisions.get(key)
	if m := a.Metrics(); m != nil {
		if ok {
			m.IncrementMemCacheHitCounter(channelAccessDecisionCacheName)
		} else {
			m.IncrementMemCacheMissCounter(channelAccessDecisionCacheName)
		}
	}
	return allowed, ok
}

// cacheChannelAccessDecision stores a decision evaluated from seq. It expires at the earliest of
// channelAccessDecisionMaxTTL and the first expiry among the session attributes the evaluation
// read, since an expired attribute drops out of the subject with no event to invalidate on.
func (a *App) cacheChannelAccessDecision(rctx request.CTX, key channelAccessDecisionKey, userID, sessionID string, seq uint64, allowed bool) {
	cache := a.Srv().Channels().channelAccessDecisions

	expiresAt := cache.now().Add(channelAccessDecisionMaxTTL)
	if sessionID != "" {
		if attributesExpireAt, appErr := a.sessionAttributesExpireAt(rctx, sessionID); appErr != nil {
			// Without the expiry the decision could outlive an attribute it relied on.
			rctx.Logger().Debug("Failed to read session attribute expiry; not caching the channel-access decision",
				mlog.String("session_id", sessionID),
				mlog.Err(appErr),
			)
			return
		} else if !attributesExpireAt.IsZero() && attributesExpireAt.Before(expiresAt) {
			expiresAt = attributesExpireAt
		}
	}

	cache.set(key, channelAccessDecision{
		allowed:   allowed,
		userID:    userID,
		sessionID: sessionID,
		seq:       seq,
		expiresAt: expiresAt,
	})
}

// invalidateChannelAccessDecisions drops every cached decision on every node. It is for changes
// that can alter any decision: policies, attribute fields and options, channel attributes.
func (a *App) invalidateChannelAccessDecisions() {
	a.Srv().Channels().invalidateChannelAccessDecisionsLocal()
	a.Srv().Channels().broadcastChannelAccessDecisionInvalidation(channelAccessInvalidationScopeAll, "")
}

// invalidateChannelAccessDecisionsForUser drops userID's cached decisions on every node.
func (a *App) invalidateChannelAccessDecisionsForUser(userID string) {
	a.Srv().Channels().invalidateChannelAccessDecisionsForUserLocal(userID)
	a.Srv().Channels().broadcastChannelAccessDecisionInvalidation(channelAccessInvalidationScopeUser, userID)
}

func (ch *Channels) invalidateChannelAccessDecisionsLocal() {
	ch.channelAccessDecisions.invalidateAll()
	ch.countChannelAccessDecisionInvalidation()
}

func (ch *Channels) invalidateChannelAccessDecisionsForUserLocal(userID string) {
	ch.channelAccessDecisions.invalidateUser(userID)
	ch.countChannelAccessDecisionInvalidation()
}

func (ch *Channels) invalidateChannelAccessDecisionsForSessionLocal(sessionID string) {
	ch.channelAccessDecisions.invalidateSession(sessionID)
	ch.countChannelAccessDecisionInvalidation()
}

func (ch *Channels) countChannelAccessDecisionInvalidation() {
	if m := ch.srv.GetMetrics(); m != nil {
		m.IncrementMemCacheInvalidationCounter(channelAccessDecisionCacheName)
	}
}

type channelAccessInvalidationMessage struct {
	Scope string `json:"scope"`
	ID    string `json:"id,omitempty"`
}

func (ch *Channels) broadcastChannelAccessDecisionInvalidation(scope, id string) {
	cluster := ch.srv.platform.Cluster()
	if cluster == nil {
		return
	}

	data, err := json.Marshal(channelAccessInvalidationMessage{Scope: scope, ID: id})
	if err != nil {
		ch.srv.Log().Warn("Failed to encode channel-access decision invalidation", mlog.Err(err))
		return
	}

	// Reliable: a lost message leaves another node serving a decision the change revoked until
	// it expires.
	cluster.SendClusterMessage(&model.ClusterMessage{
		Event:    clusterEventInvalidateChannelAccessDecisions,
		SendType: model.ClusterSendReliable,
		Data:     data,
	})
}

func (ch *Channels) clusterInvalidateChannelAccessDecisionsHandler(msg *model.ClusterMessage) {
	var payload channelAccessInvalidationMessage
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		// Without the scope the safe reading is everything.
		ch.srv.Log().Warn("Failed to decode channel-access decision invalidation; dropping every decision", mlog.Err(err))
		ch.invalidateChannelAccessDecisionsLocal()
		return
	}

	switch payload.Scope {
	case channelAccessInvalidationScopeUser:
		ch.invalidateChannelAccessDecisionsForUserLocal(payload.ID)
	default:
		ch.invalidateChannelAccessDecisionsLocal()
	}
}
