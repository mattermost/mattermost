// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

type PluginHealthCheckJob struct {
	server    *Server
	task      *model.ScheduledTask
	taskMutex sync.Mutex
}

const (
	PLUGIN_HEALTH_CHECK_TASK_NAME = "Plugin Health Check"
	PLUGIN_HEALTH_CHECK_INTERVAL  = 5 // seconds
	HEALTH_CHECK_FAIL_LIMIT       = 3
	ENABLE_HEALTH_CHECK_JOB       = false
)

func (s *Server) InitPluginHealthCheckJob() {
	if ENABLE_HEALTH_CHECK_JOB {
		s.PluginsLock.RLock()
		pluginsEnvironment := s.PluginsEnvironment
		s.PluginsLock.RUnlock()

		if pluginsEnvironment == nil {
			return
		}

		if s.PluginHealthCheck == nil {
			s.PluginHealthCheck = NewPluginHealthCheckJob(s)
		}

		s.PluginHealthCheck.Start()
	}
}

func (job *PluginHealthCheckJob) Start() {
	mlog.Debug(fmt.Sprintf("Plugin health check job starting. Sending health check pings every %v seconds.", PLUGIN_HEALTH_CHECK_INTERVAL))
	newTask := model.CreateRecurringTask(PLUGIN_HEALTH_CHECK_TASK_NAME, job.RunPluginHealthChecks, time.Duration(PLUGIN_HEALTH_CHECK_INTERVAL)*time.Second)
	job.taskMutex.Lock()
	oldTask := job.task
	job.task = newTask
	job.taskMutex.Unlock()

	if oldTask != nil {
		oldTask.Cancel()
	}
}

func (job *PluginHealthCheckJob) RunPluginHealthChecks() {
	if pluginsEnvironment := job.server.PluginsEnvironment; pluginsEnvironment != nil {
		for _, ap := range pluginsEnvironment.Active() {
			job.RunPluginHealthCheck(ap)
		}
	}
}

func (job *PluginHealthCheckJob) RunPluginHealthCheck(plugin *model.BundleInfo) {
	if pluginsEnvironment := job.server.PluginsEnvironment; pluginsEnvironment != nil {
		id := plugin.Manifest.Id

		if plugin.HealthCheckFails == HEALTH_CHECK_FAIL_LIMIT {
			mlog.Debug(fmt.Sprintf("Plugin `%v` exceeded health check failure threshold. Restarting Plugin.", id))
			pluginsEnvironment.RestartPlugin(id)
			plugin.HealthCheckFails++
			return
		}

		err := pluginsEnvironment.GetPluginErrorStatus(id)

		if err != nil {
			plugin.HealthCheckFails++
		} else {
			plugin.HealthCheckFails = 0
		}
	}
}

func NewPluginHealthCheckJob(s *Server) *PluginHealthCheckJob {
	return &PluginHealthCheckJob{
		server: s,
	}
}
