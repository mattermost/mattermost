// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wiki_export

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func makeJobServer(t *testing.T) *jobs.JobServer {
	t.Helper()
	logger := mlog.CreateConsoleTestLogger(t)
	mockStore := &mocks.Store{}
	return jobs.NewJobServer(&mockConfigService{}, mockStore, nil, logger)
}

func TestMakeWorker(t *testing.T) {
	t.Run("returns non-nil worker", func(t *testing.T) {
		jobServer := makeJobServer(t)

		worker := MakeWorker(jobServer, nil)
		require.NotNil(t, worker)
	})

	t.Run("worker is always enabled", func(t *testing.T) {
		jobServer := makeJobServer(t)

		worker := MakeWorker(jobServer, nil)
		require.True(t, worker.IsEnabled(&model.Config{}))
	})

	t.Run("worker has job channel", func(t *testing.T) {
		jobServer := makeJobServer(t)

		worker := MakeWorker(jobServer, nil)
		require.NotNil(t, worker.JobChannel())
	})
}

type mockConfigService struct{}

func (m *mockConfigService) Config() *model.Config {
	return &model.Config{}
}

func (m *mockConfigService) AddConfigListener(func(old, current *model.Config)) string {
	return ""
}

func (m *mockConfigService) RemoveConfigListener(string) {}
