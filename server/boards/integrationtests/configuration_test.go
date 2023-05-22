// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"testing"

	"github.com/golang/mock/gomock"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/server"
	"github.com/mattermost/mattermost-server/server/v8/boards/ws"

	mockservicesapi "github.com/mattermost/mattermost-server/server/v8/boards/model/mocks"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"

	"github.com/stretchr/testify/assert"
)

func TestConfigurationNullConfiguration(t *testing.T) {
	th := SetupTestHelperPluginMode(t)
	defer th.TearDown()

	logger := mlog.CreateConsoleTestLogger(true, mlog.LvlError)
	boardsApp := server.NewBoardsServiceForTest(th.Server, &FakePluginAdapter{}, nil, logger)

	assert.NotNil(t, boardsApp.Config())
}

func TestOnConfigurationChange(t *testing.T) {
	stringRef := ""

	basePlugins := make(map[string]map[string]interface{})
	basePlugins[server.PluginName] = make(map[string]interface{})
	basePlugins[server.PluginName][server.SharedBoardsName] = true

	baseFeatureFlags := &mm_model.FeatureFlags{
		BoardsFeatureFlags: "Feature1-Feature2",
	}
	basePluginSettings := &mm_model.PluginSettings{
		Directory: &stringRef,
		Plugins:   basePlugins,
	}
	intRef := 365
	baseDataRetentionSettings := &mm_model.DataRetentionSettings{
		BoardsRetentionDays: &intRef,
	}
	usernameRef := "username"
	baseTeamSettings := &mm_model.TeamSettings{
		TeammateNameDisplay: &usernameRef,
	}

	falseRef := false
	basePrivacySettings := &mm_model.PrivacySettings{
		ShowEmailAddress: &falseRef,
		ShowFullName:     &falseRef,
	}

	baseConfig := &mm_model.Config{
		FeatureFlags:          baseFeatureFlags,
		PluginSettings:        *basePluginSettings,
		DataRetentionSettings: *baseDataRetentionSettings,
		TeamSettings:          *baseTeamSettings,
		PrivacySettings:       *basePrivacySettings,
	}

	t.Run("Test Load Plugin Success", func(t *testing.T) {
		th := SetupTestHelperPluginMode(t)
		defer th.TearDown()

		ctrl := gomock.NewController(t)
		api := mockservicesapi.NewMockServicesAPI(ctrl)
		api.EXPECT().GetConfig().Return(baseConfig)

		b := server.NewBoardsServiceForTest(th.Server, &FakePluginAdapter{}, api, mlog.CreateConsoleTestLogger(true, mlog.LvlError))

		err := b.OnConfigurationChange()
		assert.NoError(t, err)
		assert.Equal(t, 1, count)

		// make sure both App and Server got updated
		assert.True(t, b.Config().EnablePublicSharedBoards)
		assert.True(t, b.ClientConfig().EnablePublicSharedBoards)

		assert.Equal(t, "true", b.Config().FeatureFlags["Feature1"])
		assert.Equal(t, "true", b.Config().FeatureFlags["Feature2"])
		assert.Equal(t, "", b.Config().FeatureFlags["Feature3"])
	})
}

var count = 0

type FakePluginAdapter struct {
	ws.PluginAdapter
}

func (c *FakePluginAdapter) BroadcastConfigChange(clientConfig model.ClientConfig) {
	count++
}
