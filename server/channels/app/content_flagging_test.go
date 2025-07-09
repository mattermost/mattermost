// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"testing"
)

func setupContentFlagging(tb testing.TB) *TestHelper {
	return SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ContentFlaggingSettings.EnableContentFlagging = true
		cfg.FeatureFlags.ContentFlagging = true
	})
}
