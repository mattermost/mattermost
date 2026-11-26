// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"context"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"

	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

// bulkBackend lets the retrier resend documents.
type bulkBackend struct {
	client *opensearchapi.Client
}

// Apply sends the item with the single document API.
func (b *bulkBackend) Apply(ctx context.Context, item common.BulkItem) (int, error) {
	var inspect opensearchapi.Inspect
	var err error
	if item.Action == "delete" {
		var resp *opensearchapi.DocumentDeleteResp
		resp, err = b.client.Document.Delete(ctx, opensearchapi.DocumentDeleteReq{Index: item.Index, DocumentID: item.DocID})
		inspect = resp.Inspect()
	} else {
		var resp *opensearchapi.IndexResp
		resp, err = b.client.Index(ctx, opensearchapi.IndexReq{Index: item.Index, DocumentID: item.DocID, Body: item.Body})
		inspect = resp.Inspect()
	}

	if inspect.Response == nil {
		return 0, err
	}
	return inspect.Response.StatusCode, err
}
