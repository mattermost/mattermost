// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// singletonJobTypes lists the job types of which at most one job may be pending and at most one
// may be running across the cluster. Keep in sync with the backfill in migration 000244.
var singletonJobTypes = map[string]bool{
	model.JobTypeActiveUsers:                  true,
	model.JobTypeAutoTranslationRecovery:      true,
	model.JobTypeCleanupDesktopTokens:         true,
	model.JobTypeCleanupExpiredAccessTokens:   true,
	model.JobTypeDataRetention:                true,
	model.JobTypeDeleteExpiredPosts:           true,
	model.JobTypeElasticsearchPostAggregation: true,
	model.JobTypeExpiryNotify:                 true,
	model.JobTypeExportDelete:                 true,
	model.JobTypeImportDelete:                 true,
	model.JobTypeInstallPluginNotifyAdmin:     true,
	model.JobTypeLastAccessiblePost:           true,
	model.JobTypeLdapSync:                     true,
	model.JobTypeMessageExport:                true,
	model.JobTypeMobileSessionMetadata:        true,
	model.JobTypeNotifyExpiringAccessTokens:   true,
	model.JobTypePlugins:                      true,
	model.JobTypePostPersistentNotifications:  true,
	model.JobTypeProductNotices:               true,
	model.JobTypePushProxyAuth:                true,
	model.JobTypeRefreshMaterializedViews:     true,
	model.JobTypeTrialNotifyAdmin:             true,
	model.JobTypeUpgradeNotifyAdmin:           true,
}

// ConcurrencyKeyForType returns the concurrency key assigned to new jobs of the given type, or
// the empty string if jobs of that type may run concurrently.
func ConcurrencyKeyForType(jobType string) string {
	if singletonJobTypes[jobType] {
		return jobType
	}
	return ""
}

var (
	// JobHeartbeatInterval is how often a node refreshes LastActivityAt of the keyed jobs it runs.
	// (Defining as `var` rather than `const` allows tests to lower the interval.)
	JobHeartbeatInterval = time.Minute
	// StaleJobThreshold is how long a running keyed job may go without activity before another
	// node claiming a job with the same key takes over by marking it as failed.
	StaleJobThreshold = 10 * time.Minute
)

type claimedJobs struct {
	mut sync.Mutex
	ids map[string]struct{}
}

func (c *claimedJobs) track(id string) {
	c.mut.Lock()
	defer c.mut.Unlock()
	if c.ids == nil {
		c.ids = make(map[string]struct{})
	}
	c.ids[id] = struct{}{}
}

func (c *claimedJobs) untrack(id string) {
	c.mut.Lock()
	defer c.mut.Unlock()
	delete(c.ids, id)
}

func (c *claimedJobs) list() []string {
	c.mut.Lock()
	defer c.mut.Unlock()
	ids := make([]string, 0, len(c.ids))
	for id := range c.ids {
		ids = append(ids, id)
	}
	return ids
}

// retain keeps only the given ids among those that were tracked when list was called, leaving
// any id tracked since then in place.
func (c *claimedJobs) retain(listed []string, running []string) {
	keep := make(map[string]struct{}, len(running))
	for _, id := range running {
		keep[id] = struct{}{}
	}
	c.mut.Lock()
	defer c.mut.Unlock()
	for _, id := range listed {
		if _, ok := keep[id]; !ok {
			delete(c.ids, id)
		}
	}
}

// heartbeat refreshes LastActivityAt of the keyed jobs claimed by this node and stops tracking
// those that are no longer running.
func (srv *JobServer) heartbeat() {
	ids := srv.claimed.list()
	if len(ids) == 0 {
		return
	}

	running, err := srv.Store.Job().RefreshLastActivityAt(ids)
	if err != nil {
		srv.logger.Warn("Failed to refresh activity of running jobs", mlog.Err(err))
		return
	}
	srv.claimed.retain(ids, running)
}

func (srv *JobServer) startHeartbeat() {
	stop := make(chan struct{})
	stopped := make(chan struct{})
	srv.heartbeatStop = stop
	srv.heartbeatStopped = stopped

	go func() {
		defer close(stopped)
		ticker := time.NewTicker(JobHeartbeatInterval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				srv.heartbeat()
			}
		}
	}()
}

func (srv *JobServer) stopHeartbeat() {
	if srv.heartbeatStop == nil {
		return
	}
	close(srv.heartbeatStop)
	<-srv.heartbeatStopped
	srv.heartbeatStop = nil
	srv.heartbeatStopped = nil
}
