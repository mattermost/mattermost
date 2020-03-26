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
	HEALTH_CHECK_NUM_RESTARTS_LIMIT  = 3                // How many times we restart a plugin before we deactivate it
)

type PluginHealthCheckJob struct {
	cancel            chan struct{}
	cancelled         chan struct{}
	cancelOnce        sync.Once
	env               *Environment
	failureTimestamps sync.Map
}

// Start continuously runs health checks on all active plugins, on a timer.
func (job *PluginHealthCheckJob) Start() {
	mlog.Debug("Plugin health check job starting.")
	defer close(job.cancelled)

	ticker := time.NewTicker(HEALTH_CHECK_INTERVAL)
	defer ticker.Stop()

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
// If the plugin passes the health check, do nothing.
// If the plugin fails the health check, the function either restarts or deactivates the plugin, based on the quantity and frequency of its failures.
func (job *PluginHealthCheckJob) CheckPlugin(id string) {
	err := job.env.performHealthCheck(id)
	if err == nil {
		return
	}

	mlog.Error("Health check failed for plugin", mlog.String("id", id), mlog.Err(err))
	timestamps := job.ensureStoredTimestamps(id)
	timestamps = append(timestamps, time.Now())

	if shouldDeactivatePlugin(timestamps) {
		mlog.Debug("Deactivating plugin due to multiple crashes", mlog.String("id", id))
		job.env.Deactivate(id)

		job.env.setPluginState(id, model.PluginStateFailedToStayRunning)
		job.failureTimestamps.Delete(id)
	} else {
		mlog.Debug("Restarting plugin due to failed health check", mlog.String("id", id))
		if err := job.env.RestartPlugin(id); err != nil {
			mlog.Error("Failed to restart plugin", mlog.String("id", id), mlog.Err(err))
		}

		timestamps = removeStaleTimestamps(timestamps)
		job.failureTimestamps.Store(id, timestamps)
	}
}

// ensureStoredTimestamps returns the stored failure timestamps for a plugin.
func (job *PluginHealthCheckJob) ensureStoredTimestamps(id string) []time.Time {
	statusInterface, _ := job.failureTimestamps.LoadOrStore(id, []time.Time{})
	return statusInterface.([]time.Time)
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

// shouldDeactivatePlugin determines if a plugin needs to be deactivated after the plugin has failed (HEALTH_CHECK_NUM_RESTARTS_LIMIT) times,
// within the configured time window (HEALTH_CHECK_DEACTIVATION_WINDOW).
func shouldDeactivatePlugin(failedTimestamps []time.Time) bool {
	if len(failedTimestamps) < HEALTH_CHECK_NUM_RESTARTS_LIMIT {
		return false
	}

	index := len(failedTimestamps) - HEALTH_CHECK_NUM_RESTARTS_LIMIT
	return time.Since(failedTimestamps[index]) <= HEALTH_CHECK_DEACTIVATION_WINDOW
}

// removeStaleTimestamps filters out failure timestamps that are before the start of the HEALTH_CHECK_DEACTIVATION_WINDOW
func removeStaleTimestamps(timestamps []time.Time) []time.Time {
	result := []time.Time{}
	for _, t := range timestamps {
		if time.Since(t) <= HEALTH_CHECK_DEACTIVATION_WINDOW {
			result = append(result, t)
		}
	}
	return result
}
