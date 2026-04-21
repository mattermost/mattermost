// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"
	"net/http"

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

	// Check for hierarchical name conflicts
	// The store method uses a subquery to look up the channel's TeamId when needed
	// Pass empty string for excludeID since we're creating a new field
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

// getPropertyFields wraps store.ErrResultsMismatch with ErrFieldNotFound so
// hook callers surface a 404 via mapPropertyServiceError instead of a generic
// 500. The original store error stays in the chain, which keeps
// App.GetPropertyFields' own ErrResultsMismatch->400 branch working.
func (ps *PropertyService) getPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	fields, err := ps.fieldStore.GetMany(groupID, ids)
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
	return ps.fieldStore.GetFieldByName(groupID, targetID, name)
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

	// Check each field for changes that require validation
	for _, field := range fields {
		existing, ok := existingByID[field.ID]
		if !ok {
			// Field not found - the store.Update will handle this error
			continue
		}

		// Type changes are never allowed — users must delete and recreate
		if existing.Type != field.Type {
			return nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.type_change.app_error",
				map[string]any{"ID": field.ID, "OldType": string(existing.Type), "NewType": string(field.Type)},
				fmt.Sprintf("cannot change field type from %q to %q; delete and recreate the field instead", existing.Type, field.Type),
				http.StatusBadRequest,
			)
		}

		// Legacy properties (PSAv1) skip conflict check
		if field.IsPSAv1() {
			continue
		}

		// Check if name, TargetType, or TargetID changed - these affect uniqueness
		nameChanged := existing.Name != field.Name
		targetTypeChanged := existing.TargetType != field.TargetType
		targetIDChanged := existing.TargetID != field.TargetID

		if nameChanged || targetTypeChanged || targetIDChanged {
			// Check for conflicts, excluding the field being updated
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

	return ps.fieldStore.Update(groupID, fields)
}

func (ps *PropertyService) deletePropertyField(groupID, id string) error {
	// if groupID is not empty, we need to check first that the field belongs to the group
	if groupID != "" {
		if _, err := ps.getPropertyField(groupID, id); err != nil {
			return fmt.Errorf("error getting property field %q for group %q: %w", id, groupID, err)
		}
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

func (ps *PropertyService) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, error) {
	field, err := ps.getPropertyFieldByName(groupID, targetID, name)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByName: %w", err)
	}

	return ps.runPostGetPropertyField(rctx, field)
}

// Count methods run PreCountPropertyFields so group-level gating (e.g.
// license) applies. Access control hooks are no-ops for counts since a
// scalar total exposes no per-row data. Internal callers that need to
// bypass hooks (e.g. FieldLimitHook) use the private count* methods.

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

func (ps *PropertyService) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	field, err := ps.runPreUpdatePropertyField(rctx, groupID, field)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	return ps.updatePropertyField(groupID, field)
}

func (ps *PropertyService) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	fields, err := ps.runPreUpdatePropertyFields(rctx, groupID, fields)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyFields: %w", err)
	}

	return ps.updatePropertyFields(groupID, fields)
}

func (ps *PropertyService) DeletePropertyField(rctx request.CTX, groupID, id string) error {
	if err := ps.runPreDeletePropertyField(rctx, groupID, id); err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}

	return ps.deletePropertyField(groupID, id)
}
