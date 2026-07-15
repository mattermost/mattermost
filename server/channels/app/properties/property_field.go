// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"reflect"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// enforceFieldGroupVersionMatch checks that the field and group versions are
// compatible. It returns an error if the field is PSAv1 on a PSAv2 group or
// vice versa. The lookup uses GroupByID which checks the cache first and falls
// back to the database.
func (ps *PropertyService) enforceFieldGroupVersionMatch(caller string, groupID string, field *model.PropertyField) error {
	group, err := ps.GroupByID(groupID)
	if err != nil {
		return fmt.Errorf("%s: failed to look up group for version check: %w", caller, err)
	}

	if group.IsPSAv1() && field.IsPSAv1() {
		return nil
	}
	if group.IsPSAv2() && field.IsPSAv2() {
		return nil
	}

	return model.NewAppError(caller, "app.property_field.version_mismatch.app_error", nil,
		"field and group version mismatch", http.StatusBadRequest)
}

// Private implementation methods (database access)

func (ps *PropertyService) createPropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	// Enforce version match between field and group
	if err := ps.enforceFieldGroupVersionMatch("CreatePropertyField", field.GroupID, field); err != nil {
		return nil, err
	}

	// Legacy properties (PSAv1) skip the conflict check.
	if field.IsPSAv1() {
		return ps.fieldStore.Create(field)
	}

	// If this field links to a source, validate the source and copy its schema
	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		// Templates are definition-only and cannot themselves be linked
		if field.ObjectType == model.PropertyFieldObjectTypeTemplate {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.template_cannot_be_linked.app_error",
				nil,
				"template fields cannot have a linked_field_id",
				http.StatusBadRequest,
			)
		}

		source, err := ps.fieldStore.Get(store.WithMaster(context.Background()), "", *field.LinkedFieldID)
		if err != nil {
			if store.IsErrNotFound(err) {
				return nil, model.NewAppError(
					"CreatePropertyField",
					"app.property_field.create.linked_source_not_found.app_error",
					nil,
					fmt.Sprintf("linked source field %q not found", *field.LinkedFieldID),
					http.StatusBadRequest,
				)
			}
			return nil, fmt.Errorf("failed to get linked source field %q: %w", *field.LinkedFieldID, err)
		}

		// Cross-group linking is not supported
		if source.GroupID != field.GroupID {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_cross_group.app_error",
				nil,
				fmt.Sprintf("cannot link to field %q in group %q: source must be in the same group %q", *field.LinkedFieldID, source.GroupID, field.GroupID),
				http.StatusBadRequest,
			)
		}

		if source.DeleteAt != 0 {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_deleted.app_error",
				nil,
				fmt.Sprintf("linked source field %q is deleted", *field.LinkedFieldID),
				http.StatusBadRequest,
			)
		}

		// Only template fields can be link sources
		if source.ObjectType != model.PropertyFieldObjectTypeTemplate {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_not_template.app_error",
				nil,
				"can only link to template fields",
				http.StatusBadRequest,
			)
		}

		// Linked field's TargetType must match the source template's TargetType
		if field.TargetType != source.TargetType {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_target_type_mismatch.app_error",
				nil,
				fmt.Sprintf("linked field target_type %q must match source template target_type %q", field.TargetType, source.TargetType),
				http.StatusBadRequest,
			)
		}

		// Prevent chains: source must not itself be linked
		if source.LinkedFieldID != nil && *source.LinkedFieldID != "" {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_is_linked.app_error",
				nil,
				"cannot link to a field that is itself linked (no chains allowed)",
				http.StatusBadRequest,
			)
		}

		// Copy type and options from source
		field.Type = source.Type
		if field.Attrs == nil {
			field.Attrs = make(model.StringInterface)
		}
		if source.Attrs != nil {
			if opts, ok := source.Attrs[model.PropertyFieldAttributeOptions]; ok {
				field.Attrs[model.PropertyFieldAttributeOptions] = opts
			}
		}

		// Inherit permission levels from source template
		if source.PermissionField != nil {
			field.PermissionField = source.PermissionField
		}
		if source.PermissionValues != nil {
			field.PermissionValues = source.PermissionValues
		}
		if source.PermissionOptions != nil {
			field.PermissionOptions = source.PermissionOptions
		}
	}

	// Check for hierarchical name conflicts
	conflictLevel, err := ps.fieldStore.CheckPropertyNameConflict(field, "")
	if err != nil {
		return nil, fmt.Errorf("failed to check property name conflict: %w", err)
	}

	if conflictLevel != "" {
		return nil, model.NewAppError(
			"CreatePropertyField",
			"app.property_field.create.name_conflict.app_error",
			map[string]any{"Name": field.Name, "ConflictLevel": string(conflictLevel)},
			fmt.Sprintf("property name %q conflicts with existing %s-level property", field.Name, string(conflictLevel)),
			http.StatusConflict,
		)
	}

	return ps.fieldStore.Create(field)
}

