// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

// setupBulkClient creates a test bulk client with common setup
func setupBulkClient(t *testing.T, flushNumReqs int, flushInterval time.Duration) *ReqBulkClient {
	th := api4.SetupEnterprise(t)

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	bulkClient, err := NewReqBulkClient(
		common.BulkSettings{
			FlushBytes:    0,
			FlushInterval: flushInterval,
			FlushNumReqs:  flushNumReqs,
		},
		client,
		time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
		th.Server.Platform().Log())
	require.NoError(t, err)

	return bulkClient
}

// createTestPost creates a test post for indexing
func createTestPost(t *testing.T, message string) *common.ESPost {
	post, err := common.ESPostFromPost(&model.Post{
		Id:      model.NewId(),
		Message: message,
	}, "myteam", "O")
	require.NoError(t, err)
	return post
}

func TestBulkProcessor(t *testing.T) {
	th := api4.SetupEnterprise(t)

	bulkClient := setupBulkClient(t, *th.App.Config().ElasticsearchSettings.LiveIndexingBatchSize, 0)

	post := createTestPost(t, "hello world")

	err := bulkClient.IndexOp(types.IndexOperation{
		Index_: model.NewPointer("myindex"),
		Id_:    model.NewPointer(post.Id),
	}, post)
	require.NoError(t, err)

	require.Equal(t, 1, bulkClient.pendingRequests)

	err = bulkClient.Stop()
	require.NoError(t, err)

	require.Equal(t, 0, bulkClient.pendingRequests)
}

func TestIndexOp(t *testing.T) {
	bulkClient := setupBulkClient(t, 10, 0)

	t.Run("single index operation", func(t *testing.T) {
		post := createTestPost(t, "test message")

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)
		require.Equal(t, 1, bulkClient.pendingRequests)
	})

	t.Run("multiple index operations", func(t *testing.T) {
		initialRequests := bulkClient.pendingRequests

		for range 5 {
			post := createTestPost(t, "test message")
			err := bulkClient.IndexOp(types.IndexOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(post.Id),
			}, post)
			require.NoError(t, err)
		}

		require.Equal(t, initialRequests+5, bulkClient.pendingRequests)
	})

	t.Run("auto flush on threshold", func(t *testing.T) {
		// Create a new client with low flush threshold
		bulkClient2 := setupBulkClient(t, 2, 0)

		post1 := createTestPost(t, "first message")
		err := bulkClient2.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post1.Id),
		}, post1)
		require.NoError(t, err)
		require.Equal(t, 1, bulkClient2.pendingRequests)

		post2 := createTestPost(t, "second message")
		err = bulkClient2.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post2.Id),
		}, post2)
		require.NoError(t, err)
		require.Equal(t, 2, bulkClient2.pendingRequests)

		// Third operation should trigger flush
		post3 := createTestPost(t, "third message")
		err = bulkClient2.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post3.Id),
		}, post3)
		require.NoError(t, err)
		require.Equal(t, 0, bulkClient2.pendingRequests)
	})
}

func TestDeleteOp(t *testing.T) {
	bulkClient := setupBulkClient(t, 10, 0)

	t.Run("single delete operation", func(t *testing.T) {
		docId := model.NewId()

		err := bulkClient.DeleteOp(types.DeleteOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(docId),
		})
		require.NoError(t, err)
		require.Equal(t, 1, bulkClient.pendingRequests)
	})

	t.Run("multiple delete operations", func(t *testing.T) {
		initialRequests := bulkClient.pendingRequests

		for range 3 {
			docId := model.NewId()
			err := bulkClient.DeleteOp(types.DeleteOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(docId),
			})
			require.NoError(t, err)
		}

		require.Equal(t, initialRequests+3, bulkClient.pendingRequests)
	})

	t.Run("auto flush on threshold", func(t *testing.T) {
		// Create a new client with low flush threshold
		bulkClient2 := setupBulkClient(t, 2, 0)

		// Add two delete operations
		for range 2 {
			docId := model.NewId()
			err := bulkClient2.DeleteOp(types.DeleteOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(docId),
			})
			require.NoError(t, err)
		}
		require.Equal(t, 2, bulkClient2.pendingRequests)

		// Third operation should trigger flush
		docId := model.NewId()
		err := bulkClient2.DeleteOp(types.DeleteOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(docId),
		})
		require.NoError(t, err)
		require.Equal(t, 0, bulkClient2.pendingRequests)
	})
}

