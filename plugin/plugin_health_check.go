// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
)

const (
	PLUGIN_HEALTH_CHECK_INTERVAL  = 5 // minutes
	HEALTH_CHECK_PING_FAIL_LIMIT  = 3
	HEALTH_CHECK_RESTART_LIMIT    = 3
	HEALTH_CHECK_DISABLE_DURATION = 60 // minutes
	ENABLE_HEALTH_CHECK_JOB       = true
)

func (env *Environment) InitPluginHealthCheckJob() {
	if env.pluginHealthCheckJob != nil {
		env.pluginHealthCheckJob.Cancel()
		env.pluginHealthCheckJob = nil
	}

	if ENABLE_HEALTH_CHECK_JOB {
		job := newPluginHealthCheckJob()
		env.pluginHealthCheckJob = job
		job.runPluginHealthCheckJob(env)
	}
}

type PluginHealthCheckJob struct {
	cancel    chan struct{}
	cancelled chan struct{}
	env       *Environment
}

type pluginHealthStatus struct {
	failTimeStamps []time.Time
	lastError      error
	crashed        bool
}

// runPluginHealthCheckJob checks the health status of all active plugins.
//
// It will either restart or disable a plugin given certain criteria is met.
func (job *PluginHealthCheckJob) runPluginHealthCheckJob(env *Environment) {
	interval := time.Duration(PLUGIN_HEALTH_CHECK_INTERVAL) * time.Minute
	mlog.Debug(fmt.Sprintf("Plugin health check job starting. Sending health check pings every %v minutes.", interval))

	go func() {
		defer close(job.cancelled)

		activePlugins := env.Active()

		for _, plugin := range activePlugins {
			if _, ok := env.pluginHealthStatuses.Load(plugin.Manifest.Id); !ok {
				env.pluginHealthStatuses.Store(plugin.Manifest.Id, newPluginHealth())
			}
		}

		ticker := time.NewTicker(interval)
		defer func() {
			ticker.Stop()
		}()

		for {
			select {
			case <-ticker.C:
				activePlugins := env.Active()
				for _, plugin := range activePlugins {
					id := plugin.Manifest.Id

					var health *pluginHealthStatus
					if existingHealth, ok := env.pluginHealthStatuses.Load(id); ok {
						health = existingHealth.(*pluginHealthStatus)
					} else {
						health = newPluginHealth()
						env.pluginHealthStatuses.Store(id, health)
					}

					var err error
					if err = env.CheckPluginProcess(id); err != nil {
						mlog.Debug(fmt.Sprintf("Error checking plugin process `%s`, error: %s", id, err.Error()))
					} else if err = env.CheckPluginPing(id); err != nil {
						for pingFails := 1; pingFails < HEALTH_CHECK_PING_FAIL_LIMIT; pingFails++ {
							err = env.CheckPluginPing(id)
							if err == nil {
								break
							}
						}
						if err != nil {
							mlog.Debug(fmt.Sprintf("Error pinging plugin `%s`, error: %s", id, err.Error()))
						}
					}

					if err == nil {
						hooks, hooksErr := env.HooksForPlugin(id)
						if hooksErr != nil {
							mlog.Debug(fmt.Sprintf("Error loading hooks for plugin `%s`, error: %s", id, hooksErr.Error()))
						} else if err = hooks.HealthCheck(); err != nil {
							mlog.Debug(fmt.Sprintf("Error retrieved from HealthCheck hook for plugin `%s`, error: %s", id, err.Error()))
						}
					}

					if err != nil {
						mlog.Debug(fmt.Sprintf("Health check failed for plugin %s, error: %s", id, err.Error()))
						t := time.Now()
						health.failTimeStamps = append(health.failTimeStamps, t)
						health.lastError = err

						if shouldDisablePlugin(health) {
							health.failTimeStamps = []time.Time{}
							health.crashed = true
							mlog.Debug(fmt.Sprintf("Deactivating plugin due to multiple crashes `%s`", id))
							env.Deactivate(id)
						} else {
							mlog.Debug(fmt.Sprintf("Restarting plugin due to failed health check `%s`", id))
							env.RestartPlugin(id)
						}
					} else {
						health.crashed = false
					}
				}
			case <-job.cancel:
				return
			}
		}
	}()
}

func newPluginHealthCheckJob() *PluginHealthCheckJob {
	return &PluginHealthCheckJob{
		cancel:    make(chan struct{}),
		cancelled: make(chan struct{}),
	}
}

func (job *PluginHealthCheckJob) Cancel() {
	close(job.cancel)
	<-job.cancelled
}

func newPluginHealth() *pluginHealthStatus {
	return &pluginHealthStatus{failTimeStamps: []time.Time{}, crashed: false}
}

// shouldDisablePlugin determines if a plugin needs to be disabled after certain criteria is met.
//
// The criteria is based on if the plugin has consistently failed during the configured number of restarts, within the configured time window.
func shouldDisablePlugin(health *pluginHealthStatus) bool {
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
