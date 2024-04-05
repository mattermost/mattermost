// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestCustomStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	cs := &model.CustomStatus{
		Emoji: "smile",
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
		getFails     bool
		updateFails  bool
		expectedErr  string
	}{
		"set custom status fails on get user":       {customStatus: "set", getFails: true, updateFails: false, expectedErr: MissingAccountError},
		"set custom status fails on update user":    {customStatus: "set", getFails: false, updateFails: true, expectedErr: "app.user.update.finding.app_error"},
		"remove custom status fails on get user":    {customStatus: "remove", getFails: true, updateFails: false, expectedErr: MissingAccountError},
		"remove custom status fails on update user": {customStatus: "remove", getFails: false, updateFails: true, expectedErr: "app.user.update.finding.app_error"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			mockUserStore := mocks.UserStore{}

			if tc.getFails {
				mockUserStore.On("Get", mock.Anything, mock.Anything).Return(nil, mockErr)
			} else {
				mockUserStore.On("Get", mock.Anything, mock.Anything).Return(mockUser, nil)
			}

			if tc.updateFails {
				mockUserStore.On("Update", mock.Anything, mock.Anything, mock.Anything).Return(nil, mockErr)
			} else {
				mockUserStore.On("Update", mock.Anything, mock.Anything, mock.Anything).Return(mockUser, nil)
			}

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
				Emoji: "smile",
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

func TestSetCustomStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableCustomEmoji = true
	})

	emoji := th.CreateEmoji()

	for _, testCase := range []struct {
		Name         string
		Input        *model.CustomStatus
		ExpectsError bool
	}{
		{
			Name: "should be able to set custom status with text and emoji",
			Input: &model.CustomStatus{
				Emoji: "smile",
				Text:  "honk!",
			},
			ExpectsError: false,
		},
		{
			Name: "should be able to set custom status with only text",
			Input: &model.CustomStatus{
				Text: "honk!",
			},
			ExpectsError: false,
		},
		{
			Name: "should be able to set custom status with just a system emoji",
			Input: &model.CustomStatus{
				Emoji: "smile",
			},
			ExpectsError: false,
		},
		{
			Name: "should be able to set custom status with just a custom emoji",
			Input: &model.CustomStatus{
				Emoji: emoji.Name,
			},
			ExpectsError: false,
		},
		{
			Name:         "should not be able to set custom status without text or emoji",
			Input:        &model.CustomStatus{},
			ExpectsError: true,
		},
		{
			Name: "should not be able to set custom status with a non-existent emoji name",
			Input: &model.CustomStatus{
				Emoji: "somethingthatdoesntexist",
			},
			ExpectsError: true,
		},
		{
			Name: "should not be able to set custom status with an invalid emoji name",
			Input: &model.CustomStatus{
				Emoji: "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz",
				Text:  "honk!",
			},
			ExpectsError: true,
		},
	} {
		t.Run(testCase.Name, func(t *testing.T) {
			err := th.App.SetCustomStatus(th.Context, th.BasicUser.Id, testCase.Input)
			defer th.App.RemoveCustomStatus(th.Context, th.BasicUser.Id)

			if testCase.ExpectsError {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}

			customStatus, err := th.App.GetCustomStatus(th.BasicUser.Id)

			require.Nil(t, err)

			if testCase.ExpectsError {
				assert.NotEqual(t, testCase.Input, customStatus)
			} else {
				assert.Equal(t, testCase.Input, customStatus)
			}
		})
	}
}
