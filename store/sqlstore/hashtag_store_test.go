// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/store/storetest"
)

func TestHashtagStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestHashtagStore)
}
