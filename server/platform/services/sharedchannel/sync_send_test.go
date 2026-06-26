// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"database/sql"
	"errors"
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestService() *Service {
	return &Service{
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}
}

func TestProcessTask_RemoteClusterLookup(t *testing.T) {
	newServiceWithRemoteGet := func(t *testing.T, remoteID string, rc *model.RemoteCluster, getErr error) *Service {
		t.Helper()

		mockRemoteClusterStore := &mocks.RemoteClusterStore{}
		mockRemoteClusterStore.On("Get", remoteID, false).Return(rc, getErr)

		mockStore := &mocks.Store{}
		mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)

		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

		return &Service{
			server:       mockServer,
			changeSignal: make(chan struct{}, 1),
			tasks:        make(map[string]syncTask),
		}
	}

	t.Run("deleted or missing remote is skipped without error or retry", func(t *testing.T) {
		remoteID := model.NewId()
		// Mirror how the store wraps the not-found case.
		notFound := fmt.Errorf("failed to find RemoteCluster: %w", sql.ErrNoRows)
		scs := newServiceWithRemoteGet(t, remoteID, nil, notFound)

		err := scs.processTask(newSyncTask("channel-1", "", remoteID, nil, nil))

		require.NoError(t, err, "a deleted remote should be skipped, not surfaced as an error")
		assert.Empty(t, scs.tasks, "the task should not be re-enqueued for retry")
	})

	t.Run("transient error is propagated for retry", func(t *testing.T) {
		remoteID := model.NewId()
		dbErr := errors.New("write tcp: connection reset by peer")
		scs := newServiceWithRemoteGet(t, remoteID, nil, dbErr)

		err := scs.processTask(newSyncTask("channel-1", "", remoteID, nil, nil))

		require.Error(t, err, "a transient lookup error must still be returned so the task retries")
		assert.ErrorContains(t, err, "connection reset by peer")
	})
}

func TestAddTask_OriginRemoteIDMerge(t *testing.T) {
	tests := []struct {
		name           string
		firstOrigin    string
		secondOrigin   string
		expectedOrigin string
	}{
		{
			name:           "same remote origin is preserved",
			firstOrigin:    "remote-A",
			secondOrigin:   "remote-A",
			expectedOrigin: "remote-A",
		},
		{
			name:           "local then remote clears origin",
			firstOrigin:    "",
			secondOrigin:   "remote-A",
			expectedOrigin: "",
		},
		{
			name:           "remote then local clears origin",
			firstOrigin:    "remote-A",
			secondOrigin:   "",
			expectedOrigin: "",
		},
		{
			name:           "different remotes clears origin",
			firstOrigin:    "remote-A",
			secondOrigin:   "remote-B",
			expectedOrigin: "",
		},
		{
			name:           "both local stays empty",
			firstOrigin:    "",
			secondOrigin:   "",
			expectedOrigin: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scs := newTestService()
			channelID := "channel-1"

			first := newSyncTask(channelID, "", "", nil, nil)
			first.originRemoteID = tc.firstOrigin
			scs.addTask(first)

			second := newSyncTask(channelID, "", "", nil, nil)
			second.originRemoteID = tc.secondOrigin
			scs.addTask(second)

			merged, ok := scs.tasks[first.id]
			require.True(t, ok, "task should exist")
			assert.Equal(t, tc.expectedOrigin, merged.originRemoteID)
		})
	}
}

func TestStripSharedChannelStatePostsForSync(t *testing.T) {
	sd := &syncData{
		posts: []*model.Post{
			{Id: "state-1", Type: model.PostTypeSharedChannelState, ChannelId: "ch1", Message: "ignored"},
			{Id: "user-1", Type: model.PostTypeDefault, ChannelId: "ch1", Message: "hello"},
		},
	}

	stripSharedChannelStatePostsForSync(sd)

	require.Len(t, sd.posts, 1)
	assert.Equal(t, "user-1", sd.posts[0].Id)
	assert.Equal(t, model.PostTypeDefault, sd.posts[0].Type)
}
