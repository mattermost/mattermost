// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package resend_invitation_email

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/telemetry"
)

const FourtyEightHoursInMillis int64 = 172800000

type AppIface interface {
	configservice.ConfigService
	GetUserByEmail(email string) (*model.User, *model.AppError)
	GetTeamMembersByIds(teamID string, userIDs []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError)
	InviteNewUsersToTeamGracefully(rctx request.CTX, memberInvite *model.MemberInvite, teamID, senderId string, reminderInterval string) ([]*model.EmailInviteWithError, *model.AppError)
}

type ResendInvitationEmailWorker struct {
	name             string
	stop             chan bool
	stopped          chan bool
	jobs             chan model.Job
	jobServer        *jobs.JobServer
	logger           mlog.LoggerIFace
	app              AppIface
	store            store.Store
	telemetryService *telemetry.TelemetryService
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface, store store.Store, telemetryService *telemetry.TelemetryService) *ResendInvitationEmailWorker {
	const workerName = "ResendInvitationEmail"
	worker := ResendInvitationEmailWorker{
		name:             workerName,
		stop:             make(chan bool, 1),
		stopped:          make(chan bool, 1),
		jobs:             make(chan model.Job),
		jobServer:        jobServer,
		logger:           jobServer.Logger().With(mlog.String("worker_name", workerName)),
		app:              app,
		store:            store,
		telemetryService: telemetryService,
	}
	return &worker
}

func (rseworker *ResendInvitationEmailWorker) Run() {
	rseworker.logger.Debug("Worker started")

	defer func() {
		rseworker.logger.Debug("Worker finished")
		rseworker.stopped <- true
	}()

	for {
		select {
		case <-rseworker.stop:
			rseworker.logger.Debug("Worker received stop signal")
			return
		case job := <-rseworker.jobs:
			rseworker.DoJob(&job)
		}
	}
}

func (rseworker *ResendInvitationEmailWorker) IsEnabled(cfg *model.Config) bool {
	return *cfg.ServiceSettings.EnableEmailInvitations
}

func (rseworker *ResendInvitationEmailWorker) Stop() {
	rseworker.logger.Debug("Worker stopping")
	rseworker.stop <- true
	<-rseworker.stopped
}

func (rseworker *ResendInvitationEmailWorker) JobChannel() chan<- model.Job {
	return rseworker.jobs
}

func (rseworker *ResendInvitationEmailWorker) DoJob(job *model.Job) {
	logger := rseworker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")
	defer rseworker.jobServer.HandleJobPanic(logger, job)

	elapsedTimeSinceSchedule, DurationInMillis := rseworker.GetDurations(job)
	if elapsedTimeSinceSchedule > DurationInMillis {
		rseworker.ResendEmails(logger, job, "48")
		rseworker.TearDown(logger, job)
	}
}

func (rseworker *ResendInvitationEmailWorker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	if err := rseworker.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("Worker: Failed to set success for job", mlog.Err(err))
		rseworker.setJobError(logger, job, err)
	}
}

func (rseworker *ResendInvitationEmailWorker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if err := rseworker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("Worker: Failed to set job error", mlog.Err(err))
	}
}

func (rseworker *ResendInvitationEmailWorker) cleanEmailData(emailStringData string) ([]string, error) {
	// emailStringData looks like this ["user1@gmail.com","user2@gmail.com"]
	emails := []string{}
	err := json.Unmarshal([]byte(emailStringData), &emails)
	if err != nil {
		return nil, err
	}

	return emails, nil
}

func (rseworker *ResendInvitationEmailWorker) cleanChannelsData(channelStringData string) ([]string, error) {
	// channelStringData looks like this ["uuuiiiiidddd","uuuiiiiidddd"]
	channels := []string{}
	err := json.Unmarshal([]byte(channelStringData), &channels)
	if err != nil {
		return nil, err
	}

	return channels, nil
}

func (rseworker *ResendInvitationEmailWorker) removeAlreadyJoined(teamID string, emailList []string) []string {
	var notJoinedYet []string
	for _, email := range emailList {
		// check if the user with this email is on the system already
		user, appErr := rseworker.app.GetUserByEmail(email)
		if appErr != nil {
			notJoinedYet = append(notJoinedYet, email)
			continue
		}
		// now we check if they are part of the team already
		userID := []string{user.Id}
		members, appErr := rseworker.app.GetTeamMembersByIds(teamID, userID, nil)
		if len(members) == 0 || appErr != nil {
			notJoinedYet = append(notJoinedYet, email)
		}
	}

	return notJoinedYet
}

func (rseworker *ResendInvitationEmailWorker) GetDurations(job *model.Job) (int64, int64) {
	scheduledAt, _ := strconv.ParseInt(job.Data["scheduledAt"], 10, 64)
	now := model.GetMillis()

	elapsedTimeSinceSchedule := now - scheduledAt

	duration := os.Getenv("MM_RESEND_INVITATION_EMAIL_JOB_DURATION")
	DurationInMillis, parseError := strconv.ParseInt(duration, 10, 64)
	if parseError != nil {
		// default to 48 hours
		DurationInMillis = FourtyEightHoursInMillis
	}

	return elapsedTimeSinceSchedule, DurationInMillis
}

func (rseworker *ResendInvitationEmailWorker) TearDown(logger mlog.LoggerIFace, job *model.Job) {
	if _, err := rseworker.store.System().PermanentDeleteByName(job.Id); err != nil {
		logger.Error("Worker: Failed to tear down data", mlog.Err(err))
	}

	rseworker.setJobSuccess(logger, job)
}

func (rseworker *ResendInvitationEmailWorker) ResendEmails(logger mlog.LoggerIFace, job *model.Job, interval string) {
	rctx := request.EmptyContext(logger)

	teamID := job.Data["teamID"]
	emailListData := job.Data["emailList"]
	channelListData := job.Data["channelList"]

	emailList, err := rseworker.cleanEmailData(emailListData)
	if err != nil {
		appErr := model.NewAppError("worker: "+rseworker.name, "job_id: "+job.Id, nil, "", http.StatusInternalServerError).Wrap(err)
		logger.Error("Worker: Failed to clean emails string data", mlog.Err(appErr))
		rseworker.setJobError(logger, job, appErr)
	}

	channelList, err := rseworker.cleanChannelsData(channelListData)
	if err != nil {
		appErr := model.NewAppError("worker: "+rseworker.name, "job_id: "+job.Id, nil, "", http.StatusInternalServerError).Wrap(err)
		logger.Error("Worker: Failed to clean channel string data", mlog.Err(appErr))
		rseworker.setJobError(logger, job, appErr)
	}

	emailList = rseworker.removeAlreadyJoined(teamID, emailList)

	memberInvite := model.MemberInvite{
		Emails: emailList,
	}

	if len(channelList) > 0 {
		memberInvite.ChannelIds = channelList
	}

	_, appErr := rseworker.app.InviteNewUsersToTeamGracefully(rctx, &memberInvite, teamID, job.Data["senderID"], interval)
	if appErr != nil {
		logger.Error("Worker: Failed to send emails", mlog.Err(appErr))
		rseworker.setJobError(logger, job, appErr)
	}
	rseworker.telemetryService.SendTelemetry("track_invite_email_resend", map[string]any{interval: interval})
}
