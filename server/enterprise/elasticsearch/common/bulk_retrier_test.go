// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
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
	mut    sync.Mutex
	exists func(items []BulkItem) (map[string]bool, error)
	apply  func(item BulkItem) (int, error)
	// hang makes every call wait for its context to end.
	hang    bool
	checked []string
	applied []string
	// chunks holds the size of each Exists call.
	chunks []int
}

func (f *fakeBackend) Exists(ctx context.Context, items []BulkItem) (map[string]bool, error) {
	f.mut.Lock()
	f.chunks = append(f.chunks, len(items))
	for _, it := range items {
		f.checked = append(f.checked, it.DocID)
	}
	f.mut.Unlock()
	if f.hang {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	if f.exists == nil {
		return map[string]bool{}, nil
	}
	return f.exists(items)
}

func (f *fakeBackend) Apply(ctx context.Context, item BulkItem) (int, error) {
	f.mut.Lock()
	f.applied = append(f.applied, item.DocID)
	f.mut.Unlock()
	if f.hang {
		<-ctx.Done()
		return 0, ctx.Err()
	}
	if f.apply == nil {
		return http.StatusOK, nil
	}
	return f.apply(item)
}

func newTestRetrier(t *testing.T, b *fakeBackend) *BulkRetrier {
	r := NewBulkRetrier(b, mlog.CreateConsoleTestLogger(t))
	r.Backoff = 0
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
	b := &fakeBackend{exists: func([]BulkItem) (map[string]bool, error) {
		return map[string]bool{"posts/a": false}, nil
	}}
	r := newTestRetrier(t, b)

	r.Handle(deleteItem("a"), 0, errTransport)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Equal(t, int64(1), r.Verified())
	assert.Empty(t, b.applied)
}

func TestBulkRetrierDeleteMissingFromCheckIsResent(t *testing.T) {
	b := &fakeBackend{} // the check says nothing about the doc
	r := newTestRetrier(t, b)

	r.Handle(deleteItem("a"), 0, errTransport)
	wait(t, r)

	assert.Zero(t, r.Verified())
	assert.Equal(t, []string{"a"}, b.applied)
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
		require.FailNow(t, "Wait returned while an item was pending")
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "Wait did not return after the queue drained")
	}
	assert.Equal(t, int64(1), r.Retried())
}

func TestBulkRetrierWaitStopsWhenContextEnds(t *testing.T) {
	r := newTestRetrier(t, &fakeBackend{hang: true})
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
		require.FailNow(t, "Handle blocked while Apply was stuck")
	}
	close(release)
	wait(t, r)
}

func TestBulkRetrierBackoffGrowsWithItemAttempts(t *testing.T) {
	r := NewBulkRetrier(&fakeBackend{}, mlog.CreateConsoleTestLogger(t))
	r.Backoff = time.Second

	assert.Equal(t, 1*time.Second, r.backoff([]retryItem{{attempts: 0}}))
	assert.Equal(t, 4*time.Second, r.backoff([]retryItem{{attempts: 2}}))
}

func TestBulkRetrierBackoffIgnoresOlderItemsWhenNewOnesArrive(t *testing.T) {
	r := NewBulkRetrier(&fakeBackend{}, mlog.CreateConsoleTestLogger(t))
	r.Backoff = time.Second

	assert.Equal(t, time.Second, r.backoff([]retryItem{{attempts: 3}, {attempts: 0}}))
}

func TestBulkRetrierCallTimeoutEndsHungBackend(t *testing.T) {
	b := &fakeBackend{hang: true}
	r := newTestRetrier(t, b)
	r.Timeout = 10 * time.Millisecond

	r.Handle(indexItem("a"), 0, errTransport)
	wait(t, r)

	assert.Equal(t, int64(1), r.Failed())
}

func TestBulkRetrierWaitStopsRetriesWhenContextEnds(t *testing.T) {
	b := &fakeBackend{hang: true}
	r := newTestRetrier(t, b)
	r.Handle(indexItem("a"), 0, errTransport)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	assert.Error(t, r.Wait(ctx))

	// The stopped item is already counted when Wait returns.
	assert.Equal(t, int64(1), r.Failed())
}

