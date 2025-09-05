// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/stretchr/testify/require"
)

// setupBulkClient creates a test bulk client with common setup
func setupBulkClient(t *testing.T, flushBytes int, flushNumReqs int, flushInterval time.Duration) (*Bulk, *api4.TestHelper) {
	th := api4.SetupEnterprise(t)

	if os.Getenv("IS_CI") == "true" {
		os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://opensearch:9201")
		os.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", "opensearch")
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		if os.Getenv("IS_CI") == "true" {
			*cfg.ElasticsearchSettings.ConnectionURL = "http://opensearch:9201"
		} else {
			*cfg.ElasticsearchSettings.ConnectionURL = "http://localhost:9201"
		}
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsOSBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
	})

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	bulk := NewBulk(
		common.BulkSettings{
			FlushBytes:    flushBytes,
			FlushInterval: flushInterval,
			FlushNumReqs:  flushNumReqs,
		},
		client,
		time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
		th.Server.Platform().Log())

	return bulk, th
}

// createTestPost creates a test post for indexing
func createTestPost(t *testing.T, message string) *common.ESPost {
	post, err := common.ESPostFromPost(&model.Post{
		Id:      model.NewId(),
		Message: message,
	}, "myteam")
	require.NoError(t, err)
	return post
}

func TestBulkProcessor(t *testing.T) {
	bulk, th := setupBulkClient(t, 0, 10, 0)
	defer th.TearDown()
	defer func() {
		if os.Getenv("IS_CI") == "true" {
			os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
			os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
		}
	}()

	post := createTestPost(t, "hello world")

	err := bulk.IndexOp(&types.IndexOperation{
		Index_: model.NewPointer("myindex"),
		Id_:    model.NewPointer(post.Id),
	}, post)
	require.NoError(t, err)

	require.Equal(t, 1, bulk.pendingRequests)

	err = bulk.Stop()
	require.NoError(t, err)

	require.Equal(t, 0, bulk.pendingRequests)
}

func TestNewBulk(t *testing.T) {
	bulk, th := setupBulkClient(t, 1024, 10, 0)
	defer th.TearDown()
	defer func() {
		if os.Getenv("IS_CI") == "true" {
			os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
			os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
		}
	}()

	t.Run("creates bulk client without periodic flusher", func(t *testing.T) {
		require.NotNil(t, bulk)
		require.NotNil(t, bulk.client)
		require.NotNil(t, bulk.logger)
		require.NotNil(t, bulk.buf)
		require.Equal(t, 0, bulk.pendingRequests)
		require.Equal(t, 1024, bulk.bulkSettings.FlushBytes)
		require.Equal(t, 10, bulk.bulkSettings.FlushNumReqs)
	})

	t.Run("creates bulk client with periodic flusher", func(t *testing.T) {
		bulkWithTimer, th2 := setupBulkClient(t, 1024, 10, 100*time.Millisecond)
		defer th2.TearDown()
		defer func() {
			if os.Getenv("IS_CI") == "true" {
				os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
				os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
			}
		}()

		require.NotNil(t, bulkWithTimer)
		require.Equal(t, 100*time.Millisecond, bulkWithTimer.bulkSettings.FlushInterval)

		err := bulkWithTimer.Stop()
		require.NoError(t, err)
	})

	err := bulk.Stop()
	require.NoError(t, err)
}

