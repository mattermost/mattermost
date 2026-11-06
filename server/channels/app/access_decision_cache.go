// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// The access decision cache holds PDP answers (model.AccessDecision.Decision) only. Nothing in it
// is combined with RBAC: role-permission checks, bypasses and governance short-circuits stay with
// the callers. It is node-local in every cache mode; other nodes learn about changes through
// ClusterEventInvalidateAccessDecisions.
//
// Staleness is tracked with version numbers rather than by deleting entries. Every value comes
// from one node-wide sequence, so a value is never reused. Each entry records the versions of its
// subject's user, session, resource and (user, resource) pair, plus the global version, as they
// were read before the decision was computed. A change bumps the matching version; an entry whose
// recorded versions no longer match is a miss. An ID that was never bumped reads as version 0.
//
// Versions are swept once they are older than the max age: every entry captured before that bump
// has expired by then, so dropping the version can never make an old entry match again.

const (
	accessDecisionCacheName = "AccessDecision"

	accessDecisionLRUShards     = 256
	accessDecisionVersionShards = 64

	// accessDecisionMaxOps caps how many (resource type, action) pairs are interned. Core pairs
	// are a handful; the rest are plugin-defined, and past the cap those bypass the cache.
	accessDecisionMaxOps = 4096

	accessDecisionNoSlot int32 = -1
)

type accessSubjectKind uint8

const (
	// accessSubjectSession is a subject built from the session's own user, its roles and its
	// session attributes. It is keyed by session ID.
	accessSubjectSession accessSubjectKind = iota + 1
	// accessSubjectUser is a subject built from a user's stored roles, with no session
	// attributes. It is keyed by user ID.
	accessSubjectUser
)

type accessID = [26]byte

type accessPairID = [52]byte

func toAccessID(id string) (accessID, bool) {
	var k accessID
	if len(id) != len(k) {
		return k, false
	}
	copy(k[:], id)
	return k, true
}

func toAccessPairID(userID, resourceID string) (accessPairID, bool) {
	var k accessPairID
	if len(userID) != 26 || len(resourceID) != 26 {
		return k, false
	}
	copy(k[:26], userID)
	copy(k[26:], resourceID)
	return k, true
}

// fnv1a hashes an ID without allocating. IDs are random, so a short hash spreads them evenly.
func fnv1a(h uint64, b []byte) uint64 {
	for _, c := range b {
		h ^= uint64(c)
		h *= 1099511628211
	}
	return h
}

const fnvOffset uint64 = 14695981039346656037

type accessDecisionKey struct {
	subject  accessID
	resource accessID
	op       uint16
	kind     accessSubjectKind
}

type accessDecisionVersions struct {
	global       uint64
	user         uint64
	session      uint64
	resource     uint64
	userResource uint64
}

// accessDecisionLookup carries one lookup's keys and the versions read before the decision was
// computed. put stores those versions, so an invalidation that lands while a miss is being
// computed makes the stored entry miss next time.
type accessDecisionLookup struct {
	key      accessDecisionKey
	user     accessID
	pair     accessPairID
	versions accessDecisionVersions
	shard    uint32
}

// accessVersionCell is one ID's current version and when it was last bumped (unix nanos).
type accessVersionCell struct {
	version  uint64
	bumpedAt int64
}

type accessVersionShard[K comparable] struct {
	mu    sync.RWMutex
	cells map[K]accessVersionCell
}

// accessVersionTable maps an ID to its current version. Absent IDs read as 0.
type accessVersionTable[K accessID | accessPairID] struct {
	shards [accessDecisionVersionShards]accessVersionShard[K]
}

func newAccessVersionTable[K accessID | accessPairID]() *accessVersionTable[K] {
	t := &accessVersionTable[K]{}
	for i := range t.shards {
		t.shards[i].cells = make(map[K]accessVersionCell)
	}
	return t
}

