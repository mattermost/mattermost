// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/channels/app/users"
	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

func TestCustomStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	cs := &model.CustomStatus{
		Emoji: ":smile:",
		Text:  "honk!",
	}

	err := th.App.SetCustomStatus(th.Context, user.Id, cs)
	require.Nil(t, err, "failed to set custom status %v", err)

	csSaved, err := th.App.GetCustomStatus(user.Id)
	require.Nil(t, err, "failed to get custom status after save %v", err)
	require.Equal(t, cs, csSaved)

	err = th.App.RemoveCustomStatus(th.Context, user.Id)
	require.Nil(t, err, "failed to to clear custom status %v", err)

	var csClear *model.CustomStatus
	csSaved, err = th.App.GetCustomStatus(user.Id)
	require.Nil(t, err, "failed to get custom status after clear %v", err)
	require.Equal(t, csClear, csSaved)
}

func TestCustomStatusErrors(t *testing.T) {

	fakeUserID := "foobar"
	mockErr := store.NewErrNotFound("User", fakeUserID)
	mockUser := &model.User{Id: fakeUserID}

	tests := map[string]struct {
		customStatus string
		successFn    string
		failFn       string
		expectedErr  string
	}{
		"set custom status fails on get user":       {customStatus: "set", successFn: "Update", failFn: "Get", expectedErr: MissingAccountError},
		"set custom status fails on update user":    {customStatus: "set", successFn: "Get", failFn: "Update", expectedErr: "app.user.update.finding.app_error"},
		"remove custom status fails on get user":    {customStatus: "remove", successFn: "Update", failFn: "Get", expectedErr: MissingAccountError},
		"remove custom status fails on update user": {customStatus: "remove", successFn: "Get", failFn: "Update", expectedErr: "app.user.update.finding.app_error"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			mockUserStore := mocks.UserStore{}

			mockUserStore.On(tc.successFn, mock.Anything, mock.Anything).Return(mockUser, nil)
			mockUserStore.On(tc.failFn, mock.Anything, mock.Anything).Return(nil, mockErr)

			var err error
			mockSessionStore := mocks.SessionStore{}
			mockOAuthStore := mocks.OAuthStore{}
			th.App.ch.srv.userService, err = users.New(users.ServiceConfig{
				UserStore:    &mockUserStore,
				SessionStore: &mockSessionStore,
				OAuthStore:   &mockOAuthStore,
				ConfigFn:     th.App.ch.srv.platform.Config,
				LicenseFn:    th.App.ch.srv.License,
			})
			require.NoError(t, err)

			cs := &model.CustomStatus{
				Emoji: ":smile:",
				Text:  "honk!",
			}

			var appErr *model.AppError
			switch tc.customStatus {
			case "set":
				appErr = th.App.SetCustomStatus(th.Context, fakeUserID, cs)
			case "remove":
				appErr = th.App.RemoveCustomStatus(th.Context, fakeUserID)
			}

			require.NotNil(t, appErr)
			require.Equal(t, tc.expectedErr, appErr.Id)
		})
	}
}
