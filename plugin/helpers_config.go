// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

// CheckRequiredServerConfiguration checks if the server is configured according to
// plugin requirements.
func (p *HelpersImpl) CheckRequiredServerConfiguration(req *model.Config) (bool, error) {
	cfg := p.API.GetConfig()

	if req == nil {
		return true, nil
	}

	mc, err := utils.Merge(req, cfg, nil)
	if err != nil {
		return false, errors.Wrap(err, "could not merge configurations")
	}

	mergedCfg := mc.(model.Config)
	if mergedCfg.ToJson() != cfg.ToJson() {
		return false, nil
	}

	return true, nil
}
