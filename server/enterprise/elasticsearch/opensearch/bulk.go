// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
)

type Bulk struct {
	mut sync.Mutex
	buf *bytes.Buffer

	logger   mlog.LoggerIFace
	client   *opensearchapi.Client
	settings model.ElasticsearchSettings

	quitFlusher   chan struct{}
	quitFlusherWg sync.WaitGroup

	pendingRequests int
}

func NewBulk(settings model.ElasticsearchSettings,
	logger mlog.LoggerIFace,
	client *opensearchapi.Client) *Bulk {
	b := &Bulk{
		settings:    settings,
		logger:      logger,
		client:      client,
		quitFlusher: make(chan struct{}),
		buf:         &bytes.Buffer{},
	}

	b.quitFlusherWg.Add(1)
	go b.periodicFlusher()

	return b
}

// IndexOp is a helper function to add an IndexOperation to the current bulk request.
// doc argument can be a []byte, json.RawMessage or a struct.
func (r *Bulk) IndexOp(op *types.IndexOperation, doc any) error {
	r.mut.Lock()
	defer r.mut.Unlock()

	operation := types.OperationContainer{Index: op}
	header, err := json.Marshal(operation)
	if err != nil {
		return err
	}

	r.buf.Write(header)
	r.buf.Write([]byte("\n"))

	switch v := doc.(type) {
	case []byte:
		r.buf.Write(v)
	case json.RawMessage:
		r.buf.Write(v)
	default:
		body, err := json.Marshal(doc)
		if err != nil {
			return err
		}
		r.buf.Write(body)
	}

	r.buf.Write([]byte("\n"))

	return r.flushIfNecessary()
}

// DeleteOp is a helper function to add a DeleteOperation to the current bulk request.
func (r *Bulk) DeleteOp(op *types.DeleteOperation) error {
	r.mut.Lock()
	defer r.mut.Unlock()

	operation := types.OperationContainer{Delete: op}
	header, err := json.Marshal(operation)
	if err != nil {
		return err
	}

	r.buf.Write(header)
	r.buf.Write([]byte("\n"))

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

	_, err := r.client.Bulk(ctx, opensearchapi.BulkReq{
		Body: bytes.NewReader(r.buf.Bytes()),
	})
	if err != nil {
		return err
	}
	r.buf.Reset()
	r.pendingRequests = 0

	return nil
}
