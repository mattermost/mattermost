// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// fakeBackend answers from the funcs and records the calls.
type fakeBackend struct {
	mut     sync.Mutex
	exists  func(items []BulkItem) (map[string]bool, error)
	apply   func(item BulkItem) (int, error)
	checked []string
	applied []string
}

func (f *fakeBackend) Exists(_ context.Context, items []BulkItem) (map[string]bool, error) {
	f.mut.Lock()
	for _, it := range items {
		f.checked = append(f.checked, it.DocID)
	}
	f.mut.Unlock()
	if f.exists == nil {
		return map[string]bool{}, nil
	}
	return f.exists(items)
}

func (f *fakeBackend) Apply(_ context.Context, item BulkItem) (int, error) {
	f.mut.Lock()
	f.applied = append(f.applied, item.DocID)
	f.mut.Unlock()
	if f.apply == nil {
		return http.StatusOK, nil
	}
	return f.apply(item)
}

func newTestRetrier(t *testing.T, b *fakeBackend) *BulkRetrier {
	r := NewBulkRetrier(b, mlog.CreateConsoleTestLogger(t))
	r.backoff = 0
	return r
}

func wait(t *testing.T, r *BulkRetrier) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, r.Wait(ctx))
}

func indexItem(id string) BulkItem {
	return BulkItem{Index: "posts", Action: "index", DocID: id, Body: strings.NewReader("{}")}
}

func deleteItem(id string) BulkItem {
	return BulkItem{Index: "posts", Action: "delete", DocID: id}
}

var errTransport = errors.New("flush: context deadline exceeded")

func TestBulkRetrierDeleteNotFoundIsIgnored(t *testing.T) {
	b := &fakeBackend{}
	r := newTestRetrier(t, b)

	r.Handle(deleteItem("a"), http.StatusNotFound, nil)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Empty(t, b.checked)
}

func TestBulkRetrierBadRequestFailsAtOnce(t *testing.T) {
	b := &fakeBackend{}
	r := newTestRetrier(t, b)

	r.Handle(indexItem("a"), http.StatusBadRequest, errors.New("mapper_parsing_exception"))

	assert.Equal(t, int64(1), r.Failed())
	wait(t, r)
	assert.Empty(t, b.checked)
	assert.Empty(t, b.applied)
}

func TestBulkRetrierIndexFoundIsNotFailed(t *testing.T) {
	b := &fakeBackend{exists: func([]BulkItem) (map[string]bool, error) {
		return map[string]bool{"posts/a": true}, nil
	}}
	r := newTestRetrier(t, b)

	r.Handle(indexItem("a"), 0, errTransport)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Equal(t, int64(1), r.Verified())
	assert.Empty(t, b.applied)
}

func TestBulkRetrierIndexNotFoundIsResent(t *testing.T) {
	b := &fakeBackend{}
	r := newTestRetrier(t, b)

	r.Handle(indexItem("a"), 0, errTransport)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Equal(t, int64(1), r.Retried())
	assert.Equal(t, []string{"a"}, b.applied)
}

func TestBulkRetrierDeleteFoundIsResent(t *testing.T) {
	b := &fakeBackend{exists: func([]BulkItem) (map[string]bool, error) {
		return map[string]bool{"posts/a": true}, nil
	}}
	r := newTestRetrier(t, b)

	r.Handle(deleteItem("a"), http.StatusServiceUnavailable, nil)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Equal(t, []string{"a"}, b.applied)
}

func TestBulkRetrierDeleteNotFoundIsDone(t *testing.T) {
	b := &fakeBackend{}
	r := newTestRetrier(t, b)

	r.Handle(deleteItem("a"), 0, errTransport)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Equal(t, int64(1), r.Verified())
	assert.Empty(t, b.applied)
}

func TestBulkRetrierExistsErrorResendsAll(t *testing.T) {
	b := &fakeBackend{exists: func([]BulkItem) (map[string]bool, error) {
		return nil, errTransport
	}}
	r := newTestRetrier(t, b)

	r.Handle(indexItem("a"), 0, errTransport)
	r.Handle(deleteItem("b"), 0, errTransport)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.ElementsMatch(t, []string{"a", "b"}, b.applied)
}

func TestBulkRetrierResendIsRetriedAfter503(t *testing.T) {
	calls := 0
	b := &fakeBackend{apply: func(BulkItem) (int, error) {
		calls++
		if calls == 1 {
			return http.StatusServiceUnavailable, nil
		}
		return http.StatusOK, nil
	}}
	r := newTestRetrier(t, b)

	r.Handle(indexItem("a"), 0, errTransport)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Equal(t, 2, calls)
}

func TestBulkRetrierResendBadRequestIsFailed(t *testing.T) {
	b := &fakeBackend{apply: func(BulkItem) (int, error) {
		return http.StatusBadRequest, nil
	}}
	r := newTestRetrier(t, b)

	r.Handle(indexItem("a"), 0, errTransport)
	wait(t, r)

	assert.Equal(t, int64(1), r.Failed())
	assert.Len(t, b.applied, 1)
}

func TestBulkRetrierGivesUpAfterFourAttempts(t *testing.T) {
	b := &fakeBackend{apply: func(BulkItem) (int, error) {
		return 0, errTransport
	}}
	r := newTestRetrier(t, b)

	r.Handle(indexItem("a"), 0, errTransport)
	wait(t, r)

	assert.Equal(t, int64(1), r.Failed())
	assert.Len(t, b.applied, 4)
}

func TestBulkRetrierRewindsBodyBeforeResend(t *testing.T) {
	var body string
	b := &fakeBackend{apply: func(item BulkItem) (int, error) {
		buf := make([]byte, 2)
		n, _ := item.Body.Read(buf)
		body = string(buf[:n])
		return http.StatusOK, nil
	}}
	r := newTestRetrier(t, b)

	item := indexItem("a")
	_, _ = item.Body.Read(make([]byte, 2)) // the library already read it
	r.Handle(item, 0, errTransport)
	wait(t, r)

	assert.Equal(t, "{}", body)
}

func TestBulkRetrierWaitReturnsAfterQueueDrains(t *testing.T) {
	release := make(chan struct{})
	b := &fakeBackend{apply: func(BulkItem) (int, error) {
		<-release
		return http.StatusOK, nil
	}}
	r := newTestRetrier(t, b)
	r.Handle(indexItem("a"), 0, errTransport)

	done := make(chan struct{})
	go func() {
		wait(t, r)
		close(done)
	}()

	select {
	case <-done:
		t.Fatal("Wait returned while an item was pending")
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Wait did not return after the queue drained")
	}
	assert.Equal(t, int64(1), r.Retried())
}

func TestBulkRetrierWaitStopsWhenContextEnds(t *testing.T) {
	release := make(chan struct{})
	defer close(release)
	b := &fakeBackend{apply: func(BulkItem) (int, error) {
		<-release
		return http.StatusOK, nil
	}}
	r := newTestRetrier(t, b)
	r.Handle(indexItem("a"), 0, errTransport)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	assert.Error(t, r.Wait(ctx))
}

func TestBulkRetrierHandleNeverBlocks(t *testing.T) {
	release := make(chan struct{})
	b := &fakeBackend{apply: func(BulkItem) (int, error) {
		<-release
		return http.StatusOK, nil
	}}
	r := newTestRetrier(t, b)

	done := make(chan struct{})
	go func() {
		for i := 0; i < 10000; i++ {
			r.Handle(indexItem("a"), 0, errTransport)
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Handle blocked while Apply was stuck")
	}
	close(release)
	wait(t, r)
}
