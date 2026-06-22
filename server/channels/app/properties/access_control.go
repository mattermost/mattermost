// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

// This file implements access control for property fields and values using three key mechanisms:
//
// 1. Protected Fields (protected attribute):
//    - Protected fields can only be modified by their source plugin (identified by source_plugin_id)
//    - Non-protected fields can be modified by any caller with appropriate access
//
// 2. Access Mode (access_mode attribute):
//    - Controls read access to field metadata (like options) and values
//    - Three modes:
//      * Public (empty string, default): Everyone can read all data
//      * Source-only: Only the source plugin can read full field options and values; others see empty options and no values
//      * Shared-only: Callers can only see field options and values they share with the target
//                     (Example: If Alice selected Apples and Bananas, and Bob selected Bananas and Oranges,
//                      then Alice querying Bob's values would only see Bananas)

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var (
	ErrAccessDenied      = errors.New("access denied")
	ErrSyncLocked        = errors.New("field is managed by external sync")
	ErrInvalidAccessMode = errors.New("invalid access_mode")
	ErrFieldNotFound     = errors.New("property field not found")
)

const (
	propertyAccessPaginationPageSize      = 100
	propertyAccessMaxPaginationIterations = 10
)

// PluginChecker is a function type that checks if a plugin is installed.
// Returns true if the plugin exists and is installed, false otherwise.
type PluginChecker func(pluginID string) bool

// AccessControlHook implements the PropertyHook interface to enforce access
// control based on caller identity. It checks protected fields, plugin
// ownership, and access modes (public, source-only, shared-only).
//
// The hook only applies to groups whose IDs are in managedGroupIDs. Operations
// on other groups pass through without access control checks.
type AccessControlHook struct {
	propertyService *PropertyService
	pluginChecker   PluginChecker
	managedGroupIDs map[string]struct{}
}

// Compile-time check that AccessControlHook implements PropertyHook.
var _ PropertyHook = (*AccessControlHook)(nil)

// NewAccessControlHook creates a new AccessControlHook.
// It receives the PropertyService to call private methods for database lookups
// needed during access control checks. The pluginChecker function is used to
// verify plugin installation status when checking access to protected fields.
// Pass nil for pluginChecker if plugin checking is not needed (e.g., in tests).
// managedGroupIDs lists the property group IDs that this hook enforces access
// control for. Operations on groups not in this list are passed through.
func NewAccessControlHook(ps *PropertyService, pluginChecker PluginChecker, managedGroupIDs ...string) *AccessControlHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &AccessControlHook{
		propertyService: ps,
		pluginChecker:   pluginChecker,
		managedGroupIDs: ids,
	}
}

// isGroupManaged checks whether the given group ID is managed by this hook.
func (h *AccessControlHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

// Field Pre-Hooks

// PreCreatePropertyField enforces access control on field creation.
// When the caller is an installed plugin, source_plugin_id is automatically set.
// When the caller is not a plugin, source_plugin_id and protected are rejected.
// When linking to a source template, security attributes are validated and
// inherited from the source.
func (h *AccessControlHook) PreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(field.GroupID) {
		return field, nil
	}

	callerID := h.extractCallerID(rctx)

	if h.isCallerPlugin(callerID) {
		if field.Attrs == nil {
			field.Attrs = make(model.StringInterface)
		}
		field.Attrs[model.PropertyAttrsSourcePluginID] = callerID
	} else {
		if h.getSourcePluginID(field) != "" {
			return nil, fmt.Errorf("source_plugin_id can only be set by a plugin: %w", ErrAccessDenied)
		}
		if model.IsPropertyFieldProtected(field) {
			return nil, fmt.Errorf("protected can only be set by a plugin: %w", ErrAccessDenied)
		}
	}

	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		if err := h.validateAndInheritLinkedFieldSecurity(callerID, field); err != nil {
			return nil, fmt.Errorf("PreCreatePropertyField: %w", err)
		}
	}

	if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
		return nil, fmt.Errorf("%s: %w", err.Error(), ErrInvalidAccessMode)
	}

	return field, nil
}

// validateAndInheritLinkedFieldSecurity enforces that linked fields inherit
// the source template's security posture. If the source is protected, only
// the source plugin may create linked fields. Security attrs (protected,
// source_plugin_id, access_mode) are copied from the source onto the field.
func (h *AccessControlHook) validateAndInheritLinkedFieldSecurity(callerID string, field *model.PropertyField) error {
	source, err := h.propertyService.getPropertyFieldFromMaster("", *field.LinkedFieldID)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_not_found.app_error",
				nil,
				fmt.Sprintf("linked source field %q not found", *field.LinkedFieldID),
				http.StatusBadRequest,
			)
		}
		return fmt.Errorf("failed to get linked source field %q: %w", *field.LinkedFieldID, err)
	}

	if source.Attrs == nil || !model.IsPropertyFieldProtected(source) {
		return nil
	}

	sourcePluginID := h.getSourcePluginID(source)
	if sourcePluginID == "" || callerID != sourcePluginID {
		return model.NewAppError(
			"CreatePropertyField",
			"app.property_field.create.linked_source_protected.app_error",
			nil,
			"only the source plugin can create linked fields from a protected template",
			http.StatusForbidden,
		)
	}

	if field.Attrs == nil {
		field.Attrs = make(model.StringInterface)
	}

	field.Attrs[model.PropertyAttrsProtected] = true
	field.Attrs[model.PropertyAttrsSourcePluginID] = sourcePluginID
	if v, ok := source.Attrs[model.PropertyAttrsAccessMode]; ok {
		field.Attrs[model.PropertyAttrsAccessMode] = v
	}

	return nil
}