func (t *accessVersionTable[K]) shardFor(k *K) *accessVersionShard[K] {
	var h uint64
	switch v := any(k).(type) {
	case *accessID:
		h = fnv1a(fnvOffset, v[:])
	case *accessPairID:
		h = fnv1a(fnvOffset, v[:])
	}
	return &t.shards[h%accessDecisionVersionShards]
}

func (t *accessVersionTable[K]) get(k K) uint64 {
	s := t.shardFor(&k)
	s.mu.RLock()
	v := s.cells[k].version
	s.mu.RUnlock()
	return v
}

func (t *accessVersionTable[K]) bump(k K, version uint64, now int64) {
	s := t.shardFor(&k)
	s.mu.Lock()
	s.cells[k] = accessVersionCell{version: version, bumpedAt: now}
	s.mu.Unlock()
}

// sweep drops versions bumped at or before cutoff and returns how many it dropped.
func (t *accessVersionTable[K]) sweep(cutoff int64) int {
	dropped := 0
	for i := range t.shards {
		s := &t.shards[i]
		s.mu.Lock()
		for k, cell := range s.cells {
			if cell.bumpedAt <= cutoff {
				delete(s.cells, k)
				dropped++
			}
		}
		s.mu.Unlock()
	}
	return dropped
}

func (t *accessVersionTable[K]) len() int {
	n := 0
	for i := range t.shards {
		s := &t.shards[i]
		s.mu.RLock()
		n += len(s.cells)
		s.mu.RUnlock()
	}
	return n
}

// accessDecisionSlot is one LRU entry. It holds no pointers, so the slab is never scanned by the GC.
type accessDecisionSlot struct {
	key       accessDecisionKey
	versions  accessDecisionVersions
	expiresAt int64
	prev      int32
	next      int32
	allowed   bool
}

// accessDecisionShard is a fixed-capacity LRU over a preallocated slab. Slots are linked by index,
// most recently used at head, and reused in place, so it allocates nothing after warm-up.
type accessDecisionShard struct {
	mu    sync.Mutex
	index map[accessDecisionKey]int32
	slots []accessDecisionSlot
	head  int32
	tail  int32

	hits      uint64
	misses    uint64
	evictions uint64
}

func (s *accessDecisionShard) unlink(i int32) {
	slot := &s.slots[i]
	if slot.prev != accessDecisionNoSlot {
		s.slots[slot.prev].next = slot.next
	} else {
		s.head = slot.next
	}
	if slot.next != accessDecisionNoSlot {
		s.slots[slot.next].prev = slot.prev
	} else {
		s.tail = slot.prev
	}
	slot.prev, slot.next = accessDecisionNoSlot, accessDecisionNoSlot
}

func (s *accessDecisionShard) pushFront(i int32) {
	slot := &s.slots[i]
	slot.prev = accessDecisionNoSlot
	slot.next = s.head
	if s.head != accessDecisionNoSlot {
		s.slots[s.head].prev = i
	}
	s.head = i
	if s.tail == accessDecisionNoSlot {
		s.tail = i
	}
}

func (s *accessDecisionShard) moveToFront(i int32) {
	if s.head == i {
		return
	}
	s.unlink(i)
	s.pushFront(i)
}

// accessOpTable interns (resource type, action) pairs to small integers. Reads go through an
// immutable snapshot, so a lookup takes no lock and allocates nothing; adding a pair copies it.
type accessOpTable struct {
	mu       sync.Mutex
	snapshot atomic.Pointer[map[string]map[string]uint16]
	count    int
}

func newAccessOpTable() *accessOpTable {
	t := &accessOpTable{}
	m := map[string]map[string]uint16{}
	t.snapshot.Store(&m)
	for _, action := range []string{
		model.AccessControlPolicyActionMembership,
		model.AccessControlPolicyActionUploadFileAttachment,
		model.AccessControlPolicyActionDownloadFileAttachment,
		model.AccessControlPolicyActionChannelReadAccess,
		model.AccessControlPolicyActionChannelWriteAccess,
		model.AccessControlPolicyActionChannelManagementAccess,
		model.AccessControlPolicyActionCreateBurnOnReadPost,
	} {
		t.id(model.AccessControlPolicyTypeChannel, action)
	}
	t.id(model.AccessControlPolicyTypeTeam, model.AccessControlPolicyActionMembership)
	return t
}

