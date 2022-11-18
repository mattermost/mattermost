// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils/testutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetDraft(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft",
	}

	_, appErr := th.App.UpsertDraft(th.Context, draft, "")
	assert.Nil(t, appErr)

	t.Run("get draft", func(t *testing.T) {
		draftResp, appErr := th.App.GetDraft(user.Id, channel.Id, "")
		assert.Nil(t, appErr)

		assert.Equal(t, draft.Message, draftResp.Message)
		assert.Equal(t, draft.ChannelId, draftResp.ChannelId)
	})

	t.Run("get draft feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, appErr = th.App.GetDraft(user.Id, channel.Id, "")
		assert.NotNil(t, appErr)
	})
}

func TestUpsertDraft(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00002,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft2",
	}

	_, appErr := th.App.CreateDraft(th.Context, draft1, "")
	assert.Nil(t, appErr)

	t.Run("upsert draft", func(t *testing.T) {
		draftResp, appErr := th.App.UpsertDraft(th.Context, draft2, "")
		assert.Nil(t, appErr)

		assert.Equal(t, draft2.Message, draftResp.Message)
		assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)
		assert.Equal(t, draft2.CreateAt, draftResp.CreateAt)
		assert.Equal(t, draft2.CreateAt, draftResp.CreateAt)

		assert.NotEqual(t, draft1.UpdateAt, draftResp.UpdateAt)
	})

	t.Run("upsert draft feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, appErr := th.App.UpsertDraft(th.Context, draft1, "")
		assert.NotNil(t, appErr)
	})
}

func TestCreateDraft(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(user, channel2)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft",
	}

	draft2 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	t.Run("create draft", func(t *testing.T) {
		draftResp, appErr := th.App.CreateDraft(th.Context, draft1, "")
		assert.Nil(t, appErr)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)
	})

	t.Run("create draft with files", func(t *testing.T) {
		// upload file
		sent, err := testutils.ReadTestFile("test.png")
		require.NoError(t, err)

		fileResp, appErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, appErr)

		draftWithFiles := draft2
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, appErr := th.App.CreateDraft(th.Context, draftWithFiles, "")
		assert.Nil(t, appErr)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)
	})

	t.Run("create draft feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, appErr := th.App.CreateDraft(th.Context, draft1, "")
		assert.NotNil(t, appErr)
	})
}

func TestUpdateDraft(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00002,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft2",
	}

	_, appErr := th.App.CreateDraft(th.Context, draft1, "")
	assert.Nil(t, appErr)

	t.Run("update draft", func(t *testing.T) {
		draftResp, appErr := th.App.UpdateDraft(th.Context, draft2, "")
		assert.Nil(t, appErr)

		assert.Equal(t, draft2.Message, draftResp.Message)
		assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)

		assert.NotEqual(t, draft1.UpdateAt, draftResp.UpdateAt)
	})

	t.Run("update draft with files", func(t *testing.T) {
		// upload file
		sent, err := testutils.ReadTestFile("test.png")
		require.NoError(t, err)

		fileResp, appErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, appErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, appErr := th.App.UpdateDraft(th.Context, draft1, "")
		assert.Nil(t, appErr)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)
	})

	t.Run("create draft feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, appErr := th.App.UpdateDraft(th.Context, draft1, "")
		assert.NotNil(t, appErr)
	})
}

func TestGetDraftsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(user, channel2)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UpdateAt:  00005,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, appErr := th.App.CreateDraft(th.Context, draft1, "")
	assert.Nil(t, appErr)

	_, appErr = th.App.CreateDraft(th.Context, draft2, "")
	assert.Nil(t, appErr)

	t.Run("get drafts", func(t *testing.T) {
		draftResp, appErr := th.App.GetDraftsForUser(user.Id, th.BasicTeam.Id)
		assert.Nil(t, appErr)

		assert.Equal(t, draft2.Message, draftResp[0].Message)
		assert.Equal(t, draft2.ChannelId, draftResp[0].ChannelId)

		assert.Equal(t, draft1.Message, draftResp[1].Message)
		assert.Equal(t, draft1.ChannelId, draftResp[1].ChannelId)
	})

	t.Run("get drafts with files", func(t *testing.T) {
		// upload file
		sent, err := testutils.ReadTestFile("test.png")
		require.NoError(t, err)

		fileResp, appErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, appErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, appErr := th.App.UpdateDraft(th.Context, draft1, "")
		assert.Nil(t, appErr)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)

		draftsWithFilesResp, appErr := th.App.GetDraftsForUser(user.Id, th.BasicTeam.Id)
		assert.Nil(t, appErr)

		assert.Equal(t, draftWithFiles.Message, draftsWithFilesResp[0].Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftsWithFilesResp[0].ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftsWithFilesResp[0].FileIds)

		assert.Equal(t, fileResp.Name, draftsWithFilesResp[0].Metadata.Files[0].Name)

		assert.Len(t, draftsWithFilesResp, 2)
	})

	t.Run("get drafts feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, appErr := th.App.GetDraftsForUser(user.Id, th.BasicTeam.Id)
		assert.NotNil(t, appErr)
	})
}

func TestDeleteDraft(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		DeleteAt:  0,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	_, appErr := th.App.CreateDraft(th.Context, draft1, "")
	assert.Nil(t, appErr)

	t.Run("delete draft", func(t *testing.T) {
		draftResp, appErr := th.App.DeleteDraft(user.Id, channel.Id, "", "")
		assert.Nil(t, appErr)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

		draftResp, appErr = th.App.GetDraft(user.Id, channel.Id, "")
		assert.Nil(t, appErr)
		assert.NotEqual(t, draft1.DeleteAt, draftResp.DeleteAt)
	})

	t.Run("get drafts feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, appErr := th.App.DeleteDraft(user.Id, channel.Id, "", "")
		assert.NotNil(t, appErr)
	})
}
