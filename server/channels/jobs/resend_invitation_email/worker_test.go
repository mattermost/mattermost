// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package resend_invitation_email

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type fakeResendApp struct {
	invitedWith *model.MemberInvite
	joinedEmail string
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
func (a *fakeResendApp) InviteNewUsersToTeamGracefully(rctx request.CTX, memberInvite *model.MemberInvite, teamID, senderID, reminderInterval string) ([]*model.EmailInviteWithError, *model.AppError) {
	a.invitedWith = memberInvite
	return nil, nil
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
	}, "48")

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

			appErr := worker.ResendEmails(worker.logger, &model.Job{Id: model.NewId(), Data: data}, "48")

			require.NotNil(t, appErr)
			require.Nil(t, app.invitedWith)
		})
	}
}
