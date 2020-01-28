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
	HEALTH_CHECK_INTERVAL         = 30 * time.Second // How often the health check should run
	HEALTH_CHECK_DISABLE_DURATION = 60 * time.Minute // How long we wait for num fails to incur before disabling the plugin
	HEALTH_CHECK_PING_FAIL_LIMIT  = 3                // How many times we call RPC ping in a row before it is considered a failure
	HEALTH_CHECK_RESTART_LIMIT    = 3                // How many times we restart a plugin before we disable it
)

type PluginHealthCheckJob struct {
	cancel     chan struct{}
	cancelled  chan struct{}
	cancelOnce sync.Once
	env        *Environment
}

// InitPluginHealthCheckJob starts a new job if one is not running and is set to enabled, or kills an existing one if set to disabled.
func (env *Environment) InitPluginHealthCheckJob(enable bool) {
	// Config is set to enable. No job exists, start a new job.
	if enable && env.pluginHealthCheckJob == nil {
		mlog.Debug("Enabling plugin health check job", mlog.Duration("interval_s", HEALTH_CHECK_INTERVAL))

		job := newPluginHealthCheckJob(env)
		env.pluginHealthCheckJob = job
		job.Start()
	}

	// Config is set to disable. Job exists, kill existing job.
	if !enable && env.pluginHealthCheckJob != nil {
		mlog.Debug("Disabling plugin health check job")

		env.pluginHealthCheckJob.Cancel()
		env.pluginHealthCheckJob = nil
	}
}

// Start continuously runs health checks on all active plugins, on a timer.
func (job *PluginHealthCheckJob) Start() {
	mlog.Debug("Plugin health check job starting.")

	go func() {
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
	rp := p.(registeredPlugin)

	sup := rp.supervisor
	if sup == nil {
		return
	}

	pluginErr := sup.PerformHealthCheck()

	if pluginErr != nil {
		mlog.Error("Health check failed for plugin", mlog.String("id", id), mlog.Err(pluginErr))
		job.handleHealthCheckFail(id, pluginErr)
	}
}

// handleHealthCheckFail restarts or deactivates the plugin based on how many times it has failed in a configured amount of time.
func (job *PluginHealthCheckJob) handleHealthCheckFail(id string, err error) {
	rp, ok := job.env.registeredPlugins.Load(id)
	if !ok {
		return
	}
	p := rp.(registeredPlugin)

	// Append current failure before checking for deactivate vs restart action
	p.failTimeStamps = append(p.failTimeStamps, time.Now())
	p.lastError = err
	job.env.registeredPlugins.Store(id, p)

	if shouldDeactivatePlugin(p) {
		p.failTimeStamps = []time.Time{}
		job.env.registeredPlugins.Store(id, p)
		mlog.Debug("Deactivating plugin due to multiple crashes", mlog.String("id", id))
		job.env.Deactivate(id)
		job.env.SetPluginState(id, model.PluginStateFailedToStayRunning)
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

// shouldDeactivatePlugin determines if a plugin needs to be deactivated after certain criteria is met.
//
// The criteria is based on if the plugin has consistently failed during the configured number of restarts, within the configured time window.
func shouldDeactivatePlugin(rp registeredPlugin) bool {
	if len(rp.failTimeStamps) >= HEALTH_CHECK_RESTART_LIMIT {
		index := len(rp.failTimeStamps) - HEALTH_CHECK_RESTART_LIMIT
		t := rp.failTimeStamps[index]
		now := time.Now()
		elapsed := now.Sub(t)
		if elapsed <= HEALTH_CHECK_DISABLE_DURATION {
			return true
		}
	}
	return false
}
