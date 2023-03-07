// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

func Test_newChangeNotifier(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(false, mlog.LvlDebug)

	t.Run("startup, shutdown", func(t *testing.T) {
		cn := NewCallbackQueue("test1", 100, 5, logger)

		var callbackCount int32
		callback := func() error {
			atomic.AddInt32(&callbackCount, 1)
			return nil
		}

		const loops = 500
		for i := 0; i < loops; i++ {
			cn.Enqueue(callback)
			// don't peg the cpu
			if i%20 == 0 {
				time.Sleep(time.Millisecond * 1)
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()
		ok := cn.Shutdown(ctx)
		assert.True(t, ok, "shutdown should return true (no timeout)")

		assert.Equal(t, int32(loops), atomic.LoadInt32(&callbackCount))
	})

	t.Run("handle panic", func(t *testing.T) {
		cn := NewCallbackQueue("test2", 100, 5, logger)

		var callbackCount int32
		callback := func() error {
			atomic.AddInt32(&callbackCount, 1)
			panic("oh no!")
		}

		const loops = 5
		for i := 0; i < loops; i++ {
			cn.Enqueue(callback)
		}

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()
		ok := cn.Shutdown(ctx)
		assert.True(t, ok, "shutdown should return true (no timeout)")

		assert.Equal(t, int32(loops), atomic.LoadInt32(&callbackCount))
	})
}
