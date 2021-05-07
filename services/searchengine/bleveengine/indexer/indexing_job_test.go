// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ebleveengine

import (
	"errors"
	"io/ioutil"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine/bleveengine"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/utils/testutils"
	"github.com/stretchr/testify/require"
)

func TestBleveIndexer(t *testing.T) {
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	t.Run("Call GetOldestEntityCreationTime for the first indexing call", func(t *testing.T) {
		job := &model.Job{
			Id:       model.NewId(),
			CreateAt: model.GetMillis(),
			Status:   model.JOB_STATUS_PENDING,
			Type:     model.JOB_TYPE_BLEVE_POST_INDEXING,
		}

		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JOB_STATUS_PENDING, model.JOB_STATUS_IN_PROGRESS).Return(true, nil)
		mockStore.JobStore.On("UpdateOptimistically", job, model.JOB_STATUS_IN_PROGRESS).Return(true, nil)
		mockStore.PostStore.On("GetOldestEntityCreationTime").Return(int64(1), errors.New("")) // intentionally return error to return from function

		tempDir, err := ioutil.TempDir("", "setupConfigFile")
		require.NoError(t, err)

		t.Cleanup(func() {
			os.RemoveAll(tempDir)
		})

		cfg := &model.Config{
			BleveSettings: model.BleveSettings{
				EnableIndexing: model.NewBool(true),
				IndexDir:       model.NewString(tempDir),
			},
		}

		jobServer := &jobs.JobServer{
			Store: mockStore,
			ConfigService: &testutils.StaticConfigService{
				Cfg: cfg,
			},
		}

		bleveEngine := bleveengine.NewBleveEngine(cfg, jobServer)
		aErr := bleveEngine.Start()
		require.Nil(t, aErr)

		worker := &BleveIndexerWorker{
			jobServer: jobServer,
			engine:    bleveEngine,
		}

		worker.DoJob(job)
	})
}