func TestFlush(t *testing.T) {
	bulkClient := setupBulkClient(t, 10, 0)

	t.Run("flush with pending requests", func(t *testing.T) {
		post := createTestPost(t, "test message")

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)
		require.Equal(t, 1, bulkClient.pendingRequests)

		err = bulkClient.Flush()
		require.NoError(t, err)
		require.Equal(t, 0, bulkClient.pendingRequests)
	})

	t.Run("flush with no pending requests", func(t *testing.T) {
		require.Equal(t, 0, bulkClient.pendingRequests)

		err := bulkClient.Flush()
		require.NoError(t, err)
		require.Equal(t, 0, bulkClient.pendingRequests)
	})
}

func TestStop(t *testing.T) {
	t.Run("stop with pending requests", func(t *testing.T) {
		bulkClient := setupBulkClient(t, 10, 0)

		post := createTestPost(t, "test message")

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)
		require.Equal(t, 1, bulkClient.pendingRequests)

		err = bulkClient.Stop()
		require.NoError(t, err)
		require.Equal(t, 0, bulkClient.pendingRequests)
	})

	t.Run("stop with no pending requests", func(t *testing.T) {
		bulkClient := setupBulkClient(t, 10, 0)

		require.Equal(t, 0, bulkClient.pendingRequests)

		err := bulkClient.Stop()
		require.NoError(t, err)
		require.Equal(t, 0, bulkClient.pendingRequests)
	})

	t.Run("stop with periodic flusher", func(t *testing.T) {
		bulkClient := setupBulkClient(t, 10, 100*time.Millisecond)

		post := createTestPost(t, "test message")

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)
		require.Equal(t, 1, bulkClient.pendingRequests)

		// Stop should flush pending requests and stop the periodic flusher
		err = bulkClient.Stop()
		require.NoError(t, err)
		require.Equal(t, 0, bulkClient.pendingRequests)
	})
}

func TestStopShutsDownPeriodicFlusher(t *testing.T) {
	tests := []struct {
		name            string
		status          int
		wantErr         bool
		pendingRequests int
	}{
		{name: "successful pending flush", status: http.StatusOK},
		{name: "failed pending flush", status: http.StatusInternalServerError, wantErr: true, pendingRequests: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			const flushInterval = 50 * time.Millisecond
			requestStarted := make(chan struct{}, 1)
			releaseRequest := make(chan struct{})
			var releaseOnce sync.Once
			release := func() {
				releaseOnce.Do(func() { close(releaseRequest) })
			}
			t.Cleanup(release)

			bulkClient := setupReqBulkClientWithHandler(t, flushInterval, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				select {
				case requestStarted <- struct{}{}:
				default:
				}
				<-releaseRequest

				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Elastic-Product", "Elasticsearch")
				w.WriteHeader(tt.status)
				if tt.status == http.StatusOK {
					_, _ = w.Write([]byte(`{"errors":false,"items":[]}`))
					return
				}
				_, _ = w.Write([]byte(`{"error":{"type":"test_error","reason":"bulk request failed"},"status":500}`))
			}))

			post := createTestPost(t, "test message")
			err := bulkClient.IndexOp(types.IndexOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(post.Id),
			}, post)
			require.NoError(t, err)

			stopDone := make(chan error, 1)
			go func() {
				stopDone <- bulkClient.Stop()
			}()

			select {
			case <-requestStarted:
			case <-time.After(2 * time.Second):
				require.FailNow(t, "timed out waiting for final flush to start")
			}

			// Stop still holds mut while the final flush is blocked. Waiting for a
			// timer interval forces the periodic flusher to contend for that mutex.
			time.Sleep(2 * flushInterval)
			release()

			select {
			case err = <-stopDone:
			case <-time.After(2 * time.Second):
				require.FailNow(t, "Stop deadlocked while waiting for the periodic flusher")
			}

			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tt.pendingRequests, bulkClient.pendingRequests)
			assertFlusherStopped(t, bulkClient)
		})
	}
}

func setupReqBulkClientWithHandler(t *testing.T, flushInterval time.Duration, handler http.Handler) *ReqBulkClient {
	t.Helper()

	client := newTestClient(t, handler)

	bulkClient, err := NewReqBulkClient(
		common.BulkSettings{
			FlushBytes:    0,
			FlushInterval: flushInterval,
			FlushNumReqs:  10,
		},
		client,
		time.Second,
		mlog.CreateConsoleTestLogger(t))
	require.NoError(t, err)

	return bulkClient
}

func assertFlusherStopped(t *testing.T, bulkClient *ReqBulkClient) {
	t.Helper()

	select {
	case <-bulkClient.quitFlusher:
	default:
		require.Fail(t, "periodic flusher was not stopped")
	}
}
