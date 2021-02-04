// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"flag"
	"testing"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/testlib"
)

var mainHelper *testlib.MainHelper
var replicaFlag bool

func TestMain(m *testing.M) {
	flag.BoolVar(&replicaFlag, "mysql-replica", false, "")
	flag.Parse()

	var options = testlib.HelperOptions{
		EnableStore:     true,
		EnableResources: true,
	}

	mlog.DisableZap()

	mainHelper = testlib.NewMainHelperWithOptions(&options)
	defer mainHelper.Close()

	mainHelper.Main(m)
}
