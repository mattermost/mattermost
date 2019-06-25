// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
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

// InitPluginHealthCheckJob starts a new job for checking all active plugins
func (env *Environment) InitPluginHealthCheckJob() {
	job := newPluginHealthCheckJob(env)
	env.pluginHealthCheckJob = job
	job.Start()
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
	p, ok := job.env.registeredPlugins.Load(id)
	if !ok {
		return
	}
	rp := p.(*registeredPlugin)

	sup := rp.supervisor
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
	rp, ok := job.env.registeredPlugins.Load(id)
	if !ok {
		return
	}
	p := rp.(*registeredPlugin)

	// Append current failure before checking for deactivate vs restart action
	p.failTimeStamps = append(p.failTimeStamps, time.Now())
	p.lastError = err

	if shouldDeactivatePlugin(p) {
		p.failTimeStamps = []time.Time{}
		mlog.Debug(fmt.Sprintf("Deactivating plugin due to multiple crashes `%s`", id))
		job.env.Deactivate(id)
		job.env.SetPluginState(id, model.PluginStateFailedToStayRunning)
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

// shouldDeactivatePlugin determines if a plugin needs to be deactivated after certain criteria is met.
//
// The criteria is based on if the plugin has consistently failed during the configured number of restarts, within the configured time window.
func shouldDeactivatePlugin(rp *registeredPlugin) bool {
	if len(rp.failTimeStamps) >= HEALTH_CHECK_RESTART_LIMIT {
		index := len(rp.failTimeStamps) - HEALTH_CHECK_RESTART_LIMIT
		t := rp.failTimeStamps[index]
		now := time.Now()
		elapsed := now.Sub(t).Minutes()
		if elapsed <= HEALTH_CHECK_DISABLE_DURATION {
			return true
		}
	}
	return false
}
