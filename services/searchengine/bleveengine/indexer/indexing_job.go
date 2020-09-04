// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ebleveengine

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/jobs"
	tjobs "github.com/mattermost/mattermost-server/v5/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine/bleveengine"
)

const (
	BATCH_SIZE              = 1000
	TIME_BETWEEN_BATCHES    = 100
	ESTIMATED_POST_COUNT    = 10000000
	ESTIMATED_CHANNEL_COUNT = 100000
	ESTIMATED_USER_COUNT    = 10000
)

func init() {
	app.RegisterJobsBleveIndexerInterface(func(s *app.Server) tjobs.IndexerJobInterface {
		return &BleveIndexerInterfaceImpl{s}
	})
}

type BleveIndexerInterfaceImpl struct {
	Server *app.Server
}

type BleveIndexerWorker struct {
	name      string
	stop      chan bool
	stopped   chan bool
	jobs      chan model.Job
	jobServer *jobs.JobServer

	engine *bleveengine.BleveEngine
}

func (bi *BleveIndexerInterfaceImpl) MakeWorker() model.Worker {
	if bi.Server.SearchEngine.BleveEngine == nil {
		return nil
	}
	return &BleveIndexerWorker{
		name:      "BleveIndexer",
		stop:      make(chan bool, 1),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: bi.Server.Jobs,

		engine: bi.Server.SearchEngine.BleveEngine.(*bleveengine.BleveEngine),
	}
}

type IndexingProgress struct {
	Now                time.Time
	StartAtTime        int64
	EndAtTime          int64
	LastEntityTime     int64
	TotalPostsCount    int64
	DonePostsCount     int64
	DonePosts          bool
	TotalChannelsCount int64
	DoneChannelsCount  int64
	DoneChannels       bool
	TotalUsersCount    int64
	DoneUsersCount     int64
	DoneUsers          bool
}

func (ip *IndexingProgress) CurrentProgress() int64 {
	return (ip.DonePostsCount + ip.DoneChannelsCount + ip.DoneUsersCount) * 100 / (ip.TotalPostsCount + ip.TotalChannelsCount + ip.TotalUsersCount)
}

func (ip *IndexingProgress) IsDone() bool {
	return ip.DonePosts && ip.DoneChannels && ip.DoneUsers
}

func (worker *BleveIndexerWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *BleveIndexerWorker) Run() {
	mlog.Debug("Worker Started", mlog.String("workername", worker.name))

	defer func() {
		mlog.Debug("Worker: Finished", mlog.String("workername", worker.name))
		worker.stopped <- true
	}()

	for {
		select {
		case <-worker.stop:
			mlog.Debug("Worker: Received stop signal", mlog.String("workername", worker.name))
			return
		case job := <-worker.jobs:
			mlog.Debug("Worker: Received a new candidate job.", mlog.String("workername", worker.name))
			worker.DoJob(&job)
		}
	}
}

func (worker *BleveIndexerWorker) Stop() {
	mlog.Debug("Worker Stopping", mlog.String("workername", worker.name))
	worker.stop <- true
	<-worker.stopped
}

