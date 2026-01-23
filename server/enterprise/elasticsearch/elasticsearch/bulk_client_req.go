// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"fmt"
	"sync"
	"time"

	elastic "github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/typedapi/core/bulk"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

// ReqBulkClient is an Elasticsearch bulk client based on the
// go-elasticsearch/v8/typedapi/code/bulk.Bulk type.
// It supports time- and number-of-requests-based thresholds, but not a
// threshold on the size of the request.
type ReqBulkClient struct {
	mut sync.Mutex

	indexer      *bulk.Bulk
	client       *elastic.TypedClient
	bulkSettings common.BulkSettings
	reqTimeout   time.Duration
	logger       mlog.LoggerIFace

	quitFlusher     chan struct{}
	quitFlusherWg   sync.WaitGroup
	pendingRequests int
}

func NewReqBulkClient(bulkSettings common.BulkSettings,
	client *elastic.TypedClient,
	reqTimeout time.Duration,
	logger mlog.LoggerIFace,
) (*ReqBulkClient, error) {
	if bulkSettings.FlushBytes > 0 {
		return nil, fmt.Errorf("BulkClientBasic does not support a threshold on bytes")
	}

	b := &ReqBulkClient{
		indexer:      client.Bulk(),
		client:       client,
		bulkSettings: bulkSettings,
		reqTimeout:   reqTimeout,
		logger:       logger,

		quitFlusher: make(chan struct{}),
	}

	if bulkSettings.FlushInterval > 0 {
		b.quitFlusherWg.Add(1)
		go b.periodicFlusher()
	}

	return b, nil
}

// IndexOp is a helper function to add an IndexOperation to the current bulk request.
// doc argument can be a []byte, json.RawMessage or a struct.
func (r *ReqBulkClient) IndexOp(op types.IndexOperation, doc any) error {
	r.mut.Lock()
	defer r.mut.Unlock()

	if err := r.indexer.IndexOp(op, doc); err != nil {
		return err
	}

	return r.flushIfNecessary()
}

// DeleteOp is a helper function to add a DeleteOperation to the current bulk request.
func (r *ReqBulkClient) DeleteOp(op types.DeleteOperation) error {
	r.mut.Lock()
	defer r.mut.Unlock()

	if err := r.indexer.DeleteOp(op); err != nil {
		return err
	}

	return r.flushIfNecessary()
}

// flushIfNecessary flushes the pending buffer if needed.
// It MUST be called with an already acquired mutex.
func (r *ReqBulkClient) flushIfNecessary() error {
	r.pendingRequests++

	// Check number of requests threshold, only if specified
	if r.bulkSettings.FlushNumReqs > 0 {
		if r.pendingRequests > r.bulkSettings.FlushNumReqs {
			return r._flush()
		}
	}

	return nil
}

func (r *ReqBulkClient) Stop() error {
	r.mut.Lock()
	defer r.mut.Unlock()

	r.logger.Info("Stopping Bulk processor")

	if r.pendingRequests > 0 {
		return r._flush()
	}

	if r.bulkSettings.FlushInterval > 0 {
		close(r.quitFlusher)
		r.quitFlusherWg.Wait()
	}

	return nil
}

func (r *ReqBulkClient) periodicFlusher() {
	defer r.quitFlusherWg.Done()

	for {
		select {
		case <-time.After(r.bulkSettings.FlushInterval):
			r.mut.Lock()
			if r.pendingRequests > 0 {
				if err := r._flush(); err != nil {
					r.logger.Warn("Error flushing live indexing buffer", mlog.Err(err))
				}
			}
			r.mut.Unlock()
		case <-r.quitFlusher:
			return
		}
	}
}

// _flush MUST be called with an acquired lock.
func (r *ReqBulkClient) _flush() error {
	if r.pendingRequests == 0 {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), r.reqTimeout)
	defer cancel()

	_, err := r.indexer.Do(ctx)
	if err != nil {
		return err
	}
	r.pendingRequests = 0

	return nil
}

func (r *ReqBulkClient) Flush() error {
	r.mut.Lock()
	defer r.mut.Unlock()

	return r._flush()
}
