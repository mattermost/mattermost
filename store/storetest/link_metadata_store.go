// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"net/http"
	"testing"
	"time"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests are ran on the same store instance, so this provides easier unique, valid timestamps
var linkMetadataTimestamp int64 = 1546300800000

func getNextLinkMetadataTimestamp() int64 {
	linkMetadataTimestamp += int64(time.Hour) / 1000
	return linkMetadataTimestamp
}

func TestLinkMetadataStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testLinkMetadataStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testLinkMetadataStoreGet(t, ss) })
	t.Run("Types", func(t *testing.T) { testLinkMetadataStoreTypes(t, ss) })
}

func testLinkMetadataStoreSave(t *testing.T, ss store.Store) {
	t.Run("should save item", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_IMAGE,
			Data:      &model.PostImage{},
		}

		result := <-ss.LinkMetadata().Save(metadata)

		require.Nil(t, result.Err)
		require.IsType(t, metadata, result.Data)
		assert.Equal(t, *metadata, *result.Data.(*model.LinkMetadata))
	})

	t.Run("should fail to save invalid item", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "",
			Timestamp: 0,
			Type:      "garbage",
			Data:      nil,
		}

		result := <-ss.LinkMetadata().Save(metadata)

		assert.NotNil(t, result.Err)
	})

	t.Run("should save with duplicate URL and different timestamp", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_IMAGE,
			Data:      &model.PostImage{},
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		metadata.Timestamp = getNextLinkMetadataTimestamp()

		result = <-ss.LinkMetadata().Save(metadata)

		require.Nil(t, result.Err)
		require.IsType(t, metadata, result.Data)
		assert.Equal(t, *metadata, *result.Data.(*model.LinkMetadata))
	})

	t.Run("should save with duplicate timestamp and different URL", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_IMAGE,
			Data:      &model.PostImage{},
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		metadata.URL = "http://example.com/another/page"

		result = <-ss.LinkMetadata().Save(metadata)

		require.Nil(t, result.Err)
		require.IsType(t, metadata, result.Data)
		assert.Equal(t, *metadata, *result.Data.(*model.LinkMetadata))
	})

	t.Run("should fail to save with duplicate URL and timestamp", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_IMAGE,
			Data:      &model.PostImage{},
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		result = <-ss.LinkMetadata().Save(metadata)

		assert.NotNil(t, result.Err)
	})
}

func testLinkMetadataStoreGet(t *testing.T, ss store.Store) {
	t.Run("should get value", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_IMAGE,
			Data:      &model.PostImage{},
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		result = <-ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)

		require.Nil(t, result.Err)
		require.IsType(t, metadata, result.Data)
		assert.Equal(t, *metadata, *result.Data.(*model.LinkMetadata))
	})

	t.Run("should return not found with incorrect URL", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_IMAGE,
			Data:      &model.PostImage{},
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		result = <-ss.LinkMetadata().Get("http://example.com/another_page", metadata.Timestamp)

		require.NotNil(t, result.Err)
		assert.Equal(t, http.StatusNotFound, result.Err.StatusCode)
	})

	t.Run("should return not found with incorrect timestamp", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_IMAGE,
			Data:      &model.PostImage{},
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		result = <-ss.LinkMetadata().Get(metadata.URL, getNextLinkMetadataTimestamp())

		require.NotNil(t, result.Err)
		assert.Equal(t, http.StatusNotFound, result.Err.StatusCode)
	})
}

func testLinkMetadataStoreTypes(t *testing.T, ss store.Store) {
	t.Run("should save and get image metadata", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_IMAGE,
			Data: &model.PostImage{
				Width:  123,
				Height: 456,
			},
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		received := result.Data.(*model.LinkMetadata)
		require.IsType(t, &model.PostImage{}, received.Data)
		assert.Equal(t, *(metadata.Data.(*model.PostImage)), *(received.Data.(*model.PostImage)))

		result = <-ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)
		require.Nil(t, result.Err)

		received = result.Data.(*model.LinkMetadata)
		require.IsType(t, &model.PostImage{}, received.Data)
		assert.Equal(t, *(metadata.Data.(*model.PostImage)), *(received.Data.(*model.PostImage)))
	})

	t.Run("should save and get opengraph data", func(t *testing.T) {
		og := &opengraph.OpenGraph{
			URL: "http://example.com",
			Images: []*opengraph.Image{
				{
					URL: "http://example.com/image.png",
				},
			},
		}

		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_OPENGRAPH,
			Data:      og,
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		received := result.Data.(*model.LinkMetadata)
		require.IsType(t, &opengraph.OpenGraph{}, received.Data)
		assert.Equal(t, *(metadata.Data.(*opengraph.OpenGraph)), *(received.Data.(*opengraph.OpenGraph)))

		result = <-ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)
		require.Nil(t, result.Err)

		received = result.Data.(*model.LinkMetadata)
		require.IsType(t, &opengraph.OpenGraph{}, received.Data)
		assert.Equal(t, *(metadata.Data.(*opengraph.OpenGraph)), *(received.Data.(*opengraph.OpenGraph)))
	})

	t.Run("should save and get nil", func(t *testing.T) {
		metadata := &model.LinkMetadata{
			URL:       "http://example.com",
			Timestamp: getNextLinkMetadataTimestamp(),
			Type:      model.LINK_METADATA_TYPE_NONE,
			Data:      nil,
		}

		result := <-ss.LinkMetadata().Save(metadata)
		require.Nil(t, result.Err)

		received := result.Data.(*model.LinkMetadata)
		assert.Nil(t, received.Data)

		result = <-ss.LinkMetadata().Get(metadata.URL, metadata.Timestamp)
		require.Nil(t, result.Err)

		received = result.Data.(*model.LinkMetadata)
		require.Nil(t, received.Data)
	})
}
