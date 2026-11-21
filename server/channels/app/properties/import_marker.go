// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// The methods in this file read and write the bulk import's pending-run marker
// without going through the property hooks, for the same reason as
// MigrateBackfillCPADisplayName. The marker field is protected and locked to
// every human caller, sysadmins included, so that nobody can mark an existing
// account as one the import created and have the import overwrite it. The
// import itself has no caller identity the access-control layer would admit,
// so the only way it can maintain the marker is to bypass that layer here, in
// a few named methods that touch nothing but this one field.

const importMarkerClearPageSize = 100

// EnsureImportMarkerField returns the bulk import marker field, creating it if
// it doesn't exist yet.
func (ps *PropertyService) EnsureImportMarkerField(rctx request.CTX) (*model.PropertyField, error) {
	group, err := ps.Group(model.BulkImportPropertyGroupName)
	if err != nil {
		return nil, fmt.Errorf("EnsureImportMarkerField: %w", err)
	}

	masterCtx := store.RequestContextWithMaster(rctx)
	field, err := ps.getPropertyFieldByNameForObjectType(masterCtx, group.ID, "", model.PropertyFieldObjectTypeUser, model.BulkImportPendingRunPropertyField)
	if err == nil {
		return field, nil
	}
	if !store.IsErrNotFound(err) {
		return nil, fmt.Errorf("EnsureImportMarkerField: failed to get field: %w", err)
	}

	field, err = ps.createPropertyField(rctx, &model.PropertyField{
		GroupID:           group.ID,
		Name:              model.BulkImportPendingRunPropertyField,
		Type:              model.PropertyFieldTypeText,
		ObjectType:        model.PropertyFieldObjectTypeUser,
		TargetType:        "system",
		Protected:         true,
		PermissionField:   model.NewPointer(model.PermissionLevelNone),
		PermissionValues:  model.NewPointer(model.PermissionLevelNone),
		PermissionOptions: model.NewPointer(model.PermissionLevelNone),
	}, false, false)
	if err != nil {
		// Another node may have created it concurrently.
		existing, retryErr := ps.getPropertyFieldByNameForObjectType(masterCtx, group.ID, "", model.PropertyFieldObjectTypeUser, model.BulkImportPendingRunPropertyField)
		if retryErr != nil {
			return nil, fmt.Errorf("EnsureImportMarkerField: failed to create field: %w", err)
		}
		return existing, nil
	}
	return field, nil
}

// SetImportMarker records value as the pending import run of userID.
func (ps *PropertyService) SetImportMarker(rctx request.CTX, groupID, fieldID, userID, value string) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("SetImportMarker: %w", err)
	}
	if _, err := ps.upsertPropertyValue(rctx, &model.PropertyValue{
		GroupID:    groupID,
		FieldID:    fieldID,
		TargetType: model.PropertyValueTargetTypeUser,
		TargetID:   userID,
		Value:      raw,
	}); err != nil {
		return fmt.Errorf("SetImportMarker: %w", err)
	}
	return nil
}

// ImportMarkerMatches reports whether userID carries a pending import run
// marker equal to value.
func (ps *PropertyService) ImportMarkerMatches(rctx request.CTX, groupID, fieldID, userID, value string) (bool, error) {
	values, err := ps.searchPropertyValues(store.RequestContextWithMaster(rctx), groupID, model.PropertyValueSearchOpts{
		FieldID:    fieldID,
		TargetType: model.PropertyValueTargetTypeUser,
		TargetIDs:  []string{userID},
		PerPage:    1,
	})
	if err != nil {
		return false, fmt.Errorf("ImportMarkerMatches: %w", err)
	}
	if len(values) == 0 {
		return false, nil
	}

	var stored string
	if err := json.Unmarshal(values[0].Value, &stored); err != nil {
		return false, fmt.Errorf("ImportMarkerMatches: %w", err)
	}
	return stored == value, nil
}

// ClearImportMarkers hard-deletes every marker equal to value and returns how
// many accounts it cleared.
func (ps *PropertyService) ClearImportMarkers(rctx request.CTX, groupID, fieldID, value string) (int, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return 0, fmt.Errorf("ClearImportMarkers: %w", err)
	}

	masterCtx := store.RequestContextWithMaster(rctx)
	cleared := map[string]bool{}
	for {
		values, err := ps.searchPropertyValues(masterCtx, groupID, model.PropertyValueSearchOpts{
			FieldID: fieldID,
			Value:   raw,
			PerPage: importMarkerClearPageSize,
		})
		if err != nil {
			return len(cleared), fmt.Errorf("ClearImportMarkers: %w", err)
		}
		if len(values) == 0 {
			return len(cleared), nil
		}

		for _, v := range values {
			// A row that survives its delete would otherwise loop forever.
			if cleared[v.TargetID] {
				return len(cleared), fmt.Errorf("ClearImportMarkers: marker for %s was not deleted", v.TargetID)
			}
			if err := ps.deletePropertyValuesForTarget(groupID, v.TargetType, v.TargetID); err != nil {
				return len(cleared), fmt.Errorf("ClearImportMarkers: %w", err)
			}
			cleared[v.TargetID] = true
		}
	}
}
