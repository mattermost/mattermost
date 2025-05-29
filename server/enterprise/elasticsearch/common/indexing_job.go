// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	timeBetweenBatches = 100 * time.Millisecond

	estimatedPostCount    = 10000000
	estimatedChannelCount = 100000
	estimatedFilesCount   = 100000
	estimatedUserCount    = 10000
)

const (
	indexOp  = "index"
	deleteOp = "delete"
)

func NewIndexerWorker(name string,
	backend string,
	jobServer *jobs.JobServer,
	logger mlog.LoggerIFace,
	fileBackend filestore.FileBackend,
	licenseFn func() *model.License,
	createBulkProcessorFn func() error,
	addItemToBulkProcessorFn func(indexName string, indexOp string, docID string, body io.ReadSeeker) error,
	closeBulkProcessorFn func() error,
) *IndexerWorker {
	return &IndexerWorker{
		name:                   name,
		backend:                backend,
		stoppedCh:              make(chan bool, 1),
		jobs:                   make(chan model.Job),
		jobServer:              jobServer,
		logger:                 logger,
		fileBackend:            fileBackend,
		license:                licenseFn,
		stopped:                true,
		createBulkProcessor:    createBulkProcessorFn,
		addItemToBulkProcessor: addItemToBulkProcessorFn,
		closeBulkProcessor:     closeBulkProcessorFn,
	}
}

type IndexerWorker struct {
	name    string
	backend string
	// stateMut protects stopCh and stopped and helps enforce
	// ordering in case subsequent Run or Stop calls are made.
	stateMut    sync.Mutex
	stopCh      chan struct{}
	stopped     bool
	stoppedCh   chan bool
	jobs        chan model.Job
	jobServer   *jobs.JobServer
	logger      mlog.LoggerIFace
	fileBackend filestore.FileBackend

	license func() *model.License

	createBulkProcessor    func() error
	closeBulkProcessor     func() error
	addItemToBulkProcessor func(indexName, indexOp, docID string, body io.ReadSeeker) error
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
	current := ip.DonePostsCount + ip.DoneChannelsCount + ip.DoneUsersCount + ip.DoneFilesCount
	total := ip.TotalPostsCount + ip.TotalChannelsCount + ip.TotalFilesCount + ip.TotalUsersCount
	return current * 100 / total
}

func (ip *IndexingProgress) IsDone(job *model.Job) bool {
	// an entity's progress is completed if it was specified not to be indexed, or if it's completed indexing.

	donePosts := job.Data["index_posts"] == "false" || ip.DonePosts
	doneChannels := job.Data["index_channels"] == "false" || ip.DoneChannels
	doneUsers := job.Data["index_users"] == "false" || ip.DoneUsers
	doneFiles := job.Data["index_files"] == "false" || ip.DoneFiles

	return donePosts && doneChannels && doneUsers && doneFiles
}

