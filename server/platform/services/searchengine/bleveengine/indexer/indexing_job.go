// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package indexer

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine/bleveengine"
)

const (
	timeBetweenBatches = 100 * time.Millisecond

	estimatedPostCount    = 10000000
	estimatedFilesCount   = 100000
	estimatedChannelCount = 100000
	estimatedUserCount    = 10000
)

type BleveIndexerWorker struct {
	name string
	// stateMut protects stopCh and helps enforce
	// ordering in case subsequent Run or Stop calls are made.
	stateMut  sync.Mutex
	stopCh    chan struct{}
	stoppedCh chan bool
	jobs      chan model.Job
	jobServer *jobs.JobServer
	logger    mlog.LoggerIFace
	engine    *bleveengine.BleveEngine
	stopped   bool
}

func MakeWorker(jobServer *jobs.JobServer, engine *bleveengine.BleveEngine) *BleveIndexerWorker {
	if engine == nil {
		return nil
	}
	const workerName = "BleveIndexer"
	return &BleveIndexerWorker{
		name:      workerName,
		stoppedCh: make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: jobServer,
		logger:    jobServer.Logger().With(mlog.String("worker_name", workerName)),
		engine:    engine,
		stopped:   true,
	}
}

type IndexingProgress struct {
	Now            time.Time
	StartAtTime    int64
	EndAtTime      int64
	LastEntityTime int64

	TotalPostsCount int64
	DonePostsCount  int64
	DonePosts       bool
	LastPostID      string

	TotalFilesCount int64
	DoneFilesCount  int64
	DoneFiles       bool
	LastFileID      string

	TotalChannelsCount int64
	DoneChannelsCount  int64
	DoneChannels       bool
	LastChannelID      string

	TotalUsersCount int64
	DoneUsersCount  int64
	DoneUsers       bool
	LastUserID      string
}

func (ip *IndexingProgress) CurrentProgress() int64 {
	return (ip.DonePostsCount + ip.DoneChannelsCount + ip.DoneUsersCount + ip.DoneFilesCount) * 100 / (ip.TotalPostsCount + ip.TotalChannelsCount + ip.TotalUsersCount + ip.TotalFilesCount)
}

func (ip *IndexingProgress) IsDone() bool {
	return ip.DonePosts && ip.DoneChannels && ip.DoneUsers && ip.DoneFiles
}

func (worker *BleveIndexerWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *BleveIndexerWorker) IsEnabled(cfg *model.Config) bool {
	return true
}

func (worker *BleveIndexerWorker) Run() {
	worker.stateMut.Lock()
	// We have to re-assign the stop channel again, because
	// it might happen that the job was restarted due to a config change.
	if worker.stopped {
		worker.stopped = false
		worker.stopCh = make(chan struct{})
	} else {
		worker.stateMut.Unlock()
		return
	}
	// Run is called from a separate goroutine and doesn't return.
	// So we cannot Unlock in a defer clause.
	worker.stateMut.Unlock()

	worker.logger.Debug("Worker Started")

	defer func() {
		worker.logger.Debug("Worker: Finished")
		worker.stoppedCh <- true
	}()

	for {
		select {
		case <-worker.stopCh:
			worker.logger.Debug("Worker: Received stop signal")
			return
		case job := <-worker.jobs:
			worker.DoJob(&job)
		}
	}
}

func (worker *BleveIndexerWorker) Stop() {
	worker.stateMut.Lock()
	defer worker.stateMut.Unlock()

	// Set to close, and if already closed before, then return.
	if worker.stopped {
		return
	}
	worker.stopped = true
	worker.logger.Debug("Worker Stopping")
	close(worker.stopCh)
	<-worker.stoppedCh
}

