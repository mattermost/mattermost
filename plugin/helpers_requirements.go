// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (p *HelpersImpl) CheckRequiredConfig(requiredConfig, actualConfig *model.Config) (bool, error) {
	return utils.CheckRequiredConfig(requiredConfig, actualConfig)
}
