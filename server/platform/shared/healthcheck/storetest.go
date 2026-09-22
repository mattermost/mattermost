// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestFindingStore(t *testing.T, newStore func(t *testing.T) FindingStore) {
	t.Helper()

	t.Run("upsert and get by fingerprints with partial hit", func(t *testing.T) {
		store := newStore(t)
		fp1, fp2 := model.NewId(), model.NewId()
		first := testFinding(fp1, "check_cluster_status", 100)
		second := testFinding(fp2, "check_database_pool", 101)
		require.NoError(t, store.Upsert([]*model.HealthFinding{first, second}))

		got, err := store.GetByFingerprints([]string{fp1, model.NewId(), fp2})
		require.NoError(t, err)
		require.Len(t, got, 2)
		require.Equal(t, fp1, got[0].Fingerprint)
		require.Equal(t, fp2, got[1].Fingerprint)
	})

	t.Run("upsert idempotency", func(t *testing.T) {
		store := newStore(t)
		fp := model.NewId()
		original := testFinding(fp, "check_cluster_status", 100)
		require.NoError(t, store.Upsert([]*model.HealthFinding{original}))

		updated := testFinding(fp, "check_cluster_status", 200)
		updated.State = string(StateResolved)
		updated.MessageID = "health.rule.check_cluster_status.message.updated"
		require.NoError(t, store.Upsert([]*model.HealthFinding{updated}))

		got, err := store.GetByFingerprints([]string{fp})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.Equal(t, updated.LastSeenAt, got[0].LastSeenAt)
		require.Equal(t, updated.State, got[0].State)
		require.Equal(t, updated.MessageID, got[0].MessageID)
	})

	t.Run("upsert with duplicate fingerprints in one batch keeps the last", func(t *testing.T) {
		store := newStore(t)
		fp := model.NewId()
		first := testFinding(fp, "check_cluster_status", 100)
		last := testFinding(fp, "check_cluster_status", 200)
		last.State = string(StateResolved)
		require.NoError(t, store.Upsert([]*model.HealthFinding{first, last}))

		got, err := store.GetByFingerprints([]string{fp})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.Equal(t, int64(200), got[0].LastSeenAt)
		require.Equal(t, string(StateResolved), got[0].State)
	})

	t.Run("upsert with duplicate fingerprints keeps the last occurrence's mute state", func(t *testing.T) {
		store := newStore(t)
		fp := model.NewId()
		muted := testFinding(fp, "check_cluster_status", 100)
		muted.MutedAt, muted.MutedBy = 123, "user-1"
		unmuted := testFinding(fp, "check_cluster_status", 200)
		require.NoError(t, store.Upsert([]*model.HealthFinding{muted, unmuted}))

		got, err := store.GetByFingerprints([]string{fp})
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, int64(0), got[0].MutedAt)
		assert.Empty(t, got[0].MutedBy)
	})

	t.Run("include muted and muted only policies", func(t *testing.T) {
		store := newStore(t)
		unmutedFp, mutedFp := model.NewId(), model.NewId()
		unmuted := testFinding(unmutedFp, "check_cluster_status", 100)
		muted := testFinding(mutedFp, "check_database_pool", 100)
		require.NoError(t, store.Upsert([]*model.HealthFinding{unmuted, muted}))
		require.NoError(t, store.Mute(mutedFp, "user-1", 123))

		defaultList, err := store.List(model.HealthFindingFilter{})
		require.NoError(t, err)
		assert.NotNil(t, findFinding(defaultList, unmutedFp))
		assert.Nil(t, findFinding(defaultList, mutedFp))

		withMuted, err := store.List(model.HealthFindingFilter{Muted: model.MutedIncluded})
		require.NoError(t, err)
		assert.NotNil(t, findFinding(withMuted, unmutedFp))
		assert.NotNil(t, findFinding(withMuted, mutedFp))

		mutedOnly, err := store.List(model.HealthFindingFilter{Muted: model.MutedOnly})
		require.NoError(t, err)
		assert.Nil(t, findFinding(mutedOnly, unmutedFp))
		mutedFinding := findFinding(mutedOnly, mutedFp)
		require.NotNil(t, mutedFinding)
		assert.True(t, mutedFinding.IsMuted())
	})

	t.Run("list filters by surface", func(t *testing.T) {
		store := newStore(t)
		product := testFinding("fp-product", "check_cluster_status", 100)
		product.Surface = string(SurfaceProduct)
		internal := testFinding("fp-internal", "check_database_pool", 100)
		internal.Surface = string(SurfaceInternal)
		require.NoError(t, store.Upsert([]*model.HealthFinding{product, internal}))

		productOnly, err := store.List(model.HealthFindingFilter{Surfaces: []string{string(SurfaceProduct)}})
		require.NoError(t, err)
		require.Len(t, productOnly, 1)
		require.Equal(t, "fp-product", productOnly[0].Fingerprint)

		both, err := store.List(model.HealthFindingFilter{})
		require.NoError(t, err)
		require.Len(t, both, 2)
	})

	t.Run("mute and unmute round trip", func(t *testing.T) {
		store := newStore(t)
		fp := model.NewId()
		require.NoError(t, store.Upsert([]*model.HealthFinding{testFinding(fp, "check_cluster_status", 100)}))
		require.NoError(t, store.Mute(fp, "user-1", 456))

		muted, err := store.GetByFingerprints([]string{fp})
		require.NoError(t, err)
		require.Len(t, muted, 1)
		require.True(t, muted[0].IsMuted())
		require.Equal(t, int64(456), muted[0].MutedAt)
		require.Equal(t, "user-1", muted[0].MutedBy)

		require.NoError(t, store.Unmute(fp))

		unmuted, err := store.GetByFingerprints([]string{fp})
		require.NoError(t, err)
		require.Len(t, unmuted, 1)
		require.False(t, unmuted[0].IsMuted())
		require.Equal(t, int64(0), unmuted[0].MutedAt)
		require.Equal(t, "", unmuted[0].MutedBy)
	})

	t.Run("delete before boundary is exclusive", func(t *testing.T) {
		store := newStore(t)
		oldFp, equalFp, newFp := model.NewId(), model.NewId(), model.NewId()
		require.NoError(t, store.Upsert([]*model.HealthFinding{
			testFinding(oldFp, "check_cluster_status", 99),
			testFinding(equalFp, "check_database_pool", 100),
			testFinding(newFp, "check_jobs_disabled", 101),
		}))

		deleted, err := store.DeleteBefore(100)
		require.NoError(t, err)
		require.Equal(t, int64(1), deleted)

		remaining, err := store.GetByFingerprints([]string{oldFp, equalFp, newFp})
		require.NoError(t, err)
		require.Len(t, remaining, 2)
		require.Equal(t, equalFp, remaining[0].Fingerprint)
		require.Equal(t, newFp, remaining[1].Fingerprint)
	})

	t.Run("mute and unmute unknown fingerprint return ErrFindingNotFound", func(t *testing.T) {
		store := newStore(t)
		missing := model.NewId()
		require.ErrorIs(t, store.Mute(missing, "user-1", 10), ErrFindingNotFound)
		require.ErrorIs(t, store.Unmute(missing), ErrFindingNotFound)
	})

	t.Run("upsert refresh preserves existing mute metadata", func(t *testing.T) {
		store := newStore(t)
		fp := model.NewId()
		require.NoError(t, store.Upsert([]*model.HealthFinding{testFinding(fp, "check_cluster_status", 100)}))
		require.NoError(t, store.Mute(fp, "user-1", 456))

		refreshed := testFinding(fp, "check_cluster_status", 200)
		require.NoError(t, store.Upsert([]*model.HealthFinding{refreshed}))

		got, err := store.GetByFingerprints([]string{fp})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.True(t, got[0].IsMuted())
		require.Equal(t, int64(456), got[0].MutedAt)
		require.Equal(t, "user-1", got[0].MutedBy)
		require.Equal(t, int64(200), got[0].LastSeenAt)
	})

	t.Run("upsert clears mutedby when not muted", func(t *testing.T) {
		store := newStore(t)
		fp := model.NewId()
		finding := testFinding(fp, "check_cluster_status", 100)
		finding.MutedBy = "user-1"
		require.NoError(t, store.Upsert([]*model.HealthFinding{finding}))

		got, err := store.GetByFingerprints([]string{fp})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.False(t, got[0].IsMuted())
		require.Equal(t, int64(0), got[0].MutedAt)
		require.Empty(t, got[0].MutedBy)
	})

	t.Run("upsert does not persist rendered fields", func(t *testing.T) {
		store := newStore(t)
		fp := model.NewId()
		finding := testFinding(fp, "check_cluster_status", 100)
		finding.Summary = "rendered summary"
		finding.Remediation = "rendered remediation"
		finding.Message = "rendered message"
		require.NoError(t, store.Upsert([]*model.HealthFinding{finding}))

		got, err := store.GetByFingerprints([]string{fp})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.Empty(t, got[0].Summary)
		require.Empty(t, got[0].Remediation)
		require.Empty(t, got[0].Message)
	})
}

func findFinding(findings []*model.HealthFinding, fingerprint string) *model.HealthFinding {
	for _, finding := range findings {
		if finding.Fingerprint == fingerprint {
			return finding
		}
	}
	return nil
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
