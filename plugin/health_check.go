// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
)

const (
	HEALTH_CHECK_INTERVAL         = 30 // seconds. How often the health check should run
	HEALTH_CHECK_DISABLE_DURATION = 60 // minutes. How long we wait for num fails to incur before disabling the plugin
	HEALTH_CHECK_PING_FAIL_LIMIT  = 3  // How many times we call RPC ping in a row before it is considered a failure
	HEALTH_CHECK_RESTART_LIMIT    = 3  // How many times we restart a plugin before we disable it
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
	interval := time.Duration(HEALTH_CHECK_INTERVAL) * time.Second
	mlog.Debug(fmt.Sprintf("Plugin health check job starting. Sending health check pings every %v seconds.", interval))

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
	p, ok := job.env.activePlugins.Load(id)
	if !ok {
		return
	}
	ap := p.(activePlugin)

	if _, ok := job.env.pluginHealthStatuses.Load(id); !ok {
		job.env.pluginHealthStatuses.Store(id, newPluginHealthStatus())
	}

	sup := ap.supervisor
	if sup == nil {
		return
	}

	pluginErr := sup.PerformHealthCheck()

	if pluginErr != nil {
		mlog.Error(fmt.Sprintf("Health check failed for plugin %s, error: %s", id, pluginErr.Error()))
		job.handleHealthCheckFail(id, pluginErr)
	}
}

// handleHealthCheckFail restarts or deactivates the plugin based on how many times it has failed in a configured amount of time.
func (job *PluginHealthCheckJob) handleHealthCheckFail(id string, err error) {
	health, ok := job.env.pluginHealthStatuses.Load(id)
	if !ok {
		return
	}
	h := health.(*PluginHealthStatus)

	// Append current failure before checking for deactivate vs restart action
	h.failTimeStamps = append(h.failTimeStamps, time.Now())
	h.lastError = err

	if shouldDeactivatePlugin(h) {
		h.failTimeStamps = []time.Time{}
		h.Crashed = true
		mlog.Debug(fmt.Sprintf("Deactivating plugin due to multiple crashes `%s`", id))
		job.env.Deactivate(id)
	} else {
		mlog.Debug(fmt.Sprintf("Restarting plugin due to failed health check `%s`", id))
		if err := job.env.RestartPlugin(id); err != nil {
			mlog.Error(fmt.Sprintf("Failed to restart plugin `%s`: %s", id, err.Error()))
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
	close(job.cancel)
	<-job.cancelled
}

func newPluginHealthStatus() *PluginHealthStatus {
	return &PluginHealthStatus{failTimeStamps: []time.Time{}, Crashed: false}
}

// shouldDeactivatePlugin determines if a plugin needs to be deactivated after certain criteria is met.
//
// The criteria is based on if the plugin has consistently failed during the configured number of restarts, within the configured time window.
func shouldDeactivatePlugin(h *PluginHealthStatus) bool {
	if len(h.failTimeStamps) >= HEALTH_CHECK_RESTART_LIMIT {
		index := len(h.failTimeStamps) - HEALTH_CHECK_RESTART_LIMIT
		t := h.failTimeStamps[index]
		now := time.Now()
		elapsed := now.Sub(t).Minutes()
		if elapsed <= HEALTH_CHECK_DISABLE_DURATION {
			return true
		}
	}
	return false
}
