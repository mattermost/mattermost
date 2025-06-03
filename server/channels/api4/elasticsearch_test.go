// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestElasticsearchTest(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	t.Run("as system user", func(t *testing.T) {
		resp, err := th.Client.TestElasticsearch(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		resp, err := th.SystemAdminClient.TestElasticsearch(context.Background())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("invalid config", func(t *testing.T) {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.ElasticsearchSettings.Password = nil

		data, err := json.Marshal(cfg)
		require.NoError(t, err)

		resp, err := th.SystemAdminClient.DoAPIPost(context.Background(), "/elasticsearch/test", string(data))
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ElasticsearchSettings.SetDefaults()
			*cfg.ExperimentalSettings.RestrictSystemAdmin = true
		})

		resp, err := th.SystemAdminClient.TestElasticsearch(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestElasticsearchPurgeIndexes(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	t.Run("as system user", func(t *testing.T) {
		resp, err := th.Client.PurgeElasticsearchIndexes(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		resp, err := th.SystemAdminClient.PurgeElasticsearchIndexes(context.Background())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := th.SystemAdminClient.PurgeElasticsearchIndexes(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}
