// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build enterprise || sourceavailable

package enterprise

import (
	// Needed to ensure the init() method in the EE gets run
	_ "github.com/mattermost/mattermost/server/v8/enterprise/metrics"
	// Needed to ensure the init() method in the EE gets run
	_ "github.com/mattermost/mattermost/server/v8/enterprise/message_export"
	// Needed to ensure the init() method in the EE gets run
	_ "github.com/mattermost/mattermost/server/v8/enterprise/message_export/actiance_export"
	// Needed to ensure the init() method in the EE gets run
	_ "github.com/mattermost/mattermost/server/v8/enterprise/message_export/csv_export"
	// Needed to ensure the init() method in the EE gets run
	_ "github.com/mattermost/mattermost/server/v8/enterprise/message_export/global_relay_export"
	// Needed to ensure the init() method in the EE gets run
	_ "github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch"
)
