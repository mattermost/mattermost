// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
	"testing"
)

func setupContentFlagging(tb testing.TB) *TestHelper {
	return SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ContentFlaggingSettings.EnableContentFlagging = true
		cfg.FeatureFlags.ContentFlagging = true
		cfg.ContentFlaggingSettings.SetDefaults()
	})
}

func TestGetReportingConfiguration(t *testing.T) {
	t.Run("default config", func(t *testing.T) {
		th := setupContentFlagging(t)
		defer th.TearDown()

		config := th.App.GetReportingConfiguration()
		if config == nil {
			t.Fatal("expected non-nil reporting configuration")
		}

		if len(*config.Reasons) == 0 {
			t.Error("expected non-empty reasons in reporting configuration")
		}

		if !*config.ReporterCommentRequired {
			t.Error("expected reporter comment to be required by default")
		}
	})

	t.Run("should return set config", func(t *testing.T) {
		th := setupContentFlagging(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.AdditionalSettings.Reasons = &[]string{"Spam", "Abuse"}
			cfg.ContentFlaggingSettings.AdditionalSettings.ReporterCommentRequired = model.NewPointer(false)
		})

		config := th.App.GetReportingConfiguration()
		if config == nil {
			t.Fatal("expected non-nil reporting configuration")
		}

		if len(*config.Reasons) != 2 || (*config.Reasons)[0] != "Spam" || (*config.Reasons)[1] != "Abuse" {
			t.Error("expected reasons to be set to ['Spam', 'Abuse']")
		}

		if *config.ReporterCommentRequired {
			t.Error("expected reporter comment to not be required")
		}

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.AdditionalSettings.Reasons = nil
			cfg.ContentFlaggingSettings.AdditionalSettings.ReporterCommentRequired = nil
		})
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

		status := th.App.GetTeamPostReportingFeatureStatus("team1")
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

		status := th.App.GetTeamPostReportingFeatureStatus("team1")
		require.True(t, status, "expected team post reporting feature to be disabled for team without reviewers")
	})

	t.Run("should return true when using additional reviewers", func(t *testing.T) {
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

		status := th.App.GetTeamPostReportingFeatureStatus("team1")
		require.True(t, status)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(false)
			cfg.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		status = th.App.GetTeamPostReportingFeatureStatus("team1")
		require.True(t, status)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ContentFlaggingSettings.ReviewerSettings.TeamAdminsAsReviewers = model.NewPointer(true)
			cfg.ContentFlaggingSettings.ReviewerSettings.SystemAdminsAsReviewers = model.NewPointer(true)
		})

		status = th.App.GetTeamPostReportingFeatureStatus("team1")
		require.True(t, status)
	})
}
