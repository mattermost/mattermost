package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestContentFlaggingNotificationSettings_SetDefault(t *testing.T) {
	t.Run("should set default event target mappings", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{}
		settings.SetDefault()

		assert.NotNil(t, settings.EventTargetMapping)
		assert.Equal(t, []NotificationTarget{TargetReviewers}, settings.EventTargetMapping[EventFlagged])
		assert.Equal(t, []NotificationTarget{TargetReviewers}, settings.EventTargetMapping[EventAssigned])
		assert.Equal(t, []NotificationTarget{TargetReviewers, TargetAuthor, TargetReporter}, settings.EventTargetMapping[EventContentRemoved])
		assert.Equal(t, []NotificationTarget{TargetReviewers, TargetReporter}, settings.EventTargetMapping[EventContentDismissed])
	})

	t.Run("should not override existing mappings", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				EventFlagged: {TargetAuthor},
			},
		}
		settings.SetDefault()

		assert.Equal(t, []NotificationTarget{TargetAuthor}, settings.EventTargetMapping[EventFlagged])
		assert.Equal(t, []NotificationTarget{TargetReviewers}, settings.EventTargetMapping[EventAssigned])
	})
}

func TestContentFlaggingNotificationSettings_IsValid(t *testing.T) {
	t.Run("should be valid when reviewers are notified for flagged events", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				EventFlagged: {TargetReviewers, TargetAuthor},
			},
		}

		err := settings.IsValid()
		assert.Nil(t, err)
	})

	t.Run("should be invalid when no targets for flagged events", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				EventFlagged: {},
			},
		}

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", err.Id)
	})

	t.Run("should be invalid when flagged event mapping is nil", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{},
		}

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", err.Id)
	})

	t.Run("should be invalid when reviewers not included in flagged event targets", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				EventFlagged: {TargetAuthor, TargetReporter},
			},
		}

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", err.Id)
	})
}

func TestReviewerSettings_SetDefault(t *testing.T) {
	t.Run("should set all default values", func(t *testing.T) {
		settings := &ReviewerSettings{}
		settings.SetDefault()

		assert.NotNil(t, settings.CommonReviewers)
		assert.True(t, *settings.CommonReviewers)
		assert.NotNil(t, settings.CommonReviewerIds)
		assert.Empty(t, *settings.CommonReviewerIds)
		assert.NotNil(t, settings.TeamReviewersSetting)
		assert.Empty(t, *settings.TeamReviewersSetting)
		assert.NotNil(t, settings.SystemAdminsAsReviewers)
		assert.False(t, *settings.SystemAdminsAsReviewers)
		assert.NotNil(t, settings.TeamAdminsAsReviewers)
		assert.True(t, *settings.TeamAdminsAsReviewers)
	})

	t.Run("should not override existing values", func(t *testing.T) {
		commonReviewers := false
		settings := &ReviewerSettings{
			CommonReviewers: &commonReviewers,
		}
		settings.SetDefault()

		assert.False(t, *settings.CommonReviewers)
	})
}

