// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/auth"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
)

var mockUser = &model.User{
	ID:       utils.NewID(utils.IDTypeUser),
	Username: "testUsername",
	Email:    "testEmail",
	Password: auth.HashPassword("testPassword"),
}

func TestLogin(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	testcases := []struct {
		title    string
		userName string
		email    string
		password string
		mfa      string
		isError  bool
	}{
		{"fail, missing login information", "", "", "", "", true},
		{"fail, invalid username", "badUsername", "", "", "", true},
		{"fail, invalid email", "", "badEmail", "", "", true},
		{"fail, invalid password", "testUsername", "", "badPassword", "", true},
		{"success, using username", "testUsername", "", "testPassword", "", false},
		{"success, using email", "", "testEmail", "testPassword", "", false},
	}

	th.Store.EXPECT().GetUserByUsername("badUsername").Return(nil, errors.New("Bad Username"))
	th.Store.EXPECT().GetUserByEmail("badEmail").Return(nil, errors.New("Bad Email"))
	th.Store.EXPECT().GetUserByUsername("testUsername").Return(mockUser, nil).Times(2)
	th.Store.EXPECT().GetUserByEmail("testEmail").Return(mockUser, nil)
	th.Store.EXPECT().CreateSession(gomock.Any()).Return(nil).Times(2)

	for _, test := range testcases {
		t.Run(test.title, func(t *testing.T) {
			token, err := th.App.Login(test.userName, test.email, test.password, test.mfa)
			if test.isError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.NotNil(t, token)
			}
		})
	}
}

func TestGetUser(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	testcases := []struct {
		title   string
		id      string
		isError bool
	}{
		{"fail, missing id", "", true},
		{"fail, invalid id", "badID", true},
		{"success", "goodID", false},
	}

	th.Store.EXPECT().GetUserByID("badID").Return(nil, errors.New("Bad Id"))
	th.Store.EXPECT().GetUserByID("goodID").Return(mockUser, nil)

	for _, test := range testcases {
		t.Run(test.title, func(t *testing.T) {
			token, err := th.App.GetUser(test.id)
			if test.isError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.NotNil(t, token)
			}
		})
	}
}

func TestRegisterUser(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	testcases := []struct {
		title    string
		userName string
		email    string
		password string
		isError  bool
	}{
		{"fail, missing login information", "", "", "", true},
		{"fail, username exists", "existingUsername", "", "", true},
		{"fail, email exists", "", "existingEmail", "", true},
		{"fail, invalid password", "newUsername", "", "test", true},
		{"success, using email", "", "newEmail", "testPassword", false},
	}

	th.Store.EXPECT().GetUserByUsername("existingUsername").Return(mockUser, nil)
	th.Store.EXPECT().GetUserByUsername("newUsername").Return(mockUser, errors.New("user not found"))
	th.Store.EXPECT().GetUserByEmail("existingEmail").Return(mockUser, nil)
	th.Store.EXPECT().GetUserByEmail("newEmail").Return(nil, model.NewErrNotFound("user"))
	th.Store.EXPECT().CreateUser(gomock.Any()).Return(nil, nil)

	for _, test := range testcases {
		t.Run(test.title, func(t *testing.T) {
			err := th.App.RegisterUser(test.userName, test.email, test.password)
			if test.isError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestUpdateUserPassword(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	testcases := []struct {
		title    string
		userName string
		password string
		isError  bool
	}{
		{"fail, missing login information", "", "", true},
		{"fail, invalid username", "badUsername", "", true},
		{"success, username", "testUsername", "testPassword", false},
	}

	th.Store.EXPECT().UpdateUserPassword("", gomock.Any()).Return(errors.New("user not found"))
	th.Store.EXPECT().UpdateUserPassword("badUsername", gomock.Any()).Return(errors.New("user not found"))
	th.Store.EXPECT().UpdateUserPassword("testUsername", gomock.Any()).Return(nil)

	for _, test := range testcases {
		t.Run(test.title, func(t *testing.T) {
			err := th.App.UpdateUserPassword(test.userName, test.password)
			if test.isError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestChangePassword(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	testcases := []struct {
		title       string
		userName    string
		oldPassword string
		password    string
		isError     bool
	}{
		{"fail, missing login information", "", "", "", true},
		{"fail, invalid userId", "badID", "", "", true},
		{"fail, invalid password", mockUser.ID, "wrongPassword", "newPassword", true},
		{"success, using username", mockUser.ID, "testPassword", "newPassword", false},
	}

	th.Store.EXPECT().GetUserByID("badID").Return(nil, errors.New("userID not found"))
	th.Store.EXPECT().GetUserByID(mockUser.ID).Return(mockUser, nil).Times(2)
	th.Store.EXPECT().UpdateUserPasswordByID(mockUser.ID, gomock.Any()).Return(nil)

	for _, test := range testcases {
		t.Run(test.title, func(t *testing.T) {
			err := th.App.ChangePassword(test.userName, test.oldPassword, test.password)
			if test.isError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
