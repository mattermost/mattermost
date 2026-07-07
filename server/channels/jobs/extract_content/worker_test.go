// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package extract_content

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

type trackingApp struct {
	errOn map[string]error
	calls []string
}

func (a *trackingApp) ExtractContentFromFileInfo(_ request.CTX, fileInfo *model.FileInfo) error {
	a.calls = append(a.calls, fileInfo.Id)
	if err, ok := a.errOn[fileInfo.Id]; ok {
		return err
	}
	return nil
}

func makeTestJobServer(t *testing.T) (*jobs.JobServer, *storetest.Store) {
	t.Helper()

	mockStore := &storetest.Store{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
	})

	jobServer := jobs.NewJobServer(
		&testutils.StaticConfigService{},
		mockStore,
		nil,
		mlog.CreateConsoleTestLogger(t),
	)

	return jobServer, mockStore
}

func expectJobDataUpdate(mockStore *storetest.Store) {
	mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(true, nil)
}

func expectWorkerJobCompletion(mockStore *storetest.Store, job *model.Job) {
	claimed := *job
	claimed.Status = model.JobStatusInProgress
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(&claimed, nil)
	mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusSuccess).Return(&claimed, nil)
}

func makeFileInfo(id string, createAt int64, ext string) *model.FileInfo {
	return &model.FileInfo{
		Id:        id,
		CreateAt:  createAt,
		Extension: ext,
		Name:      "file." + ext,
		Path:      "path/" + id,
	}
}

func makeFileInfoBatch(n int, startCreateAt int64) []*model.FileInfo {
	batch := make([]*model.FileInfo, n)
	for i := range n {
		batch[i] = makeFileInfo(model.NewId(), startCreateAt+int64(i), "pdf")
	}
	return batch
}

func TestRunCatchupExtraction(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("extracts non-ignored files and passes OnlyEmptyContent filter", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		pdf := makeFileInfo("pdf1", 1000, "pdf")
		png := makeFileInfo("png1", 1001, "png")
		docx := makeFileInfo("docx1", 1002, "docx")

		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.MatchedBy(func(opt *model.GetFileInfosOptions) bool {
			return opt.OnlyEmptyContent && !opt.IncludeDeleted && opt.SortBy == model.FileinfoSortByCreated
		})).Return([]*model.FileInfo{pdf, png, docx}, nil).Once()

		app := &trackingApp{}
		job := &model.Job{Data: map[string]string{}}

		err := runCatchupExtraction(logger, job, jobServer, app, mockStore)
		require.NoError(t, err)

		require.Equal(t, []string{"pdf1", "docx1"}, app.calls)
		require.Equal(t, "2", job.Data["processed"])
		require.Equal(t, "0", job.Data["errors"])
	})

	t.Run("empty result is a no-op", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.Anything).Return(nil, nil).Once()

		job := &model.Job{Data: map[string]string{}}
		err := runCatchupExtraction(logger, job, jobServer, &trackingApp{}, mockStore)
		require.NoError(t, err)

		require.Equal(t, "0", job.Data["processed"])
		require.Equal(t, "0", job.Data["errors"])
	})

	t.Run("full batch advances cursor and fetches the next page", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		first := makeFileInfoBatch(catchupBatchSize, 1000)
		second := []*model.FileInfo{makeFileInfo("tail1", 2000, "pdf"), makeFileInfo("tail2", 2001, "pdf")}

		var firstPageOpts *model.GetFileInfosOptions
		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.MatchedBy(func(opt *model.GetFileInfosOptions) bool {
			return opt.OnlyEmptyContent
		})).Run(func(args mock.Arguments) {
			opt := args.Get(2).(*model.GetFileInfosOptions)
			copied := *opt
			firstPageOpts = &copied
		}).Return(first, nil).Once()
		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.MatchedBy(func(opt *model.GetFileInfosOptions) bool {
			return opt.Since == 1999+1
		})).Return(second, nil).Once()

		sinceLower := model.GetMillis() - catchupLookback.Milliseconds()
		app := &trackingApp{}
		job := &model.Job{Data: map[string]string{}}

		err := runCatchupExtraction(logger, job, jobServer, app, mockStore)
		sinceUpper := model.GetMillis() - catchupLookback.Milliseconds()
		require.NoError(t, err)

		require.NotNil(t, firstPageOpts)
		require.GreaterOrEqual(t, firstPageOpts.Since, sinceLower)
		require.LessOrEqual(t, firstPageOpts.Since, sinceUpper)
		require.Len(t, app.calls, catchupBatchSize+2)
		require.Equal(t, "1002", job.Data["processed"])
	})

	t.Run("partial batch terminates after one fetch", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		batch := []*model.FileInfo{
			makeFileInfo("f1", 1000, "pdf"),
			makeFileInfo("f2", 1001, "pdf"),
			makeFileInfo("f3", 1002, "pdf"),
		}
		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.Anything).Return(batch, nil).Once()

		job := &model.Job{Data: map[string]string{}}
		err := runCatchupExtraction(logger, job, jobServer, &trackingApp{}, mockStore)
		require.NoError(t, err)

		require.Equal(t, "3", job.Data["processed"])
	})

	t.Run("accumulates extraction errors in job data", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		okFile := makeFileInfo("ok", 1000, "pdf")
		failFile := makeFileInfo("fail", 1001, "pdf")
		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.Anything).
			Return([]*model.FileInfo{okFile, failFile}, nil).Once()

		app := &trackingApp{errOn: map[string]error{"fail": errors.New("extract failed")}}
		job := &model.Job{Data: map[string]string{}}

		err := runCatchupExtraction(logger, job, jobServer, app, mockStore)
		require.NoError(t, err)

		require.Equal(t, "2", job.Data["processed"])
		require.Equal(t, "1", job.Data["errors"])
	})

	t.Run("store error propagates", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)

		wantErr := errors.New("store failed")
		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.Anything).Return(nil, wantErr).Once()

		job := &model.Job{Data: map[string]string{}}
		err := runCatchupExtraction(logger, job, jobServer, &trackingApp{}, mockStore)
		require.ErrorIs(t, err, wantErr)
	})
}

