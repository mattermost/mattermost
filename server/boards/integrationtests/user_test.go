// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"bytes"
	"crypto/rand"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

const (
	fakeUsername = "fakeUsername"
	fakeEmail    = "mock@test.com"
)

func TestUserRegister(t *testing.T) {
	th := SetupTestHelper(t).Start()
	defer th.TearDown()

	// register
	registerRequest := &model.RegisterRequest{
		Username: fakeUsername,
		Email:    fakeEmail,
		Password: utils.NewID(utils.IDTypeNone),
	}
	success, resp := th.Client.Register(registerRequest)
	require.NoError(t, resp.Error)
	require.True(t, success)

	// register again will fail
	success, resp = th.Client.Register(registerRequest)
	require.Error(t, resp.Error)
	require.False(t, success)
}

func TestUserLogin(t *testing.T) {
	th := SetupTestHelper(t).Start()
	defer th.TearDown()

	t.Run("with nonexist user", func(t *testing.T) {
		loginRequest := &model.LoginRequest{
			Type:     "normal",
			Username: "nonexistuser",
			Email:    "",
			Password: utils.NewID(utils.IDTypeNone),
		}
		data, resp := th.Client.Login(loginRequest)
		require.Error(t, resp.Error)
		require.Nil(t, data)
	})

	t.Run("with registered user", func(t *testing.T) {
		password := utils.NewID(utils.IDTypeNone)
		// register
		registerRequest := &model.RegisterRequest{
			Username: fakeUsername,
			Email:    fakeEmail,
			Password: password,
		}
		success, resp := th.Client.Register(registerRequest)
		require.NoError(t, resp.Error)
		require.True(t, success)

		// login
		loginRequest := &model.LoginRequest{
			Type:     "normal",
			Username: fakeUsername,
			Email:    fakeEmail,
			Password: password,
		}
		data, resp := th.Client.Login(loginRequest)
		require.NoError(t, resp.Error)
		require.NotNil(t, data)
		require.NotNil(t, data.Token)
	})
}

func TestGetMe(t *testing.T) {
	th := SetupTestHelper(t).Start()
	defer th.TearDown()

	t.Run("not login yet", func(t *testing.T) {
		me, resp := th.Client.GetMe()
		require.Error(t, resp.Error)
		require.Nil(t, me)
	})

	t.Run("logged in", func(t *testing.T) {
		// register
		password := utils.NewID(utils.IDTypeNone)
		registerRequest := &model.RegisterRequest{
			Username: fakeUsername,
			Email:    fakeEmail,
			Password: password,
		}
		success, resp := th.Client.Register(registerRequest)
		require.NoError(t, resp.Error)
		require.True(t, success)
		// login
		loginRequest := &model.LoginRequest{
			Type:     "normal",
			Username: fakeUsername,
			Email:    fakeEmail,
			Password: password,
		}
		data, resp := th.Client.Login(loginRequest)
		require.NoError(t, resp.Error)
		require.NotNil(t, data)
		require.NotNil(t, data.Token)

		// get user me
		me, resp := th.Client.GetMe()
		require.NoError(t, resp.Error)
		require.NotNil(t, me)
		require.Equal(t, "", me.Email)
		require.Equal(t, registerRequest.Username, me.Username)
	})
}

func TestGetUser(t *testing.T) {
	th := SetupTestHelper(t).Start()
	defer th.TearDown()

	// register
	password := utils.NewID(utils.IDTypeNone)
	registerRequest := &model.RegisterRequest{
		Username: fakeUsername,
		Email:    fakeEmail,
		Password: password,
	}
	success, resp := th.Client.Register(registerRequest)
	require.NoError(t, resp.Error)
	require.True(t, success)
	// login
	loginRequest := &model.LoginRequest{
		Type:     "normal",
		Username: fakeUsername,
		Email:    fakeEmail,
		Password: password,
	}
	data, resp := th.Client.Login(loginRequest)
	require.NoError(t, resp.Error)
	require.NotNil(t, data)
	require.NotNil(t, data.Token)

	me, resp := th.Client.GetMe()
	require.NoError(t, resp.Error)
	require.NotNil(t, me)

	t.Run("me's id", func(t *testing.T) {
		user, resp := th.Client.GetUser(me.ID)
		require.NoError(t, resp.Error)
		require.NotNil(t, user)
		require.Equal(t, me.ID, user.ID)
		require.Equal(t, me.Username, user.Username)
	})

	t.Run("nonexist user", func(t *testing.T) {
		user, resp := th.Client.GetUser("nonexistid")
		require.Error(t, resp.Error)
		require.Nil(t, user)
	})
}

func TestUserChangePassword(t *testing.T) {
	th := SetupTestHelper(t).Start()
	defer th.TearDown()

	// register
	password := utils.NewID(utils.IDTypeNone)
	registerRequest := &model.RegisterRequest{
		Username: fakeUsername,
		Email:    fakeEmail,
		Password: password,
	}
	success, resp := th.Client.Register(registerRequest)
	require.NoError(t, resp.Error)
	require.True(t, success)
	// login
	loginRequest := &model.LoginRequest{
		Type:     "normal",
		Username: fakeUsername,
		Email:    fakeEmail,
		Password: password,
	}
	data, resp := th.Client.Login(loginRequest)
	require.NoError(t, resp.Error)
	require.NotNil(t, data)
	require.NotNil(t, data.Token)

	originalMe, resp := th.Client.GetMe()
	require.NoError(t, resp.Error)
	require.NotNil(t, originalMe)

	// change password
	success, resp = th.Client.UserChangePassword(originalMe.ID, &model.ChangePasswordRequest{
		OldPassword: password,
		NewPassword: utils.NewID(utils.IDTypeNone),
	})
	require.NoError(t, resp.Error)
	require.True(t, success)
}

func randomBytes(t *testing.T, n int) []byte {
	bb := make([]byte, n)
	_, err := rand.Read(bb)
	require.NoError(t, err)
	return bb
}

func TestTeamUploadFile(t *testing.T) {
	t.Run("no permission", func(t *testing.T) { // native auth, but not login
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		teamID := "0"
		boardID := utils.NewID(utils.IDTypeBoard)
		data := randomBytes(t, 1024)
		result, resp := th.Client.TeamUploadFile(teamID, boardID, bytes.NewReader(data))
		require.Error(t, resp.Error)
		require.Nil(t, result)
	})

	t.Run("a board admin should be able to update a file", func(t *testing.T) { // single token auth
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		teamID := "0"
		newBoard := &model.Board{
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NotNil(t, board)

		data := randomBytes(t, 1024)
		result, resp := th.Client.TeamUploadFile(teamID, board.ID, bytes.NewReader(data))
		th.CheckOK(resp)
		require.NotNil(t, result)
		require.NotEmpty(t, result.FileID)
		// TODO get the uploaded file
	})

	t.Run("user that doesn't belong to the board should not be able to upload a file", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		teamID := "0"
		newBoard := &model.Board{
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NotNil(t, board)

		data := randomBytes(t, 1024)

		// a user that doesn't belong to the board tries to upload the file
		result, resp := th.Client2.TeamUploadFile(teamID, board.ID, bytes.NewReader(data))
		th.CheckForbidden(resp)
		require.Nil(t, result)
	})
}
