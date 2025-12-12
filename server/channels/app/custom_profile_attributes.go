// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

const (
	CustomProfileAttributesFieldLimit = 20
)

var cpaGroupID string

// ToDo: we should explore moving this to the database cache layer
// instead of maintaining the ID cached at the application level
func (a *App) CpaGroupID() (string, error) {
	if cpaGroupID != "" {
		return cpaGroupID, nil
	}

	cpaGroup, err := a.PropertyAccessService().RegisterPropertyGroup("", model.CustomProfileAttributesPropertyGroupName)
	if err != nil {
		return "", errors.Wrap(err, "cannot register Custom Profile Attributes property group")
	}
	cpaGroupID = cpaGroup.ID

	return cpaGroupID, nil
}

func (a *App) GetCPAField(fieldID string) (*model.CPAField, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	field, err := a.PropertyAccessService().GetPropertyField("", groupID, fieldID)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(field)
	if err != nil {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return cpaField, nil
}

// filterCPAFieldOptions filters field options based on access mode and caller's access level.
// If hasFullAccess is true, returns field unchanged.
// If hasFullAccess is false:
//   - For source_only: clears all options
//   - For shared_only: filters to only caller's associated options (fetches caller value if needed)
//   - For public or other modes: returns field unchanged
func (a *App) filterCPAFieldOptions(field *model.CPAField, hasFullAccess bool, callerUserID string) (*model.CPAField, *model.AppError) {
	// If caller has full access, no filtering needed
	if hasFullAccess {
		return field, nil
	}

	// Apply filtering based on access mode
	switch field.Attrs.AccessMode {
	case model.CustomProfileAttributesAccessModeSourceOnly:
		// source_only without access: clear all options
		filteredField := *field
		filteredField.Attrs.Options = model.PropertyOptions[*model.CustomProfileAttributesSelectOption]{}
		return &filteredField, nil

	case model.CustomProfileAttributesAccessModeSharedOnly:
		// shared_only without access: filter options to caller's associated options
		// Fetch caller's value for this field
		var callerValue json.RawMessage
		if callerUserID != "" {
			groupID, err := a.CpaGroupID()
			if err != nil {
				return nil, model.NewAppError("filterCPAFieldOptions", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			values, valErr := a.PropertyAccessService().SearchPropertyValues("", groupID, model.PropertyValueSearchOpts{
				TargetIDs: []string{callerUserID},
				FieldID:   field.ID,
				PerPage:   1,
			})
			if valErr != nil {
				return nil, model.NewAppError("filterCPAFieldOptions", "app.custom_profile_attributes.list_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(valErr)
			}
			if len(values) > 0 {
				callerValue = values[0].Value
			}
		}

		filteredOptions, err := model.FilterSharedOnlyOptions(field, callerValue)
		if err != nil {
			return nil, model.NewAppError("filterCPAFieldOptions", "app.custom_profile_attributes.filter_options.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		filteredField := *field
		filteredField.Attrs.Options = model.PropertyOptions[*model.CustomProfileAttributesSelectOption](filteredOptions)
		return &filteredField, nil

	default:
		// Public or unrecognized access mode - return unchanged
		return field, nil
	}
}

// ListCPAFieldsForCaller returns all CPA fields filtered by the caller's read access.
// For source_only fields without access, options are cleared.
// For shared_only fields without access, only the caller's associated options are shown.
// callerPluginID is used for source_only access control (from Mattermost-Plugin-ID header).
// callerUserID is used for shared_only option filtering (from authenticated session).
func (a *App) ListCPAFieldsForCaller(callerPluginID, callerUserID string) ([]*model.CPAField, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("ListCPAFieldsForCaller", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID: groupID,
		PerPage: CustomProfileAttributesFieldLimit,
	}

	fields, err := a.PropertyAccessService().SearchPropertyFields("", groupID, opts)
	if err != nil {
		return nil, model.NewAppError("ListCPAFieldsForCaller", "app.custom_profile_attributes.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Convert PropertyFields to CPAFields and apply access filtering
	cpaFields := make([]*model.CPAField, 0, len(fields))
	for _, field := range fields {
		cpaField, convErr := model.NewCPAFieldFromPropertyField(field)
		if convErr != nil {
			return nil, model.NewAppError("ListCPAFieldsForCaller", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(convErr)
		}

		// Check if caller has unrestricted read access
		hasFullAccess := model.CanReadPropertyFieldWithoutRestrictions(field, callerPluginID)

		// Apply option filtering (fetches caller value only if needed for shared_only)
		filteredField, appErr := a.filterCPAFieldOptions(cpaField, hasFullAccess, callerUserID)
		if appErr != nil {
			return nil, appErr
		}

		cpaFields = append(cpaFields, filteredField)
	}

	sort.Slice(cpaFields, func(i, j int) bool {
		return cpaFields[i].Attrs.SortOrder < cpaFields[j].Attrs.SortOrder
	})

	return cpaFields, nil
}

func (a *App) ListCPAFields() ([]*model.CPAField, *model.AppError) {
	return a.ListCPAFieldsForCaller("", "")
}

func (a *App) CreateCPAField(field *model.CPAField) (*model.CPAField, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fieldCount, err := a.PropertyAccessService().CountActivePropertyFieldsForGroup("", groupID)
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.count_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if fieldCount >= CustomProfileAttributesFieldLimit {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.limit_reached.app_error", nil, "", http.StatusUnprocessableEntity).Wrap(err)
	}

	field.GroupID = groupID

	if appErr := field.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	newField, err := a.PropertyAccessService().CreatePropertyField("", field.ToPropertyField())
	if err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.create_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(newField)
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldCreated, "", "", "", nil, "")
	message.Add("field", cpaField)
	a.Publish(message)

	return cpaField, nil
}

func (a *App) PatchCPAField(fieldID string, patch *model.PropertyFieldPatch) (*model.CPAField, *model.AppError) {
	existingField, appErr := a.GetCPAField(fieldID)
	if appErr != nil {
		return nil, appErr
	}

	shouldDeleteValues := false
	if patch.Type != nil && *patch.Type != existingField.Type {
		shouldDeleteValues = true
	}

	if err := existingField.Patch(patch); err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.patch_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr := existingField.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	patchedField, err := a.PropertyAccessService().UpdatePropertyField("", groupID, existingField.ToPropertyField())
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(patchedField)
	if err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if shouldDeleteValues {
		if dErr := a.PropertyAccessService().DeletePropertyValuesForField("", groupID, cpaField.ID); dErr != nil {
			a.Log().Error("Error deleting property values when updating field",
				mlog.String("fieldID", cpaField.ID),
				mlog.Err(dErr),
			)
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldUpdated, "", "", "", nil, "")
	message.Add("field", cpaField)
	message.Add("delete_values", shouldDeleteValues)
	a.Publish(message)

	return cpaField, nil
}

func (a *App) DeleteCPAField(id string) *model.AppError {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.PropertyAccessService().DeletePropertyField("", groupID, id); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldDeleted, "", "", "", nil, "")
	message.Add("field_id", id)
	a.Publish(message)

	return nil
}

// ListCPAValuesForCaller returns property values for a target user, filtered by the caller's read access.
// - source_only fields: values are omitted unless caller plugin is the source plugin
// - shared_only fields: values are filtered to the intersection of caller and target values
// - public fields: values are returned as-is
// callerUserID is the authenticated user making the request (for shared_only filtering).
// targetUserID is the user whose values are being fetched.
// callerPluginID is the plugin ID from the request header (for source_only access control).
func (a *App) ListCPAValuesForCaller(callerUserID, targetUserID, callerPluginID string) ([]*model.PropertyValue, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("ListCPAValuesForCaller", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Get all fields to check access modes
	fields, appErr := a.ListCPAFields()
	if appErr != nil {
		return nil, appErr
	}

	// Build a map of field ID to field for quick lookup
	fieldMap := make(map[string]*model.CPAField, len(fields))
	for _, field := range fields {
		fieldMap[field.ID] = field
	}

	// Get target user's values
	targetValues, err := a.PropertyAccessService().SearchPropertyValues("", groupID, model.PropertyValueSearchOpts{
		TargetIDs: []string{targetUserID},
		PerPage:   CustomProfileAttributesFieldLimit,
	})
	if err != nil {
		return nil, model.NewAppError("ListCPAValuesForCaller", "app.custom_profile_attributes.list_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Get caller's values (for shared_only filtering)
	var callerValuesMap map[string]json.RawMessage
	if callerUserID != "" && callerUserID != targetUserID {
		callerValues, valErr := a.PropertyAccessService().SearchPropertyValues("", groupID, model.PropertyValueSearchOpts{
			TargetIDs: []string{callerUserID},
			PerPage:   CustomProfileAttributesFieldLimit,
		})
		if valErr != nil {
			return nil, model.NewAppError("ListCPAValuesForCaller", "app.custom_profile_attributes.list_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(valErr)
		}
		callerValuesMap = make(map[string]json.RawMessage, len(callerValues))
		for _, val := range callerValues {
			callerValuesMap[val.FieldID] = val.Value
		}
	}

	// Filter values based on access mode
	filteredValues := make([]*model.PropertyValue, 0, len(targetValues))
	for _, targetValue := range targetValues {
		field, exists := fieldMap[targetValue.FieldID]
		if !exists {
			// Field doesn't exist anymore, skip
			continue
		}

		// Convert to PropertyField for access check
		propertyField := field.ToPropertyField()

		// Check if caller has unrestricted access
		hasFullAccess := model.CanReadPropertyFieldWithoutRestrictions(propertyField, callerPluginID)

		// Apply access filtering
		if hasFullAccess {
			// Full access: return value as-is
			filteredValues = append(filteredValues, targetValue)
		} else {
			switch field.Attrs.AccessMode {
			case model.CustomProfileAttributesAccessModeSourceOnly:
				// source_only without access: omit value entirely
				continue

			case model.CustomProfileAttributesAccessModeSharedOnly:
				// shared_only without access: filter to intersection
				// Special case: if caller is viewing their own profile, return the value as-is
				// (intersection of a value with itself is the value itself)
				if callerUserID == targetUserID {
					filteredValues = append(filteredValues, targetValue)
				} else {
					callerValue := callerValuesMap[field.ID]
					filteredValue, hasValue, filterErr := model.FilterSharedOnlyValue(field, callerValue, targetValue.Value)
					if filterErr != nil {
						return nil, model.NewAppError("ListCPAValuesForCaller", "app.custom_profile_attributes.filter_value.app_error", nil, "", http.StatusInternalServerError).Wrap(filterErr)
					}
					if hasValue {
						// Create a new PropertyValue with the filtered value
						newValue := *targetValue
						newValue.Value = filteredValue
						filteredValues = append(filteredValues, &newValue)
					}
					// If no intersection, omit the value entirely
				}

			default:
				// Public or unrecognized: return value as-is
				filteredValues = append(filteredValues, targetValue)
			}
		}
	}

	return filteredValues, nil
}

func (a *App) ListCPAValues(userID string) ([]*model.PropertyValue, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("ListCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	values, err := a.PropertyAccessService().SearchPropertyValues("", groupID, model.PropertyValueSearchOpts{
		TargetIDs: []string{userID},
		PerPage:   CustomProfileAttributesFieldLimit,
	})
	if err != nil {
		return nil, model.NewAppError("ListCPAValues", "app.custom_profile_attributes.list_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return values, nil
}

func (a *App) GetCPAValue(valueID string) (*model.PropertyValue, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	value, err := a.PropertyAccessService().GetPropertyValue("", groupID, valueID)
	if err != nil {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return value, nil
}

func (a *App) PatchCPAValue(userID string, fieldID string, value json.RawMessage, allowSynced bool) (*model.PropertyValue, *model.AppError) {
	values, appErr := a.PatchCPAValues(userID, map[string]json.RawMessage{fieldID: value}, allowSynced)
	if appErr != nil {
		return nil, appErr
	}

	return values[0], nil
}

func (a *App) PatchCPAValues(userID string, fieldValueMap map[string]json.RawMessage, allowSynced bool) ([]*model.PropertyValue, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	valuesToUpdate := []*model.PropertyValue{}
	for fieldID, rawValue := range fieldValueMap {
		// make sure field exists in this group
		cpaField, appErr := a.GetCPAField(fieldID)
		if appErr != nil {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		} else if cpaField.DeleteAt > 0 {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
		}

		if !allowSynced && cpaField.IsSynced() {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_is_synced.app_error", nil, "", http.StatusBadRequest)
		}

		sanitizedValue, sErr := model.SanitizeAndValidatePropertyValue(cpaField, rawValue)
		if sErr != nil {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.validate_value.app_error", nil, "", http.StatusBadRequest).Wrap(sErr)
		}

		value := &model.PropertyValue{
			GroupID:    groupID,
			TargetType: model.PropertyValueTargetTypeUser,
			TargetID:   userID,
			FieldID:    fieldID,
			Value:      sanitizedValue,
		}
		valuesToUpdate = append(valuesToUpdate, value)
	}

	updatedValues, err := a.PropertyAccessService().UpsertPropertyValues("", valuesToUpdate)
	if err != nil {
		return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_value_upsert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	updatedFieldValueMap := map[string]json.RawMessage{}
	for _, value := range updatedValues {
		updatedFieldValueMap[value.FieldID] = value.Value
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", updatedFieldValueMap)
	a.Publish(message)

	return updatedValues, nil
}

func (a *App) DeleteCPAValues(userID string) *model.AppError {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return model.NewAppError("DeleteCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.PropertyAccessService().DeletePropertyValuesForTarget("", groupID, "user", userID); err != nil {
		return model.NewAppError("DeleteCPAValues", "app.custom_profile_attributes.delete_property_values_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", map[string]json.RawMessage{})
	a.Publish(message)

	return nil
}

func (a *App) ValidatePluginFieldUpdate(groupID, fieldID, pluginID string) *model.AppError {
	field, err := a.PropertyAccessService().GetPropertyField("", groupID, fieldID)
	if err != nil {
		return model.NewAppError("ValidatePluginFieldUpdate",
			"app.custom_profile_attributes.get_field.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if !model.CanModifyPropertyField(field, pluginID) {
		return model.NewAppError("ValidatePluginFieldUpdate",
			"app.custom_profile_attributes.field_is_protected.app_error",
			nil, "protected fields can only be modified by the source plugin",
			http.StatusForbidden)
	}
	return nil
}

func (a *App) ValidatePluginFieldDelete(groupID, fieldID, pluginID string) *model.AppError {
	field, err := a.PropertyAccessService().GetPropertyField("", groupID, fieldID)
	if err != nil {
		return model.NewAppError("ValidatePluginFieldDelete",
			"app.custom_profile_attributes.get_field.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if !model.CanModifyPropertyField(field, pluginID) {
		return model.NewAppError("ValidatePluginFieldDelete",
			"app.custom_profile_attributes.field_is_protected.app_error",
			nil, "protected fields can only be deleted by the source plugin",
			http.StatusForbidden)
	}
	return nil
}

// ValidatePluginValueUpdate checks if a plugin can update a value for a CPA field.
// This validates both write access (protected) and read access (access_mode).
// If no read access, write access is denied as well.
func (a *App) ValidatePluginValueUpdate(groupID, fieldID, pluginID string) *model.AppError {
	field, err := a.PropertyAccessService().GetPropertyField("", groupID, fieldID)
	if err != nil {
		return model.NewAppError("ValidatePluginValueUpdate",
			"app.custom_profile_attributes.get_field.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Check read access first - if no read access, deny write access
	if !model.CanReadPropertyFieldWithoutRestrictions(field, pluginID) {
		return model.NewAppError("ValidatePluginValueUpdate",
			"app.custom_profile_attributes.no_read_access.app_error",
			nil, "cannot modify field values without read access",
			http.StatusForbidden)
	}

	// Check write access (protected field check)
	if !model.CanModifyPropertyField(field, pluginID) {
		return model.NewAppError("ValidatePluginValueUpdate",
			"app.custom_profile_attributes.field_is_protected.app_error",
			nil, "protected field values can only be modified by the source plugin",
			http.StatusForbidden)
	}

	return nil
}
