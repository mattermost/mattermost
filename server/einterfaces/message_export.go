// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type MessageExportInterface interface {
	StartSynchronizeJob(rctx request.CTX, exportFromTimestamp int64) (*model.Job, *model.AppError)
}
