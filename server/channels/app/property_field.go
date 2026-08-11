// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// propertyFieldOptionsEqual reports whether two values from
// PropertyField.Attrs[options] are equivalent. Used to detect a no-op options
// patch on a linked field — see UpdatePropertyFields' linked-field invariants.
// Both nil/zero forms compare equal; otherwise reflect.DeepEqual handles the
// nested map/slice shape produced by JSON unmarshalling.
func propertyFieldOptionsEqual(a, b any) bool {
	if a == nil && b == nil {
		return true
	}
	return reflect.DeepEqual(a, b)
}

func propertyFieldBroadcastParams(rctx request.CTX, field *model.PropertyField) (teamID, channelID string, ok bool) {
	switch field.TargetType {
	case "team":
		return field.TargetID, "", true
	case "channel":
		return "", field.TargetID, true
	case "system":
		return "", "", true
	default:
		rctx.Logger().Warn(
			"Unrecognized property field TargetType, skipping broadcast",
			mlog.String("target_type", field.TargetType),
			mlog.String("field_id", field.ID),
		)
		return "", "", false
	}
}

func (a *App) publishPropertyFieldEvent(rctx request.CTX, eventType model.WebsocketEventType, field *model.PropertyField, connectionID string) {
	if field == nil || field.IsPSAv1() {
		return
	}
	teamID, channelID, ok := propertyFieldBroadcastParams(rctx, field)
	if !ok {
		return
	}
	fieldJSON, err := json.Marshal(field)
	if err != nil {
		rctx.Logger().Warn("Failed to encode property field to JSON", mlog.Err(err))
		return
	}
	message := model.NewWebSocketEvent(eventType, teamID, channelID, "", nil, connectionID)
	message.Add("property_field", string(fieldJSON))
	message.Add("object_type", field.ObjectType)
	a.Publish(message)
}

// rankPropertyFieldGate blocks the user-facing "rank" custom profile attribute
// type while the PropertyFieldRank feature flag is disabled. Consolidated here
// so that both CreatePropertyField (which blocks creating a rank field) and
// UpdatePropertyFields (which blocks converting an existing field to rank)
// share a single check.
//
// The gate is scoped to user-object fields, because that is the only place the
// user-facing rank type can originate: createCPAField forces ObjectType=user
// before reaching CreatePropertyField. Rank fields on other object types are
// intentionally exempt — in particular the classification-markings fields
// (template/system/channel in the access_control group) legitimately use the
// rank type and ship behind the separate, GA-by-default ClassificationMarkings
// flag. Gating those here would break the classification admin panel (create
// and edit alike) whenever PropertyFieldRank is off.
func (a *App) rankPropertyFieldGate(where string, field *model.PropertyField) *model.AppError {
	if field == nil || field.Type != model.PropertyFieldTypeRank {
		return nil
	}
	if field.ObjectType != model.PropertyFieldObjectTypeUser {
		return nil
	}
	if a.Config().FeatureFlags.PropertyFieldRank {
		return nil
	}
	return model.NewAppError(
		where,
		"app.property_field.rank_disabled.app_error",
		nil,
		"rank property fields are not enabled",
		http.StatusBadRequest,
	)
}