func (t *accessOpTable) id(resourceType, action string) (uint16, bool) {
	if id, ok := (*t.snapshot.Load())[resourceType][action]; ok {
		return id, true
	}

	t.mu.Lock()
	defer t.mu.Unlock()
	current := *t.snapshot.Load()
	if id, ok := current[resourceType][action]; ok {
		return id, true
	}
	if t.count >= accessDecisionMaxOps {
		return 0, false
	}

	next := make(map[string]map[string]uint16, len(current)+1)
	for typ, actions := range current {
		next[typ] = actions
	}
	actions := make(map[string]uint16, len(current[resourceType])+1)
	for a, id := range current[resourceType] {
		actions[a] = id
	}
	t.count++
	id := uint16(t.count)
	actions[action] = id
	next[resourceType] = actions
	t.snapshot.Store(&next)
	return id, true
}

type accessDecisionStats struct {
	hits          uint64
	misses        uint64
	evictions     uint64
	invalidations uint64
}

// accessDecisionCache is the node-local cache of PDP decisions.
type accessDecisionCache struct {
	maxAge int64 // nanoseconds
	now    func() int64

	shards [accessDecisionLRUShards]accessDecisionShard

	seq           atomic.Uint64
	global        atomic.Uint64
	users         *accessVersionTable[accessID]
	sessions      *accessVersionTable[accessID]
	resources     *accessVersionTable[accessID]
	userResources *accessVersionTable[accessPairID]

	ops *accessOpTable

	invalidations atomic.Uint64
}

func newAccessDecisionCache(size int, maxAge time.Duration) *accessDecisionCache {
	perShard := size / accessDecisionLRUShards
	if perShard < 1 {
		perShard = 1
	}

	c := &accessDecisionCache{
		maxAge:        int64(maxAge),
		now:           func() int64 { return time.Now().UnixNano() },
		users:         newAccessVersionTable[accessID](),
		sessions:      newAccessVersionTable[accessID](),
		resources:     newAccessVersionTable[accessID](),
		userResources: newAccessVersionTable[accessPairID](),
		ops:           newAccessOpTable(),
	}
	for i := range c.shards {
		s := &c.shards[i]
		s.index = make(map[accessDecisionKey]int32, perShard)
		s.slots = make([]accessDecisionSlot, 0, perShard)
		s.head, s.tail = accessDecisionNoSlot, accessDecisionNoSlot
	}
	return c
}

// prepare builds the lookup for one decision. It reports false when the decision can't be cached:
// an ID that isn't a Mattermost ID, or a (resource type, action) pair past the interning cap.
func (c *accessDecisionCache) prepare(kind accessSubjectKind, subjectID, userID, resourceType, resourceID, action string) (accessDecisionLookup, bool) {
	var l accessDecisionLookup

	subject, ok := toAccessID(subjectID)
	if !ok {
		return l, false
	}
	user, ok := toAccessID(userID)
	if !ok {
		return l, false
	}
	resource, ok := toAccessID(resourceID)
	if !ok {
		return l, false
	}
	op, ok := c.ops.id(resourceType, action)
	if !ok {
		return l, false
	}

	l.key = accessDecisionKey{subject: subject, resource: resource, op: op, kind: kind}
	l.user = user
	copy(l.pair[:26], user[:])
	copy(l.pair[26:], resource[:])

	h := fnv1a(fnvOffset, subject[:])
	h = fnv1a(h, resource[:])
	h ^= uint64(op)<<8 | uint64(kind)
	h *= 1099511628211
	l.shard = uint32(h % accessDecisionLRUShards)
	return l, true
}

