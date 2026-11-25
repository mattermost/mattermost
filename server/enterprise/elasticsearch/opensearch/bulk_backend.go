// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"

	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

// bulkBackend lets the retrier check and resend documents.
type bulkBackend struct {
	client *opensearchapi.Client
}

// Exists asks with one _mget. Only the _index and _id are read back.
func (b *bulkBackend) Exists(ctx context.Context, items []common.BulkItem) (map[string]bool, error) {
	type doc struct {
		Index  string `json:"_index"`
		ID     string `json:"_id"`
		Source bool   `json:"_source"`
	}
	docs := make([]doc, len(items))
	for i, item := range items {
		docs[i] = doc{Index: item.Index, ID: item.DocID}
	}
	body, err := json.Marshal(map[string]any{"docs": docs})
	if err != nil {
		return nil, err
	}

	resp, err := b.client.MGet(ctx, opensearchapi.MGetReq{Body: bytes.NewReader(body)})
	if err != nil {
		return nil, err
	}

	found := make(map[string]bool, len(resp.Docs))
	for _, d := range resp.Docs {
		found[d.Index+"/"+d.ID] = d.Found
	}
	return found, nil
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
