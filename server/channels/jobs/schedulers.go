// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type Scheduler interface {
	Enabled(cfg *model.Config) bool
	NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time
	ScheduleJob(c *request.Context, cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError)
}

type Schedulers struct {
	stop                 chan bool
	stopped              chan bool
	configChanged        chan *model.Config
	clusterLeaderChanged chan bool
	listenerId           string
	jobs                 *JobServer
	isLeader             bool
	running              bool

	schedulers   map[string]Scheduler
	nextRunTimes map[string]*time.Time
}

var (
	ErrSchedulersNotRunning    = errors.New("job schedulers are not running")
	ErrSchedulersRunning       = errors.New("job schedulers are running")
	ErrSchedulersUninitialized = errors.New("job schedulers are not initialized")
)

func (schedulers *Schedulers) AddScheduler(name string, scheduler Scheduler) {
	schedulers.schedulers[name] = scheduler
}

// Start starts the schedulers. This call is not safe for concurrent use.
// Synchronization should be implemented by the caller.
func (schedulers *Schedulers) Start() {
	schedulers.stop = make(chan bool)
	schedulers.stopped = make(chan bool)
	schedulers.listenerId = schedulers.jobs.ConfigService.AddConfigListener(schedulers.handleConfigChange)

	go func() {
		mlog.Info("Starting schedulers.")

		defer func() {
			mlog.Info("Schedulers stopped.")
			close(schedulers.stopped)
		}()

		now := time.Now()
		for name, scheduler := range schedulers.schedulers {
			if !scheduler.Enabled(schedulers.jobs.Config()) {
				schedulers.nextRunTimes[name] = nil
			} else {
				schedulers.setNextRunTime(schedulers.jobs.Config(), name, now, false)
			}
		}

		for {
			timer := time.NewTimer(1 * time.Minute)
			select {
			case <-schedulers.stop:
				mlog.Debug("Schedulers received stop signal.")
				timer.Stop()
				return
			case now = <-timer.C:
				cfg := schedulers.jobs.Config()

				for name, nextTime := range schedulers.nextRunTimes {
					if nextTime == nil {
						continue
					}

					if time.Now().After(*nextTime) {
						scheduler := schedulers.schedulers[name]
						if scheduler == nil || !schedulers.isLeader || !scheduler.Enabled(cfg) {
							continue
						}
						c := request.EmptyContext(schedulers.jobs.Logger())
						if _, err := schedulers.scheduleJob(c, cfg, name, scheduler); err != nil {
							mlog.Error("Failed to schedule job", mlog.String("scheduler", name), mlog.Err(err))
							continue
						}
						schedulers.setNextRunTime(cfg, name, now, true)
					}
				}
			case newCfg := <-schedulers.configChanged:
				for name, scheduler := range schedulers.schedulers {
					if !schedulers.isLeader || !scheduler.Enabled(newCfg) {
						schedulers.nextRunTimes[name] = nil
					} else {
						schedulers.setNextRunTime(newCfg, name, now, false)
					}
				}
			case isLeader := <-schedulers.clusterLeaderChanged:
				for name := range schedulers.schedulers {
					schedulers.isLeader = isLeader
					if !isLeader {
						schedulers.nextRunTimes[name] = nil
					} else {
						schedulers.setNextRunTime(schedulers.jobs.Config(), name, now, false)
					}
				}
			}
			timer.Stop()
		}
	}()

	schedulers.running = true
}

// Stop stops the schedulers. This call is not safe for concurrent use.
// Synchronization should be implemented by the caller.
func (schedulers *Schedulers) Stop() {
	mlog.Info("Stopping schedulers.")
	close(schedulers.stop)
	<-schedulers.stopped
	schedulers.jobs.ConfigService.RemoveConfigListener(schedulers.listenerId)
	schedulers.listenerId = ""
	schedulers.running = false
}

func (schedulers *Schedulers) setNextRunTime(cfg *model.Config, name string, now time.Time, pendingJobs bool) {
	scheduler := schedulers.schedulers[name]

	if !pendingJobs {
		pj, err := schedulers.jobs.CheckForPendingJobsByType(name)
		if err != nil {
			mlog.Error("Failed to set next job run time", mlog.Err(err))
			schedulers.nextRunTimes[name] = nil
			return
		}
		pendingJobs = pj
	}

	lastSuccessfulJob, err := schedulers.jobs.GetLastSuccessfulJobByType(name)
	if err != nil {
		mlog.Error("Failed to set next job run time", mlog.Err(err))
		schedulers.nextRunTimes[name] = nil
		return
	}

	schedulers.nextRunTimes[name] = scheduler.NextScheduleTime(cfg, now, pendingJobs, lastSuccessfulJob)
	mlog.Debug("Next run time for scheduler", mlog.String("scheduler_name", name), mlog.String("next_runtime", fmt.Sprintf("%v", schedulers.nextRunTimes[name])))
}

func (schedulers *Schedulers) scheduleJob(c *request.Context, cfg *model.Config, name string, scheduler Scheduler) (*model.Job, *model.AppError) {
	pendingJobs, err := schedulers.jobs.CheckForPendingJobsByType(name)
	if err != nil {
		return nil, err
	}

	lastSuccessfulJob, err2 := schedulers.jobs.GetLastSuccessfulJobByType(name)
	if err2 != nil {
		return nil, err
	}

	return scheduler.ScheduleJob(c, cfg, pendingJobs, lastSuccessfulJob)
}

func (schedulers *Schedulers) handleConfigChange(_, newConfig *model.Config) {
	mlog.Debug("Schedulers received config change.")
	select {
	case schedulers.configChanged <- newConfig:
	case <-schedulers.stop:
	}
}

func (schedulers *Schedulers) handleClusterLeaderChange(isLeader bool) {
	select {
	case schedulers.clusterLeaderChanged <- isLeader:
	default:
		mlog.Debug("Sending cluster leader change message to schedulers failed.")

		// Drain the buffered channel to make room for the latest change.
		select {
		case <-schedulers.clusterLeaderChanged:
		default:
		}

		// Enqueue the latest change. This operation is safe due to this method
		// being called under lock.
		schedulers.clusterLeaderChanged <- isLeader
	}
}