func TestBulkRetrierEachResendGetsItsOwnBody(t *testing.T) {
	var bodies []io.ReadSeeker
	b := &fakeBackend{apply: func(item BulkItem) (int, error) {
		bodies = append(bodies, item.Body)
		return http.StatusServiceUnavailable, nil
	}}
	r := newTestRetrier(t, b)

	item := indexItem("a")
	r.Handle(item, 0, errTransport)
	wait(t, r)

	require.Len(t, bodies, 4)
	assert.NotSame(t, bodies[0], bodies[1])
	assert.NotSame(t, item.Body, bodies[0])
}

// allFound answers that every doc exists.
func allFound(items []BulkItem) (map[string]bool, error) {
	found := map[string]bool{}
	for _, it := range items {
		found[it.Index+"/"+it.DocID] = true
	}
	return found, nil
}

func TestBulkRetrierChecksAtMost1000ItemsPerCall(t *testing.T) {
	b := &fakeBackend{exists: allFound}
	r := newTestRetrier(t, b)

	for i := 0; i < 2500; i++ {
		r.Handle(indexItem(strconv.Itoa(i)), 0, errTransport)
	}
	wait(t, r)

	total := 0
	for _, n := range b.chunks {
		assert.LessOrEqual(t, n, 1000)
		total += n
	}
	assert.Equal(t, 2500, total)
	assert.Equal(t, int64(2500), r.Verified())
}

func TestBulkRetrierHandlesManyCallersAtOnce(t *testing.T) {
	b := &fakeBackend{exists: allFound}
	r := newTestRetrier(t, b)

	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 100; i++ {
				r.Handle(indexItem(strconv.Itoa(i)), 0, errTransport)
			}
		}()
	}
	wg.Wait()
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Equal(t, int64(800), r.Verified())
}

func TestBulkRetrierTakesItemsThatArriveDuringARound(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	b := &fakeBackend{apply: func(item BulkItem) (int, error) {
		if item.DocID == "first" {
			close(started)
			<-release
		}
		return http.StatusOK, nil
	}}
	r := newTestRetrier(t, b)

	r.Handle(indexItem("first"), 0, errTransport)
	<-started // the round is running
	r.Handle(indexItem("second"), 0, errTransport)
	close(release)
	wait(t, r)

	assert.Zero(t, r.Failed())
	assert.Equal(t, int64(2), r.Retried())
}

func newLoggedRetrier(t *testing.T, b *fakeBackend) (*BulkRetrier, func(substr string) int) {
	logger, err := mlog.NewLogger()
	require.NoError(t, err)
	buf := &mlog.Buffer{}
	require.NoError(t, mlog.AddWriterTarget(logger, buf, true, mlog.StdAll...))
	t.Cleanup(func() { _ = logger.Shutdown() })

	r := NewBulkRetrier(b, logger)
	r.Backoff = 100 * time.Millisecond
	count := func(substr string) int {
		require.NoError(t, logger.Flush())
		return strings.Count(buf.String(), substr)
	}
	return r, count
}

func TestBulkRetrierLogsOneWarnPerRoundNotPerItem(t *testing.T) {
	b := &fakeBackend{exists: allFound}
	r, count := newLoggedRetrier(t, b)

	for i := 0; i < 100; i++ {
		r.Handle(indexItem(strconv.Itoa(i)), 0, errTransport)
	}
	wait(t, r)

	rounds := len(b.chunks) // 100 items fit one check call, so one call per round
	assert.Equal(t, rounds, count(`"level":"warn"`))
	assert.Less(t, rounds, 10)
	assert.Zero(t, count(`"level":"error"`))
}

func TestBulkRetrierLogsOneErrorForAGivenUpItem(t *testing.T) {
	b := &fakeBackend{apply: func(BulkItem) (int, error) { return 0, errTransport }}
	r, count := newLoggedRetrier(t, b)
	r.Backoff = 0

	r.Handle(indexItem("a"), 0, errTransport)
	wait(t, r)

	assert.Equal(t, 1, count(`"level":"error"`))
}

func TestBulkRetrierLogsOneWarnForARejectedResend(t *testing.T) {
	b := &fakeBackend{apply: func(BulkItem) (int, error) { return http.StatusBadRequest, nil }}
	r, count := newLoggedRetrier(t, b)

	r.Handle(indexItem("a"), 0, errTransport)
	wait(t, r)

	assert.Equal(t, 1, count("document rejected"))
}
