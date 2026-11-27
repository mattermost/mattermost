// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"fmt"
	"io"
	"maps"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestBulkIndexChannelsWithDeletedChannels(t *testing.T) {
	// Create test channels - one active, one deleted
	activeChannel := &model.Channel{
		Id:       "ch1",
		Type:     model.ChannelTypeOpen,
		DeleteAt: 0,
	}
	deletedChannel := &model.Channel{
		Id:       "ch2",
		Type:     model.ChannelTypeOpen,
		DeleteAt: 123456,
	}
	channels := []*model.Channel{activeChannel, deletedChannel}

	// Mock store
	mockStore := &mocks.Store{}
	mockChannelStore := &mocks.ChannelStore{}
	mockStore.On("Channel").Return(mockChannelStore)
	defer mockStore.AssertExpectations(t)

	// Since these are open channels, GetAllChannelMemberIdsByChannelId won't be called
	// But GetTeamMembersForChannel will be called for both channels
	mockChannelStore.On("GetTeamMembersForChannel", mock.AnythingOfType("*request.Context"), "ch1").Return([]string{"team1"}, nil)
	mockChannelStore.On("GetTeamMembersForChannel", mock.AnythingOfType("*request.Context"), "ch2").Return([]string{"team1"}, nil)

	// Track which channels were actually indexed
	indexedChannels := make(map[string]bool)

	// Mock bulk processor function
	addItemToBulkProcessorFn := func(_, op, id string, _ io.ReadSeeker) error {
		assert.Equal(t, indexOp, op) // Should always be index, not delete
		indexedChannels[id] = true
		return nil
	}

	config := &model.Config{}
	config.ElasticsearchSettings.IndexPrefix = new("test_")

	// Call the function
	lastChannel, appErr := BulkIndexChannels(config, mockStore, mlog.CreateConsoleTestLogger(t), addItemToBulkProcessorFn, channels, IndexingProgress{})

	// Verify results
	require.Nil(t, appErr)
	assert.Equal(t, deletedChannel, lastChannel)
	assert.True(t, indexedChannels["ch1"], "Active channel should be indexed")
	assert.True(t, indexedChannels["ch2"], "Deleted channel should also be indexed")
}

type bulkOp struct {
	index, op, id string
}

type bulkOpRecorder struct {
	ops []bulkOp
}

func (r *bulkOpRecorder) add(indexName, indexOp, docID string, _ io.ReadSeeker) error {
	r.ops = append(r.ops, bulkOp{index: indexName, op: indexOp, id: docID})
	return nil
}

func (r *bulkOpRecorder) ids(op string) []string {
	var ids []string
	for _, o := range r.ops {
		if o.op == op {
			ids = append(ids, o.id)
		}
	}
	return ids
}

func TestBulkIndexSkipsDeletesForEmptyIndexes(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	jobServer := &jobs.JobServer{ConfigService: &testutils.StaticConfigService{Cfg: cfg}}
	now := time.Now()

	newWorker := func(t *testing.T, rec *bulkOpRecorder, isIndexEmpty func(string) (bool, error)) *IndexerWorker {
		return NewIndexerWorker("test", model.ElasticsearchSettingsOSBackend, jobServer, mlog.CreateConsoleTestLogger(t), nil, nil, nil, rec.add, nil, isIndexEmpty)
	}

	livePost := &model.PostForIndexing{Post: model.Post{Id: model.NewId(), CreateAt: now.UnixMilli()}}
	deletedPost := &model.PostForIndexing{Post: model.Post{Id: model.NewId(), CreateAt: now.UnixMilli(), DeleteAt: now.UnixMilli()}}
	liveFile := &model.FileForIndexing{FileInfo: model.FileInfo{Id: model.NewId(), PostId: livePost.Id, CreateAt: now.UnixMilli()}}
	deletedFile := &model.FileForIndexing{FileInfo: model.FileInfo{Id: model.NewId(), PostId: deletedPost.Id, CreateAt: now.UnixMilli(), DeleteAt: now.UnixMilli()}}

	for _, tc := range []struct {
		name          string
		isIndexEmpty  func(string) (bool, error)
		expectDeletes bool
	}{
		{
			name:          "empty indexes",
			isIndexEmpty:  func(string) (bool, error) { return true, nil },
			expectDeletes: false,
		},
		{
			name:          "populated indexes",
			isIndexEmpty:  func(string) (bool, error) { return false, nil },
			expectDeletes: true,
		},
		{
			name:          "failing emptiness check",
			isIndexEmpty:  func(string) (bool, error) { return false, fmt.Errorf("timeout") },
			expectDeletes: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := &bulkOpRecorder{}
			worker := newWorker(t, rec, tc.isIndexEmpty)

			_, appErr := worker.BulkIndexPosts([]*model.PostForIndexing{livePost, deletedPost}, IndexingProgress{Now: now})
			require.Nil(t, appErr)
			_, appErr = worker.BulkIndexFiles([]*model.FileForIndexing{liveFile, deletedFile}, IndexingProgress{Now: now})
			require.Nil(t, appErr)

			assert.ElementsMatch(t, []string{livePost.Id, liveFile.Id}, rec.ids(indexOp))
			if tc.expectDeletes {
				assert.ElementsMatch(t, []string{deletedPost.Id, deletedFile.Id}, rec.ids(deleteOp))
				assert.Zero(t, worker.skippedDeletes)
			} else {
				assert.Empty(t, rec.ids(deleteOp))
				assert.Equal(t, int64(2), worker.skippedDeletes)
			}
		})
	}

	t.Run("checks each index once, before writing to it", func(t *testing.T) {
		rec := &bulkOpRecorder{}
		var checked []string
		worker := newWorker(t, rec, func(indexName string) (bool, error) {
			for _, o := range rec.ops {
				assert.NotEqual(t, indexName, o.index, "index checked after the job wrote to it")
			}
			checked = append(checked, indexName)
			return true, nil
		})

		yesterday := now.AddDate(0, 0, -1)
		postFromYesterday := &model.PostForIndexing{Post: model.Post{Id: model.NewId(), CreateAt: yesterday.UnixMilli()}}

		_, appErr := worker.BulkIndexPosts([]*model.PostForIndexing{postFromYesterday, livePost}, IndexingProgress{Now: now})
		require.Nil(t, appErr)
		_, appErr = worker.BulkIndexPosts([]*model.PostForIndexing{deletedPost}, IndexingProgress{Now: now})
		require.Nil(t, appErr)

		prefix := *cfg.ElasticsearchSettings.IndexPrefix + IndexBasePosts
		assert.Equal(t, []string{
			fmt.Sprintf("%s_%d_%02d_%02d", prefix, yesterday.Year(), yesterday.Month(), yesterday.Day()),
			fmt.Sprintf("%s_%d_%02d_%02d", prefix, now.Year(), now.Month(), now.Day()),
		}, checked)
		assert.Empty(t, rec.ids(deleteOp), "the index was empty when the job first wrote to it")
		assert.Equal(t, int64(1), worker.skippedDeletes)
	})
}

