// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestFindingStore(t *testing.T, newStore func() FindingStore) {
	t.Helper()

	t.Run("upsert and get by fingerprints with partial hit", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		first := testFinding("fp1", "check_cluster_status", 100)
		second := testFinding("fp2", "check_database_pool", 101)
		require.NoError(t, store.Upsert([]*model.HealthFinding{first, second}))

		got, err := store.GetByFingerprints([]string{"fp1", "missing", "fp2"})
		require.NoError(t, err)
		require.Len(t, got, 2)
		require.Equal(t, "fp1", got[0].Fingerprint)
		require.Equal(t, "fp2", got[1].Fingerprint)
	})

	t.Run("upsert idempotency", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		original := testFinding("fp1", "check_cluster_status", 100)
		require.NoError(t, store.Upsert([]*model.HealthFinding{original}))

		updated := testFinding("fp1", "check_cluster_status", 200)
		updated.State = string(StateResolved)
		updated.MessageID = "health.rule.check_cluster_status.message.updated"
		require.NoError(t, store.Upsert([]*model.HealthFinding{updated}))

		got, err := store.GetByFingerprints([]string{"fp1"})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.Equal(t, updated.LastSeenAt, got[0].LastSeenAt)
		require.Equal(t, updated.State, got[0].State)
		require.Equal(t, updated.MessageID, got[0].MessageID)
	})

	t.Run("include muted and muted only policies", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		unmuted := testFinding("fp-unmuted", "check_cluster_status", 100)
		muted := testFinding("fp-muted", "check_database_pool", 100)
		require.NoError(t, store.Upsert([]*model.HealthFinding{unmuted, muted}))
		require.NoError(t, store.Mute("fp-muted", "user-1", 123))

		defaultList, err := store.List(model.HealthFindingFilter{})
		require.NoError(t, err)
		require.Len(t, defaultList, 1)
		require.Equal(t, "fp-unmuted", defaultList[0].Fingerprint)

		withMuted, err := store.List(model.HealthFindingFilter{Muted: model.MutedIncluded})
		require.NoError(t, err)
		require.Len(t, withMuted, 2)

		mutedOnly, err := store.List(model.HealthFindingFilter{Muted: model.MutedOnly})
		require.NoError(t, err)
		require.Len(t, mutedOnly, 1)
		require.Equal(t, "fp-muted", mutedOnly[0].Fingerprint)
		require.True(t, mutedOnly[0].IsMuted())
	})

	t.Run("mute and unmute round trip", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		require.NoError(t, store.Upsert([]*model.HealthFinding{testFinding("fp1", "check_cluster_status", 100)}))
		require.NoError(t, store.Mute("fp1", "user-1", 456))

		muted, err := store.GetByFingerprints([]string{"fp1"})
		require.NoError(t, err)
		require.Len(t, muted, 1)
		require.True(t, muted[0].IsMuted())
		require.Equal(t, int64(456), muted[0].MutedAt)
		require.Equal(t, "user-1", muted[0].MutedBy)

		require.NoError(t, store.Unmute("fp1"))

		unmuted, err := store.GetByFingerprints([]string{"fp1"})
		require.NoError(t, err)
		require.Len(t, unmuted, 1)
		require.False(t, unmuted[0].IsMuted())
		require.Equal(t, int64(0), unmuted[0].MutedAt)
		require.Equal(t, "", unmuted[0].MutedBy)
	})

	t.Run("delete before boundary is exclusive", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		require.NoError(t, store.Upsert([]*model.HealthFinding{
			testFinding("fp-old", "check_cluster_status", 99),
			testFinding("fp-equal", "check_database_pool", 100),
			testFinding("fp-new", "check_jobs_disabled", 101),
		}))

		deleted, err := store.DeleteBefore(100)
		require.NoError(t, err)
		require.Equal(t, int64(1), deleted)

		remaining, err := store.List(model.HealthFindingFilter{Muted: model.MutedIncluded})
		require.NoError(t, err)
		require.Len(t, remaining, 2)
		require.Equal(t, "fp-equal", remaining[0].Fingerprint)
		require.Equal(t, "fp-new", remaining[1].Fingerprint)
	})

	t.Run("mute and unmute unknown fingerprint return ErrFindingNotFound", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		require.ErrorIs(t, store.Mute("missing", "user-1", 10), ErrFindingNotFound)
		require.ErrorIs(t, store.Unmute("missing"), ErrFindingNotFound)
	})

	t.Run("upsert refresh preserves existing mute metadata", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		require.NoError(t, store.Upsert([]*model.HealthFinding{testFinding("fp1", "check_cluster_status", 100)}))
		require.NoError(t, store.Mute("fp1", "user-1", 456))

		refreshed := testFinding("fp1", "check_cluster_status", 200)
		require.NoError(t, store.Upsert([]*model.HealthFinding{refreshed}))

		got, err := store.GetByFingerprints([]string{"fp1"})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.True(t, got[0].IsMuted())
		require.Equal(t, int64(456), got[0].MutedAt)
		require.Equal(t, "user-1", got[0].MutedBy)
		require.Equal(t, int64(200), got[0].LastSeenAt)
	})

	t.Run("upsert does not persist rendered fields", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		finding := testFinding("fp1", "check_cluster_status", 100)
		finding.Summary = "rendered summary"
		finding.Remediation = "rendered remediation"
		finding.Message = "rendered message"
		require.NoError(t, store.Upsert([]*model.HealthFinding{finding}))

		got, err := store.GetByFingerprints([]string{"fp1"})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.Empty(t, got[0].Summary)
		require.Empty(t, got[0].Remediation)
		require.Empty(t, got[0].Message)
	})
}

func testFinding(fingerprint, code string, lastSeenAt int64) *model.HealthFinding {
	return &model.HealthFinding{
		Fingerprint:     fingerprint,
		Code:            code,
		Subject:         "subject",
		Scope:           "",
		Severity:        string(SeverityWarning),
		State:           string(StateFiring),
		Area:            model.AreaCluster,
		Surface:         string(SurfaceProduct),
		MessageID:       "health.rule." + code + ".message",
		Details:         map[string]string{"foo": "bar"},
		FirstSeenAt:     1,
		LastSeenAt:      lastSeenAt,
		StateSince:      1,
		ConsecutiveHits: 1,
	}
}
