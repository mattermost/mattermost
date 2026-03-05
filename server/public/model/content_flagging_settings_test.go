package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContentFlaggingNotificationSettings_SetDefault(t *testing.T) {
	t.Run("should set default event target mappings", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{}
		settings.SetDefaults()

		require.Nil(t, settings.IsValid())

		require.NotNil(t, settings.EventTargetMapping)
		require.Equal(t, []NotificationTarget{TargetReviewers}, settings.EventTargetMapping[EventFlagged])
		require.Equal(t, []NotificationTarget{TargetReviewers}, settings.EventTargetMapping[EventAssigned])
		require.Equal(t, []NotificationTarget{TargetReviewers, TargetAuthor, TargetReporter}, settings.EventTargetMapping[EventContentRemoved])
		require.Equal(t, []NotificationTarget{TargetReviewers, TargetReporter}, settings.EventTargetMapping[EventContentDismissed])
	})

	t.Run("should not override existing mappings", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				EventFlagged: {TargetReviewers},
			},
		}
		settings.SetDefaults()

		require.Nil(t, settings.IsValid())
		require.Equal(t, []NotificationTarget{TargetReviewers}, settings.EventTargetMapping[EventFlagged])
		require.Equal(t, []NotificationTarget{TargetReviewers}, settings.EventTargetMapping[EventAssigned])
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
		require.Nil(t, err)
	})

	t.Run("should be invalid when no targets for flagged events", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				EventFlagged: {},
			},
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", err.Id)
	})

	t.Run("should be invalid when flagged event mapping is nil", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{},
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", err.Id)
	})

	t.Run("should be invalid when reviewers not included in flagged event targets", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				EventFlagged: {TargetAuthor, TargetReporter},
			},
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", err.Id)
	})

	t.Run("should be invalid when invalid events and targets are specified", func(t *testing.T) {
		settings := &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				"invalid_event": {TargetAuthor, TargetReporter},
			},
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.notification_settings.invalid_event", err.Id)

		settings = &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				EventFlagged: {"invalid_target_1", "invalid_target_2"},
			},
		}

		err = settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.notification_settings.invalid_target", err.Id)

		settings = &ContentFlaggingNotificationSettings{
			EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
				"invalid_event": {"invalid_target_1", "invalid_target_2"},
			},
		}

		err = settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.notification_settings.invalid_event", err.Id)
	})
}

