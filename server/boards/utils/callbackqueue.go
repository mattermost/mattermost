// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"context"
	"runtime/debug"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

// CallbackFunc is a func that can enqueued in the callback queue and will be
// called when dequeued.
type CallbackFunc func() error

// CallbackQueue provides a simple thread pool for processing callbacks. Callbacks will
// be executed in the order in which they are enqueued, but no guarantees are provided
// regarding the order in which they finish (unless poolSize == 1).
type CallbackQueue struct {
	name     string
	poolSize int

	queue chan CallbackFunc
	done  chan struct{}
	alive chan int

	idone uint32

	logger mlog.LoggerIFace
}

// NewCallbackQueue creates a new CallbackQueue and starts a thread pool to service it.
func NewCallbackQueue(name string, queueSize int, poolSize int, logger mlog.LoggerIFace) *CallbackQueue {
	cn := &CallbackQueue{
		name:     name,
		poolSize: poolSize,
		queue:    make(chan CallbackFunc, queueSize),
		done:     make(chan struct{}),
		alive:    make(chan int, poolSize),
		logger:   logger,
	}

	for i := 0; i < poolSize; i++ {
		go cn.loop(i)
	}

	return cn
}

// Shutdown stops accepting enqueues and exits all pool threads. This method waits
// as long as the context allows for the threads to exit.
// Returns true if the pool exited, false on timeout.
func (cn *CallbackQueue) Shutdown(context context.Context) bool {
	if !atomic.CompareAndSwapUint32(&cn.idone, 0, 1) {
		// already shutdown
		return true
	}

	// signal threads to exit
	close(cn.done)

	// wait for the threads to exit or timeout
	count := 0
	for count < cn.poolSize {
		select {
		case <-cn.alive:
			count++
		case <-context.Done():
			return false
		}
	}

	// try to drain any remaining callbacks
	for {
		select {
		case f := <-cn.queue:
			cn.exec(f)
		case <-context.Done():
			return false
		default:
			return true
		}
	}
}

// Enqueue adds a callback to the queue.
func (cn *CallbackQueue) Enqueue(f CallbackFunc) {
	if atomic.LoadUint32(&cn.idone) != 0 {
		cn.logger.Debug("CallbackQueue skipping enqueue, notifier is shutdown", mlog.String("name", cn.name))
		return
	}

	select {
	case cn.queue <- f:
	default:
		start := time.Now()
		cn.queue <- f
		dur := time.Since(start)
		cn.logger.Warn("CallbackQueue queue backlog", mlog.String("name", cn.name), mlog.Duration("wait_time", dur))
	}
}

func (cn *CallbackQueue) loop(id int) {
	defer func() {
		cn.logger.Trace("CallbackQueue thread exited", mlog.String("name", cn.name), mlog.Int("id", id))
		cn.alive <- id
	}()

	for {
		select {
		case f := <-cn.queue:
			cn.exec(f)
		case <-cn.done:
			return
		}
	}
}

func (cn *CallbackQueue) exec(f CallbackFunc) {
	// don't let a panic in the callback exit the thread.
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			cn.logger.Error("CallbackQueue callback panic",
				mlog.String("name", cn.name),
				mlog.Any("panic", r),
				mlog.String("stack", string(stack)),
			)
		}
	}()

	if err := f(); err != nil {
		cn.logger.Error("CallbackQueue callback error", mlog.String("name", cn.name), mlog.Err(err))
	}
}
