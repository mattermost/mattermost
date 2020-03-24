// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	HEALTH_CHECK_INTERVAL            = 30 * time.Second // How often the health check should run
	HEALTH_CHECK_DEACTIVATION_WINDOW = 60 * time.Minute // How long we wait for num fails to incur before deactivating the plugin
	HEALTH_CHECK_PING_FAIL_LIMIT     = 3                // How many times we call RPC ping in a row before it is considered a failure
	HEALTH_CHECK_RESTART_LIMIT       = 3                // How many times we restart a plugin before we deactivate it
)

type PluginHealthCheckStatus struct {
	failTimestamps []time.Time
	Crashed        bool
}

type PluginHealthCheckJob struct {
	cancel              chan struct{}
	cancelled           chan struct{}
	cancelOnce          sync.Once
	env                 *Environment
	healthCheckStatuses sync.Map
}

// Start continuously runs health checks on all active plugins, on a timer.
func (job *PluginHealthCheckJob) Start() {
	mlog.Debug("Plugin health check job starting.")
	defer close(job.cancelled)

	ticker := time.NewTicker(HEALTH_CHECK_INTERVAL)
	defer func() {
		ticker.Stop()
	}()

	for {
		select {
		case <-ticker.C:
			activePlugins := job.env.Active()
			for _, plugin := range activePlugins {
				job.CheckPlugin(plugin.Manifest.Id)
			}
		case <-job.cancel:
			return
		}
	}
}

// CheckPlugin determines the plugin's health status, then handles the error or success case.
func (job *PluginHealthCheckJob) CheckPlugin(id string) {
	statusInterface, ok := job.healthCheckStatuses.Load(id)
	if !ok {
		statusInterface = &PluginHealthCheckStatus{
			failTimestamps: []time.Time{},
		}
	}
	status := statusInterface.(*PluginHealthCheckStatus)
	status.Crashed = false
	job.healthCheckStatuses.Store(id, status)

	job.healthCheckStatuses.Store(id, status)
	err := job.env.performHealthCheck(id)
	if err != nil {
		mlog.Error("Health check failed for plugin", mlog.String("id", id), mlog.Err(err))
		job.handleHealthCheckFail(id, status)
	}
}

func (job *PluginHealthCheckJob) hasPluginCrashed(id string) bool {
	statusInterface, ok := job.healthCheckStatuses.Load(id)
	if !ok {
		return false
	}
	status := statusInterface.(*PluginHealthCheckStatus)
	return status.Crashed
}

// handleHealthCheckFail restarts or deactivates the plugin based on how many times it has failed in a configured amount of time.
func (job *PluginHealthCheckJob) handleHealthCheckFail(id string, status *PluginHealthCheckStatus) {
	// Append current failure before checking for deactivate vs restart action
	status.failTimestamps = append(status.failTimestamps, time.Now())
	status.Crashed = false
	job.healthCheckStatuses.Store(id, status)

	if shouldDeactivatePlugin(status.failTimestamps) {
		status.failTimestamps = []time.Time{}
		status.Crashed = true

		job.healthCheckStatuses.Store(id, status)
		mlog.Debug("Deactivating plugin due to multiple crashes", mlog.String("id", id))
		job.env.Deactivate(id)
		job.env.setPluginState(id, model.PluginStateFailedToStayRunning)
	} else {
		mlog.Debug("Restarting plugin due to failed health check", mlog.String("id", id))
		if err := job.env.RestartPlugin(id); err != nil {
			mlog.Error("Failed to restart plugin", mlog.String("id", id), mlog.Err(err))
		}
	}
}

func newPluginHealthCheckJob(env *Environment) *PluginHealthCheckJob {
	return &PluginHealthCheckJob{
		cancel:    make(chan struct{}),
		cancelled: make(chan struct{}),
		env:       env,
	}
}

func (job *PluginHealthCheckJob) Cancel() {
	job.cancelOnce.Do(func() {
		close(job.cancel)
	})
	<-job.cancelled
}

// shouldDeactivatePlugin determines if a plugin needs to be deactivated after the plugin has failed (HEALTH_CHECK_RESTART_LIMIT) times,
// within the configured time window (HEALTH_CHECK_DEACTIVATION_WINDOW).
func shouldDeactivatePlugin(failedTimestamps []time.Time) bool {
	if len(failedTimestamps) >= HEALTH_CHECK_RESTART_LIMIT {
		index := len(failedTimestamps) - HEALTH_CHECK_RESTART_LIMIT
		t := failedTimestamps[index]
		elapsed := time.Since(t)
		if elapsed <= HEALTH_CHECK_DEACTIVATION_WINDOW {
			return true
		}
	}
	return false
}
