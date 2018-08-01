// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"fmt"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

type Schedulers struct {
	stop                 chan bool
	stopped              chan bool
	configChanged        chan *model.Config
	clusterLeaderChanged chan bool
	listenerId           string
	startOnce            sync.Once
	jobs                 *JobServer

	schedulers   []model.Scheduler
	nextRunTimes []*time.Time
}

func (srv *JobServer) InitSchedulers() *Schedulers {
	mlog.Debug("Initialising schedulers.")

	schedulers := &Schedulers{
		stop:                 make(chan bool),
		stopped:              make(chan bool),
		configChanged:        make(chan *model.Config),
		clusterLeaderChanged: make(chan bool),
		jobs:                 srv,
	}

	if srv.DataRetentionJob != nil {
		schedulers.schedulers = append(schedulers.schedulers, srv.DataRetentionJob.MakeScheduler())
	}

	if srv.MessageExportJob != nil {
		schedulers.schedulers = append(schedulers.schedulers, srv.MessageExportJob.MakeScheduler())
	}

	if elasticsearchAggregatorInterface := srv.ElasticsearchAggregator; elasticsearchAggregatorInterface != nil {
		schedulers.schedulers = append(schedulers.schedulers, elasticsearchAggregatorInterface.MakeScheduler())
	}

	if ldapSyncInterface := srv.LdapSync; ldapSyncInterface != nil {
		schedulers.schedulers = append(schedulers.schedulers, ldapSyncInterface.MakeScheduler())
	}

	if migrationsInterface := srv.Migrations; migrationsInterface != nil {
		schedulers.schedulers = append(schedulers.schedulers, migrationsInterface.MakeScheduler())
	}

	schedulers.nextRunTimes = make([]*time.Time, len(schedulers.schedulers))
	return schedulers
}

func (schedulers *Schedulers) Start() *Schedulers {
	schedulers.listenerId = schedulers.jobs.ConfigService.AddConfigListener(schedulers.handleConfigChange)

	go func() {
		schedulers.startOnce.Do(func() {
			mlog.Info("Starting schedulers.")

			defer func() {
				mlog.Info("Schedulers stopped.")
				close(schedulers.stopped)
			}()

			now := time.Now()
			for idx, scheduler := range schedulers.schedulers {
				if !scheduler.Enabled(schedulers.jobs.Config()) {
					schedulers.nextRunTimes[idx] = nil
				} else {
					schedulers.setNextRunTime(schedulers.jobs.Config(), idx, now, false)
				}
			}

			for {
				select {
				case <-schedulers.stop:
					mlog.Debug("Schedulers received stop signal.")
					return
				case now = <-time.After(1 * time.Minute):
					cfg := schedulers.jobs.Config()

					for idx, nextTime := range schedulers.nextRunTimes {
						if nextTime == nil {
							continue
						}

						if time.Now().After(*nextTime) {
							scheduler := schedulers.schedulers[idx]
							if scheduler != nil {
								if scheduler.Enabled(cfg) {
									if _, err := schedulers.scheduleJob(cfg, scheduler); err != nil {
										mlog.Warn(fmt.Sprintf("Failed to schedule job with scheduler: %v", scheduler.Name()))
										mlog.Error(fmt.Sprint(err))
									} else {
										schedulers.setNextRunTime(cfg, idx, now, true)
									}
								}
							}
						}
					}
				case newCfg := <-schedulers.configChanged:
					for idx, scheduler := range schedulers.schedulers {
						if !scheduler.Enabled(newCfg) {
							schedulers.nextRunTimes[idx] = nil
						} else {
							schedulers.setNextRunTime(newCfg, idx, now, false)
						}
					}
				case isLeader := <-schedulers.clusterLeaderChanged:
					for idx := range schedulers.schedulers {
						if !isLeader {
							schedulers.nextRunTimes[idx] = nil
						} else {
							schedulers.setNextRunTime(schedulers.jobs.Config(), idx, now, false)
						}
					}
				}
			}
		})
	}()

	return schedulers
}

func (schedulers *Schedulers) Stop() *Schedulers {
	mlog.Info("Stopping schedulers.")
	close(schedulers.stop)
	<-schedulers.stopped
	return schedulers
}

func (schedulers *Schedulers) setNextRunTime(cfg *model.Config, idx int, now time.Time, pendingJobs bool) {
	scheduler := schedulers.schedulers[idx]

	if !pendingJobs {
		if pj, err := schedulers.jobs.CheckForPendingJobsByType(scheduler.JobType()); err != nil {
			mlog.Error("Failed to set next job run time: " + err.Error())
			schedulers.nextRunTimes[idx] = nil
			return
		} else {
			pendingJobs = pj
		}
	}

	lastSuccessfulJob, err := schedulers.jobs.GetLastSuccessfulJobByType(scheduler.JobType())
	if err != nil {
		mlog.Error("Failed to set next job run time: " + err.Error())
		schedulers.nextRunTimes[idx] = nil
		return
	}

	schedulers.nextRunTimes[idx] = scheduler.NextScheduleTime(cfg, now, pendingJobs, lastSuccessfulJob)
	mlog.Debug(fmt.Sprintf("Next run time for scheduler %v: %v", scheduler.Name(), schedulers.nextRunTimes[idx]))
}

func (schedulers *Schedulers) scheduleJob(cfg *model.Config, scheduler model.Scheduler) (*model.Job, *model.AppError) {
	pendingJobs, err := schedulers.jobs.CheckForPendingJobsByType(scheduler.JobType())
	if err != nil {
		return nil, err
	}

	lastSuccessfulJob, err2 := schedulers.jobs.GetLastSuccessfulJobByType(scheduler.JobType())
	if err2 != nil {
		return nil, err
	}

	return scheduler.ScheduleJob(cfg, pendingJobs, lastSuccessfulJob)
}

func (schedulers *Schedulers) handleConfigChange(oldConfig *model.Config, newConfig *model.Config) {
	mlog.Debug("Schedulers received config change.")
	schedulers.configChanged <- newConfig
}

func (schedulers *Schedulers) HandleClusterLeaderChange(isLeader bool) {
	select {
	case schedulers.clusterLeaderChanged <- isLeader:
	default:
		mlog.Debug("Did not send cluster leader change message to schedulers as no schedulers listening to notification channel.")
	}
}
