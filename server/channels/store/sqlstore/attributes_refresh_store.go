// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// attributeViewRefreshLockNamespace is the first key of the two-int4 advisory lock taken around a
// background refresh of an attribute view; the second is the view's entry in
// attributeViewRefreshLockKeys. The two-int4 form lives in a key space apart from the single
// bigint key morph takes for migrations, so the two can't collide.
const attributeViewRefreshLockNamespace = 0x4D4D4156 // "MMAV"

var attributeViewRefreshLockKeys = map[string]int32{
	model.PropertyFieldObjectTypeUser:    1,
	model.PropertyFieldObjectTypeChannel: 2,
}

// attributeViewLastRefreshKeyPrefix names the Systems row, one per object type, that records the
// start (in the database's time) and duration of the last coordinated refresh of that view.
const attributeViewLastRefreshKeyPrefix = "AttributeViewLastRefresh_"

type attributeViewLastRefresh struct {
	// StartMicros is when the refresh began, in microseconds since the Unix epoch on the
	// database's clock. Every write committed before it is in the refreshed view.
	StartMicros int64 `json:"start_micros"`
	// DurationMillis is how long the REFRESH statement took.
	DurationMillis int64 `json:"duration_millis"`
}

// GetAttributeRefreshToken returns the master database's current time at microsecond precision.
// A write that committed before the call is in any refresh that starts at or after the returned
// time, so a refresh can be compared against it without trusting any node's clock.
func (s *SqlAttributesStore) GetAttributeRefreshToken(rctx request.CTX) (time.Time, error) {
	var now time.Time
	if err := s.GetMaster().Get(&now, "SELECT clock_timestamp()"); err != nil {
		return time.Time{}, errors.Wrap(err, "failed to read the database time")
	}
	return now, nil
}

// RefreshAttributesIfStale refreshes one attribute materialized view, unless another refresh
// already covers token or ran too recently. It is safe to call from any number of nodes at once:
// it runs in one transaction that
//
//  1. takes the view's advisory lock without waiting, and returns busy if another session holds
//     it (a refresh of this view is running somewhere);
//  2. returns covered if the last refresh started at or after token, since everything committed
//     before token is already in the view;
//  3. returns gap, with the time left, if the last refresh started less than the gap ago. The gap
//     is minGap, or the last refresh's duration if that is longer, so back-to-back refreshes
//     can't keep one backend busy; minGap 0 turns the check off;
//  4. otherwise records the start, runs REFRESH MATERIALIZED VIEW CONCURRENTLY, records the start
//     and duration in the view's Systems row, and commits, which releases the lock.
//
// All times are the database's, so clock skew between nodes doesn't matter. The REFRESH runs
// without a query timeout, and once started it can't be cancelled: transactions don't take the
// caller's context. Callers retry busy and gap themselves, with the same token.
func (s *SqlAttributesStore) RefreshAttributesIfStale(rctx request.CTX, objectType string, token time.Time, minGap time.Duration) (result store.AttributeViewRefreshResult, err error) {
	view, err := attributeViewFor(objectType)
	if err != nil {
		return result, err
	}
	lockKey, ok := attributeViewRefreshLockKeys[objectType]
	if !ok {
		return result, errors.Errorf("no refresh lock key for object type %q", objectType)
	}

	tx, err := s.GetMaster().Begin()
	if err != nil {
		return result, errors.Wrap(err, "failed to begin the attribute view refresh transaction")
	}
	defer finalizeTransactionX(tx, &err)

	var locked bool
	if err = tx.Get(&locked, "SELECT pg_try_advisory_xact_lock($1, $2)", int32(attributeViewRefreshLockNamespace), lockKey); err != nil {
		return result, errors.Wrapf(err, "failed to try the refresh lock for %s", view)
	}
	if !locked {
		result.Outcome = store.AttributeViewRefreshBusy
		return result, nil
	}

	systemKey := attributeViewLastRefreshKeyPrefix + objectType
	var last attributeViewLastRefresh
	var raw string
	switch err = tx.Get(&raw, "SELECT Value FROM Systems WHERE Name = $1", systemKey); {
	case errors.Is(err, sql.ErrNoRows):
		err = nil
	case err != nil:
		return result, errors.Wrapf(err, "failed to read the last refresh of %s", view)
	default:
		if err = json.Unmarshal([]byte(raw), &last); err != nil {
			return result, errors.Wrapf(err, "failed to decode the last refresh of %s", view)
		}
	}

	var start time.Time
	if err = tx.Get(&start, "SELECT statement_timestamp()"); err != nil {
		return result, errors.Wrap(err, "failed to read the database time")
	}

	if last.StartMicros != 0 {
		lastStart := time.UnixMicro(last.StartMicros)
		if !lastStart.Before(token) {
			result.Outcome = store.AttributeViewRefreshCovered
			return result, nil
		}
		gap := max(minGap, time.Duration(last.DurationMillis)*time.Millisecond)
		if elapsed := start.Sub(lastStart); minGap > 0 && elapsed < gap {
			result.Outcome = store.AttributeViewRefreshGap
			result.RetryAfter = gap - elapsed
			return result, nil
		}
	}

	refreshStart := time.Now()
	if _, err = tx.ExecNoTimeout("REFRESH MATERIALIZED VIEW CONCURRENTLY " + view); err != nil {
		return result, errors.Wrapf(err, "failed to refresh materialized view %s", view)
	}
	duration := time.Since(refreshStart)

	value, err := json.Marshal(attributeViewLastRefresh{StartMicros: start.UnixMicro(), DurationMillis: duration.Milliseconds()})
	if err != nil {
		return result, errors.Wrap(err, "failed to encode the last refresh")
	}
	if _, err = tx.Exec(`INSERT INTO Systems (Name, Value) VALUES ($1, $2)
		ON CONFLICT (Name) DO UPDATE SET Value = EXCLUDED.Value`, systemKey, string(value)); err != nil {
		return result, errors.Wrapf(err, "failed to record the refresh of %s", view)
	}

	if err = tx.Commit(); err != nil {
		return result, errors.Wrapf(err, "failed to commit the refresh of %s", view)
	}

	result.Outcome = store.AttributeViewRefreshRefreshed
	result.Duration = duration
	return result, nil
}
