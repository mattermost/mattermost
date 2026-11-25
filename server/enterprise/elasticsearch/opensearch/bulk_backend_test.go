// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

func newTestBackend(t *testing.T, h http.HandlerFunc) *bulkBackend {
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ElasticsearchSettings.ConnectionURL = model.NewPointer(ts.URL)
	cfg.ElasticsearchSettings.Sniff = model.NewPointer(false)

	client, appErr := createIndexerClient(mlog.CreateConsoleTestLogger(t), cfg, nil, 5*time.Second)
	require.Nil(t, appErr)
	return &bulkBackend{client: client}
}

func TestBulkBackendExistsReturnsFoundDocs(t *testing.T) {
	var body string
	b := newTestBackend(t, func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		body = string(raw)
		_, _ = w.Write([]byte(`{"docs":[
			{"_index":"posts_a","_id":"1","found":true},
			{"_index":"posts_b","_id":"2","found":false}]}`))
	})

	found, err := b.Exists(context.Background(), []common.BulkItem{
		{Index: "posts_a", DocID: "1"},
		{Index: "posts_b", DocID: "2"},
	})

	require.NoError(t, err)
	assert.Equal(t, map[string]bool{"posts_a/1": true, "posts_b/2": false}, found)
	assert.Contains(t, body, `"_index":"posts_a"`)
	assert.Contains(t, body, `"_source":false`)
}

func TestBulkBackendExistsSkipsDocsWithError(t *testing.T) {
	b := newTestBackend(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"docs":[
			{"_index":"posts","_id":"1","error":{"type":"shard_failure"}},
			{"_index":"posts","_id":"2","found":false}]}`))
	})

	found, err := b.Exists(context.Background(), []common.BulkItem{
		{Index: "posts", DocID: "1"},
		{Index: "posts", DocID: "2"},
	})

	require.NoError(t, err)
	assert.Equal(t, map[string]bool{"posts/2": false}, found)
}

func TestBulkBackendExistsFailsOnServerError(t *testing.T) {
	b := newTestBackend(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	})

	_, err := b.Exists(context.Background(), []common.BulkItem{{Index: "posts", DocID: "1"}})

	assert.Error(t, err)
}

func TestBulkBackendApplyIndexSendsBody(t *testing.T) {
	var method, path, body string
	b := newTestBackend(t, func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		method, path, body = r.Method, r.URL.Path, string(raw)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"result":"created"}`))
	})

	status, err := b.Apply(context.Background(), common.BulkItem{
		Index: "posts", Action: "index", DocID: "1", Body: strings.NewReader(`{"a":1}`),
	})

	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, status)
	assert.Equal(t, http.MethodPut, method)
	assert.Equal(t, "/posts/_doc/1", path)
	assert.JSONEq(t, `{"a":1}`, body)
}

func TestBulkBackendApplyDeleteSendsDelete(t *testing.T) {
	var method, path string
	b := newTestBackend(t, func(w http.ResponseWriter, r *http.Request) {
		method, path = r.Method, r.URL.Path
		_, _ = w.Write([]byte(`{"result":"deleted"}`))
	})

	status, err := b.Apply(context.Background(), common.BulkItem{Index: "posts", Action: "delete", DocID: "1"})

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, http.MethodDelete, method)
	assert.Equal(t, "/posts/_doc/1", path)
}

func TestBulkBackendApplyReturnsStatusOnHTTPError(t *testing.T) {
	b := newTestBackend(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":"too many requests","status":429}`))
	})

	status, err := b.Apply(context.Background(), common.BulkItem{
		Index: "posts", Action: "index", DocID: "1", Body: strings.NewReader(`{}`),
	})

	assert.Error(t, err)
	assert.Equal(t, http.StatusTooManyRequests, status)
}

func TestBulkBackendApplyTransportErrorIsStatusZero(t *testing.T) {
	b := newTestBackend(t, func(w http.ResponseWriter, _ *http.Request) {
		panic(http.ErrAbortHandler) // closes the connection
	})

	status, err := b.Apply(context.Background(), common.BulkItem{
		Index: "posts", Action: "index", DocID: "1", Body: strings.NewReader(`{}`),
	})

	assert.Error(t, err)
	assert.Equal(t, 0, status)
}
