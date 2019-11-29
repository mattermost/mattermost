// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore_test

import (
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"testing"

	"github.com/mattermost/mattermost-server/v5/testlib"
)

var mainHelper *testlib.MainHelper

func TestMain(m *testing.M) {
	mainHelper = testlib.NewMainHelperWithOptions(nil)
	defer mainHelper.Close()

	sqlstore.InitTest()

	mainHelper.Main(m)
	sqlstore.TearDownTest()
}