func (worker *BleveIndexerWorker) DoJob(job *model.Job) {
	logger := worker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")

	var appErr *model.AppError
	job, appErr = worker.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn("Worker: Error occurred while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	logger.Info("Worker: Indexing job claimed by worker")

	if !worker.engine.IsActive() {
		appError := model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.do_job.engine_inactive", nil, "", http.StatusInternalServerError)
		if err := worker.jobServer.SetJobError(job, appError); err != nil {
			logger.Error("Worker: Failed to run job as ")
		}
		return
	}

	progress := IndexingProgress{
		Now:          time.Now(),
		DonePosts:    false,
		DoneChannels: false,
		DoneUsers:    false,
		DoneFiles:    false,
		StartAtTime:  0,
		EndAtTime:    model.GetMillis(),
	}

	// Extract the start and end times, if they are set.
	if startString, ok := job.Data["start_time"]; ok {
		startInt, err := strconv.ParseInt(startString, 10, 64)
		if err != nil {
			logger.Error("Worker: Failed to parse start_time for job", mlog.String("start_time", startString), mlog.Err(err))
			appError := model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.do_job.parse_start_time.error", nil, "", http.StatusInternalServerError).Wrap(err)
			if err := worker.jobServer.SetJobError(job, appError); err != nil {
				logger.Error("Worker: Failed to set job error", mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return
		}
		progress.StartAtTime = startInt
	} else {
		// Set start time to oldest entity in the database.
		// A user or a channel may be created before any post.
		oldestEntityCreationTime, err := worker.jobServer.Store.Post().GetOldestEntityCreationTime()
		if err != nil {
			logger.Error("Worker: Failed to fetch oldest entity for job.", mlog.String("start_time", startString), mlog.Err(err))
			appError := model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.do_job.get_oldest_entity.error", nil, "", http.StatusInternalServerError).Wrap(err)
			if err := worker.jobServer.SetJobError(job, appError); err != nil {
				logger.Error("Worker: Failed to set job error", mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return
		}
		progress.StartAtTime = oldestEntityCreationTime
	}
	progress.LastEntityTime = progress.StartAtTime

	if endString, ok := job.Data["end_time"]; ok {
		endInt, err := strconv.ParseInt(endString, 10, 64)
		if err != nil {
			logger.Error("Worker: Failed to parse end_time for job", mlog.String("end_time", endString), mlog.Err(err))
			appError := model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.do_job.parse_end_time.error", nil, "", http.StatusInternalServerError).Wrap(err)
			if err := worker.jobServer.SetJobError(job, appError); err != nil {
				logger.Error("Worker: Failed to set job errorv", mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return
		}
		progress.EndAtTime = endInt
	}

	if id, ok := job.Data["start_post_id"]; ok {
		progress.LastPostID = id
	}
	if id, ok := job.Data["start_channel_id"]; ok {
		progress.LastChannelID = id
	}
	if id, ok := job.Data["start_user_id"]; ok {
		progress.LastUserID = id
	}
	if id, ok := job.Data["start_file_id"]; ok {
		progress.LastFileID = id
	}

	// Counting all posts may fail or timeout when the posts table is large. If this happens, log a warning, but carry
	// on with the indexing job anyway. The only issue is that the progress % reporting will be inaccurate.
	if count, err := worker.jobServer.Store.Post().AnalyticsPostCount(&model.PostCountOptions{}); err != nil {
		logger.Warn("Worker: Failed to fetch total post count for job. An estimated value will be used for progress reporting.", mlog.Err(err))
		progress.TotalPostsCount = estimatedPostCount
	} else {
		progress.TotalPostsCount = count
	}

	// Same possible fail as above can happen when counting channels
	if count, err := worker.jobServer.Store.Channel().AnalyticsTypeCount("", ""); err != nil {
		logger.Warn("Worker: Failed to fetch total channel count for job. An estimated value will be used for progress reporting.", mlog.Err(err))
		progress.TotalChannelsCount = estimatedChannelCount
	} else {
		progress.TotalChannelsCount = count
	}

	// Same possible fail as above can happen when counting users
	if count, err := worker.jobServer.Store.User().Count(model.UserCountOptions{
		IncludeBotAccounts: true, // This actually doesn't join with the bots table
		// since ExcludeRegularUsers is set to false
	}); err != nil {
		logger.Warn("Worker: Failed to fetch total user count for job. An estimated value will be used for progress reporting.", mlog.Err(err))
		progress.TotalUsersCount = estimatedUserCount
	} else {
		progress.TotalUsersCount = count
	}

	// Counting all files may fail or timeout when the file_info table is large. If this happens, log a warning, but carry
	// on with the indexing job anyway. The only issue is that the progress % reporting will be inaccurate.
	if count, err := worker.jobServer.Store.FileInfo().CountAll(); err != nil {
		logger.Warn("Worker: Failed to fetch total file info count for job. An estimated value will be used for progress reporting.", mlog.Err(err))
		progress.TotalFilesCount = estimatedFilesCount
	} else {
		progress.TotalFilesCount = count
	}

	var cancelContext request.CTX = request.EmptyContext(worker.logger)
	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	cancelContext = cancelContext.WithContext(cancelCtx)
	go worker.jobServer.CancellationWatcher(cancelContext, job.Id, cancelWatcherChan)
	defer cancelCancelWatcher()

	for {
		select {
		case <-cancelWatcherChan:
			logger.Info("Worker: Indexing job has been canceled via CancellationWatcher")
			if err := worker.jobServer.SetJobCanceled(job); err != nil {
				logger.Error("Worker: Failed to mark job as cancelled", mlog.Err(err))
			}
			return

		case <-worker.stopCh:
			logger.Info("Worker: Indexing has been canceled via Worker Stop")
			if err := worker.jobServer.SetJobCanceled(job); err != nil {
				logger.Error("Worker: Failed to mark job as canceled", mlog.Err(err))
			}
			return

		case <-time.After(timeBetweenBatches):
			var err *model.AppError
			if progress, err = worker.IndexBatch(logger, progress); err != nil {
				logger.Error("Worker: Failed to index batch for job", mlog.Err(err))
				if err2 := worker.jobServer.SetJobError(job, err); err2 != nil {
					logger.Error("Worker: Failed to set job error", mlog.Err(err2), mlog.NamedErr("set_error", err))
				}
				return
			}

			// Storing the batch progress in metadata.
			if job.Data == nil {
				job.Data = make(model.StringMap)
			}

			job.Data["start_time"] = strconv.FormatInt(progress.LastEntityTime, 10)
			job.Data["start_post_id"] = progress.LastPostID
			job.Data["start_channel_id"] = progress.LastChannelID
			job.Data["start_user_id"] = progress.LastUserID
			job.Data["start_file_id"] = progress.LastFileID
			job.Data["original_start_time"] = strconv.FormatInt(progress.StartAtTime, 10)
			job.Data["end_time"] = strconv.FormatInt(progress.EndAtTime, 10)

			if err := worker.jobServer.SetJobProgress(job, progress.CurrentProgress()); err != nil {
				logger.Error("Worker: Failed to set progress for job", mlog.Err(err))
				if err2 := worker.jobServer.SetJobError(job, err); err2 != nil {
					logger.Error("Worker: Failed to set error for job", mlog.Err(err2), mlog.NamedErr("set_error", err))
				}
				return
			}

			if progress.IsDone() {
				if err := worker.jobServer.SetJobSuccess(job); err != nil {
					logger.Error("Worker: Failed to set success for job", mlog.Err(err))
					if err2 := worker.jobServer.SetJobError(job, err); err2 != nil {
						logger.Error("Worker: Failed to set error for job", mlog.Err(err2), mlog.NamedErr("set_error", err))
					}
				}
				logger.Info("Worker: Indexing job finished successfully")
				return
			}
		}
	}
}

func (worker *BleveIndexerWorker) IndexBatch(logger mlog.LoggerIFace, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	if !progress.DonePosts {
		return worker.IndexPostsBatch(logger, progress)
	}
	if !progress.DoneChannels {
		return worker.IndexChannelsBatch(logger, progress)
	}
	if !progress.DoneUsers {
		return worker.IndexUsersBatch(logger, progress)
	}
	if !progress.DoneFiles {
		return worker.IndexFilesBatch(logger, progress)
	}
	return progress, model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.index_batch.nothing_left_to_index.error", nil, "", http.StatusInternalServerError)
}

func (worker *BleveIndexerWorker) IndexPostsBatch(logger mlog.LoggerIFace, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	var posts []*model.PostForIndexing

	tries := 0
	for posts == nil {
		var err error
		posts, err = worker.jobServer.Store.Post().GetPostsBatchForIndexing(progress.LastEntityTime, progress.LastPostID, *worker.jobServer.Config().BleveSettings.BatchSize)
		if err != nil {
			if tries >= 10 {
				return progress, model.NewAppError("IndexPostsBatch", "app.post.get_posts_batch_for_indexing.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			logger.Warn("Failed to get posts batch for indexing. Retrying.", mlog.Err(err))

			// Wait a bit before trying again.
			time.Sleep(15 * time.Second)
		}

		tries++
	}

	// Handle zero messages.
	if len(posts) == 0 {
		progress.DonePosts = true
		progress.LastEntityTime = progress.StartAtTime
		return progress, nil
	}

	lastPost, err := worker.BulkIndexPosts(posts, progress)
	if err != nil {
		return progress, err
	}

	// Our exit condition is when the last post's createAt reaches the initial endAtTime
	// set during job creation.
	if progress.EndAtTime <= lastPost.CreateAt {
		progress.DonePosts = true
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = lastPost.CreateAt
	}

	progress.LastPostID = lastPost.Id
	progress.DonePostsCount += int64(len(posts))

	return progress, nil
}

func (worker *BleveIndexerWorker) BulkIndexPosts(posts []*model.PostForIndexing, progress IndexingProgress) (*model.Post, *model.AppError) {
	batch := worker.engine.PostIndex.NewBatch()

	for _, post := range posts {
		if post.DeleteAt == 0 {
			searchPost := bleveengine.BLVPostFromPostForIndexing(post)
			batch.Index(searchPost.Id, searchPost)
		} else {
			batch.Delete(post.Id)
		}
	}

	worker.engine.Mutex.RLock()
	defer worker.engine.Mutex.RUnlock()

	if err := worker.engine.PostIndex.Batch(batch); err != nil {
		return nil, model.NewAppError("BleveIndexerWorker.BulkIndexPosts", "bleveengine.indexer.do_job.bulk_index_posts.batch_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &posts[len(posts)-1].Post, nil
}

func (worker *BleveIndexerWorker) IndexFilesBatch(logger mlog.LoggerIFace, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	var files []*model.FileForIndexing

	tries := 0
	for files == nil {
		var err error
		files, err = worker.jobServer.Store.FileInfo().GetFilesBatchForIndexing(progress.LastEntityTime, progress.LastFileID, true, *worker.jobServer.Config().BleveSettings.BatchSize)
		if err != nil {
			if tries >= 10 {
				return progress, model.NewAppError("IndexFilesBatch", "app.post.get_files_batch_for_indexing.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			logger.Warn("Failed to get files batch for indexing. Retrying.", mlog.Err(err))

			// Wait a bit before trying again.
			time.Sleep(15 * time.Second)
		}

		tries++
	}

	if len(files) == 0 {
		progress.DoneFiles = true
		progress.LastEntityTime = progress.StartAtTime
		return progress, nil
	}

	lastFile, err := worker.BulkIndexFiles(files, progress)
	if err != nil {
		return progress, err
	}

	// Our exit condition is when the last file's createAt reaches the initial endAtTime
	// set during job creation.
	if progress.EndAtTime <= lastFile.CreateAt {
		progress.DoneFiles = true
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = lastFile.CreateAt
	}

	progress.LastFileID = lastFile.Id
	progress.DoneFilesCount += int64(len(files))

	return progress, nil
}

func (worker *BleveIndexerWorker) BulkIndexFiles(files []*model.FileForIndexing, progress IndexingProgress) (*model.FileInfo, *model.AppError) {
	batch := worker.engine.FileIndex.NewBatch()

	for _, file := range files {
		if file.ShouldIndex() {
			searchFile := bleveengine.BLVFileFromFileForIndexing(file)
			batch.Index(searchFile.Id, searchFile)
		} else {
			batch.Delete(file.Id)
		}
	}

	worker.engine.Mutex.RLock()
	defer worker.engine.Mutex.RUnlock()

	if err := worker.engine.FileIndex.Batch(batch); err != nil {
		return nil, model.NewAppError("BleveIndexerWorker.BulkIndexPosts", "bleveengine.indexer.do_job.bulk_index_files.batch_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &files[len(files)-1].FileInfo, nil
}

func (worker *BleveIndexerWorker) IndexChannelsBatch(logger mlog.LoggerIFace, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	var channels []*model.Channel

	tries := 0
	for channels == nil {
		var nErr error
		channels, nErr = worker.jobServer.Store.Channel().GetChannelsBatchForIndexing(progress.LastEntityTime, progress.LastChannelID, *worker.jobServer.Config().BleveSettings.BatchSize)
		if nErr != nil {
			if tries >= 10 {
				return progress, model.NewAppError("BleveIndexerWorker.IndexChannelsBatch", "app.channel.get_channels_batch_for_indexing.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}

			logger.Warn("Failed to get channels batch for indexing. Retrying.", mlog.Err(nErr))

			// Wait a bit before trying again.
			time.Sleep(15 * time.Second)
		}
		tries++
	}

	if len(channels) == 0 {
		progress.DoneChannels = true
		progress.LastEntityTime = progress.StartAtTime
		return progress, nil
	}

	lastChannel, err := worker.BulkIndexChannels(logger, channels, progress)
	if err != nil {
		return progress, err
	}

	// Our exit condition is when the last channel's createAt reaches the initial endAtTime
	// set during job creation.
	if progress.EndAtTime <= lastChannel.CreateAt {
		progress.DoneChannels = true
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = lastChannel.CreateAt
	}

	progress.LastChannelID = lastChannel.Id
	progress.DoneChannelsCount += int64(len(channels))

	return progress, nil
}

func (worker *BleveIndexerWorker) BulkIndexChannels(logger mlog.LoggerIFace, channels []*model.Channel, progress IndexingProgress) (*model.Channel, *model.AppError) {
	batch := worker.engine.ChannelIndex.NewBatch()

	for _, channel := range channels {
		if channel.DeleteAt == 0 {
			var userIDs []string
			var err error
			if channel.Type == model.ChannelTypePrivate {
				userIDs, err = worker.jobServer.Store.Channel().GetAllChannelMemberIdsByChannelId(channel.Id)
				if err != nil {
					return nil, model.NewAppError("BleveIndexerWorker.BulkIndexChannels", "bleveengine.indexer.do_job.bulk_index_channels.batch_error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
			}

			// Get teamMember ids from channelid
			teamMemberIDs, err := worker.jobServer.Store.Channel().GetTeamMembersForChannel(channel.Id)
			if err != nil {
				return nil, model.NewAppError("BleveIndexerWorker.BulkIndexChannels", "bleveengine.indexer.do_job.bulk_index_channels.batch_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			searchChannel := bleveengine.BLVChannelFromChannel(channel, userIDs, teamMemberIDs)
			batch.Index(searchChannel.Id, searchChannel)
		} else {
			batch.Delete(channel.Id)
		}
	}

	worker.engine.Mutex.RLock()
	defer worker.engine.Mutex.RUnlock()

	if err := worker.engine.ChannelIndex.Batch(batch); err != nil {
		return nil, model.NewAppError("BleveIndexerWorker.BulkIndexChannels", "bleveengine.indexer.do_job.bulk_index_channels.batch_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return channels[len(channels)-1], nil
}

func (worker *BleveIndexerWorker) IndexUsersBatch(logger mlog.LoggerIFace, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	var users []*model.UserForIndexing

	tries := 0
	for users == nil {
		if usersBatch, err := worker.jobServer.Store.User().GetUsersBatchForIndexing(progress.LastEntityTime, progress.LastUserID, *worker.jobServer.Config().BleveSettings.BatchSize); err != nil {
			if tries >= 10 {
				return progress, model.NewAppError("IndexUsersBatch", "app.user.get_users_batch_for_indexing.get_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			logger.Warn("Failed to get users batch for indexing. Retrying.", mlog.Err(err))

			// Wait a bit before trying again.
			time.Sleep(15 * time.Second)
		} else {
			users = usersBatch
		}

		tries++
	}

	if len(users) == 0 {
		progress.DoneUsers = true
		progress.LastEntityTime = progress.StartAtTime
		return progress, nil
	}

	lastUser, err := worker.BulkIndexUsers(logger, users, progress)
	if err != nil {
		return progress, err
	}

	// Our exit condition is when the last user's createAt reaches the initial endAtTime
	// set during job creation.
	if progress.EndAtTime <= lastUser.CreateAt {
		progress.DoneUsers = true
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = lastUser.CreateAt
	}
	progress.LastUserID = lastUser.Id
	progress.DoneUsersCount += int64(len(users))

	return progress, nil
}

func (worker *BleveIndexerWorker) BulkIndexUsers(logger mlog.LoggerIFace, users []*model.UserForIndexing, progress IndexingProgress) (*model.UserForIndexing, *model.AppError) {
	batch := worker.engine.UserIndex.NewBatch()

	for _, user := range users {
		if user.DeleteAt == 0 {
			searchUser := bleveengine.BLVUserFromUserForIndexing(user)
			batch.Index(searchUser.Id, searchUser)
		} else {
			batch.Delete(user.Id)
		}
	}

	worker.engine.Mutex.RLock()
	defer worker.engine.Mutex.RUnlock()

	if err := worker.engine.UserIndex.Batch(batch); err != nil {
		return nil, model.NewAppError("BleveIndexerWorker.BulkIndexUsers", "bleveengine.indexer.do_job.bulk_index_users.batch_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return users[len(users)-1], nil
}
