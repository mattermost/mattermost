// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package rules registers the built-in health rule catalog; importing it for side effect
// populates healthcheck.Builtin(). Each area package gets one blank import here.
package rules

import (
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/cluster"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/notifications"
)