func TestReviewerSettings_IsValid(t *testing.T) {
	t.Run("should be valid when common reviewers enabled with reviewer IDs", func(t *testing.T) {
		settings := &ReviewerSettings{
			CommonReviewers:         NewPointer(true),
			CommonReviewerIds:       &[]string{"user1", "user2"},
			TeamReviewersSetting:    &map[string]TeamReviewerSetting{},
			SystemAdminsAsReviewers: NewPointer(false),
			TeamAdminsAsReviewers:   NewPointer(false),
		}

		err := settings.IsValid()
		assert.Nil(t, err)
	})

	t.Run("should be valid when common reviewers enabled with additional reviewers", func(t *testing.T) {
		settings := &ReviewerSettings{
			CommonReviewers:         NewPointer(true),
			CommonReviewerIds:       &[]string{},
			TeamReviewersSetting:    &map[string]TeamReviewerSetting{},
			SystemAdminsAsReviewers: NewPointer(true),
			TeamAdminsAsReviewers:   NewPointer(false),
		}

		err := settings.IsValid()
		assert.Nil(t, err)
	})

	t.Run("should be invalid when common reviewers enabled but no reviewers specified", func(t *testing.T) {
		settings := &ReviewerSettings{
			CommonReviewers:         NewPointer(true),
			CommonReviewerIds:       &[]string{},
			TeamReviewersSetting:    &map[string]TeamReviewerSetting{},
			SystemAdminsAsReviewers: NewPointer(false),
			TeamAdminsAsReviewers:   NewPointer(false),
		}

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.content_flagging.common_reviewers_not_set.app_error", err.Id)
	})

	t.Run("should be valid when team reviewers enabled with reviewer IDs", func(t *testing.T) {
		settings := &ReviewerSettings{
			CommonReviewers:   NewPointer(false),
			CommonReviewerIds: &[]string{},
			TeamReviewersSetting: &map[string]TeamReviewerSetting{
				"team1": {
					Enabled:     NewPointer(true),
					ReviewerIds: &[]string{"user1"},
				},
			},
			SystemAdminsAsReviewers: NewPointer(false),
			TeamAdminsAsReviewers:   NewPointer(false),
		}

		err := settings.IsValid()
		assert.Nil(t, err)
	})

	t.Run("should be invalid when team reviewers enabled but no reviewer IDs", func(t *testing.T) {
		settings := &ReviewerSettings{
			CommonReviewers:   NewPointer(false),
			CommonReviewerIds: &[]string{},
			TeamReviewersSetting: &map[string]TeamReviewerSetting{
				"team1": {
					Enabled:     NewPointer(true),
					ReviewerIds: &[]string{},
				},
			},
			SystemAdminsAsReviewers: NewPointer(false),
			TeamAdminsAsReviewers:   NewPointer(false),
		}

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.content_flagging.team_reviewers_not_set.app_error", err.Id)
	})

	t.Run("should be valid when team reviewers enabled but no reviewer IDs with additional reviewers", func(t *testing.T) {
		settings := &ReviewerSettings{
			CommonReviewers:   NewPointer(false),
			CommonReviewerIds: &[]string{},
			TeamReviewersSetting: &map[string]TeamReviewerSetting{
				"team1": {
					Enabled:     NewPointer(true),
					ReviewerIds: &[]string{},
				},
			},
			SystemAdminsAsReviewers: NewPointer(true),
			TeamAdminsAsReviewers:   NewPointer(false),
		}

		err := settings.IsValid()
		assert.Nil(t, err)
	})
}

func TestAdditionalContentFlaggingSettings_SetDefault(t *testing.T) {
	t.Run("should set all default values", func(t *testing.T) {
		settings := &AdditionalContentFlaggingSettings{}
		settings.SetDefault()

		assert.NotNil(t, settings.Reasons)
		expectedReasons := []string{
			"Inappropriate content",
			"Sensitive data",
			"Security concern",
			"Harassment or abuse",
			"Spam or phishing",
		}
		assert.Equal(t, expectedReasons, *settings.Reasons)
		assert.NotNil(t, settings.ReporterCommentRequired)
		assert.True(t, *settings.ReporterCommentRequired)
		assert.NotNil(t, settings.ReviewerCommentRequired)
		assert.True(t, *settings.ReviewerCommentRequired)
		assert.NotNil(t, settings.HideFlaggedContent)
		assert.True(t, *settings.HideFlaggedContent)
	})

	t.Run("should not override existing values", func(t *testing.T) {
		customReasons := []string{"Custom reason"}
		settings := &AdditionalContentFlaggingSettings{
			Reasons: &customReasons,
		}
		settings.SetDefault()

		assert.Equal(t, customReasons, *settings.Reasons)
	})
}

func TestAdditionalContentFlaggingSettings_IsValid(t *testing.T) {
	t.Run("should be valid when reasons are provided", func(t *testing.T) {
		settings := &AdditionalContentFlaggingSettings{
			Reasons: &[]string{"Reason 1", "Reason 2"},
		}

		err := settings.IsValid()
		assert.Nil(t, err)
	})

	t.Run("should be invalid when reasons are nil", func(t *testing.T) {
		settings := &AdditionalContentFlaggingSettings{
			Reasons: nil,
		}

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.content_flagging.reasons_not_set.app_error", err.Id)
	})

	t.Run("should be invalid when reasons are empty", func(t *testing.T) {
		settings := &AdditionalContentFlaggingSettings{
			Reasons: &[]string{},
		}

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Equal(t, "model.config.is_valid.content_flagging.reasons_not_set.app_error", err.Id)
	})
}

