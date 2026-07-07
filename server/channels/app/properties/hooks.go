// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// errNilHookResult is returned when a pre-hook returns a nil result without an
// error. This catches buggy hook implementations early rather than letting a
// nil propagate into the store layer.
var (
	errNilHookResult          = errors.New("property hook returned nil result")
	errFieldCardinalityBroken = errors.New("PostGetPropertyFields hook returned fewer fields than it received")
)

// PropertyHook defines an interface for hooks that run before and after property
// service operations. Hooks can inspect and modify inputs (pre-hooks) or filter
// outputs (post-hooks). A pre-hook returns an error to block the operation; a
// post-hook returns an error to suppress the result. Returning nil means the
// hook has no objection and the operation may proceed.
//
// Pre-hooks receive the operation's input parameters and may return modified
// versions. Post-hooks receive the operation's results and may return filtered
// or modified versions.
//
// Multiple hooks are called in registration order. Each hook receives the
// output of the previous hook (or the original input for the first hook).
type PropertyHook interface {
	// Field pre-hooks (write operations)

	PreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error)
	PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error)
	PreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error)
	PreDeletePropertyField(rctx request.CTX, groupID string, id string) error

	// PostUpdatePropertyFields runs after a successful field update (including
	// the linked-field propagation pass). It receives the pre-update state of
	// the requested fields (parallel to requested), the post-update requested
	// fields, and the post-update propagated fields. Hooks may transform attrs
	// on either bucket (e.g. redact information for the caller); the
	// dispatcher enforces cardinality preservation on both buckets so a buggy
	// hook that drops fields surfaces an error rather than silently truncating
	// the broadcast. Returns the IDs of fields whose dependent property values
	// were cleared as a side effect (e.g. type-change cleanup); the caller
	// publishes the corresponding WS events. Errors are best-effort: the
	// dispatcher logs and continues, the update is not rolled back.
	PostUpdatePropertyFields(rctx request.CTX, groupID string, prev, requested, propagated []*model.PropertyField) (newRequested, newPropagated []*model.PropertyField, clearedFieldIDs []string, err error)

	// Field pre-hook for count operations. Count operations return only a
	// scalar so there is no post-hook — access control applied to per-row
	// data does not apply, but license/group-level gating still does.
	// Return an error to block the count.
	PreCountPropertyFields(rctx request.CTX, groupID string) error

	// Field post-hooks (read operations)
	//
	// PostGetPropertyField is called after retrieving a single field (by ID or by name).
	// Implementations must return a non-nil field; returning nil is treated as a
	// hook bug and the dispatcher surfaces errNilHookResult. To block a caller
	// from seeing a field, return a sentinel error instead.
	PostGetPropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error)
	// PostGetPropertyFields is called after retrieving multiple fields (by IDs or search).
	// Implementations must preserve slice length — the dispatcher enforces this and will
	// return an error if a hook returns fewer fields than it received.
	PostGetPropertyFields(rctx request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error)

	// Value pre-hooks (write operations)

	PreCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error)
	PreCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error)
	PreUpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error)
	PreUpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error)
	PreUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error)
	PreUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error)
	PreDeletePropertyValue(rctx request.CTX, groupID string, id string) error
	PreDeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error
	PreDeletePropertyValuesForField(rctx request.CTX, groupID string, fieldID string) error

	// Value post-hooks (write operations)
	//
	// These run after the store write is attempted — on both success and
	// failure (including pre-hook rejection) — so observers can audit the
	// outcome. opErr is nil on success and carries the rejection/store error on
	// failure. They are best-effort: the dispatcher logs and continues on a
	// hook error, and the write is never rolled back; hooks must not mutate the
	// values. Delete hooks receive the value's pre-delete snapshot (single,
	// nil if it did not exist) or the delete selector (target/field variants).
	PostCreatePropertyValue(rctx request.CTX, value *model.PropertyValue, opErr error) error
	PostCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue, opErr error) error
	PostUpdatePropertyValue(rctx request.CTX, value *model.PropertyValue, opErr error) error
	PostUpdatePropertyValues(rctx request.CTX, values []*model.PropertyValue, opErr error) error
	PostUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue, opErr error) error
	PostUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue, opErr error) error
	PostDeletePropertyValue(rctx request.CTX, deleted *model.PropertyValue, opErr error) error
	PostDeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string, opErr error) error
	PostDeletePropertyValuesForField(rctx request.CTX, groupID string, fieldID string, opErr error) error

	// Value post-hooks (read operations)
	//
	// PostGetPropertyValue is called after retrieving a single value.
	// Return nil value to indicate the value is not accessible.
	PostGetPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error)
	// PostGetPropertyValues is called after retrieving multiple values (by IDs or search).
	// Implementations may remove entries from the returned slice.
	PostGetPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error)
}