func (ps *PropertyService) getPropertyField(groupID, id string) (*model.PropertyField, error) {
	return ps.fieldStore.Get(context.Background(), groupID, id)
}

func (ps *PropertyService) getPropertyFieldFromMaster(groupID, id string) (*model.PropertyField, error) {
	return ps.fieldStore.Get(store.WithMaster(context.Background()), groupID, id)
}

func (ps *PropertyService) getPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	fields, err := ps.fieldStore.GetMany(context.Background(), groupID, ids)
	if err != nil {
		var resultsMismatchErr *store.ErrResultsMismatch
		if errors.As(err, &resultsMismatchErr) {
			return nil, fmt.Errorf("%w: %w", ErrFieldNotFound, err)
		}
		return nil, err
	}
	return fields, nil
}

func (ps *PropertyService) getPropertyFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	return ps.fieldStore.GetFieldByName(context.Background(), groupID, targetID, name)
}

func (ps *PropertyService) getPropertyFieldByNameForObjectType(groupID, targetID, objectType, name string) (*model.PropertyField, error) {
	return ps.fieldStore.GetFieldByNameForObjectType(context.Background(), groupID, targetID, objectType, name)
}

func (ps *PropertyService) countActivePropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, false)
}

func (ps *PropertyService) countAllPropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, true)
}

func (ps *PropertyService) countActivePropertyFieldsForGroupObjectType(groupID, objectType string) (int64, error) {
	return ps.fieldStore.CountForGroupObjectType(groupID, objectType, false)
}

func (ps *PropertyService) countActivePropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return ps.fieldStore.CountForTarget(groupID, targetType, targetID, false)
}

func (ps *PropertyService) countAllPropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return ps.fieldStore.CountForTarget(groupID, targetType, targetID, true)
}

func (ps *PropertyService) searchPropertyFields(groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	// groupID is part of the search method signature to
	// incentivize the use of the database indexes in searches
	opts.GroupID = groupID

	return ps.fieldStore.SearchPropertyFields(opts)
}

func (ps *PropertyService) updatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, []string, error) {
	fields, _, clearedIDs, err := ps.updatePropertyFields(rctx, groupID, []*model.PropertyField{field})
	if err != nil {
		return nil, nil, err
	}

	return fields[0], clearedIDs, nil
}

