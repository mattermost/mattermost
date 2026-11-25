// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
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
	attempts int
}

// BulkRetrier takes items the bulk indexer could not confirm, checks if they
// are in the search backend, and resends the missing ones.
type BulkRetrier struct {
	backend BulkBackend
	logger  mlog.LoggerIFace
	// Backoff is the wait before an item's first check. It doubles per attempt.
	Backoff time.Duration

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
	return &BulkRetrier{backend: backend, logger: logger, Backoff: bulkRetryBackoff}
}

// Handle never blocks. It is called from the bulk indexer worker.
func (r *BulkRetrier) Handle(item BulkItem, status int, err error) {
	switch {
	case item.Action == "delete" && status == http.StatusNotFound:
		return
	case status == 0 || status == http.StatusTooManyRequests || status >= http.StatusInternalServerError:
		r.enqueue(item)
	default:
		r.failed.Add(1)
		r.logger.Warn("Bulk indexer: document rejected",
			mlog.String("index", item.Index), mlog.String("doc_id", item.DocID),
			mlog.String("action", item.Action), mlog.Int("status", status), mlog.Err(err))
	}
}

// Wait blocks until every queued item is settled, or ctx ends.
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
	r.mut.Lock()
	defer r.mut.Unlock()
	r.pending = append(r.pending, retryItem{BulkItem: item})
	if !r.running {
		r.running = true
		go r.run()
	}
}

func (r *BulkRetrier) run() {
	for {
		r.mut.Lock()
		items := r.pending
		r.pending = nil
		if len(items) == 0 {
			r.running = false
			r.mut.Unlock()
			return
		}
		r.mut.Unlock()

		time.Sleep(r.backoff(items))
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

func (r *BulkRetrier) processChunk(items []retryItem) {
	ctx := context.Background()
	found, err := r.backend.Exists(ctx, items2bulk(items))
	if err != nil {
		r.logger.Warn("Bulk retry: check failed, resending all", mlog.Err(err))
	}

	for _, item := range items {
		if err == nil && isSettled(item.BulkItem, found) {
			r.verified.Add(1)
			r.inflight.Done()
			continue
		}
		r.resend(ctx, item)
	}
}

// isSettled is true when the check shows the wanted state: an indexed doc
// is there, or a deleted doc is gone. A doc missing from the answer is unknown.
func isSettled(item BulkItem, found map[string]bool) bool {
	exists, ok := found[item.Index+"/"+item.DocID]
	return ok && exists == (item.Action == "index")
}

func (r *BulkRetrier) resend(ctx context.Context, item retryItem) {
	item.attempts++
	if item.Body != nil {
		if _, err := item.Body.Seek(0, io.SeekStart); err != nil {
			r.fail(item, 0, err)
			return
		}
	}
	status, err := r.backend.Apply(ctx, item.BulkItem)

	switch {
	case status >= 200 && status < 300, item.Action == "delete" && status == http.StatusNotFound:
		r.retried.Add(1)
		r.inflight.Done()
	case status == 0 || status == http.StatusTooManyRequests || status >= http.StatusInternalServerError:
		if item.attempts >= bulkRetryMaxAttempts {
			r.logger.Error("Bulk retry: giving up on document",
				mlog.String("index", item.Index), mlog.String("doc_id", item.DocID),
				mlog.Int("attempts", item.attempts), mlog.Int("status", status), mlog.Err(err))
			r.fail(item, status, err)
			return
		}
		r.mut.Lock()
		r.pending = append(r.pending, item)
		r.mut.Unlock()
	default:
		r.fail(item, status, err)
	}
}

func (r *BulkRetrier) fail(item retryItem, status int, err error) {
	r.failed.Add(1)
	r.inflight.Done()
	r.logger.Debug("Bulk retry: document failed",
		mlog.String("index", item.Index), mlog.String("doc_id", item.DocID),
		mlog.Int("status", status), mlog.Err(err))
}

func items2bulk(items []retryItem) []BulkItem {
	out := make([]BulkItem, len(items))
	for i, item := range items {
		out[i] = item.BulkItem
	}
	return out
}
