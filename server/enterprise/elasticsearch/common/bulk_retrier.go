// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	bulkRetryMaxAttempts = 4
	bulkRetryChunkSize   = 1000
	bulkRetryBackoff     = 2 * time.Second

	// BulkRetryWaitLimit is the longest a job close waits for the retries.
	BulkRetryWaitLimit = 5 * time.Minute
)

type BulkItem struct {
	Index  string
	Action string // "index" or "delete"
	DocID  string
	Body   io.ReadSeeker // nil for delete
}

type BulkBackend interface {
	// Exists returns the docs that exist. Key is index+"/"+docID.
	Exists(ctx context.Context, items []BulkItem) (map[string]bool, error)
	// Apply sends one item. Status 0 with an error means transport failure.
	Apply(ctx context.Context, item BulkItem) (status int, err error)
}

type retryItem struct {
	BulkItem
	body     []byte // own copy, so a late reader of the old Body cannot clash
	attempts int
}

// BulkRetrier takes items the bulk indexer could not confirm, checks if they
// are in the search backend, and resends the missing ones.
type BulkRetrier struct {
	backend BulkBackend
	logger  mlog.LoggerIFace
	// Backoff is the wait before an item's first check. It doubles per attempt.
	Backoff time.Duration
	// Timeout limits each check and each resend.
	Timeout time.Duration

	// ctx ends when Wait gives up. It stops the retries.
	ctx    context.Context
	cancel context.CancelFunc

	mut     sync.Mutex
	pending []retryItem
	running bool
	// One count per queued item, so Wait can block until all are settled.
	inflight sync.WaitGroup

	failed   atomic.Int64
	retried  atomic.Int64
	verified atomic.Int64
}

func NewBulkRetrier(backend BulkBackend, logger mlog.LoggerIFace) *BulkRetrier {
	ctx, cancel := context.WithCancel(context.Background())
	return &BulkRetrier{
		backend: backend, logger: logger, ctx: ctx, cancel: cancel,
		Backoff: bulkRetryBackoff, Timeout: BulkRequestTimeoutFloor,
	}
}

// Handle never blocks. It is called from the bulk indexer worker.
func (r *BulkRetrier) Handle(item BulkItem, status int, err error) {
	switch {
	case isGone(item, status):
		return
	case isTransient(status):
		r.enqueue(item)
	default:
		r.reject(item, status, err)
	}
}

// isGone is true for a delete of a doc that is already gone.
func isGone(item BulkItem, status int) bool {
	return item.Action == "delete" && status == http.StatusNotFound
}

// isTransient is true when the outcome is unknown or worth a retry.
func isTransient(status int) bool {
	return status == 0 || status == http.StatusTooManyRequests || status >= http.StatusInternalServerError
}

// reject counts a document the backend refuses.
func (r *BulkRetrier) reject(item BulkItem, status int, err error) {
	r.failed.Add(1)
	r.logger.Warn("Bulk indexer: document rejected",
		mlog.String("index", item.Index), mlog.String("doc_id", item.DocID),
		mlog.String("action", item.Action), mlog.Int("status", status), mlog.Err(err))
}

// Wait blocks until every queued item is settled. If ctx ends first, it stops
// the retries (the rest count as failed) and returns the ctx error.
func (r *BulkRetrier) Wait(ctx context.Context) error {
	done := make(chan struct{})
	go func() {
		r.inflight.Wait()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		r.cancel()
		return ctx.Err()
	}
}

// Failed counts the items that could not be indexed.
func (r *BulkRetrier) Failed() int64 { return r.failed.Load() }

// Retried counts the items that were resent and succeeded.
func (r *BulkRetrier) Retried() int64 { return r.retried.Load() }

// Verified counts the items that needed no resend after the check.
func (r *BulkRetrier) Verified() int64 { return r.verified.Load() }