// PreUpdatePropertyField enforces access control on field updates.
// Checks write access and ensures source_plugin_id is not changed.
func (h *AccessControlHook) PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return field, nil
	}

	callerID := h.extractCallerID(rctx)

	existingField, err := h.propertyService.getPropertyField(groupID, field.ID)
	if err != nil {
		return nil, err
	}

	if err := h.checkFieldWriteAccess(existingField, callerID); err != nil {
		return nil, err
	}

	if err := h.ensureSourcePluginIDUnchanged(existingField, field); err != nil {
		return nil, err
	}

	if err := h.validateProtectedFieldUpdate(field, callerID); err != nil {
		return nil, err
	}

	if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
		return nil, fmt.Errorf("%s: %w", err.Error(), ErrInvalidAccessMode)
	}

	return field, nil
}

// PreUpdatePropertyFields enforces access control on batch field updates.
// Checks write access for all fields atomically before allowing any updates.
func (h *AccessControlHook) PreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 || !h.isGroupManaged(groupID) {
		return fields, nil
	}

	callerID := h.extractCallerID(rctx)

	// Get field IDs
	fieldIDs := make([]string, len(fields))
	for i, field := range fields {
		fieldIDs[i] = field.ID
	}

	existingFields, err := h.propertyService.getPropertyFields(groupID, fieldIDs)
	if err != nil {
		return nil, err
	}

	existingFieldMap := make(map[string]*model.PropertyField, len(existingFields))
	for _, field := range existingFields {
		existingFieldMap[field.ID] = field
	}

	for _, field := range fields {
		existingField, exists := existingFieldMap[field.ID]
		if !exists {
			return nil, fmt.Errorf("field %s: %w", field.ID, ErrFieldNotFound)
		}

		if err := h.checkFieldWriteAccess(existingField, callerID); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}

		if err := h.ensureSourcePluginIDUnchanged(existingField, field); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}

		if err := h.validateProtectedFieldUpdate(field, callerID); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}

		if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
			return nil, fmt.Errorf("field %s: %s: %w", field.ID, err.Error(), ErrInvalidAccessMode)
		}
	}

	return fields, nil
}

// PreCountPropertyFields is a no-op — counts don't expose per-row metadata,
// so access control doesn't apply. License gating happens in LicenseCheckHook.
func (h *AccessControlHook) PreCountPropertyFields(_ request.CTX, _ string) error {
	return nil
}

// PreDeletePropertyField enforces access control on field deletion.
func (h *AccessControlHook) PreDeletePropertyField(rctx request.CTX, groupID string, id string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}

	callerID := h.extractCallerID(rctx)

	existingField, err := h.propertyService.getPropertyField(groupID, id)
	if err != nil {
		return err
	}

	return h.checkFieldDeleteAccess(existingField, callerID)
}

// PostUpdatePropertyFields is a no-op for access control; cleanup of dependent
// values is handled by TypeChangeValueCleanupHook.
func (h *AccessControlHook) PostUpdatePropertyFields(_ request.CTX, _ string, _, requested, propagated []*model.PropertyField) ([]*model.PropertyField, []*model.PropertyField, []string, error) {
	return requested, propagated, nil, nil
}

// Field Post-Hooks

// PostGetPropertyField applies read access control to a single field.
func (h *AccessControlHook) PostGetPropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(field.GroupID) {
		return field, nil
	}

	callerID := h.extractCallerID(rctx)
	return h.applyFieldReadAccessControl(field, callerID), nil
}

// PostGetPropertyFields applies read access control to a list of fields.
// All fields in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PostGetPropertyFields(rctx request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 {
		return fields, nil
	}

	if !h.isGroupManaged(fields[0].GroupID) {
		return fields, nil
	}

	callerID := h.extractCallerID(rctx)
	return h.applyFieldReadAccessControlToList(fields, callerID), nil
}

// Value Pre-Hooks

// PreCreatePropertyValue enforces write access and sync locking on the value's field before creation.
func (h *AccessControlHook) PreCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if !h.isGroupManaged(value.GroupID) {
		return value, nil
	}

	callerID := h.extractCallerID(rctx)

	field, err := h.propertyService.getPropertyField(value.GroupID, value.FieldID)
	if err != nil {
		return nil, err
	}

	if err := h.checkValueWriteAccess(field, callerID); err != nil {
		return nil, err
	}

	return value, nil
}

