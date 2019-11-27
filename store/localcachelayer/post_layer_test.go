// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostStore(t *testing.T) {
	StoreTestWithSqlSupplier(t, storetest.TestPostStore)
}

func TestPostStoreCache(t *testing.T) {
	fakePosts := &model.PostList{}
	fakeOptions := model.GetPostsOptions{ChannelId: "123", PerPage: 30}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		gotPosts, err := cachedStore.Post().GetPosts(fakeOptions, true)
		require.Nil(t, err)
		assert.Equal(t, fakePosts, gotPosts)
		mockStore.Post().(*mocks.PostStore).AssertNumberOfCalls(t, "GetPosts", 1)

		_, _ = cachedStore.Post().GetPosts(fakeOptions, true)
		mockStore.Post().(*mocks.PostStore).AssertNumberOfCalls(t, "GetPosts", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		gotPosts, err := cachedStore.Post().GetPosts(fakeOptions, true)
		require.Nil(t, err)
		assert.Equal(t, fakePosts, gotPosts)
		mockStore.Post().(*mocks.PostStore).AssertNumberOfCalls(t, "GetPosts", 1)

		_, _ = cachedStore.Post().GetPosts(fakeOptions, false)
		mockStore.Post().(*mocks.PostStore).AssertNumberOfCalls(t, "GetPosts", 2)
	})

	t.Run("first call not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		gotPosts, err := cachedStore.Post().GetPosts(fakeOptions, true)
		require.Nil(t, err)
		assert.Equal(t, fakePosts, gotPosts)
		mockStore.Post().(*mocks.PostStore).AssertNumberOfCalls(t, "GetPosts", 1)

		cachedStore.Post().InvalidateLastPostTimeCache("12360")

		_, _ = cachedStore.Post().GetPosts(fakeOptions, true)
		mockStore.Post().(*mocks.PostStore).AssertNumberOfCalls(t, "GetPosts", 1)

	})
}