// BasePropertyHook provides default passthrough implementations for every
// PropertyHook method. Embed it in concrete hooks to only override the
// methods you care about.
type BasePropertyHook struct{}

func (BasePropertyHook) PreCreatePropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	return field, nil
}
func (BasePropertyHook) PreUpdatePropertyField(_ request.CTX, _ string, field *model.PropertyField) (*model.PropertyField, error) {
	return field, nil
}
func (BasePropertyHook) PreUpdatePropertyFields(_ request.CTX, _ string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return fields, nil
}
func (BasePropertyHook) PreDeletePropertyField(_ request.CTX, _ string, _ string) error {
	return nil
}
func (BasePropertyHook) PostUpdatePropertyFields(_ request.CTX, _ string, _, requested, propagated []*model.PropertyField) ([]*model.PropertyField, []*model.PropertyField, []string, error) {
	return requested, propagated, nil, nil
}
func (BasePropertyHook) PreCountPropertyFields(_ request.CTX, _ string) error {
	return nil
}
func (BasePropertyHook) PostGetPropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	return field, nil
}
func (BasePropertyHook) PostGetPropertyFields(_ request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return fields, nil
}
func (BasePropertyHook) PreCreatePropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, nil
}
func (BasePropertyHook) PreCreatePropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, nil
}
func (BasePropertyHook) PreUpdatePropertyValue(_ request.CTX, _ string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, nil
}
func (BasePropertyHook) PreUpdatePropertyValues(_ request.CTX, _ string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, nil
}
func (BasePropertyHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, nil
}
func (BasePropertyHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, nil
}
func (BasePropertyHook) PreDeletePropertyValue(_ request.CTX, _ string, _ string) error {
	return nil
}
func (BasePropertyHook) PreDeletePropertyValuesForTarget(_ request.CTX, _ string, _ string, _ string) error {
	return nil
}
func (BasePropertyHook) PreDeletePropertyValuesForField(_ request.CTX, _ string, _ string) error {
	return nil
}
func (BasePropertyHook) PostCreatePropertyValue(_ request.CTX, _ *model.PropertyValue, _ error) error {
	return nil
}
func (BasePropertyHook) PostCreatePropertyValues(_ request.CTX, _ []*model.PropertyValue, _ error) error {
	return nil
}
func (BasePropertyHook) PostUpdatePropertyValue(_ request.CTX, _ *model.PropertyValue, _ error) error {
	return nil
}
func (BasePropertyHook) PostUpdatePropertyValues(_ request.CTX, _ []*model.PropertyValue, _ error) error {
	return nil
}
func (BasePropertyHook) PostUpsertPropertyValue(_ request.CTX, _ *model.PropertyValue, _ error) error {
	return nil
}
func (BasePropertyHook) PostUpsertPropertyValues(_ request.CTX, _ []*model.PropertyValue, _ error) error {
	return nil
}
func (BasePropertyHook) PostDeletePropertyValue(_ request.CTX, _ *model.PropertyValue, _ error) error {
	return nil
}
func (BasePropertyHook) PostDeletePropertyValuesForTarget(_ request.CTX, _ string, _ string, _ string, _ error) error {
	return nil
}
func (BasePropertyHook) PostDeletePropertyValuesForField(_ request.CTX, _ string, _ string, _ error) error {
	return nil
}
func (BasePropertyHook) PostGetPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, nil
}
func (BasePropertyHook) PostGetPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, nil
}

// AddHook registers a hook with the property service. Hooks are called in
// registration order for each operation.
func (ps *PropertyService) AddHook(hook PropertyHook) {
	ps.hooks = append(ps.hooks, hook)
}