// PreCreatePropertyValues enforces write access and sync locking for all fields atomically before creation.
// All values in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PreCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 || !h.isGroupManaged(values[0].GroupID) {
		return values, nil
	}

	callerID := h.extractCallerID(rctx)

	fieldMap, err := h.getFieldsForValues(values)
	if err != nil {
		return nil, err
	}

	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, ErrFieldNotFound)
		}
		if err := h.checkValueWriteAccess(field, callerID); err != nil {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, err)
		}
	}

	return values, nil
}

// PreUpdatePropertyValue enforces write access and sync locking on the value's field before update.
func (h *AccessControlHook) PreUpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if !h.isGroupManaged(groupID) {
		return value, nil
	}

	callerID := h.extractCallerID(rctx)

	field, err := h.propertyService.getPropertyField(groupID, value.FieldID)
	if err != nil {
		return nil, err
	}

	if err := h.checkValueWriteAccess(field, callerID); err != nil {
		return nil, err
	}

	return value, nil
}

// PreUpdatePropertyValues enforces write access and sync locking for all fields atomically before update.
// All values in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PreUpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 || !h.isGroupManaged(groupID) {
		return values, nil
	}

	callerID := h.extractCallerID(rctx)

	fieldMap, err := h.getFieldsForValues(values)
	if err != nil {
		return nil, err
	}

	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, ErrFieldNotFound)
		}
		if err := h.checkValueWriteAccess(field, callerID); err != nil {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, err)
		}
	}

	return values, nil
}

// PreUpsertPropertyValue enforces write access and sync locking on the value's field before upsert.
func (h *AccessControlHook) PreUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if !h.isGroupManaged(value.GroupID) {
		return value, nil
	}

	callerID := h.extractCallerID(rctx)

	field, err := h.propertyService.getPropertyField(value.GroupID, value.FieldID)
	if err != nil {
		return nil, err
	}

	if err := h.checkValueWriteAccess(field, callerID); err != nil {
		return nil, err
	}

	return value, nil
}

// PreUpsertPropertyValues enforces write access and sync locking for all fields atomically before upsert.
// All values in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PreUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 || !h.isGroupManaged(values[0].GroupID) {
		return values, nil
	}

	callerID := h.extractCallerID(rctx)

	fieldMap, err := h.getFieldsForValues(values)
	if err != nil {
		return nil, err
	}

	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, ErrFieldNotFound)
		}
		if err := h.checkValueWriteAccess(field, callerID); err != nil {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, err)
		}
	}

	return values, nil
}

// PreDeletePropertyValue enforces write access before deleting a value.
func (h *AccessControlHook) PreDeletePropertyValue(rctx request.CTX, groupID string, id string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}

	callerID := h.extractCallerID(rctx)

	value, err := h.propertyService.getPropertyValue(groupID, id)
	if err != nil {
		return err
	}

	field, err := h.propertyService.getPropertyField(groupID, value.FieldID)
	if err != nil {
		return err
	}

	return h.checkValueWriteAccess(field, callerID)
}

// PreDeletePropertyValuesForTarget enforces write access for all affected fields
// before deleting all values for a target.
func (h *AccessControlHook) PreDeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}

	callerID := h.extractCallerID(rctx)

	// Collect unique field IDs across all values without loading all values into memory
	fieldIDs := make(map[string]struct{})
	var cursor model.PropertyValueSearchCursor
	iterations := 0

	for {
		iterations++
		if iterations > propertyAccessMaxPaginationIterations {
			return fmt.Errorf("exceeded maximum pagination iterations (%d)", propertyAccessMaxPaginationIterations)
		}

		opts := model.PropertyValueSearchOpts{
			TargetType: targetType,
			TargetIDs:  []string{targetID},
			PerPage:    propertyAccessPaginationPageSize,
		}

		if !cursor.IsEmpty() {
			opts.Cursor = cursor
		}

		values, err := h.propertyService.searchPropertyValues(groupID, opts)
		if err != nil {
			return err
		}

		for _, value := range values {
			fieldIDs[value.FieldID] = struct{}{}
		}

		if len(values) < propertyAccessPaginationPageSize {
			break
		}

		lastValue := values[len(values)-1]
		cursor = model.PropertyValueSearchCursor{
			PropertyValueID: lastValue.ID,
			CreateAt:        lastValue.CreateAt,
		}
	}

	if len(fieldIDs) == 0 {
		return nil
	}

	fieldIDSlice := make([]string, 0, len(fieldIDs))
	for fieldID := range fieldIDs {
		fieldIDSlice = append(fieldIDSlice, fieldID)
	}

	fields, err := h.propertyService.getPropertyFields(groupID, fieldIDSlice)
	if err != nil {
		return err
	}

	for _, field := range fields {
		if err := h.checkValueWriteAccess(field, callerID); err != nil {
			return fmt.Errorf("field %s: %w", field.ID, err)
		}
	}

	return nil
}