// CreatePropertyField creates a new property field.
func (a *App) CreatePropertyField(rctx request.CTX, field *model.PropertyField, bypassProtectedCheck bool, connectionID string) (*model.PropertyField, *model.AppError) {
	if field == nil {
		return nil, model.NewAppError("CreatePropertyField", "app.property_field.invalid_input.app_error", nil, "property field is required", http.StatusBadRequest)
	}

	// Intrinsic invariants (apply to every caller — HTTP, plugin, internal).
	CanonicalizeSystemObjectField(field)
	field.Name = strings.TrimSpace(field.Name)

	if appErr := a.rankPropertyFieldGate("CreatePropertyField", field); appErr != nil {
		return nil, appErr
	}

	if !bypassProtectedCheck && field.Protected {
		return nil, model.NewAppError(
			"CreatePropertyField",
			"app.property_field.create.protected.app_error",
			nil,
			"cannot create protected field",
			http.StatusBadRequest,
		)
	}

	createdField, err := a.Srv().propertyService.CreatePropertyField(rctx, field)
	if err != nil {
		if appErr := mapPropertyServiceError("CreatePropertyField", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("CreatePropertyField", "app.property_field.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldCreated, createdField, connectionID)

	return createdField, nil
}

// GetPropertyField retrieves a property field by group ID and field ID.
func (a *App) GetPropertyField(rctx request.CTX, groupID, fieldID string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyField(rctx, groupID, fieldID)
	if err != nil {
		if appErr := mapPropertyServiceError("GetPropertyField", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyField", "app.property_field.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// GetPropertyFields retrieves multiple property fields by their IDs.
func (a *App) GetPropertyFields(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.GetPropertyFields(rctx, groupID, ids)
	if err != nil {
		if appErr := mapPropertyServiceError("GetPropertyFields", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyFields", "app.property_field.get_many.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

// GetPropertyFieldByName retrieves a property field by name within a group and target.
//
// Deprecated: name is not unique within a group when fields of different object
// types share a name. Use GetPropertyFieldByNameForObjectType to scope the
// lookup to a single object type and get a deterministic result.
func (a *App) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyFieldByName(rctx, groupID, targetID, name)
	if err != nil {
		if appErr := mapPropertyServiceError("GetPropertyFieldByName", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyFieldByName", "app.property_field.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// GetPropertyFieldByNameForObjectType retrieves a property field by name within
// a group and target, scoped to a single object type. Prefer this over
// GetPropertyFieldByName when a name may be shared across object types within a
// group (e.g. the access_control "classification" fields).
func (a *App) GetPropertyFieldByNameForObjectType(rctx request.CTX, groupID, targetID, objectType, name string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyFieldByNameForObjectType(rctx, groupID, targetID, objectType, name)
	if err != nil {
		if appErr := mapPropertyServiceError("GetPropertyFieldByNameForObjectType", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyFieldByNameForObjectType", "app.property_field.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// SearchPropertyFields searches for property fields matching the given options.
func (a *App) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.SearchPropertyFields(rctx, groupID, opts)
	if err != nil {
		if appErr := mapPropertyServiceError("SearchPropertyFields", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("SearchPropertyFields", "app.property_field.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

// GetPropertyFieldsForGroup retrieves all active property fields for a group.
func (a *App) GetPropertyFieldsForGroup(rctx request.CTX, groupID string) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.GetPropertyFieldsForGroup(rctx, groupID)
	if err != nil {
		if appErr := mapPropertyServiceError("GetPropertyFieldsForGroup", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyFieldsForGroup", "app.property_field.get_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

// CountPropertyFieldsForGroup counts property fields for a group.
func (a *App) CountPropertyFieldsForGroup(rctx request.CTX, groupID string, includeDeleted bool) (int64, *model.AppError) {
	var count int64
	var err error
	if includeDeleted {
		count, err = a.Srv().propertyService.CountAllPropertyFieldsForGroup(rctx, groupID)
	} else {
		count, err = a.Srv().propertyService.CountActivePropertyFieldsForGroup(rctx, groupID)
	}

	if err != nil {
		if appErr := mapPropertyServiceError("CountPropertyFieldsForGroup", err); appErr != nil {
			return 0, appErr
		}
		return 0, model.NewAppError("CountPropertyFieldsForGroup", "app.property_field.count_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

// CountPropertyFieldsForTarget counts property fields for a specific target.
func (a *App) CountPropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string, includeDeleted bool) (int64, *model.AppError) {
	var count int64
	var err error
	if includeDeleted {
		count, err = a.Srv().propertyService.CountAllPropertyFieldsForTarget(rctx, groupID, targetType, targetID)
	} else {
		count, err = a.Srv().propertyService.CountActivePropertyFieldsForTarget(rctx, groupID, targetType, targetID)
	}

	if err != nil {
		if appErr := mapPropertyServiceError("CountPropertyFieldsForTarget", err); appErr != nil {
			return 0, appErr
		}
		return 0, model.NewAppError("CountPropertyFieldsForTarget", "app.property_field.count_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

// UpdatePropertyField updates an existing property field. The second return
// value lists the IDs of fields whose dependent property values were cleared
// as a side effect (e.g. by TypeChangeValueCleanupHook on a type change).
// Hooks may cascade clears to other fields, so the slice is not necessarily
// limited to the updated field's own ID.
func (a *App) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField, bypassProtectedCheck bool, connectionID string) (*model.PropertyField, []string, *model.AppError) {
	fields, clearedIDs, err := a.UpdatePropertyFields(rctx, groupID, []*model.PropertyField{field}, bypassProtectedCheck, connectionID)
	if err != nil {
		return nil, nil, err
	}

	return fields[0], clearedIDs, nil
}

// UpdatePropertyFields updates multiple property fields. The second return
// value lists the IDs of fields whose dependent property values were cleared
// as a side effect.
func (a *App) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField, bypassProtectedCheck bool, connectionID string) ([]*model.PropertyField, []string, *model.AppError) {
	if len(fields) == 0 {
		return nil, nil, model.NewAppError("UpdatePropertyFields", "app.property_field.invalid_input.app_error", nil, "property fields are required", http.StatusBadRequest)
	}

	// Intrinsic invariants — apply to every caller (HTTP, plugin, internal).
	// Service returns DB-order, not input-order, so we'll build a lookup map
	// keyed by ID below; collect IDs in this same pass.
	ids := make([]string, len(fields))
	for i, f := range fields {
		f.Name = strings.TrimSpace(f.Name)
		ids[i] = f.ID
	}

	// Load existing fields once. Used for: protected-check (gated by
	// bypassProtectedCheck), PSAv1 reject (always-on), linked-field diff
	// invariants (always-on).

	existingFields, err := a.Srv().propertyService.GetPropertyFields(rctx, groupID, ids)
	if err != nil {
		if appErr := mapPropertyServiceError("UpdatePropertyFields", err); appErr != nil {
			return nil, nil, appErr
		}
		return nil, nil, model.NewAppError("UpdatePropertyFields", "app.property_field.update.get_existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	existingByID := make(map[string]*model.PropertyField, len(existingFields))
	for _, ex := range existingFields {
		existingByID[ex.ID] = ex
	}

	for _, f := range fields {
		existing, ok := existingByID[f.ID]
		if !ok {
			// Service-level GetPropertyFields returns an ErrResultsMismatch when
			// any input ID is missing, so this branch is defensive.
			continue
		}

		// Rank-type gate: block converting a field to rank while the feature
		// flag is off (shares the create-path check).
		if appErr := a.rankPropertyFieldGate("UpdatePropertyFields", f); appErr != nil {
			return nil, nil, appErr
		}

		// Linked-field diff invariants. "Linked" = LinkedFieldID != nil &&
		// *LinkedFieldID != "". Unlink (nil or "") is always allowed when
		// existing was linked.
		existingLinked := existing.LinkedFieldID != nil && *existing.LinkedFieldID != ""
		incomingLinked := f.LinkedFieldID != nil && *f.LinkedFieldID != ""

		if existingLinked {
			if f.Type != existing.Type {
				return nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.linked_type_change.app_error",
					map[string]any{"FieldID": existing.ID},
					"cannot modify type of a linked field",
					http.StatusBadRequest,
				)
			}
			// Compare the options portion of Attrs.
			var existingOpts, incomingOpts any
			if existing.Attrs != nil {
				existingOpts = existing.Attrs[model.PropertyFieldAttributeOptions]
			}
			if f.Attrs != nil {
				incomingOpts = f.Attrs[model.PropertyFieldAttributeOptions]
			}
			if !propertyFieldOptionsEqual(existingOpts, incomingOpts) {
				return nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.linked_options_change.app_error",
					map[string]any{"FieldID": existing.ID},
					"cannot modify options of a linked field",
					http.StatusBadRequest,
				)
			}
			if incomingLinked && *f.LinkedFieldID != *existing.LinkedFieldID {
				return nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.cannot_change_link_target.app_error",
					map[string]any{"FieldID": existing.ID},
					"cannot change link target",
					http.StatusBadRequest,
				)
			}
		} else if incomingLinked {
			return nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.cannot_link_existing.app_error",
				map[string]any{"FieldID": existing.ID},
				"linked_field_id can only be set at creation time",
				http.StatusBadRequest,
			)
		}

		// Protected-check is the only invariant gated on the caller's opt-out.
		if !bypassProtectedCheck && existing.Protected {
			return nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.protected.app_error",
				map[string]any{"FieldID": existing.ID},
				"cannot update protected field",
				http.StatusForbidden,
			)
		}
	}

	updated, propagated, clearedFieldIDs, err := a.Srv().propertyService.UpdatePropertyFields(rctx, groupID, fields)
	if err != nil {
		if appErr := mapPropertyServiceError("UpdatePropertyFields", err); appErr != nil {
			return nil, nil, appErr
		}
		return nil, nil, model.NewAppError("UpdatePropertyFields", "app.property_field.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Notify the access control service so any per-field metadata it
	// caches (e.g. the rank-by-name lookup used by the live evaluator)
	// and any compiled-policy cache entries that depend on this field
	// are dropped. This runs before the websocket broadcast so a client
	// reacting to the event never re-reads stale cached metadata (mirrors
	// the ordering in DeletePropertyField).
	if acs := a.Srv().ch.AccessControl; acs != nil {
		for _, field := range updated {
			acs.OnPropertyFieldOptionsChanged(rctx, field.ID)
		}
		for _, field := range propagated {
			acs.OnPropertyFieldOptionsChanged(rctx, field.ID)
		}
	}

	// Broadcast websocket events for both requested and propagated fields
	for _, field := range updated {
		a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldUpdated, field, connectionID)
	}
	for _, field := range propagated {
		a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldUpdated, field, "")
	}

	// For each field whose dependent values were cleared as a side effect of
	// the update (e.g. a type change handled by TypeChangeValueCleanupHook),
	// publish the generic property_values_updated event so subscribers refresh
	// their local caches. Mirrors App.DeletePropertyValuesForField's wire shape.
	for _, fieldID := range clearedFieldIDs {
		message := model.NewWebSocketEvent(model.WebsocketEventPropertyValuesUpdated, "", "", "", nil, "")
		message.Add("field_id", fieldID)
		message.Add("values", "[]")
		a.Publish(message)
	}

	return updated, clearedFieldIDs, nil
}

// DeletePropertyField deletes a property field.
func (a *App) DeletePropertyField(rctx request.CTX, groupID, id string, bypassProtectedCheck bool, connectionID string) *model.AppError {
	existing, err := a.Srv().propertyService.GetPropertyField(rctx, groupID, id)
	if err != nil {
		if appErr := mapPropertyServiceError("DeletePropertyField", err); appErr != nil {
			return appErr
		}
		return model.NewAppError("DeletePropertyField", "app.property_field.delete.get_existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if existing == nil {
		return model.NewAppError("DeletePropertyField", "app.property_field.delete.not_found.app_error", nil, "", http.StatusNotFound)
	}

	if !bypassProtectedCheck && existing.Protected {
		return model.NewAppError(
			"DeletePropertyField",
			"app.property_field.delete.protected.app_error",
			nil,
			"cannot delete protected field",
			http.StatusForbidden,
		)
	}

	if err := a.Srv().propertyService.DeletePropertyField(rctx, groupID, id); err != nil {
		if appErr := mapPropertyServiceError("DeletePropertyField", err); appErr != nil {
			return appErr
		}
		return model.NewAppError("DeletePropertyField", "app.property_field.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Notify the access control service so any per-field metadata it caches
	// (e.g. the rank-by-name lookup used by the live evaluator) and any
	// compiled-policy cache entries that depend on this field are dropped
	// cluster-wide. Without this a deleted rank field's stale options would
	// linger in the per-node cache until restart.
	if acs := a.Srv().ch.AccessControl; acs != nil {
		acs.OnPropertyFieldOptionsChanged(rctx, existing.ID)
	}

	if existing.IsPSAv2() {
		teamID, channelID, ok := propertyFieldBroadcastParams(rctx, existing)
		if ok {
			message := model.NewWebSocketEvent(model.WebsocketEventPropertyFieldDeleted, teamID, channelID, "", nil, connectionID)
			message.Add("field_id", existing.ID)
			message.Add("object_type", existing.ObjectType)
			a.Publish(message)
		}
	}

	return nil
}
