// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/elastic/go-elasticsearch/v8/esutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

// fakeServer counts the calls of each kind. Each test sets the handlers it needs.
type fakeServer struct {
	bulk, doc   http.HandlerFunc
	bulks, docs atomic.Int64
}

func (f *fakeServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Elastic-Product", "Elasticsearch") // the client checks this
	switch {
	case strings.HasSuffix(r.URL.Path, "/_bulk"):
		f.bulks.Add(1)
		f.bulk(w, r)
	case f.doc != nil:
		f.docs.Add(1)
		f.doc(w, r)
	default:
		http.NotFound(w, r)
	}
}

// dropConnection answers 200 headers and half a body, then closes. The client sees "unexpected EOF".
func dropConnection(w http.ResponseWriter, _ *http.Request) {
	conn, buf, _ := w.(http.Hijacker).Hijack()
	_, _ = buf.WriteString("HTTP/1.1 200 OK\r\nX-Elastic-Product: Elasticsearch\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{\"took\":1,")
	_ = buf.Flush()
	_ = conn.Close()
}

func unavailable(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusServiceUnavailable)
}

func created(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write([]byte(`{"result":"created"}`))
}

// newTestIndexer wires the bulk indexer and the retrier like MakeWorker does.
func newTestIndexer(t *testing.T, f *fakeServer) (esutil.BulkIndexer, *common.BulkRetrier) {
	ts := httptest.NewServer(f)
	t.Cleanup(ts.Close)

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ElasticsearchSettings.ConnectionURL = model.NewPointer(ts.URL)
	cfg.ElasticsearchSettings.Sniff = model.NewPointer(false)

	logger := mlog.CreateConsoleTestLogger(t)
	client, appErr := createUntypedClient(logger, cfg, nil)
	require.Nil(t, appErr)

	retrier := common.NewBulkRetrier(&bulkBackend{client: client}, logger)
	retrier.Backoff = 0

	bi, err := esutil.NewBulkIndexer(esutil.BulkIndexerConfig{
		Client:     client,
		NumWorkers: 1,
		FlushBytes: 1, // one request per document
	})
	require.NoError(t, err)
	return bi, retrier
}

func add(t *testing.T, bi esutil.BulkIndexer, retrier *common.BulkRetrier, action, id string) {
	item := esutil.BulkIndexerItem{
		Index:      "posts",
		Action:     action,
		DocumentID: id,
		OnFailure:  onBulkFailure(retrier),
	}
	if action == "index" {
		item.Body = strings.NewReader(`{}`)
	}
	require.NoError(t, bi.Add(context.Background(), item))
}

// closeInTime fails the test if closing hangs.
func closeInTime(t *testing.T, bi esutil.BulkIndexer, retrier *common.BulkRetrier) int64 {
	type result struct {
		failed int64
		err    error
	}
	done := make(chan result, 1)
	go func() {
		failed, err := closeBulk(bi, retrier, mlog.CreateConsoleTestLogger(t))
		done <- result{failed, err}
	}()
	select {
	case res := <-done:
		require.NoError(t, res.err)
		return res.failed
	case <-time.After(20 * time.Second):
		require.FailNow(t, "close did not return")
		return 0
	}
}

func TestBulkWiringConnectionClosedAfter200IsResentAndNotFailed(t *testing.T) {
	f := &fakeServer{bulk: dropConnection, doc: created}
	bi, retrier := newTestIndexer(t, f)

	add(t, bi, retrier, "index", "1")

	assert.Equal(t, int64(0), closeInTime(t, bi, retrier))
	assert.Equal(t, int64(1), f.docs.Load())
}

// The ES client has no request timeout, so a timed-out _bulk shows up as a 504.
func TestBulkWiringGatewayTimeoutIsResentAndNotFailed(t *testing.T) {
	f := &fakeServer{bulk: func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusGatewayTimeout)
	}, doc: created}
	bi, retrier := newTestIndexer(t, f)

	add(t, bi, retrier, "index", "1")

	assert.Equal(t, int64(0), closeInTime(t, bi, retrier))
	assert.Equal(t, int64(1), f.docs.Load())
}

func TestBulkWiringItemRejectedByServerIsFailedAndNotResent(t *testing.T) {
	f := &fakeServer{bulk: func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"took":1,"errors":true,"items":[{"index":{"_index":"posts","_id":"1","status":400,
			"error":{"type":"mapper_parsing_exception","reason":"bad field"}}}]}`))
	}}
	bi, retrier := newTestIndexer(t, f)

	add(t, bi, retrier, "index", "1")

	assert.Equal(t, int64(1), closeInTime(t, bi, retrier))
	assert.Equal(t, int64(0), f.docs.Load())
}

func TestBulkWiringDeleteOfMissingDocIsNotFailed(t *testing.T) {
	f := &fakeServer{bulk: func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"took":1,"errors":true,"items":[{"delete":{"_index":"posts","_id":"1","status":404,"result":"not_found"}}]}`))
	}}
	bi, retrier := newTestIndexer(t, f)

	add(t, bi, retrier, "delete", "1")

	assert.Equal(t, int64(0), closeInTime(t, bi, retrier))
}

func TestBulkWiringGivesUpWhenServerKeepsFailing(t *testing.T) {
	f := &fakeServer{bulk: dropConnection, doc: unavailable}
	bi, retrier := newTestIndexer(t, f)

	add(t, bi, retrier, "index", "1")
	add(t, bi, retrier, "delete", "2")

	assert.Equal(t, int64(2), closeInTime(t, bi, retrier))
}
