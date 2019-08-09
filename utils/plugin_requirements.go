// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import "github.com/mattermost/mattermost-server/model"

func CheckRequiredConfig(requiredConfig, actualConfig *model.Config) (bool, error) {
	if requiredConfig == nil {
		return true, nil
	}

	// Leverage the existing merge logic. If we merge the current config with the plugin requirements
	// and the result is different than the current config, the plugin is not compatible.
	merged, err := Merge(actualConfig, requiredConfig, nil)
	if err != nil {
		return false, err
	}

	mergedConfig := merged.(model.Config)
	if mergedConfig.ToJson() != actualConfig.ToJson() {
		return false, nil
	}

	return true, nil
}
