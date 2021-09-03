// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package fix_crt_channel_unreads

import (
	"database/sql"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/jobs"
	tjobs "github.com/mattermost/mattermost-server/v6/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	JobName = "FixCRTChannelUnreads"
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
		name:        JobName,
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
	if _, err := w.app.Srv().Store.System().GetByName(model.MigrationKeyFixCRTChannelUnreads); err == nil {
		mlog.Info("Worker: migration already done", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
		w.setJobSuccess(job)
		return
	}

	userID := ""
	channelID := ""
	updatedInThisRun := 0
	fixedBadCM := 0
	migrationDone := false
	for {
		cms, sErr := w.app.Srv().Store.Channel().GetCRTUnfixedChannelMembershipsAfter(userID, channelID, 100)
		if sErr != nil {
			if sErr == sql.ErrNoRows {
				migrationDone = true
				break
			}
			mlog.Warn("Failed to get bad channel memberships",
				mlog.String("worker", w.name),
				mlog.String("job_id", job.Id),
				mlog.String("error", sErr.Error()))
			continue
		}
		lastCM := cms[len(cms)-1]
		userID = lastCM.UserId
		channelID = lastCM.ChannelId

		markAsFixed := make([]model.ChannelMember, 0, len(cms))

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
				updatedInThisRun++
				markAsFixed = append(markAsFixed, cm)
				continue
			}

			postTypes, err := w.app.Srv().Store.Post().GetUniquePostTypesSince(cm.ChannelId, cm.LastViewedAt)
			if err != nil {
				continue
			}
			if !containsNormalPost(postTypes) {
				_, err := w.app.Srv().Store.Channel().UpdateLastViewedAt([]string{cm.ChannelId}, cm.UserId, false)
				if err != nil {
					mlog.Warn("Worker experienced an error while trying to mark channel as read",
						mlog.String("worker", w.name),
						mlog.String("job_id", job.Id),
						mlog.String("error", err.Error()))
					continue
				}
				fixedBadCM++
			}
			markAsFixed = append(markAsFixed, cm)
			updatedInThisRun++
		}
		err := w.app.Srv().Store.Channel().MarkChannelMembersAsCRTFixed(markAsFixed)
		if err != nil {
			mlog.Warn("Worker experienced an error while trying to mark channel memberships as fixed",
				mlog.String("worker", w.name),
				mlog.String("job_id", job.Id),
				mlog.String("error", err.Error()))
		}
	}

	if migrationDone {
		system := model.System{
			Name:  model.MigrationKeyFixCRTChannelUnreads,
			Value: "true",
		}

		if err := w.app.Srv().Store.System().Save(&system); err != nil {
			mlog.Critical("Failed to mark crt channel unreads migration job as completed.", mlog.Err(err))
		}
	}

	job.Data["UpdatedChannelMemberships"] = strconv.Itoa(updatedInThisRun)
	job.Data["BadChannelMemberships"] = strconv.Itoa(fixedBadCM)
	w.updateData(job)

	mlog.Info("Worker: Job is complete", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
	w.setJobSuccess(job)
}

func (w *FixCRTChannelUnreadsWorker) setJobSuccess(job *model.Job) {
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

func containsNormalPost(postTypes []string) bool {
	for _, pt := range postTypes {
		if pt == model.PostTypeDefault {
			return true
		}
	}
	return false
}
