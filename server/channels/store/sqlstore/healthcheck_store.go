// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/healthcheck"
)

// SqlHealthCheckStore implements [healthcheck.FindingStore] against the shared
// SqlStore. It is intentionally NOT wired into the monolithic store.Store
// interface to avoid the store-layers regeneration ceremony (retrylayer /
// timerlayer / opentracinglayer). The health-check evaluation job (WS5) will
// construct it directly via NewSqlHealthCheckStore.
type SqlHealthCheckStore struct {
	*SqlStore
	selectQ sq.SelectBuilder
}

// NewSqlHealthCheckStore constructs a healthcheck.FindingStore backed by the
// provided SqlStore. The schema must already exist (applied by migration 194).
func NewSqlHealthCheckStore(ss *SqlStore) healthcheck.FindingStore {
	s := &SqlHealthCheckStore{SqlStore: ss}
	s.selectQ = s.getQueryBuilder().
		Select(
			"Fingerprint",
			"RuleCode",
			"State",
			"FirstFiredAt",
			"LastFiredAt",
			"ResolvedAt",
			"ConsecutiveFailures",
			"MutedAt",
			"MutedByUserId",
			"UpdatedAt",
		).
		From("HealthCheckFindings")
	return s
}

// dbFinding is the database row representation. sqlx uses the db struct tags
// to map columns.
type dbFinding struct {
	Fingerprint         string `db:"Fingerprint"`
	RuleCode            string `db:"RuleCode"`
	State               string `db:"State"`
	FirstFiredAt        int64  `db:"FirstFiredAt"`
	LastFiredAt         int64  `db:"LastFiredAt"`
	ResolvedAt          int64  `db:"ResolvedAt"`
	ConsecutiveFailures int    `db:"ConsecutiveFailures"`
	MutedAt             int64  `db:"MutedAt"`
	MutedByUserID       string `db:"MutedByUserId"`
	UpdatedAt           int64  `db:"UpdatedAt"`
}

func toDBFinding(r healthcheck.FindingRecord, updatedAt int64) dbFinding {
	return dbFinding{
		Fingerprint:         r.Fingerprint,
		RuleCode:            r.RuleCode,
		State:               string(r.State),
		FirstFiredAt:        r.FirstFiredAt,
		LastFiredAt:         r.LastFiredAt,
		ResolvedAt:          r.ResolvedAt,
		ConsecutiveFailures: r.ConsecutiveFailures,
		MutedAt:             r.MutedAt,
		MutedByUserID:       r.MutedByUserID,
		UpdatedAt:           updatedAt,
	}
}

func fromDBFinding(d dbFinding) healthcheck.FindingRecord {
	return healthcheck.FindingRecord{
		Fingerprint:         d.Fingerprint,
		RuleCode:            d.RuleCode,
		State:               healthcheck.FindingState(d.State),
		FirstFiredAt:        d.FirstFiredAt,
		LastFiredAt:         d.LastFiredAt,
		ResolvedAt:          d.ResolvedAt,
		ConsecutiveFailures: d.ConsecutiveFailures,
		MutedAt:             d.MutedAt,
		MutedByUserID:       d.MutedByUserID,
	}
}

