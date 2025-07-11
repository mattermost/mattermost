// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"errors"
	"testing"
	"time"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/dyatlov/go-opengraph/opengraph/types/image"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// These tests are ran on the same store instance, so this provides easier unique, valid timestamps
var linkMetadataTimestamp int64 = 1546300800000

func getNextLinkMetadataTimestamp() int64 {
	linkMetadataTimestamp += int64(time.Hour) / (1000 * 1000)
	return linkMetadataTimestamp
}

func TestLinkMetadataStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testLinkMetadataStoreSave(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testLinkMetadataStoreGet(t, rctx, ss) })
	t.Run("Types", func(t *testing.T) { testLinkMetadataStoreTypes(t, rctx, ss) })
	t.Run("HashCollisionHandling", func(t *testing.T) { testLinkMetadataStoreHashCollisionHandling(t, rctx, ss) })
}

func testLinkMetadataStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should save item", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeImage,
			Data:      &model.PostImage{},
		}

		linkMetadata, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)
		assert.Equal(t, *metadata, *linkMetadata)
	})

	t.Run("should fail to save invalid item", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "",
			Timestamp: 0,
			Type:      "garbage",
			Data:      nil,
		}

		_, err := ss.LinkMetadata().Save(metadata)

		assert.Error(t, err)
	})

	t.Run("should save with duplicate URL and different timestamp", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeImage,
			Data:      &model.PostImage{},
		}

		_, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)

		metadata.Timestamp = getNextLinkMetadataTimestamp()

		linkMetadata, err := ss.LinkMetadata().Save(metadata)

		require.NoError(t, err)
		assert.Equal(t, *metadata, *linkMetadata)
	})

	t.Run("should save with duplicate timestamp and different URL", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeImage,
			Data:      &model.PostImage{},
		}

		_, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)

		metadata.URL = "http://example.com/another/page"

		linkMetadata, err := ss.LinkMetadata().Save(metadata)

		require.NoError(t, err)
		assert.Equal(t, *metadata, *linkMetadata)
	})

	t.Run("should save data with duplicate URL and timestamp", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeImage,
			Data:      &model.PostImage{},
		}

		linkMetadata, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)
		assert.Equal(t, &model.PostImage{}, linkMetadata.Data)

		newData := &model.PostImage{Height: 10, Width: 20}
		metadata.Data = newData

		linkMetadata, err = ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)
		assert.Equal(t, newData, linkMetadata.Data)

		// Should return the original result, not the duplicate one
		linkMetadata, err = ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)
		require.NoError(t, err)
		assert.Equal(t, newData, linkMetadata.Data)
	})
}

func testLinkMetadataStoreGet(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should get value", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeImage,
			Data:      &model.PostImage{},
		}

		_, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)

		linkMetadata, err := ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)

		require.NoError(t, err)
		require.IsType(t, metadata, linkMetadata)
		assert.Equal(t, *metadata, *linkMetadata)
	})

	t.Run("should return not found with incorrect URL", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeImage,
			Data:      &model.PostImage{},
		}

		_, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)

		_, err = ss.LinkMetadata().Get("http://example.com/another_page", metadata.Timestamp)

		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.True(t, errors.As(err, &nfErr))
	})

	t.Run("should return not found with incorrect timestamp", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeImage,
			Data:      &model.PostImage{},
		}

		_, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)

		_, err = ss.LinkMetadata().Get(metadata.URL, getNextLinkMetadataTimestamp())

		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.True(t, errors.As(err, &nfErr))
	})
}

func testLinkMetadataStoreTypes(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should save and get image metadata", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeImage,
			Data: &model.PostImage{
				Width:  123,
				Height: 456,
			},
		}

		received, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)

		require.IsType(t, &model.PostImage{}, received.Data)
		assert.Equal(t, *(metadata.Data.(*model.PostImage)), *(received.Data.(*model.PostImage)))

		received, err = ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)
		require.NoError(t, err)

		require.IsType(t, &model.PostImage{}, received.Data)
		assert.Equal(t, *(metadata.Data.(*model.PostImage)), *(received.Data.(*model.PostImage)))
	})

	t.Run("should save and get opengraph data", func(t *testing.T) {
		og := &opengraph.OpenGraph{
			URL: "http://example.com",
			Images: []*image.Image{
				{
					URL: "http://example.com/image.png",
				},
			},
		}

		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeOpengraph,
			Data:      og,
		}

		received, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)

		require.IsType(t, &opengraph.OpenGraph{}, received.Data)
		assert.Equal(t, *(metadata.Data.(*opengraph.OpenGraph)), *(received.Data.(*opengraph.OpenGraph)))

		received, err = ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)
		require.NoError(t, err)

		require.IsType(t, &opengraph.OpenGraph{}, received.Data)
		assert.Equal(t, *(metadata.Data.(*opengraph.OpenGraph)), *(received.Data.(*opengraph.OpenGraph)))
	})

	t.Run("should save and get nil", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LinkMetadataTypeNone,
			Data:      nil,
		}

		received, err := ss.LinkMetadata().Save(metadata)
		require.NoError(t, err)
		assert.Nil(t, received.Data)

		received, err = ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)
		require.NoError(t, err)

		require.Nil(t, received.Data)
	})
}

func testLinkMetadataStoreHashCollisionHandling(t *testing.T, rctx request.CTX, ss store.Store) {
	testTimestamp := int64(1640995200000) // 2022-01-01 00:00:00 UTC
	url1 := "http://test.com/w4xg6hpvomau9j5iz371"
	url2 := "http://collision.comupio5zw28x1m36c"

	hash1 := model.GenerateLinkMetadataHash(url1, testTimestamp)
	hash2 := model.GenerateLinkMetadataHash(url2, testTimestamp)
	assert.Equal(t, hash1, hash2, "URLs should have colliding hashes")

	metadata1 := &model.LinkMetadata{
		URL:       url1,
		Timestamp: testTimestamp,
		Type:      model.LinkMetadataTypeOpengraph,
		Data:      &opengraph.OpenGraph{Title: "First URL Title"},
	}
	_, err := ss.LinkMetadata().Save(metadata1)
	require.NoError(t, err)

	retrieved, err := ss.LinkMetadata().Get(url1, testTimestamp)
	require.NoError(t, err)
	assert.Equal(t, url1, retrieved.URL)
	assert.Equal(t, "First URL Title", retrieved.Data.(*opengraph.OpenGraph).Title)

	metadata2 := &model.LinkMetadata{
		URL:       url2,
		Timestamp: testTimestamp,
		Type:      model.LinkMetadataTypeOpengraph,
		Data:      &opengraph.OpenGraph{Title: "Second URL Title"},
	}
	_, err = ss.LinkMetadata().Save(metadata2)
	require.NoError(t, err)

	retrieved, err = ss.LinkMetadata().Get(url2, testTimestamp)
	require.NoError(t, err)
	assert.Equal(t, url2, retrieved.URL)
	assert.Equal(t, "Second URL Title", retrieved.Data.(*opengraph.OpenGraph).Title)

	_, err = ss.LinkMetadata().Get(url1, testTimestamp)
	require.Error(t, err)
	var nfErr *store.ErrNotFound
	assert.True(t, errors.As(err, &nfErr))
}
