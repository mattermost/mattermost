// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import "github.com/mattermost/mattermost-server/server/public/model"

type LicenseInterface interface {
	CanStartTrial() (bool, error)
	GetPrevTrial() (*model.License, error)
}
