// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"math"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestHealthFindingStore(t *testing.T, _ request.CTX, ss store.Store) {
	// The conformance suite assumes each newStore call yields an empty store, as
	// the memory store does. The SQL store shares one table, so clear it each time.
	healthcheck.TestFindingStore(t, func(t *testing.T) healthcheck.FindingStore {
		fs := ss.HealthFinding()
		_, err := fs.DeleteBefore(math.MaxInt64)
		require.NoError(t, err)
		return fs
	})

	t.Run("batch upsert persists 200 findings in one call", func(t *testing.T) {
		fs := ss.HealthFinding()

		fingerprints := make([]string, 0, 200)
		findings := make([]*model.HealthFinding, 0, 200)
		for i := range 200 {
			fingerprint := "fp-" + model.NewId()
			fingerprints = append(fingerprints, fingerprint)
			findings = append(findings, &model.HealthFinding{
				Fingerprint:     fingerprint,
				Code:            "check_cluster_status",
				Subject:         "subject",
				Scope:           "",
				Severity:        "warning",
				State:           "firing",
				Area:            model.AreaCluster,
				Surface:         "product",
				MessageID:       "health.rule.check_cluster_status.message",
				Details:         map[string]string{"index": "value"},
				FirstSeenAt:     1,
				LastSeenAt:      int64(1000 + i),
				StateSince:      1,
				ConsecutiveHits: 1,
			})
		}

		require.NoError(t, fs.Upsert(findings))

		got, err := fs.GetByFingerprints(fingerprints)
		require.NoError(t, err)
		assert.Len(t, got, 200)
	})

	t.Run("concurrent upsert on same fingerprint does not violate constraints", func(t *testing.T) {
		fs := ss.HealthFinding()

		fingerprint := "fp-" + model.NewId()
		first := &model.HealthFinding{
			Fingerprint:     fingerprint,
			Code:            "check_cluster_status",
			Subject:         "subject",
			Severity:        "warning",
			State:           "firing",
			Area:            model.AreaCluster,
			Surface:         "product",
			MessageID:       "health.rule.check_cluster_status.message",
			Details:         map[string]string{"state": "first"},
			FirstSeenAt:     1,
			LastSeenAt:      100,
			StateSince:      1,
			ConsecutiveHits: 1,
		}
		second := &model.HealthFinding{
			Fingerprint:     fingerprint,
			Code:            "check_cluster_status",
			Subject:         "subject",
			Severity:        "warning",
			State:           "resolved",
			Area:            model.AreaCluster,
			Surface:         "product",
			MessageID:       "health.rule.check_cluster_status.message",
			Details:         map[string]string{"state": "second"},
			FirstSeenAt:     1,
			LastSeenAt:      200,
			StateSince:      1,
			ConsecutiveHits: 2,
		}

		start := make(chan struct{})
		errs := make(chan error, 2)
		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()
			<-start
			errs <- fs.Upsert([]*model.HealthFinding{first})
		}()

		go func() {
			defer wg.Done()
			<-start
			errs <- fs.Upsert([]*model.HealthFinding{second})
		}()

		close(start)
		wg.Wait()
		close(errs)

		for err := range errs {
			require.NoError(t, err)
		}

		got, err := fs.GetByFingerprints([]string{fingerprint})
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Contains(t, []int64{int64(100), int64(200)}, got[0].LastSeenAt)
		assert.Contains(t, []string{"firing", "resolved"}, got[0].State)
	})
}
