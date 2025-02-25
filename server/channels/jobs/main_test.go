// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs_test

import (
	"flag"
	"os"
	"strconv"
	"testing"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

var mainHelper *testlib.MainHelper

func TestMain(m *testing.M) {
	var parallelism int
	if f := flag.Lookup("test.parallel"); f != nil {
		parallelism, _ = strconv.Atoi(f.Value.String())
	}
	runParallel := os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" && parallelism > 1
	if runParallel {
		mlog.Info("Fully parallel tests enabled", mlog.Int("parallelism", parallelism))
	}

	oldWatcherPollingInterval := jobs.DefaultWatcherPollingInterval
	jobs.DefaultWatcherPollingInterval = 100
	defer func() {
		jobs.DefaultWatcherPollingInterval = oldWatcherPollingInterval
	}()

	options := testlib.HelperOptions{
		EnableStore:     true,
		EnableResources: true,
		RunParallel:     runParallel,
		Parallelism:     parallelism,
	}

	mainHelper = testlib.NewMainHelperWithOptions(&options)
	defer mainHelper.Close()

	mainHelper.Main(m)
}