func TestCurrentProgressCapsAt100(t *testing.T) {
	tests := []struct {
		name     string
		progress IndexingProgress
		expected int64
	}{
		{
			name: "normal progress",
			progress: IndexingProgress{
				DonePostsCount:     50,
				TotalPostsCount:    100,
				DoneChannelsCount:  0,
				TotalChannelsCount: 100,
				DoneUsersCount:     0,
				TotalUsersCount:    100,
				DoneFilesCount:     0,
				TotalFilesCount:    100,
			},
			expected: 12,
		},
		{
			name: "exactly 100%",
			progress: IndexingProgress{
				DonePostsCount:     100,
				TotalPostsCount:    100,
				DoneChannelsCount:  50,
				TotalChannelsCount: 50,
				DoneUsersCount:     10,
				TotalUsersCount:    10,
				DoneFilesCount:     5,
				TotalFilesCount:    5,
			},
			expected: 100,
		},
		{
			name:     "all totals zero returns 100",
			progress: IndexingProgress{},
			expected: 100,
		},
		{
			name: "done exceeds total, caps at 100",
			progress: IndexingProgress{
				DonePostsCount:     20000000,
				TotalPostsCount:    10000000,
				DoneChannelsCount:  0,
				TotalChannelsCount: 100000,
				DoneUsersCount:     0,
				TotalUsersCount:    10000,
				DoneFilesCount:     0,
				TotalFilesCount:    100000,
			},
			expected: 100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.progress.CurrentProgress())
		})
	}
}

