// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"testing"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/filestore/mocks"
	"github.com/mattermost/mattermost/server/public/shared/request"
)


func createTestClient(t *testing.T, rctx request.CTX, cfg *model.Config, fileStore model.FileBackend) *opensearchapi.Client {
	t.Helper()

	if fileStore == nil {
		fileStore = &mocks.FileBackend{}
	}

	client, err := createClient(rctx.Logger(), cfg, fileStore, true)
	require.Nil(t, err)
	return client
}