func TestIndexOp(t *testing.T) {
	bulk, th := setupBulkClient(t, 0, 10, 0)
	defer th.TearDown()
	defer func() {
		if os.Getenv("IS_CI") == "true" {
			os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
			os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
		}
	}()

	t.Run("single index operation with struct", func(t *testing.T) {
		post := createTestPost(t, "test message")

		err := bulk.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)
		require.Equal(t, 1, bulk.pendingRequests)

		// Verify buffer has content
		require.Greater(t, bulk.buf.Len(), 0)
	})

	t.Run("index operation with []byte", func(t *testing.T) {
		initialRequests := bulk.pendingRequests
		docId := model.NewId()
		data := []byte(`{"message": "test byte slice"}`)

		err := bulk.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(docId),
		}, data)
		require.NoError(t, err)
		require.Equal(t, initialRequests+1, bulk.pendingRequests)
	})

	t.Run("index operation with json.RawMessage", func(t *testing.T) {
		initialRequests := bulk.pendingRequests
		docId := model.NewId()
		jsonData := []byte(`{"message": "test raw message"}`)

		err := bulk.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(docId),
		}, jsonData)
		require.NoError(t, err)
		require.Equal(t, initialRequests+1, bulk.pendingRequests)
	})

	t.Run("multiple index operations", func(t *testing.T) {
		initialRequests := bulk.pendingRequests

		for i := range 5 {
			post := createTestPost(t, fmt.Sprintf("test message %d", i))
			err := bulk.IndexOp(&types.IndexOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(post.Id),
			}, post)
			require.NoError(t, err)
		}

		require.Equal(t, initialRequests+5, bulk.pendingRequests)
	})

	t.Run("auto flush on request threshold", func(t *testing.T) {
		// Create a new client with low flush threshold
		bulk2, th2 := setupBulkClient(t, 0, 2, 0)
		defer th2.TearDown()
		defer func() {
			if os.Getenv("IS_CI") == "true" {
				os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
				os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
			}
		}()

		post1 := createTestPost(t, "first message")
		err := bulk2.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post1.Id),
		}, post1)
		require.NoError(t, err)
		require.Equal(t, 1, bulk2.pendingRequests)

		post2 := createTestPost(t, "second message")
		err = bulk2.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post2.Id),
		}, post2)
		require.NoError(t, err)
		require.Equal(t, 2, bulk2.pendingRequests)

		// Third operation should trigger flush
		post3 := createTestPost(t, "third message")
		err = bulk2.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post3.Id),
		}, post3)
		require.NoError(t, err)
		require.Equal(t, 0, bulk2.pendingRequests)

		err = bulk2.Stop()
		require.NoError(t, err)
	})

	err := bulk.Stop()
	require.NoError(t, err)
}

func TestDeleteOp(t *testing.T) {
	bulk, th := setupBulkClient(t, 0, 10, 0)
	defer th.TearDown()
	defer func() {
		if os.Getenv("IS_CI") == "true" {
			os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
			os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
		}
	}()

	t.Run("single delete operation", func(t *testing.T) {
		docId := model.NewId()

		err := bulk.DeleteOp(&types.DeleteOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(docId),
		})
		require.NoError(t, err)
		require.Equal(t, 1, bulk.pendingRequests)

		// Verify buffer has content
		require.Greater(t, bulk.buf.Len(), 0)
	})

	t.Run("multiple delete operations", func(t *testing.T) {
		initialRequests := bulk.pendingRequests

		for range 3 {
			docId := model.NewId()
			err := bulk.DeleteOp(&types.DeleteOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(docId),
			})
			require.NoError(t, err)
		}

		require.Equal(t, initialRequests+3, bulk.pendingRequests)
	})

	t.Run("auto flush on request threshold", func(t *testing.T) {
		// Create a new client with low flush threshold
		bulk2, th2 := setupBulkClient(t, 0, 2, 0)
		defer th2.TearDown()
		defer func() {
			if os.Getenv("IS_CI") == "true" {
				os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
				os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
			}
		}()

		// Add two delete operations
		for range 2 {
			docId := model.NewId()
			err := bulk2.DeleteOp(&types.DeleteOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(docId),
			})
			require.NoError(t, err)
		}
		require.Equal(t, 2, bulk2.pendingRequests)

		// Third operation should trigger flush
		docId := model.NewId()
		err := bulk2.DeleteOp(&types.DeleteOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(docId),
		})
		require.NoError(t, err)
		require.Equal(t, 0, bulk2.pendingRequests)

		err = bulk2.Stop()
		require.NoError(t, err)
	})

	err := bulk.Stop()
	require.NoError(t, err)
}

