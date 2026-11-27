// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	cachemocks "github.com/mattermost/mattermost/server/v8/platform/services/cache/mocks"
)

func TestAttributesStoreCache(t *testing.T) {
	userID := "user-id"
	logger := mlog.CreateConsoleTestLogger(t)
	rctx := request.TestContext(t)

	t.Run("GetUserPropertyValuesEpoch cached on second call", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		epoch, err := cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		assert.Equal(t, "200-1", epoch)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 1)

		epoch, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		assert.Equal(t, "200-1", epoch)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 1)
	})

	t.Run("InvalidateUserPropertyValuesEpoch forces a re-query", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		_, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 1)

		cachedStore.Attributes().InvalidateUserPropertyValuesEpoch(userID)

		_, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 2)
	})

	t.Run("ClearUserPropertyValuesEpochCache forces a re-query", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		_, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 1)

		cachedStore.Attributes().ClearUserPropertyValuesEpochCache()

		_, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 2)
	})

	groupID := "group-id"

	t.Run("GetSubject cached on second call for user object type", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		subject, err := cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, "Engineering", subject.Attributes["department"])
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 1)

		subject, err = cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, "Engineering", subject.Attributes["department"])
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 1)
	})

	t.Run("GetSubject caches an empty subject for a user with no attributes", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		noAttributesUserID := "no-attributes-user-id"
		subject, err := cachedStore.Attributes().GetSubject(rctx, noAttributesUserID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, noAttributesUserID, subject.ID)
		assert.Empty(t, subject.Attributes)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 1)

		subject, err = cachedStore.Attributes().GetSubject(rctx, noAttributesUserID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, noAttributesUserID, subject.ID)
		assert.Empty(t, subject.Attributes)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 1)
	})

	t.Run("InvalidateUserAttributes forces a re-query", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		_, err = cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 1)

		cachedStore.Attributes().InvalidateUserAttributes(userID)

		_, err = cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 2)
	})

	t.Run("ClearUserAttributesCache forces a re-query", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		_, err = cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 1)

		cachedStore.Attributes().ClearUserAttributesCache()

		_, err = cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 2)
	})

	t.Run("a read after InvalidateUserAttributes sees the new value", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		changedUserID := "changed-user-id"
		attributesStore := mockStore.Attributes().(*mocks.AttributesStore)
		attributesStore.On("GetSubject", mock.Anything, changedUserID, groupID, model.PropertyFieldObjectTypeUser).
			Return(&model.Subject{ID: changedUserID, Type: "user", Attributes: map[string]any{"department": "Engineering"}}, nil).Once()
		attributesStore.On("GetSubject", mock.Anything, changedUserID, groupID, model.PropertyFieldObjectTypeUser).
			Return(&model.Subject{ID: changedUserID, Type: "user", Attributes: map[string]any{"department": "Sales"}}, nil).Once()

		subject, err := cachedStore.Attributes().GetSubject(rctx, changedUserID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, "Engineering", subject.Attributes["department"])

		// The write's invalidation drops the cached copy, so the next read goes to the store,
		// which reads the live view.
		cachedStore.Attributes().InvalidateUserAttributes(changedUserID)

		subject, err = cachedStore.Attributes().GetSubject(rctx, changedUserID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, "Sales", subject.Attributes["department"])
		attributesStore.AssertNumberOfCalls(t, "GetSubject", 2)
	})

	t.Run("the user attributes cache expires entries after 60 seconds", func(t *testing.T) {
		require.Equal(t, 60, UserAttributesCacheSec)

		var options []*cache.CacheOptions
		provider := cachemocks.Provider{}
		call := provider.On("NewCache", mock.Anything)
		call.Run(func(args mock.Arguments) {
			opts := args.Get(0).(*cache.CacheOptions)
			options = append(options, opts)
			call.ReturnArguments = mock.Arguments{cache.NewLRU(&cache.CacheOptions{Size: 128}), nil}
		})
		provider.On("Type").Return("lru")

		_, err := NewLocalCacheLayer(getMockStore(t), nil, nil, &provider, logger)
		require.NoError(t, err)

		var userAttributes *cache.CacheOptions
		for _, opts := range options {
			if opts.Name == "UserAttributes" {
				userAttributes = opts
			}
		}
		require.NotNil(t, userAttributes, "the user attributes cache should be created")
		assert.Equal(t, 60*time.Second, userAttributes.DefaultExpiry)
	})

	t.Run("GetSubject returns a clone of the cached attributes map", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		first, err := cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		first.Attributes["department"] = "Mutated"

		second, err := cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, "Engineering", second.Attributes["department"])
	})
}

func TestChannelAttributesCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	rctx := request.TestContext(t)
	groupID := "group-id"
	channelID := "channel-id"
	userID := "user-id"

	setup := func(t *testing.T) (LocalCacheStore, *mocks.AttributesStore) {
		t.Helper()
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)
		return cachedStore, mockStore.Attributes().(*mocks.AttributesStore)
	}
	getChannel := func(t *testing.T, cachedStore LocalCacheStore, id string) *model.Subject {
		t.Helper()
		subject, err := cachedStore.Attributes().GetSubject(rctx, id, groupID, model.PropertyFieldObjectTypeChannel)
		require.NoError(t, err)
		return subject
	}
	channelCalls := func(attributesStore *mocks.AttributesStore, id string) int {
		n := 0
		for _, call := range attributesStore.Calls {
			if call.Method == "GetSubject" && call.Arguments.String(1) == id && call.Arguments.String(3) == model.PropertyFieldObjectTypeChannel {
				n++
			}
		}
		return n
	}

	t.Run("a hit makes no store call", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		assert.Equal(t, true, getChannel(t, cachedStore, channelID).Attributes["public"])
		assert.Equal(t, true, getChannel(t, cachedStore, channelID).Attributes["public"])
		assert.Equal(t, 1, channelCalls(attributesStore, channelID))
	})

	t.Run("an empty subject is cached for a channel with no attributes", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		for range 2 {
			subject := getChannel(t, cachedStore, "no-attributes-channel-id")
			assert.Equal(t, "no-attributes-channel-id", subject.ID)
			assert.Equal(t, model.PropertyFieldObjectTypeChannel, subject.Type)
			assert.Empty(t, subject.Attributes)
		}
		assert.Equal(t, 1, channelCalls(attributesStore, "no-attributes-channel-id"))
	})

	t.Run("a hit returns a clone of the cached attributes map", func(t *testing.T) {
		cachedStore, _ := setup(t)

		getChannel(t, cachedStore, channelID).Attributes["public"] = "mutated"
		assert.Equal(t, true, getChannel(t, cachedStore, channelID).Attributes["public"])
	})

	t.Run("InvalidateChannelAttributes drops the entry", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		getChannel(t, cachedStore, channelID)
		cachedStore.Attributes().InvalidateChannelAttributes(channelID)
		getChannel(t, cachedStore, channelID)
		assert.Equal(t, 2, channelCalls(attributesStore, channelID))
	})

	t.Run("the cluster handler drops the entry", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		getChannel(t, cachedStore, channelID)
		cachedStore.attributes.handleClusterInvalidateChannelAttributes(&model.ClusterMessage{Data: []byte(channelID)})
		getChannel(t, cachedStore, channelID)
		assert.Equal(t, 2, channelCalls(attributesStore, channelID))

		cachedStore.attributes.handleClusterInvalidateChannelAttributes(&model.ClusterMessage{Data: clearCacheMessageData})
		getChannel(t, cachedStore, channelID)
		assert.Equal(t, 3, channelCalls(attributesStore, channelID))
	})

	t.Run("ClearChannelAttributesCache clears everything", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		getChannel(t, cachedStore, channelID)
		getChannel(t, cachedStore, "no-attributes-channel-id")
		cachedStore.Attributes().ClearChannelAttributesCache()
		getChannel(t, cachedStore, channelID)
		getChannel(t, cachedStore, "no-attributes-channel-id")
		assert.Equal(t, 2, channelCalls(attributesStore, channelID))
		assert.Equal(t, 2, channelCalls(attributesStore, "no-attributes-channel-id"))
	})

	t.Run("RemoveChannelAttributesLocal drops only the given channels", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		getChannel(t, cachedStore, channelID)
		getChannel(t, cachedStore, "no-attributes-channel-id")
		cachedStore.RemoveChannelAttributesLocal(nil)
		cachedStore.RemoveChannelAttributesLocal([]string{channelID})
		getChannel(t, cachedStore, channelID)
		getChannel(t, cachedStore, "no-attributes-channel-id")
		assert.Equal(t, 2, channelCalls(attributesStore, channelID))
		assert.Equal(t, 1, channelCalls(attributesStore, "no-attributes-channel-id"))
	})

	t.Run("PurgeChannelAttributesLocal drops every channel", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		getChannel(t, cachedStore, channelID)
		getChannel(t, cachedStore, "no-attributes-channel-id")
		cachedStore.PurgeChannelAttributesLocal()
		getChannel(t, cachedStore, channelID)
		getChannel(t, cachedStore, "no-attributes-channel-id")
		assert.Equal(t, 2, channelCalls(attributesStore, channelID))
		assert.Equal(t, 2, channelCalls(attributesStore, "no-attributes-channel-id"))
	})

	t.Run("user lookups are unaffected", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		_, err := cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		getChannel(t, cachedStore, channelID)

		cachedStore.Attributes().InvalidateChannelAttributes(channelID)
		cachedStore.Attributes().ClearChannelAttributesCache()
		cachedStore.PurgeChannelAttributesLocal()

		subject, err := cachedStore.Attributes().GetSubject(rctx, userID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, "Engineering", subject.Attributes["department"])
		attributesStore.AssertNumberOfCalls(t, "GetSubject", 2) // one user read, one channel read
	})

	t.Run("user clears leave channel entries alone", func(t *testing.T) {
		cachedStore, attributesStore := setup(t)

		getChannel(t, cachedStore, channelID)
		cachedStore.Attributes().InvalidateUserAttributes(channelID)
		cachedStore.Attributes().ClearUserAttributesCache()
		cachedStore.PurgeUserAttributesLocal()
		getChannel(t, cachedStore, channelID)
		assert.Equal(t, 1, channelCalls(attributesStore, channelID))
	})

	t.Run("the channel attributes cache mirrors the user cache's size and expiry", func(t *testing.T) {
		var options []*cache.CacheOptions
		provider := cachemocks.Provider{}
		call := provider.On("NewCache", mock.Anything)
		call.Run(func(args mock.Arguments) {
			opts := args.Get(0).(*cache.CacheOptions)
			options = append(options, opts)
			call.ReturnArguments = mock.Arguments{cache.NewLRU(&cache.CacheOptions{Size: 128}), nil}
		})
		provider.On("Type").Return("lru")

		_, err := NewLocalCacheLayer(getMockStore(t), nil, nil, &provider, logger)
		require.NoError(t, err)

		var channelAttributes *cache.CacheOptions
		for _, opts := range options {
			if opts.Name == "ChannelAttributes" {
				channelAttributes = opts
			}
		}
		require.NotNil(t, channelAttributes, "the channel attributes cache should be created")
		assert.Equal(t, UserAttributesCacheSec*time.Second, channelAttributes.DefaultExpiry)
		assert.Equal(t, 60*time.Second, channelAttributes.DefaultExpiry)
		assert.Equal(t, UserAttributesCacheSize, channelAttributes.Size)
		assert.Equal(t, model.ClusterEventInvalidateCacheForChannelAttributes, channelAttributes.InvalidateClusterEvent)
	})
}