func TestEntityCountFallback(t *testing.T) {
	tests := []struct {
		name      string
		jobData   model.StringMap
		dataKey   string
		estimate  int64
		doneCount int64
		expected  int64
	}{
		{
			name:      "no stored value, uses estimate",
			jobData:   model.StringMap{},
			dataKey:   "total_posts_count",
			estimate:  10000000,
			doneCount: 0,
			expected:  10000000,
		},
		{
			name:      "stored value preferred over estimate",
			jobData:   model.StringMap{"total_posts_count": "5000000"},
			dataKey:   "total_posts_count",
			estimate:  10000000,
			doneCount: 0,
			expected:  5000000,
		},
		{
			name:      "doneCount exceeds stored value",
			jobData:   model.StringMap{"total_posts_count": "5000000"},
			dataKey:   "total_posts_count",
			estimate:  10000000,
			doneCount: 7000000,
			expected:  7000000,
		},
		{
			name:      "doneCount exceeds estimate when no stored value",
			jobData:   model.StringMap{},
			dataKey:   "total_posts_count",
			estimate:  10000000,
			doneCount: 15000000,
			expected:  15000000,
		},
		{
			name:      "invalid stored value falls back to estimate",
			jobData:   model.StringMap{"total_posts_count": "not-a-number"},
			dataKey:   "total_posts_count",
			estimate:  10000000,
			doneCount: 0,
			expected:  10000000,
		},
		{
			name:      "zero stored value falls back to estimate",
			jobData:   model.StringMap{"total_posts_count": "0"},
			dataKey:   "total_posts_count",
			estimate:  10000000,
			doneCount: 0,
			expected:  10000000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := &model.Job{Data: tt.jobData}
			result := entityCountFallback(job, tt.dataKey, tt.estimate, tt.doneCount)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSetEntityCount(t *testing.T) {
	type entityCountMocks struct {
		store    *mocks.Store
		post     *mocks.PostStore
		channel  *mocks.ChannelStore
		user     *mocks.UserStore
		fileInfo *mocks.FileInfoStore
	}

	setupEntityCountMocks := func() entityCountMocks {
		m := entityCountMocks{
			store:    &mocks.Store{},
			post:     &mocks.PostStore{},
			channel:  &mocks.ChannelStore{},
			user:     &mocks.UserStore{},
			fileInfo: &mocks.FileInfoStore{},
		}
		m.store.On("Post").Return(m.post)
		m.store.On("Channel").Return(m.channel)
		m.store.On("User").Return(m.user)
		m.store.On("FileInfo").Return(m.fileInfo)
		return m
	}

	allEntitiesEnabled := model.StringMap{
		"index_posts":    "true",
		"index_channels": "true",
		"index_users":    "true",
		"index_files":    "true",
	}

	t.Run("stores counts on success", func(t *testing.T) {
		m := setupEntityCountMocks()
		m.post.On("AnalyticsPostCount", mock.Anything).Return(int64(500), nil)
		m.channel.On("AnalyticsTypeCount", "", model.ChannelType("")).Return(int64(200), nil)
		m.user.On("Count", mock.Anything).Return(int64(50), nil)
		m.fileInfo.On("CountAll").Return(int64(300), nil)

		job := &model.Job{Data: maps.Clone(allEntitiesEnabled)}
		progress := setEntityCount(mlog.CreateConsoleTestLogger(t), &jobs.JobServer{Store: m.store}, IndexingProgress{}, job)

		assert.Equal(t, int64(500), progress.TotalPostsCount)
		assert.Equal(t, int64(200), progress.TotalChannelsCount)
		assert.Equal(t, int64(50), progress.TotalUsersCount)
		assert.Equal(t, int64(300), progress.TotalFilesCount)

		assert.Equal(t, "500", job.Data["total_posts_count"])
		assert.Equal(t, "200", job.Data["total_channels_count"])
		assert.Equal(t, "50", job.Data["total_users_count"])
		assert.Equal(t, "300", job.Data["total_files_count"])
	})

	t.Run("falls back to job data on query failure", func(t *testing.T) {
		m := setupEntityCountMocks()
		m.post.On("AnalyticsPostCount", mock.Anything).Return(int64(0), fmt.Errorf("timeout"))
		m.channel.On("AnalyticsTypeCount", "", model.ChannelType("")).Return(int64(0), fmt.Errorf("timeout"))
		m.user.On("Count", mock.Anything).Return(int64(0), fmt.Errorf("timeout"))
		m.fileInfo.On("CountAll").Return(int64(0), fmt.Errorf("timeout"))

		jobData := maps.Clone(allEntitiesEnabled)
		jobData["total_posts_count"] = "8000000"
		jobData["total_channels_count"] = "50000"
		jobData["total_users_count"] = "5000"
		jobData["total_files_count"] = "75000"
		job := &model.Job{Data: jobData}

		progress := setEntityCount(mlog.CreateConsoleTestLogger(t), &jobs.JobServer{Store: m.store}, IndexingProgress{}, job)

		assert.Equal(t, int64(8000000), progress.TotalPostsCount)
		assert.Equal(t, int64(50000), progress.TotalChannelsCount)
		assert.Equal(t, int64(5000), progress.TotalUsersCount)
		assert.Equal(t, int64(75000), progress.TotalFilesCount)
	})

	t.Run("uses max of fallback and done count", func(t *testing.T) {
		m := setupEntityCountMocks()
		m.post.On("AnalyticsPostCount", mock.Anything).Return(int64(0), fmt.Errorf("timeout"))

		job := &model.Job{
			Data: model.StringMap{
				"index_posts":       "true",
				"index_channels":    "false",
				"index_users":       "false",
				"index_files":       "false",
				"total_posts_count": strconv.FormatInt(estimatedPostCount, 10),
			},
		}
		inputProgress := IndexingProgress{
			DonePostsCount: estimatedPostCount + 5000000,
		}

		progress := setEntityCount(mlog.CreateConsoleTestLogger(t), &jobs.JobServer{Store: m.store}, inputProgress, job)

		assert.Equal(t, int64(estimatedPostCount+5000000), progress.TotalPostsCount)
	})
}
