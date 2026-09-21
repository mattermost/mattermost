// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

type SqlHealthFindingStore struct {
	*SqlStore
}

type healthFindingRow struct {
	Fingerprint     string `db:"fingerprint"`
	Code            string `db:"code"`
	Subject         string `db:"subject"`
	Scope           string `db:"scope"`
	Severity        string `db:"severity"`
	State           string `db:"state"`
	Area            string `db:"area"`
	Surface         string `db:"surface"`
	MessageID       string `db:"messageid"`
	Details         []byte `db:"details"`
	FirstSeenAt     int64  `db:"firstseenat"`
	LastSeenAt      int64  `db:"lastseenat"`
	StateSince      int64  `db:"statesince"`
	ConsecutiveHits int    `db:"consecutivehits"`
	MutedAt         int64  `db:"mutedat"`
	MutedBy         string `db:"mutedby"`
}

func newSqlHealthFindingStore(sqlStore *SqlStore) store.HealthFindingStore {
	return &SqlHealthFindingStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlHealthFindingStore) GetByFingerprints(fingerprints []string) ([]*model.HealthFinding, error) {
	uniqueFingerprints := make([]string, 0, len(fingerprints))
	seen := make(map[string]struct{}, len(fingerprints))
	for _, fingerprint := range fingerprints {
		if _, ok := seen[fingerprint]; ok {
			continue
		}
		seen[fingerprint] = struct{}{}
		uniqueFingerprints = append(uniqueFingerprints, fingerprint)
	}

	if len(uniqueFingerprints) == 0 {
		return []*model.HealthFinding{}, nil
	}

	query := s.baseSelectBuilder().
		Where(sq.Eq{"fingerprint": uniqueFingerprints})

	var rows []healthFindingRow
	if err := s.GetReplica().SelectBuilder(&rows, query); err != nil {
		return nil, errors.Wrap(err, "failed to get health findings by fingerprints")
	}

	findingsByFingerprint := make(map[string]*model.HealthFinding, len(rows))
	for _, row := range rows {
		finding, err := row.toModel()
		if err != nil {
			return nil, err
		}
		findingsByFingerprint[finding.Fingerprint] = finding
	}

	findings := make([]*model.HealthFinding, 0, len(rows))
	for _, fingerprint := range uniqueFingerprints {
		finding, ok := findingsByFingerprint[fingerprint]
		if !ok {
			continue
		}
		findings = append(findings, finding)
	}

	return findings, nil
}

func (s *SqlHealthFindingStore) List(filter model.HealthFindingFilter) ([]*model.HealthFinding, error) {
	query := s.baseSelectBuilder().
		OrderBy("fingerprint")

	if len(filter.Surfaces) > 0 {
		query = query.Where(sq.Eq{"surface": filter.Surfaces})
	}
	switch filter.Muted {
	case model.MutedOnly:
		query = query.Where(sq.Gt{"mutedat": 0})
	case model.MutedExcluded:
		query = query.Where(sq.Eq{"mutedat": 0})
	}

	var rows []healthFindingRow
	if err := s.GetReplica().SelectBuilder(&rows, query); err != nil {
		return nil, errors.Wrap(err, "failed to list health findings")
	}

	findings := make([]*model.HealthFinding, 0, len(rows))
	for _, row := range rows {
		finding, err := row.toModel()
		if err != nil {
			return nil, err
		}
		findings = append(findings, finding)
	}

	return findings, nil
}

