// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"net/http"
	"reflect"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// Private implementation methods (database access)

func (ps *PropertyService) createPropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	// Legacy properties (PSAv1) skip conflict check
	if field.IsPSAv1() {
		return ps.fieldStore.Create(field)
	}

	// If this field links to a source, validate the source and copy its schema
	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		// Fetch source field across all groups (empty groupID)
		source, err := ps.fieldStore.Get("", *field.LinkedFieldID)
		if err != nil {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_not_found.app_error",
				nil,
				fmt.Sprintf("linked source field %q not found", *field.LinkedFieldID),
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
	return ps.fieldStore.Get(groupID, id)
}

func (ps *PropertyService) getPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	return ps.fieldStore.GetMany(groupID, ids)
}

func (ps *PropertyService) getPropertyFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	return ps.fieldStore.GetFieldByName(groupID, targetID, name)
}

func (ps *PropertyService) countActivePropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, false)
}

func (ps *PropertyService) countAllPropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, true)
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

func (ps *PropertyService) updatePropertyField(groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	fields, _, err := ps.updatePropertyFields(groupID, []*model.PropertyField{field})
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

func (ps *PropertyService) updatePropertyFields(groupID string, fields []*model.PropertyField) (requested []*model.PropertyField, propagated []*model.PropertyField, err error) {
	if len(fields) == 0 {
		return nil, nil, nil
	}

	// Fetch existing fields to compare for changes that require conflict check
	ids := make([]string, len(fields))
	for i, f := range fields {
		if f == nil {
			return nil, nil, fmt.Errorf("field at index %d is nil", i)
		}
		ids[i] = f.ID
	}

	existingFields, err := ps.fieldStore.GetMany(groupID, ids)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get existing fields for update: %w", err)
	}

	// Build a map of existing fields by ID for quick lookup
	existingByID := make(map[string]*model.PropertyField, len(existingFields))
	for _, ef := range existingFields {
		existingByID[ef.ID] = ef
	}

	var propagations []store.PropagationRequest

	// Check each field for changes that require conflict validation and linked field restrictions
	for _, field := range fields {
		existing, ok := existingByID[field.ID]
		if !ok {
			continue
		}

		// Legacy properties (PSAv1) skip conflict check
		if field.IsPSAv1() {
			continue
		}

		// TargetType, TargetID, and ObjectType are identity fields that define a
		// field's scope. They are set at creation and must not change. Allowing
		// mutations would let a caller escalate scope (e.g., channel → system)
		// or change semantics (e.g., promote to template) without going through
		// the creation-time validation that enforces permission and linking rules.
		if field.TargetType != existing.TargetType {
			return nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.immutable_target_type.app_error",
				nil,
				fmt.Sprintf("target_type is immutable (was %q, got %q)", existing.TargetType, field.TargetType),
				http.StatusBadRequest,
			)
		}
		if field.TargetID != existing.TargetID {
			return nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.immutable_target_id.app_error",
				nil,
				fmt.Sprintf("target_id is immutable (was %q, got %q)", existing.TargetID, field.TargetID),
				http.StatusBadRequest,
			)
		}
		if field.ObjectType != existing.ObjectType {
			return nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.immutable_object_type.app_error",
				nil,
				fmt.Sprintf("object_type is immutable (was %q, got %q)", existing.ObjectType, field.ObjectType),
				http.StatusBadRequest,
			)
		}

		// Block type changes on linked fields
		if existing.LinkedFieldID != nil && *existing.LinkedFieldID != "" && field.Type != existing.Type {
			return nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.linked_type_change.app_error",
				nil,
				"cannot modify type of a linked field",
				http.StatusBadRequest,
			)
		}

		// Block options changes on linked fields
		if existing.LinkedFieldID != nil && *existing.LinkedFieldID != "" && optionsChanged(existing.Attrs, field.Attrs) {
			return nil, nil, model.NewAppError(
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
			return nil, nil, model.NewAppError(
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
			return nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.cannot_change_link_target.app_error",
				nil,
				"cannot change link target; unlink first then create a new linked field",
				http.StatusBadRequest,
			)
		}

		// Check if this field has linked dependents (needed for type change
		// blocking and options propagation). Only query once.
		typeChanged := field.Type != existing.Type
		optsChanged := optionsChanged(existing.Attrs, field.Attrs)

		if typeChanged || optsChanged {
			count, cErr := ps.fieldStore.CountLinkedFields(field.ID)
			if cErr != nil {
				return nil, nil, fmt.Errorf("failed to count linked fields: %w", cErr)
			}

			if typeChanged && count > 0 {
				return nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.type_change_with_dependents.app_error",
					nil,
					"cannot change type of a field with active linked dependents",
					http.StatusConflict,
				)
			}

			if optsChanged && count > 0 {
				var opts any
				if field.Attrs != nil {
					opts = field.Attrs[model.PropertyFieldAttributeOptions]
				}
				propagations = append(propagations, store.PropagationRequest{
					SourceFieldID: field.ID,
					FieldType:     field.Type,
					Options:       opts,
				})
			}
		}

		// TargetType and TargetID are immutable (enforced above), so only
		// a name change can introduce a uniqueness conflict.
		if existing.Name != field.Name {
			conflictLevel, cErr := ps.fieldStore.CheckPropertyNameConflict(field, field.ID)
			if cErr != nil {
				return nil, nil, fmt.Errorf("failed to check property name conflict: %w", cErr)
			}

			if conflictLevel != "" {
				return nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.name_conflict.app_error",
					map[string]any{"Name": field.Name, "ConflictLevel": string(conflictLevel)},
					fmt.Sprintf("property name %q conflicts with existing %s-level property", field.Name, string(conflictLevel)),
					http.StatusConflict,
				)
			}
		}
	}

	// Use UpdateAndPropagate to atomically update fields and cascade options
	all, uErr := ps.fieldStore.UpdateAndPropagate(groupID, fields, propagations)
	if uErr != nil {
		return nil, nil, uErr
	}

	return all[:len(fields)], all[len(fields):], nil
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

