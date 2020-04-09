// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"context"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

// just done so server will pass i18n-export
var DummyError = model.NewAppError("saveConfig", "ent.compliance.csv.warning.appError", nil, "", http.StatusForbidden)

type MessageExportInterface interface {
	StartSynchronizeJob(ctx context.Context, exportFromTimestamp int64) (*model.Job, *model.AppError)
	RunExport(format string, since int64) (int64, *model.AppError)
}