func TestWorkerDispatch(t *testing.T) {
	t.Run("catchup job uses OnlyEmptyContent filter", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.MatchedBy(func(opt *model.GetFileInfosOptions) bool {
			return opt.OnlyEmptyContent
		})).Return(nil, nil).Once()

		worker := MakeWorker(jobServer, &trackingApp{}, mockStore)
		job := &model.Job{Id: model.NewId(), Data: map[string]string{catchupJobDataKey: "true"}}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)
	})

	t.Run("range job does not use OnlyEmptyContent filter", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		mockStore.FileInfoStore.On("GetWithOptions", 0, catchupBatchSize, mock.MatchedBy(func(opt *model.GetFileInfosOptions) bool {
			return !opt.OnlyEmptyContent
		})).Return(nil, nil).Once()

		worker := MakeWorker(jobServer, &trackingApp{}, mockStore)
		job := &model.Job{Id: model.NewId(), Data: map[string]string{}}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)
	})
}

func TestSchedulerScheduleJob(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	jobServer, mockStore := makeTestJobServer(t)

	app := &trackingApp{}
	jobServer.RegisterJobType(model.JobTypeExtractContent, MakeWorker(jobServer, app, mockStore), nil)

	savedJob := &model.Job{
		Id:   model.NewId(),
		Type: model.JobTypeExtractContent,
		Data: map[string]string{catchupJobDataKey: "true"},
	}
	mockStore.JobStore.On("Save", mock.MatchedBy(func(job *model.Job) bool {
		return job.Type == model.JobTypeExtractContent && job.Data[catchupJobDataKey] == "true"
	})).Return(savedJob, nil)

	scheduler := MakeScheduler(jobServer)
	job, appErr := scheduler.ScheduleJob(request.EmptyContext(logger), &model.Config{}, false, nil)
	require.Nil(t, appErr)
	require.NotNil(t, job)
	require.Equal(t, "true", job.Data[catchupJobDataKey])
}