func (worker *BleveIndexerWorker) DoJob(job *model.Job) {
	claimed, err := worker.jobServer.ClaimJob(job)
	if err != nil {
		mlog.Warn("Worker: Error ocurred while trying to claim job", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
		return
	}
	if !claimed {
		return
	}

	mlog.Info("Worker: Indexing job claimed by worker", mlog.String("workername", worker.name), mlog.String("job_id", job.Id))

	if !worker.engine.IsActive() {
		appError := model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.do_job.engine_inactive", nil, "", http.StatusInternalServerError)
		if err := worker.jobServer.SetJobError(job, appError); err != nil {
			mlog.Error("Worker: Failed to run job as ")
		}
		return
	}

	progress := IndexingProgress{
		Now:          time.Now(),
		DonePosts:    false,
		DoneChannels: false,
		DoneUsers:    false,
		StartAtTime:  0,
		EndAtTime:    model.GetMillis(),
	}

	// Extract the start and end times, if they are set.
	if startString, ok := job.Data["start_time"]; ok {
		startInt, err := strconv.ParseInt(startString, 10, 64)
		if err != nil {
			mlog.Error("Worker: Failed to parse start_time for job", mlog.String("workername", worker.name), mlog.String("start_time", startString), mlog.String("job_id", job.Id), mlog.Err(err))
			appError := model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.do_job.parse_start_time.error", nil, err.Error(), http.StatusInternalServerError)
			if err := worker.jobServer.SetJobError(job, appError); err != nil {
				mlog.Error("Worker: Failed to set job error", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return
		}
		progress.StartAtTime = startInt
		progress.LastEntityTime = progress.StartAtTime
	} else {
		// Set start time to oldest post in the database.
		oldestPost, err := worker.jobServer.Store.Post().GetOldest()
		if err != nil {
			mlog.Error("Worker: Failed to fetch oldest post for job.", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.String("start_time", startString), mlog.Err(err))
			appError := model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.do_job.get_oldest_post.error", nil, err.Error(), http.StatusInternalServerError)
			if err := worker.jobServer.SetJobError(job, appError); err != nil {
				mlog.Error("Worker: Failed to set job error", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return
		}
		progress.StartAtTime = oldestPost.CreateAt
		progress.LastEntityTime = progress.StartAtTime
	}

	if endString, ok := job.Data["end_time"]; ok {
		endInt, err := strconv.ParseInt(endString, 10, 64)
		if err != nil {
			mlog.Error("Worker: Failed to parse end_time for job", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.String("end_time", endString), mlog.Err(err))
			appError := model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.do_job.parse_end_time.error", nil, err.Error(), http.StatusInternalServerError)
			if err := worker.jobServer.SetJobError(job, appError); err != nil {
				mlog.Error("Worker: Failed to set job errorv", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return
		}
		progress.EndAtTime = endInt
	}

	// Counting all posts may fail or timeout when the posts table is large. If this happens, log a warning, but carry
	// on with the indexing job anyway. The only issue is that the progress % reporting will be inaccurate.
	if count, err := worker.jobServer.Store.Post().AnalyticsPostCount("", false, false); err != nil {
		mlog.Warn("Worker: Failed to fetch total post count for job. An estimated value will be used for progress reporting.", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
		progress.TotalPostsCount = ESTIMATED_POST_COUNT
	} else {
		progress.TotalPostsCount = count
	}

	// Same possible fail as above can happen when counting channels
	if count, err := worker.jobServer.Store.Channel().AnalyticsTypeCount("", "O"); err != nil {
		mlog.Warn("Worker: Failed to fetch total channel count for job. An estimated value will be used for progress reporting.", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
		progress.TotalChannelsCount = ESTIMATED_CHANNEL_COUNT
	} else {
		progress.TotalChannelsCount = count
	}

	// Same possible fail as above can happen when counting users
	if count, err := worker.jobServer.Store.User().Count(model.UserCountOptions{}); err != nil {
		mlog.Warn("Worker: Failed to fetch total user count for job. An estimated value will be used for progress reporting.", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
		progress.TotalUsersCount = ESTIMATED_USER_COUNT
	} else {
		progress.TotalUsersCount = count
	}

	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan interface{}, 1)
	go worker.jobServer.CancellationWatcher(cancelCtx, job.Id, cancelWatcherChan)

	defer cancelCancelWatcher()

	for {
		select {
		case <-cancelWatcherChan:
			mlog.Info("Worker: Indexing job has been canceled via CancellationWatcher", mlog.String("workername", worker.name), mlog.String("job_id", job.Id))
			if err := worker.jobServer.SetJobCanceled(job); err != nil {
				mlog.Error("Worker: Failed to mark job as cancelled", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
			}
			return

		case <-worker.stop:
			mlog.Info("Worker: Indexing has been canceled via Worker Stop", mlog.String("workername", worker.name), mlog.String("job_id", job.Id))
			if err := worker.jobServer.SetJobCanceled(job); err != nil {
				mlog.Error("Worker: Failed to mark job as canceled", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
			}
			return

		case <-time.After(TIME_BETWEEN_BATCHES * time.Millisecond):
			var err *model.AppError
			if progress, err = worker.IndexBatch(progress); err != nil {
				mlog.Error("Worker: Failed to index batch for job", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
				if err2 := worker.jobServer.SetJobError(job, err); err2 != nil {
					mlog.Error("Worker: Failed to set job error", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err2), mlog.NamedErr("set_error", err))
				}
				return
			}

			if err := worker.jobServer.SetJobProgress(job, progress.CurrentProgress()); err != nil {
				mlog.Error("Worker: Failed to set progress for job", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
				if err2 := worker.jobServer.SetJobError(job, err); err2 != nil {
					mlog.Error("Worker: Failed to set error for job", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err2), mlog.NamedErr("set_error", err))
				}
				return
			}

			if progress.IsDone() {
				if err := worker.jobServer.SetJobSuccess(job); err != nil {
					mlog.Error("Worker: Failed to set success for job", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
					if err2 := worker.jobServer.SetJobError(job, err); err2 != nil {
						mlog.Error("Worker: Failed to set error for job", mlog.String("workername", worker.name), mlog.String("job_id", job.Id), mlog.Err(err2), mlog.NamedErr("set_error", err))
					}
				}
				mlog.Info("Worker: Indexing job finished successfully", mlog.String("workername", worker.name), mlog.String("job_id", job.Id))
				return
			}
		}
	}
}

func (worker *BleveIndexerWorker) IndexBatch(progress IndexingProgress) (IndexingProgress, *model.AppError) {
	if !progress.DonePosts {
		return worker.IndexPostsBatch(progress)
	}
	if !progress.DoneChannels {
		return worker.IndexChannelsBatch(progress)
	}
	if !progress.DoneUsers {
		return worker.IndexUsersBatch(progress)
	}
	return progress, model.NewAppError("BleveIndexerWorker", "bleveengine.indexer.index_batch.nothing_left_to_index.error", nil, "", http.StatusInternalServerError)
}

func (worker *BleveIndexerWorker) IndexPostsBatch(progress IndexingProgress) (IndexingProgress, *model.AppError) {
	endTime := progress.LastEntityTime + int64(*worker.jobServer.Config().BleveSettings.BulkIndexingTimeWindowSeconds*1000)

	var posts []*model.PostForIndexing

	tries := 0
	for posts == nil {
		var err error
		posts, err = worker.jobServer.Store.Post().GetPostsBatchForIndexing(progress.LastEntityTime, endTime, BATCH_SIZE)
		if err != nil {
			if tries >= 10 {
				return progress, model.NewAppError("IndexPostsBatch", "app.post.get_posts_batch_for_indexing.get.app_error", nil, err.Error(), http.StatusInternalServerError)
			} else {
				mlog.Warn("Failed to get posts batch for indexing. Retrying.", mlog.Err(err))

				// Wait a bit before trying again.
				time.Sleep(15 * time.Second)
			}
		}

		tries++
	}

	newLastMessageTime, err := worker.BulkIndexPosts(posts, progress)
	if err != nil {
		return progress, err
	}

	// Due to the "endTime" parameter in the store query, we might get an incomplete batch before the end. In this
	// case, set the "newLastMessageTime" to the endTime so we don't get stuck running the same query in a loop.
	if len(posts) < BATCH_SIZE {
		newLastMessageTime = endTime
	}

	// When to Stop: we index either until we pass a batch of messages where the last
	// message is created at or after the specified end time when setting up the batch
	// index, or until two consecutive full batches have the same end time of their final
	// messages. This second case is safe as long as the assumption that the database
	// cannot contain more messages with the same CreateAt time than the batch size holds.
	if progress.EndAtTime <= newLastMessageTime {
		progress.DonePosts = true
		progress.LastEntityTime = progress.StartAtTime
	} else if progress.LastEntityTime == newLastMessageTime && len(posts) == BATCH_SIZE {
		mlog.Error("More posts with the same CreateAt time were detected than the permitted batch size. Aborting indexing job.", mlog.Int64("CreateAt", newLastMessageTime), mlog.Int("Batch Size", BATCH_SIZE))
		progress.DonePosts = true
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = newLastMessageTime
	}

	progress.DonePostsCount += int64(len(posts))

	return progress, nil
}

func (worker *BleveIndexerWorker) BulkIndexPosts(posts []*model.PostForIndexing, progress IndexingProgress) (int64, *model.AppError) {
	lastCreateAt := int64(0)
	batch := worker.engine.PostIndex.NewBatch()

	for _, post := range posts {
		if post.DeleteAt == 0 {
			searchPost := bleveengine.BLVPostFromPostForIndexing(post)
			batch.Index(searchPost.Id, searchPost)
		} else {
			batch.Delete(post.Id)
		}

		lastCreateAt = post.CreateAt
	}

	worker.engine.Mutex.RLock()
	defer worker.engine.Mutex.RUnlock()

	if err := worker.engine.PostIndex.Batch(batch); err != nil {
		return 0, model.NewAppError("BleveIndexerWorker.BulkIndexPosts", "bleveengine.indexer.do_job.bulk_index_posts.batch_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return lastCreateAt, nil
}

func (worker *BleveIndexerWorker) IndexChannelsBatch(progress IndexingProgress) (IndexingProgress, *model.AppError) {
	endTime := progress.LastEntityTime + int64(*worker.jobServer.Config().BleveSettings.BulkIndexingTimeWindowSeconds*1000)

	var channels []*model.Channel

	tries := 0
	for channels == nil {
		var err *model.AppError
		channels, err = worker.jobServer.Store.Channel().GetChannelsBatchForIndexing(progress.LastEntityTime, endTime, BATCH_SIZE)
		if err != nil {
			if tries >= 10 {
				return progress, err
			}

			mlog.Warn("Failed to get channels batch for indexing. Retrying.", mlog.Err(err))

			// Wait a bit before trying again.
			time.Sleep(15 * time.Second)
		}
		tries++
	}

	newLastChannelTime, err := worker.BulkIndexChannels(channels, progress)
	if err != nil {
		return progress, err
	}

	// Due to the "endTime" parameter in the store query, we might get an incomplete batch before the end. In this
	// case, set the "newLastChannelTime" to the endTime so we don't get stuck running the same query in a loop.
	if len(channels) < BATCH_SIZE {
		newLastChannelTime = endTime
	}

	// When to Stop: we index either until we pass a batch of channels where the last
	// channel is created at or after the specified end time when setting up the batch
	// index, or until two consecutive full batches have the same end time of their final
	// channels. This second case is safe as long as the assumption that the database
	// cannot contain more channels with the same CreateAt time than the batch size holds.
	if progress.EndAtTime <= newLastChannelTime {
		progress.DoneChannels = true
		progress.LastEntityTime = progress.StartAtTime
	} else if progress.LastEntityTime == newLastChannelTime && len(channels) == BATCH_SIZE {
		mlog.Error("More channels with the same CreateAt time were detected than the permitted batch size. Aborting indexing job.", mlog.Int64("CreateAt", newLastChannelTime), mlog.Int("Batch Size", BATCH_SIZE))
		progress.DoneChannels = true
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = newLastChannelTime
	}

	progress.DoneChannelsCount += int64(len(channels))

	return progress, nil
}

func (worker *BleveIndexerWorker) BulkIndexChannels(channels []*model.Channel, progress IndexingProgress) (int64, *model.AppError) {
	lastCreateAt := int64(0)
	batch := worker.engine.ChannelIndex.NewBatch()

	for _, channel := range channels {
		if channel.DeleteAt == 0 {
			searchChannel := bleveengine.BLVChannelFromChannel(channel)
			batch.Index(searchChannel.Id, searchChannel)
		} else {
			batch.Delete(channel.Id)
		}

		lastCreateAt = channel.CreateAt
	}

	worker.engine.Mutex.RLock()
	defer worker.engine.Mutex.RUnlock()

	if err := worker.engine.ChannelIndex.Batch(batch); err != nil {
		return 0, model.NewAppError("BleveIndexerWorker.BulkIndexChannels", "bleveengine.indexer.do_job.bulk_index_channels.batch_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return lastCreateAt, nil
}

func (worker *BleveIndexerWorker) IndexUsersBatch(progress IndexingProgress) (IndexingProgress, *model.AppError) {
	endTime := progress.LastEntityTime + int64(*worker.jobServer.Config().BleveSettings.BulkIndexingTimeWindowSeconds*1000)

	var users []*model.UserForIndexing

	tries := 0
	for users == nil {
		if usersBatch, err := worker.jobServer.Store.User().GetUsersBatchForIndexing(progress.LastEntityTime, endTime, BATCH_SIZE); err != nil {
			if tries >= 10 {
				return progress, err
			} else {
				mlog.Warn("Failed to get users batch for indexing. Retrying.", mlog.Err(err))

				// Wait a bit before trying again.
				time.Sleep(15 * time.Second)
			}
		} else {
			users = usersBatch
		}

		tries++
	}

	newLastUserTime, err := worker.BulkIndexUsers(users, progress)
	if err != nil {
		return progress, err
	}

	// Due to the "endTime" parameter in the store query, we might get an incomplete batch before the end. In this
	// case, set the "newLastUserTime" to the endTime so we don't get stuck running the same query in a loop.
	if len(users) < BATCH_SIZE {
		newLastUserTime = endTime
	}

	// When to Stop: we index either until we pass a batch of users where the last
	// user is created at or after the specified end time when setting up the batch
	// index, or until two consecutive full batches have the same end time of their final
	// users. This second case is safe as long as the assumption that the database
	// cannot contain more users with the same CreateAt time than the batch size holds.
	if progress.EndAtTime <= newLastUserTime {
		progress.DoneUsers = true
		progress.LastEntityTime = progress.StartAtTime
	} else if progress.LastEntityTime == newLastUserTime && len(users) == BATCH_SIZE {
		mlog.Error("More users with the same CreateAt time were detected than the permitted batch size. Aborting indexing job.", mlog.Int64("CreateAt", newLastUserTime), mlog.Int("Batch Size", BATCH_SIZE))
		progress.DoneUsers = true
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = newLastUserTime
	}

	progress.DoneUsersCount += int64(len(users))

	return progress, nil
}

func (worker *BleveIndexerWorker) BulkIndexUsers(users []*model.UserForIndexing, progress IndexingProgress) (int64, *model.AppError) {
	lastCreateAt := int64(0)
	batch := worker.engine.UserIndex.NewBatch()

	for _, user := range users {
		if user.DeleteAt == 0 {
			searchUser := bleveengine.BLVUserFromUserForIndexing(user)
			batch.Index(searchUser.Id, searchUser)
		} else {
			batch.Delete(user.Id)
		}

		lastCreateAt = user.CreateAt
	}

	worker.engine.Mutex.RLock()
	defer worker.engine.Mutex.RUnlock()

	if err := worker.engine.UserIndex.Batch(batch); err != nil {
		return 0, model.NewAppError("BleveIndexerWorker.BulkIndexUsers", "bleveengine.indexer.do_job.bulk_index_users.batch_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return lastCreateAt, nil
}
