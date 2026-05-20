// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestContentFlaggingStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveReviewerSettings", func(t *testing.T) { testSaveReviewerSettings(t, rctx, ss, s) })
	t.Run("GetReviewerSettings", func(t *testing.T) { testGetReviewerSettings(t, rctx, ss, s) })
	t.Run("SaveAndGetReviewerSettings", func(t *testing.T) { testSaveAndGetReviewerSettings(t, rctx, ss, s) })
}

func testSaveReviewerSettings(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("save empty settings", func(t *testing.T) {
		ss.ContentFlagging().ClearCaches()

		commonReviewers := []string{}
		teamSettings := map[string]*model.TeamReviewerSetting{}

		reviewerSettings := model.ReviewerIDsSettings{
			CommonReviewerIds:    commonReviewers,
			TeamReviewersSetting: teamSettings,
		}

		err := ss.ContentFlagging().SaveReviewerSettings(reviewerSettings)
		assert.NoError(t, err)

		// Verify settings were saved (should be empty)
		settings, err := ss.ContentFlagging().GetReviewerSettings()
		assert.NoError(t, err)
		assert.Equal(t, 0, len(settings.CommonReviewerIds))
		assert.Equal(t, 0, len(settings.TeamReviewersSetting))
	})

	t.Run("save common reviewers only", func(t *testing.T) {
		ss.ContentFlagging().ClearCaches()

		userId1 := model.NewId()
		userId2 := model.NewId()
		commonReviewers := []string{userId1, userId2}
		teamSettings := map[string]*model.TeamReviewerSetting{}

		reviewerSettings := model.ReviewerIDsSettings{
			CommonReviewerIds:    commonReviewers,
			TeamReviewersSetting: teamSettings,
		}

		err := ss.ContentFlagging().SaveReviewerSettings(reviewerSettings)
		assert.NoError(t, err)

		// Verify settings were saved
		settings, err := ss.ContentFlagging().GetReviewerSettings()
		assert.NoError(t, err)
		assert.NotNil(t, settings.CommonReviewerIds)
		assert.Equal(t, 2, len(settings.CommonReviewerIds))
		assert.Contains(t, settings.CommonReviewerIds, userId1)
		assert.Contains(t, settings.CommonReviewerIds, userId2)
	})

	t.Run("save team settings only", func(t *testing.T) {
		ss.ContentFlagging().ClearCaches()

		teamId1 := model.NewId()
		teamId2 := model.NewId()
		enabled1 := true
		enabled2 := false

		commonReviewers := []string{}
		teamSettings := map[string]*model.TeamReviewerSetting{
			teamId1: {
				Enabled:     &enabled1,
				ReviewerIds: []string{},
			},
			teamId2: {
				Enabled:     &enabled2,
				ReviewerIds: []string{},
			},
		}

		reviewerSettings := model.ReviewerIDsSettings{
			CommonReviewerIds:    commonReviewers,
			TeamReviewersSetting: teamSettings,
		}

		err := ss.ContentFlagging().SaveReviewerSettings(reviewerSettings)
		assert.NoError(t, err)

		// Verify settings were saved
		settings, err := ss.ContentFlagging().GetReviewerSettings()
		assert.NoError(t, err)
		assert.NotNil(t, settings.TeamReviewersSetting)
		assert.Equal(t, 2, len(settings.TeamReviewersSetting))

		teamSetting1, exists := (settings.TeamReviewersSetting)[teamId1]
		assert.True(t, exists)
		assert.NotNil(t, teamSetting1.Enabled)
		assert.True(t, *teamSetting1.Enabled)

		teamSetting2, exists := (settings.TeamReviewersSetting)[teamId2]
		assert.True(t, exists)
		assert.NotNil(t, teamSetting2.Enabled)
		assert.False(t, *teamSetting2.Enabled)
	})

	t.Run("save team reviewers", func(t *testing.T) {
		ss.ContentFlagging().ClearCaches()

		teamId := model.NewId()
		userId1 := model.NewId()
		userId2 := model.NewId()
		enabled := true

		commonReviewers := []string{}
		teamSettings := map[string]*model.TeamReviewerSetting{
			teamId: {
				Enabled:     &enabled,
				ReviewerIds: []string{userId1, userId2},
			},
		}

		reviewerSettings := model.ReviewerIDsSettings{
			CommonReviewerIds:    commonReviewers,
			TeamReviewersSetting: teamSettings,
		}

		err := ss.ContentFlagging().SaveReviewerSettings(reviewerSettings)
		assert.NoError(t, err)

		// Verify settings were saved
		settings, err := ss.ContentFlagging().GetReviewerSettings()
		assert.NoError(t, err)
		assert.NotNil(t, settings.TeamReviewersSetting)

		teamSetting, exists := settings.TeamReviewersSetting[teamId]
		assert.True(t, exists)
		assert.NotNil(t, teamSetting.ReviewerIds)
		assert.Equal(t, 2, len(teamSetting.ReviewerIds))
		assert.Contains(t, teamSetting.ReviewerIds, userId1)
		assert.Contains(t, teamSetting.ReviewerIds, userId2)
	})

	t.Run("update existing settings", func(t *testing.T) {
		ss.ContentFlagging().ClearCaches()

		// First save some initial settings
		userId1 := model.NewId()
		teamId1 := model.NewId()
		enabled1 := true

		commonReviewers := []string{userId1}
		teamSettings := map[string]*model.TeamReviewerSetting{
			teamId1: {
				Enabled:     &enabled1,
				ReviewerIds: []string{userId1},
			},
		}

		reviewerSettings := model.ReviewerIDsSettings{
			CommonReviewerIds:    commonReviewers,
			TeamReviewersSetting: teamSettings,
		}

		err := ss.ContentFlagging().SaveReviewerSettings(reviewerSettings)
		assert.NoError(t, err)

		// Now update with different settings
		userId2 := model.NewId()
		userId3 := model.NewId()
		teamId2 := model.NewId()
		enabled2 := false

		newCommonReviewers := []string{userId2, userId3}
		newTeamSettings := map[string]*model.TeamReviewerSetting{
			teamId2: {
				Enabled:     &enabled2,
				ReviewerIds: []string{userId2},
			},
		}

		newReviewerSettings := model.ReviewerIDsSettings{
			CommonReviewerIds:    newCommonReviewers,
			TeamReviewersSetting: newTeamSettings,
		}

		err = ss.ContentFlagging().SaveReviewerSettings(newReviewerSettings)
		assert.NoError(t, err)

		// Verify old settings were replaced
		settings, err := ss.ContentFlagging().GetReviewerSettings()
		assert.NoError(t, err)

		// Common reviewers should be updated
		assert.NotNil(t, settings.CommonReviewerIds)
		assert.Equal(t, 2, len(settings.CommonReviewerIds))
		assert.Contains(t, settings.CommonReviewerIds, userId2)
		assert.Contains(t, settings.CommonReviewerIds, userId3)
		assert.NotContains(t, settings.CommonReviewerIds, userId1)

		// Team settings should be updated
		assert.NotNil(t, settings.TeamReviewersSetting)
		assert.Equal(t, 1, len(settings.TeamReviewersSetting))

		_, exists := (settings.TeamReviewersSetting)[teamId1]
		assert.False(t, exists) // Old team should be gone

		teamSetting2, exists := (settings.TeamReviewersSetting)[teamId2]
		assert.True(t, exists)
		assert.NotNil(t, teamSetting2.Enabled)
		assert.False(t, *teamSetting2.Enabled)
	})
}

