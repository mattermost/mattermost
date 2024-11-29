// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
)

func TestElasticSearchIndexerJobIsEnabled(t *testing.T) {
	t.Run("ElasticSearch feature is enabled then job is enabled", func(t *testing.T) {
		th := api4.SetupEnterpriseWithStoreMock(t)
		defer th.TearDown()

		th.Server.SetLicense(model.NewTestLicense("elastic_search"))

		esImpl := &ElasticsearchIndexerInterfaceImpl{
			Server: th.Server,
		}
		worker := esImpl.MakeWorker()

		config := &model.Config{
			ElasticsearchSettings: model.ElasticsearchSettings{
				EnableIndexing: model.NewPointer(true),
			},
		}

		result := worker.IsEnabled(config)

		assert.Equal(t, result, true)
	})

	t.Run("there is NO license then job is disabled", func(t *testing.T) {
		th := api4.SetupEnterpriseWithStoreMock(t)
		defer th.TearDown()

		th.Server.SetLicense(nil)

		esImpl := &ElasticsearchIndexerInterfaceImpl{
			Server: th.Server,
		}
		worker := esImpl.MakeWorker()

		config := &model.Config{
			ElasticsearchSettings: model.ElasticsearchSettings{
				EnableIndexing: model.NewPointer(true),
			},
		}

		result := worker.IsEnabled(config)

		assert.Equal(t, result, false)
	})
}

func TestElasticSearchIndexerPending(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	// Set up the state for the tests.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	impl := ElasticsearchIndexerInterfaceImpl{
		Server: th.App.Srv(),
	}

	worker := impl.MakeWorker()
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, worker, nil)

	go worker.Run()

	job, appErr := th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)

	worker.JobChannel() <- *job

	worker.Stop()

	job, err := th.App.Srv().Store().Job().Get(th.Context, job.Id)
	require.NoError(t, err)
	assert.Equal(t, job.Status, model.JobStatusPending)
}
