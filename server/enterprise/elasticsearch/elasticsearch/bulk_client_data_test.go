// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/elastic/go-elasticsearch/v8/esutil"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/stretchr/testify/require"
)

// setupDataBulkClient creates a test data bulk client with common setup
func setupDataBulkClient(t *testing.T, flushBytes int, flushInterval time.Duration) (*DataBulkClient, *api4.TestHelper) {
	th := api4.SetupEnterprise(t)

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	bulkClient, err := NewDataBulkClient(
		common.BulkSettings{
			FlushBytes:    flushBytes,
			FlushInterval: flushInterval,
			FlushNumReqs:  0, // DataBulkClient doesn't support FlushNumReqs
		},
		client,
		time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
		th.Server.Platform().Log())
	require.NoError(t, err)

	return bulkClient, th
}

func flushAndGetStats(t *testing.T, b *DataBulkClient) esutil.BulkIndexerStats {
	t.Helper()

	// Close the indexer to flush
	err := b.indexer.Close(context.Background())
	require.NoError(t, err)

	// Get the stats
	stats := b.indexer.Stats()

	// Restart the indexer
	newIdxr, err := newIndexer(b.client, b.bulkSettings, b.logger)
	require.NoError(t, err)
	b.indexer = newIdxr

	return stats
}

func TestDataIndexOp(t *testing.T) {
	t.Run("single index operation", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()
		t.Cleanup(func() {
			err := bulkClient.Stop()
			require.NoError(t, err)
		})

		post := createTestPost(t, "test message")

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)

		// Check that the request got added
		stats := bulkClient.indexer.Stats()
		require.Equal(t, 1, int(stats.NumAdded))
		require.Equal(t, 0, int(stats.NumIndexed))

		// Flush, and check that the document was indexed
		stats = flushAndGetStats(t, bulkClient)
		require.Equal(t, 1, int(stats.NumIndexed))
	})

	t.Run("multiple index operations", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()
		t.Cleanup(func() {
			err := bulkClient.Stop()
			require.NoError(t, err)
		})

		for range 5 {
			post := createTestPost(t, "test message")
			err := bulkClient.IndexOp(types.IndexOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(post.Id),
			}, post)
			require.NoError(t, err)
		}

		// Check that the requests got added
		stats := bulkClient.indexer.Stats()
		require.Equal(t, 5, int(stats.NumAdded))

		// Flush, and check that the documents were indexed
		stats = flushAndGetStats(t, bulkClient)
		require.Equal(t, 5, int(stats.NumIndexed))
	})

	t.Run("index operation with json.RawMessage", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()
		t.Cleanup(func() {
			err := bulkClient.Stop()
			require.NoError(t, err)
		})

		docId := model.NewId()
		jsonData := []byte(`{"message": "test raw message"}`)

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(docId),
		}, jsonData)
		require.NoError(t, err)

		// Check that the request got added
		stats := bulkClient.indexer.Stats()
		require.Equal(t, 1, int(stats.NumAdded))

		// Flush, and check that the document was indexed
		stats = flushAndGetStats(t, bulkClient)
		require.Equal(t, 1, int(stats.NumIndexed))
	})

	t.Run("index operation with byte slice", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()
		t.Cleanup(func() {
			err := bulkClient.Stop()
			require.NoError(t, err)
		})

		docId := model.NewId()
		data := []byte(`{"message": "test byte slice"}`)

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(docId),
		}, data)
		require.NoError(t, err)

		// Check that the request got added
		stats := bulkClient.indexer.Stats()
		require.Equal(t, 1, int(stats.NumAdded))

		// Flush, and check that the document was indexed
		stats = flushAndGetStats(t, bulkClient)
		require.Equal(t, 1, int(stats.NumIndexed))
	})
}

