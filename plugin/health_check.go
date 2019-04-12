// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
)

const (
	PLUGIN_HEALTH_CHECK_INTERVAL  = 30 // seconds
	HEALTH_CHECK_PING_FAIL_LIMIT  = 3
	HEALTH_CHECK_RESTART_LIMIT    = 3
	HEALTH_CHECK_DISABLE_DURATION = 60 // minutes
)

type PluginHealthCheckJob struct {
	cancel    chan struct{}
	cancelled chan struct{}
	env       *Environment
}

type PluginHealthStatus struct {
	Crashed        bool
	failTimeStamps []time.Time
	lastError      error
}

// InitPluginHealthCheckJob starts a new job if one is not running and is set to enabled, or kills an existing one if set to disabled.
func (env *Environment) InitPluginHealthCheckJob(enable bool) {
	// Config is set to enable. No job exists, start a new job.
	if enable && env.pluginHealthCheckJob == nil {
		job := newPluginHealthCheckJob(env)
		env.pluginHealthCheckJob = job
		job.Start()
	}

	// Config is set to disable. Job exists, kill existing job.
	if !enable && env.pluginHealthCheckJob != nil {
		env.pluginHealthCheckJob.Cancel()
		env.pluginHealthCheckJob = nil
	}
}

// Start continuously runs health checks on all active plugins, on a timer.
func (job *PluginHealthCheckJob) Start() {
	interval := time.Duration(PLUGIN_HEALTH_CHECK_INTERVAL) * time.Second
	mlog.Debug(fmt.Sprintf("Plugin health check job starting. Sending health check pings every %v minutes.", interval))

	go func() {
		defer close(job.cancelled)

		ticker := time.NewTicker(interval)
		defer func() {
			ticker.Stop()
		}()

		for {
			select {
			case <-ticker.C:
				activePlugins := job.env.Active()
				for _, plugin := range activePlugins {
					job.checkPlugin(plugin.Manifest.Id)
				}
			case <-job.cancel:
				return
			}
		}
	}()
}

// checkPlugin determines the plugin's health status, then handles the error or success case.
func (job *PluginHealthCheckJob) checkPlugin(id string) {
	var ap activePlugin
	if p, ok := job.env.activePlugins.Load(id); ok {
		ap = p.(activePlugin)
	} else {
		return
	}

	if _, ok := job.env.pluginHealthStatuses.Load(id); !ok {
		job.env.pluginHealthStatuses.Store(id, newPluginHealthStatus())
	}

	pluginErr := ap.supervisor.PerformHealthCheck()

	if pluginErr != nil {
		mlog.Debug(fmt.Sprintf("Health check failed for plugin %s, error: %s", id, pluginErr.Error()))
		job.handleHealthCheckFail(id, pluginErr)
	} else {
		job.handleHealthCheckSuccess(id)
	}
}

// handleHealthCheckFail restarts or deactivates the plugin based on how many times it has failed in a configured amount of time.
func (job *PluginHealthCheckJob) handleHealthCheckFail(id string, err error) {
	var health *PluginHealthStatus
	if h, ok := job.env.pluginHealthStatuses.Load(id); ok {
		health = h.(*PluginHealthStatus)
	} else {
		return
	}

	t := time.Now()
	// Append current failure before checking for deactivate vs restart action
	health.failTimeStamps = append(health.failTimeStamps, t)
	health.lastError = err

	if shouldDeactivatePlugin(health) {
		health.failTimeStamps = []time.Time{}
		health.Crashed = true
		mlog.Debug(fmt.Sprintf("Deactivating plugin due to multiple crashes `%s`", id))
		job.env.Deactivate(id)
	} else {
		mlog.Debug(fmt.Sprintf("Restarting plugin due to failed health check `%s`", id))
		job.env.RestartPlugin(id)
	}
}

// handleHealthCheckSuccess marks the plugin as healthy.
func (job *PluginHealthCheckJob) handleHealthCheckSuccess(id string) {
	job.env.UpdatePluginHealthStatus(id, func(health *PluginHealthStatus) {
		health.Crashed = false
	})
}

func newPluginHealthCheckJob(env *Environment) *PluginHealthCheckJob {
	return &PluginHealthCheckJob{
		cancel:    make(chan struct{}),
		cancelled: make(chan struct{}),
		env:       env,
	}
}

func (job *PluginHealthCheckJob) Cancel() {
	close(job.cancel)
	<-job.cancelled
}

func newPluginHealthStatus() *PluginHealthStatus {
	return &PluginHealthStatus{failTimeStamps: []time.Time{}, Crashed: false}
}

// shouldDeactivatePlugin determines if a plugin needs to be deactivated after certain criteria is met.
//
// The criteria is based on if the plugin has consistently failed during the configured number of restarts, within the configured time window.
func shouldDeactivatePlugin(health *PluginHealthStatus) bool {
	if len(health.failTimeStamps) >= HEALTH_CHECK_RESTART_LIMIT {
		index := len(health.failTimeStamps) - HEALTH_CHECK_RESTART_LIMIT
		t := health.failTimeStamps[index]
		now := time.Now()
		elapsed := now.Sub(t).Minutes()
		if elapsed <= HEALTH_CHECK_DISABLE_DURATION {
			return true
		}
	}
	return false
}
