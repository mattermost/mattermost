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
	t.Run("should return true if it's run first time in a node", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetDiagnosticId").Return("test_cluster")
		api.On("KVCompareAndSet", "unique_id_test_cluster", []byte(nil), []byte("true")).
			Return(true, nil)
		p.API = api

		executed, err := p.RunOnSingleNode("unique_id", func() {})
		assert.Nil(t, err)
		assert.True(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should return false if it's not run first time in a node", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetDiagnosticId").Return("test_cluster")
		api.On("KVCompareAndSet", "unique_id_test_cluster", []byte(nil), []byte("true")).
			Return(false, nil)
		p.API = api

		executed, err := p.RunOnSingleNode("unique_id", func() {})
		assert.Nil(t, err)
		assert.False(t, executed)
		api.AssertExpectations(t)
	})

	t.Run("should return error if KVCompareAndSet returns error", func(t *testing.T) {
		p := &plugin.HelpersImpl{}

		api := &plugintest.API{}
		api.On("GetDiagnosticId").Return("test_cluster")
		api.On("KVCompareAndSet", "unique_id_test_cluster", []byte(nil), []byte("true")).
			Return(false, &model.AppError{})
		p.API = api

		executed, err := p.RunOnSingleNode("unique_id", func() {})
		assert.Error(t, err)
		assert.False(t, executed)
		api.AssertExpectations(t)
	})
}

