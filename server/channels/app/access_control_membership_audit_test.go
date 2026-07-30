// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestBuildAccessControlMembershipAuditRecord(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	data := AccessControlMembershipAuditData{
		JobID:          "job1",
		PolicyID:       "channel1",
		PolicyRevision: 7,
		ResourceType:   AccessControlAuditResourceChannel,
		ResourceID:     "channel1",
		UserID:         "user1",
		Action:         AccessControlAuditActionAdd,
		Reason:         AccessControlAuditReasonMatchesPolicy,
	}

	t.Run("returns nil when audit logging is disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAccessControlAuditLogging = model.NewPointer(false)
		})

		rec := th.App.buildAccessControlMembershipAuditRecord(th.Context, model.AuditEventChannelMembershipAdded, model.AuditStatusSuccess, data)
		require.Nil(t, rec)
	})

	t.Run("populates all fields when enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAccessControlAuditLogging = model.NewPointer(true)
		})

		rec := th.App.buildAccessControlMembershipAuditRecord(th.Context, model.AuditEventChannelMembershipAdded, model.AuditStatusSuccess, data)
		require.NotNil(t, rec)
		require.Equal(t, model.AuditEventChannelMembershipAdded, rec.EventName)
		require.Equal(t, model.AuditStatusSuccess, rec.Status)

		params := rec.EventData.Parameters
		require.Equal(t, "job1", params["job_id"])
		require.Equal(t, "channel1", params["policy_id"])
		require.Equal(t, 7, params["policy_revision"])
		require.Equal(t, AccessControlAuditResourceChannel, params["resource_type"])
		require.Equal(t, "channel1", params["resource_id"])
		require.Equal(t, "user1", params["user_id"])
		require.Equal(t, AccessControlAuditActionAdd, params["action"])
		require.Equal(t, AccessControlAuditReasonMatchesPolicy, params["reason"])

		// Optional correlation fields are omitted when unset.
		_, hasEventID := params["event_id"]
		require.False(t, hasEventID)
		_, hasParentEventID := params["parent_event_id"]
		require.False(t, hasParentEventID)
	})

	t.Run("omits optional job_id and reason when empty and includes correlation ids", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAccessControlAuditLogging = model.NewPointer(true)
		})

		cascade := AccessControlMembershipAuditData{
			PolicyID:       "team1",
			PolicyRevision: 3,
			ResourceType:   AccessControlAuditResourceChannel,
			ResourceID:     "channel9",
			UserID:         "user2",
			Action:         AccessControlAuditActionRemove,
			ParentEventID:  "parent1",
		}

		rec := th.App.buildAccessControlMembershipAuditRecord(th.Context, model.AuditEventTeamCascadedChannelRemoval, model.AuditStatusSuccess, cascade)
		require.NotNil(t, rec)

		params := rec.EventData.Parameters
		_, hasJobID := params["job_id"]
		require.False(t, hasJobID)
		_, hasReason := params["reason"]
		require.False(t, hasReason)
		require.Equal(t, "parent1", params["parent_event_id"])
		require.Equal(t, AccessControlAuditActionRemove, params["action"])
	})
}

// TestAccessControlTeamRemovalAuditPayloads covers the state leaveTeam shares
// between the team-removal record and the cascade records it triggers: both carry
// the sync job id and the team's policy, and each cascade record points back at
// the removal record via parent_event_id.
func TestAccessControlTeamRemovalAuditPayloads(t *testing.T) {
	mainHelper.Parallel(t)

	removal := accessControlTeamRemovalAudit{
		teamID:         "team1",
		userID:         "user1",
		jobID:          "job7",
		eventID:        "event7",
		policyRevision: 5,
	}

	require.Equal(t, AccessControlMembershipAuditData{
		JobID:          "job7",
		PolicyID:       "team1",
		PolicyRevision: 5,
		ResourceType:   AccessControlAuditResourceTeam,
		ResourceID:     "team1",
		UserID:         "user1",
		Action:         AccessControlAuditActionRemove,
		Reason:         AccessControlAuditReasonNoLongerMatches,
		EventID:        "event7",
	}, removal.removalData())

	require.Equal(t, AccessControlMembershipAuditData{
		JobID:          "job7",
		PolicyID:       "team1",
		PolicyRevision: 5,
		ResourceType:   AccessControlAuditResourceChannel,
		ResourceID:     "channel1",
		UserID:         "user1",
		Action:         AccessControlAuditActionRemove,
		Reason:         AccessControlAuditReasonTeamCascade,
		ParentEventID:  "event7",
	}, removal.cascadeData("channel1"))
}
