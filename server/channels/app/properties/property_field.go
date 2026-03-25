// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
	fields, err := ps.updatePropertyFields(groupID, []*model.PropertyField{field})
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

func (ps *PropertyService) updatePropertyFields(groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 {
		return nil, nil
	}

	// Fetch existing fields to compare for changes that require conflict check
	ids := make([]string, len(fields))
	for i, f := range fields {
		if f == nil {
			return nil, fmt.Errorf("field at index %d is nil", i)
		}
		ids[i] = f.ID
	}

	existingFields, err := ps.fieldStore.GetMany(groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing fields for update: %w", err)
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

		// Block type changes on linked fields
		if existing.LinkedFieldID != nil && *existing.LinkedFieldID != "" && field.Type != existing.Type {
			return nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.linked_type_change.app_error",
				nil,
				"cannot modify type of a linked field",
				http.StatusBadRequest,
			)
		}

		// Block options changes on linked fields
		if existing.LinkedFieldID != nil && *existing.LinkedFieldID != "" && optionsChanged(existing.Attrs, field.Attrs) {
			return nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.linked_options_change.app_error",
				nil,
				"cannot modify options of a linked field",
				http.StatusBadRequest,
			)
		}

		// Block type changes on source fields with active linked dependents
		if field.Type != existing.Type {
			count, cErr := ps.fieldStore.CountLinkedFields(field.ID)
			if cErr != nil {
				return nil, fmt.Errorf("failed to count linked fields: %w", cErr)
			}
			if count > 0 {
				return nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.type_change_with_dependents.app_error",
					nil,
					"cannot change type of a field with active linked dependents",
					http.StatusConflict,
				)
			}
		}

		// Build propagation requests for fields whose options changed
		if optionsChanged(existing.Attrs, field.Attrs) {
			count, cErr := ps.fieldStore.CountLinkedFields(field.ID)
			if cErr != nil {
				return nil, fmt.Errorf("failed to count linked fields for propagation: %w", cErr)
			}
			if count > 0 {
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

		// Check if name, TargetType, or TargetID changed - these affect uniqueness
		nameChanged := existing.Name != field.Name
		targetTypeChanged := existing.TargetType != field.TargetType
		targetIDChanged := existing.TargetID != field.TargetID

		if nameChanged || targetTypeChanged || targetIDChanged {
			conflictLevel, cErr := ps.fieldStore.CheckPropertyNameConflict(field, field.ID)
			if cErr != nil {
				return nil, fmt.Errorf("failed to check property name conflict: %w", cErr)
			}

			if conflictLevel != "" {
				return nil, model.NewAppError(
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
	result, err := ps.fieldStore.UpdateAndPropagate(groupID, fields, propagations)
	if err != nil {
		return nil, err
	}

	// Async orphan cleanup: for each propagation where options were removed,
	// compute removed option IDs and clean up values referencing them
	for _, prop := range propagations {
		existing := existingByID[prop.SourceFieldID]
		removedIDs := computeRemovedOptionIDs(existing.Attrs, prop.Options)
		if len(removedIDs) == 0 {
			continue
		}

		fieldType := prop.FieldType
		sourceFieldID := prop.SourceFieldID

		go func() {
			defer func() {
				if r := recover(); r != nil {
					ps.logger.Error("Panic in orphan cleanup goroutine",
						mlog.String("source_field_id", sourceFieldID),
						mlog.Any("panic", r),
					)
				}
			}()

			// Find all linked field IDs for this source using cursor-based pagination
			const pageSize = 200
			fieldIDs := []string{sourceFieldID} // include source field itself
			var cursor model.PropertyFieldSearchCursor
			for {
				page, searchErr := ps.fieldStore.SearchPropertyFields(model.PropertyFieldSearchOpts{
					LinkedFieldID:  sourceFieldID,
					IncludeDeleted: false,
					PerPage:        pageSize,
					Cursor:         cursor,
				})
				if searchErr != nil {
					ps.logger.Warn("Failed to search linked fields for orphan cleanup",
						mlog.String("source_field_id", sourceFieldID),
						mlog.Err(searchErr),
					)
					return
				}
				for _, f := range page {
					fieldIDs = append(fieldIDs, f.ID)
				}
				if len(page) < pageSize {
					break
				}
				last := page[len(page)-1]
				cursor = model.PropertyFieldSearchCursor{
					PropertyFieldID: last.ID,
					CreateAt:        last.CreateAt,
				}
			}
			if len(fieldIDs) <= 1 {
				// Only the source field, no linked dependents found
				return
			}

			if deleteErr := ps.valueStore.DeleteValuesReferencingOptions(fieldIDs, removedIDs, fieldType); deleteErr != nil {
				ps.logger.Warn("Failed to delete orphaned values after option removal",
					mlog.String("source_field_id", sourceFieldID),
					mlog.Int("removed_options", len(removedIDs)),
					mlog.Err(deleteErr),
				)
			}
		}()
	}

	return result, nil
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
	requiresAC, err := ps.requiresAccessControl(field.GroupID)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.CreatePropertyField(callerID, field)
	}

	return ps.createPropertyField(field)
}

func (ps *PropertyService) GetPropertyField(rctx request.CTX, groupID, id string) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
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
	requiresAC, err := ps.requiresAccessControl(groupID)
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
	requiresAC, err := ps.requiresAccessControl(groupID)
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
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForGroup: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountActivePropertyFieldsForGroup(groupID)
	}

	return ps.countActivePropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountAllPropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForGroup: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountAllPropertyFieldsForGroup(groupID)
	}

	return ps.countAllPropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountActivePropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForTarget: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
	}

	return ps.countActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) CountAllPropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForTarget: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
	}

	return ps.countAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
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
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyField(callerID, groupID, field)
	}

	return ps.updatePropertyField(groupID, field)
}

