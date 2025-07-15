// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"sync"
	"time"

	elastic "github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/typedapi/core/bulk"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

type Bulk struct {
	mut sync.Mutex

	logger     mlog.LoggerIFace
	client     *elastic.TypedClient
	bulkClient *bulk.Bulk
	settings   model.ElasticsearchSettings

	quitFlusher   chan struct{}
	quitFlusherWg sync.WaitGroup

	pendingRequests int
}

func NewBulk(settings model.ElasticsearchSettings,
	logger mlog.LoggerIFace,
	client *elastic.TypedClient) *Bulk {
	b := &Bulk{
		settings:    settings,
		logger:      logger,
		client:      client,
		bulkClient:  client.Bulk(),
		quitFlusher: make(chan struct{}),
	}

	b.quitFlusherWg.Add(1)
	go b.periodicFlusher()

	return b
}

// IndexOp is a helper function to add an IndexOperation to the current bulk request.
// doc argument can be a []byte, json.RawMessage or a struct.
func (r *Bulk) IndexOp(op types.IndexOperation, doc any) error {
	r.mut.Lock()
	defer r.mut.Unlock()

	if err := r.bulkClient.IndexOp(op, doc); err != nil {
		return err
	}

	return r.flushIfNecessary()
}

// DeleteOp is a helper function to add a DeleteOperation to the current bulk request.
func (r *Bulk) DeleteOp(op types.DeleteOperation) error {
	r.mut.Lock()
	defer r.mut.Unlock()

	if err := r.bulkClient.DeleteOp(op); err != nil {
		return err
	}

	return r.flushIfNecessary()
}

// flushIfNecessary flushes the pending buffer if needed.
// It MUST be called with an already acquired mutex.
func (r *Bulk) flushIfNecessary() error {
	r.pendingRequests++

	if r.pendingRequests > *r.settings.LiveIndexingBatchSize {
		return r._flush()
	}

	return nil
}

func (r *Bulk) Stop() error {
	r.mut.Lock()
	defer r.mut.Unlock()
	r.logger.Info("Stopping Bulk processor")

	if r.pendingRequests > 0 {
		return r._flush()
	}

	close(r.quitFlusher)
	r.quitFlusherWg.Wait()

	return nil
}

func (r *Bulk) periodicFlusher() {
	defer r.quitFlusherWg.Done()

	for {
		select {
		case <-time.After(common.BulkFlushInterval):
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
func (r *Bulk) _flush() error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*r.settings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	_, err := r.bulkClient.Do(ctx)
	if err != nil {
		return err
	}
	r.pendingRequests = 0

	return nil
}
