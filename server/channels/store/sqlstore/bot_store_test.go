// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/channels/store/storetest"
)

func TestBotStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestBotStore)
}