// PreDeletePropertyValuesForField enforces write access before deleting all values for a field.
func (h *AccessControlHook) PreDeletePropertyValuesForField(rctx request.CTX, groupID string, fieldID string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}

	callerID := h.extractCallerID(rctx)

	field, err := h.propertyService.getPropertyField(groupID, fieldID)
	if err != nil {
		return err
	}

	return h.checkValueWriteAccess(field, callerID)
}

// Value Post-Hooks

// PostGetPropertyValue applies read access control to a single value.
// Returns nil if the caller doesn't have access.
func (h *AccessControlHook) PostGetPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, nil
	}
	if !h.isGroupManaged(value.GroupID) {
		return value, nil
	}

	callerID := h.extractCallerID(rctx)

	filtered, err := h.applyValueReadAccessControl([]*model.PropertyValue{value}, callerID)
	if err != nil {
		return nil, err
	}

	if len(filtered) == 0 {
		return nil, nil
	}

	return filtered[0], nil
}

// PostGetPropertyValues applies read access control to a list of values.
// Values the caller doesn't have access to are silently filtered out.
// All values in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PostGetPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 || !h.isGroupManaged(values[0].GroupID) {
		return values, nil
	}

	callerID := h.extractCallerID(rctx)

	return h.applyValueReadAccessControl(values, callerID)
}

// Access Control Helper Methods

// extractCallerID gets the caller ID from a request context using the property service's extractor.
func (h *AccessControlHook) extractCallerID(rctx request.CTX) string {
	return h.propertyService.extractCallerID(rctx)
}

// isCallerPlugin checks whether the callerID corresponds to an installed plugin.
func (h *AccessControlHook) isCallerPlugin(callerID string) bool {
	return callerID != "" && h.pluginChecker != nil && h.pluginChecker(callerID)
}

// getSourcePluginID extracts the source_plugin_id from a PropertyField's attrs.
func (h *AccessControlHook) getSourcePluginID(field *model.PropertyField) string {
	if field.Attrs == nil {
		return ""
	}
	sourcePluginID, _ := field.Attrs[model.PropertyAttrsSourcePluginID].(string)
	return sourcePluginID
}

// getAccessMode extracts the access_mode from a PropertyField's attrs.
func (h *AccessControlHook) getAccessMode(field *model.PropertyField) string {
	if field.Attrs == nil {
		return model.PropertyAccessModePublic
	}
	accessMode, ok := field.Attrs[model.PropertyAttrsAccessMode].(string)
	if !ok {
		return model.PropertyAccessModePublic
	}
	return accessMode
}

// hasUnrestrictedFieldReadAccess checks if the given caller can read a PropertyField without restrictions.
// Returns true if the caller has unrestricted read access (public field or source plugin).
func (h *AccessControlHook) hasUnrestrictedFieldReadAccess(field *model.PropertyField, callerID string) bool {
	accessMode := h.getAccessMode(field)

	if accessMode == model.PropertyAccessModePublic {
		return true
	}

	sourcePluginID := h.getSourcePluginID(field)
	if sourcePluginID != "" && sourcePluginID == callerID {
		return true
	}

	return false
}

// ensureSourcePluginIDUnchanged checks that the source_plugin_id attribute hasn't changed between fields.
func (h *AccessControlHook) ensureSourcePluginIDUnchanged(existingField, updatedField *model.PropertyField) error {
	existingSourcePluginID := h.getSourcePluginID(existingField)
	updatedSourcePluginID := h.getSourcePluginID(updatedField)

	if existingSourcePluginID != updatedSourcePluginID {
		return fmt.Errorf("source_plugin_id is immutable and cannot be changed from '%s' to '%s': %w", existingSourcePluginID, updatedSourcePluginID, ErrAccessDenied)
	}

	return nil
}

// validateProtectedFieldUpdate validates that a field can be updated to protected=true.
func (h *AccessControlHook) validateProtectedFieldUpdate(updatedField *model.PropertyField, callerID string) error {
	if !model.IsPropertyFieldProtected(updatedField) {
		return nil
	}

	sourcePluginID := h.getSourcePluginID(updatedField)
	if sourcePluginID == "" {
		return fmt.Errorf("cannot set protected=true on a field without a source_plugin_id: %w", ErrAccessDenied)
	}

	if sourcePluginID != callerID {
		return fmt.Errorf("cannot set protected=true: only source plugin '%s' can modify this field: %w", sourcePluginID, ErrAccessDenied)
	}

	return nil
}

// checkFieldWriteAccess checks if the given caller can modify a PropertyField.
// IMPORTANT: Always pass the existing field fetched from the database, not a field provided by the caller.
func (h *AccessControlHook) checkFieldWriteAccess(field *model.PropertyField, callerID string) error {
	if !model.IsPropertyFieldProtected(field) {
		return nil
	}

	sourcePluginID := h.getSourcePluginID(field)
	if sourcePluginID == "" {
		return fmt.Errorf("field %s is protected, but has no associated source plugin: %w", field.ID, ErrAccessDenied)
	}

	if sourcePluginID != callerID {
		return fmt.Errorf("field %s is protected and can only be modified by source plugin '%s': %w", field.ID, sourcePluginID, ErrAccessDenied)
	}

	return nil
}