func (ps *PropertyService) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyFields: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyFields(callerID, groupID, fields)
	}

	return ps.updatePropertyFields(groupID, fields)
}

func (ps *PropertyService) DeletePropertyField(rctx request.CTX, groupID, id string) error {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.DeletePropertyField(callerID, groupID, id)
	}

	return ps.deletePropertyField(groupID, id)
}

// optionsChanged compares the options in two attrs maps and returns true if they differ.
func optionsChanged(oldAttrs, newAttrs model.StringInterface) bool {
	var oldOpts, newOpts any
	if oldAttrs != nil {
		oldOpts = oldAttrs[model.PropertyFieldAttributeOptions]
	}
	if newAttrs != nil {
		newOpts = newAttrs[model.PropertyFieldAttributeOptions]
	}

	oldJSON, err1 := json.Marshal(oldOpts)
	newJSON, err2 := json.Marshal(newOpts)

	if err1 != nil || err2 != nil {
		// If marshaling fails, assume they differ
		return true
	}

	return string(oldJSON) != string(newJSON)
}

// computeRemovedOptionIDs extracts option IDs from the old attrs that are no longer
// present in the new options. Returns the list of removed option IDs.
func computeRemovedOptionIDs(oldAttrs model.StringInterface, newOptions any) []string {
	if oldAttrs == nil {
		return nil
	}

	oldOptionsRaw := oldAttrs[model.PropertyFieldAttributeOptions]
	if oldOptionsRaw == nil {
		return nil
	}

	oldIDs := extractOptionIDs(oldOptionsRaw)
	newIDs := extractOptionIDs(newOptions)

	newIDSet := make(map[string]struct{}, len(newIDs))
	for _, id := range newIDs {
		newIDSet[id] = struct{}{}
	}

	var removed []string
	for _, id := range oldIDs {
		if _, exists := newIDSet[id]; !exists {
			removed = append(removed, id)
		}
	}
	return removed
}

// extractOptionIDs extracts the "id" field from each option in the given options value.
func extractOptionIDs(options any) []string {
	if options == nil {
		return nil
	}

	b, err := json.Marshal(options)
	if err != nil {
		return nil
	}

	var opts []map[string]any
	if err := json.Unmarshal(b, &opts); err != nil {
		return nil
	}

	ids := make([]string, 0, len(opts))
	for _, opt := range opts {
		if id, ok := opt["id"].(string); ok && id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}
