// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package resend_invitation_email

import (
	"encoding/json"
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type fakeResendApp struct {
	invitedWith *model.MemberInvite
}

type fakeJobServer struct {
	errors int
}

func (s *fakeJobServer) Logger() mlog.LoggerIFace {
	return mlog.CreateConsoleLogger()
}

func (s *fakeJobServer) HandleJobPanic(logger mlog.LoggerIFace, job *model.Job) {}

func (s *fakeJobServer) SetJobSuccess(job *model.Job) *model.AppError {
	return nil
}

func (s *fakeJobServer) SetJobError(job *model.Job, jobError *model.AppError) *model.AppError {
	s.errors++
	return nil
}

func (a *fakeResendApp) Config() *model.Config                                 { return &model.Config{} }
func (a *fakeResendApp) AddConfigListener(func(old, cur *model.Config)) string { return "" }
func (a *fakeResendApp) RemoveConfigListener(string)                           {}
func (a *fakeResendApp) GetUserByEmail(email string) (*model.User, *model.AppError) {
	return nil, model.NewAppError("GetUserByEmail", "app.user.missing_account.const", nil, "", http.StatusNotFound)
}

func (a *fakeResendApp) GetTeamMembersByIds(teamID string, userIDs []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError) {
	return nil, nil
}

func (a *fakeResendApp) InviteNewUsersToTeamGracefully(rctx request.CTX, memberInvite *model.MemberInvite, teamID, senderId string, reminderInterval string) ([]*model.EmailInviteWithError, *model.AppError) {
	a.invitedWith = memberInvite
	return nil, nil
}

func TestResendEmailsCarriesJobData(t *testing.T) {
	newWorker := func(app AppIface) *ResendInvitationEmailWorker {
		return &ResendInvitationEmailWorker{
			name:      "ResendInvitationEmail",
			logger:    mlog.CreateConsoleTestLogger(t),
			app:       app,
			jobServer: &fakeJobServer{},
		}
	}
	newJob := func(data map[string]string) *model.Job {
		return &model.Job{Id: model.NewId(), Data: data}
	}

	t.Run("profiles round-trip through jobData", func(t *testing.T) {
		profiles := []*model.MemberInviteProfile{{
			Email:     "user1@example.com",
			Username:  "user.one",
			FirstName: "User",
			LastName:  "One",
		}}
		profilesJSON, err := json.Marshal(profiles)
		require.NoError(t, err)

		app := &fakeResendApp{}
		worker := newWorker(app)
		worker.ResendEmails(worker.logger, newJob(map[string]string{
			"emailList":    model.ArrayToJSON([]string{"user1@example.com"}),
			"teamID":       model.NewId(),
			"senderID":     model.NewId(),
			"scheduledAt":  strconv.FormatInt(model.GetMillis(), 10),
			"profilesList": string(profilesJSON),
		}), "48")

		require.NotNil(t, app.invitedWith)
		require.Equal(t, []string{"user1@example.com"}, app.invitedWith.Emails)
		require.Len(t, app.invitedWith.Profiles, 1)
		require.Equal(t, "user1@example.com", app.invitedWith.Profiles[0].Email)
		require.Equal(t, "user.one", app.invitedWith.Profiles[0].Username)
		require.Equal(t, "User", app.invitedWith.Profiles[0].FirstName)
		require.Equal(t, "One", app.invitedWith.Profiles[0].LastName)
	})

	t.Run("no profiles in jobData leaves invite profiles empty", func(t *testing.T) {
		app := &fakeResendApp{}
		worker := newWorker(app)
		worker.ResendEmails(worker.logger, newJob(map[string]string{
			"emailList":   model.ArrayToJSON([]string{"user1@example.com"}),
			"channelList": model.ArrayToJSON([]string{model.NewId()}),
			"teamID":      model.NewId(),
			"senderID":    model.NewId(),
			"scheduledAt": strconv.FormatInt(model.GetMillis(), 10),
		}), "48")

		require.NotNil(t, app.invitedWith)
		require.Empty(t, app.invitedWith.Profiles)
		require.Len(t, app.invitedWith.ChannelIds, 1)
	})

	t.Run("malformed profiles fail the job without sending invitations", func(t *testing.T) {
		app := &fakeResendApp{}
		worker := newWorker(app)
		completed := worker.ResendEmails(worker.logger, newJob(map[string]string{
			"emailList":    model.ArrayToJSON([]string{"user1@example.com"}),
			"teamID":       model.NewId(),
			"senderID":     model.NewId(),
			"scheduledAt":  strconv.FormatInt(model.GetMillis(), 10),
			"profilesList": "not-json",
		}), "48")

		require.False(t, completed)
		require.Nil(t, app.invitedWith)
		require.Equal(t, 1, worker.jobServer.(*fakeJobServer).errors)
	})
}