func TestReviewerSettings_IsValid(t *testing.T) {
	t.Run("should be valid when common reviewers enabled with reviewer IDs", func(t *testing.T) {
		settings := &ReviewSettingsRequest{
			ReviewerSettings: ReviewerSettings{
				CommonReviewers:         NewPointer(true),
				SystemAdminsAsReviewers: NewPointer(false),
				TeamAdminsAsReviewers:   NewPointer(false),
			},
			ReviewerIDsSettings: ReviewerIDsSettings{
				CommonReviewerIds:    []string{"user1", "user2"},
				TeamReviewersSetting: map[string]*TeamReviewerSetting{},
			},
		}

		err := settings.IsValid()
		require.Nil(t, err)
	})

	t.Run("should be valid when common reviewers enabled with Additional Reviewers", func(t *testing.T) {
		settings := &ReviewSettingsRequest{
			ReviewerSettings: ReviewerSettings{
				CommonReviewers:         NewPointer(true),
				SystemAdminsAsReviewers: NewPointer(true),
				TeamAdminsAsReviewers:   NewPointer(false),
			},
			ReviewerIDsSettings: ReviewerIDsSettings{
				CommonReviewerIds:    []string{},
				TeamReviewersSetting: map[string]*TeamReviewerSetting{},
			},
		}

		err := settings.IsValid()
		require.Nil(t, err)
	})

	t.Run("should be invalid when common reviewers enabled but no reviewers specified", func(t *testing.T) {
		settings := &ReviewSettingsRequest{
			ReviewerSettings: ReviewerSettings{
				CommonReviewers:         NewPointer(true),
				SystemAdminsAsReviewers: NewPointer(false),
				TeamAdminsAsReviewers:   NewPointer(false),
			},
			ReviewerIDsSettings: ReviewerIDsSettings{
				CommonReviewerIds:    []string{},
				TeamReviewersSetting: map[string]*TeamReviewerSetting{},
			},
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.content_flagging.common_reviewers_not_set.app_error", err.Id)
	})

	t.Run("should be valid when team reviewers enabled with reviewer IDs", func(t *testing.T) {
		settings := &ReviewSettingsRequest{
			ReviewerSettings: ReviewerSettings{
				CommonReviewers:         NewPointer(false),
				SystemAdminsAsReviewers: NewPointer(false),
				TeamAdminsAsReviewers:   NewPointer(false),
			},
			ReviewerIDsSettings: ReviewerIDsSettings{
				CommonReviewerIds: []string{},
				TeamReviewersSetting: map[string]*TeamReviewerSetting{
					"team1": {
						Enabled:     NewPointer(true),
						ReviewerIds: []string{"user1"},
					},
				},
			},
		}

		err := settings.IsValid()
		require.Nil(t, err)
	})

	t.Run("should be invalid when team reviewers enabled but no reviewer IDs", func(t *testing.T) {
		settings := &ReviewSettingsRequest{
			ReviewerSettings: ReviewerSettings{
				CommonReviewers:         NewPointer(false),
				SystemAdminsAsReviewers: NewPointer(false),
				TeamAdminsAsReviewers:   NewPointer(false),
			},
			ReviewerIDsSettings: ReviewerIDsSettings{
				CommonReviewerIds: []string{},
				TeamReviewersSetting: map[string]*TeamReviewerSetting{
					"team1": {
						Enabled:     NewPointer(true),
						ReviewerIds: []string{},
					},
				},
			},
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.content_flagging.team_reviewers_not_set.app_error", err.Id)
	})

	t.Run("should be valid when team reviewers enabled but no reviewer IDs with Additional Reviewers", func(t *testing.T) {
		settings := &ReviewSettingsRequest{
			ReviewerSettings: ReviewerSettings{
				CommonReviewers:         NewPointer(false),
				SystemAdminsAsReviewers: NewPointer(true),
				TeamAdminsAsReviewers:   NewPointer(false),
			},
			ReviewerIDsSettings: ReviewerIDsSettings{
				CommonReviewerIds: []string{},
				TeamReviewersSetting: map[string]*TeamReviewerSetting{
					"team1": {
						Enabled:     NewPointer(true),
						ReviewerIds: []string{},
					},
				},
			},
		}

		err := settings.IsValid()
		require.Nil(t, err)
	})
}

func TestAdditionalContentFlaggingSettings_SetDefault(t *testing.T) {
	t.Run("should not override existing values", func(t *testing.T) {
		customReasons := []string{"Custom reason"}
		settings := &AdditionalContentFlaggingSettings{
			Reasons: &customReasons,
		}
		settings.SetDefaults()

		require.Nil(t, settings.IsValid())
		require.Equal(t, customReasons, *settings.Reasons)
	})
}

func TestAdditionalContentFlaggingSettings_IsValid(t *testing.T) {
	t.Run("should be valid when reasons are provided", func(t *testing.T) {
		settings := &AdditionalContentFlaggingSettings{
			Reasons: &[]string{"Reason 1", "Reason 2"},
		}

		err := settings.IsValid()
		require.Nil(t, err)
	})

	t.Run("should be invalid when reasons are nil", func(t *testing.T) {
		settings := &AdditionalContentFlaggingSettings{
			Reasons: nil,
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.content_flagging.reasons_not_set.app_error", err.Id)
	})

	t.Run("should be invalid when reasons are empty", func(t *testing.T) {
		settings := &AdditionalContentFlaggingSettings{
			Reasons: &[]string{},
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.config.is_valid.content_flagging.reasons_not_set.app_error", err.Id)
	})
}

func TestContentFlaggingSettings_SetDefault(t *testing.T) {
	t.Run("should not override existing values", func(t *testing.T) {
		enabled := true
		settings := &ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: ContentFlaggingSettingsBase{
				EnableContentFlagging: &enabled,
			},
		}
		settings.SetDefaults()

		require.Nil(t, settings.IsValid())
		require.True(t, *settings.EnableContentFlagging)
	})
}

func TestContentFlaggingSettings_IsValid(t *testing.T) {
	t.Run("should be valid when all nested settings are valid", func(t *testing.T) {
		settings := &ContentFlaggingSettings{}
		settings.SetDefaults()

		err := settings.IsValid()
		require.Nil(t, err)
	})

	t.Run("should be invalid when notification settings are invalid", func(t *testing.T) {
		settings := &ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: ContentFlaggingSettingsBase{
				NotificationSettings: &ContentFlaggingNotificationSettings{
					EventTargetMapping: map[ContentFlaggingEvent][]NotificationTarget{
						EventFlagged: {},
					},
				},
				AdditionalSettings: &AdditionalContentFlaggingSettings{},
			},
		}

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Contains(t, err.Id, "notification_settings")
	})

	t.Run("should be invalid when reviewer settings are invalid", func(t *testing.T) {
		settings := &ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: ContentFlaggingSettingsBase{
				NotificationSettings: &ContentFlaggingNotificationSettings{},
				AdditionalSettings:   &AdditionalContentFlaggingSettings{},
			},
			ReviewerSettings: &ReviewSettingsRequest{
				ReviewerSettings: ReviewerSettings{
					CommonReviewers:         NewPointer(true),
					SystemAdminsAsReviewers: NewPointer(false),
					TeamAdminsAsReviewers:   NewPointer(false),
				},
				ReviewerIDsSettings: ReviewerIDsSettings{
					CommonReviewerIds:    []string{},
					TeamReviewersSetting: map[string]*TeamReviewerSetting{},
				},
			},
		}
		settings.NotificationSettings.SetDefaults()
		settings.AdditionalSettings.SetDefaults()

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Contains(t, err.Id, "common_reviewers_not_set")
	})

	t.Run("should be invalid when additional settings are invalid", func(t *testing.T) {
		settings := &ContentFlaggingSettingsRequest{
			ContentFlaggingSettingsBase: ContentFlaggingSettingsBase{
				NotificationSettings: &ContentFlaggingNotificationSettings{},
				AdditionalSettings: &AdditionalContentFlaggingSettings{
					Reasons: &[]string{},
				},
			},
		}

		settings.SetDefaults()

		err := settings.IsValid()
		require.NotNil(t, err)
		require.Contains(t, err.Id, "reasons_not_set")
	})
}

func TestContentFlaggingConstants(t *testing.T) {
	t.Run("should have correct event constants", func(t *testing.T) {
		require.Equal(t, ContentFlaggingEvent("flagged"), EventFlagged)
		require.Equal(t, ContentFlaggingEvent("assigned"), EventAssigned)
		require.Equal(t, ContentFlaggingEvent("removed"), EventContentRemoved)
		require.Equal(t, ContentFlaggingEvent("dismissed"), EventContentDismissed)
	})

	t.Run("should have correct target constants", func(t *testing.T) {
		require.Equal(t, NotificationTarget("reviewers"), TargetReviewers)
		require.Equal(t, NotificationTarget("author"), TargetAuthor)
		require.Equal(t, NotificationTarget("reporter"), TargetReporter)
	})
}
