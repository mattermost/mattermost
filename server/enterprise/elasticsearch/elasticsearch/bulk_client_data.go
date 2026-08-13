// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

	elastic "github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esutil"
	esTypes "github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

// DataBulkClient is an Elasticsearch bulk client based on the
// go-elasticsearch/v8/esutil.BulkIndexer type.
// It supports time- and size-based thresholds, but not a threshold on number
// of requests.
type DataBulkClient struct {
	mut sync.Mutex

	indexer      esutil.BulkIndexer
	client       *elastic.TypedClient
	bulkSettings common.BulkSettings
	reqTimeout   time.Duration
	logger       mlog.LoggerIFace
}

func NewDataBulkClient(bulkSettings common.BulkSettings,
	client *elastic.TypedClient,
	reqTimeout time.Duration,
	logger mlog.LoggerIFace,
) (*DataBulkClient, error) {
	if bulkSettings.FlushNumReqs > 0 {
		return nil, fmt.Errorf("DataBulkClient does not support a threshold on number of requests")
	}

	indexer, err := newIndexer(client, bulkSettings, logger)
	if err != nil {
		return nil, err
	}

	return &DataBulkClient{
		indexer:      indexer,
		client:       client,
		bulkSettings: bulkSettings,
		reqTimeout:   reqTimeout,
		logger:       logger,
	}, nil
}

func newIndexer(client *elastic.TypedClient, bulkSettings common.BulkSettings, logger mlog.LoggerIFace) (esutil.BulkIndexer, error) {
	// A zeroed FlushInterval means that there should be no time-based flush,
	// but esutil.BulkIndexer defaults to 30 seconds if the interval is zero,
	// so we pick a large enough interval
	interval := bulkSettings.FlushInterval
	if interval == 0 {
		interval = 1 * time.Hour
	}

	return esutil.NewBulkIndexer(esutil.BulkIndexerConfig{
		FlushBytes:    bulkSettings.FlushBytes,
		FlushInterval: interval,
		Client:        client,
		OnError: func(ctx context.Context, err error) {
			logger.Error("indexer error", mlog.Err(err))
		},
		OnFlushStart: func(ctx context.Context) context.Context {
			logger.Debug("elasticsearch bulk indexer flush started")
			return ctx
		},
		OnFlushEnd: func(context.Context) {
			logger.Debug("elasticsearch bulk indexer flush ended")
		},
	})
}

func (b *DataBulkClient) onSuccess(_ context.Context, item esutil.BulkIndexerItem, _ esutil.BulkIndexerResponseItem) {
	b.logger.Info("successfully added new bulk operation",
		mlog.String("action", item.Action),
		mlog.String("index", item.Index),
		mlog.String("document_id", item.DocumentID),
	)
}

func (b *DataBulkClient) onFailure(_ context.Context, item esutil.BulkIndexerItem, _ esutil.BulkIndexerResponseItem, err error) {
	b.logger.Info("failed to add new bulk operation",
		mlog.String("action", item.Action),
		mlog.String("index", item.Index),
		mlog.String("document_id", item.DocumentID),
		mlog.Err(err),
	)
}

func (b *DataBulkClient) IndexOp(op esTypes.IndexOperation, doc any) error {
	b.mut.Lock()
	defer b.mut.Unlock()

	var bodyReader io.ReadSeeker
	switch v := doc.(type) {
	case []byte:
		bodyReader = bytes.NewReader(v)
	case json.RawMessage:
		bodyReader = bytes.NewReader(v)
	default:
		body, err := json.Marshal(doc)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(body)
	}

	ctx, cancel := context.WithTimeout(context.Background(), b.reqTimeout)
	defer cancel()

	return b.indexer.Add(ctx, esutil.BulkIndexerItem{
		Index:      *op.Index_,
		Action:     "index",
		DocumentID: *op.Id_,
		Body:       bodyReader,
		OnSuccess:  b.onSuccess,
		OnFailure:  b.onFailure,
	})
}
func (b *DataBulkClient) DeleteOp(op esTypes.DeleteOperation) error {
	b.mut.Lock()
	defer b.mut.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), b.reqTimeout)
	defer cancel()

	return b.indexer.Add(ctx, esutil.BulkIndexerItem{
		Index:      *op.Index_,
		Action:     "delete",
		DocumentID: *op.Id_,
		Body:       nil,
		OnSuccess:  b.onSuccess,
		OnFailure:  b.onFailure,
	})
}

func (b *DataBulkClient) _stop() error {
	ctx, cancel := context.WithTimeout(context.Background(), b.reqTimeout)
	defer cancel()

	return b.indexer.Close(ctx)
}

func (b *DataBulkClient) Flush() error {
	b.mut.Lock()
	defer b.mut.Unlock()

	// The esutil.BulkIndexer cannot be manually flushed, but it can be closed,
	// which does flush all the contents.
	if err := b._stop(); err != nil {
		return fmt.Errorf("failed to close the BulkIndexer: %w", err)
	}

	// But calling Close essentially kills all the running processes, so we have
	// to create a new one in order to restart it
	indexer, err := newIndexer(b.client, b.bulkSettings, b.logger)
	if err != nil {
		return fmt.Errorf("failed to restart the BulkIndexer: %w", err)
	}
	b.indexer = indexer

	return nil
}

func (b *DataBulkClient) Stop() error {
	b.mut.Lock()
	defer b.mut.Unlock()

	b.logger.Info("Stopping Bulk processor")

	return b._stop()
}
