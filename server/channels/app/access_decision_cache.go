// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"maps"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// Node-local cache of PDP decisions (AccessDecision.Decision only, never RBAC).
//
// Staleness uses version numbers, not deletes. Each entry stores the global, user, session,
// resource and (user, resource) versions read before its decision was computed; a bump to any
// of them makes the entry miss. Versions come from one node-wide sequence and are never reused.
// An ID never bumped reads as 0.

const (
	accessDecisionCacheName = "AccessDecision"

	accessDecisionLRUShards     = 256
	accessDecisionVersionShards = 64

	// Max interned (resource type, action) pairs; past it, plugin pairs bypass the cache.
	accessDecisionMaxOps = 4096

	accessDecisionNoSlot int32 = -1
)

type accessSubjectKind uint8

const (
	// Keyed by session ID: session roles and session attributes.
	accessSubjectSession accessSubjectKind = iota + 1
	// Keyed by user ID: stored roles, no session attributes.
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

const (
	fnvOffset uint64 = 14695981039346656037
	fnvPrime  uint64 = 1099511628211
)

func fnv1a(h uint64, b []byte) uint64 {
	for _, c := range b {
		h ^= uint64(c)
		h *= fnvPrime
	}
	return h
}

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

// accessDecisionLookup is filled by prepare and get, then consumed by put.
type accessDecisionLookup struct {
	key        accessDecisionKey
	user       accessID
	pair       accessPairID
	versions   accessDecisionVersions
	capturedAt int64
	shard      uint32
}

type accessVersionCell struct {
	version  uint64
	bumpedAt int64
}

type accessVersionShard[K comparable] struct {
	mu    sync.RWMutex
	cells map[K]accessVersionCell
}

// accessVersionTable maps an ID to its current version.
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

// bump reads the clock under the write lock, so bumpedAt is later than the capture time of any
// lookup that read the old version. sweep relies on that.
func (t *accessVersionTable[K]) bump(k K, version uint64, now func() int64) {
	s := t.shardFor(&k)
	s.mu.Lock()
	s.cells[k] = accessVersionCell{version: version, bumpedAt: now()}
	s.mu.Unlock()
}

// sweep drops versions bumped at or before cutoff.
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

// accessDecisionSlot holds no pointers, so the GC never scans the slab.
type accessDecisionSlot struct {
	key       accessDecisionKey
	versions  accessDecisionVersions
	expiresAt int64
	prev      int32
	next      int32
	allowed   bool
}

// accessDecisionShard is a fixed-capacity LRU over a preallocated slab, linked by index with the
// most recent at head. Slots are reused in place, so it allocates nothing once full.
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

// accessOpTable interns (resource type, action) to a small integer. Reads use an immutable
// snapshot (no lock, no allocation); adding a pair copies it.
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
	maps.Copy(next, current)
	actions := make(map[string]uint16, len(current[resourceType])+1)
	maps.Copy(actions, current[resourceType])
	t.count++
	id := uint16(t.count)
	actions[action] = id
	next[resourceType] = actions
	t.snapshot.Store(&next)
	return id, true
}

type accessDecisionStats struct {
	hits      uint64
	misses    uint64
	evictions uint64
}

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
}

func newAccessDecisionCache(size int, maxAge time.Duration) *accessDecisionCache {
	perShard := max(size/accessDecisionLRUShards, 1)

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

// prepare reports false when the decision can't be cached: a non-26-byte ID, or an op past the
// interning cap.
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
	h *= fnvPrime
	l.shard = uint32(h % accessDecisionLRUShards)
	return l, true
}

// get captures the clock and current versions into l, then returns the stored decision if it was
// stored under exactly those versions and hasn't expired. On a miss, l is ready for put.
func (c *accessDecisionCache) get(l *accessDecisionLookup) (allowed bool, hit bool) {
	// The clock is read before the versions; see bump.
	l.capturedAt = c.now()
	l.versions.global = c.global.Load()
	l.versions.user = c.users.get(l.user)
	if l.key.kind == accessSubjectSession {
		l.versions.session = c.sessions.get(l.key.subject)
	}
	l.versions.resource = c.resources.get(l.key.resource)
	l.versions.userResource = c.userResources.get(l.pair)

	s := &c.shards[l.shard]
	s.mu.Lock()
	if i, ok := s.index[l.key]; ok {
		slot := &s.slots[i]
		if slot.versions == l.versions && l.capturedAt < slot.expiresAt {
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

// put stores a decision under the versions get captured. Expiry counts from the capture, not
// from now, so a slow build can't outlive a swept version.
func (c *accessDecisionCache) put(l *accessDecisionLookup, allowed bool) {
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
	slot.expiresAt = l.capturedAt + c.maxAge
	slot.allowed = allowed
}

func (c *accessDecisionCache) invalidateAll() {
	c.global.Store(c.seq.Add(1))
}

func (c *accessDecisionCache) invalidateUser(userID string) {
	if k, ok := toAccessID(userID); ok {
		c.users.bump(k, c.seq.Add(1), c.now)
	}
}

func (c *accessDecisionCache) invalidateSession(sessionID string) {
	if k, ok := toAccessID(sessionID); ok {
		c.sessions.bump(k, c.seq.Add(1), c.now)
	}
}

func (c *accessDecisionCache) invalidateResource(resourceID string) {
	if k, ok := toAccessID(resourceID); ok {
		c.resources.bump(k, c.seq.Add(1), c.now)
	}
}

func (c *accessDecisionCache) invalidateUserResource(userID, resourceID string) {
	if k, ok := toAccessPairID(userID, resourceID); ok {
		c.userResources.bump(k, c.seq.Add(1), c.now)
	}
}

// sweep drops versions bumped more than maxAge ago. Any entry captured before such a bump has
// expired, so dropping the version (reads as 0 again) can't revive it.
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
