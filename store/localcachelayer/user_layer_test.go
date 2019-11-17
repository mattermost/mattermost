// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/store/storetest"
)

func TestTeamStore(t *testing.T) {
	StoreTestWithSqlSupplier(t, storetest.TestUserStore)
}
