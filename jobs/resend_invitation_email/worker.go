// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package resend_invitation_email

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/configservice"
	"github.com/mattermost/mattermost-server/v6/services/telemetry"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const FourtyEightHoursInMillis int64 = 172800000

type AppIface interface {
	configservice.ConfigService
	GetUserByEmail(email string) (*model.User, *model.AppError)
	GetTeamMembersByIds(teamID string, userIDs []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError)
	InviteNewUsersToTeamGracefully(c request.CTX, memberInvite *model.MemberInvite, teamID, senderId string, reminderInterval string) ([]*model.EmailInviteWithError, *model.AppError)
}

type ResendInvitationEmailWorker struct {
	name             string
	stop             chan bool
	stopped          chan bool
	jobs             chan model.Job
	jobServer        *jobs.JobServer
	app              AppIface
	store            store.Store
	telemetryService *telemetry.TelemetryService
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface, store store.Store, telemetryService *telemetry.TelemetryService) model.Worker {
	worker := ResendInvitationEmailWorker{
		name:             model.JobTypeResendInvitationEmail,
		stop:             make(chan bool, 1),
		stopped:          make(chan bool, 1),
		jobs:             make(chan model.Job),
		jobServer:        jobServer,
		app:              app,
		store:            store,
		telemetryService: telemetryService,
	}
	return &worker
}

func (rseworker *ResendInvitationEmailWorker) Run(c request.CTX) {
	mlog.Debug("Worker started", mlog.String("worker", rseworker.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", rseworker.name))
		rseworker.stopped <- true
	}()

	for {
		select {
		case <-rseworker.stop:
			mlog.Debug("Worker received stop signal", mlog.String("worker", rseworker.name))
			return
		case job := <-rseworker.jobs:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", rseworker.name))
			rseworker.DoJob(c, &job)
		}
	}
}

func (rseworker *ResendInvitationEmailWorker) IsEnabled(cfg *model.Config) bool {
	return *cfg.ServiceSettings.EnableEmailInvitations
}

func (rseworker *ResendInvitationEmailWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", rseworker.name))
	rseworker.stop <- true
	<-rseworker.stopped
}

func (rseworker *ResendInvitationEmailWorker) JobChannel() chan<- model.Job {
	return rseworker.jobs
}

func (rseworker *ResendInvitationEmailWorker) DoJob(c request.CTX, job *model.Job) {
	elapsedTimeSinceSchedule, DurationInMillis := rseworker.GetDurations(job)
	if elapsedTimeSinceSchedule > DurationInMillis {
		rseworker.ResendEmails(c, job, "48")
		rseworker.TearDown(job)
	}
}

func (rseworker *ResendInvitationEmailWorker) setJobSuccess(job *model.Job) {
	if err := rseworker.jobServer.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		rseworker.setJobError(job, err)
	}
}

func (rseworker *ResendInvitationEmailWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := rseworker.jobServer.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
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

func (rseworker *ResendInvitationEmailWorker) TearDown(job *model.Job) {
	rseworker.store.System().PermanentDeleteByName(job.Id)
	rseworker.setJobSuccess(job)
}

func (rseworker *ResendInvitationEmailWorker) ResendEmails(c request.CTX, job *model.Job, interval string) {
	teamID := job.Data["teamID"]
	emailListData := job.Data["emailList"]
	channelListData := job.Data["channelList"]

	emailList, err := rseworker.cleanEmailData(emailListData)
	if err != nil {
		appErr := model.NewAppError("worker: "+rseworker.name, "job_id: "+job.Id, nil, "", http.StatusInternalServerError).Wrap(err)
		mlog.Error("Worker: Failed to clean emails string data", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", appErr.Error()))
		rseworker.setJobError(job, appErr)
	}

	channelList, err := rseworker.cleanChannelsData(channelListData)
	if err != nil {
		appErr := model.NewAppError("worker: "+rseworker.name, "job_id: "+job.Id, nil, "", http.StatusInternalServerError).Wrap(err)
		mlog.Error("Worker: Failed to clean channel string data", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", appErr.Error()))
		rseworker.setJobError(job, appErr)
	}

	emailList = rseworker.removeAlreadyJoined(teamID, emailList)

	memberInvite := model.MemberInvite{
		Emails: emailList,
	}

	if len(channelList) > 0 {
		memberInvite.ChannelIds = channelList
	}

	_, appErr := rseworker.app.InviteNewUsersToTeamGracefully(c, &memberInvite, teamID, job.Data["senderID"], interval)
	if appErr != nil {
		mlog.Error("Worker: Failed to send emails", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", appErr.Error()))
		rseworker.setJobError(job, appErr)
	}
	rseworker.telemetryService.SendTelemetry("track_invite_email_resend", map[string]any{interval: interval})
}
