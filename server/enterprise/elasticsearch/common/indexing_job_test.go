// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"fmt"
	"io"
	"maps"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
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
	config.ElasticsearchSettings.IndexPrefix = model.NewPointer("test_")

	// Call the function
	lastChannel, appErr := BulkIndexChannels(config, mockStore, mlog.CreateConsoleTestLogger(t), addItemToBulkProcessorFn, channels, IndexingProgress{})

	// Verify results
	require.Nil(t, appErr)
	assert.Equal(t, deletedChannel, lastChannel)
	assert.True(t, indexedChannels["ch1"], "Active channel should be indexed")
	assert.True(t, indexedChannels["ch2"], "Deleted channel should also be indexed")
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