// checkFieldDeleteAccess checks if the given caller can delete a PropertyField.
// IMPORTANT: Always pass the existing field fetched from the database, not a field provided by the caller.
func (h *AccessControlHook) checkFieldDeleteAccess(field *model.PropertyField, callerID string) error {
	if !model.IsPropertyFieldProtected(field) {
		return nil
	}

	sourcePluginID := h.getSourcePluginID(field)
	if sourcePluginID == "" {
		return nil
	}

	if h.pluginChecker != nil && !h.pluginChecker(sourcePluginID) {
		return nil
	}

	if sourcePluginID != callerID {
		return fmt.Errorf("field %s is protected and can only be modified by source plugin '%s': %w", field.ID, sourcePluginID, ErrAccessDenied)
	}

	return nil
}

// checkSyncLock checks whether the caller is allowed to write values for a
// synced field. Synced fields have an ldap or saml attr set, and only the
// corresponding sync service (identified by well-known caller IDs) may write
// their values.
func (h *AccessControlHook) checkSyncLock(field *model.PropertyField, callerID string) error {
	syncSource := model.GetPropertyFieldSyncSource(field)
	if syncSource == "" {
		return nil
	}

	// Map sync source to the expected caller ID
	var expectedCallerID string
	switch syncSource {
	case "ldap":
		expectedCallerID = model.CallerIDLDAPSync
	case "saml":
		expectedCallerID = model.CallerIDSAMLSync
	default:
		return fmt.Errorf("field %s has unknown sync source %q: %w", field.ID, syncSource, ErrInvalidFieldAttrs)
	}

	if callerID != expectedCallerID {
		return fmt.Errorf("field %s is managed by %s sync and cannot be modified by caller %q: %w", field.ID, syncSource, callerID, ErrSyncLocked)
	}

	return nil
}

// checkValueWriteAccess combines the protected-field write access check and
// the sync lock check for value write operations.
func (h *AccessControlHook) checkValueWriteAccess(field *model.PropertyField, callerID string) error {
	if err := h.checkFieldWriteAccess(field, callerID); err != nil {
		return err
	}
	return h.checkSyncLock(field, callerID)
}

// getCallerValuesForField retrieves all property values for the caller on a specific field.
func (h *AccessControlHook) getCallerValuesForField(groupID, fieldID, callerID string) ([]*model.PropertyValue, error) {
	if callerID == "" {
		return []*model.PropertyValue{}, nil
	}

	allValues := []*model.PropertyValue{}
	var cursor model.PropertyValueSearchCursor
	iterations := 0

	for {
		iterations++
		if iterations > propertyAccessMaxPaginationIterations {
			return nil, fmt.Errorf("exceeded maximum pagination iterations (%d)", propertyAccessMaxPaginationIterations)
		}

		opts := model.PropertyValueSearchOpts{
			FieldID:   fieldID,
			TargetIDs: []string{callerID},
			PerPage:   propertyAccessPaginationPageSize,
		}

		if !cursor.IsEmpty() {
			opts.Cursor = cursor
		}

		values, err := h.propertyService.searchPropertyValues(groupID, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to get caller values for field: %w", err)
		}

		allValues = append(allValues, values...)

		if len(values) < propertyAccessPaginationPageSize {
			break
		}

		lastValue := values[len(values)-1]
		cursor = model.PropertyValueSearchCursor{
			PropertyValueID: lastValue.ID,
			CreateAt:        lastValue.CreateAt,
		}
	}

	return allValues, nil
}

// extractOptionIDsFromValue parses a JSON value and extracts option IDs into a set.
func (h *AccessControlHook) extractOptionIDsFromValue(fieldType model.PropertyFieldType, value []byte) (map[string]struct{}, error) {
	if len(value) == 0 {
		return nil, nil
	}

	optionIDs := make(map[string]struct{})

	switch fieldType {
	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeRank:
		var optionID string
		if err := json.Unmarshal(value, &optionID); err != nil {
			return nil, err
		}
		if optionID != "" {
			optionIDs[optionID] = struct{}{}
		}

	case model.PropertyFieldTypeMultiselect:
		var ids []string
		if err := json.Unmarshal(value, &ids); err != nil {
			return nil, err
		}
		for _, id := range ids {
			if id != "" {
				optionIDs[id] = struct{}{}
			}
		}

	default:
		return nil, fmt.Errorf("extractOptionIDsFromValue only supports select, multiselect and rank field types, got: %s", fieldType)
	}

	return optionIDs, nil
}

