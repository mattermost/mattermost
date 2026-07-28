// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delivery_tracking_content_review

import (
	"context"
	"errors"
	"sort"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func rowCursor(row model.UserPostDelivery) model.UserPostDeliveryCursor {
	return model.UserPostDeliveryCursor{TargetID: row.TargetID, TargetType: row.TargetType, Mechanism: row.Mechanism}
}

func cursorLess(a, b model.UserPostDeliveryCursor) bool {
	if a.TargetID != b.TargetID {
		return a.TargetID < b.TargetID
	}
	if a.TargetType != b.TargetType {
		return a.TargetType < b.TargetType
	}
	return a.Mechanism < b.Mechanism
}

// fakeSource implements sourceReader with real keyset semantics over an
// in-memory, sorted set of rows, so the copy loop's cursor handling is
// exercised faithfully.
type fakeSource struct {
	rows       []model.UserPostDelivery
	err        error
	calls      int
	gotCursors []model.UserPostDeliveryCursor
}

func newFakeSource(rows []model.UserPostDelivery) *fakeSource {
	sorted := append([]model.UserPostDelivery(nil), rows...)
	sort.Slice(sorted, func(i, j int) bool {
		return cursorLess(rowCursor(sorted[i]), rowCursor(sorted[j]))
	})
	return &fakeSource{rows: sorted}
}

func (f *fakeSource) GetByPost(_ context.Context, postID string, after model.UserPostDeliveryCursor, limit int) ([]model.UserPostDelivery, error) {
	f.calls++
	f.gotCursors = append(f.gotCursors, after)
	if f.err != nil {
		return nil, f.err
	}
	out := []model.UserPostDelivery{}
	for _, row := range f.rows {
		if row.PostID != postID {
			continue
		}
		if after.IsFirstPage() || cursorLess(after, rowCursor(row)) {
			out = append(out, row)
			if len(out) == limit {
				break
			}
		}
	}
	return out, nil
}

// fakeTarget implements reviewWriter, recording every saved row, the review post ID,
// and the jobID.
type fakeTarget struct {
	saved         []model.UserPostDelivery
	reviewPostIDs []string
	jobIDs        []string
	err           error
	calls         int
}

func (f *fakeTarget) SaveBatch(_ context.Context, reviewPostID string, records []model.UserPostDelivery, jobID string) error {
	f.calls++
	if f.err != nil {
		return f.err
	}
	f.saved = append(f.saved, records...)
	f.reviewPostIDs = append(f.reviewPostIDs, reviewPostID)
	f.jobIDs = append(f.jobIDs, jobID)
	return nil
}

type fakeApp struct {
	calls []bool
	err   *model.AppError
}

func (f *fakeApp) NotifyDeliveryTrackingContentReviewRequesters(_ request.CTX, _ string, succeeded bool) *model.AppError {
	f.calls = append(f.calls, succeeded)
	return f.err
}

func makeRows(postID string, n int) []model.UserPostDelivery {
	out := make([]model.UserPostDelivery, n)
	for i := range n {
		out[i] = model.UserPostDelivery{
			PostID:     postID,
			TargetID:   model.NewId(),
			TargetType: model.DeliveryTargetUser,
			Mechanism:  model.DeliveryMechanismProduct,
			CreatedAt:  int64(1000 + i),
		}
	}
	return out
}

func neverStop() bool { return false }

func TestCopyPostDeliveries(t *testing.T) {
	ctx := context.Background()
	const jobID = "job-abc"

	t.Run("post with zero deliveries copies nothing and succeeds", func(t *testing.T) {
		postID := model.NewId()
		source := newFakeSource(nil)
		target := &fakeTarget{}

		copied, canceled, err := copyPostDeliveries(ctx, source, target, postID, []string{postID}, jobID, 2, neverStop, nil)
		require.NoError(t, err)
		require.False(t, canceled)
		require.Equal(t, 0, copied)
		require.Equal(t, 0, target.calls, "no SaveBatch calls for an empty post")
		require.Equal(t, 1, source.calls, "one read returns the empty page")
	})

	t.Run("multi-page copy returns every row exactly once", func(t *testing.T) {
		postID := model.NewId()
		rows := makeRows(postID, 5)
		source := newFakeSource(rows)
		target := &fakeTarget{}

		var progress []int
		onProgress := func(copied int) error { progress = append(progress, copied); return nil }

		copied, canceled, err := copyPostDeliveries(ctx, source, target, postID, []string{postID}, jobID, 2, neverStop, onProgress)
		require.NoError(t, err)
		require.False(t, canceled)
		require.Equal(t, 5, copied)

		// All rows saved exactly once (dedup by key), and jobID threaded through.
		require.Len(t, target.saved, 5)
		seen := map[model.UserPostDeliveryCursor]bool{}
		for _, row := range target.saved {
			require.False(t, seen[rowCursor(row)], "row saved more than once")
			seen[rowCursor(row)] = true
		}
		for _, savedJobID := range target.jobIDs {
			require.Equal(t, jobID, savedJobID)
		}
		require.Equal(t, []int{2, 4, 5}, progress, "cumulative progress reported per batch")
	})

	t.Run("full final page triggers one more empty read", func(t *testing.T) {
		postID := model.NewId()
		source := newFakeSource(makeRows(postID, 4))
		target := &fakeTarget{}

		copied, _, err := copyPostDeliveries(ctx, source, target, postID, []string{postID}, jobID, 2, neverStop, nil)
		require.NoError(t, err)
		require.Equal(t, 4, copied)
		require.Equal(t, 3, source.calls, "2 full pages + 1 empty page")
		require.Equal(t, 2, target.calls, "empty page is not saved")
	})

	t.Run("source unavailable surfaces the sentinel error", func(t *testing.T) {
		source := newFakeSource(nil)
		source.err = store.ErrUserPostDeliverySourceUnavailable
		target := &fakeTarget{}

		reviewID := model.NewId()
		copied, canceled, err := copyPostDeliveries(ctx, source, target, reviewID, []string{reviewID}, jobID, 2, neverStop, nil)
		require.ErrorIs(t, err, store.ErrUserPostDeliverySourceUnavailable)
		require.False(t, canceled)
		require.Equal(t, 0, copied)
		require.Equal(t, 0, target.calls)
	})

	t.Run("stop before first batch cancels immediately", func(t *testing.T) {
		postID := model.NewId()
		source := newFakeSource(makeRows(postID, 5))
		target := &fakeTarget{}

		copied, canceled, err := copyPostDeliveries(ctx, source, target, postID, []string{postID}, jobID, 2, func() bool { return true }, nil)
		require.NoError(t, err)
		require.True(t, canceled)
		require.Equal(t, 0, copied)
		require.Equal(t, 0, source.calls, "no reads once stopped")
	})

	t.Run("stop between batches cancels with partial progress", func(t *testing.T) {
		postID := model.NewId()
		source := newFakeSource(makeRows(postID, 6))
		target := &fakeTarget{}

		calls := 0
		shouldStop := func() bool {
			calls++
			return calls > 1 // allow the first batch, stop before the second
		}

		copied, canceled, err := copyPostDeliveries(ctx, source, target, postID, []string{postID}, jobID, 2, shouldStop, nil)
		require.NoError(t, err)
		require.True(t, canceled)
		require.Equal(t, 2, copied, "one batch copied before cancellation")
	})

	t.Run("SaveBatch error propagates and stops the copy", func(t *testing.T) {
		postID := model.NewId()
		source := newFakeSource(makeRows(postID, 4))
		wantErr := errors.New("write failed")
		target := &fakeTarget{err: wantErr}

		copied, canceled, err := copyPostDeliveries(ctx, source, target, postID, []string{postID}, jobID, 2, neverStop, nil)
		require.ErrorIs(t, err, wantErr)
		require.False(t, canceled)
		require.Equal(t, 0, copied)
	})

	t.Run("onProgress error propagates", func(t *testing.T) {
		postID := model.NewId()
		source := newFakeSource(makeRows(postID, 4))
		target := &fakeTarget{}
		wantErr := errors.New("progress failed")

		copied, canceled, err := copyPostDeliveries(ctx, source, target, postID, []string{postID}, jobID, 2, neverStop, func(int) error { return wantErr })
		require.ErrorIs(t, err, wantErr)
		require.False(t, canceled)
		require.Equal(t, 2, copied, "the first batch was written before progress failed")
	})

	t.Run("non-positive batch size falls back to the default", func(t *testing.T) {
		postID := model.NewId()
		source := newFakeSource(makeRows(postID, 3))
		target := &fakeTarget{}

		copied, _, err := copyPostDeliveries(ctx, source, target, postID, []string{postID}, jobID, 0, neverStop, nil)
		require.NoError(t, err)
		require.Equal(t, 3, copied)
		require.Equal(t, 1, target.calls, "default batch size is large, so a single page suffices")
	})

	t.Run("copies the reviewed post and its previewing posts under the review id", func(t *testing.T) {
		reviewPostID := model.NewId()
		previewer := model.NewId()
		rows := append(makeRows(reviewPostID, 2), makeRows(previewer, 3)...)
		source := newFakeSource(rows)
		target := &fakeTarget{}

		copied, canceled, err := copyPostDeliveries(ctx, source, target, reviewPostID, []string{reviewPostID, previewer}, jobID, 2, neverStop, nil)
		require.NoError(t, err)
		require.False(t, canceled)
		require.Equal(t, 5, copied, "rows from the reviewed post and the previewer are both copied")
		require.Len(t, target.saved, 5)
		for _, rid := range target.reviewPostIDs {
			require.Equal(t, reviewPostID, rid, "every batch is stamped with the review post id")
		}
		// Provenance is preserved: copied rows keep their own post_id.
		var fromReview, fromPreviewer int
		for _, row := range target.saved {
			switch row.PostID {
			case reviewPostID:
				fromReview++
			case previewer:
				fromPreviewer++
			}
		}
		require.Equal(t, 2, fromReview)
		require.Equal(t, 3, fromPreviewer)
	})
}

// newWorkerWithMockStore builds a Worker backed by a mock store and a real
// JobServer (with nil metrics) so DoJob's full lifecycle — claim, copy, progress
// persistence, and terminal status — can be exercised without a database.
func newWorkerWithMockStore(t *testing.T) (*Worker, *storetest.Store, *fakeApp) {
	t.Helper()

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfgSvc := &testutils.StaticConfigService{Cfg: cfg}

	mockStore := &storetest.Store{}
	jobServer := jobs.NewJobServer(cfgSvc, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)

	app := &fakeApp{}
	return MakeWorker(jobServer, mockStore, app), mockStore, app
}

func TestDoJob(t *testing.T) {
	const postID = "post-under-review"

	newJob := func() *model.Job {
		return &model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeDeliveryTrackingContentReview,
			Data: map[string]string{"post_id": postID},
		}
	}

	t.Run("copies the post's deliveries and marks the job successful", func(t *testing.T) {
		worker, mockStore, app := newWorkerWithMockStore(t)
		job := newJob()

		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(job, nil).Once()

		// The reviewed post has no previewing posts, so only its own deliveries are copied.
		mockStore.PostStore.On("GetPostPreviews", mock.Anything, postID).Return([]string{}, nil).Once()
		rows := makeRows(postID, 3)
		mockStore.UserPostDeliveryStore.On("GetByPost", mock.Anything, postID, mock.Anything, mock.Anything).Return(rows, nil).Once()
		mockStore.UserPostDeliveryContentReviewStore.On("SaveBatch", mock.Anything, postID, mock.Anything, job.Id).Return(nil).Once()

		// onProgress persists the running count via PatchJobData; the returned map
		// (carrying records_copied) refreshes the worker's in-memory job.Data.
		mockStore.JobStore.On("PatchJobData", job.Id, mock.Anything, mock.Anything).Return(model.StringMap{"post_id": postID, "records_copied": "3"}, nil)
		mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusSuccess).Return(job, nil).Once()
		// The cancellation watcher polls Get only after a multi-second interval, so
		// a fast job usually never reads it; allow it for slow CI runs.
		mockStore.JobStore.On("Get", mock.Anything, job.Id).Return(job, nil).Maybe()

		worker.DoJob(job)

		require.Equal(t, "3", job.Data["records_copied"], "the final copied count is persisted on the job")
		require.Equal(t, []bool{true}, app.calls, "requesters are notified of the successful completion")
		mockStore.JobStore.AssertExpectations(t)
		mockStore.UserPostDeliveryStore.AssertExpectations(t)
		mockStore.UserPostDeliveryContentReviewStore.AssertExpectations(t)
	})

	t.Run("a job missing its post_id is failed", func(t *testing.T) {
		worker, mockStore, app := newWorkerWithMockStore(t)
		job := &model.Job{Id: model.NewId(), Type: model.JobTypeDeliveryTrackingContentReview, Data: map[string]string{}}

		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(job, nil).Once()
		mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(job, nil).Once()
		mockStore.JobStore.On("Get", mock.Anything, job.Id).Return(job, nil).Maybe()

		worker.DoJob(job)

		require.Contains(t, job.Data["error"], "missing post_id", "the failure reason is recorded on the job")
		require.Equal(t, []bool{false}, app.calls, "a failed job notifies requesters of the failure")
		mockStore.JobStore.AssertExpectations(t)
		mockStore.UserPostDeliveryStore.AssertNotCalled(t, "GetByPost")
	})

	t.Run("a job already claimed elsewhere is skipped without side effects", func(t *testing.T) {
		worker, mockStore, app := newWorkerWithMockStore(t)
		job := newJob()

		// A nil return from UpdateStatusOptimistically means the row was not in the
		// expected Pending state (another node claimed it); DoJob must bail out.
		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(nil, nil).Once()

		worker.DoJob(job)

		require.Empty(t, app.calls, "a job claimed by another node notifies no one")
		mockStore.JobStore.AssertExpectations(t)
		mockStore.UserPostDeliveryStore.AssertNotCalled(t, "GetByPost")
	})

	t.Run("an unavailable source pool fails the job", func(t *testing.T) {
		worker, mockStore, app := newWorkerWithMockStore(t)
		job := newJob()

		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(job, nil).Once()
		mockStore.PostStore.On("GetPostPreviews", mock.Anything, postID).Return([]string{}, nil).Once()
		mockStore.UserPostDeliveryStore.On("GetByPost", mock.Anything, postID, mock.Anything, mock.Anything).Return(nil, store.ErrUserPostDeliverySourceUnavailable).Once()
		mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(job, nil).Once()
		mockStore.JobStore.On("Get", mock.Anything, job.Id).Return(job, nil).Maybe()

		worker.DoJob(job)

		require.Contains(t, job.Data["error"], "source pool", "the source-unavailable reason is recorded on the job")
		require.Equal(t, []bool{false}, app.calls, "a failed job notifies requesters of the failure")
		mockStore.JobStore.AssertExpectations(t)
		mockStore.UserPostDeliveryStore.AssertExpectations(t)
		mockStore.UserPostDeliveryContentReviewStore.AssertNotCalled(t, "SaveBatch")
	})

	t.Run("a stopped worker cancels the job before reading the source", func(t *testing.T) {
		worker, mockStore, app := newWorkerWithMockStore(t)
		job := newJob()

		// A stopped worker makes shouldStop() fire on the first loop iteration,
		// before any source read, so the copy is abandoned and the job is canceled.
		close(worker.stop)

		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(job, nil).Once()
		mockStore.PostStore.On("GetPostPreviews", mock.Anything, postID).Return([]string{}, nil).Once()
		mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusCanceled).Return(job, nil).Once()
		mockStore.JobStore.On("Get", mock.Anything, job.Id).Return(job, nil).Maybe()

		worker.DoJob(job)

		require.Empty(t, app.calls, "a canceled job notifies no one")
		mockStore.JobStore.AssertExpectations(t)
		mockStore.UserPostDeliveryStore.AssertNotCalled(t, "GetByPost")
	})

	t.Run("also copies the deliveries of posts that preview the reviewed post", func(t *testing.T) {
		worker, mockStore, app := newWorkerWithMockStore(t)
		job := newJob()
		const previewer = "previewing-post-000000000"

		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(job, nil).Once()
		mockStore.PostStore.On("GetPostPreviews", mock.Anything, postID).Return([]string{previewer}, nil).Once()
		// Both the reviewed post and its previewer are read from the source...
		mockStore.UserPostDeliveryStore.On("GetByPost", mock.Anything, postID, mock.Anything, mock.Anything).Return(makeRows(postID, 2), nil).Once()
		mockStore.UserPostDeliveryStore.On("GetByPost", mock.Anything, previewer, mock.Anything, mock.Anything).Return(makeRows(previewer, 1), nil).Once()
		// ...and both are written under the reviewed post's review id.
		mockStore.UserPostDeliveryContentReviewStore.On("SaveBatch", mock.Anything, postID, mock.Anything, job.Id).Return(nil).Twice()
		mockStore.JobStore.On("PatchJobData", job.Id, mock.Anything, mock.Anything).Return(model.StringMap{"post_id": postID, "records_copied": "3"}, nil)
		mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusSuccess).Return(job, nil).Once()
		mockStore.JobStore.On("Get", mock.Anything, job.Id).Return(job, nil).Maybe()

		worker.DoJob(job)

		require.Equal(t, []bool{true}, app.calls)
		mockStore.UserPostDeliveryStore.AssertExpectations(t)
		mockStore.UserPostDeliveryContentReviewStore.AssertExpectations(t)
	})

	t.Run("a failure loading the previewing posts fails the job", func(t *testing.T) {
		worker, mockStore, app := newWorkerWithMockStore(t)
		job := newJob()

		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(job, nil).Once()
		mockStore.PostStore.On("GetPostPreviews", mock.Anything, postID).Return(nil, store.NewErrNotFound("Post", postID)).Once()
		mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(job, nil).Once()
		mockStore.JobStore.On("Get", mock.Anything, job.Id).Return(job, nil).Maybe()

		worker.DoJob(job)

		require.Equal(t, []bool{false}, app.calls, "a failed job notifies requesters of the failure")
		mockStore.UserPostDeliveryStore.AssertNotCalled(t, "GetByPost")
	})
}