func TestFlush(t *testing.T) {
	bulk, th := setupBulkClient(t, 0, 10, 0)
	defer th.TearDown()
	defer func() {
		if os.Getenv("IS_CI") == "true" {
			os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
			os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
		}
	}()

	t.Run("flush with pending operations", func(t *testing.T) {
		post := createTestPost(t, "test message")

		err := bulk.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)
		require.Equal(t, 1, bulk.pendingRequests)

		err = bulk.Flush()
		require.NoError(t, err)
		require.Equal(t, 0, bulk.pendingRequests)

		// Verify buffer is empty after flush
		require.Equal(t, 0, bulk.buf.Len())
	})

	t.Run("flush with no pending operations", func(t *testing.T) {
		require.Equal(t, 0, bulk.pendingRequests)

		err := bulk.Flush()
		require.NoError(t, err)
		require.Equal(t, 0, bulk.pendingRequests)
	})

	err := bulk.Stop()
	require.NoError(t, err)
}

func TestStop(t *testing.T) {
	t.Run("stop with pending operations", func(t *testing.T) {
		bulk, th := setupBulkClient(t, 0, 10, 0)
		defer th.TearDown()
		defer func() {
			if os.Getenv("IS_CI") == "true" {
				os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
				os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
			}
		}()

		post := createTestPost(t, "test message")

		err := bulk.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)
		require.Equal(t, 1, bulk.pendingRequests)

		err = bulk.Stop()
		require.NoError(t, err)
		require.Equal(t, 0, bulk.pendingRequests)
	})

	t.Run("stop with no pending operations", func(t *testing.T) {
		bulk, th := setupBulkClient(t, 0, 10, 0)
		defer th.TearDown()
		defer func() {
			if os.Getenv("IS_CI") == "true" {
				os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
				os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
			}
		}()

		require.Equal(t, 0, bulk.pendingRequests)

		err := bulk.Stop()
		require.NoError(t, err)
		require.Equal(t, 0, bulk.pendingRequests)
	})

	t.Run("stop with periodic flusher", func(t *testing.T) {
		bulk, th := setupBulkClient(t, 0, 10, 100*time.Millisecond)
		defer th.TearDown()
		defer func() {
			if os.Getenv("IS_CI") == "true" {
				os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
				os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
			}
		}()

		post := createTestPost(t, "test message")

		err := bulk.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer("testindex"),
			Id_:    model.NewPointer(post.Id),
		}, post)
		require.NoError(t, err)
		require.Equal(t, 1, bulk.pendingRequests)

		// Stop should flush pending operations and stop the periodic flusher
		err = bulk.Stop()
		require.NoError(t, err)
		require.Equal(t, 0, bulk.pendingRequests)
	})
}

func TestFlushThresholds(t *testing.T) {
	t.Run("flush on bytes threshold", func(t *testing.T) {
		// Create a client with very small byte threshold
		bulk, th := setupBulkClient(t, 100, 0, 0) // 100 bytes threshold
		defer th.TearDown()
		defer func() {
			if os.Getenv("IS_CI") == "true" {
				os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
				os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
			}
		}()

		// Add operations that should exceed the byte threshold
		for range 5 {
			post := createTestPost(t, "This is a long message that should help us exceed the byte threshold for testing")
			err := bulk.IndexOp(&types.IndexOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(post.Id),
			}, post)
			require.NoError(t, err)
		}

		// Should have been flushed due to byte threshold
		require.Equal(t, 0, bulk.pendingRequests)

		err := bulk.Stop()
		require.NoError(t, err)
	})

	t.Run("no flush when thresholds not met", func(t *testing.T) {
		bulk, th := setupBulkClient(t, 100000, 10, 0) // High thresholds
		defer th.TearDown()
		defer func() {
			if os.Getenv("IS_CI") == "true" {
				os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
				os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
			}
		}()

		// Add a few operations that shouldn't trigger flush
		for range 3 {
			post := createTestPost(t, "short")
			err := bulk.IndexOp(&types.IndexOperation{
				Index_: model.NewPointer("testindex"),
				Id_:    model.NewPointer(post.Id),
			}, post)
			require.NoError(t, err)
			fmt.Println("PENDING REQS:", bulk.pendingRequests)
		}

		// Should not have been flushed
		require.Equal(t, 3, bulk.pendingRequests)

		err := bulk.Stop()
		require.NoError(t, err)
	})
}
