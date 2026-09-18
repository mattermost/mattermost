// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestFindingStore(t *testing.T, newStore func() FindingStore) {
	t.Helper()

	t.Run("upsert and get by fingerprints with partial hit", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		first := testFinding("fp1", "check_cluster_status", 100)
		second := testFinding("fp2", "check_database_pool", 101)
		mustNoError(t, store.Upsert([]*model.HealthFinding{first, second}))

		got, err := store.GetByFingerprints([]string{"fp1", "missing", "fp2"})
		mustNoError(t, err)
		mustLen(t, got, 2)
		mustEqual(t, "fp1", got[0].Fingerprint)
		mustEqual(t, "fp2", got[1].Fingerprint)
	})

	t.Run("upsert idempotency", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		original := testFinding("fp1", "check_cluster_status", 100)
		mustNoError(t, store.Upsert([]*model.HealthFinding{original}))

		updated := testFinding("fp1", "check_cluster_status", 200)
		updated.State = string(StateResolved)
		updated.MessageID = "health.rule.check_cluster_status.message.updated"
		mustNoError(t, store.Upsert([]*model.HealthFinding{updated}))

		got, err := store.GetByFingerprints([]string{"fp1"})
		mustNoError(t, err)
		mustLen(t, got, 1)
		mustEqual(t, updated.LastSeenAt, got[0].LastSeenAt)
		mustEqual(t, updated.State, got[0].State)
		mustEqual(t, updated.MessageID, got[0].MessageID)
	})

	t.Run("include muted and muted only policies", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		unmuted := testFinding("fp-unmuted", "check_cluster_status", 100)
		muted := testFinding("fp-muted", "check_database_pool", 100)
		mustNoError(t, store.Upsert([]*model.HealthFinding{unmuted, muted}))
		mustNoError(t, store.Mute("fp-muted", "user-1", 123))

		defaultList, err := store.List(model.HealthFindingFilter{})
		mustNoError(t, err)
		mustLen(t, defaultList, 1)
		mustEqual(t, "fp-unmuted", defaultList[0].Fingerprint)

		withMuted, err := store.List(model.HealthFindingFilter{IncludeMuted: true})
		mustNoError(t, err)
		mustLen(t, withMuted, 2)

		mutedOnly, err := store.List(model.HealthFindingFilter{MutedOnly: true})
		mustNoError(t, err)
		mustLen(t, mutedOnly, 1)
		mustEqual(t, "fp-muted", mutedOnly[0].Fingerprint)
		mustTrue(t, mutedOnly[0].IsMuted())
	})

	t.Run("mute and unmute round trip", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		mustNoError(t, store.Upsert([]*model.HealthFinding{testFinding("fp1", "check_cluster_status", 100)}))
		mustNoError(t, store.Mute("fp1", "user-1", 456))

		muted, err := store.GetByFingerprints([]string{"fp1"})
		mustNoError(t, err)
		mustLen(t, muted, 1)
		mustTrue(t, muted[0].IsMuted())
		mustEqual(t, int64(456), muted[0].MutedAt)
		mustEqual(t, "user-1", muted[0].MutedBy)

		mustNoError(t, store.Unmute("fp1"))

		unmuted, err := store.GetByFingerprints([]string{"fp1"})
		mustNoError(t, err)
		mustLen(t, unmuted, 1)
		mustFalse(t, unmuted[0].IsMuted())
		mustEqual(t, int64(0), unmuted[0].MutedAt)
		mustEqual(t, "", unmuted[0].MutedBy)
	})

	t.Run("delete before boundary is exclusive", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		mustNoError(t, store.Upsert([]*model.HealthFinding{
			testFinding("fp-old", "check_cluster_status", 99),
			testFinding("fp-equal", "check_database_pool", 100),
			testFinding("fp-new", "check_jobs_disabled", 101),
		}))

		deleted, err := store.DeleteBefore(100)
		mustNoError(t, err)
		mustEqual(t, int64(1), deleted)

		remaining, err := store.List(model.HealthFindingFilter{IncludeMuted: true})
		mustNoError(t, err)
		mustLen(t, remaining, 2)
		mustEqual(t, "fp-equal", remaining[0].Fingerprint)
		mustEqual(t, "fp-new", remaining[1].Fingerprint)
	})

	t.Run("mute and unmute unknown fingerprint return ErrFindingNotFound", func(t *testing.T) {
		t.Parallel()

		store := newStore()
		mustErrorIs(t, store.Mute("missing", "user-1", 10), ErrFindingNotFound)
		mustErrorIs(t, store.Unmute("missing"), ErrFindingNotFound)
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

func mustNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func mustErrorIs(t *testing.T, err, target error) {
	t.Helper()
	if !errors.Is(err, target) {
		t.Fatalf("expected error %v, got %v", target, err)
	}
}

func mustEqual[T comparable](t *testing.T, expected, got T) {
	t.Helper()
	if expected != got {
		t.Fatalf("expected %v, got %v", expected, got)
	}
}

func mustLen[T any](t *testing.T, got []T, expected int) {
	t.Helper()
	if len(got) != expected {
		t.Fatalf("expected length %d, got %d", expected, len(got))
	}
}

func mustTrue(t *testing.T, v bool) {
	t.Helper()
	if !v {
		t.Fatalf("expected true, got false")
	}
}

func mustFalse(t *testing.T, v bool) {
	t.Helper()
	if v {
		t.Fatalf("expected false, got true")
	}
}
