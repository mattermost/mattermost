// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package resend_invitation_email

import (
	"encoding/json"
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

type fakeResendApp struct {
	invitedWith  *model.MemberInvite
	joinedEmail  string
	inviteErrors []*model.EmailInviteWithError
	inviteAppErr *model.AppError
}

func (a *fakeResendApp) Config() *model.Config                                 { return &model.Config{} }
func (a *fakeResendApp) AddConfigListener(func(old, cur *model.Config)) string { return "" }
func (a *fakeResendApp) RemoveConfigListener(string)                           {}
func (a *fakeResendApp) GetUserByEmail(email string) (*model.User, *model.AppError) {
	if email == a.joinedEmail {
		return &model.User{Id: email}, nil
	}
	return nil, model.NewAppError("GetUserByEmail", "app.user.missing_account.const", nil, "", http.StatusNotFound)
}
func (a *fakeResendApp) GetTeamMembersByIds(teamID string, userIDs []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError) {
	if len(userIDs) == 1 && userIDs[0] == a.joinedEmail {
		return []*model.TeamMember{{UserId: a.joinedEmail}}, nil
	}
	return nil, nil
}
func (a *fakeResendApp) InviteNewUsersToTeamGracefully(rctx request.CTX, memberInvite *model.MemberInvite, teamID, senderID string, isReminder bool) ([]*model.EmailInviteWithError, *model.AppError) {
	a.invitedWith = memberInvite
	return a.inviteErrors, a.inviteAppErr
}

func newTestWorker(t *testing.T, app AppIface) *ResendInvitationEmailWorker {
	t.Helper()
	return &ResendInvitationEmailWorker{
		name:   "ResendInvitationEmail",
		logger: mlog.CreateConsoleTestLogger(t),
		app:    app,
	}
}

func TestResendEmailsCarriesProfilesForPendingUsers(t *testing.T) {
	profiles := []*model.MemberInviteProfile{
		{Email: "joined@example.com", Username: "joined.user"},
		{Email: "waiting@example.com", Username: "waiting.user", FirstName: "Waiting", LastName: "User"},
	}
	profilesJSON, err := json.Marshal(profiles)
	require.NoError(t, err)

	app := &fakeResendApp{joinedEmail: "joined@example.com"}
	worker := newTestWorker(t, app)
	appErr := worker.ResendEmails(worker.logger, &model.Job{
		Id: model.NewId(),
		Data: map[string]string{
			"emailList":    model.ArrayToJSON([]string{"joined@example.com", "waiting@example.com"}),
			"teamID":       model.NewId(),
			"senderID":     model.NewId(),
			"profilesList": string(profilesJSON),
		},
	})

	require.Nil(t, appErr)
	require.Equal(t, []string{"waiting@example.com"}, app.invitedWith.Emails)
	require.Equal(t, profiles[1:], app.invitedWith.Profiles)
}

func TestResendEmailsRejectsMalformedJobData(t *testing.T) {
	for _, key := range []string{"emailList", "channelList", "profilesList"} {
		t.Run(key, func(t *testing.T) {
			app := &fakeResendApp{}
			worker := newTestWorker(t, app)
			data := map[string]string{
				"emailList": model.ArrayToJSON([]string{"user@example.com"}),
				"teamID":    model.NewId(),
				"senderID":  model.NewId(),
				key:         "not-json",
			}

			appErr := worker.ResendEmails(worker.logger, &model.Job{Id: model.NewId(), Data: data})

			require.NotNil(t, appErr)
			require.Nil(t, app.invitedWith)
		})
	}
}

func newDoJobTestWorker(t *testing.T, app AppIface) (*ResendInvitationEmailWorker, *storetest.Store) {
	t.Helper()
	mockStore := &storetest.Store{}
	t.Cleanup(func() { mockStore.AssertExpectations(t) })

	jobServer := jobs.NewJobServer(&testutils.StaticConfigService{}, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)
	return MakeWorker(jobServer, app, mockStore), mockStore
}

func newDueResendJob() *model.Job {
	return &model.Job{
		Id:     model.NewId(),
		Type:   model.JobTypeResendInvitationEmail,
		Status: model.JobStatusPending,
		Data: map[string]string{
			"emailList":   model.ArrayToJSON([]string{"user@example.com"}),
			"teamID":      model.NewId(),
			"senderID":    model.NewId(),
			"scheduledAt": strconv.FormatInt(model.GetMillis()-FourtyEightHoursInMillis-1000, 10),
		},
	}
}

func expectClaim(mockStore *storetest.Store, job *model.Job) {
	claimed := *job
	claimed.Status = model.JobStatusInProgress
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(&claimed, nil).Once()
}

func expectJobError(mockStore *storetest.Store, job *model.Job) {
	mockStore.JobStore.On("UpdateOptimistically", mock.MatchedBy(func(j *model.Job) bool {
		return j.Id == job.Id && j.Status == model.JobStatusError
	}), model.JobStatusInProgress).Return(job, nil).Once()
}

func TestDoJob(t *testing.T) {
	t.Setenv("MM_RESEND_INVITATION_EMAIL_JOB_DURATION", strconv.FormatInt(FourtyEightHoursInMillis, 10))

	t.Run("does nothing before the job is due", func(t *testing.T) {
		app := &fakeResendApp{}
		worker, _ := newDoJobTestWorker(t, app)
		job := newDueResendJob()
		job.Data["scheduledAt"] = strconv.FormatInt(model.GetMillis(), 10)

		worker.DoJob(job)

		assert.Nil(t, app.invitedWith)
	})

	t.Run("skips a job claimed by another node", func(t *testing.T) {
		app := &fakeResendApp{}
		worker, mockStore := newDoJobTestWorker(t, app)
		job := newDueResendJob()
		mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(nil, nil).Once()

		worker.DoJob(job)

		assert.Nil(t, app.invitedWith)
	})

	t.Run("marks the job successful after resending", func(t *testing.T) {
		app := &fakeResendApp{}
		worker, mockStore := newDoJobTestWorker(t, app)
		job := newDueResendJob()
		expectClaim(mockStore, job)
		mockStore.SystemStore.On("PermanentDeleteByName", job.Id).Return(nil, nil).Once()
		mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusSuccess).Return(job, nil).Once()

		worker.DoJob(job)

		require.NotNil(t, app.invitedWith)
		assert.Equal(t, []string{"user@example.com"}, app.invitedWith.Emails)
	})

	t.Run("marks the job failed when a recipient cannot be sent to", func(t *testing.T) {
		app := &fakeResendApp{inviteErrors: []*model.EmailInviteWithError{{
			Email: "mailto:user@example.com",
			Error: model.NewAppError("InviteNewUsersToTeamGracefully", "api.team.invite_members.unable_to_send_email.app_error", nil, "", http.StatusInternalServerError),
		}}}
		worker, mockStore := newDoJobTestWorker(t, app)
		job := newDueResendJob()
		expectClaim(mockStore, job)
		expectJobError(mockStore, job)

		worker.DoJob(job)

		assert.NotNil(t, app.invitedWith)
	})

	t.Run("marks the job failed when the sender is rate limited", func(t *testing.T) {
		app := &fakeResendApp{inviteAppErr: model.NewAppError("InviteNewUsersToTeamGracefully", "app.email.rate_limit_exceeded.app_error", nil, "", http.StatusRequestEntityTooLarge)}
		worker, mockStore := newDoJobTestWorker(t, app)
		job := newDueResendJob()
		expectClaim(mockStore, job)
		expectJobError(mockStore, job)

		worker.DoJob(job)

		assert.NotNil(t, app.invitedWith)
	})
}
