// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestPageStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPageStore)
}
