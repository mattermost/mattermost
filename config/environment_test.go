// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestRemoveEnvOverrides(t *testing.T) {
	defaultCfg := &model.Config{}
	defaultCfg.SetDefaults()

	newCfg := defaultCfg.Clone()
	newCfg.EmailSettings.EnableSignUpWithEmail = model.NewBool(false)

	envOverrides := map[string]interface{}{
		"EmailSettings": map[string]interface{}{
			"EnableSignUpWithEmail": false,
		},
	}

	updatedCfg := removeEnvOverrides(newCfg, defaultCfg, envOverrides)
	require.NotNil(t, updatedCfg)
	require.True(t, *updatedCfg.EmailSettings.EnableSignUpWithEmail)

	envOverrides["ServiceSettings"] = map[string]interface{}{
		"NonExistentConfig": true,
	}

	require.NotPanics(t, func() {
		_ = removeEnvOverrides(defaultCfg, defaultCfg, envOverrides)
	}, "invalid setting should not panic")
}
