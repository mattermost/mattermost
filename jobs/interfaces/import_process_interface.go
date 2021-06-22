// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package interfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type ImportProcessInterface interface {
	MakeWorker() model.Worker
}
