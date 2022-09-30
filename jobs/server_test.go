// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestStartWorkers(t *testing.T) {
	t.Run("uninitialized", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		err := jobServer.StartWorkers()
		require.Equal(t, ErrWorkersUninitialized, err)
	})

	t.Run("already running", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.initWorkers()
		err := jobServer.StartWorkers()
		require.NoError(t, err)
		err = jobServer.StartWorkers()
		require.Equal(t, ErrWorkersRunning, err)
		// Parking the go routing to let the worker watcher start
		time.Sleep(1 * time.Millisecond)
		err = jobServer.StopWorkers()
		require.NoError(t, err)
	})

	t.Run("not running", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.initWorkers()
		err := jobServer.StartWorkers()
		require.NoError(t, err)
		// Parking the go routing to let the worker watcher start
		time.Sleep(1 * time.Millisecond)
		err = jobServer.StopWorkers()
		require.NoError(t, err)
	})
}

func TestStopWorkers(t *testing.T) {
	t.Run("uninitialized", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		err := jobServer.StopWorkers()
		require.Equal(t, ErrWorkersUninitialized, err)
	})

	t.Run("not running", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.initWorkers()
		err := jobServer.StopWorkers()
		require.Equal(t, ErrWorkersNotRunning, err)
	})

	t.Run("running", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.initWorkers()
		err := jobServer.StartWorkers()
		require.NoError(t, err)
		// Parking the go routing to let the worker watcher start
		time.Sleep(1 * time.Millisecond)
		err = jobServer.StopWorkers()
		require.NoError(t, err)
	})
}

func TestStartSchedulers(t *testing.T) {
	t.Run("uninitialized", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		err := jobServer.StartSchedulers()
		require.Equal(t, ErrSchedulersUninitialized, err)
	})

	t.Run("initialized", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.initSchedulers()
		err := jobServer.StartSchedulers()
		require.NoError(t, err)

		err = jobServer.StopSchedulers()
		require.NoError(t, err)
	})

	t.Run("already running", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.initSchedulers()
		err := jobServer.StartSchedulers()
		require.NoError(t, err)
		err = jobServer.StartSchedulers()
		require.Equal(t, ErrSchedulersRunning, err)

		err = jobServer.StopSchedulers()
		require.NoError(t, err)
	})
}

func TestStopSchedulers(t *testing.T) {
	t.Run("uninitialized", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		err := jobServer.StopSchedulers()
		require.Equal(t, ErrSchedulersUninitialized, err)
	})

	t.Run("not running", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.initSchedulers()
		err := jobServer.StopSchedulers()
		require.Equal(t, ErrSchedulersNotRunning, err)
	})

	t.Run("running", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.initSchedulers()
		err := jobServer.StartSchedulers()
		require.NoError(t, err)
		err = jobServer.StopSchedulers()
		require.NoError(t, err)
	})
}