// copyPropertyField returns a copy of a PropertyField with a fresh Attrs map.
// The Attrs copy is shallow: nested slices/maps (notably Attrs["options"])
// share backing storage with the original. That is safe today because
// filterSharedOnlyFieldOptions replaces Attrs["options"] wholesale rather
// than mutating in place. A future hook that mutates a nested value in the
// returned copy would also mutate the caller's original — deep-copy those
// entries if that changes.
func (h *AccessControlHook) copyPropertyField(field *model.PropertyField) *model.PropertyField {
	copied := *field
	copied.Attrs = make(model.StringInterface)
	if field.Attrs != nil {
		maps.Copy(copied.Attrs, field.Attrs)
	}
	return &copied
}

// getCallerOptionIDsForField retrieves the caller's values for a field and extracts all option IDs.
func (h *AccessControlHook) getCallerOptionIDsForField(groupID, fieldID, callerID string, fieldType model.PropertyFieldType) (map[string]struct{}, error) {
	callerValues, err := h.getCallerValuesForField(groupID, fieldID, callerID)
	if err != nil {
		return make(map[string]struct{}), err
	}

	if len(callerValues) == 0 {
		return make(map[string]struct{}), nil
	}

	callerOptionIDs := make(map[string]struct{})
	for _, val := range callerValues {
		optionIDs, err := h.extractOptionIDsFromValue(fieldType, val.Value)
		if err == nil && optionIDs != nil {
			for optionID := range optionIDs {
				callerOptionIDs[optionID] = struct{}{}
			}
		}
	}

	return callerOptionIDs, nil
}

// filterSharedOnlyFieldOptions filters a field's options to only include those the caller has values for.
//
// Rank fields are the exception: rather than exact-match membership, a rank
// field exposes every option at or below the caller's own rank ("everything at
// your rank and lower"), so a higher-cleared caller sees the full ladder up to
// their level. See filterSharedOnlyRankFieldOptions.
func (h *AccessControlHook) filterSharedOnlyFieldOptions(field *model.PropertyField, callerID string) *model.PropertyField {
	if !field.Type.SupportsOptions() {
		return field
	}

	if field.Type == model.PropertyFieldTypeRank {
		return h.filterSharedOnlyRankFieldOptions(field, callerID)
	}

	callerOptionIDs, err := h.getCallerOptionIDsForField(field.GroupID, field.ID, callerID, field.Type)
	if err != nil || len(callerOptionIDs) == 0 {
		filteredField := h.copyPropertyField(field)
		filteredField.Attrs[model.PropertyFieldAttributeOptions] = []any{}
		return filteredField
	}

	if field.Attrs == nil {
		return field
	}
	optionsArr, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return field
	}

	optionsSlice, ok := optionsArr.([]any)
	if !ok {
		return field
	}

	filteredOptions := []any{}
	for _, opt := range optionsSlice {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		optID, ok := optMap["id"].(string)
		if !ok {
			continue
		}
		if _, exists := callerOptionIDs[optID]; exists {
			filteredOptions = append(filteredOptions, opt)
		}
	}

	filteredField := h.copyPropertyField(field)
	filteredField.Attrs[model.PropertyFieldAttributeOptions] = filteredOptions
	return filteredField
}

// filterSharedOnlyRankFieldOptions filters a rank field's options to those at
// or below the caller's own rank, rather than the exact-match intersection
// used for select/multiselect. A caller who holds no value for the field (and
// therefore has no rank) sees no options.
func (h *AccessControlHook) filterSharedOnlyRankFieldOptions(field *model.PropertyField, callerID string) *model.PropertyField {
	// Bail out before building the rank map or the caller-rank store lookup when
	// there are no options to filter: an absent or malformed options array has
	// nothing to hide, so the field is returned untouched.
	if field.Attrs == nil {
		return field
	}
	optionsArr, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return field
	}
	optionsSlice, ok := optionsArr.([]any)
	if !ok {
		return field
	}

	rankByID := buildOptionRankMap(field)
	callerRank, ok := h.callerRankForField(field, callerID, rankByID)
	if !ok {
		filteredField := h.copyPropertyField(field)
		filteredField.Attrs[model.PropertyFieldAttributeOptions] = []any{}
		return filteredField
	}

	filteredOptions := []any{}
	for _, opt := range optionsSlice {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		optID, ok := optMap["id"].(string)
		if !ok {
			continue
		}
		rank, ok := rankByID[optID]
		if !ok {
			continue
		}
		if rank <= callerRank {
			filteredOptions = append(filteredOptions, opt)
		}
	}

	filteredField := h.copyPropertyField(field)
	filteredField.Attrs[model.PropertyFieldAttributeOptions] = filteredOptions
	return filteredField
}

// callerRankForField returns the rank the caller holds for a rank field, using
// the already-built option-ID-to-rank map. A rank field is select-shaped (a
// single value per user), so the caller has at most one option; we take it.
// ok is false when the caller has no value for the field or the option carries
// no rank, in which case the caller has no clearance and sees nothing.
func (h *AccessControlHook) callerRankForField(field *model.PropertyField, callerID string, rankByID map[string]int) (int, bool) {
	callerOptionIDs, err := h.getCallerOptionIDsForField(field.GroupID, field.ID, callerID, field.Type)
	if err != nil || len(callerOptionIDs) == 0 {
		return 0, false
	}

	var callerOptionID string
	for id := range callerOptionIDs {
		callerOptionID = id
		break
	}

	rank, ok := rankByID[callerOptionID]
	return rank, ok
}

