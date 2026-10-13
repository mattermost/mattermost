// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"errors"

	"github.com/mattermost/mattermost/server/public/model"
)

type FindingStore interface {
	// GetByFingerprints treats fingerprints as a set: empty entries are ignored, duplicates
	// collapse, and each matching finding is returned at most once. Order is not guaranteed.
	GetByFingerprints(fingerprints []string) ([]*model.HealthFinding, error)
	List(filter model.HealthFindingFilter) ([]*model.HealthFinding, error)
	Upsert(findings []*model.HealthFinding) error
	Mute(fingerprint, userID string, at int64) error
	Unmute(fingerprint string) error
	DeleteBefore(lastSeenBefore int64) (int64, error)
}

var ErrFindingNotFound = errors.New("health finding not found")
