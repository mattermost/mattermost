// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"container/list"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	accessControlRecipientCacheSize = 1000
	accessControlRecipientCacheTTL  = 60 * time.Second
	accessControlRecipientPageSize  = 1000
	accessControlRecipientCacheName = "access_control_recipients"
)

// accessControlRecipientEntry is one cached answer for a prop value.
//
//   - noPolicy: the resource has no policy, so everyone may receive it.
//   - failed: the fill could not run (engine unavailable or the query
//     errored); delivery evaluates per user until the entry expires.
//   - otherwise allow holds the user IDs the policy admits.
type accessControlRecipientEntry struct {
	allow    map[string]struct{}
	noPolicy bool
	failed   bool
	expires  time.Time
}

// accessControlRecipientCache is a per-node LRU of prop value -> recipient
// entry. It holds native maps so a membership test in the websocket send loop
// is a map lookup, not a deserialization, which is why it does not sit on the
// platform cache layer.
type accessControlRecipientCache struct {
	mu    sync.Mutex
	size  int
	ttl   time.Duration
	items map[string]*list.Element
	order *list.List
	fills singleflight.Group
	now   func() time.Time
}

type accessControlRecipientItem struct {
	key   string
	entry accessControlRecipientEntry
}

func newAccessControlRecipientCache(size int, ttl time.Duration) *accessControlRecipientCache {
	return &accessControlRecipientCache{
		size:  size,
		ttl:   ttl,
		items: make(map[string]*list.Element, size),
		order: list.New(),
		now:   time.Now,
	}
}

// lookup returns the live entry for key, if any.
func (c *accessControlRecipientCache) lookup(key string) (accessControlRecipientEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	element, ok := c.items[key]
	if !ok {
		return accessControlRecipientEntry{}, false
	}
	item := element.Value.(*accessControlRecipientItem)
	if c.now().After(item.entry.expires) {
		c.order.Remove(element)
		delete(c.items, key)
		return accessControlRecipientEntry{}, false
	}
	c.order.MoveToFront(element)
	return item.entry, true
}

func (c *accessControlRecipientCache) store(key string, entry accessControlRecipientEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry.expires = c.now().Add(c.ttl)
	if element, ok := c.items[key]; ok {
		element.Value.(*accessControlRecipientItem).entry = entry
		c.order.MoveToFront(element)
		return
	}
	c.items[key] = c.order.PushFront(&accessControlRecipientItem{key: key, entry: entry})
	for c.order.Len() > c.size {
		oldest := c.order.Back()
		c.order.Remove(oldest)
		delete(c.items, oldest.Value.(*accessControlRecipientItem).key)
	}
}

// invalidate drops every entry whose prop value names resourceID, whatever
// the action, and returns how many were dropped.
func (c *accessControlRecipientCache) invalidate(resourceID string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	dropped := 0
	for key, element := range c.items {
		parsed, err := model.ParsePostAccessControlResource(key)
		if err != nil || parsed.ResourceID != resourceID {
			continue
		}
		c.order.Remove(element)
		delete(c.items, key)
		dropped++
	}
	return dropped
}

func (c *accessControlRecipientCache) len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.order.Len()
}

// accessControlRecipientEntryFor returns the cached entry for value, filling
// it on a miss. Concurrent misses for one value share a single fill.
func (a *App) accessControlRecipientEntryFor(rctx request.CTX, value string) accessControlRecipientEntry {
	c := a.ch.accessControlRecipients
	if c == nil {
		return a.fillAccessControlRecipients(rctx, value)
	}
	if entry, hit := c.lookup(value); hit {
		if a.Metrics() != nil {
			a.Metrics().IncrementMemCacheHitCounter(accessControlRecipientCacheName)
		}
		return entry
	}
	if a.Metrics() != nil {
		a.Metrics().IncrementMemCacheMissCounter(accessControlRecipientCacheName)
	}

	result, _, _ := c.fills.Do(value, func() (any, error) {
		entry := a.fillAccessControlRecipients(rctx, value)
		c.store(value, entry)
		return entry, nil
	})
	return result.(accessControlRecipientEntry)
}

// fillAccessControlRecipients computes the entry for value: a no-policy
// marker when the store has no row for the resource, the paged result of
// QueryUsersForResource when it does, or a negative entry when the engine is
// unavailable or the query fails.
func (a *App) fillAccessControlRecipients(rctx request.CTX, value string) accessControlRecipientEntry {
	start := time.Now()
	failed := func(reason string, err error) accessControlRecipientEntry {
		if a.Metrics() != nil {
			a.Metrics().ObserveAccessControlRecipientFill("failed", time.Since(start).Seconds(), 0)
		}
		rctx.Logger().Debug("Access control recipient fill failed; delivery falls back to per-user evaluation",
			mlog.String("resource", value), mlog.String("reason", reason), mlog.Err(err))
		return accessControlRecipientEntry{failed: true}
	}

	parsed, err := model.ParsePostAccessControlResource(value)
	if err != nil {
		return failed("malformed", err)
	}

	policy, storeErr := a.Srv().Store().AccessControlPolicy().Get(rctx, parsed.ResourceID)
	if storeErr != nil {
		if _, notFound := errors.AsType[*store.ErrNotFound](storeErr); notFound {
			if a.Metrics() != nil {
				a.Metrics().ObserveAccessControlRecipientFill("no_policy", time.Since(start).Seconds(), 0)
			}
			return accessControlRecipientEntry{noPolicy: true}
		}
		return failed("store", storeErr)
	}
	if policy.Type != parsed.PolicyType {
		// A foreign type squatting on the ID is no_policy for this plugin, in
		// line with the evaluation lane.
		if a.Metrics() != nil {
			a.Metrics().ObserveAccessControlRecipientFill("no_policy", time.Since(start).Seconds(), 0)
		}
		return accessControlRecipientEntry{noPolicy: true}
	}

	acs := a.Srv().ch.AccessControl
	if acs == nil || !a.pluginAccessControlAvailable() {
		return failed("abac_unavailable", nil)
	}

	allow := map[string]struct{}{}
	cursor := model.SubjectCursor{}
	for {
		users, _, appErr := acs.QueryUsersForResource(rctx, parsed.ResourceID, parsed.Action, model.SubjectSearchOptions{
			Limit:       accessControlRecipientPageSize,
			Cursor:      cursor,
			IgnoreCount: true,
		})
		if appErr != nil {
			return failed("query", appErr)
		}
		for _, user := range users {
			allow[user.Id] = struct{}{}
		}
		if len(users) < accessControlRecipientPageSize {
			break
		}
		cursor.TargetID = users[len(users)-1].Id
	}

	if a.Metrics() != nil {
		a.Metrics().ObserveAccessControlRecipientFill("ok", time.Since(start).Seconds(), len(allow))
	}
	return accessControlRecipientEntry{allow: allow}
}

