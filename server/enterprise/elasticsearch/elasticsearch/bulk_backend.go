// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"

	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

// bulkBackend lets the retrier check and resend documents.
type bulkBackend struct {
	client *elasticsearch.Client
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

	res, err := b.client.Mget(bytes.NewReader(body), b.client.Mget.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.IsError() {
		return nil, errors.New(res.String())
	}

	var resp struct {
		Docs []struct {
			Index string `json:"_index"`
			ID    string `json:"_id"`
			Found bool   `json:"found"`
		} `json:"docs"`
	}
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
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
