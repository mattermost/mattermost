// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/adacta-ru/mattermost-server/v5/store/searchtest"
	"github.com/adacta-ru/mattermost-server/v5/store/storetest"
)

func TestUserStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestUserStore)
}

func TestSearchUserStore(t *testing.T) {
	StoreTestWithSearchTestEngine(t, searchtest.TestSearchUserStore)
}