// buildOptionRankMap returns a map of option ID to rank for a rank field.
// Options without a rank are skipped.
func buildOptionRankMap(field *model.PropertyField) map[string]int {
	out := map[string]int{}
	if field.Attrs == nil {
		return out
	}
	rawOpts, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return out
	}
	opts, err := model.NewPropertyOptionsFromFieldAttrs[*model.CustomProfileAttributesSelectOption](rawOpts)
	if err != nil {
		return out
	}
	for _, o := range opts {
		if o.Rank == nil {
			continue
		}
		out[o.ID] = *o.Rank
	}
	return out
}

// filterSharedOnlyValue computes the intersection of caller and target values for shared_only fields.
// Returns the filtered value or nil if there's no intersection.
//   - rank: clearance-style. The caller sees the option at the highest rank they share with the
//     target — the target's own value when its rank is at or below the caller's, otherwise the
//     value clamped down to the option at the caller's own rank. See filterSharedOnlyRankValue.
//   - select / multiselect: per-value intersection (a multi-value field may return a subset).
//   - text / date / user / any other primitive type: binary — visible only if the caller's
//     stored value equals the target's value exactly. Otherwise nil.
//
// The binary path is what protects scenarios like LDAP/SAML-synced text codenames whose
// existence is itself controlled information: a caller who doesn't hold the same value
// must not see the target's value through any read endpoint.
func (h *AccessControlHook) filterSharedOnlyValue(field *model.PropertyField, value *model.PropertyValue, callerID string) *model.PropertyValue {
	if field.Type == model.PropertyFieldTypeRank {
		return h.filterSharedOnlyRankValue(field, value, callerID)
	}

	if field.Type != model.PropertyFieldTypeSelect && field.Type != model.PropertyFieldTypeMultiselect {
		return h.filterSharedOnlyScalarValue(field, value, callerID)
	}

	callerOptionIDs, err := h.getCallerOptionIDsForField(field.GroupID, field.ID, callerID, field.Type)
	if err != nil || len(callerOptionIDs) == 0 {
		return nil
	}

	targetOptionIDs, err := h.extractOptionIDsFromValue(field.Type, value.Value)
	if err != nil || targetOptionIDs == nil || len(targetOptionIDs) == 0 {
		return nil
	}

	intersection := []string{}
	for targetID := range targetOptionIDs {
		if _, exists := callerOptionIDs[targetID]; exists {
			intersection = append(intersection, targetID)
		}
	}

	if len(intersection) == 0 {
		return nil
	}

	filteredValue := *value

	switch field.Type {
	case model.PropertyFieldTypeSelect:
		jsonValue, err := json.Marshal(intersection[0])
		if err != nil {
			return nil
		}
		filteredValue.Value = jsonValue
		return &filteredValue

	case model.PropertyFieldTypeMultiselect:
		jsonValue, err := json.Marshal(intersection)
		if err != nil {
			return nil
		}
		filteredValue.Value = jsonValue
		return &filteredValue

	default:
		return nil
	}
}

// filterSharedOnlyRankValue returns the target's value clamped to the highest
// rank the caller shares with the target: the target's own value when its rank
// is at or below the caller's, otherwise the value rewritten to the option at
// the caller's own rank. The caller therefore always learns the highest level
// they have in common ("what can we talk about, and at what level") rather than
// seeing nothing when the target outranks them, but never sees a rank above
// their own. This differs from select/multiselect, which require an exact
// option match. A caller who holds no value of their own (and therefore has no
// rank) sees nothing. A rank field is select-shaped, so the target has at most
// one option.
func (h *AccessControlHook) filterSharedOnlyRankValue(field *model.PropertyField, value *model.PropertyValue, callerID string) *model.PropertyValue {
	rankByID := buildOptionRankMap(field)
	callerRank, ok := h.callerRankForField(field, callerID, rankByID)
	if !ok {
		return nil
	}

	targetOptionIDs, err := h.extractOptionIDsFromValue(field.Type, value.Value)
	if err != nil || len(targetOptionIDs) == 0 {
		return nil
	}

	for targetID := range targetOptionIDs {
		targetRank, ok := rankByID[targetID]
		if !ok {
			continue
		}
		if targetRank <= callerRank {
			filtered := *value
			return &filtered
		}
		// The target outranks the caller: clamp the value down to the option at
		// the caller's own rank, the highest rung they share with the target.
		return h.clampRankValueToRank(value, rankByID, callerRank)
	}
	return nil
}

