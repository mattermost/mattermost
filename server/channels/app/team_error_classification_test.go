// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestTeamStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	mockStore := &storemocks.Store{}
	teamMock := &storemocks.TeamStore{}
	notificationMock := &storemocks.PostPersistentNotificationStore{}
	mockStore.On("Close").Return(nil)
	mockStore.On("Team").Return(teamMock)
	mockStore.On("PostPersistentNotification").Return(notificationMock)
	notificationMock.On("DeleteByTeam", mock.Anything).Return(nil)
	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(mockStore)
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	teamID := th.BasicTeam.Id
	notFound := fmt.Errorf("query: %w", store.NewErrNotFound("Team", model.NewId()))
	invalid := fmt.Errorf("query: %w", store.NewErrInvalidInput("Team", "Id", "x"))
	plain := errors.New("db down")
	appErr := model.NewAppError("Update", "app.custom.error", nil, "", http.StatusTeapot)
	wrappedAppErr := fmt.Errorf("wrap: %w", appErr)

	type tc struct {
		err    error
		id     string
		status int
	}

	updateCases := []tc{
		{invalid, "app.team.update.find.app_error", http.StatusBadRequest},
		{wrappedAppErr, "app.custom.error", http.StatusTeapot},
		{plain, "app.team.update.updating.app_error", http.StatusInternalServerError},
	}

	check := func(t *testing.T, c tc, got *model.AppError) {
		t.Helper()
		require.NotNil(t, got)
		assert.Equal(t, c.id, got.Id)
		assert.Equal(t, c.status, got.StatusCode)
	}

	t.Run("team updates", func(t *testing.T) {
		calls := map[string]func() *model.AppError{
			"UpdateTeamScheme": func() *model.AppError {
				_, err := th.App.UpdateTeamScheme(&model.Team{Id: teamID})
				return err
			},
			"UpdateTeamPrivacy": func() *model.AppError {
				return th.App.UpdateTeamPrivacy(teamID, model.TeamOpen, true)
			},
			"RegenerateTeamInviteId": func() *model.AppError {
				_, err := th.App.RegenerateTeamInviteId(teamID)
				return err
			},
			"PermanentDeleteTeam": func() *model.AppError {
				return th.App.PermanentDeleteTeam(th.Context, &model.Team{Id: teamID})
			},
			"SoftDeleteTeam": func() *model.AppError {
				return th.App.SoftDeleteTeam(teamID)
			},
			"RestoreTeam": func() *model.AppError {
				return th.App.RestoreTeam(teamID)
			},
		}
		for name, call := range calls {
			t.Run(name, func(t *testing.T) {
				for _, c := range updateCases {
					teamMock.On("Update", mock.Anything).Return(nil, c.err).Once()
					check(t, c, call())
				}
			})
		}
	})

	t.Run("GetTeamByName", func(t *testing.T) {
		for _, c := range []tc{
			{notFound, "app.team.get_by_name.missing.app_error", http.StatusNotFound},
			{plain, "app.team.get_by_name.app_error", http.StatusNotFound},
		} {
			teamMock.On("GetByName", "name").Return(nil, c.err).Once()
			_, err := th.App.GetTeamByName("name")
			check(t, c, err)
		}
	})

	t.Run("GetTeamByInviteId", func(t *testing.T) {
		for _, c := range []tc{
			{notFound, "app.team.get_by_invite_id.finding.app_error", http.StatusNotFound},
			{plain, "app.team.get_by_invite_id.finding.app_error", http.StatusInternalServerError},
		} {
			teamMock.On("GetByInviteId", "invite").Return(nil, c.err).Once()
			_, err := th.App.GetTeamByInviteId("invite")
			check(t, c, err)
		}
	})

	t.Run("GetTeamMember", func(t *testing.T) {
		for _, c := range []tc{
			{notFound, "app.team.get_member.missing.app_error", http.StatusNotFound},
			{plain, "app.team.get_member.app_error", http.StatusInternalServerError},
		} {
			teamMock.On("GetMember", mock.Anything, "t", "u").Return(nil, c.err).Once()
			_, err := th.App.GetTeamMember(th.Context, "t", "u")
			check(t, c, err)
		}
	})
}
