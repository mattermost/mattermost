// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package interfaces

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

type FixCRTChannelUnreadsJobInterface interface {
	MakeWorker() model.Worker
	// MakeScheduler() model.Scheduler // TODO Schedule job creation if job not already running and if migration not yet done
}
