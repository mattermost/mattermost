// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

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

	t.Run("GetSubject not cached for channel object type", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		channelID := "channel-id"
		_, err = cachedStore.Attributes().GetSubject(rctx, channelID, groupID, model.PropertyFieldObjectTypeChannel)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 1)

		_, err = cachedStore.Attributes().GetSubject(rctx, channelID, groupID, model.PropertyFieldObjectTypeChannel)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 2)
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

// setHookCache runs onSet once, just before the first entry is written, to model a drop that
// lands after a reader decided to cache its result but before the write reaches the cache.
type setHookCache struct {
	cache.Cache
	onSet func()
}

func (c *setHookCache) SetWithDefaultExpiry(key string, value any) error {
	if hook := c.onSet; hook != nil {
		c.onSet = nil
		hook()
	}
	return c.Cache.SetWithDefaultExpiry(key, value)
}

func TestAttributesStoreGetSubjectOverlappingInvalidation(t *testing.T) {
	const (
		changedUserID = "changed-user-id"
		groupID       = "group-id"
	)
	logger := mlog.CreateConsoleTestLogger(t)
	rctx := request.TestContext(t)

	oldSubject := model.Subject{ID: changedUserID, Type: "user", Attributes: map[string]any{"department": "Old"}}
	newSubject := model.Subject{ID: changedUserID, Type: "user", Attributes: map[string]any{"department": "New"}}

	// Each case fires its drop while the first backing read is in progress, so that read returns
	// the value from before the change while the second returns the value after it.
	dropDuringRead := map[string]func(s *LocalCacheStore){
		"peer node invalidation for the user": func(s *LocalCacheStore) {
			s.attributes.handleClusterInvalidateUserAttributes(&model.ClusterMessage{
				Event: model.ClusterEventInvalidateCacheForUserAttributes,
				Data:  []byte(changedUserID),
			})
		},
		"peer node purge": func(s *LocalCacheStore) {
			s.attributes.handleClusterInvalidateUserAttributes(&model.ClusterMessage{
				Event: model.ClusterEventInvalidateCacheForUserAttributes,
				Data:  clearCacheMessageData,
			})
		},
		"invalidation on this node": func(s *LocalCacheStore) {
			s.Attributes().InvalidateUserAttributes(changedUserID)
		},
		"purge without broadcast after a view refresh": func(s *LocalCacheStore) {
			s.PurgeUserAttributesCacheWithoutBroadcast()
		},
	}

	assertNextReadSeesChange := func(t *testing.T, cachedStore LocalCacheStore, attrs *mocks.AttributesStore) {
		t.Helper()
		first, err := cachedStore.Attributes().GetSubject(rctx, changedUserID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, "Old", first.Attributes["department"], "the overlapping read itself returns what it read")

		second, err := cachedStore.Attributes().GetSubject(rctx, changedUserID, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)
		assert.Equal(t, "New", second.Attributes["department"], "a read that overlapped the drop must not leave its result cached")
		attrs.AssertNumberOfCalls(t, "GetSubject", 2)
	}

	for name, drop := range dropDuringRead {
		t.Run(name+" lands during the backing read", func(t *testing.T) {
			mockStore := getMockStore(t)
			cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
			require.NoError(t, err)

			attrs := mockStore.Attributes().(*mocks.AttributesStore)
			attrs.On("GetSubject", mock.Anything, changedUserID, groupID, model.PropertyFieldObjectTypeUser).
				Run(func(mock.Arguments) { drop(&cachedStore) }).
				Return(&oldSubject, nil).Once()
			attrs.On("GetSubject", mock.Anything, changedUserID, groupID, model.PropertyFieldObjectTypeUser).
				Return(&newSubject, nil).Once()

			assertNextReadSeesChange(t, cachedStore, attrs)
		})

		t.Run(name+" lands between the check and the cache write", func(t *testing.T) {
			var hooked *setHookCache
			var cachedStore LocalCacheStore
			provider := &cachemocks.Provider{}
			call := provider.On("NewCache", mock.Anything)
			call.Run(func(args mock.Arguments) {
				var c cache.Cache = cache.NewLRU(&cache.CacheOptions{Size: 128})
				if opts := args.Get(0).(*cache.CacheOptions); opts.Name == "UserAttributes" {
					hooked = &setHookCache{Cache: c}
					c = hooked
				}
				call.ReturnArguments = mock.Arguments{c, nil}
			})
			provider.On("Type").Return("lru")

			mockStore := getMockStore(t)
			var err error
			cachedStore, err = NewLocalCacheLayer(mockStore, nil, nil, provider, logger)
			require.NoError(t, err)
			require.NotNil(t, hooked)
			hooked.onSet = func() { drop(&cachedStore) }

			attrs := mockStore.Attributes().(*mocks.AttributesStore)
			attrs.On("GetSubject", mock.Anything, changedUserID, groupID, model.PropertyFieldObjectTypeUser).
				Return(&oldSubject, nil).Once()
			attrs.On("GetSubject", mock.Anything, changedUserID, groupID, model.PropertyFieldObjectTypeUser).
				Return(&newSubject, nil).Once()

			assertNextReadSeesChange(t, cachedStore, attrs)
		})
	}

	t.Run("unrelated reads keep caching after a drop", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		cachedStore.Attributes().InvalidateUserAttributes(changedUserID)
		for range 2 {
			_, err = cachedStore.Attributes().GetSubject(rctx, "user-id", groupID, model.PropertyFieldObjectTypeUser)
			require.NoError(t, err)
		}
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetSubject", 1)
	})
}