// clampRankValueToRank returns a copy of value rewritten to the rank field's
// option at the given rank. Ranks are unique per field, so exactly one option
// matches. Returns nil if no option carries the rank (not expected, since the
// rank is taken from an existing option) or the rewrite fails.
func (h *AccessControlHook) clampRankValueToRank(value *model.PropertyValue, rankByID map[string]int, rank int) *model.PropertyValue {
	var optionID string
	for id, r := range rankByID {
		if r == rank {
			optionID = id
			break
		}
	}
	if optionID == "" {
		return nil
	}

	jsonValue, err := json.Marshal(optionID)
	if err != nil {
		return nil
	}

	clamped := *value
	clamped.Value = jsonValue
	return &clamped
}

// filterSharedOnlyScalarValue applies binary masking to a non-option field's value:
// returns the value as-is if the caller's own stored value for the same field equals
// the target's value, otherwise nil. Caller and target may legitimately store nothing,
// in which case the value is hidden.
func (h *AccessControlHook) filterSharedOnlyScalarValue(field *model.PropertyField, value *model.PropertyValue, callerID string) *model.PropertyValue {
	if value == nil || len(value.Value) == 0 {
		return nil
	}

	callerValues, err := h.getCallerValuesForField(field.GroupID, field.ID, callerID)
	if err != nil || len(callerValues) == 0 {
		return nil
	}

	for _, cv := range callerValues {
		if bytes.Equal(cv.Value, value.Value) {
			filtered := *value
			return &filtered
		}
	}
	return nil
}

// applyFieldReadAccessControl applies read access control to a single field.
// Returns the field with options filtered based on the caller's access permissions.
// - Public fields: returned as-is
// - User-editable fields (PermissionValues=member): returned as-is so users can see all choices
// - Source-only fields: returned with empty options if caller is not the source plugin
// - Shared-only fields: returned with options filtered using filterSharedOnlyFieldOptions
// - Unknown access modes: treated as source-only (secure default)
func (h *AccessControlHook) applyFieldReadAccessControl(field *model.PropertyField, callerID string) *model.PropertyField {
	if h.hasUnrestrictedFieldReadAccess(field, callerID) {
		return field
	}

	accessMode := h.getAccessMode(field)

	if accessMode == model.PropertyAccessModeSharedOnly {
		return h.filterSharedOnlyFieldOptions(field, callerID)
	}

	// Source-only or unknown: return with empty options (secure default)
	filteredField := h.copyPropertyField(field)
	if field.Type.SupportsOptions() {
		filteredField.Attrs[model.PropertyFieldAttributeOptions] = []any{}
	}
	return filteredField
}

// applyFieldReadAccessControlToList applies read access control to a list of fields.
func (h *AccessControlHook) applyFieldReadAccessControlToList(fields []*model.PropertyField, callerID string) []*model.PropertyField {
	if len(fields) == 0 {
		return fields
	}

	filtered := make([]*model.PropertyField, 0, len(fields))
	for _, field := range fields {
		filtered = append(filtered, h.applyFieldReadAccessControl(field, callerID))
	}

	return filtered
}

// getFieldsForValues fetches all unique fields associated with the given values.
func (h *AccessControlHook) getFieldsForValues(values []*model.PropertyValue) (map[string]*model.PropertyField, error) {
	if len(values) == 0 {
		return make(map[string]*model.PropertyField), nil
	}

	groupAndFieldIDs := make(map[string]map[string]struct{})
	for _, value := range values {
		if groupAndFieldIDs[value.GroupID] == nil {
			groupAndFieldIDs[value.GroupID] = make(map[string]struct{})
		}
		groupAndFieldIDs[value.GroupID][value.FieldID] = struct{}{}
	}

	fieldMap := make(map[string]*model.PropertyField)
	for groupID, fieldIDs := range groupAndFieldIDs {
		fieldIDSlice := make([]string, 0, len(fieldIDs))
		for fieldID := range fieldIDs {
			fieldIDSlice = append(fieldIDSlice, fieldID)
		}

		fields, err := h.propertyService.getPropertyFields(groupID, fieldIDSlice)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch fields for values: %w", err)
		}

		for _, field := range fields {
			fieldMap[field.ID] = field
		}
	}

	return fieldMap, nil
}

// applyValueReadAccessControl applies read access control to a list of values.
func (h *AccessControlHook) applyValueReadAccessControl(values []*model.PropertyValue, callerID string) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	fieldMap, err := h.getFieldsForValues(values)
	if err != nil {
		return nil, fmt.Errorf("applyValueReadAccessControl: %w", err)
	}

	filtered := make([]*model.PropertyValue, 0, len(values))
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("applyValueReadAccessControl: field not found for value %s", value.ID)
		}

		accessMode := h.getAccessMode(field)

		if h.hasUnrestrictedFieldReadAccess(field, callerID) {
			filtered = append(filtered, value)
		} else if accessMode == model.PropertyAccessModeSharedOnly {
			filteredValue := h.filterSharedOnlyValue(field, value, callerID)
			if filteredValue != nil {
				filtered = append(filtered, filteredValue)
			}
		}
		// For source_only mode where caller is not the source, skip the value
	}

	return filtered, nil
}