// get reads the current versions into l, then returns the cached decision if one is stored under
// exactly those versions and hasn't expired. The versions stay in l for a following put.
func (c *accessDecisionCache) get(l *accessDecisionLookup) (allowed bool, hit bool) {
	l.versions.global = c.global.Load()
	l.versions.user = c.users.get(l.user)
	if l.key.kind == accessSubjectSession {
		l.versions.session = c.sessions.get(l.key.subject)
	}
	l.versions.resource = c.resources.get(l.key.resource)
	l.versions.userResource = c.userResources.get(l.pair)

	now := c.now()
	s := &c.shards[l.shard]
	s.mu.Lock()
	i, ok := s.index[l.key]
	if ok {
		slot := &s.slots[i]
		if slot.versions == l.versions && now < slot.expiresAt {
			s.moveToFront(i)
			allowed = slot.allowed
			s.hits++
			s.mu.Unlock()
			return allowed, true
		}
	}
	s.misses++
	s.mu.Unlock()
	return false, false
}

// put stores a decision under the versions get read into l.
func (c *accessDecisionCache) put(l *accessDecisionLookup, allowed bool) {
	expiresAt := c.now() + c.maxAge
	s := &c.shards[l.shard]
	s.mu.Lock()
	defer s.mu.Unlock()

	i, ok := s.index[l.key]
	switch {
	case ok:
		s.moveToFront(i)
	case len(s.slots) < cap(s.slots):
		s.slots = s.slots[:len(s.slots)+1]
		i = int32(len(s.slots) - 1)
		s.slots[i].prev, s.slots[i].next = accessDecisionNoSlot, accessDecisionNoSlot
		s.pushFront(i)
		s.index[l.key] = i
	default:
		i = s.tail
		delete(s.index, s.slots[i].key)
		s.evictions++
		s.moveToFront(i)
		s.index[l.key] = i
	}

	slot := &s.slots[i]
	slot.key = l.key
	slot.versions = l.versions
	slot.expiresAt = expiresAt
	slot.allowed = allowed
}

func (c *accessDecisionCache) nextVersion() uint64 {
	return c.seq.Add(1)
}

func (c *accessDecisionCache) invalidateAll() {
	c.global.Store(c.nextVersion())
	c.invalidations.Add(1)
}

func (c *accessDecisionCache) invalidateUser(userID string) {
	if k, ok := toAccessID(userID); ok {
		c.users.bump(k, c.nextVersion(), c.now())
		c.invalidations.Add(1)
	}
}

func (c *accessDecisionCache) invalidateSession(sessionID string) {
	if k, ok := toAccessID(sessionID); ok {
		c.sessions.bump(k, c.nextVersion(), c.now())
		c.invalidations.Add(1)
	}
}

func (c *accessDecisionCache) invalidateResource(resourceID string) {
	if k, ok := toAccessID(resourceID); ok {
		c.resources.bump(k, c.nextVersion(), c.now())
		c.invalidations.Add(1)
	}
}

func (c *accessDecisionCache) invalidateUserResource(userID, resourceID string) {
	if k, ok := toAccessPairID(userID, resourceID); ok {
		c.userResources.bump(k, c.nextVersion(), c.now())
		c.invalidations.Add(1)
	}
}

// sweep drops versions old enough that no live entry can have been captured before them.
func (c *accessDecisionCache) sweep() int {
	cutoff := c.now() - c.maxAge
	return c.users.sweep(cutoff) +
		c.sessions.sweep(cutoff) +
		c.resources.sweep(cutoff) +
		c.userResources.sweep(cutoff)
}

func (c *accessDecisionCache) stats() accessDecisionStats {
	var st accessDecisionStats
	for i := range c.shards {
		s := &c.shards[i]
		s.mu.Lock()
		st.hits += s.hits
		st.misses += s.misses
		st.evictions += s.evictions
		s.mu.Unlock()
	}
	st.invalidations = c.invalidations.Load()
	return st
}

func (c *accessDecisionCache) len() int {
	n := 0
	for i := range c.shards {
		s := &c.shards[i]
		s.mu.Lock()
		n += len(s.index)
		s.mu.Unlock()
	}
	return n
}
