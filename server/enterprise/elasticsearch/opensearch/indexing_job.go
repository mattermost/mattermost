// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
	"github.com/opensearch-project/opensearch-go/v4/opensearchutil"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

// createIndexerClient bounds each request attempt, since the bulk indexer
// flushes with an uncancellable context and a stalled connection would
// otherwise block its worker forever.
func createIndexerClient(logger mlog.LoggerIFace, cfg *model.Config, fileBackend filestore.FileBackend, timeout time.Duration) (*opensearchapi.Client, *model.AppError) {
	osCfg, appErr := createClientConfig(logger, cfg, fileBackend, true)
	if appErr != nil {
		return nil, appErr
	}
	osCfg.Client.RequestTimeout = timeout

	client, err := opensearchapi.NewClient(*osCfg)
	if err != nil {
		return nil, model.NewAppError("Opensearch.createIndexerClient", "ent.elasticsearch.create_client.connect_failed", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	return client, nil
}

type OpensearchIndexerInterfaceImpl struct {
	Server        *app.Server
	bulkProcessor opensearchutil.BulkIndexer
}

func (esi *OpensearchIndexerInterfaceImpl) MakeWorker() model.Worker {
	const workerName = "EnterpriseOpensearchIndexer"

	// Initializing logger
	logger := esi.Server.Jobs.Logger().With(mlog.String("worker_name", workerName))

	// Creating the client
	client, appErr := createIndexerClient(logger, esi.Server.Jobs.Config(), esi.Server.Platform().FileBackend(),
		common.BulkRequestTimeout(*esi.Server.Jobs.Config().ElasticsearchSettings.RequestTimeoutSeconds))
	if appErr != nil {
		logger.Error("Worker: Failed to Create Client", mlog.Err(appErr))
		return nil
	}

	// Set per job, so the counts start from zero.
	var retrier *common.BulkRetrier

	return common.NewIndexerWorker(workerName, model.ElasticsearchSettingsOSBackend,
		esi.Server.Jobs,
		logger,
		esi.Server.Platform().FileBackend(),
		esi.Server.License,
		func() error {
			retrier = common.NewBulkRetrier(&bulkBackend{client: client}, logger)

			// Creating the bulk indexer from the client.
			biCfg := opensearchutil.BulkIndexerConfig{
				Client: client,
				OnError: func(_ context.Context, err error) {
					logger.Error("Error from opensearch bulk indexer", mlog.Err(err))
				},
				Timeout:    common.BulkRequestTimeout(*esi.Server.Jobs.Config().ElasticsearchSettings.RequestTimeoutSeconds),
				NumWorkers: common.NumIndexWorkers(),
			}
			if *esi.Server.Jobs.Config().ElasticsearchSettings.Trace == "all" {
				biCfg.DebugLogger = common.NewBulkIndexerLogger(logger, workerName)
			}
			var err error
			esi.bulkProcessor, err = opensearchutil.NewBulkIndexer(biCfg)
			return err
		},
		// Function to add an item in the bulk processor
		func(indexName, indexOp, docID string, body io.ReadSeeker) error {
			return esi.bulkProcessor.Add(context.Background(), opensearchutil.BulkIndexerItem{
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