func testGetReviewerSettings(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("get empty settings", func(t *testing.T) {
		ss.ContentFlagging().ClearCaches()

		// Clear any existing settings first
		emptyCommonReviewers := []string{}
		emptyTeamSettings := map[string]*model.TeamReviewerSetting{}

		reviewerSettings := model.ReviewerIDsSettings{
			CommonReviewerIds:    emptyCommonReviewers,
			TeamReviewersSetting: emptyTeamSettings,
		}

		err := ss.ContentFlagging().SaveReviewerSettings(reviewerSettings)
		assert.NoError(t, err)

		settings, err := ss.ContentFlagging().GetReviewerSettings()
		assert.NoError(t, err)
		assert.NotNil(t, settings)
		assert.Equal(t, 0, len(settings.CommonReviewerIds))
		assert.Equal(t, 0, len(settings.TeamReviewersSetting))
	})
}

func testSaveAndGetReviewerSettings(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("comprehensive save and get", func(t *testing.T) {
		ss.ContentFlagging().ClearCaches()

		// Create comprehensive test data
		commonUserId1 := model.NewId()
		commonUserId2 := model.NewId()
		commonUserId3 := model.NewId()

		teamId1 := model.NewId()
		teamId2 := model.NewId()
		teamId3 := model.NewId()

		teamUserId1 := model.NewId()
		teamUserId2 := model.NewId()
		teamUserId3 := model.NewId()

		enabled1 := true
		enabled2 := false
		enabled3 := true

		commonReviewers := []string{commonUserId1, commonUserId2, commonUserId3}
		teamSettings := map[string]*model.TeamReviewerSetting{
			teamId1: {
				Enabled:     &enabled1,
				ReviewerIds: []string{teamUserId1, teamUserId2},
			},
			teamId2: {
				Enabled:     &enabled2,
				ReviewerIds: []string{teamUserId3},
			},
			teamId3: {
				Enabled:     &enabled3,
				ReviewerIds: []string{}, // Empty reviewers list
			},
		}

		reviewerSettings := model.ReviewerIDsSettings{
			CommonReviewerIds:    commonReviewers,
			TeamReviewersSetting: teamSettings,
		}

		// Save the settings
		err := ss.ContentFlagging().SaveReviewerSettings(reviewerSettings)
		assert.NoError(t, err)

		// Get the settings back
		retrievedSettings, err := ss.ContentFlagging().GetReviewerSettings()
		assert.NoError(t, err)
		require.NotNil(t, retrievedSettings)

		// Verify common reviewers
		assert.NotNil(t, retrievedSettings.CommonReviewerIds)
		assert.Equal(t, 3, len(retrievedSettings.CommonReviewerIds))
		assert.Contains(t, retrievedSettings.CommonReviewerIds, commonUserId1)
		assert.Contains(t, retrievedSettings.CommonReviewerIds, commonUserId2)
		assert.Contains(t, retrievedSettings.CommonReviewerIds, commonUserId3)

		// Verify team settings
		assert.NotNil(t, retrievedSettings.TeamReviewersSetting)
		assert.Equal(t, 3, len(retrievedSettings.TeamReviewersSetting))

		// Verify team 1
		team1Setting, exists := (retrievedSettings.TeamReviewersSetting)[teamId1]
		assert.True(t, exists)
		assert.NotNil(t, team1Setting.Enabled)
		assert.True(t, *team1Setting.Enabled)
		assert.NotNil(t, team1Setting.ReviewerIds)
		assert.Equal(t, 2, len(team1Setting.ReviewerIds))
		assert.Contains(t, team1Setting.ReviewerIds, teamUserId1)
		assert.Contains(t, team1Setting.ReviewerIds, teamUserId2)

		// Verify team 2
		team2Setting, exists := (retrievedSettings.TeamReviewersSetting)[teamId2]
		assert.True(t, exists)
		assert.NotNil(t, team2Setting.Enabled)
		assert.False(t, *team2Setting.Enabled)
		assert.NotNil(t, team2Setting.ReviewerIds)
		assert.Equal(t, 1, len(team2Setting.ReviewerIds))
		assert.Contains(t, team2Setting.ReviewerIds, teamUserId3)

		// Verify team 3
		team3Setting, exists := (retrievedSettings.TeamReviewersSetting)[teamId3]
		assert.True(t, exists)
		assert.NotNil(t, team3Setting.Enabled)
		assert.True(t, *team3Setting.Enabled)
		assert.NotNil(t, team3Setting.ReviewerIds)
		assert.Equal(t, 0, len(team3Setting.ReviewerIds))
	})
}