func (s *SqlHealthFindingStore) Upsert(findings []*model.HealthFinding) error {
	// A single ON CONFLICT statement cannot touch the same fingerprint twice, so
	// collapse duplicates to their last occurrence, matching the memory store's last-write-wins.
	validFindings := make([]*model.HealthFinding, 0, len(findings))
	indexByFingerprint := make(map[string]int, len(findings))
	for _, finding := range findings {
		if finding == nil || finding.Fingerprint == "" {
			continue
		}
		if idx, ok := indexByFingerprint[finding.Fingerprint]; ok {
			validFindings[idx] = finding
			continue
		}
		indexByFingerprint[finding.Fingerprint] = len(validFindings)
		validFindings = append(validFindings, finding)
	}

	if len(validFindings) == 0 {
		return nil
	}

	columns := []string{
		"fingerprint",
		"code",
		"subject",
		"scope",
		"severity",
		"state",
		"area",
		"surface",
		"messageid",
		"details",
		"firstseenat",
		"lastseenat",
		"statesince",
		"consecutivehits",
		"mutedat",
		"mutedby",
	}
	onConflictSet := `ON CONFLICT (fingerprint) DO UPDATE SET
code = EXCLUDED.code,
subject = EXCLUDED.subject,
scope = EXCLUDED.scope,
severity = EXCLUDED.severity,
state = EXCLUDED.state,
area = EXCLUDED.area,
surface = EXCLUDED.surface,
messageid = EXCLUDED.messageid,
details = EXCLUDED.details,
firstseenat = EXCLUDED.firstseenat,
lastseenat = EXCLUDED.lastseenat,
statesince = EXCLUDED.statesince,
consecutivehits = EXCLUDED.consecutivehits,
mutedat = CASE WHEN EXCLUDED.mutedat = 0 THEN healthfindings.mutedat ELSE EXCLUDED.mutedat END,
mutedby = CASE WHEN EXCLUDED.mutedat = 0 THEN healthfindings.mutedby ELSE EXCLUDED.mutedby END`

	for _, chunk := range chunkSlice(validFindings, len(columns), s.getMaxInsertParams()) {
		query := s.getQueryBuilder().
			Insert("healthfindings").
			Columns(columns...).
			Suffix(onConflictSet)

		for _, finding := range chunk {
			details := finding.Details
			if details == nil {
				details = map[string]string{}
			}
			serializedDetails, err := json.Marshal(details)
			if err != nil {
				return errors.Wrapf(err, "failed to serialize details for finding %s", finding.Fingerprint)
			}

			query = query.Values(
				finding.Fingerprint,
				finding.Code,
				finding.Subject,
				finding.Scope,
				finding.Severity,
				finding.State,
				finding.Area,
				finding.Surface,
				finding.MessageID,
				string(serializedDetails),
				finding.FirstSeenAt,
				finding.LastSeenAt,
				finding.StateSince,
				finding.ConsecutiveHits,
				finding.MutedAt,
				finding.MutedBy,
			)
		}

		if _, err := s.GetMaster().ExecBuilder(query); err != nil {
			return errors.Wrap(err, "failed to upsert health findings")
		}
	}

	return nil
}

func (s *SqlHealthFindingStore) Mute(fingerprint, userID string, at int64) error {
	query := s.getQueryBuilder().
		Update("healthfindings").
		Set("mutedat", at).
		Set("mutedby", userID).
		Where(sq.Eq{"fingerprint": fingerprint})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrap(err, "failed to mute health finding")
	}

	updatedRows, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to read mute rows affected")
	}
	if updatedRows == 0 {
		return healthcheck.ErrFindingNotFound
	}

	return nil
}

func (s *SqlHealthFindingStore) Unmute(fingerprint string) error {
	query := s.getQueryBuilder().
		Update("healthfindings").
		Set("mutedat", 0).
		Set("mutedby", "").
		Where(sq.Eq{"fingerprint": fingerprint})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrap(err, "failed to unmute health finding")
	}

	updatedRows, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to read unmute rows affected")
	}
	if updatedRows == 0 {
		return healthcheck.ErrFindingNotFound
	}

	return nil
}

func (s *SqlHealthFindingStore) DeleteBefore(lastSeenBefore int64) (int64, error) {
	query := s.getQueryBuilder().
		Delete("healthfindings").
		Where(sq.Lt{"lastseenat": lastSeenBefore})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete stale health findings")
	}

	deletedRows, err := result.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "failed to read deleted rows count")
	}

	return deletedRows, nil
}

func (s *SqlHealthFindingStore) baseSelectBuilder() sq.SelectBuilder {
	return s.getQueryBuilder().
		Select(
			"fingerprint",
			"code",
			"subject",
			"scope",
			"severity",
			"state",
			"area",
			"surface",
			"messageid",
			"details",
			"firstseenat",
			"lastseenat",
			"statesince",
			"consecutivehits",
			"mutedat",
			"mutedby",
		).
		From("healthfindings")
}

func (r *healthFindingRow) toModel() (*model.HealthFinding, error) {
	details := map[string]string{}
	if len(r.Details) > 0 {
		if err := json.Unmarshal(r.Details, &details); err != nil {
			return nil, errors.Wrap(err, "failed to deserialize health finding details")
		}
	}

	return &model.HealthFinding{
		Fingerprint:     r.Fingerprint,
		Code:            r.Code,
		Subject:         r.Subject,
		Scope:           r.Scope,
		Severity:        r.Severity,
		State:           r.State,
		Area:            model.HealthArea(r.Area),
		Surface:         r.Surface,
		MessageID:       r.MessageID,
		Details:         details,
		FirstSeenAt:     r.FirstSeenAt,
		LastSeenAt:      r.LastSeenAt,
		StateSince:      r.StateSince,
		ConsecutiveHits: r.ConsecutiveHits,
		MutedAt:         r.MutedAt,
		MutedBy:         r.MutedBy,
	}, nil
}