func TestDataDeleteOp(t *testing.T) {
	t.Run("single delete operation", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()
		t.Cleanup(func() {
			err := bulkClient.Stop()
			require.NoError(t, err)
		})

		// Index a new post and flush
		post := createTestPost(t, "test message")
		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)

		require.NoError(t, bulkClient.Flush())

		err = bulkClient.DeleteOp(types.DeleteOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		})
		require.NoError(t, err)

		// Check that the request got added
		stats := bulkClient.indexer.Stats()
		require.Equal(t, 1, int(stats.NumAdded))
		require.Equal(t, 0, int(stats.NumDeleted))

		// Flush, and check that the document was deleted
		stats = flushAndGetStats(t, bulkClient)
		fmt.Println(stats)
		require.Equal(t, 1, int(stats.NumDeleted))
	})

	t.Run("multiple delete operations", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()
		t.Cleanup(func() {
			err := bulkClient.Stop()
			require.NoError(t, err)
		})

		posts := make([]string, 3)

		// Index three new posts and flush
		for i := range 3 {
			post := createTestPost(t, "test message")
			err := bulkClient.IndexOp(types.IndexOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(post.Id),
			}, post)
			require.NoError(t, err)
			posts[i] = post.Id
		}
		require.NoError(t, bulkClient.Flush())

		for _, id := range posts {
			err := bulkClient.DeleteOp(types.DeleteOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(id),
			})
			require.NoError(t, err)
		}

		// Check that the requests got added
		stats := bulkClient.indexer.Stats()
		require.Equal(t, 3, int(stats.NumAdded))
		require.Equal(t, 0, int(stats.NumDeleted))

		// Flush, and check that the documents were deleted
		stats = flushAndGetStats(t, bulkClient)
		fmt.Println(stats)
		require.Equal(t, 3, int(stats.NumDeleted))
	})
}

func TestDataFlush(t *testing.T) {
	t.Run("flush with pending operations", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()
		t.Cleanup(func() {
			err := bulkClient.Stop()
			require.NoError(t, err)
		})

		post := createTestPost(t, "test message")

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)

		err = bulkClient.Flush()
		require.NoError(t, err)
	})

	t.Run("flush with no pending operations", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()
		t.Cleanup(func() {
			err := bulkClient.Stop()
			require.NoError(t, err)
		})

		err := bulkClient.Flush()
		require.NoError(t, err)
	})
}

func TestDataStop(t *testing.T) {
	t.Run("stop with pending operations", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()

		post := createTestPost(t, "test message")

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)

		err = bulkClient.Stop()
		require.NoError(t, err)
	})

	t.Run("stop with no pending operations", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 0) // 1MB flush threshold
		defer th.TearDown()

		err := bulkClient.Stop()
		require.NoError(t, err)
	})

	t.Run("stop with periodic flusher", func(t *testing.T) {
		bulkClient, th := setupDataBulkClient(t, 1024*1024, 100*time.Millisecond)
		defer th.TearDown()

		post := createTestPost(t, "test message")

		err := bulkClient.IndexOp(types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)

		// Stop should flush pending operations and stop the periodic flusher
		err = bulkClient.Stop()
		require.NoError(t, err)
	})
}

func TestDataNewDataBulkClient(t *testing.T) {
	th := api4.SetupEnterprise(t)
	defer th.TearDown()

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())

	t.Run("valid configuration", func(t *testing.T) {
		bulkClient, err := NewDataBulkClient(
			common.BulkSettings{
				FlushBytes:    1024,
				FlushInterval: 100 * time.Millisecond,
				FlushNumReqs:  0,
			},
			client,
			time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
			th.Server.Platform().Log())
		require.NoError(t, err)
		require.NotNil(t, bulkClient)

		err = bulkClient.Stop()
		require.NoError(t, err)
	})

	t.Run("invalid configuration with FlushNumReqs", func(t *testing.T) {
		bulkClient, err := NewDataBulkClient(
			common.BulkSettings{
				FlushBytes:    1024,
				FlushInterval: 100 * time.Millisecond,
				FlushNumReqs:  10, // This should cause an error
			},
			client,
			time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
			th.Server.Platform().Log())
		require.Error(t, err)
		require.Nil(t, bulkClient)
		require.Contains(t, err.Error(), "DataBulkClient does not support a threshold on number of requests")
	})
}
