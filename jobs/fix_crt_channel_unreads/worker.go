// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package fix_crt_channel_unreads

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
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
	store       store.Store
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store) model.Worker {
	return &FixCRTChannelUnreadsWorker{
		name:        JobName,
		stopChan:    make(chan struct{}),
		stoppedChan: make(chan struct{}),
		jobsChan:    make(chan model.Job),
		jobServer:   jobServer,
		store:       store,
	}
}

func (w *FixCRTChannelUnreadsWorker) JobChannel() chan<- model.Job {
	return w.jobsChan
}

func (w *FixCRTChannelUnreadsWorker) IsEnabled(cfg *model.Config) bool {
	if _, err := w.store.System().GetByName(model.MigrationKeyFixCRTChannelUnreads); err == nil {
		return false
	}
	return true
}

func (w *FixCRTChannelUnreadsWorker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", w.name))

	// kill all in-progress jobs in DB. This can happen if server
	// was shut down incorrectly
	olderJobs, err := w.store.Job().GetAllByStatus(model.JobStatusInProgress)
	if err == nil {
		for _, j := range olderJobs {
			if j.Type == model.JobTypeFixChannelUnreadsForCRT {
				w.setJobError(
					j,
					model.NewAppError(w.name, "fix_crt_channel_unreads.worker.do_job.kill_orphan_jobs",
						nil,
						"killing orphan jobs",
						http.StatusInternalServerError),
				)
			}
		}
	}

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
	if _, err := w.store.System().GetByName(model.MigrationKeyFixCRTChannelUnreads); err == nil {
		mlog.Info("Worker: migration already done", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
		w.setJobSuccess(job)
		return
	}

	fixedBadCM := 0
	checkedCM := 0
	migrationDone := false
	prevErr := false
	channelID, userID := w.getProgressFromPreviousJobs(job)
	if userID != "" && channelID != "" {
		mlog.Info("Restarting from previous job run", mlog.String("ChannelID", channelID), mlog.String("UserID", userID))
	}
	shouldStop := false
	for {
		select {
		case <-w.stopChan:
			shouldStop = true
		default:
			shouldStop = false
		}
		if shouldStop {
			break
		}
		cms, sErr := w.store.Channel().GetCRTUnfixedChannelMembershipsAfter(channelID, userID, 100)
		if sErr != nil {
			if sErr == sql.ErrNoRows {
				migrationDone = true
				break
			}
			mlog.Warn("Failed to get bad channel memberships",
				mlog.String("worker", w.name),
				mlog.String("job_id", job.Id),
				mlog.String("error", sErr.Error()))
			if prevErr {
				w.updateProgress(job, channelID, userID)
				w.setJobError(job, model.NewAppError(w.name, "fix_crt_channel_unreads.worker.do_job.get_bad_channel_memberships", nil, sErr.Error(), http.StatusInternalServerError))
				return
			}
			prevErr = true
			continue
		}
		if len(cms) == 0 {
			migrationDone = true
			break
		}
		lastCM := cms[len(cms)-1]
		channelID = lastCM.ChannelId
		userID = lastCM.UserId

		prevErr = false
		cmToFix := make(map[string][]string)
		for _, cm := range cms {
			postTypes, err := w.store.Post().GetUniquePostTypesSince(cm.ChannelId, cm.LastViewedAt)
			if err != nil {
				mlog.Warn("Failed to get unique unread posts",
					mlog.String("worker", w.name),
					mlog.String("job_id", job.Id),
					mlog.String("error", err.Error()))
				if prevErr {
					w.updateProgress(job, cm.ChannelId, cm.UserId)
					w.setJobError(job, model.NewAppError(w.name, "fix_crt_channel_unreads.worker.do_job.get_post_types", nil, err.Error(), http.StatusInternalServerError))
					return
				}
				prevErr = true
				continue
			}
			if containsOnlyJoinLeaveMessages(postTypes) {
				cmToFix[cm.UserId] = append(cmToFix[cm.UserId], cm.ChannelId)
			}
		}
		checkedCM += len(cms)
		for uID, cIDs := range cmToFix {
			_, err := w.store.Channel().UpdateLastViewedAt(cIDs, uID, false)
			if err != nil {
				mlog.Warn("Worker experienced an error while trying to mark channel as read",
					mlog.String("worker", w.name),
					mlog.String("job_id", job.Id),
					mlog.String("error", err.Error()))
				if prevErr {
					w.updateProgress(job, channelID, userID)
					w.setJobError(job, model.NewAppError(w.name, "fix_crt_channel_unreads.worker.do_job.mark_channel_as_read", nil, err.Error(), http.StatusInternalServerError))
					return
				}
				prevErr = true
				continue
			}
			fixedBadCM += len(cIDs)
		}
		w.updateProgress(job, channelID, userID)
		prevErr = false
	}

	if migrationDone {
		system := model.System{
			Name:  model.MigrationKeyFixCRTChannelUnreads,
			Value: "true",
		}

		if err := w.store.System().Save(&system); err != nil {
			mlog.Critical("Failed to mark crt channel unreads migration job as completed.", mlog.Err(err))
		}
	}

	job.Data["BadChannelMembershipsFixed"] = strconv.Itoa(fixedBadCM)
	job.Data["TotalChannelMembershipsChecked"] = strconv.Itoa(checkedCM)
	w.updateData(job)

	mlog.Info("Worker: Job is complete", mlog.String("worker", w.name), mlog.String("job_id", job.Id))
	w.setJobSuccess(job)
}

func (w *FixCRTChannelUnreadsWorker) setJobSuccess(job *model.Job) {
	if err := w.jobServer.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		w.setJobError(job, err)
	}
}

func (w *FixCRTChannelUnreadsWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := w.jobServer.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}

func (w *FixCRTChannelUnreadsWorker) updateData(job *model.Job) {
	if err := w.jobServer.UpdateInProgressJobData(job); err != nil {
		mlog.Error("Worker: Failed to update job data", mlog.String("worker", w.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}

func (w *FixCRTChannelUnreadsWorker) updateProgress(job *model.Job, channelID, userID string) {
	job.Data["ChannelID"] = channelID
	job.Data["UserID"] = userID
	w.updateData(job)
}

func (w *FixCRTChannelUnreadsWorker) getProgressFromPreviousJobs(job *model.Job) (string, string) {
	olderJob, err := w.store.Job().GetNewestJobByStatusesAndType(
		[]string{model.JobStatusCanceled, model.JobStatusCancelRequested, model.JobStatusSuccess, model.JobStatusError},
		job.Type,
	)
	if err != nil {
		return "", ""
	}
	return olderJob.Data["ChannelID"], olderJob.Data["UserID"]
}

func containsOnlyJoinLeaveMessages(postTypes []string) bool {
	for _, pt := range postTypes {
		switch pt {
		case model.PostTypeJoinLeave, model.PostTypeAddRemove,
			model.PostTypeJoinChannel, model.PostTypeLeaveChannel,
			model.PostTypeJoinTeam, model.PostTypeLeaveTeam,
			model.PostTypeAddToChannel, model.PostTypeRemoveFromChannel,
			model.PostTypeAddToTeam, model.PostTypeRemoveFromTeam:
		default:
			return false
		}
	}
	return true
}
