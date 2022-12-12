// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"context"

	"github.com/mattermost/mattermost-server/v6/model"
)

type MessageExportInterface interface {
	StartSynchronizeJob(ctx context.Context, exportFromTimestamp int64) (*model.Job, *model.AppError)
	RunExport(format string, since, until int64, limit int) (int64, *model.AppError)
}
