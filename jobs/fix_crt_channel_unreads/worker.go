// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package fix_crt_channel_unreads

import (
	"strconv"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/jobs"
	tjobs "github.com/mattermost/mattermost-server/v6/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type FixCRTChannelUnreadsWorker struct {
	name        string
	stopChan    chan struct{}
	stoppedChan chan struct{}
	jobsChan    chan model.Job
	jobServer   *jobs.JobServer
	app         *app.App
}

type FixCRTChannelUnreadsJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterFixCRTChannelUnreadsJobInterface(func(s *app.Server) tjobs.FixCRTChannelUnreadsJobInterface {
		a := app.New(app.ServerConnector(s))
		return &FixCRTChannelUnreadsJobInterfaceImpl{a}
	})
}

func (i *FixCRTChannelUnreadsJobInterfaceImpl) MakeWorker() model.Worker {

	return &FixCRTChannelUnreadsWorker{
		name:        "FixCRTChannelUnreads",
		stopChan:    make(chan struct{}),
		stoppedChan: make(chan struct{}),
		jobsChan:    make(chan model.Job),
		jobServer:   i.App.Srv().Jobs,
		app:         i.App,
	}
}

func (w *FixCRTChannelUnreadsWorker) JobChannel() chan<- model.Job {
	return w.jobsChan
}

func (w *FixCRTChannelUnreadsWorker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", w.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", w.name))
		close(w.stoppedChan)
	}()

	for {
		select {
		case <-w.stopChan:
			mlog.Debug("Worker received stop signal", mlog.String("worker", w.name))
			return
		case job := <-w.jobsChan:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", w.name))
			w.doJob(&job)
		}
	}
}

func (w *FixCRTChannelUnreadsWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", w.name))
	close(w.stopChan)
	<-w.stoppedChan
}

func (w *FixCRTChannelUnreadsWorker) doJob(job *model.Job) {
	if claimed, err := w.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("Worker experienced an error while trying to claim job",
			mlog.String("worker", w.name),
			mlog.String("job_id", job.Id),
			mlog.String("error", err.Error()))
		return
	} else if !claimed {
		return
	}

	userID := ""
	channelID := ""
	fixedInThisRun := 0
	fixedBadCM := 0
	for {
		cms, err := w.app.Srv().Store.Channel().GetCRTUnfixedChannelMembershipsAfter(userID, channelID, 100)
		if err != nil {
			mlog.Warn("Failed to get bad channel memberships",
				mlog.String("worker", w.name),
				mlog.String("job_id", job.Id),
				mlog.String("error", err.Error()))
			continue
		}

		for _, cm := range cms {
			isUnread, err := w.app.Srv().Store.Channel().IsChannelMemberUnread(cm, true)
			if err != nil {
				mlog.Warn("Worker experienced an error while trying to get channel unread",
					mlog.String("worker", w.name),
					mlog.String("job_id", job.Id),
					mlog.String("error", err.Error()))
				continue
			}
			if !isUnread {
				fixedInThisRun++
				err = w.app.Srv().Store.Channel().MarkChannelMemberAsCRTFixed(cm)
				if err != nil {
					mlog.Warn("Worker experienced an error while trying to mark channel membership as fixed",
						mlog.String("worker", w.name),
						mlog.String("job_id", job.Id),
						mlog.String("error", err.Error()))
				}
				continue
			}

			postTypes, err := store.postTypesSinceUnread(cm)
			if err != nil {
				continue
			}
			if !postTypes.ContainsNormalPost {
				// store.MarkCMAsRead(cm)
				_, err := w.app.Srv().Store.Channel().UpdateLastViewedAt([]string{cm.ChannelId}, cm.UserId, false)
				fixedBadCM++
			}
			store.MarkAsFixed(cm)
			fixedInThisRun++
		}
		prevErr = false
	}

	job.Data["FixedChannelMemberships"] = strconv.Itoa(fixedInThisRun)
	job.Data["BadChannelMemberships"] = strconv.Itoa(fixedBadCM)
	w.updateData(job)

	mlog.Info("Worker: Job is complete", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
	w.setJobSuccess(job)
}

func (w *FixCRTChannelUnreadsWorker) setJobSuccess(job *model.Job) {
	// TODO confirm migration is done
	// Mark migration as done
	if err := w.app.Srv().Jobs.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		w.setJobError(job, err)
	}
}

func (w *FixCRTChannelUnreadsWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := w.app.Srv().Jobs.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}

func (w *FixCRTChannelUnreadsWorker) updateData(job *model.Job) {
	if err := w.app.Srv().Jobs.UpdateInProgressJobData(job); err != nil {
		mlog.Error("Worker: Failed to update job data", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}