func TestContentFlaggingSettings_SetDefault(t *testing.T) {
	t.Run("should set all default values and call nested SetDefault methods", func(t *testing.T) {
		settings := &ContentFlaggingSettings{}
		settings.SetDefault()

		assert.NotNil(t, settings.EnableContentFlagging)
		assert.False(t, *settings.EnableContentFlagging)
		assert.NotNil(t, settings.NotificationSettings)
		assert.NotNil(t, settings.ReviewerSettings)
		assert.NotNil(t, settings.AdditionalSettings)

		// Verify nested defaults were set
		assert.NotNil(t, settings.NotificationSettings.EventTargetMapping)
		assert.NotNil(t, settings.ReviewerSettings.CommonReviewers)
		assert.NotNil(t, settings.AdditionalSettings.Reasons)
	})

	t.Run("should not override existing values", func(t *testing.T) {
		enabled := true
		settings := &ContentFlaggingSettings{
			EnableContentFlagging: &enabled,
		}
		settings.SetDefault()

		assert.True(t, *settings.EnableContentFlagging)
	})
}

func TestContentFlaggingSettings_IsValid(t *testing.T) {
	t.Run("should be valid when all nested settings are valid", func(t *testing.T) {
		settings := &ContentFlaggingSettings{}
		settings.SetDefault()

		err := settings.IsValid()
		assert.Nil(t, err)
	})

	t.Run("should be invalid when notification settings are invalid", func(t *testing.T) {
		settings := &ContentFlaggingSettings{
			NotificationSettings: &ContentFlaggingNotificationSettings{
				EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
					EventFlagged: {},
				},
			},
			ReviewerSettings:   &ReviewerSettings{},
			AdditionalSettings: &AdditionalContentFlaggingSettings{},
		}
		settings.ReviewerSettings.SetDefault()
		settings.AdditionalSettings.SetDefault()

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Contains(t, err.Id, "notification_settings")
	})

	t.Run("should be invalid when reviewer settings are invalid", func(t *testing.T) {
		settings := &ContentFlaggingSettings{
			NotificationSettings: &ContentFlaggingNotificationSettings{},
			ReviewerSettings: &ReviewerSettings{
				CommonReviewers:         NewPointer(true),
				CommonReviewerIds:       &[]string{},
				TeamReviewersSetting:    &map[string]TeamReviewerSetting{},
				SystemAdminsAsReviewers: NewPointer(false),
				TeamAdminsAsReviewers:   NewPointer(false),
			},
			AdditionalSettings: &AdditionalContentFlaggingSettings{},
		}
		settings.NotificationSettings.SetDefault()
		settings.AdditionalSettings.SetDefault()

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Contains(t, err.Id, "common_reviewers_not_set")
	})

	t.Run("should be invalid when additional settings are invalid", func(t *testing.T) {
		settings := &ContentFlaggingSettings{
			NotificationSettings: &ContentFlaggingNotificationSettings{},
			ReviewerSettings:     &ReviewerSettings{},
			AdditionalSettings: &AdditionalContentFlaggingSettings{
				Reasons: &[]string{},
			},
		}
		settings.NotificationSettings.SetDefault()
		settings.ReviewerSettings.SetDefault()

		err := settings.IsValid()
		assert.NotNil(t, err)
		assert.Contains(t, err.Id, "reasons_not_set")
	})
}

func TestTeamReviewerSetting(t *testing.T) {
	t.Run("should handle nil values properly", func(t *testing.T) {
		setting := TeamReviewerSetting{}
		
		// Should not panic when accessing nil pointers in validation logic
		assert.Nil(t, setting.Enabled)
		assert.Nil(t, setting.ReviewerIds)
	})

	t.Run("should work with proper values", func(t *testing.T) {
		setting := TeamReviewerSetting{
			Enabled:     NewPointer(true),
			ReviewerIds: &[]string{"user1", "user2"},
		}
		
		assert.True(t, *setting.Enabled)
		assert.Equal(t, []string{"user1", "user2"}, *setting.ReviewerIds)
	})
}

func TestContentFlaggingConstants(t *testing.T) {
	t.Run("should have correct event constants", func(t *testing.T) {
		assert.Equal(t, ContentFlaggingEvent("flagged"), EventFlagged)
		assert.Equal(t, ContentFlaggingEvent("assigned"), EventAssigned)
		assert.Equal(t, ContentFlaggingEvent("removed"), EventContentRemoved)
		assert.Equal(t, ContentFlaggingEvent("dismissed"), EventContentDismissed)
	})

	t.Run("should have correct target constants", func(t *testing.T) {
		assert.Equal(t, NotificationTarget("reviewers"), TargetReviewers)
		assert.Equal(t, NotificationTarget("author"), TargetAuthor)
		assert.Equal(t, NotificationTarget("reporter"), TargetReporter)
	})
}
