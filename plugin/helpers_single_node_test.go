// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin_test

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/stretchr/testify/assert"
)

func TestRunOnSingleNode(t *testing.T) {
	uniqueId := "unique_id"
	lockKey := fmt.Sprintf("%s%s", plugin.RUN_SINGLE_NODE_KEY_PREFIX, uniqueId)

	t.Run("should execute if there is no other node running the function", func(t *testing.T) {
		var appError error
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.12.0")
		api.On("KVCompareAndSet", lockKey, []byte(nil), []byte("lock")).
			Return(true, nil)
		api.On("KVDelete", lockKey).
			Return(appError)
		p.API = api

		executed, err := p.RunOnSingleNode(uniqueId, func() {})
		assert.NoError(t, err)
		assert.True(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should not execute if there is a node running the function", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.12.0")
		api.On("KVCompareAndSet", lockKey, []byte(nil), []byte("lock")).
			Return(false, nil)
		p.API = api

		executed, err := p.RunOnSingleNode(uniqueId, func() {})
		assert.Nil(t, err)
		assert.False(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should return an error if KVCompareAndSet returns an error", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.12.0")
		api.On("KVCompareAndSet", lockKey, []byte(nil), []byte("lock")).
			Return(false, &model.AppError{})
		p.API = api

		executed, err := p.RunOnSingleNode(uniqueId, func() {})
		assert.Error(t, err)
		assert.False(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should execute and return an error if KVDelete returns error", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.12.0")
		api.On("KVCompareAndSet", lockKey, []byte(nil), []byte("lock")).
			Return(true, nil)
		api.On("KVDelete", lockKey).
			Return(&model.AppError{})
		p.API = api

		executed, err := p.RunOnSingleNode(uniqueId, func() {})
		assert.Error(t, err)
		assert.True(t, executed)
		api.AssertExpectations(t)
	})
}
