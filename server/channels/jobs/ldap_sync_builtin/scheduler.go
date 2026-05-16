// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ldap_sync_builtin

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const defaultSyncIntervalMinutes = 60

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		return cfg.LdapSettings.Enable != nil && *cfg.LdapSettings.Enable &&
			cfg.LdapSettings.EnableSync != nil && *cfg.LdapSettings.EnableSync
	}

	intervalMinutes := defaultSyncIntervalMinutes
	if v := jobServer.Config().LdapSettings.SyncIntervalMinutes; v != nil && *v > 0 {
		intervalMinutes = *v
	}

	return jobs.NewPeriodicScheduler(
		jobServer,
		model.JobTypeLdapSync,
		time.Duration(intervalMinutes)*time.Minute,
		isEnabled,
	)
}