// runPreCreatePropertyField runs all registered pre-hooks for CreatePropertyField.
func (ps *PropertyService) runPreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	var err error
	for _, hook := range ps.hooks {
		field, err = hook.PreCreatePropertyField(rctx, field)
		if err != nil {
			return nil, err
		}
		if field == nil {
			return nil, errNilHookResult
		}
	}
	return field, nil
}

// runPreUpdatePropertyField runs all registered pre-hooks for UpdatePropertyField.
func (ps *PropertyService) runPreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	var err error
	for _, hook := range ps.hooks {
		field, err = hook.PreUpdatePropertyField(rctx, groupID, field)
		if err != nil {
			return nil, err
		}
		if field == nil {
			return nil, errNilHookResult
		}
	}
	return field, nil
}

// runPreUpdatePropertyFields runs all registered pre-hooks for UpdatePropertyFields.
func (ps *PropertyService) runPreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	var err error
	for _, hook := range ps.hooks {
		fields, err = hook.PreUpdatePropertyFields(rctx, groupID, fields)
		if err != nil {
			return nil, err
		}
		if fields == nil {
			return nil, errNilHookResult
		}
	}
	return fields, nil
}

// runPostUpdatePropertyFields runs all registered post-hooks for
// UpdatePropertyFields. Each hook may transform the requested and propagated
// buckets in place (e.g. redaction); the dispatcher chains the transformed
// slices through subsequent hooks and enforces cardinality preservation on
// both buckets so a buggy hook that drops fields surfaces an error rather
// than silently truncating the broadcast. The cleared field IDs returned by
// each hook are deduped into a single slice. Best-effort: hook errors and
// cardinality violations are logged and skipped (the offending hook's
// transform is dropped for the chain, but the update itself is not rolled
// back).
func (ps *PropertyService) runPostUpdatePropertyFields(rctx request.CTX, groupID string, prev, requested, propagated []*model.PropertyField) ([]*model.PropertyField, []*model.PropertyField, []string) {
	seen := map[string]struct{}{}
	var cleared []string
	for _, hook := range ps.hooks {
		newRequested, newPropagated, ids, err := hook.PostUpdatePropertyFields(rctx, groupID, prev, requested, propagated)
		if err != nil {
			rctx.Logger().Error("PostUpdatePropertyFields hook failed",
				mlog.String("group_id", groupID),
				mlog.Err(err),
			)
			continue
		}
		if len(newRequested) != len(requested) || len(newPropagated) != len(propagated) {
			rctx.Logger().Error("PostUpdatePropertyFields hook returned wrong-length slice",
				mlog.String("group_id", groupID),
				mlog.Err(errFieldCardinalityBroken),
			)
			continue
		}
		requested = newRequested
		propagated = newPropagated
		for _, id := range ids {
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			cleared = append(cleared, id)
		}
	}
	return requested, propagated, cleared
}

// runPreDeletePropertyField runs all registered pre-hooks for DeletePropertyField.
func (ps *PropertyService) runPreDeletePropertyField(rctx request.CTX, groupID string, id string) error {
	for _, hook := range ps.hooks {
		if err := hook.PreDeletePropertyField(rctx, groupID, id); err != nil {
			return err
		}
	}
	return nil
}

// runPreCountPropertyFields runs all registered pre-hooks for the public
// CountProperty* methods.
func (ps *PropertyService) runPreCountPropertyFields(rctx request.CTX, groupID string) error {
	for _, hook := range ps.hooks {
		if err := hook.PreCountPropertyFields(rctx, groupID); err != nil {
			return err
		}
	}
	return nil
}

// runPostGetPropertyField runs all registered post-hooks for single field retrieval.
func (ps *PropertyService) runPostGetPropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if field == nil {
		return nil, nil
	}
	var err error
	for _, hook := range ps.hooks {
		field, err = hook.PostGetPropertyField(rctx, field)
		if err != nil {
			return nil, err
		}
		if field == nil {
			return nil, errNilHookResult
		}
	}
	return field, nil
}

// runPostGetPropertyFields runs all registered post-hooks for multi-field retrieval.
// It enforces that hooks preserve slice length — a hook that drops fields is a bug.
func (ps *PropertyService) runPostGetPropertyFields(rctx request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	var err error
	for _, hook := range ps.hooks {
		n := len(fields)
		fields, err = hook.PostGetPropertyFields(rctx, fields)
		if err != nil {
			return nil, err
		}
		if len(fields) != n {
			return nil, errFieldCardinalityBroken
		}
	}
	return fields, nil
}

