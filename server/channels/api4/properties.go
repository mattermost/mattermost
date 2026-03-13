// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (api *API) InitProperties() {
	if api.srv.Config().FeatureFlags.IntegratedBoards {
		api.BaseRoutes.PropertyFields.Handle("", api.APISessionRequired(createPropertyField)).Methods(http.MethodPost)
		api.BaseRoutes.PropertyFields.Handle("", api.APISessionRequired(getPropertyFields)).Methods(http.MethodGet)
		api.BaseRoutes.PropertyField.Handle("", api.APISessionRequired(patchPropertyField)).Methods(http.MethodPatch)
		api.BaseRoutes.PropertyField.Handle("", api.APISessionRequired(deletePropertyField)).Methods(http.MethodDelete)

		api.BaseRoutes.PropertyValues.Handle("", api.APISessionRequired(getPropertyValues)).Methods(http.MethodGet)
		api.BaseRoutes.PropertyValues.Handle("", api.APISessionRequired(patchPropertyValues)).Methods(http.MethodPatch)
	}
}

// propertyFieldError converts an error from the app/property layer to an *model.AppError
// suitable for setting on the context.
func propertyFieldError(where string, err error) *model.AppError {
	var appErr *model.AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return model.NewAppError(where, "api.property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
}

func createPropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType()
	if c.Err != nil {
		return
	}

	// Resolve group_name to internal group ID
	group, appErr := c.App.GetPropertyGroup(c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("createPropertyField", "api.property_field.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}

	var field *model.PropertyField
	if err := json.NewDecoder(r.Body).Decode(&field); err != nil || field == nil {
		c.SetInvalidParamWithErr("property_field", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreatePropertyField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	// Set ObjectType and GroupID from URL
	field.ObjectType = c.Params.ObjectType
	field.GroupID = group.ID

	// Reject protected field creation via API
	if field.Protected {
		c.Err = model.NewAppError("createPropertyField", "api.property_field.create.protected_via_api.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Check scope access for creation
	switch field.TargetType {
	case "channel":
		if field.TargetID == "" {
			c.Err = model.NewAppError("createPropertyField", "api.property_field.create.target_id_required.app_error", nil, "", http.StatusBadRequest)
			return
		}
		hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), field.TargetID, model.PermissionCreatePost)
		if !hasPermission {
			c.SetPermissionError(model.PermissionCreatePost)
			return
		}
	case "team":
		if field.TargetID == "" {
			c.Err = model.NewAppError("createPropertyField", "api.property_field.create.target_id_required.app_error", nil, "", http.StatusBadRequest)
			return
		}
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), field.TargetID, model.PermissionManageTeam) {
			c.SetPermissionError(model.PermissionManageTeam)
			return
		}
	case "system":
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	default:
		c.Err = model.NewAppError("createPropertyField", "api.property_field.create.invalid_target_type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Trim whitespace from name
	field.Name = strings.TrimSpace(field.Name)

	// Check if user is admin
	isAdmin := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)

	// Set permissions based on admin status.
	// Permissions are not accepted from the request body; they're set by the server.
	memberLevel := model.PermissionLevelMember
	if !isAdmin {
		// Non-admin: force all permissions to member level
		field.PermissionField = &memberLevel
		field.PermissionValues = &memberLevel
		field.PermissionOptions = &memberLevel
	} else {
		// Admin with nil fields: set defaults to member level
		if field.PermissionField == nil {
			field.PermissionField = &memberLevel
		}
		if field.PermissionValues == nil {
			field.PermissionValues = &memberLevel
		}
		if field.PermissionOptions == nil {
			field.PermissionOptions = &memberLevel
		}
	}

	// Set creator
	field.CreatedBy = c.AppContext.Session().UserId
	field.UpdatedBy = c.AppContext.Session().UserId

	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", field)

	createdField, err := c.App.CreatePropertyField(field, false)
	if err != nil {
		c.Err = propertyFieldError("createPropertyField", err)
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(createdField)
	auditRec.AddEventObjectType("property_field")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(createdField); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPropertyFields(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType()
	if c.Err != nil {
		return
	}

	// Resolve group_name to internal group ID
	group, appErr := c.App.GetPropertyGroup(c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("getPropertyFields", "api.property_field.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}

	query := r.URL.Query()

	// Build search options
	opts := model.PropertyFieldSearchOpts{
		GroupID:    group.ID,
		ObjectType: c.Params.ObjectType,
		PerPage:    c.Params.PerPage,
	}

	// Parse cursor parameters for pagination
	if cursorID := query.Get("cursor_id"); cursorID != "" {
		createAt, _ := strconv.ParseInt(query.Get("cursor_create_at"), 10, 64)
		opts.Cursor = model.PropertyFieldSearchCursor{
			PropertyFieldID: cursorID,
			CreateAt:        createAt,
		}
		if err := opts.Cursor.IsValid(); err != nil {
			c.SetInvalidURLParam("cursor")
			return
		}
	}

	// Optional target_type filter
	if targetType := query.Get("target_type"); targetType != "" {
		opts.TargetType = targetType
	}

	// Optional target_id filter
	if targetID := query.Get("target_id"); targetID != "" {
		opts.TargetIDs = []string{targetID}
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPropertyFields, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_name", c.Params.GroupName)
	model.AddEventParameterToAuditRec(auditRec, "object_type", c.Params.ObjectType)

	// Resource-scoped target types require a target_id for access checks
	if opts.TargetType == "channel" || opts.TargetType == "team" {
		if len(opts.TargetIDs) == 0 {
			c.Err = model.NewAppError("getPropertyFields", "api.property_field.get.target_id_required.app_error", nil, "", http.StatusBadRequest)
			return
		}

		switch opts.TargetType {
		case "channel":
			hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), opts.TargetIDs[0], model.PermissionReadChannel)
			if !hasPermission {
				c.SetPermissionError(model.PermissionReadChannel)
				return
			}
		case "team":
			if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), opts.TargetIDs[0], model.PermissionViewTeam) {
				c.SetPermissionError(model.PermissionViewTeam)
				return
			}
		}
	}

	fields, err := c.App.SearchPropertyFields(group.ID, opts)
	if err != nil {
		c.Err = propertyFieldError("getPropertyFields", err)
		return
	}

	auditRec.Success()

	if err := json.NewEncoder(w).Encode(fields); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchPropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType().RequireFieldId()
	if c.Err != nil {
		return
	}

	// Resolve group_name to internal group ID
	group, appErr := c.App.GetPropertyGroup(c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("patchPropertyField", "api.property_field.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}
	groupID := group.ID

	var patch *model.PropertyFieldPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil || patch == nil {
		c.SetInvalidParamWithErr("property_field_patch", err)
		return
	}

	if patch.Name != nil {
		*patch.Name = strings.TrimSpace(*patch.Name)
	}

	// target_id and target_type are identity fields that define the
	// property's scope and cannot be modified via patch
	patch.TargetID = nil
	patch.TargetType = nil

	if err := patch.IsValid(); err != nil {
		var appErr *model.AppError
		if errors.As(err, &appErr) {
			c.Err = appErr
		} else {
			c.Err = model.NewAppError("patchPropertyField", "api.property_field.invalid_patch.app_error", nil, "", http.StatusBadRequest)
		}
		return
	}

	// Get existing field
	existingField, err := c.App.GetPropertyField(groupID, c.Params.FieldId)
	if err != nil {
		c.Err = propertyFieldError("patchPropertyField", err)
		return
	}

	// This API only supports PSAv2 fields (those with an ObjectType)
	if existingField.IsPSAv1() {
		c.Err = model.NewAppError("patchPropertyField", "api.property_field.patch.legacy_field.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Verify ObjectType matches
	if existingField.ObjectType != c.Params.ObjectType {
		c.Err = model.NewAppError("patchPropertyField", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchPropertyField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field_patch", patch)
	auditRec.AddEventPriorState(existingField)

	// Reject update of protected field
	if existingField.Protected {
		c.Err = model.NewAppError("patchPropertyField", "api.property_field.update.protected_via_api.app_error", nil, "", http.StatusForbidden)
		return
	}

	// Detect if this is an options-only update
	isOptionsOnlyUpdate := isOptionsOnlyPatch(patch)

	// Options-only permission path only applies to select/multiselect fields.
	// For other field types, treat options changes as a field update.
	if isOptionsOnlyUpdate && existingField.Type != model.PropertyFieldTypeSelect && existingField.Type != model.PropertyFieldTypeMultiselect {
		isOptionsOnlyUpdate = false
	}

	// Check permissions
	if isOptionsOnlyUpdate {
		if !c.App.SessionHasPermissionToManagePropertyFieldOptions(c.AppContext, *c.AppContext.Session(), existingField) {
			c.Err = model.NewAppError("patchPropertyField", "api.property_field.update.no_options_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToEditPropertyField(c.AppContext, *c.AppContext.Session(), existingField) {
			c.Err = model.NewAppError("patchPropertyField", "api.property_field.update.no_field_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	// Apply patch
	existingField.Patch(patch, true)
	existingField.UpdatedBy = c.AppContext.Session().UserId

	updatedField, err := c.App.UpdatePropertyField(groupID, existingField, false)
	if err != nil {
		c.Err = propertyFieldError("patchPropertyField", err)
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedField)
	auditRec.AddEventObjectType("property_field")

	if err := json.NewEncoder(w).Encode(updatedField); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType().RequireFieldId()
	if c.Err != nil {
		return
	}

	// Resolve group_name to internal group ID
	group, appErr := c.App.GetPropertyGroup(c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("deletePropertyField", "api.property_field.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}
	groupID := group.ID

	// Get existing field
	existingField, err := c.App.GetPropertyField(groupID, c.Params.FieldId)
	if err != nil {
		c.Err = propertyFieldError("deletePropertyField", err)
		return
	}

	// Verify ObjectType matches
	if existingField.ObjectType != c.Params.ObjectType {
		c.Err = model.NewAppError("deletePropertyField", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePropertyField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "field_id", c.Params.FieldId)
	auditRec.AddEventPriorState(existingField)

	// Reject deletion of protected field
	if existingField.Protected {
		c.Err = model.NewAppError("deletePropertyField", "api.property_field.delete.protected_via_api.app_error", nil, "", http.StatusForbidden)
		return
	}

	// Check field edit permission
	if !c.App.SessionHasPermissionToEditPropertyField(c.AppContext, *c.AppContext.Session(), existingField) {
		c.Err = model.NewAppError("deletePropertyField", "api.property_field.delete.no_permission.app_error", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.DeletePropertyField(groupID, c.Params.FieldId, false); err != nil {
		c.Err = propertyFieldError("deletePropertyField", err)
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(existingField)
	auditRec.AddEventObjectType("property_field")

	ReturnStatusOK(w)
}

func getPropertyValues(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType().RequireTargetId()
	if c.Err != nil {
		return
	}

	// Resolve group_name to internal group ID
	group, appErr := c.App.GetPropertyGroup(c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("getPropertyValues", "api.property_value.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}

	// Check target access based on object type
	if !hasTargetAccess(c, c.Params.ObjectType, c.Params.TargetId, false) {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPropertyValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_name", c.Params.GroupName)
	model.AddEventParameterToAuditRec(auditRec, "object_type", c.Params.ObjectType)
	model.AddEventParameterToAuditRec(auditRec, "target_id", c.Params.TargetId)

	query := r.URL.Query()

	opts := model.PropertyValueSearchOpts{
		TargetIDs:  []string{c.Params.TargetId},
		TargetType: c.Params.ObjectType,
		PerPage:    c.Params.PerPage,
	}

	// Parse cursor parameters for pagination
	if cursorID := query.Get("cursor_id"); cursorID != "" {
		createAt, _ := strconv.ParseInt(query.Get("cursor_create_at"), 10, 64)
		opts.Cursor = model.PropertyValueSearchCursor{
			PropertyValueID: cursorID,
			CreateAt:        createAt,
		}
		if err := opts.Cursor.IsValid(); err != nil {
			c.SetInvalidURLParam("cursor")
			return
		}
	}

	values, err := c.App.SearchPropertyValues(group.ID, opts)
	if err != nil {
		c.Err = propertyValueError("getPropertyValues", err)
		return
	}

	auditRec.Success()

	if err := json.NewEncoder(w).Encode(values); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchPropertyValues(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType().RequireTargetId()
	if c.Err != nil {
		return
	}

	// Check target access based on object type
	if !hasTargetAccess(c, c.Params.ObjectType, c.Params.TargetId, true) {
		return
	}

	// Resolve group_name to internal group ID
	group, appErr := c.App.GetPropertyGroup(c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("patchPropertyValues", "api.property_value.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}
	groupID := group.ID

	var items []model.PropertyValuePatchItem
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		c.SetInvalidParamWithErr("property_values", err)
		return
	}

	if len(items) == 0 {
		c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.empty_body.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Collect and validate field IDs
	fieldIDs := make([]string, len(items))
	for i, item := range items {
		if !model.IsValidId(item.FieldID) {
			c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.invalid_field_id.app_error", nil, "", http.StatusBadRequest)
			return
		}
		fieldIDs[i] = item.FieldID
	}

	// Load all fields and verify they belong to this group.
	// GetPropertyFields scopes the lookup by groupID, so fields from
	// a different group won't be found, causing a mismatch error.
	fields, err := c.App.GetPropertyFields(groupID, fieldIDs)
	if err != nil {
		// The store returns a mismatch error when some IDs are not found
		// within the group — treat this as a bad request (wrong group).
		var mismatchErr *store.ErrResultsMismatch
		if errors.As(err, &mismatchErr) {
			c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.field_group_mismatch.app_error", nil, "", http.StatusBadRequest)
			return
		}
		c.Err = propertyValueError("patchPropertyValues", err)
		return
	}

	// Build field map for permission checks
	fieldMap := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		fieldMap[f.ID] = f
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchPropertyValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_name", c.Params.GroupName)
	model.AddEventParameterToAuditRec(auditRec, "object_type", c.Params.ObjectType)
	model.AddEventParameterToAuditRec(auditRec, "target_id", c.Params.TargetId)

	// Check values permission on each field (all-or-nothing)
	for _, item := range items {
		field := fieldMap[item.FieldID]
		if !c.App.SessionHasPermissionToSetPropertyFieldValues(c.AppContext, *c.AppContext.Session(), field) {
			c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.no_values_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	// Build PropertyValue objects for upsert
	userID := c.AppContext.Session().UserId
	values := make([]*model.PropertyValue, len(items))
	for i, item := range items {
		values[i] = &model.PropertyValue{
			TargetID: c.Params.TargetId,
			// in PSAv2, values always point to entities of the same
			// type that their field.ObjectType
			TargetType: c.Params.ObjectType,
			GroupID:    groupID,
			FieldID:    item.FieldID,
			Value:      item.Value,
			CreatedBy:  userID,
			UpdatedBy:  userID,
		}
	}

	upserted, err := c.App.UpsertPropertyValues(values)
	if err != nil {
		c.Err = propertyValueError("patchPropertyValues", err)
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("property_value")

	if err := json.NewEncoder(w).Encode(upserted); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// propertyValueError converts an error from the app/property layer to an *model.AppError
// suitable for setting on the context.
func propertyValueError(where string, err error) *model.AppError {
	var appErr *model.AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return model.NewAppError(where, "api.property_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
}

// hasTargetAccess checks that the caller has access to the target entity
// identified by objectType and targetID. For reads (write=false) it checks
// read-level permissions; for writes it checks management-level permissions.
// It sets c.Err and returns false when access is denied.
func hasTargetAccess(c *Context, objectType, targetID string, write bool) bool {
	switch objectType {
	case model.PropertyFieldObjectTypeChannel:
		if !write {
			hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), targetID, model.PermissionReadChannel)
			if !hasPermission {
				c.SetPermissionError(model.PermissionReadChannel)
				return false
			}
		} else {
			channel, appErr := c.App.GetChannel(c.AppContext, targetID)
			if appErr != nil {
				c.Err = appErr
				return false
			}
			var perm *model.Permission
			switch channel.Type {
			case model.ChannelTypeOpen:
				perm = model.PermissionManagePublicChannelProperties
			case model.ChannelTypePrivate:
				perm = model.PermissionManagePrivateChannelProperties
			default:
				// DM/GM channels: just check membership via read permission
				perm = model.PermissionReadChannel
			}
			hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), targetID, perm)
			if !hasPermission {
				c.SetPermissionError(perm)
				return false
			}
		}
	case model.PropertyFieldObjectTypePost:
		post, appErr := c.App.GetSinglePost(c.AppContext, targetID, false)
		if appErr != nil {
			c.Err = appErr
			return false
		}
		perm := model.PermissionReadChannel
		if write {
			perm = model.PermissionCreatePost
		}
		hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, perm)
		if !hasPermission {
			c.SetPermissionError(perm)
			return false
		}
	case model.PropertyFieldObjectTypeUser:
		// Any authenticated user can read another user's property values.
		// Only the user themselves or a system admin can write values.
		if write && targetID != c.AppContext.Session().UserId {
			if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
				c.Err = model.NewAppError("hasTargetAccess", "api.property_value.target_user.forbidden.app_error", nil, "", http.StatusForbidden)
				return false
			}
		}
	default:
		c.Err = model.NewAppError("hasTargetAccess", "api.property_value.invalid_object_type.app_error", nil, "", http.StatusBadRequest)
		return false
	}
	return true
}

// isOptionsOnlyPatch checks if the patch only modifies the options attribute.
// Returns true if the only change is to attrs.options.
func isOptionsOnlyPatch(patch *model.PropertyFieldPatch) bool {
	// If any field property (besides attrs) is being updated, it's not options-only
	if patch.Name != nil || patch.Type != nil || patch.TargetID != nil || patch.TargetType != nil {
		return false
	}

	// If attrs is not being updated at all, it's not an options update
	if patch.Attrs == nil {
		return false
	}

	// Check if attrs only contains "options" key
	attrs := *patch.Attrs
	if len(attrs) == 0 {
		return false
	}

	// If attrs has only the "options" key, it's an options-only update
	_, hasOptions := attrs[model.PropertyFieldAttributeOptions]
	return len(attrs) == 1 && hasOptions
}
