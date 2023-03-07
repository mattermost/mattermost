// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"bytes"
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"

	"github.com/stretchr/testify/require"
)

func TestUploadFile(t *testing.T) {
	const (
		testTeamID = "team-id"
	)

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		file, resp := th.Client.TeamUploadFile(testTeamID, "test-board-id", bytes.NewBuffer([]byte("test")))
		th.CheckUnauthorized(resp)
		require.Nil(t, file)
	})

	t.Run("upload a file to an existing team and board without permissions", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		file, resp := th.Client.TeamUploadFile(testTeamID, "not-valid-board", bytes.NewBuffer([]byte("test")))
		th.CheckForbidden(resp)
		require.Nil(t, file)
	})

	t.Run("upload a file to an existing team and board with permissions", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		testBoard := th.CreateBoard(testTeamID, model.BoardTypeOpen)
		file, resp := th.Client.TeamUploadFile(testTeamID, testBoard.ID, bytes.NewBuffer([]byte("test")))
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, file)
		require.NotNil(t, file.FileID)
	})

	t.Run("upload a file to an existing team and board with permissions but reaching the MaxFileLimit", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		testBoard := th.CreateBoard(testTeamID, model.BoardTypeOpen)

		config := th.Server.App().GetConfig()
		config.MaxFileSize = 1
		th.Server.App().SetConfig(config)

		file, resp := th.Client.TeamUploadFile(testTeamID, testBoard.ID, bytes.NewBuffer([]byte("test")))
		th.CheckRequestEntityTooLarge(resp)
		require.Nil(t, file)

		config.MaxFileSize = 100000
		th.Server.App().SetConfig(config)

		file, resp = th.Client.TeamUploadFile(testTeamID, testBoard.ID, bytes.NewBuffer([]byte("test")))
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, file)
		require.NotNil(t, file.FileID)
	})
}

func TestFileInfo(t *testing.T) {
	const (
		testTeamID = "team-id"
	)

	t.Run("Retrieving file info", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		testBoard := th.CreateBoard(testTeamID, model.BoardTypeOpen)

		fileInfo, resp := th.Client.TeamUploadFileInfo(testTeamID, testBoard.ID, "test")
		th.CheckOK(resp)
		require.NotNil(t, fileInfo)
		require.NotNil(t, fileInfo.Id)
	})
}
