// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package nosqlstore_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/store/memorystore"
	"github.com/mattermost/mattermost-server/store/storetest"
)

func TestWebhookStore(t *testing.T) {
	s, err := memorystore.New()
	require.NoError(t, err)
	storetest.TestWebhookStore(t, s)
}
