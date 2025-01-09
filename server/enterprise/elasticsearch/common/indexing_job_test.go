// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
	mockChannelStore.On("GetTeamMembersForChannel", "ch1").Return([]string{"team1"}, nil)
	mockChannelStore.On("GetTeamMembersForChannel", "ch2").Return([]string{"team1"}, nil)

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
