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
)

var timesFailed = 0

func (s *Server) InitPluginHealthCheckJob() {
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
		id := "com.mattermost.health-check-test-plugin"

		if timesFailed == HEALTH_CHECK_FAIL_LIMIT {
			fmt.Println("Restarting Plugin")
			pluginsEnvironment.RestartPlugin(id)
			timesFailed++
			return
		}

		defer func() {
			if r := recover(); r != nil {
				fmt.Println("Recovered in RunPluginHealthChecks", r)
			}
		}()

		h, err := pluginsEnvironment.HooksForPlugin(id)
		if err != nil {
			fmt.Printf("Error loading hooks for plugin: %v\n", err)
			return
		}

		err = h.HealthCheck()

		if err != nil {
			timesFailed++
			fmt.Printf("Error with health check: %v\n", err)
		} else {
			timesFailed = 0
		}
	}
	fmt.Printf("Num health check fails %v\n", timesFailed)
}

func NewPluginHealthCheckJob(s *Server) *PluginHealthCheckJob {
	return &PluginHealthCheckJob{
		server: s,
	}
}
