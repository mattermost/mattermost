// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"errors"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"

	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

// bulkBackend lets the retrier resend documents.
type bulkBackend struct {
	client *elasticsearch.Client
}

// Apply sends the item with the single document API.
func (b *bulkBackend) Apply(ctx context.Context, item common.BulkItem) (int, error) {
	var res *esapi.Response
	var err error
	if item.Action == "delete" {
		res, err = b.client.Delete(item.Index, item.DocID, b.client.Delete.WithContext(ctx))
	} else {
		res, err = b.client.Index(item.Index, item.Body, b.client.Index.WithDocumentID(item.DocID), b.client.Index.WithContext(ctx))
	}
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()

	if res.IsError() {
		return res.StatusCode, errors.New(res.String())
	}
	return res.StatusCode, nil
}
