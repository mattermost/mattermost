// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

var enableFullyParallelTests bool

func InitTest(logger mlog.LoggerIFace, parallelism int) {
	enableFullyParallelTests = parallelism > 1
	initStores(logger, parallelism)
}

func TearDownTest() {
	tearDownStores()
}
