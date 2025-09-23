// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestContentFlaggingEnabledForTeam(t *testing.T) {
	getBaseConfig := func() *model.Config {
		contentFlaggingSettings := model.ContentFlaggingSettings{}
		contentFlaggingSettings.SetDefaults()

		return &model.Config{
			ContentFlaggingSettings: contentFlaggingSettings,
		}
	}
	t.Run("should return true for common reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
		config.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{"reviewer_user_id_1", "reviewer_user_id_2"}

		status := ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status, "expected team post reporting feature to be enabled for common reviewers")
	})

	t.Run("should return true when configured for specified team", func(t *testing.T) {
		config := getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
			"team1": {
				Enabled:     model.NewPointer(true),
				ReviewerIds: model.NewPointer([]string{"reviewer_user_id_1"}),
			},
		}

		status := ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status, "expected team post reporting feature to be disabled for team without reviewers")
	})

	t.Run("should return true when using Additional Reviewers", func(t *testing.T) {
		config := getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
		config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		config.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
			"team1": {
				Enabled: model.NewPointer(true),
			},
		}

		status := ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status)

		config = getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
		config.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)

		status = ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status)

		config = getBaseConfig()
		config.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
		config.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)

		status = ContentFlaggingEnabledForTeam(config, "team1")
		require.True(t, status)
	})
}