// runPreCreatePropertyValue runs all registered pre-hooks for CreatePropertyValue.
func (ps *PropertyService) runPreCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	var err error
	for _, hook := range ps.hooks {
		value, err = hook.PreCreatePropertyValue(rctx, value)
		if err != nil {
			return nil, err
		}
		if value == nil {
			return nil, errNilHookResult
		}
	}
	return value, nil
}

// runPreCreatePropertyValues runs all registered pre-hooks for CreatePropertyValues.
func (ps *PropertyService) runPreCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	var err error
	for _, hook := range ps.hooks {
		values, err = hook.PreCreatePropertyValues(rctx, values)
		if err != nil {
			return nil, err
		}
		if values == nil {
			return nil, errNilHookResult
		}
	}
	return values, nil
}

// runPreUpdatePropertyValue runs all registered pre-hooks for UpdatePropertyValue.
func (ps *PropertyService) runPreUpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	var err error
	for _, hook := range ps.hooks {
		value, err = hook.PreUpdatePropertyValue(rctx, groupID, value)
		if err != nil {
			return nil, err
		}
		if value == nil {
			return nil, errNilHookResult
		}
	}
	return value, nil
}

// runPreUpdatePropertyValues runs all registered pre-hooks for UpdatePropertyValues.
func (ps *PropertyService) runPreUpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	var err error
	for _, hook := range ps.hooks {
		values, err = hook.PreUpdatePropertyValues(rctx, groupID, values)
		if err != nil {
			return nil, err
		}
		if values == nil {
			return nil, errNilHookResult
		}
	}
	return values, nil
}

// runPreUpsertPropertyValue runs all registered pre-hooks for UpsertPropertyValue.
func (ps *PropertyService) runPreUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	var err error
	for _, hook := range ps.hooks {
		value, err = hook.PreUpsertPropertyValue(rctx, value)
		if err != nil {
			return nil, err
		}
		if value == nil {
			return nil, errNilHookResult
		}
	}
	return value, nil
}

// runPreUpsertPropertyValues runs all registered pre-hooks for UpsertPropertyValues.
func (ps *PropertyService) runPreUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	var err error
	for _, hook := range ps.hooks {
		values, err = hook.PreUpsertPropertyValues(rctx, values)
		if err != nil {
			return nil, err
		}
		if values == nil {
			return nil, errNilHookResult
		}
	}
	return values, nil
}

// runPreDeletePropertyValue runs all registered pre-hooks for DeletePropertyValue.
func (ps *PropertyService) runPreDeletePropertyValue(rctx request.CTX, groupID string, id string) error {
	for _, hook := range ps.hooks {
		if err := hook.PreDeletePropertyValue(rctx, groupID, id); err != nil {
			return err
		}
	}
	return nil
}

// runPreDeletePropertyValuesForTarget runs all registered pre-hooks for DeletePropertyValuesForTarget.
func (ps *PropertyService) runPreDeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	for _, hook := range ps.hooks {
		if err := hook.PreDeletePropertyValuesForTarget(rctx, groupID, targetType, targetID); err != nil {
			return err
		}
	}
	return nil
}

// runPreDeletePropertyValuesForField runs all registered pre-hooks for DeletePropertyValuesForField.
func (ps *PropertyService) runPreDeletePropertyValuesForField(rctx request.CTX, groupID string, fieldID string) error {
	for _, hook := range ps.hooks {
		if err := hook.PreDeletePropertyValuesForField(rctx, groupID, fieldID); err != nil {
			return err
		}
	}
	return nil
}

// runPostCreatePropertyValue runs all registered post-hooks for CreatePropertyValue.
// opErr carries the outcome (nil on success). Best-effort.
func (ps *PropertyService) runPostCreatePropertyValue(rctx request.CTX, value *model.PropertyValue, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostCreatePropertyValue(rctx, value, opErr); err != nil {
			rctx.Logger().Error("PostCreatePropertyValue hook failed", mlog.Err(err))
		}
	}
}

