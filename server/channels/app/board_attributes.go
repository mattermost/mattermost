// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

const (
	BoardAttributesFieldLimit = 20
)

var boardAttributesGroupID string

// BoardAttributesGroupID returns the group ID for board attributes, registering it if necessary.
func (a *App) BoardAttributesGroupID() (string, error) {
	if boardAttributesGroupID != "" {
		return boardAttributesGroupID, nil
	}

	group, err := a.Srv().propertyService.RegisterPropertyGroup(model.BoardAttributesPropertyGroupName)
	if err != nil {
		return "", errors.Wrap(err, "cannot register Board Attributes property group")
	}
	boardAttributesGroupID = group.ID

	return boardAttributesGroupID, nil
}

// GetBoardAttributeFields returns all board attribute fields.
func (a *App) GetBoardAttributeFields() ([]*model.PropertyField, *model.AppError) {
	groupID, err := a.BoardAttributesGroupID()
	if err != nil {
		return nil, model.NewAppError("GetBoardAttributeFields", "app.board_attributes.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID: groupID,
		PerPage: BoardAttributesFieldLimit,
	}

	fields, err := a.Srv().propertyService.SearchPropertyFields(groupID, opts)
	if err != nil {
		return nil, model.NewAppError("GetBoardAttributeFields", "app.board_attributes.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Sort by sort_order in attrs
	sort.Slice(fields, func(i, j int) bool {
		iOrder, _ := fields[i].Attrs["sort_order"].(float64)
		jOrder, _ := fields[j].Attrs["sort_order"].(float64)
		return int(iOrder) < int(jOrder)
	})

	return fields, nil
}

// GetBoardAttributeField returns a single board attribute field by ID.
func (a *App) GetBoardAttributeField(fieldID string) (*model.PropertyField, *model.AppError) {
	groupID, err := a.BoardAttributesGroupID()
	if err != nil {
		return nil, model.NewAppError("GetBoardAttributeField", "app.board_attributes.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	field, err := a.Srv().propertyService.GetPropertyField(groupID, fieldID)
	if err != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetBoardAttributeField", "app.board_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("GetBoardAttributeField", "app.board_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return field, nil
}

// CreateBoardAttributeField creates a new board attribute field.
func (a *App) CreateBoardAttributeField(field *model.PropertyField) (*model.PropertyField, *model.AppError) {
	groupID, err := a.BoardAttributesGroupID()
	if err != nil {
		return nil, model.NewAppError("CreateBoardAttributeField", "app.board_attributes.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fieldCount, err := a.Srv().propertyService.CountActivePropertyFieldsForGroup(groupID)
	if err != nil {
		return nil, model.NewAppError("CreateBoardAttributeField", "app.board_attributes.count_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if fieldCount >= BoardAttributesFieldLimit {
		return nil, model.NewAppError("CreateBoardAttributeField", "app.board_attributes.limit_reached.app_error", nil, "", http.StatusUnprocessableEntity).Wrap(err)
	}

	field.GroupID = groupID
	// Ensure ID is empty - the store expects this and will generate a new one
	field.ID = ""
	// Clear timestamps - PreSave() will set these
	field.CreateAt = 0
	field.UpdateAt = 0
	field.DeleteAt = 0

	// Assign IDs to options if they're empty (for select/multiselect fields)
	// This matches the behavior in User Attributes' SanitizeAndValidate()
	if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
		if options, ok := field.Attrs[model.PropertyFieldAttributeOptions]; ok {
			if optionsArr, ok := options.([]any); ok {
				updated := false
				for i := range optionsArr {
					if optionMap, ok := optionsArr[i].(map[string]any); ok {
						if id, ok := optionMap["id"].(string); !ok || id == "" {
							optionMap["id"] = model.NewId()
							updated = true
						}
					}
				}
				if updated {
					field.Attrs[model.PropertyFieldAttributeOptions] = optionsArr
				}
			}
		}
	}

	// Basic validation before passing to store
	if field.Name == "" {
		return nil, model.NewAppError("CreateBoardAttributeField", "model.property_field.is_valid.app_error", map[string]any{"FieldName": "name", "Reason": "value cannot be empty"}, "", http.StatusBadRequest)
	}

	// The store layer will call PreSave() and IsValid(), so we don't need to do it here.
	// The store expects an empty ID and will generate one.
	newField, err := a.Srv().propertyService.CreatePropertyField(field)
	if err != nil {
		var appErr *model.AppError
		var invalidInput *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			// Direct AppError
			return nil, appErr
		case errors.As(err, &invalidInput):
			// Store validation error - the ID was not empty
			return nil, model.NewAppError("CreateBoardAttributeField", "app.board_attributes.create_property_field.app_error", nil, err.Error(), http.StatusBadRequest).Wrap(err)
		default:
			// Try to unwrap to find an AppError (store wraps validation errors)
			unwrapped := errors.Unwrap(err)
			if unwrapped != nil && errors.As(unwrapped, &appErr) {
				return nil, appErr
			}
			return nil, model.NewAppError("CreateBoardAttributeField", "app.board_attributes.create_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return newField, nil
}

// PatchBoardAttributeField updates an existing board attribute field.
func (a *App) PatchBoardAttributeField(fieldID string, patch *model.PropertyFieldPatch) (*model.PropertyField, *model.AppError) {
	groupID, err := a.BoardAttributesGroupID()
	if err != nil {
		return nil, model.NewAppError("PatchBoardAttributeField", "app.board_attributes.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	existingField, err := a.Srv().propertyService.GetPropertyField(groupID, fieldID)
	if err != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("PatchBoardAttributeField", "app.board_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("PatchBoardAttributeField", "app.board_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	shouldDeleteValues := false
	if patch.Type != nil && *patch.Type != existingField.Type {
		shouldDeleteValues = true
	}

	if err := patch.IsValid(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("PatchBoardAttributeField", "app.board_attributes.patch_validation.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	existingField.Patch(patch)
	existingField.UpdateAt = model.GetMillis()

	// Assign IDs to options if they're empty (for select/multiselect fields)
	// This matches the behavior in User Attributes' SanitizeAndValidate()
	if existingField.Type == model.PropertyFieldTypeSelect || existingField.Type == model.PropertyFieldTypeMultiselect {
		if options, ok := existingField.Attrs[model.PropertyFieldAttributeOptions]; ok {
			if optionsArr, ok := options.([]any); ok {
				updated := false
				for i := range optionsArr {
					if optionMap, ok := optionsArr[i].(map[string]any); ok {
						if id, ok := optionMap["id"].(string); !ok || id == "" {
							optionMap["id"] = model.NewId()
							updated = true
						}
					}
				}
				if updated {
					existingField.Attrs[model.PropertyFieldAttributeOptions] = optionsArr
				}
			}
		}
	}

	patchedField, err := a.Srv().propertyService.UpdatePropertyField(groupID, existingField)
	if err != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("PatchBoardAttributeField", "app.board_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("PatchBoardAttributeField", "app.board_attributes.property_field_update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if shouldDeleteValues {
		if dErr := a.Srv().propertyService.DeletePropertyValuesForField(groupID, patchedField.ID); dErr != nil {
			a.Log().Error("Error deleting property values when updating field",
				mlog.String("fieldID", patchedField.ID),
				mlog.Err(dErr),
			)
		}
	}

	return patchedField, nil
}

// DeleteBoardAttributeField deletes a board attribute field.
func (a *App) DeleteBoardAttributeField(fieldID string) *model.AppError {
	// #region agent log
	if f, err := os.OpenFile("/Users/jgheithcock/Documents/GitHub/mattermost/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
		fmt.Fprintf(f, `{"location":"board_attributes.go:248","message":"DeleteBoardAttributeField called","data":{"fieldID":"%s"},"timestamp":%d,"sessionId":"debug-session","runId":"run1","hypothesisId":"D"}`+"\n", fieldID, time.Now().UnixMilli())
		f.Close()
	}
	// #endregion
	groupID, err := a.BoardAttributesGroupID()
	if err != nil {
		// #region agent log
		if f, err2 := os.OpenFile("/Users/jgheithcock/Documents/GitHub/mattermost/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err2 == nil {
			fmt.Fprintf(f, `{"location":"board_attributes.go:251","message":"DeleteBoardAttributeField groupID error","data":{"fieldID":"%s","error":"%s"},"timestamp":%d,"sessionId":"debug-session","runId":"run1","hypothesisId":"D"}`+"\n", fieldID, err.Error(), time.Now().UnixMilli())
			f.Close()
		}
		// #endregion
		return model.NewAppError("DeleteBoardAttributeField", "app.board_attributes.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// #region agent log
	if f, err2 := os.OpenFile("/Users/jgheithcock/Documents/GitHub/mattermost/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err2 == nil {
		fmt.Fprintf(f, `{"location":"board_attributes.go:254","message":"DeleteBoardAttributeField calling DeletePropertyField","data":{"fieldID":"%s","groupID":"%s"},"timestamp":%d,"sessionId":"debug-session","runId":"run1","hypothesisId":"D"}`+"\n", fieldID, groupID, time.Now().UnixMilli())
		f.Close()
	}
	// #endregion
	if err := a.Srv().propertyService.DeletePropertyField(groupID, fieldID); err != nil {
		// #region agent log
		if f, err2 := os.OpenFile("/Users/jgheithcock/Documents/GitHub/mattermost/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err2 == nil {
			fmt.Fprintf(f, `{"location":"board_attributes.go:255","message":"DeleteBoardAttributeField DeletePropertyField error","data":{"fieldID":"%s","error":"%s"},"timestamp":%d,"sessionId":"debug-session","runId":"run1","hypothesisId":"D"}`+"\n", fieldID, err.Error(), time.Now().UnixMilli())
			f.Close()
		}
		// #endregion
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteBoardAttributeField", "app.board_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteBoardAttributeField", "app.board_attributes.property_field_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// #region agent log
	if f, err2 := os.OpenFile("/Users/jgheithcock/Documents/GitHub/mattermost/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err2 == nil {
		fmt.Fprintf(f, `{"location":"board_attributes.go:262","message":"DeleteBoardAttributeField success","data":{"fieldID":"%s"},"timestamp":%d,"sessionId":"debug-session","runId":"run1","hypothesisId":"D"}`+"\n", fieldID, time.Now().UnixMilli())
		f.Close()
	}
	// #endregion
	return nil
}
