// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

func TestEmitter(t *testing.T) {
	var e emitter

	expectedOldCfg := &model.Config{}
	expectedNewCfg := &model.Config{}

	listener1 := false
	id1 := e.AddListener(func(oldCfg, newCfg *model.Config) {
		assert.Equal(t, expectedOldCfg, oldCfg)
		assert.Equal(t, expectedNewCfg, newCfg)
		listener1 = true
	})

	listener2 := false
	id2 := e.AddListener(func(oldCfg, newCfg *model.Config) {
		assert.Equal(t, expectedOldCfg, oldCfg)
		assert.Equal(t, expectedNewCfg, newCfg)
		listener2 = true
	})

	e.invokeConfigListeners(expectedOldCfg, expectedNewCfg)
	assert.True(t, listener1, "listener 1 not called")
	assert.True(t, listener2, "listener 2 not called")

	e.RemoveListener(id2)

	listener1 = false
	listener2 = false
	e.invokeConfigListeners(expectedOldCfg, expectedNewCfg)
	assert.True(t, listener1, "listener 1 not called")
	assert.False(t, listener2, "listener 2 should not have been called")

	e.RemoveListener(id1)

	listener1 = false
	listener2 = false
	e.invokeConfigListeners(expectedOldCfg, expectedNewCfg)
	assert.False(t, listener1, "listener 1 should not have been called")
	assert.False(t, listener2, "listener 2 should not have been called")
}

func TestLogSrcEmitter(t *testing.T) {
	var e logSrcEmitter

	expectedOldCfg := make(mlog.LoggerConfiguration)
	expectedNewCfg := make(mlog.LoggerConfiguration)

	listener1 := false
	id1 := e.AddListener(func(oldCfg, newCfg mlog.LoggerConfiguration) {
		assert.Equal(t, expectedOldCfg, oldCfg)
		assert.Equal(t, expectedNewCfg, newCfg)
		listener1 = true
	})

	listener2 := false
	id2 := e.AddListener(func(oldCfg, newCfg mlog.LoggerConfiguration) {
		assert.Equal(t, expectedOldCfg, oldCfg)
		assert.Equal(t, expectedNewCfg, newCfg)
		listener2 = true
	})

	e.invokeConfigListeners(expectedOldCfg, expectedNewCfg)
	assert.True(t, listener1, "listener 1 not called")
	assert.True(t, listener2, "listener 2 not called")

	e.RemoveListener(id2)

	listener1 = false
	listener2 = false
	e.invokeConfigListeners(expectedOldCfg, expectedNewCfg)
	assert.True(t, listener1, "listener 1 not called")
	assert.False(t, listener2, "listener 2 should not have been called")

	e.RemoveListener(id1)

	listener1 = false
	listener2 = false
	e.invokeConfigListeners(expectedOldCfg, expectedNewCfg)
	assert.False(t, listener1, "listener 1 should not have been called")
	assert.False(t, listener2, "listener 2 should not have been called")
}
