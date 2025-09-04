// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/stretchr/testify/require"
)

func TestNewBulk(t *testing.T) {
	th := api4.SetupEnterprise(t)
	defer th.TearDown()
	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())

	t.Run("zeroed bulksettings", func(t *testing.T) {
		_, err := NewBulk(
			common.BulkSettings{},
			client,
			time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
			th.Server.Platform().Log(),
		)

		require.Error(t, err)
	})

	t.Run("incompatible bulkSettings", func(t *testing.T) {
		_, err := NewBulk(
			common.BulkSettings{
				FlushBytes:    100,
				FlushInterval: 5 * time.Second,
				FlushNumReqs:  10,
			},
			client,
			time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
			th.Server.Platform().Log(),
		)

		require.Error(t, err)
	})

	t.Run("data-based bulk client", func(t *testing.T) {
		client, err := NewBulk(
			common.BulkSettings{
				FlushBytes:    100,
				FlushInterval: 5 * time.Second,
				FlushNumReqs:  0,
			},
			client,
			time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
			th.Server.Platform().Log(),
		)
		require.NoError(t, err)

		_, ok := client.(*DataBulkClient)
		require.True(t, ok)
	})

	t.Run("requests-based bulk client", func(t *testing.T) {
		client, err := NewBulk(
			common.BulkSettings{
				FlushBytes:    0,
				FlushInterval: 5 * time.Second,
				FlushNumReqs:  100,
			},
			client,
			time.Duration(*th.App.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second,
			th.Server.Platform().Log(),
		)
		require.NoError(t, err)

		_, ok := client.(*ReqBulkClient)
		require.True(t, ok)
	})
}