// accessControlRecipientFilter returns a predicate deciding whether a user
// may receive a post marked with value. It returns nil when nothing needs
// filtering: the post is unmarked or its resource has no policy. With a
// recipient set the predicate is a map lookup; without one (negative entry)
// it evaluates per user through the read lane, which denies on error.
func (a *App) accessControlRecipientFilter(rctx request.CTX, value string) func(userID string) bool {
	if value == "" {
		return nil
	}
	entry := a.accessControlRecipientEntryFor(rctx, value)
	if entry.noPolicy {
		return nil
	}
	if entry.failed {
		return func(userID string) bool {
			return a.AccessControlResourceAllowed(rctx, userID, value)
		}
	}
	return func(userID string) bool {
		_, allowed := entry.allow[userID]
		return allowed
	}
}

// HasAccessToAccessControlResource reports whether userID may receive a post
// marked with resource. It is the broadcast hook's entry point and so is
// served from the recipient cache when possible.
func (a *App) HasAccessToAccessControlResource(rctx request.CTX, userID, resource string) bool {
	filter := a.accessControlRecipientFilter(rctx, resource)
	if filter == nil {
		return true
	}
	return filter(userID)
}

// invalidateAccessControlRecipients drops cached recipient entries for
// policyID on this node and tells the rest of the cluster to do the same.
// Called from every plugin policy save and delete.
func (a *App) invalidateAccessControlRecipients(policyID string) {
	a.ch.invalidateAccessControlRecipientsLocally(policyID)

	cluster := a.Srv().platform.Cluster()
	if cluster == nil {
		return
	}
	data, err := json.Marshal(accessControlRecipientInvalidation{PolicyID: policyID})
	if err != nil {
		return
	}
	cluster.SendClusterMessage(&model.ClusterMessage{
		Event:            model.ClusterEventInvalidateCacheForAccessControlResourceRecipients,
		SendType:         model.ClusterSendReliable,
		WaitForAllToSend: true,
		Data:             data,
	})
}

type accessControlRecipientInvalidation struct {
	PolicyID string `json:"policy_id"`
}

func (ch *Channels) invalidateAccessControlRecipientsLocally(policyID string) {
	if ch.accessControlRecipients == nil {
		return
	}
	if dropped := ch.accessControlRecipients.invalidate(policyID); dropped > 0 && ch.srv.GetMetrics() != nil {
		ch.srv.GetMetrics().IncrementMemCacheInvalidationCounter(accessControlRecipientCacheName)
	}
}

// clusterInvalidateAccessControlRecipientsHandler is the receive side of
// invalidateAccessControlRecipients.
func (ch *Channels) clusterInvalidateAccessControlRecipientsHandler(msg *model.ClusterMessage) {
	var data accessControlRecipientInvalidation
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		ch.srv.Log().Warn("Failed to decode access control recipient invalidation", mlog.Err(err))
		return
	}
	if data.PolicyID == "" {
		return
	}
	ch.invalidateAccessControlRecipientsLocally(data.PolicyID)
}

// pruneNotificationRecipients removes every user allowed rejects from the
// notification candidate maps, keeping the sender, and returns the usernames
// it removed so mention parsing can ignore them.
func pruneNotificationRecipients(allowed func(userID string) bool, senderID string, profileMap map[string]*model.User, notifyProps map[string]model.StringMap, followers model.StringSet) map[string]struct{} {
	pruned := map[string]struct{}{}
	for id, profile := range profileMap {
		if id == senderID || allowed(id) {
			continue
		}
		delete(profileMap, id)
		pruned[profile.Username] = struct{}{}
	}
	for id := range notifyProps {
		if id == senderID || allowed(id) {
			continue
		}
		delete(notifyProps, id)
	}
	for id := range followers {
		if id == senderID || allowed(id) {
			continue
		}
		delete(followers, id)
	}
	return pruned
}

// dropPrunedPotentialMentions removes pruned usernames from the list of
// mentions that had no matching channel member.
func dropPrunedPotentialMentions(potential []string, pruned map[string]struct{}) []string {
	if len(pruned) == 0 || len(potential) == 0 {
		return potential
	}
	kept := potential[:0]
	for _, name := range potential {
		if _, ok := pruned[name]; !ok {
			kept = append(kept, name)
		}
	}
	return kept
}
