// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

func newTestBackend(t *testing.T, h http.HandlerFunc) *bulkBackend {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Elastic-Product", "Elasticsearch") // the client checks this
		h(w, r)
	}))
	t.Cleanup(ts.Close)

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ElasticsearchSettings.ConnectionURL = model.NewPointer(ts.URL)
	cfg.ElasticsearchSettings.Sniff = model.NewPointer(false)

	client, appErr := createUntypedClient(mlog.CreateConsoleTestLogger(t), cfg, nil)
	require.Nil(t, appErr)
	return &bulkBackend{client: client}
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