func (worker *IndexerWorker) Run() {
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

func (worker *IndexerWorker) Stop() {
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

func (worker *IndexerWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *IndexerWorker) IsEnabled(cfg *model.Config) bool {
	if license := worker.license(); license == nil || !*license.Features.Elasticsearch {
		return false
	}

	if *cfg.ElasticsearchSettings.EnableIndexing {
		return true
	}

	return false
}

func (worker *IndexerWorker) initEntitiesToIndex(job *model.Job) {
	// Specifying entities to index is optional, and even when specified, all entities need not be specified.
	// This function parses the provided job data and sets enabled or disabled value for each entity,
	// so that rest of the code can use job.Data as the source of truth to decide if an entity was
	// to be indexed or not.

	if job.Data == nil {
		job.Data = model.StringMap{}
	}

	indexPostsRaw, ok := job.Data["index_posts"]
	job.Data["index_posts"] = strconv.FormatBool(!ok || indexPostsRaw == "true")

	indexChannelsRaw, ok := job.Data["index_channels"]
	job.Data["index_channels"] = strconv.FormatBool(!ok || indexChannelsRaw == "true")

	indexUsersRaw, ok := job.Data["index_users"]
	job.Data["index_users"] = strconv.FormatBool(!ok || indexUsersRaw == "true")

	indexFilesRaw, ok := job.Data["index_files"]
	job.Data["index_files"] = strconv.FormatBool(!ok || indexFilesRaw == "true")
}

func (worker *IndexerWorker) DoJob(job *model.Job) {
	logger := worker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")
	defer worker.jobServer.HandleJobPanic(logger, job)

	var appErr *model.AppError
	job, appErr = worker.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn("Worker: Error occurred while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	logger.Info("Worker: Indexing job claimed by worker")

	err := worker.createBulkProcessor()
	if err != nil {
		worker.logger.Error("Worker: Failed to setup bulk processor", mlog.Err(err))
		return
	}

	worker.initEntitiesToIndex(job)
	progress, err := initProgress(logger, worker.jobServer, job, worker.backend)
	if err != nil {
		return
	}

	var cancelContext request.CTX = request.EmptyContext(worker.logger)
	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	cancelContext = cancelContext.WithContext(cancelCtx)
	go worker.jobServer.CancellationWatcher(cancelContext, job.Id, cancelWatcherChan)

	defer func() {
		cancelCancelWatcher()
		err := worker.closeBulkProcessor()
		if err != nil {
			logger.Warn("Error while closing the bulk indexer", mlog.Err(err), mlog.String("job_id", job.Id))
		}
	}()

	for {
		select {
		case <-cancelWatcherChan:
			logger.Info("Worker: Indexing job has been canceled via CancellationWatcher")
			if err := worker.jobServer.SetJobCanceled(job); err != nil {
				logger.Error("Worker: Failed to mark job as cancelled", mlog.Err(err))
			}
			return

		case <-worker.stopCh:
			logger.Info("Worker: Indexing has been canceled via Worker Stop. Setting the job back to pending.")
			if err := worker.jobServer.SetJobPending(job); err != nil {
				logger.Error("Worker: Failed to mark job as canceled", mlog.Err(err))
			}
			return

		case <-time.After(timeBetweenBatches):
			var err *model.AppError
			if progress, err = worker.IndexBatch(logger, progress, job); err != nil {
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

			job.Data["done_posts_count"] = strconv.FormatInt(progress.DonePostsCount, 10)
			job.Data["done_channels_count"] = strconv.FormatInt(progress.DoneChannelsCount, 10)
			job.Data["done_users_count"] = strconv.FormatInt(progress.DoneUsersCount, 10)
			job.Data["done_files_count"] = strconv.FormatInt(progress.DoneFilesCount, 10)

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

			if progress.IsDone(job) {
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

func (worker *IndexerWorker) IndexBatch(logger mlog.LoggerIFace, progress IndexingProgress, job *model.Job) (IndexingProgress, *model.AppError) {
	// an entity's batch is processed if it wasn't specified to be skipped, or if its completed indexing.

	if job.Data["index_posts"] != "false" && !progress.DonePosts {
		worker.logger.Debug("Worker: indexing post batch...")
		return worker.IndexPostsBatch(logger, progress)
	}

	if job.Data["index_channels"] != "false" && !progress.DoneChannels {
		worker.logger.Debug("Worker: indexing channels batch...")
		return IndexChannelsBatch(logger, worker.jobServer.Config(), worker.jobServer.Store, worker.addItemToBulkProcessor, progress)
	}

	if job.Data["index_users"] != "false" && !progress.DoneUsers {
		worker.logger.Debug("Worker: indexing users batch...")
		return worker.IndexUsersBatch(logger, progress)
	}

	if job.Data["index_files"] != "false" && !progress.DoneFiles {
		worker.logger.Debug("Worker: indexing files batch...")
		return worker.IndexFilesBatch(logger, progress)
	}

	return progress, model.NewAppError("IndexerWorker", "ent.elasticsearch.indexer.index_batch.nothing_left_to_index.error", nil, "", http.StatusInternalServerError)
}

func (worker *IndexerWorker) IndexPostsBatch(logger mlog.LoggerIFace, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	var posts []*model.PostForIndexing

	tries := 0
	for posts == nil {
		var err error
		posts, err = worker.jobServer.Store.Post().GetPostsBatchForIndexing(progress.LastEntityTime, progress.LastPostID, *worker.jobServer.Config().ElasticsearchSettings.BatchSize)
		if err != nil {
			if tries >= 10 {
				return progress, model.NewAppError("IndexPostsBatch", "ent.elasticsearch.post.get_posts_batch_for_indexing.error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		// We reset the last entity time to the beginning to begin
		// indexing of the next set of entities (users, channels etc.)
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = lastPost.CreateAt
	}

	progress.LastPostID = lastPost.Id
	progress.DonePostsCount += int64(len(posts))

	return progress, nil
}

func (worker *IndexerWorker) BulkIndexPosts(posts []*model.PostForIndexing, progress IndexingProgress) (*model.Post, *model.AppError) {
	for _, post := range posts {
		indexName := BuildPostIndexName(*worker.jobServer.Config().ElasticsearchSettings.AggregatePostsAfterDays,
			*worker.jobServer.Config().ElasticsearchSettings.IndexPrefix+IndexBasePosts,
			*worker.jobServer.Config().ElasticsearchSettings.IndexPrefix+IndexBasePosts_MONTH, progress.Now, post.CreateAt)

		if post.DeleteAt == 0 {
			searchPost := ESPostFromPostForIndexing(post)

			data, err := json.Marshal(searchPost)
			if err != nil {
				worker.logger.Warn("Failed to marshal JSON, skipping this post.", mlog.String("post_id", post.Id), mlog.Err(err))
				continue
			}

			err = worker.addItemToBulkProcessor(indexName, indexOp, searchPost.Id, bytes.NewReader(data))
			if err != nil {
				worker.logger.Warn("Failed to add item to bulk processor", mlog.String("indexName", indexName), mlog.Err(err))
			}
		} else {
			err := worker.addItemToBulkProcessor(indexName, deleteOp, post.Id, nil)
			if err != nil {
				worker.logger.Warn("Failed to add item to bulk processor", mlog.String("indexName", indexName), mlog.Err(err))
			}
		}
	}

	return &posts[len(posts)-1].Post, nil
}

func (worker *IndexerWorker) IndexFilesBatch(logger mlog.LoggerIFace, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	var files []*model.FileForIndexing

	tries := 0
	for files == nil {
		var err error
		files, err = worker.jobServer.Store.FileInfo().GetFilesBatchForIndexing(progress.LastEntityTime, progress.LastFileID, true, *worker.jobServer.Config().ElasticsearchSettings.BatchSize)
		if err != nil {
			if tries >= 10 {
				return progress, model.NewAppError("IndexFilesBatch", "ent.elasticsearch.post.get_files_batch_for_indexing.error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		// We reset the last entity time to the beginning to begin
		// indexing of the next set of entities (users, channels etc.)
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = lastFile.CreateAt
	}

	progress.LastFileID = lastFile.Id
	progress.DoneFilesCount += int64(len(files))

	return progress, nil
}

func (worker *IndexerWorker) BulkIndexFiles(files []*model.FileForIndexing, progress IndexingProgress) (*model.FileInfo, *model.AppError) {
	for _, file := range files {
		indexName := *worker.jobServer.Config().ElasticsearchSettings.IndexPrefix + IndexBaseFiles

		if file.ShouldIndex() {
			searchFile := ESFileFromFileForIndexing(file)

			data, err := json.Marshal(searchFile)
			if err != nil {
				worker.logger.Warn("Failed to marshal JSON", mlog.Err(err))
				continue
			}

			err = worker.addItemToBulkProcessor(indexName, indexOp, searchFile.Id, bytes.NewReader(data))
			if err != nil {
				worker.logger.Warn("Failed to add item to bulk processor", mlog.String("indexName", indexName), mlog.Err(err))
			}
		} else {
			err := worker.addItemToBulkProcessor(indexName, deleteOp, file.Id, nil)
			if err != nil {
				worker.logger.Warn("Failed to add item to bulk processor", mlog.String("indexName", indexName), mlog.Err(err))
			}
		}
	}

	return &files[len(files)-1].FileInfo, nil
}

func IndexChannelsBatch(logger mlog.LoggerIFace, config *model.Config, store store.Store, addItemToBulkProcessorFn func(indexName string, indexOp string, docID string, body io.ReadSeeker) error, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	var channels []*model.Channel

	tries := 0
	for channels == nil {
		var err error
		channels, err = store.Channel().GetChannelsBatchForIndexing(progress.LastEntityTime, progress.LastChannelID, *config.ElasticsearchSettings.BatchSize)
		if err != nil {
			if tries >= 10 {
				return progress, model.NewAppError("IndexerWorker.IndexChannelsBatch", "ent.elasticsearch.index_channels_batch.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			logger.Warn("Failed to get channels batch for indexing. Retrying.", mlog.Err(err))

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

	lastChannel, err := BulkIndexChannels(config, store, logger, addItemToBulkProcessorFn, channels, progress)
	if err != nil {
		return progress, err
	}

	// Our exit condition is when the last channel's createAt reaches the initial endAtTime
	// set during job creation.
	if progress.EndAtTime <= lastChannel.CreateAt {
		progress.DoneChannels = true
		// We reset the last entity time to the beginning to begin
		// indexing of the next set of entities (users etc.)
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = lastChannel.CreateAt
	}

	progress.LastChannelID = lastChannel.Id
	progress.DoneChannelsCount += int64(len(channels))

	return progress, nil
}

func BulkIndexChannels(config *model.Config,
	store store.Store,
	logger mlog.LoggerIFace,
	addItemToBulkProcessorFn func(indexName string, indexOp string, docID string, body io.ReadSeeker) error,
	channels []*model.Channel,
	_ IndexingProgress) (*model.Channel, *model.AppError) {
	for _, channel := range channels {
		indexName := *config.ElasticsearchSettings.IndexPrefix + IndexBaseChannels

		var userIDs []string
		var err error
		if channel.Type == model.ChannelTypePrivate {
			userIDs, err = store.Channel().GetAllChannelMemberIdsByChannelId(channel.Id)
			if err != nil {
				return nil, model.NewAppError("IndexerWorker.BulkIndexChannels", "ent.elasticsearch.getAllChannelMembers.error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		teamMemberIDs, err := store.Channel().GetTeamMembersForChannel(channel.Id)
		if err != nil {
			return nil, model.NewAppError("IndexerWorker.BulkIndexChannels", "ent.elasticsearch.getAllTeamMembers.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		searchChannel := ESChannelFromChannel(channel, userIDs, teamMemberIDs)

		data, err := json.Marshal(searchChannel)
		if err != nil {
			logger.Warn("Failed to marshal JSON", mlog.Err(err))
			continue
		}

		err = addItemToBulkProcessorFn(indexName, indexOp, searchChannel.Id, bytes.NewReader(data))
		if err != nil {
			logger.Warn("Failed to add item to bulk processor", mlog.String("indexName", indexName), mlog.Err(err))
		}
	}

	return channels[len(channels)-1], nil
}

func (worker *IndexerWorker) IndexUsersBatch(logger mlog.LoggerIFace, progress IndexingProgress) (IndexingProgress, *model.AppError) {
	var users []*model.UserForIndexing

	tries := 0
	for users == nil {
		if usersBatch, err := worker.jobServer.Store.User().GetUsersBatchForIndexing(progress.LastEntityTime, progress.LastUserID, *worker.jobServer.Config().ElasticsearchSettings.BatchSize); err != nil {
			if tries >= 10 {
				return progress, model.NewAppError("IndexerWorker.IndexUsersBatch", "app.user.get_users_batch_for_indexing.get_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	lastUser, err := worker.BulkIndexUsers(users, progress)
	if err != nil {
		return progress, err
	}

	// Our exit condition is when the last user's createAt reaches the initial endAtTime
	// set during job creation.
	if progress.EndAtTime <= lastUser.CreateAt {
		progress.DoneUsers = true
		// We reset the last entity time to the beginning to begin
		// indexing of the next set of entities in case they get added in the future.
		progress.LastEntityTime = progress.StartAtTime
	} else {
		progress.LastEntityTime = lastUser.CreateAt
	}
	progress.LastUserID = lastUser.Id
	progress.DoneUsersCount += int64(len(users))

	return progress, nil
}

func (worker *IndexerWorker) BulkIndexUsers(users []*model.UserForIndexing, progress IndexingProgress) (*model.UserForIndexing, *model.AppError) {
	for _, user := range users {
		indexName := *worker.jobServer.Config().ElasticsearchSettings.IndexPrefix + IndexBaseUsers

		searchUser := ESUserFromUserForIndexing(user)

		data, err := json.Marshal(searchUser)
		if err != nil {
			worker.logger.Warn("Failed to marshal JSON", mlog.Err(err))
			continue
		}

		err = worker.addItemToBulkProcessor(indexName, indexOp, searchUser.Id, bytes.NewReader(data))
		if err != nil {
			worker.logger.Warn("Failed to add item to bulk processor", mlog.String("indexName", indexName), mlog.Err(err))
		}
	}

	return users[len(users)-1], nil
}

func initProgress(logger mlog.LoggerIFace, jobServer *jobs.JobServer, job *model.Job, backend string) (IndexingProgress, error) {
	progress := IndexingProgress{
		Now:          time.Now(),
		DonePosts:    false,
		DoneChannels: false,
		DoneUsers:    false,
		DoneFiles:    false,
		StartAtTime:  0,
		EndAtTime:    model.GetMillis(),
	}

	progress, err := parseStartTime(logger, jobServer, progress, job, backend)
	if err != nil {
		return progress, err
	}

	progress, err = parseEndTime(logger, jobServer, progress, job, backend)
	if err != nil {
		return progress, err
	}

	progress = parseDoneCount(logger, progress, job)
	progress = setStartEntityIDs(progress, job)
	progress = setEntityCount(logger, jobServer, progress, job)

	return progress, nil
}

func parseStartTime(logger mlog.LoggerIFace, jobServer *jobs.JobServer, progress IndexingProgress, job *model.Job, backend string) (IndexingProgress, error) {
	// Extract the start time, if it is set.
	if startString, ok := job.Data["start_time"]; ok {
		startInt, err := strconv.ParseInt(startString, 10, 64)
		if err != nil {
			logger.Error("Worker: Failed to parse start_time for job", mlog.String("start_time", startString), mlog.Err(err))
			appError := model.NewAppError("IndexerWorker", "ent.elasticsearch.indexer.do_job.parse_start_time.error", map[string]any{"Backend": backend}, "", http.StatusInternalServerError).Wrap(err)
			if err := jobServer.SetJobError(job, appError); err != nil {
				logger.Error("Worker: Failed to set job error", mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return progress, err
		}
		progress.StartAtTime = startInt
	} else {
		// Set start time to oldest entity (user, channel or post) in the database.
		oldestEntityTime, err := jobServer.Store.Post().GetOldestEntityCreationTime()
		if err != nil {
			logger.Error("Worker: Failed to fetch oldest post for job.", mlog.String("start_time", startString), mlog.Err(err))
			appError := model.NewAppError("IndexerWorker", "ent.elasticsearch.indexer.do_job.get_oldest_entity.error", nil, "", http.StatusInternalServerError).Wrap(err)
			if err := jobServer.SetJobError(job, appError); err != nil {
				logger.Error("Worker: Failed to set job error", mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return progress, err
		}
		progress.StartAtTime = oldestEntityTime
	}

	progress.LastEntityTime = progress.StartAtTime
	return progress, nil
}

func parseEndTime(logger mlog.LoggerIFace, jobServer *jobs.JobServer, progress IndexingProgress, job *model.Job, backend string) (IndexingProgress, error) {
	if endString, ok := job.Data["end_time"]; ok {
		endInt, err := strconv.ParseInt(endString, 10, 64)
		if err != nil {
			logger.Error("Worker: Failed to parse end_time for job", mlog.String("end_time", endString), mlog.Err(err))
			appError := model.NewAppError("IndexerWorker", "ent.elasticsearch.indexer.do_job.parse_end_time.error", map[string]any{"Backend": backend}, "", http.StatusInternalServerError).Wrap(err)
			if err := jobServer.SetJobError(job, appError); err != nil {
				logger.Error("Worker: Failed to set job errorv", mlog.Err(err), mlog.NamedErr("set_error", appError))
			}
			return progress, err
		}
		progress.EndAtTime = endInt
	}

	return progress, nil
}

func parseDoneCount(logger mlog.LoggerIFace, progress IndexingProgress, job *model.Job) IndexingProgress {
	if count, ok := job.Data["done_posts_count"]; ok {
		countInt, err := strconv.ParseInt(count, 10, 64)
		if err != nil {
			logger.Error("Worker: Failed to parse done_posts_count for job", mlog.String("done_posts_count", count), mlog.Err(err))
		}
		progress.DonePostsCount = countInt
	}

	if count, ok := job.Data["done_channels_count"]; ok {
		countInt, err := strconv.ParseInt(count, 10, 64)
		if err != nil {
			logger.Error("Worker: Failed to parse done_channels_count for job", mlog.String("done_channels_count", count), mlog.Err(err))
		}
		progress.DoneChannelsCount = countInt
	}

	if count, ok := job.Data["done_users_count"]; ok {
		countInt, err := strconv.ParseInt(count, 10, 64)
		if err != nil {
			logger.Error("Worker: Failed to parse done_users_count for job", mlog.String("done_users_count", count), mlog.Err(err))
		}
		progress.DoneUsersCount = countInt
	}

	if count, ok := job.Data["done_files_count"]; ok {
		countInt, err := strconv.ParseInt(count, 10, 64)
		if err != nil {
			logger.Error("Worker: Failed to parse done_files_count for job", mlog.String("done_files_count", count), mlog.Err(err))
		}
		progress.DoneFilesCount = countInt
	}

	return progress
}

func setStartEntityIDs(progress IndexingProgress, job *model.Job) IndexingProgress {
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

	return progress
}

func setEntityCount(logger mlog.LoggerIFace, jobServer *jobs.JobServer, progress IndexingProgress, job *model.Job) IndexingProgress {
	if job.Data["index_posts"] == "true" {
		// Counting all posts may fail or timeout when the posts table is large. If this happens, log a warning, but carry
		// on with the indexing job anyway. The only issue is that the progress % reporting will be inaccurate.
		if count, err := jobServer.Store.Post().AnalyticsPostCount(&model.PostCountOptions{}); err != nil {
			logger.Warn("Worker: Failed to fetch total post count for job. An estimated value will be used for progress reporting.", mlog.Int("estimatedPostCount", estimatedPostCount), mlog.Err(err))
			progress.TotalPostsCount = estimatedPostCount
		} else {
			progress.TotalPostsCount = count
		}
	}

	if job.Data["index_channels"] == "true" {
		// Same possible fail as above can happen when counting channels
		if count, err := jobServer.Store.Channel().AnalyticsTypeCount("", ""); err != nil {
			logger.Warn("Worker: Failed to fetch total channel count for job. An estimated value will be used for progress reporting.", mlog.Int("estimatedChannelCount", estimatedChannelCount), mlog.Err(err))
			progress.TotalChannelsCount = estimatedChannelCount
		} else {
			progress.TotalChannelsCount = count
		}
	}

	if job.Data["index_users"] == "true" {
		// Same possible fail as above can happen when counting users
		if count, err := jobServer.Store.User().Count(model.UserCountOptions{
			IncludeBotAccounts: true, // This actually doesn't join with the bots table
			// since ExcludeRegularUsers is set to false
		}); err != nil {
			logger.Warn("Worker: Failed to fetch total user count for job. An estimated value will be used for progress reporting.", mlog.Int("estimatedUserCount", estimatedUserCount), mlog.Err(err))
			progress.TotalUsersCount = estimatedUserCount
		} else {
			progress.TotalUsersCount = count
		}
	}

	if job.Data["index_files"] == "true" {
		// Same possible fail as above can happen when counting files
		if count, err := jobServer.Store.FileInfo().CountAll(); err != nil {
			logger.Warn("Worker: Failed to fetch total files count for job. An estimated value will be used for progress reporting.", mlog.Int("estimatedFilesCount", estimatedFilesCount), mlog.Err(err))
			progress.TotalFilesCount = estimatedFilesCount
		} else {
			progress.TotalFilesCount = count
		}
	}

	return progress
}