func (r *BulkRetrier) enqueue(item BulkItem) {
	r.inflight.Add(1)
	queued := retryItem{BulkItem: item}
	if item.Body != nil {
		var err error
		if _, err = item.Body.Seek(0, io.SeekStart); err == nil {
			queued.body, err = io.ReadAll(item.Body)
		}
		if err != nil {
			r.logger.Warn("Bulk retry: cannot read document body",
				mlog.String("index", item.Index), mlog.String("doc_id", item.DocID), mlog.Err(err))
			r.fail()
			return
		}
		queued.Body = nil
	}
	r.mut.Lock()
	defer r.mut.Unlock()
	r.pending = append(r.pending, queued)
	if !r.running {
		r.running = true
		go r.run()
	}
}

func (r *BulkRetrier) run() {
	for {
		r.mut.Lock()
		if len(r.pending) == 0 {
			r.running = false
			r.mut.Unlock()
			return
		}
		delay := r.backoff(r.pending)
		r.mut.Unlock()

		stopped := r.ctx.Err() != nil || !r.sleep(delay)

		// Take what arrived while waiting.
		r.mut.Lock()
		items := r.pending
		r.pending = nil
		r.mut.Unlock()

		if stopped {
			r.logger.Warn("Bulk retry stopped, documents not confirmed", mlog.Int("num_items", len(items)))
			for range items {
				r.fail()
			}
			continue
		}
		r.logger.Warn("Bulk items unconfirmed, checking documents", mlog.Int("num_items", len(items)))
		for len(items) > 0 {
			n := min(len(items), bulkRetryChunkSize)
			r.processChunk(items[:n])
			items = items[n:]
		}
	}
}

// backoff follows the newest item, so a busy queue does not slow new items.
// Attempts stay below the max, so it never grows past Backoff * 8.
func (r *BulkRetrier) backoff(items []retryItem) time.Duration {
	attempts := bulkRetryMaxAttempts
	for _, item := range items {
		attempts = min(attempts, item.attempts)
	}
	return r.Backoff << attempts
}

// sleep returns false if the retries were stopped meanwhile.
func (r *BulkRetrier) sleep(d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-r.ctx.Done():
		return false
	}
}

func (r *BulkRetrier) processChunk(items []retryItem) {
	ctx, cancel := context.WithTimeout(r.ctx, r.Timeout)
	found, err := r.backend.Exists(ctx, items2bulk(items))
	cancel()
	if err != nil {
		r.logger.Warn("Bulk retry: check failed, resending all", mlog.Err(err))
	}

	for _, item := range items {
		if err == nil && isSettled(item.BulkItem, found) {
			r.verified.Add(1)
			r.inflight.Done()
			continue
		}
		r.resend(item)
	}
}

// isSettled is true when the check shows the wanted state: an indexed doc
// is there, or a deleted doc is gone. A doc missing from the answer is unknown.
func isSettled(item BulkItem, found map[string]bool) bool {
	exists, ok := found[item.Index+"/"+item.DocID]
	return ok && exists == (item.Action == "index")
}

func (r *BulkRetrier) resend(item retryItem) {
	item.attempts++
	if item.body != nil {
		item.Body = bytes.NewReader(item.body)
	}
	ctx, cancel := context.WithTimeout(r.ctx, r.Timeout)
	status, err := r.backend.Apply(ctx, item.BulkItem)
	cancel()

	switch {
	case status >= 200 && status < 300, isGone(item.BulkItem, status):
		r.retried.Add(1)
		r.inflight.Done()
	case isTransient(status):
		if item.attempts >= bulkRetryMaxAttempts {
			r.logger.Error("Bulk retry: giving up on document",
				mlog.String("index", item.Index), mlog.String("doc_id", item.DocID),
				mlog.Int("attempts", item.attempts), mlog.Int("status", status), mlog.Err(err))
			r.fail()
			return
		}
		r.mut.Lock()
		r.pending = append(r.pending, item)
		r.mut.Unlock()
	default:
		r.reject(item.BulkItem, status, err)
		r.inflight.Done()
	}
}

// fail counts one queued item that could not be indexed.
func (r *BulkRetrier) fail() {
	r.failed.Add(1)
	r.inflight.Done()
}

func items2bulk(items []retryItem) []BulkItem {
	out := make([]BulkItem, len(items))
	for i, item := range items {
		out[i] = item.BulkItem
	}
	return out
}
