// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"maps"
	"slices"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
)

type memoryStore struct {
	mut      sync.RWMutex
	findings map[string]*model.HealthFinding
}

func NewMemoryStore() FindingStore {
	return &memoryStore{
		findings: map[string]*model.HealthFinding{},
	}
}

func (s *memoryStore) GetByFingerprints(fingerprints []string) ([]*model.HealthFinding, error) {
	s.mut.RLock()
	defer s.mut.RUnlock()

	results := []*model.HealthFinding{}
	seen := map[string]struct{}{}
	for _, fingerprint := range fingerprints {
		if _, ok := seen[fingerprint]; ok {
			continue
		}
		seen[fingerprint] = struct{}{}

		finding, ok := s.findings[fingerprint]
		if !ok {
			continue
		}

		results = append(results, cloneFinding(finding))
	}

	return results, nil
}

func (s *memoryStore) List(filter model.HealthFindingFilter) ([]*model.HealthFinding, error) {
	s.mut.RLock()
	defer s.mut.RUnlock()

	results := []*model.HealthFinding{}
	for _, finding := range s.findings {
		if !includesSurface(filter.Surfaces, finding.Surface) {
			continue
		}
		if filter.Muted == model.MutedOnly && !finding.IsMuted() {
			continue
		}
		if filter.Muted == model.MutedExcluded && finding.IsMuted() {
			continue
		}

		results = append(results, cloneFinding(finding))
	}

	slices.SortStableFunc(results, func(a, b *model.HealthFinding) int {
		return strings.Compare(a.Fingerprint, b.Fingerprint)
	})

	return results, nil
}

func (s *memoryStore) Upsert(findings []*model.HealthFinding) error {
	s.mut.Lock()
	defer s.mut.Unlock()

	// Collapse duplicate fingerprints to their last occurrence before touching the
	// map, so a duplicate never seeds a later one's mute retention. Matches the SQL store.
	deduped := make(map[string]*model.HealthFinding, len(findings))
	for _, finding := range findings {
		if finding == nil || finding.Fingerprint == "" {
			continue
		}
		deduped[finding.Fingerprint] = finding
	}

	for fp, finding := range deduped {
		stored := cloneFinding(finding)
		stored.PreSave()
		// Summary/Remediation/Message are rendered at the read boundary; the store never holds them.
		stored.Summary = ""
		stored.Remediation = ""
		stored.Message = ""

		// Mute state is owned by Mute/Unmute; an evaluation refresh carries no mute and must not clear an existing mute.
		if existing, ok := s.findings[fp]; ok && stored.MutedAt == 0 {
			stored.MutedAt = existing.MutedAt
			stored.MutedBy = existing.MutedBy
		}

		s.findings[fp] = stored
	}

	return nil
}

func (s *memoryStore) Mute(fingerprint, userID string, at int64) error {
	s.mut.Lock()
	defer s.mut.Unlock()

	finding, ok := s.findings[fingerprint]
	if !ok {
		return ErrFindingNotFound
	}

	finding.MutedAt = at
	finding.MutedBy = userID

	return nil
}

func (s *memoryStore) Unmute(fingerprint string) error {
	s.mut.Lock()
	defer s.mut.Unlock()

	finding, ok := s.findings[fingerprint]
	if !ok {
		return ErrFindingNotFound
	}

	finding.MutedAt = 0
	finding.MutedBy = ""

	return nil
}

func (s *memoryStore) DeleteBefore(lastSeenBefore int64) (int64, error) {
	s.mut.Lock()
	defer s.mut.Unlock()

	var deleted int64
	for fingerprint, finding := range s.findings {
		if finding.LastSeenAt < lastSeenBefore {
			delete(s.findings, fingerprint)
			deleted++
		}
	}

	return deleted, nil
}

func includesSurface(surfaces []string, surface string) bool {
	if len(surfaces) == 0 {
		return true
	}

	return slices.Contains(surfaces, surface)
}

func cloneFinding(finding *model.HealthFinding) *model.HealthFinding {
	if finding == nil {
		return nil
	}

	cloned := *finding
	if finding.Details != nil {
		cloned.Details = make(map[string]string, len(finding.Details))
		maps.Copy(cloned.Details, finding.Details)
	}

	return &cloned
}
