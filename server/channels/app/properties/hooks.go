// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"

	"github.com/mattermost/mattermost/server/public/model"
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

	// Field pre-hook for count operations. Count operations return only a
	// scalar so there is no post-hook — access control applied to per-row
	// data does not apply, but license/group-level gating still does.
	// Return an error to block the count.
	PreCountPropertyFields(rctx request.CTX, groupID string) error

	// Field post-hooks (read operations)
	//
	// PostGetPropertyField is called after retrieving a single field (by ID or by name).
	// Return nil field to indicate the field is not accessible.
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
			return nil, nil
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