func (ps *PropertyService) updatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) (requested []*model.PropertyField, propagated []*model.PropertyField, clearedFieldIDs []string, err error) {
	if len(fields) == 0 {
		return nil, nil, nil, nil
	}

	// Fetch existing fields to compare for changes that require conflict check
	ids := make([]string, len(fields))
	for i, f := range fields {
		if f == nil {
			return nil, nil, nil, fmt.Errorf("field at index %d is nil", i)
		}
		ids[i] = f.ID
	}

	// Read from master to avoid replication lag between this read and the
	// subsequent UPDATE (which also runs against master). This closes the
	// TOCTOU window that a replica read would leave open.
	existingFields, err := ps.fieldStore.GetMany(store.WithMaster(context.Background()), groupID, ids)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to get existing fields for update: %w", err)
	}

	// Build a map of existing fields by ID for quick lookup
	existingByID := make(map[string]*model.PropertyField, len(existingFields))
	for _, ef := range existingFields {
		existingByID[ef.ID] = ef
	}

	// Enforce version match between field and group for each field
	for _, field := range fields {
		if err := ps.enforceFieldGroupVersionMatch("UpdatePropertyFields", groupID, field); err != nil {
			return nil, nil, nil, err
		}
	}

	// Check each field for changes that require conflict validation and linked field restrictions
	for _, field := range fields {
		existing, ok := existingByID[field.ID]
		if !ok {
			continue
		}

		// Legacy properties (PSAv1) skip the conflict check.
		if field.IsPSAv1() {
			continue
		}

		// Block type changes on linked fields
		if existing.LinkedFieldID != nil && *existing.LinkedFieldID != "" && field.Type != existing.Type {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.linked_type_change.app_error",
				nil,
				"cannot modify type of a linked field",
				http.StatusBadRequest,
			)
		}

		// Block options changes on linked fields
		if existing.LinkedFieldID != nil && *existing.LinkedFieldID != "" && optionsChanged(existing.Attrs, field.Attrs) {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.linked_options_change.app_error",
				nil,
				"cannot modify options of a linked field",
				http.StatusBadRequest,
			)
		}

		// Block setting LinkedFieldID on a field that wasn't linked at creation.
		// LinkedFieldID can only be set during CreatePropertyField, which copies
		// the source's type and options. Allowing it on update would create a
		// link without that schema copy, causing type/options mismatches.
		// Canonicalize empty-string LinkedFieldID to nil (unlink).
		// Empty string is the JSON signal for "clear this field"; convert to
		// nil before persistence to avoid a third state distinct from NULL.
		if field.LinkedFieldID != nil && *field.LinkedFieldID == "" {
			field.LinkedFieldID = nil
		}

		existingIsLinked := existing.LinkedFieldID != nil && *existing.LinkedFieldID != ""
		newIsLinked := field.LinkedFieldID != nil

		if !existingIsLinked && newIsLinked {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.cannot_link_existing.app_error",
				nil,
				"linked_field_id can only be set at creation time",
				http.StatusBadRequest,
			)
		}

		// Block changing link target. To re-link, unlink first then create a
		// new linked field.
		if existingIsLinked && newIsLinked && *field.LinkedFieldID != *existing.LinkedFieldID {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.cannot_change_link_target.app_error",
				nil,
				"cannot change link target; unlink first then create a new linked field",
				http.StatusBadRequest,
			)
		}

		// Block type changes on source fields with active linked dependents
		if field.Type != existing.Type {
			count, cErr := ps.fieldStore.CountLinkedFields(field.ID)
			if cErr != nil {
				return nil, nil, nil, fmt.Errorf("failed to count linked fields: %w", cErr)
			}

			if count > 0 {
				return nil, nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.type_change_with_dependents.app_error",
					nil,
					"cannot change type of a field with active linked dependents",
					http.StatusConflict,
				)
			}
		}

		// Any change to Name or identity fields (TargetType/TargetID/ObjectType)
		// can shift the uniqueness domain. The DB unique index catches same-level
		// collisions, but cross-level hierarchy conflicts (system ↔ team ↔ channel)
		// are only caught here.
		if existing.Name != field.Name ||
			existing.TargetType != field.TargetType ||
			existing.TargetID != field.TargetID ||
			existing.ObjectType != field.ObjectType {
			conflictLevel, cErr := ps.fieldStore.CheckPropertyNameConflict(field, field.ID)
			if cErr != nil {
				return nil, nil, nil, fmt.Errorf("failed to check property name conflict: %w", cErr)
			}

			if conflictLevel != "" {
				return nil, nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.name_conflict.app_error",
					map[string]any{"Name": field.Name, "ConflictLevel": string(conflictLevel)},
					fmt.Sprintf("property name %q conflicts with existing %s-level property", field.Name, string(conflictLevel)),
					http.StatusConflict,
				)
			}
		}
	}

	// Build expected UpdateAt map for optimistic concurrency control.
	// This closes the TOCTOU window: if any field was modified between the
	// GetMany above and the UPDATE below, the store will reject the write.
	expectedUpdateAts := make(map[string]int64, len(existingByID))
	for id, ef := range existingByID {
		expectedUpdateAts[id] = ef.UpdateAt
	}

	// Update fields atomically. The store handles propagation of type and
	// options to linked dependents automatically via a JOIN-based UPDATE.
	all, uErr := ps.fieldStore.Update(groupID, fields, expectedUpdateAts)
	if uErr != nil {
		return nil, nil, nil, uErr
	}

	// Partition the returned fields into requested vs propagated by matching
	// against the IDs we submitted. This avoids assuming anything about the
	// ordering the store uses in its return value.
	requestedIDs := make(map[string]struct{}, len(fields))
	for _, f := range fields {
		requestedIDs[f.ID] = struct{}{}
	}

	requested = make([]*model.PropertyField, 0, len(fields))
	propagated = make([]*model.PropertyField, 0, len(all)-len(fields))
	for _, f := range all {
		if _, ok := requestedIDs[f.ID]; ok {
			requested = append(requested, f)
		} else {
			propagated = append(propagated, f)
		}
	}

	// Run post-hooks. prev is parallel to requested. Hooks may transform
	// either the requested or propagated bucket (e.g. attr redaction); the
	// dispatcher enforces cardinality preservation on both buckets so a buggy
	// hook that drops fields surfaces an error rather than silently truncating
	// the broadcast. cleared IDs are unioned across hooks.
	prev := make([]*model.PropertyField, 0, len(requested))
	for _, r := range requested {
		prev = append(prev, existingByID[r.ID])
	}
	requested, propagated, clearedFieldIDs = ps.runPostUpdatePropertyFields(rctx, groupID, prev, requested, propagated)

	return requested, propagated, clearedFieldIDs, nil
}

