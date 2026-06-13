// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

// FindingStore is the persistence interface for the health-check findings
// state machine. It is defined in this package (not in channels/store) so
// that healthcheck remains a leaf — the sqlstore implementation imports
// healthcheck, never the reverse.
//
// All methods are fingerprint-keyed. A fingerprint is the stable identity of
// a finding instance (for P1 it equals the rule code).
type FindingStore interface {
	// UpsertMany writes the given records to the store, inserting new rows and
	// updating existing ones. The caller provides the complete updated state;
	// the store sets UpdatedAt on each row.
	UpsertMany(records []FindingRecord) error

	// GetAll returns all persisted finding records.
	GetAll() ([]FindingRecord, error)

	// GetByFingerprint returns the record for a single fingerprint, or
	// ErrNotFound if no record exists.
	GetByFingerprint(fingerprint string) (FindingRecord, error)

	// SetMute mutes the finding identified by fingerprint.
	// mutedAt is the Unix-ms timestamp; mutedByUserID is the muting user.
	SetMute(fingerprint string, mutedAt int64, mutedByUserID string) error

	// ClearMute removes the mute on the finding identified by fingerprint.
	ClearMute(fingerprint string) error

	// GetMuted returns all muted findings ("My muted findings" view).
	GetMuted() ([]FindingRecord, error)
}

// ErrNotFound is returned by GetByFingerprint when no record exists.
type ErrNotFound struct{ Fingerprint string }

func (e ErrNotFound) Error() string {
	return "healthcheck: finding not found: " + e.Fingerprint
}
