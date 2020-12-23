// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore_test

import (
	"testing"

	"github.com/adacta-ru/mattermost-server/v5/mlog"
	"github.com/adacta-ru/mattermost-server/v5/store/sqlstore"

	"github.com/adacta-ru/mattermost-server/v5/testlib"
)

var mainHelper *testlib.MainHelper

func TestMain(m *testing.M) {
	mlog.DisableZap()
	mainHelper = testlib.NewMainHelperWithOptions(nil)
	defer mainHelper.Close()

	sqlstore.InitTest()

	mainHelper.Main(m)
	sqlstore.TearDownTest()
}
