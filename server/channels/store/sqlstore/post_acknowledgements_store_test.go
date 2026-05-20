// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestPostAcknowledgementsStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPostAcknowledgementsStore)
}
