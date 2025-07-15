// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func setupContentFlagging(tb testing.TB) *TestHelper {
	return SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ContentFlaggingSettings.EnableContentFlagging = true
		cfg.FeatureFlags.ContentFlagging = true
		cfg.ContentFlaggingSettings.SetDefaults()
	})
}

func TestGetTeamPostReportingFeatureStatus(t *testing.T) {
	t.Run("should return true for common reviewers", func(t *testing.T) {
		th := setupContentFlagging(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(true)
			cfg.ContentFlaggingSettings.ReviewerSettings.CommonReviewerIds = &[]string{"reviewer_user_id_1", "reviewer_user_id_2"}
		})

		status := th.App.GetTeamPostFlaggingFeatureStatus("team1")
		require.True(t, status, "expected team post reporting feature to be enabled for common reviewers")

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = nil
		})
	})

	t.Run("should return true when configured for specified team", func(t *testing.T) {
		th := setupContentFlagging(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			cfg.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				"team1": {
					Enabled:     model.NewPointer(true),
					ReviewerIds: model.NewPointer([]string{"reviewer_user_id_1"}),
				},
			}
		})

		status := th.App.GetTeamPostFlaggingFeatureStatus("team1")
		require.True(t, status, "expected team post reporting feature to be disabled for team without reviewers")
	})

	t.Run("should return true when using Additional Reviewers", func(t *testing.T) {
		th := setupContentFlagging(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.ReviewerSettings.CommonReviewers = model.NewPointer(false)
			cfg.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
			cfg.ContentFlaggingSettings.ReviewerSettings.TeamReviewersSetting = &map[string]model.TeamReviewerSetting{
				"team1": {
					Enabled: model.NewPointer(true),
				},
			}
		})

		status := th.App.GetTeamPostFlaggingFeatureStatus("team1")
		require.True(t, status)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
			cfg.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		status = th.App.GetTeamPostFlaggingFeatureStatus("team1")
		require.True(t, status)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
			cfg.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		status = th.App.GetTeamPostFlaggingFeatureStatus("team1")
		require.True(t, status)
	})
}