func (ps *PropertyService) deletePropertyField(groupID, id string) error {
	// if groupID is not empty, we need to check first that the field belongs to the group
	if groupID != "" {
		if _, err := ps.getPropertyField(groupID, id); err != nil {
			return fmt.Errorf("error getting property field %q for group %q: %w", id, groupID, err)
		}
	}

	// Deletion protection: cannot delete a field that has active linked dependents
	count, err := ps.fieldStore.CountLinkedFields(id)
	if err != nil {
		return fmt.Errorf("failed to count linked fields: %w", err)
	}
	if count > 0 {
		return model.NewAppError(
			"DeletePropertyField",
			"app.property_field.delete.has_linked_dependents.app_error",
			nil,
			"cannot delete field with active linked dependents; unlink or delete dependent fields first",
			http.StatusConflict,
		)
	}

	if err := ps.valueStore.DeleteForField(groupID, id); err != nil {
		return err
	}

	return ps.fieldStore.Delete(groupID, id)
}

// Public methods

func (ps *PropertyService) CreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	field, err := ps.runPreCreatePropertyField(rctx, field)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyField: %w", err)
	}

	return ps.createPropertyField(field)
}

func (ps *PropertyService) GetPropertyField(rctx request.CTX, groupID, id string) (*model.PropertyField, error) {
	field, err := ps.getPropertyField(groupID, id)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyField: %w", err)
	}

	return ps.runPostGetPropertyField(rctx, field)
}

func (ps *PropertyService) GetPropertyFields(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyField, error) {
	fields, err := ps.getPropertyFields(groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFields: %w", err)
	}

	return ps.runPostGetPropertyFields(rctx, fields)
}

func (ps *PropertyService) GetPropertyFieldsForGroup(rctx request.CTX, groupID string) ([]*model.PropertyField, error) {
	fields, err := ps.fieldStore.GetForGroup(context.Background(), groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldsForGroup: %w", err)
	}

	return ps.runPostGetPropertyFields(rctx, fields)
}

// GetPropertyFieldByName looks up a field by name within a group and target.
//
// Deprecated: name is not unique within a group when fields of different object
// types share a name. Use GetPropertyFieldByNameForObjectType to disambiguate.
func (ps *PropertyService) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, error) {
	field, err := ps.getPropertyFieldByName(groupID, targetID, name)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByName: %w", err)
	}

	return ps.runPostGetPropertyField(rctx, field)
}

func (ps *PropertyService) GetPropertyFieldByNameForObjectType(rctx request.CTX, groupID, targetID, objectType, name string) (*model.PropertyField, error) {
	field, err := ps.getPropertyFieldByNameForObjectType(groupID, targetID, objectType, name)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByNameForObjectType: %w", err)
	}

	return ps.runPostGetPropertyField(rctx, field)
}

