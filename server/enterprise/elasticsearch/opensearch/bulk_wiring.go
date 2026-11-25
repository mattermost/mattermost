// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"context"
	"fmt"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
	"github.com/opensearch-project/opensearch-go/v4/opensearchutil"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

type onFailureFunc func(context.Context, opensearchutil.BulkIndexerItem, opensearchapi.BulkRespItem, error)

// onBulkFailure gives every failed item to the retrier.
func onBulkFailure(retrier *common.BulkRetrier) onFailureFunc {
	return func(_ context.Context, item opensearchutil.BulkIndexerItem, resp opensearchapi.BulkRespItem, err error) {
		if err == nil && resp.Error != nil {
			err = fmt.Errorf("%s: %s", resp.Error.Type, resp.Error.Reason)
		}
		retrier.Handle(common.BulkItem{
			Index:  item.Index,
			Action: item.Action,
			DocID:  item.DocumentID,
			Body:   item.Body,
		}, resp.Status, err)
	}
}

// closeBulk closes the indexer, waits for the retries, and counts the failed items.
func closeBulk(bi opensearchutil.BulkIndexer, retrier *common.BulkRetrier, logger mlog.LoggerIFace) (int64, error) {
	// Close first: its last flush can still hand items to the retrier.
	err := bi.Close(context.Background())
	_ = retrier.Wait(context.Background())

	stats := bi.Stats()
	fields := []mlog.Field{
		mlog.Uint("num_indexed", stats.NumIndexed),
		mlog.Int("num_failed", retrier.Failed()),
		mlog.Int("num_retried", retrier.Retried()),
		mlog.Int("num_verified", retrier.Verified()),
		mlog.Uint("stats_num_failed", stats.NumFailed),
		mlog.Uint("num_added", stats.NumAdded),
		mlog.Uint("num_flushed", stats.NumFlushed),
	}
	if err != nil {
		logger.Warn("Bulk indexer closed with error", append(fields, mlog.Err(err))...)
	} else {
		logger.Info("Bulk indexer closed", fields...)
	}
	return retrier.Failed(), err
}