// Public routing methods

func (ps *PropertyService) CreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(field.GroupID)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyField: %w", err)
	}

	// If the field links to a source whose group requires access control,
	// route through the access control service even if the field's own group
	// does not — the linked field inherits the source's security posture.
	if !requiresAC && field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		source, sErr := ps.fieldStore.Get("", *field.LinkedFieldID)
		if sErr != nil {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_not_found.app_error",
				nil,
				fmt.Sprintf("linked source field %q not found", *field.LinkedFieldID),
				http.StatusBadRequest,
			)
		}
		sourceRequiresAC, acErr := ps.requiresAccessControlForGroupID(source.GroupID)
		if acErr != nil {
			return nil, fmt.Errorf("CreatePropertyField: %w", acErr)
		}
		if sourceRequiresAC {
			requiresAC = true
		}
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.CreatePropertyField(callerID, field)
	}

	return ps.createPropertyField(field)
}

func (ps *PropertyService) GetPropertyField(rctx request.CTX, groupID, id string) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControlForFieldID(groupID, id)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyField(callerID, groupID, id)
	}

	return ps.getPropertyField(groupID, id)
}

func (ps *PropertyService) GetPropertyFields(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFields: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyFields(callerID, groupID, ids)
	}

	return ps.getPropertyFields(groupID, ids)
}

func (ps *PropertyService) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByName: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyFieldByName(callerID, groupID, targetID, name)
	}

	return ps.getPropertyFieldByName(groupID, targetID, name)
}

func (ps *PropertyService) CountActivePropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForGroup: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountActivePropertyFieldsForGroup(groupID)
	}

	return ps.countActivePropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountAllPropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForGroup: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountAllPropertyFieldsForGroup(groupID)
	}

	return ps.countAllPropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountActivePropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForTarget: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
	}

	return ps.countActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) CountAllPropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForTarget: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
	}

	return ps.countAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyFields: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.SearchPropertyFields(callerID, groupID, opts)
	}

	return ps.searchPropertyFields(groupID, opts)
}

func (ps *PropertyService) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControlForFieldID(groupID, field.ID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyField(callerID, groupID, field)
	}

	return ps.updatePropertyField(groupID, field)
}

func (ps *PropertyService) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) (requested []*model.PropertyField, propagated []*model.PropertyField, err error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, nil, fmt.Errorf("UpdatePropertyFields: %w", err)
	}

	// If the group itself doesn't require AC, check each field — a linked
	// field whose source lives in an AC group still needs enforcement.
	if !requiresAC {
		for _, f := range fields {
			fieldAC, fErr := ps.requiresAccessControlForFieldID(groupID, f.ID)
			if fErr != nil {
				return nil, nil, fmt.Errorf("UpdatePropertyFields: %w", fErr)
			}
			if fieldAC {
				requiresAC = true
				break
			}
		}
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyFields(callerID, groupID, fields)
	}

	return ps.updatePropertyFields(groupID, fields)
}

func (ps *PropertyService) DeletePropertyField(rctx request.CTX, groupID, id string) error {
	requiresAC, err := ps.requiresAccessControlForFieldID(groupID, id)
	if err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.DeletePropertyField(callerID, groupID, id)
	}

	return ps.deletePropertyField(groupID, id)
}


// asOptionSlice extracts the options from an attrs map as []map[string]any
// via direct type assertion. By the time options reach the service layer,
// they are always []any containing map[string]any elements (from JSON
// deserialization or EnsureOptionIDs).
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


// extractOptionIDs extracts the "id" field from each option in the given options value
// using direct type assertions (no JSON marshaling).
func extractOptionIDs(options any) []string {
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
