// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// valueWriteConditions is what the value checks in a write's pre-hooks tell
// the service about the writes they judged. The hooks run before the store
// write, so a check that compared the new value with the stored row would be
// stale by the time the write lands if another writer got in between. The
// check records what it read here, and the service makes the write
// conditional on those rows being unchanged. It is plain data on the request
// context, not a lock.
type valueWriteConditions struct {
	// read holds, per field and target, the value the check read; a nil
	// entry means it found no live row.
	read map[store.PropertyValueKey]json.RawMessage
	// keepFieldIDs are the fields whose rows a delete of everything on a
	// target must leave alone.
	keepFieldIDs []string
}

type valueWriteConditionsKey struct{}

// withValueWriteConditions attaches a fresh, empty record to rctx. Every
// public value-write method calls it, even when rctx already carries one, so
// one write's record never leaks into another's.
func withValueWriteConditions(rctx request.CTX) (request.CTX, *valueWriteConditions) {
	c := &valueWriteConditions{read: make(map[store.PropertyValueKey]json.RawMessage)}
	return rctx.WithContext(context.WithValue(rctx.Context(), valueWriteConditionsKey{}, c)), c
}

// valueWriteConditionsFrom returns the record on rctx, or nil when no write
// method created one. A check that must record and finds nil has to refuse
// the write: it cannot make it conditional.
func valueWriteConditionsFrom(rctx request.CTX) *valueWriteConditions {
	c, _ := rctx.Context().Value(valueWriteConditionsKey{}).(*valueWriteConditions)
	return c
}

// expectStored records that the check for this field and target read stored,
// where nil means it found no live row.
func (c *valueWriteConditions) expectStored(fieldID, targetID string, stored *model.PropertyValue) {
	var raw json.RawMessage
	if stored != nil {
		raw = stored.Value
	}
	c.read[store.PropertyValueKey{FieldID: fieldID, TargetID: targetID}] = raw
}

// keepField adds a field whose rows a delete of everything on a target must
// leave alone.
func (c *valueWriteConditions) keepField(fieldID string) {
	if !slices.Contains(c.keepFieldIDs, fieldID) {
		c.keepFieldIDs = append(c.keepFieldIDs, fieldID)
	}
}

// conditionalReads returns the record's reads, or nil when it holds none, so
// callers can tell an ordinary write from a conditional one.
func (c *valueWriteConditions) conditionalReads() map[store.PropertyValueKey]json.RawMessage {
	if c == nil || len(c.read) == 0 {
		return nil
	}
	return c.read
}

// newValueWriteConflictError returns the refusal for a write that lost a race.
// The store error is not wrapped: mapPropertyServiceError checks for
// *store.ErrConflict before it checks for an AppError, and would relabel a
// wrapped one as a property field conflict.
//
// The i18n ID is written inline: i18n-extract only sees IDs passed literally
// to NewAppError.
func newValueWriteConflictError(err error) error {
	return model.NewAppError("PropertyService", "app.property_value.write_conflict.app_error", nil, err.Error(), http.StatusConflict)
}

// asValueWriteConflict turns a store conflict into the refusal above and
// returns any other error as it is.
func asValueWriteConflict(err error) error {
	if _, ok := errors.AsType[*store.ErrConflict](err); ok {
		return newValueWriteConflictError(err)
	}
	return err
}
