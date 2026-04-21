// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"io"
	"time"

	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"

	"github.com/elastic/go-elasticsearch/v8/esutil"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type ElasticsearchIndexerInterfaceImpl struct {
	Server        *app.Server
	bulkProcessor esutil.BulkIndexer
}

func (esi *ElasticsearchIndexerInterfaceImpl) MakeWorker() model.Worker {
	const workerName = "EnterpriseElasticsearchIndexer"

	// Initializing logger
	logger := esi.Server.Jobs.Logger().With(mlog.String("worker_name", workerName))

	// Creating the client
	client, appErr := createUntypedClient(logger, esi.Server.Jobs.Config(), esi.Server.Platform().FileBackend())
	if appErr != nil {
		logger.Error("Worker: Failed to Create Client", mlog.Err(appErr))
		return nil
	}

	return common.NewIndexerWorker(workerName, model.ElasticsearchSettingsESBackend,
		esi.Server.Jobs,
		logger,
		esi.Server.Platform().FileBackend(), esi.Server.License,
		func() error {
			// Creating the bulk indexer from the client.
			biCfg := esutil.BulkIndexerConfig{
				Client: client,
				OnError: func(_ context.Context, err error) {
					logger.Error("Error from elasticsearch bulk indexer", mlog.Err(err))
				},
				Timeout:    time.Duration(*esi.Server.Jobs.Config().ElasticsearchSettings.RequestTimeoutSeconds) * time.Second,
				NumWorkers: common.NumIndexWorkers(),
			}
			if *esi.Server.Jobs.Config().ElasticsearchSettings.Trace == "all" {
				biCfg.DebugLogger = common.NewBulkIndexerLogger(logger, workerName)
			}
			var err error
			esi.bulkProcessor, err = esutil.NewBulkIndexer(biCfg)
			return err
		},
		// Function to add an item in the bulk processor
		func(indexName, indexOp, docID string, body io.ReadSeeker) error {
			return esi.bulkProcessor.Add(context.Background(), esutil.BulkIndexerItem{
				Index:      indexName,
				Action:     indexOp,
				DocumentID: docID,
				Body:       body,
				OnFailure: func(_ context.Context, item esutil.BulkIndexerItem, resp esutil.BulkIndexerResponseItem, err error) {
					logger.Error("Bulk indexer: failed to index document",
						mlog.String("index", item.Index),
						mlog.String("doc_id", item.DocumentID),
						mlog.String("action", item.Action),
						mlog.String("error_type", resp.Error.Type),
						mlog.String("error_reason", resp.Error.Reason),
						mlog.Err(err),
					)
				},
			})
		},
		// Closing the bulk processor and returning the number of failed items.
		func() (int64, error) {
			err := esi.bulkProcessor.Close(context.Background())
			stats := esi.bulkProcessor.Stats()
			fields := []mlog.Field{
				mlog.Uint("num_indexed", stats.NumIndexed),
				mlog.Uint("num_failed", stats.NumFailed),
				mlog.Uint("num_added", stats.NumAdded),
				mlog.Uint("num_flushed", stats.NumFlushed),
			}
			if err != nil {
				logger.Warn("Bulk indexer closed with error", append(fields, mlog.Err(err))...)
			} else {
				logger.Info("Bulk indexer closed", fields...)
			}
			return int64(stats.NumFailed), err
		})
}
