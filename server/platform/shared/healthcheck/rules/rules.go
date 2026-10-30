// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package rules

import (
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/auth"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/cluster"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/compliance"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/database"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/jobs"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/license"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/notifications"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/platform"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/search"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/version"
)