func (s *SqlHealthCheckStore) UpsertMany(records []healthcheck.FindingRecord) error {
	if len(records) == 0 {
		return nil
	}

	now := nowMS()

	for _, r := range records {
		d := toDBFinding(r, now)
		_, err := s.GetMaster().NamedExec(`
			INSERT INTO HealthCheckFindings
				(Fingerprint, RuleCode, State, FirstFiredAt, LastFiredAt, ResolvedAt,
				 ConsecutiveFailures, MutedAt, MutedByUserId, UpdatedAt)
			VALUES
				(:Fingerprint, :RuleCode, :State, :FirstFiredAt, :LastFiredAt, :ResolvedAt,
				 :ConsecutiveFailures, :MutedAt, :MutedByUserId, :UpdatedAt)
			ON CONFLICT (Fingerprint) DO UPDATE SET
				RuleCode             = EXCLUDED.RuleCode,
				State                = EXCLUDED.State,
				FirstFiredAt         = EXCLUDED.FirstFiredAt,
				LastFiredAt          = EXCLUDED.LastFiredAt,
				ResolvedAt           = EXCLUDED.ResolvedAt,
				ConsecutiveFailures  = EXCLUDED.ConsecutiveFailures,
				MutedAt              = EXCLUDED.MutedAt,
				MutedByUserId        = EXCLUDED.MutedByUserId,
				UpdatedAt            = EXCLUDED.UpdatedAt
		`, &d)
		if err != nil {
			return errors.Wrapf(err, "healthcheck: upsert finding %q", r.Fingerprint)
		}
	}
	return nil
}

func (s *SqlHealthCheckStore) GetAll() ([]healthcheck.FindingRecord, error) {
	var rows []dbFinding
	q, args, err := s.selectQ.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "healthcheck: build GetAll query")
	}
	if err := s.GetReplica().Select(&rows, q, args...); err != nil {
		return nil, errors.Wrap(err, "healthcheck: GetAll")
	}
	out := make([]healthcheck.FindingRecord, 0, len(rows))
	for _, d := range rows {
		out = append(out, fromDBFinding(d))
	}
	return out, nil
}

func (s *SqlHealthCheckStore) GetByFingerprint(fingerprint string) (healthcheck.FindingRecord, error) {
	var d dbFinding
	q, args, err := s.selectQ.Where(sq.Eq{"Fingerprint": fingerprint}).ToSql()
	if err != nil {
		return healthcheck.FindingRecord{}, errors.Wrap(err, "healthcheck: build GetByFingerprint query")
	}
	if err := s.GetReplica().Get(&d, q, args...); err != nil {
		if err == sql.ErrNoRows {
			return healthcheck.FindingRecord{}, healthcheck.ErrNotFound{Fingerprint: fingerprint}
		}
		return healthcheck.FindingRecord{}, errors.Wrapf(err, "healthcheck: GetByFingerprint %q", fingerprint)
	}
	return fromDBFinding(d), nil
}

func (s *SqlHealthCheckStore) SetMute(fingerprint string, mutedAt int64, mutedByUserID string) error {
	_, err := s.GetMaster().Exec(
		`UPDATE HealthCheckFindings SET MutedAt = $1, MutedByUserId = $2, UpdatedAt = $3 WHERE Fingerprint = $4`,
		mutedAt, mutedByUserID, nowMS(), fingerprint,
	)
	if err != nil {
		return errors.Wrapf(err, "healthcheck: SetMute %q", fingerprint)
	}
	return nil
}

func (s *SqlHealthCheckStore) ClearMute(fingerprint string) error {
	_, err := s.GetMaster().Exec(
		`UPDATE HealthCheckFindings SET MutedAt = 0, MutedByUserId = '', UpdatedAt = $1 WHERE Fingerprint = $2`,
		nowMS(), fingerprint,
	)
	if err != nil {
		return errors.Wrapf(err, "healthcheck: ClearMute %q", fingerprint)
	}
	return nil
}

func (s *SqlHealthCheckStore) GetMuted() ([]healthcheck.FindingRecord, error) {
	var rows []dbFinding
	q, args, err := s.selectQ.Where(sq.Gt{"MutedAt": 0}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "healthcheck: build GetMuted query")
	}
	if err := s.GetReplica().Select(&rows, q, args...); err != nil {
		return nil, errors.Wrap(err, "healthcheck: GetMuted")
	}
	out := make([]healthcheck.FindingRecord, 0, len(rows))
	for _, d := range rows {
		out = append(out, fromDBFinding(d))
	}
	return out, nil
}

// nowMS returns the current time as Unix milliseconds, consistent with the
// rest of the store layer.
func nowMS() int64 {
	return model.GetMillis()
}
