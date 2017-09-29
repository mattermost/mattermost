// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/model"
)

type DataRetentionInterface interface {
	GetPolicy() (*model.DataRetentionPolicy, *model.AppError)
}