// runPostCreatePropertyValues runs all registered post-hooks for CreatePropertyValues.
// opErr carries the outcome (nil on success). Best-effort.
func (ps *PropertyService) runPostCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostCreatePropertyValues(rctx, values, opErr); err != nil {
			rctx.Logger().Error("PostCreatePropertyValues hook failed", mlog.Err(err))
		}
	}
}

// runPostUpdatePropertyValue runs all registered post-hooks for UpdatePropertyValue.
// opErr carries the outcome. Best-effort.
func (ps *PropertyService) runPostUpdatePropertyValue(rctx request.CTX, value *model.PropertyValue, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostUpdatePropertyValue(rctx, value, opErr); err != nil {
			rctx.Logger().Error("PostUpdatePropertyValue hook failed", mlog.Err(err))
		}
	}
}

// runPostUpdatePropertyValues runs all registered post-hooks for UpdatePropertyValues.
// opErr carries the outcome. Best-effort.
func (ps *PropertyService) runPostUpdatePropertyValues(rctx request.CTX, values []*model.PropertyValue, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostUpdatePropertyValues(rctx, values, opErr); err != nil {
			rctx.Logger().Error("PostUpdatePropertyValues hook failed", mlog.Err(err))
		}
	}
}

// runPostUpsertPropertyValue runs all registered post-hooks for UpsertPropertyValue.
// opErr carries the outcome (nil on success). Best-effort: hook errors are
// logged and skipped; the write is not rolled back.
func (ps *PropertyService) runPostUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostUpsertPropertyValue(rctx, value, opErr); err != nil {
			rctx.Logger().Error("PostUpsertPropertyValue hook failed", mlog.Err(err))
		}
	}
}

// runPostUpsertPropertyValues runs all registered post-hooks for UpsertPropertyValues.
// opErr carries the outcome (nil on success). Best-effort.
func (ps *PropertyService) runPostUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostUpsertPropertyValues(rctx, values, opErr); err != nil {
			rctx.Logger().Error("PostUpsertPropertyValues hook failed", mlog.Err(err))
		}
	}
}

// runPostDeletePropertyValue runs all registered post-hooks for DeletePropertyValue.
// deleted is the pre-delete snapshot; opErr carries the outcome. Best-effort.
func (ps *PropertyService) runPostDeletePropertyValue(rctx request.CTX, deleted *model.PropertyValue, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostDeletePropertyValue(rctx, deleted, opErr); err != nil {
			rctx.Logger().Error("PostDeletePropertyValue hook failed", mlog.Err(err))
		}
	}
}

// runPostDeletePropertyValuesForTarget runs all registered post-hooks for DeletePropertyValuesForTarget.
// opErr carries the outcome. Best-effort.
func (ps *PropertyService) runPostDeletePropertyValuesForTarget(rctx request.CTX, groupID, targetType, targetID string, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostDeletePropertyValuesForTarget(rctx, groupID, targetType, targetID, opErr); err != nil {
			rctx.Logger().Error("PostDeletePropertyValuesForTarget hook failed", mlog.Err(err))
		}
	}
}

// runPostDeletePropertyValuesForField runs all registered post-hooks for DeletePropertyValuesForField.
// opErr carries the outcome. Best-effort.
func (ps *PropertyService) runPostDeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string, opErr error) {
	for _, hook := range ps.hooks {
		if err := hook.PostDeletePropertyValuesForField(rctx, groupID, fieldID, opErr); err != nil {
			rctx.Logger().Error("PostDeletePropertyValuesForField hook failed", mlog.Err(err))
		}
	}
}

// runPostGetPropertyValue runs all registered post-hooks for single value retrieval.
func (ps *PropertyService) runPostGetPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, nil
	}
	var err error
	for _, hook := range ps.hooks {
		value, err = hook.PostGetPropertyValue(rctx, value)
		if err != nil {
			return nil, err
		}
		if value == nil {
			return nil, nil
		}
	}
	return value, nil
}

// runPostGetPropertyValues runs all registered post-hooks for multi-value retrieval.
func (ps *PropertyService) runPostGetPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	var err error
	for _, hook := range ps.hooks {
		values, err = hook.PostGetPropertyValues(rctx, values)
		if err != nil {
			return nil, err
		}
	}
	return values, nil
}
