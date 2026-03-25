// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	postReadStatusBufferSize     = sendQueueSize * 100
	postReadStatusFlushThreshold = postReadStatusBufferSize / 8
	postReadStatusBatchInterval  = 500 * time.Millisecond
	postReadStatusMaxBatchSize   = 500
	postReadStatusNumWorkers     = 4
	// recentReadCacheTTL controls how long we suppress duplicate read-status
	// enqueues for the same (postID, userID) pair.
	recentReadCacheTTL = 5 * time.Minute
)

// recentReadCache is a simple TTL cache to avoid re-enqueuing read statuses
// for posts a user has already read recently. This dramatically reduces write
// amplification from repeated API fetches of the same posts.
type recentReadCache struct {
	mu      sync.Mutex
	entries map[postReadKey]time.Time
}

type postReadKey struct {
	postID string
	userID string
}

func newRecentReadCache() *recentReadCache {
	return &recentReadCache{
		entries: make(map[postReadKey]time.Time),
	}
}

// shouldEnqueue returns true if this (postID, userID) pair has not been
// enqueued within the TTL window. If it returns true, it also records the
// entry so subsequent calls within the TTL return false.
func (c *recentReadCache) shouldEnqueue(postID, userID string) bool {
	k := postReadKey{postID: postID, userID: userID}
	now := time.Now()

	c.mu.Lock()
	defer c.mu.Unlock()

	if exp, ok := c.entries[k]; ok && now.Before(exp) {
		return false
	}
	c.entries[k] = now.Add(recentReadCacheTTL)
	return true
}

// evictExpired removes expired entries to prevent unbounded growth.
// Called periodically from the worker goroutines.
func (c *recentReadCache) evictExpired() {
	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()

	for k, exp := range c.entries {
		if now.After(exp) {
			delete(c.entries, k)
		}
	}
}

// QueueSinglePostReadStatus enqueues a single post read status entry for bulk writing.
func (ps *PlatformService) QueueSinglePostReadStatus(postID string, userID string) {
	if !ps.recentReadCache.shouldEnqueue(postID, userID) {
		return
	}

	status := &model.PostReadStatus{
		PostId:   postID,
		UserId:   userID,
		CreateAt: model.GetMillis(),
	}
	select {
	case ps.postReadStatusChan <- status:
	default:
		// Channel full — drop the entry rather than blocking the API goroutine
		// with a synchronous DB write. This is telemetry data; a missed row is
		// acceptable, an API latency spike is not.
		ps.Log().Warn("Post read status channel is full, dropping entry",
			mlog.String("post_id", postID), mlog.String("user_id", userID))
	}
}

// QueuePostReadStatus enqueues post read status entries for bulk writing.
func (ps *PlatformService) QueuePostReadStatus(postIDs []string, userID string) {
	now := model.GetMillis()
	for _, postID := range postIDs {
		if !ps.recentReadCache.shouldEnqueue(postID, userID) {
			continue
		}

		status := &model.PostReadStatus{
			PostId:   postID,
			UserId:   userID,
			CreateAt: now,
		}
		select {
		case ps.postReadStatusChan <- status:
		default:
			ps.Log().Warn("Post read status channel is full, dropping entries")
			return
		}
	}
}

// QueuePostReadStatusForPost enqueues read status entries for a single post and multiple users.
func (ps *PlatformService) QueuePostReadStatusForPost(postID string, userIDs []string) {
	now := model.GetMillis()
	for _, userID := range userIDs {
		if !ps.recentReadCache.shouldEnqueue(postID, userID) {
			continue
		}

		status := &model.PostReadStatus{
			PostId:   postID,
			UserId:   userID,
			CreateAt: now,
		}
		select {
		case ps.postReadStatusChan <- status:
		default:
			ps.Log().Warn("Post read status channel is full, dropping entries")
			return
		}
	}
}

// processPostReadStatusUpdates processes post read status updates in batches.
// Multiple instances of this goroutine run concurrently; dedup is handled by
// the recentReadCache at enqueue time and ON CONFLICT DO NOTHING in the DB.
func (ps *PlatformService) processPostReadStatusUpdates() {
	type key struct {
		postID string
		userID string
	}
	batch := make(map[key]*model.PostReadStatus)
	ticker := time.NewTicker(postReadStatusBatchInterval)
	defer ticker.Stop()

	evictTicker := time.NewTicker(recentReadCacheTTL)
	defer evictTicker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}

		statuses := make([]*model.PostReadStatus, 0, len(batch))
		for _, s := range batch {
			statuses = append(statuses, s)
		}
		clear(batch)

		// Write in capped batches to avoid oversized SQL queries.
		for i := 0; i < len(statuses); i += postReadStatusMaxBatchSize {
			end := i + postReadStatusMaxBatchSize
			if end > len(statuses) {
				end = len(statuses)
			}
			if err := ps.Store.PostReadStatus().SaveMultiple(statuses[i:end]); err != nil {
				ps.Log().Warn("Failed to save post read statuses", mlog.Err(err))
			}
		}
	}

	for {
		select {
		case status := <-ps.postReadStatusChan:
			k := key{postID: status.PostId, userID: status.UserId}
			batch[k] = status

			// Drain all available items from the channel without blocking.
		draining:
			for {
				select {
				case s := <-ps.postReadStatusChan:
					k = key{postID: s.PostId, userID: s.UserId}
					batch[k] = s
				default:
					break draining
				}
			}

			if len(batch) >= postReadStatusFlushThreshold {
				flush()
			}
		case <-ticker.C:
			flush()
		case <-evictTicker.C:
			ps.recentReadCache.evictExpired()
		case <-ps.postReadStatusExitSignal:
			flush()
			return
		}
	}
}
