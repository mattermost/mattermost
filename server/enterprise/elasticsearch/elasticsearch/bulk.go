// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"fmt"
	"time"

	elastic "github.com/elastic/go-elasticsearch/v8"
	esTypes "github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

type BulkClient interface {
	IndexOp(op esTypes.IndexOperation, doc any) error
	DeleteOp(op esTypes.DeleteOperation) error
	Flush() error
	Stop() error
}

// NewBulk returns a BulkClient, with the specific implementation depending on
// the specified thresholds in bulkSettings.
// NewBulk will return an error if bulkSettings.FlushNumReqs and
// bulkSettings.FlushBytes are both non-zero: the support of these thresholds
// by the implementations of BulkClient is mutually exclusive.
func NewBulk(bulkSettings common.BulkSettings,
	client *elastic.TypedClient,
	reqTimeout time.Duration,
	logger mlog.LoggerIFace,
) (BulkClient, error) {
	if bulkSettings.FlushBytes == 0 &&
		bulkSettings.FlushInterval == 0 &&
		bulkSettings.FlushNumReqs == 0 {
		return nil, fmt.Errorf("at least one of FlushBytes, FlushInterval or FlushNumReqs should be non-zero")
	}
	if bulkSettings.FlushBytes > 0 && bulkSettings.FlushNumReqs > 0 {
		return nil, fmt.Errorf(
			"one of bulkSettings.FlushBytes (set to %d) or bulkSettings.FlushNumReqs (set to %d) should be zero",
			bulkSettings.FlushBytes,
			bulkSettings.FlushNumReqs,
		)
	}

	var bulkClient BulkClient
	var err error
	if bulkSettings.FlushBytes > 0 {
		bulkClient, err = NewDataBulkClient(bulkSettings, client, reqTimeout, logger)
		if err != nil {
			return nil, err
		}
	} else {
		bulkClient, err = NewReqBulkClient(bulkSettings, client, reqTimeout, logger)
		if err != nil {
			return nil, err
		}
	}

	return bulkClient, nil
}
