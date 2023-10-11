// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type MessageExportInterface interface {
	StartSynchronizeJob(c *request.Context, exportFromTimestamp int64) (*model.Job, *model.AppError)
	RunExport(format string, since int64, limit int) (int64, *model.AppError)
}