func (ps *PropertyService) CountActivePropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	if err := ps.runPreCountPropertyFields(rctx, groupID); err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForGroup: %w", err)
	}
	return ps.countActivePropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountAllPropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	if err := ps.runPreCountPropertyFields(rctx, groupID); err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForGroup: %w", err)
	}
	return ps.countAllPropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountActivePropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	if err := ps.runPreCountPropertyFields(rctx, groupID); err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForTarget: %w", err)
	}
	return ps.countActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) CountAllPropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	if err := ps.runPreCountPropertyFields(rctx, groupID); err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForTarget: %w", err)
	}
	return ps.countAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	fields, err := ps.searchPropertyFields(groupID, opts)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyFields: %w", err)
	}

	return ps.runPostGetPropertyFields(rctx, fields)
}

// UpdatePropertyField updates a single field. It returns the updated field and
// the IDs of fields whose dependent property values were cleared as a side
// effect (e.g. by TypeChangeValueCleanupHook on a type change). Hooks may
// cascade clears to other fields, so the slice is not necessarily limited to
// the updated field's own ID. The caller is expected to publish any
// value-cleanup WS events.
func (ps *PropertyService) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, []string, error) {
	field, err := ps.runPreUpdatePropertyField(rctx, groupID, field)
	if err != nil {
		return nil, nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	return ps.updatePropertyField(rctx, groupID, field)
}

// UpdatePropertyFields updates a batch of fields and returns the requested set,
// any linked-property propagated fields, and the IDs of fields whose dependent
// property values were cleared as a side effect. The caller is expected to
// publish any value-cleanup WS events.
func (ps *PropertyService) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) (requested []*model.PropertyField, propagated []*model.PropertyField, clearedFieldIDs []string, err error) {
	fields, err = ps.runPreUpdatePropertyFields(rctx, groupID, fields)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("UpdatePropertyFields: %w", err)
	}

	return ps.updatePropertyFields(rctx, groupID, fields)
}

func (ps *PropertyService) DeletePropertyField(rctx request.CTX, groupID, id string) error {
	if err := ps.runPreDeletePropertyField(rctx, groupID, id); err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}

	return ps.deletePropertyField(groupID, id)
}

// asOptionSlice extracts the options from an attrs map as []map[string]any
// via direct type assertion. By the time options reach the service layer,
// they are always []any containing map[string]any elements (from JSON
// deserialization, EnsureOptionIDs, or AccessControlAttributeValidationHook.
// sanitizeAndValidateOptions — all of which normalize to this shape).
func asOptionSlice(attrs model.StringInterface) []map[string]any {
	if attrs == nil {
		return nil
	}
	raw, ok := attrs[model.PropertyFieldAttributeOptions]
	if !ok || raw == nil {
		return nil
	}
	slice, ok := raw.([]any)
	if !ok {
		return nil
	}
	result := make([]map[string]any, 0, len(slice))
	for _, item := range slice {
		if m, ok := item.(map[string]any); ok {
			result = append(result, m)
		}
	}
	return result
}

// optionsChanged compares the options in two attrs maps and returns true if they differ.
// Compares by building a map keyed on option ID and using reflect.DeepEqual for
// value comparison, which correctly handles nested structures (maps, slices).
func optionsChanged(oldAttrs, newAttrs model.StringInterface) bool {
	oldOpts := asOptionSlice(oldAttrs)
	newOpts := asOptionSlice(newAttrs)

	if len(oldOpts) != len(newOpts) {
		return true
	}

	// Both nil/empty means no change
	if len(oldOpts) == 0 {
		return false
	}

	// Build map of new options keyed by ID for lookup
	newByID := make(map[string]map[string]any, len(newOpts))
	for _, opt := range newOpts {
		if id, _ := opt["id"].(string); id != "" {
			newByID[id] = opt
		}
	}

	for _, oldOpt := range oldOpts {
		id, _ := oldOpt["id"].(string)
		newOpt, exists := newByID[id]
		if !exists {
			return true
		}
		if !reflect.DeepEqual(oldOpt, newOpt) {
			return true
		}
	}

	return false
}

// extractOptionIDList extracts the "id" field from each option in the given options value
// using direct type assertions (no JSON marshaling).
func extractOptionIDList(options any) []string {
	if options == nil {
		return nil
	}
	slice, ok := options.([]any)
	if !ok {
		return nil
	}
	ids := make([]string, 0, len(slice))
	for _, item := range slice {
		if m, ok := item.(map[string]any); ok {
			if id, ok := m["id"].(string); ok && id != "" {
				ids = append(ids, id)
			}
		}
	}
	return ids
}
