// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package resend_invitation_email

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/configservice"
	"github.com/mattermost/mattermost-server/v6/services/telemetry"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const TwentyFourHoursInMillis int64 = 86400000
const FourtyEightHoursInMillis int64 = 172800000
const SeventyTwoHoursInMillis int64 = 259200000

type AppIface interface {
	configservice.ConfigService
	GetUserByEmail(email string) (*model.User, *model.AppError)
	GetTeamMembersByIds(teamID string, userIDs []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError)
	InviteNewUsersToTeamGracefully(emailList []string, teamID, senderId string, reminderInterval string) ([]*model.EmailInviteWithError, *model.AppError)
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

func (rseworker *ResendInvitationEmailWorker) Run() {
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
			rseworker.DoJob(&job)
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

func (rseworker *ResendInvitationEmailWorker) DoJob(job *model.Job) {
	resendInviteEmailIntervalFlag := rseworker.app.Config().FeatureFlags.ResendInviteEmailInterval

	switch resendInviteEmailIntervalFlag {
	case "48":
		rseworker.DoJob_24_48(job)
	case "72":
		rseworker.DoJob_24_72(job)
	default:
		rseworker.DoJob_24(job)
	}
}

func (rseworker *ResendInvitationEmailWorker) DoJob_24(job *model.Job) {
	elapsedTimeSinceSchedule, DurationInMillis_24, _, _ := rseworker.GetDurations(job)
	if elapsedTimeSinceSchedule > DurationInMillis_24 {
		rseworker.ResendEmails(job, "24")
		rseworker.TearDown(job)
	}
}

func (rseworker *ResendInvitationEmailWorker) DoJob_24_48(job *model.Job) {
	elapsedTimeSinceSchedule, DurationInMillis_24, DurationInMillis_48, _ := rseworker.GetDurations(job)
	rseworker.Execute(job, elapsedTimeSinceSchedule, DurationInMillis_24, DurationInMillis_48, "24", "48")
}

func (rseworker *ResendInvitationEmailWorker) DoJob_24_72(job *model.Job) {
	elapsedTimeSinceSchedule, DurationInMillis_24, _, DurationInMillis_72 := rseworker.GetDurations(job)
	rseworker.Execute(job, elapsedTimeSinceSchedule, DurationInMillis_24, DurationInMillis_72, "24", "72")
}

func (rseworker *ResendInvitationEmailWorker) Execute(job *model.Job, elapsedTimeSinceSchedule, firstDuration, secondDuration int64, firstDurationTelemetryValue, secondDurationTelemetryValue string) {
	systemValue, sysValErr := rseworker.store.System().GetByName(job.Id)
	if sysValErr != nil {
		if _, ok := sysValErr.(*store.ErrNotFound); !ok {
			mlog.Error("An error occurred while getting NUMBER_OF_INVITE_EMAILS_SENT from system store", mlog.String("worker", rseworker.name), mlog.Err(sysValErr))
			// system value information is critical and if it was not set for this job at creation, we want to cancel the job all together.
			rseworker.setJobCancelled(job)
			return
		}
	}

	if (elapsedTimeSinceSchedule > firstDuration) && (systemValue == nil || systemValue.Value == "0") {
		rseworker.ResendEmails(job, firstDurationTelemetryValue)
		rseworker.setNumResendEmailSent(job, "1")
	} else if elapsedTimeSinceSchedule > secondDuration {
		rseworker.ResendEmails(job, secondDurationTelemetryValue)
		rseworker.TearDown(job)
	}
}

func (rseworker *ResendInvitationEmailWorker) setJobSuccess(job *model.Job) {
	if err := rseworker.jobServer.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		rseworker.setJobError(job, err)
	}
}

func (rseworker *ResendInvitationEmailWorker) setJobCancelled(job *model.Job) {
	if err := rseworker.jobServer.SetJobCanceled(job); err != nil {
		mlog.Error("Worker: Failed to cancel job", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
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

func (rseworker *ResendInvitationEmailWorker) setNumResendEmailSent(job *model.Job, num string) {
	sysVar := &model.System{Name: job.Id, Value: num}
	if err := rseworker.store.System().SaveOrUpdate(sysVar); err != nil {
		mlog.Error("Unable to save NUMBER_OF_INVITE_EMAIL_SENT", mlog.String("worker", rseworker.name), mlog.Err(err))
	}
}

func (rseworker *ResendInvitationEmailWorker) GetDurations(job *model.Job) (int64, int64, int64, int64) {
	scheduledAt, _ := strconv.ParseInt(job.Data["scheduledAt"], 10, 64)
	now := model.GetMillis()

	elapsedTimeSinceSchedule := now - scheduledAt

	duration_24 := os.Getenv("MM_RESEND_INVITATION_EMAIL_JOB_DURATION")
	DurationInMillis_24, parseError := strconv.ParseInt(duration_24, 10, 64)
	if parseError != nil {
		// default to 24 hours
		DurationInMillis_24 = TwentyFourHoursInMillis
	}

	duration_48 := os.Getenv("MM_RESEND_INVITATION_EMAIL_JOB_DURATION_48")
	DurationInMillis_48, parseError := strconv.ParseInt(duration_48, 10, 64)
	if parseError != nil {
		// default to 48 hours
		DurationInMillis_48 = FourtyEightHoursInMillis
	}

	duration_72 := os.Getenv("MM_RESEND_INVITATION_EMAIL_JOB_DURATION_72")
	DurationInMillis_72, parseError := strconv.ParseInt(duration_72, 10, 64)
	if parseError != nil {
		// default to 72 hours
		DurationInMillis_72 = SeventyTwoHoursInMillis
	}

	return elapsedTimeSinceSchedule, DurationInMillis_24, DurationInMillis_48, DurationInMillis_72

}

func (rseworker *ResendInvitationEmailWorker) TearDown(job *model.Job) {
	rseworker.store.System().PermanentDeleteByName(job.Id)
	rseworker.setJobSuccess(job)
}

func (rseworker *ResendInvitationEmailWorker) ResendEmails(job *model.Job, interval string) {
	teamID := job.Data["teamID"]
	emailListData := job.Data["emailList"]

	emailList, err := rseworker.cleanEmailData(emailListData)
	if err != nil {
		appErr := model.NewAppError("worker: "+rseworker.name, "job_id: "+job.Id, nil, err.Error(), http.StatusInternalServerError)
		mlog.Error("Worker: Failed to clean emails string data", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", appErr.Error()))
		rseworker.setJobError(job, appErr)
	}

	emailList = rseworker.removeAlreadyJoined(teamID, emailList)

	_, appErr := rseworker.app.InviteNewUsersToTeamGracefully(emailList, teamID, job.Data["senderID"], interval)
	if appErr != nil {
		mlog.Error("Worker: Failed to send emails", mlog.String("worker", rseworker.name), mlog.String("job_id", job.Id), mlog.String("error", appErr.Error()))
		rseworker.setJobError(job, appErr)
	}
	rseworker.telemetryService.SendTelemetry("track_invite_email_resend", map[string]interface{}{interval: interval})
}
