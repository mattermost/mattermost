// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"io"

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

	// Set per job, so the counts start from zero.
	var retrier *common.BulkRetrier

	return common.NewIndexerWorker(workerName, model.ElasticsearchSettingsESBackend,
		esi.Server.Jobs,
		logger,
		esi.Server.Platform().FileBackend(), esi.Server.License,
		func() error {
			retrier = common.NewBulkRetrier(&bulkBackend{client: client}, logger)

			// Creating the bulk indexer from the client.
			biCfg := esutil.BulkIndexerConfig{
				Client: client,
				OnError: func(_ context.Context, err error) {
					logger.Error("Error from elasticsearch bulk indexer", mlog.Err(err))
				},
				Timeout:    common.BulkRequestTimeout(*esi.Server.Jobs.Config().ElasticsearchSettings.RequestTimeoutSeconds),
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
				OnFailure:  onBulkFailure(retrier),
			})
		},
		// Closing the bulk processor and returning the number of failed items.
		func() (int64, error) {
			return closeBulk(esi.bulkProcessor, retrier, logger)
		})
}
