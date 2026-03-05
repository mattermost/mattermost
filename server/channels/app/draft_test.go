// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestGetDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft",
	}

	_, upsertDraftErr := th.App.UpsertDraft(th.Context, draft, "")
	assert.Nil(t, upsertDraftErr)

	t.Run("get draft", func(t *testing.T) {
		draftResp, err := th.App.GetDraft(user.Id, channel.Id, "")
		assert.Nil(t, err)

		assert.Equal(t, draft.Message, draftResp.Message)
		assert.Equal(t, draft.ChannelId, draftResp.ChannelId)
	})

	t.Run("get draft feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.GetDraft(user.Id, channel.Id, "")
		assert.NotNil(t, err)
	})
}

func TestUpsertDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft := &model.Draft{
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft",
	}

	t.Run("upsert draft", func(t *testing.T) {
		_, err := th.App.UpsertDraft(th.Context, draft, "")
		assert.Nil(t, err)

		drafts, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)
		assert.Len(t, drafts, 1)
		draft1 := drafts[0]

		assert.Equal(t, "draft", draft1.Message)
		assert.Equal(t, channel.Id, draft1.ChannelId)
		assert.Greater(t, draft1.CreateAt, int64(0))

		draft = &model.Draft{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "updated draft",
		}
		_, err = th.App.UpsertDraft(th.Context, draft, "")
		assert.Nil(t, err)

		drafts, err = th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)
		assert.Len(t, drafts, 1)
		draft2 := drafts[0]

		assert.Equal(t, "updated draft", draft2.Message)
		assert.Equal(t, channel.Id, draft2.ChannelId)
		assert.Equal(t, draft1.CreateAt, draft2.CreateAt)
	})

	t.Run("upsert draft feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.UpsertDraft(th.Context, draft, "")
		assert.NotNil(t, err)
	})
}

func TestCreateDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel
	channel2 := th.CreateChannel(t, th.BasicTeam)
	th.AddUserToChannel(t, user, channel2)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft",
	}

	draft2 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	t.Run("create draft", func(t *testing.T) {
		draftResp, err := th.App.UpsertDraft(th.Context, draft1, "")
		assert.Nil(t, err)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)
	})

	t.Run("create draft with files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp, uploadFileErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, uploadFileErr)

		draftWithFiles := draft2
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, err := th.App.UpsertDraft(th.Context, draftWithFiles, "")
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)
	})
}

func TestUpdateDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft1 := &model.Draft{
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	_, createDraftErr := th.App.UpsertDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr)

	t.Run("update draft with files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp, uploadFileErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, uploadFileErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp.Id}

		_, err := th.App.UpsertDraft(th.Context, draft1, "")
		assert.Nil(t, err)

		drafts, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		draftResp := drafts[0]
		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)
	})

	t.Run("cannot upsert draft in restricted DM", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageTeam
		})

		// Create a DM channel between two users who don't share a team
		dmChannel := th.CreateDmChannel(t, th.BasicUser2)

		// Ensure the two users do not share a team
		teams, err := th.App.GetTeamsForUser(th.BasicUser.Id)
		require.Nil(t, err)
		for _, team := range teams {
			teamErr := th.App.RemoveUserFromTeam(th.Context, team.Id, th.BasicUser.Id, th.SystemAdminUser.Id)
			require.Nil(t, teamErr)
		}
		teams, err = th.App.GetTeamsForUser(th.BasicUser2.Id)
		require.Nil(t, err)
		for _, team := range teams {
			teamErr := th.App.RemoveUserFromTeam(th.Context, team.Id, th.BasicUser2.Id, th.SystemAdminUser.Id)
			require.Nil(t, teamErr)
		}

		// Create separate teams for each user
		team1 := th.CreateTeam(t)
		team2 := th.CreateTeam(t)
		th.LinkUserToTeam(t, th.BasicUser, team1)
		th.LinkUserToTeam(t, th.BasicUser2, team2)

		draft := &model.Draft{
			CreateAt:  00001,
			UpdateAt:  00001,
			UserId:    th.BasicUser.Id,
			ChannelId: dmChannel.Id,
			Message:   "draft message",
		}

		_, err = th.App.UpsertDraft(th.Context, draft, "")
		require.NotNil(t, err)
		require.Equal(t, "api.draft.create_draft.can_not_draft_to_restricted_dm.error", err.Id)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)

		// Reset config
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageAny
		})
	})
}

func TestGetDraftsForUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel
	channel2 := th.CreateChannel(t, th.BasicTeam)
	th.AddUserToChannel(t, user, channel2)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, createDraftErr1 := th.App.UpsertDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr1)

	// Wait a bit so the second draft gets a newer UpdateAt
	time.Sleep(100 * time.Millisecond)

	_, createDraftErr2 := th.App.UpsertDraft(th.Context, draft2, "")
	assert.Nil(t, createDraftErr2)

	t.Run("get drafts", func(t *testing.T) {
		draftResp, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		assert.Equal(t, draft2.Message, draftResp[0].Message)
		assert.Equal(t, draft2.ChannelId, draftResp[0].ChannelId)

		assert.Equal(t, draft1.Message, draftResp[1].Message)
		assert.Equal(t, draft1.ChannelId, draftResp[1].ChannelId)
	})

	t.Run("get drafts with files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp, updateDraftErr := th.App.UploadFileForUserAndTeam(th.Context, sent, channel.Id, "test.png", user.Id, "")
		assert.Nil(t, updateDraftErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, updateDraftErr := th.App.UpsertDraft(th.Context, draft1, "")
		assert.Nil(t, updateDraftErr)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)

		draftsWithFilesResp, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftsWithFilesResp[0].Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftsWithFilesResp[0].ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftsWithFilesResp[0].FileIds)

		assert.Len(t, draftsWithFilesResp[0].Metadata.Files, 1)
		assert.Equal(t, fileResp.Name, draftsWithFilesResp[0].Metadata.Files[0].Name)

		assert.Len(t, draftsWithFilesResp, 2)
	})

	t.Run("get draft with invalid files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp1, updateDraftErr := th.App.UploadFileForUserAndTeam(th.Context, sent, channel.Id, "test1.png", user.Id, "")
		assert.Nil(t, updateDraftErr)

		fileResp2, updateDraftErr := th.App.UploadFileForUserAndTeam(th.Context, sent, channel.Id, "test2.png", th.BasicUser2.Id, "")
		assert.Nil(t, updateDraftErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp1.Id, fileResp2.Id}

		draftResp, updateDraftErr := th.App.UpsertDraft(th.Context, draft1, "")
		assert.Nil(t, updateDraftErr)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)

		assert.Len(t, draftWithFiles.Metadata.Files, 1)
		assert.Equal(t, fileResp1.Name, draftWithFiles.Metadata.Files[0].Name)

		draftsWithFilesResp, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftsWithFilesResp[0].Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftsWithFilesResp[0].ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftsWithFilesResp[0].FileIds)

		assert.Len(t, draftsWithFilesResp[0].Metadata.Files, 1)
		assert.Equal(t, fileResp1.Name, draftsWithFilesResp[0].Metadata.Files[0].Name)
	})

	t.Run("get drafts feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.NotNil(t, err)
	})
}

func TestDeleteDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	_, createDraftErr := th.App.UpsertDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr)

	t.Run("delete draft", func(t *testing.T) {
		err := th.App.DeleteDraft(th.Context, draft1, "")
		assert.Nil(t, err)
	})

	t.Run("delete drafts feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		err := th.App.DeleteDraft(th.Context, draft1, "")
		assert.NotNil(t, err)
	})
}
