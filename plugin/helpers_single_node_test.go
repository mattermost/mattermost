// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin_test

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/stretchr/testify/assert"
)

func TestRunOnSingleNode(t *testing.T) {
	t.Run("should execute if there is no other node running the function", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.16.0")
		api.On("KVCompareAndSet", "unique_id", []byte(nil), []byte("true")).
			Return(true, nil)
		api.On("KVCompareAndDelete", "unique_id", []byte("true")).
			Return(true, nil)
		p.API = api

		executed, err := p.RunOnSingleNode("unique_id", func() {})
		assert.Nil(t, err)
		assert.True(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should not execute if there is node running the function", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.16.0")
		api.On("KVCompareAndSet", "unique_id", []byte(nil), []byte("true")).
			Return(false, nil)
		p.API = api

		executed, err := p.RunOnSingleNode("unique_id", func() {})
		assert.Nil(t, err)
		assert.False(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should return an error if KVCompareAndSet returns an error", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.16.0")
		api.On("KVCompareAndSet", "unique_id", []byte(nil), []byte("true")).
			Return(false, &model.AppError{})
		p.API = api

		executed, err := p.RunOnSingleNode("unique_id", func() {})
		assert.Error(t, err)
		assert.False(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should execute and return an error if KVCompareAndDelete returns error", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.16.0")
		api.On("KVCompareAndSet", "unique_id", []byte(nil), []byte("true")).
			Return(true, nil)
		api.On("KVCompareAndDelete", "unique_id", []byte("true")).
			Return(false, &model.AppError{})
		p.API = api

		executed, err := p.RunOnSingleNode("unique_id", func() {})
		assert.Error(t, err)
		assert.True(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should execute and return an error if helper can't delete a lock key", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetServerVersion").Return("5.16.0")
		api.On("KVCompareAndSet", "unique_id", []byte(nil), []byte("true")).
			Return(true, nil)
		api.On("KVCompareAndDelete", "unique_id", []byte("true")).
			Return(false, nil)
		p.API = api

		executed, err := p.RunOnSingleNode("unique_id", func() {})
		assert.Error(t, err)
		assert.True(t, executed)
		api.AssertExpectations(t)
	})
}
