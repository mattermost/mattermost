// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"os"
	"testing"

	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/stretchr/testify/require"
)

func TestBulkProcessor(t *testing.T) {
	th := api4.SetupEnterprise(t)
	defer th.TearDown()

	if os.Getenv("IS_CI") == "true" {
		os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://opensearch:9201")
		os.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", "opensearch")
	}

	defer func() {
		if os.Getenv("IS_CI") == "true" {
			os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
			os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
		}
	}()

	th.App.UpdateConfig(func(cfg *model.Config) {
		if os.Getenv("IS_CI") == "true" {
			*cfg.ElasticsearchSettings.ConnectionURL = "http://opensearch:9201"
		} else {
			*cfg.ElasticsearchSettings.ConnectionURL = "http://localhost:9201"
		}
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsOSBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
	})

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	bulk := NewBulk(th.App.Config().ElasticsearchSettings,
		th.Server.Platform().Log(),
		client)

	post, err := common.ESPostFromPost(&model.Post{
		Id:      model.NewId(),
		Message: "hello world",
	}, "myteam")
	require.NoError(t, err)

	err = bulk.IndexOp(&types.IndexOperation{
		Index_: model.NewPointer("myindex"),
		Id_:    model.NewPointer(post.Id),
	}, post)
	require.NoError(t, err)

	require.Equal(t, 1, bulk.pendingRequests)

	err = bulk.Stop()
	require.NoError(t, err)

	require.Equal(t, 0, bulk.pendingRequests)
}
