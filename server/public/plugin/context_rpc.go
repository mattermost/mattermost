// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"context"
	"io"
	"sync"
	"time"
)

// rpcRequestContext carries only deadline metadata. Explicit cancellation is signaled
// separately over the context stream; context values are intentionally not propagated.
type rpcRequestContext struct {
	DeadlineUnixNano int64
}

type closeReason byte

const (
	rpcStreamClosed closeReason = iota
	rpcStreamCanceled
	rpcStreamDeadlineExceeded
)

func openRPCRequestContext(muxBroker rpcMuxBroker, streamID uint32, requestContext rpcRequestContext) (context.Context, func(), error) {
	if streamID == 0 {
		return context.Background(), func() {}, nil
	}

	connection, err := muxBroker.Dial(streamID)
	if err != nil {
		return nil, nil, err
	}

	ctx, cancel := requestContext.Context()
	watchRPCContext(ctx, connection, cancel)
	cleanup := func() {
		cancel()
		_ = connection.Close()
	}

	return ctx, cleanup, nil
}

func newRPCRequestContext(ctx context.Context) rpcRequestContext {
	deadline, ok := ctx.Deadline()
	if !ok {
		return rpcRequestContext{}
	}

	return rpcRequestContext{DeadlineUnixNano: deadline.UnixNano()}
}

func (c rpcRequestContext) Context() (context.Context, context.CancelFunc) {
	if c.DeadlineUnixNano != 0 {
		return context.WithDeadline(context.Background(), time.Unix(0, c.DeadlineUnixNano))
	}

	return context.WithCancel(context.Background())
}

// rpcStreamCloser owns a per-request mux stream whose MuxBroker.Accept runs concurrently
// with request cancellation. Close or Cancel may therefore run before Set receives the
// accepted connection. In that case, Set signals the saved cancellation reason when needed
// and immediately closes the late connection so it cannot outlive the request. Set returns
// false when it closes a connection this way.
type rpcStreamCloser struct {
	mutex  sync.Mutex
	stream io.Closer
	closed bool
	reason closeReason
}

func (c *rpcStreamCloser) Set(stream io.Closer) bool {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.closed {
		if c.reason != rpcStreamClosed {
			if writer, ok := stream.(io.Writer); ok {
				_, _ = writer.Write([]byte{byte(c.reason)})
			}
		}
		_ = stream.Close()
		return false
	}

	c.stream = stream
	return true
}

func (c *rpcStreamCloser) Close() error {
	return c.close(rpcStreamClosed)
}

func (c *rpcStreamCloser) Cancel(err error) error {
	reason := rpcStreamCanceled
	if err == context.DeadlineExceeded {
		reason = rpcStreamDeadlineExceeded
	}
	return c.close(reason)
}

func (c *rpcStreamCloser) close(reason closeReason) error {
	c.mutex.Lock()
	if c.closed {
		c.mutex.Unlock()
		return nil
	}
	c.closed = true
	c.reason = reason
	stream := c.stream
	c.mutex.Unlock()

	if stream != nil {
		if reason != rpcStreamClosed {
			if writer, ok := stream.(io.Writer); ok {
				_, _ = writer.Write([]byte{byte(reason)})
			}
		}
		return stream.Close()
	}
	return nil
}

// contextReadCloser closes the underlying stream when the context ends, unblocking an
// active Read and ensuring it reports ctx.Err instead of a transport error.
type contextReadCloser struct {
	ctx       context.Context
	reader    io.ReadCloser
	closeOnce sync.Once
	closeErr  error
	stop      func() bool
	onClose   func()
}

func newContextReadCloser(ctx context.Context, reader io.ReadCloser, onClose func()) io.ReadCloser {
	r := &contextReadCloser{
		ctx:     ctx,
		reader:  reader,
		onClose: onClose,
	}

	if ctx.Done() != nil {
		r.stop = context.AfterFunc(ctx, func() {
			_ = r.close(false)
		})
	}

	return r
}

func (r *contextReadCloser) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		_ = r.Close()
		return 0, err
	}

	n, err := r.reader.Read(p)
	if ctxErr := r.ctx.Err(); ctxErr != nil {
		_ = r.Close()
		return 0, ctxErr
	}
	if err != nil {
		_ = r.Close()
	}
	return n, err
}

func (r *contextReadCloser) Close() error {
	return r.close(true)
}

func (r *contextReadCloser) close(stopContext bool) error {
	r.closeOnce.Do(func() {
		if stopContext && r.stop != nil {
			r.stop()
		}
		r.closeErr = r.reader.Close()
		if r.onClose != nil {
			r.onClose()
		}
	})
	return r.closeErr
}

// watchRPCContext cancels immediately on EOF or explicit cancellation. For deadline
// expiry, it lets the reconstructed deadline fire locally so ctx.Err is DeadlineExceeded.
func watchRPCContext(ctx context.Context, stream io.ReadCloser, cancel context.CancelFunc) {
	go func() {
		var buffer [1]byte
		n, _ := stream.Read(buffer[:])
		if n == 1 && closeReason(buffer[0]) == rpcStreamDeadlineExceeded {
			if _, ok := ctx.Deadline(); ok {
				<-ctx.Done()
			} else {
				cancel()
			}
		} else {
			cancel()
		}
		_ = stream.Close()
	}()
}
