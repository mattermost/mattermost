// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestPropertyFieldStoreCache(t *testing.T) {
	groupID := "group-id"
	fakeField := model.PropertyField{ID: "field-id", GroupID: groupID, Name: "field-name"}
	fakeFields := []*model.PropertyField{&fakeField}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("GetForGroup cached on second call", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		fields, err := cachedStore.PropertyField().GetForGroup(context.Background(), groupID)
		require.NoError(t, err)
		assert.Equal(t, fakeFields, fields)
		mockStore.PropertyField().(*mocks.PropertyFieldStore).AssertNumberOfCalls(t, "GetForGroup", 1)

		fields, err = cachedStore.PropertyField().GetForGroup(context.Background(), groupID)
		require.NoError(t, err)
		assert.Equal(t, fakeFields, fields)
		mockStore.PropertyField().(*mocks.PropertyFieldStore).AssertNumberOfCalls(t, "GetForGroup", 1)
	})

	t.Run("Create invalidates the group cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		_, err = cachedStore.PropertyField().GetForGroup(context.Background(), groupID)
		require.NoError(t, err)
		mockStore.PropertyField().(*mocks.PropertyFieldStore).AssertNumberOfCalls(t, "GetForGroup", 1)

		_, err = cachedStore.PropertyField().Create(&fakeField)
		require.NoError(t, err)

		_, err = cachedStore.PropertyField().GetForGroup(context.Background(), groupID)
		require.NoError(t, err)
		mockStore.PropertyField().(*mocks.PropertyFieldStore).AssertNumberOfCalls(t, "GetForGroup", 2)
	})

	t.Run("Update invalidates the group cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		_, err = cachedStore.PropertyField().GetForGroup(context.Background(), groupID)
		require.NoError(t, err)
		mockStore.PropertyField().(*mocks.PropertyFieldStore).AssertNumberOfCalls(t, "GetForGroup", 1)

		_, err = cachedStore.PropertyField().Update(groupID, fakeFields, nil)
		require.NoError(t, err)

		_, err = cachedStore.PropertyField().GetForGroup(context.Background(), groupID)
		require.NoError(t, err)
		mockStore.PropertyField().(*mocks.PropertyFieldStore).AssertNumberOfCalls(t, "GetForGroup", 2)
	})

	t.Run("Delete invalidates the group cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		_, err = cachedStore.PropertyField().GetForGroup(context.Background(), groupID)
		require.NoError(t, err)
		mockStore.PropertyField().(*mocks.PropertyFieldStore).AssertNumberOfCalls(t, "GetForGroup", 1)

		err = cachedStore.PropertyField().Delete(groupID, fakeField.ID)
		require.NoError(t, err)

		_, err = cachedStore.PropertyField().GetForGroup(context.Background(), groupID)
		require.NoError(t, err)
		mockStore.PropertyField().(*mocks.PropertyFieldStore).AssertNumberOfCalls(t, "GetForGroup", 2)
	})
}
