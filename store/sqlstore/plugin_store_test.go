// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/store/storetest"
)

func TestPluginStore(t *testing.T) {
	StoreTest(t, storetest.TestPluginStore)
}
