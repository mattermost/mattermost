// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delete_dms_preferences_migration

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDoDeleteDMsPreferencesMigrationBatch(t *testing.T) {
	t.Run("failure deleting batch", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		mockStore.PreferenceStore.On("DeleteInvalidVisibleDmsGms").Return(int64(0), errors.New("failure"))

		data, done, err := doDeleteDmsPreferencesMigrationBatch(nil, mockStore)
		require.EqualError(t, err, "failed to delete invalid limit_visible_dms_gms: failure")
		assert.False(t, done)
		assert.Nil(t, data)
	})

	t.Run("do batches", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		mockStore.PreferenceStore.On("DeleteInvalidVisibleDmsGms").Return(int64(10), nil)

		data, done, err := doDeleteDmsPreferencesMigrationBatch(nil, mockStore)
		require.NoError(t, err)
		assert.False(t, done)
		assert.Nil(t, data)
	})

	t.Run("done batches", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		mockStore.PreferenceStore.On("DeleteInvalidVisibleDmsGms").Return(int64(0), nil)

		data, done, err := doDeleteDmsPreferencesMigrationBatch(nil, mockStore)
		require.NoError(t, err)
		assert.True(t, done)
		assert.Nil(t, data)
	})
}
