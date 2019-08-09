// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/mattermost/mattermost-server/model"
)

func (p *HelpersImpl) CheckRequiredConfig(requiredConfig, actualConfig *model.Config) (bool, error) {
	// appConfig := p.API.GetConfig()
	return false, nil
}
