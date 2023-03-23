// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/utils/testutils"
)

func TestGetDraft(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GLOBALDRAFTS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GLOBALDRAFTS")
	os.Setenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS", "true")
	defer os.Unsetenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS")

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
		os.Setenv("MM_FEATUREFLAGS_GLOBALDRAFTS", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_GLOBALDRAFTS")
		os.Setenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS")

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.GetDraft(user.Id, channel.Id, "")
		assert.NotNil(t, err)
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
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00002,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft2",
	}

	_, createDraftErr := th.App.CreateDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr)

	t.Run("upsert draft", func(t *testing.T) {
		draftResp, err := th.App.UpsertDraft(th.Context, draft2, "")
		assert.Nil(t, err)

		assert.Equal(t, draft2.Message, draftResp.Message)
		assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)
		assert.Equal(t, draft2.CreateAt, draftResp.CreateAt)

		assert.NotEqual(t, draft1.UpdateAt, draftResp.UpdateAt)
	})

	t.Run("upsert draft feature flag", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_GLOBALDRAFTS", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_GLOBALDRAFTS")
		os.Setenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS")

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.UpsertDraft(th.Context, draft1, "")
		assert.NotNil(t, err)
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
		draftResp, err := th.App.CreateDraft(th.Context, draft1, "")
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

		draftResp, err := th.App.CreateDraft(th.Context, draftWithFiles, "")
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)
	})

	t.Run("create draft feature flag", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_GLOBALDRAFTS", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_GLOBALDRAFTS")
		os.Setenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS")

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.CreateDraft(th.Context, draft1, "")
		assert.NotNil(t, err)
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
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00002,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft2",
	}

	_, createDraftErr := th.App.CreateDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr)

	t.Run("update draft", func(t *testing.T) {
		draftResp, err := th.App.UpdateDraft(th.Context, draft2, "")
		assert.Nil(t, err)

		assert.Equal(t, draft2.Message, draftResp.Message)
		assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)

		assert.NotEqual(t, draft1.UpdateAt, draftResp.UpdateAt)
	})

	t.Run("update draft with files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp, uploadFileErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, uploadFileErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, err := th.App.UpdateDraft(th.Context, draft1, "")
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)
	})

	t.Run("create draft feature flag", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_GLOBALDRAFTS", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_GLOBALDRAFTS")
		os.Setenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS")

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.UpdateDraft(th.Context, draft1, "")
		assert.NotNil(t, err)
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
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UpdateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, createDraftErr1 := th.App.CreateDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr1)

	_, createDraftErr2 := th.App.CreateDraft(th.Context, draft2, "")
	assert.Nil(t, createDraftErr2)

	t.Run("get drafts", func(t *testing.T) {
		draftResp, err := th.App.GetDraftsForUser(user.Id, th.BasicTeam.Id)
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

		fileResp, updateDraftErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, updateDraftErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, updateDraftErr := th.App.UpdateDraft(th.Context, draft1, "")
		assert.Nil(t, updateDraftErr)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)

		draftsWithFilesResp, err := th.App.GetDraftsForUser(user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftsWithFilesResp[0].Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftsWithFilesResp[0].ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftsWithFilesResp[0].FileIds)

		assert.Equal(t, fileResp.Name, draftsWithFilesResp[0].Metadata.Files[0].Name)

		assert.Len(t, draftsWithFilesResp, 2)
	})

	t.Run("get drafts feature flag", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_GLOBALDRAFTS", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_GLOBALDRAFTS")
		os.Setenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS")

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.GetDraftsForUser(user.Id, th.BasicTeam.Id)
		assert.NotNil(t, err)
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
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	_, createDraftErr := th.App.CreateDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr)

	t.Run("delete draft", func(t *testing.T) {
		draftResp, err := th.App.DeleteDraft(user.Id, channel.Id, "", "")
		assert.Nil(t, err)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)
	})

	t.Run("get drafts feature flag", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_GLOBALDRAFTS", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_GLOBALDRAFTS")
		os.Setenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ALLOWSYNCEDDRAFTS")

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = false })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.GlobalDrafts = true })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.DeleteDraft(user.Id, channel.Id, "", "")
		assert.NotNil(t, err)
	})
}
