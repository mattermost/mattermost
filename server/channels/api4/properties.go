// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

const maxPropertyValuePatchItems = 50

func (api *API) InitProperties() {
	api.BaseRoutes.PropertyFields.Handle("", api.APISessionRequired(getPropertyFields)).Methods(http.MethodGet)
	api.BaseRoutes.PropertyValues.Handle("", api.APISessionRequired(getPropertyValues)).Methods(http.MethodGet)
	if api.srv.Config().FeatureFlags.IntegratedBoards {
		api.BaseRoutes.PropertyFields.Handle("", api.APISessionRequired(createPropertyField)).Methods(http.MethodPost)
		api.BaseRoutes.PropertyField.Handle("", api.APISessionRequired(patchPropertyField)).Methods(http.MethodPatch)
		api.BaseRoutes.PropertyField.Handle("", api.APISessionRequired(deletePropertyField)).Methods(http.MethodDelete)

		api.BaseRoutes.PropertyValues.Handle("", api.APISessionRequired(patchPropertyValues)).Methods(http.MethodPatch)
	}
}

func createPropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType()
	if c.Err != nil {
		return
	}

	group, appErr := c.App.GetPropertyGroup(c.AppContext, c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("createPropertyField", "api.property_field.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}

	var field *model.PropertyField
	if err := json.NewDecoder(r.Body).Decode(&field); err != nil || field == nil {
		c.SetInvalidParamWithErr("property_field", err)
		return
	}

	field.ObjectType = c.Params.ObjectType
	field.GroupID = group.ID

	auditRec := c.MakeAuditRecord(model.AuditEventCreatePropertyField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", field)

	createdField := executeCreatePropertyField(c, r, field)
	if c.Err != nil {
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
	group, appErr := c.App.GetPropertyGroup(c.AppContext, c.Params.GroupName)
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

	// Required target_type filter
	opts.TargetType = query.Get("target_type")
	if !model.IsValidPSAv2PropertyFieldTargetType(opts.TargetType) {
		c.Err = model.NewAppError("getPropertyFields", "api.property_field.get.invalid_target_type.app_error", nil, "", http.StatusBadRequest)
		return
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
	switch opts.TargetType {
	case "channel":
		if len(opts.TargetIDs) == 0 {
			c.Err = model.NewAppError("getPropertyFields", "api.property_field.get.target_id_required.app_error", nil, "", http.StatusBadRequest)
			return
		}
		hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), opts.TargetIDs[0], model.PermissionReadChannel)
		if !hasPermission {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	case "team":
		if len(opts.TargetIDs) == 0 {
			c.Err = model.NewAppError("getPropertyFields", "api.property_field.get.target_id_required.app_error", nil, "", http.StatusBadRequest)
			return
		}
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), opts.TargetIDs[0], model.PermissionViewTeam) {
			c.SetPermissionError(model.PermissionViewTeam)
			return
		}
	case "system":
		// System-level fields are visible to all authenticated users
	}

	fields, err := c.App.SearchPropertyFields(c.AppContext, group.ID, opts)
	if err != nil {
		c.Err = err
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

	group, appErr := c.App.GetPropertyGroup(c.AppContext, c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("patchPropertyField", "api.property_field.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}

	var patch *model.PropertyFieldPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil || patch == nil {
		c.SetInvalidParamWithErr("property_field_patch", err)
		return
	}

	if patch.Name != nil {
		*patch.Name = strings.TrimSpace(*patch.Name)
	}

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

	auditRec := c.MakeAuditRecord(model.AuditEventPatchPropertyField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field_patch", patch)

	updatedField, originalField := executePatchPropertyField(c, r, group.ID, c.Params.ObjectType, c.Params.FieldId, patch)
	if originalField != nil {
		auditRec.AddEventPriorState(originalField)
	}
	if c.Err != nil {
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

	group, appErr := c.App.GetPropertyGroup(c.AppContext, c.Params.GroupName)
	if appErr != nil {
		c.Err = model.NewAppError("deletePropertyField", "api.property_field.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePropertyField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "field_id", c.Params.FieldId)

	existingField := executeDeletePropertyField(c, r, group.ID, c.Params.ObjectType, c.Params.FieldId)
	if c.Err != nil {
		return
	}

	auditRec.AddEventPriorState(existingField)
	auditRec.Success()
	auditRec.AddEventResultState(existingField)
	auditRec.AddEventObjectType("property_field")

	ReturnStatusOK(w)
}

func getPropertyValues(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType()
	if c.Err != nil {
		return
	}

	if c.Params.ObjectType == model.PropertyFieldObjectTypeTemplate {
		c.Err = model.NewAppError("getPropertyValues", "api.property_value.template_no_values.app_error", nil, "template fields cannot have values", http.StatusBadRequest)
		return
	}

	c.RequireTargetId()
	if c.Err != nil {
		return
	}

	// Resolve group_name to internal group ID
	group, appErr := c.App.GetPropertyGroup(c.AppContext, c.Params.GroupName)
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

	values, err := c.App.SearchPropertyValues(c.AppContext, group.ID, opts)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	if err := json.NewEncoder(w).Encode(values); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchPropertyValues(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType()
	if c.Err != nil {
		return
	}

	if c.Params.ObjectType == model.PropertyFieldObjectTypeTemplate {
		c.Err = model.NewAppError("patchPropertyValues", "api.property_value.template_no_values.app_error", nil, "template fields cannot have values", http.StatusBadRequest)
		return
	}

	c.RequireTargetId()
	if c.Err != nil {
		return
	}

	var items []model.PropertyValuePatchItem
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		c.SetInvalidParamWithErr("property_values", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchPropertyValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_name", c.Params.GroupName)
	model.AddEventParameterToAuditRec(auditRec, "object_type", c.Params.ObjectType)
	model.AddEventParameterToAuditRec(auditRec, "target_id", c.Params.TargetId)

	upserted := executePatchPropertyValues(c, r, c.Params.GroupName, c.Params.ObjectType, c.Params.TargetId, items)
	if c.Err != nil {
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("property_value")

	if err := json.NewEncoder(w).Encode(upserted); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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
		// Self-access and unrestricted sessions (local mode) always pass.
		if targetID == c.AppContext.Session().UserId || c.AppContext.Session().IsUnrestricted() {
			return true
		}
		if write {
			// Writing another user's values requires PermissionEditOtherUsers.
			if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionEditOtherUsers) {
				c.SetPermissionError(model.PermissionEditOtherUsers)
				return false
			}
		} else {
			// Reading another user's values requires being able to see them.
			canSee, appErr := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, targetID)
			if appErr != nil {
				c.Err = appErr
				return false
			}
			if !canSee {
				c.SetPermissionError(model.PermissionViewMembers)
				return false
			}
		}
	case model.PropertyFieldObjectTypeTemplate:
		// Templates don't have value targets — this should not be reached
		// if value endpoints properly reject template object type
		c.Err = model.NewAppError("hasTargetAccess", "api.property_value.template_no_values.app_error", nil, "template fields cannot have values", http.StatusBadRequest)
		return false
	default:
		c.Err = model.NewAppError("hasTargetAccess", "api.property_value.invalid_object_type.app_error", nil, "", http.StatusBadRequest)
		return false
	}
	return true
}

// sessionCallerID returns the caller ID to attach to a request-derived rctx
// for property-service hook identification. Local-mode (unrestricted)
// sessions have an empty Session.UserId but full admin privileges, so they
// are tagged with CallerIDLocalAdmin instead.
func sessionCallerID(c *Context) string {
	session := c.AppContext.Session()
	if session.IsUnrestricted() {
		return model.CallerIDLocalAdmin
	}
	return session.UserId
}

// executeCreatePropertyField performs scope-based permission checks, sets
// default permission levels, and creates the field. The caller must set
// GroupID, ObjectType and TargetType on the field before calling.
// Returns the created field or nil with c.Err set.
func executeCreatePropertyField(c *Context, r *http.Request, field *model.PropertyField) *model.PropertyField {
	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	if field.Protected {
		c.Err = model.NewAppError("executeCreatePropertyField", "api.property_field.create.protected_via_api.app_error", nil, "", http.StatusBadRequest)
		return nil
	}

	// Template creation is always sysadmin-only, regardless of target_type.
	if field.ObjectType == model.PropertyFieldObjectTypeTemplate &&
		!c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return nil
	}

	// Scope-based permission check
	switch field.TargetType {
	case "channel":
		if field.TargetID == "" {
			c.Err = model.NewAppError("executeCreatePropertyField", "api.property_field.create.target_id_required.app_error", nil, "", http.StatusBadRequest)
			return nil
		}
		hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), field.TargetID, model.PermissionCreatePost)
		if !hasPermission {
			c.SetPermissionError(model.PermissionCreatePost)
			return nil
		}
	case "team":
		if field.TargetID == "" {
			c.Err = model.NewAppError("executeCreatePropertyField", "api.property_field.create.target_id_required.app_error", nil, "", http.StatusBadRequest)
			return nil
		}
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), field.TargetID, model.PermissionManageTeam) {
			c.SetPermissionError(model.PermissionManageTeam)
			return nil
		}
	case "system":
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
			c.SetPermissionError(model.PermissionManageSystem)
			return nil
		}
	default:
		c.Err = model.NewAppError("executeCreatePropertyField", "api.property_field.create.invalid_target_type.app_error", nil, "", http.StatusBadRequest)
		return nil
	}

	field.Name = strings.TrimSpace(field.Name)

	// Set permission levels based on admin status.
	// Templates default to sysadmin since they define the schema linked fields inherit.
	isAdmin := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	defaultLevel := model.PermissionLevelMember
	if field.ObjectType == model.PropertyFieldObjectTypeTemplate {
		defaultLevel = model.PermissionLevelSysadmin
	}
	if !isAdmin {
		field.PermissionField = &defaultLevel
		field.PermissionValues = &defaultLevel
		field.PermissionOptions = &defaultLevel
	} else {
		if field.PermissionField == nil {
			field.PermissionField = &defaultLevel
		}
		if field.PermissionValues == nil {
			field.PermissionValues = &defaultLevel
		}
		if field.PermissionOptions == nil {
			field.PermissionOptions = &defaultLevel
		}
	}

	field.CreatedBy = c.AppContext.Session().UserId
	field.UpdatedBy = c.AppContext.Session().UserId

	connectionID := r.Header.Get(model.ConnectionId)

	createdField, err := c.App.CreatePropertyField(rctx, field, false, connectionID)
	if err != nil {
		c.Err = err
		return nil
	}

	return createdField
}

// executePatchPropertyField loads the existing field, checks permissions,
// applies the patch, and updates it. Returns the updated field and a
// snapshot of the field before patching (for audit prior state). On error,
// c.Err is set and updated is nil; original may still be non-nil if the
// field was loaded before the error occurred.
func executePatchPropertyField(c *Context, r *http.Request, groupID, objectType, fieldID string, patch *model.PropertyFieldPatch) (updated, original *model.PropertyField) {
	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	existingField, err := c.App.GetPropertyField(rctx, groupID, fieldID)
	if err != nil {
		c.Err = err
		return nil, nil
	}

	if existingField.IsPSAv1() {
		c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.patch.legacy_field.app_error", nil, "", http.StatusBadRequest)
		return nil, nil
	}

	if existingField.ObjectType != objectType {
		// 404 matches the shape of a non-existent field so that callers cannot
		// distinguish "no such field" from "field exists but in a different
		// object-type bucket".
		c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
		return nil, nil
	}

	if existingField.Protected {
		c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.update.protected_via_api.app_error", nil, "", http.StatusForbidden)
		return nil, nil
	}

	if existingField.LinkedFieldID != nil && *existingField.LinkedFieldID != "" {
		if patch.Type != nil {
			c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.patch.linked_type_change.app_error", nil, "cannot modify type of a linked field", http.StatusBadRequest)
			return nil, nil
		}
		if patch.Attrs != nil {
			if _, hasOpts := (*patch.Attrs)[model.PropertyFieldAttributeOptions]; hasOpts {
				c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.patch.linked_options_change.app_error", nil, "cannot modify options of a linked field", http.StatusBadRequest)
				return nil, nil
			}
		}
		if patch.LinkedFieldID != nil && *patch.LinkedFieldID != "" && *patch.LinkedFieldID != *existingField.LinkedFieldID {
			c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.patch.linked_field_change.app_error", nil, "cannot change link target; unlink first then create a new linked field", http.StatusBadRequest)
			return nil, nil
		}
	} else if patch.LinkedFieldID != nil && *patch.LinkedFieldID != "" {
		c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.patch.cannot_link_existing.app_error", nil, "linked_field_id can only be set at creation time", http.StatusBadRequest)
		return nil, nil
	}

	isOptionsOnlyUpdate := isOptionsOnlyPatch(patch)
	if isOptionsOnlyUpdate && existingField.Type != model.PropertyFieldTypeSelect && existingField.Type != model.PropertyFieldTypeMultiselect {
		isOptionsOnlyUpdate = false
	}

	if isOptionsOnlyUpdate {
		if !c.App.SessionHasPermissionToManagePropertyFieldOptions(rctx, *c.AppContext.Session(), existingField) {
			c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.update.no_options_permission.app_error", nil, "", http.StatusForbidden)
			return nil, nil
		}
	} else {
		if !c.App.SessionHasPermissionToEditPropertyField(rctx, *c.AppContext.Session(), existingField) {
			c.Err = model.NewAppError("executePatchPropertyField", "api.property_field.update.no_field_permission.app_error", nil, "", http.StatusForbidden)
			return nil, nil
		}
	}

	// Capture original state for audit before in-place patch.
	// Attrs map is shallow-copied because Patch mutates it.
	orig := *existingField
	if existingField.Attrs != nil {
		orig.Attrs = make(model.StringInterface, len(existingField.Attrs))
		maps.Copy(orig.Attrs, existingField.Attrs)
	}

	existingField.Patch(patch, true)
	existingField.UpdatedBy = c.AppContext.Session().UserId

	connectionID := r.Header.Get(model.ConnectionId)

	updatedField, updateErr := c.App.UpdatePropertyField(rctx, groupID, existingField, false, connectionID)
	if updateErr != nil {
		c.Err = updateErr
		return nil, &orig
	}

	return updatedField, &orig
}

// executeDeletePropertyField loads the existing field, checks permissions,
// and deletes it. Returns the deleted field (for audit) or nil with c.Err set.
func executeDeletePropertyField(c *Context, r *http.Request, groupID, objectType, fieldID string) *model.PropertyField {
	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	existingField, err := c.App.GetPropertyField(rctx, groupID, fieldID)
	if err != nil {
		c.Err = err
		return nil
	}

	if existingField.ObjectType != objectType {
		// 404 matches the shape of a non-existent field so that callers cannot
		// distinguish "no such field" from "field exists but in a different
		// object-type bucket".
		c.Err = model.NewAppError("executeDeletePropertyField", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
		return nil
	}

	if existingField.Protected {
		c.Err = model.NewAppError("executeDeletePropertyField", "api.property_field.delete.protected_via_api.app_error", nil, "", http.StatusForbidden)
		return nil
	}

	if !c.App.SessionHasPermissionToEditPropertyField(rctx, *c.AppContext.Session(), existingField) {
		c.Err = model.NewAppError("executeDeletePropertyField", "api.property_field.delete.no_permission.app_error", nil, "", http.StatusForbidden)
		return nil
	}

	connectionID := r.Header.Get(model.ConnectionId)

	if deleteErr := c.App.DeletePropertyField(rctx, groupID, fieldID, false, connectionID); deleteErr != nil {
		c.Err = deleteErr
		return nil
	}

	return existingField
}

// executePatchPropertyValues checks target access, resolves the group,
// validates fields, checks per-field permissions, and upserts values.
// Returns the upserted values or nil with c.Err set.
func executePatchPropertyValues(c *Context, r *http.Request, groupName, objectType, targetID string, items []model.PropertyValuePatchItem) []*model.PropertyValue {
	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	if !hasTargetAccess(c, objectType, targetID, true) {
		return nil
	}

	group, appErr := c.App.GetPropertyGroup(rctx, groupName)
	if appErr != nil {
		c.Err = model.NewAppError("executePatchPropertyValues", "api.property_value.invalid_group_name.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		return nil
	}
	groupID := group.ID

	if len(items) == 0 {
		c.Err = model.NewAppError("executePatchPropertyValues", "api.property_value.patch.empty_body.app_error", nil, "", http.StatusBadRequest)
		return nil
	}

	if len(items) > maxPropertyValuePatchItems {
		c.Err = model.NewAppError("executePatchPropertyValues", "api.property_value.patch.too_many_items.request_error", map[string]any{
			"Max": maxPropertyValuePatchItems,
		}, "", http.StatusBadRequest)
		return nil
	}

	idMap := map[string]bool{}
	fieldIDs := make([]string, 0, len(items))
	for _, item := range items {
		if !model.IsValidId(item.FieldID) {
			c.Err = model.NewAppError("executePatchPropertyValues", "api.property_value.patch.invalid_field_id.app_error", nil, "", http.StatusBadRequest)
			return nil
		}
		if idMap[item.FieldID] {
			c.Err = model.NewAppError("executePatchPropertyValues", "api.property_value.patch.duplicate_field_id.app_error", nil, "", http.StatusBadRequest)
			return nil
		}
		idMap[item.FieldID] = true
		fieldIDs = append(fieldIDs, item.FieldID)
	}

	fields, err := c.App.GetPropertyFields(rctx, groupID, fieldIDs)
	if err != nil {
		c.Err = err
		return nil
	}

	fieldMap := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		fieldMap[f.ID] = f
	}

	for _, item := range items {
		field, ok := fieldMap[item.FieldID]
		if !ok {
			c.Err = model.NewAppError("executePatchPropertyValues", "api.property_value.patch.field_not_found.app_error",
				map[string]any{"FieldID": item.FieldID}, "", http.StatusNotFound)
			return nil
		}
		if field.ObjectType != objectType {
			// 404 matches the shape of a non-existent field so that callers cannot
			// distinguish "no such field" from "field exists but in a different
			// object-type bucket".
			c.Err = model.NewAppError("executePatchPropertyValues", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
			return nil
		}
		if !c.App.SessionHasPermissionToSetPropertyFieldValues(rctx, *c.AppContext.Session(), field) {
			c.Err = model.NewAppError("executePatchPropertyValues", "api.property_value.patch.no_values_permission.app_error", nil, "", http.StatusForbidden)
			return nil
		}
	}

	userID := c.AppContext.Session().UserId
	values := make([]*model.PropertyValue, len(items))
	for i, item := range items {
		values[i] = &model.PropertyValue{
			TargetID:   targetID,
			TargetType: objectType,
			GroupID:    groupID,
			FieldID:    item.FieldID,
			Value:      item.Value,
			CreatedBy:  userID,
			UpdatedBy:  userID,
		}
	}

	connectionID := r.Header.Get(model.ConnectionId)

	upserted, upsertErr := c.App.UpsertPropertyValues(rctx, values, objectType, targetID, connectionID)
	if upsertErr != nil {
		c.Err = upsertErr
		return nil
	}

	return upserted
}

// isOptionsOnlyPatch checks if the patch only modifies the options attribute.
// Returns true if the only change is to attrs.options.
func isOptionsOnlyPatch(patch *model.PropertyFieldPatch) bool {
	// If any field property (besides attrs) is being updated, it's not options-only
	if patch.Name != nil || patch.Type != nil || patch.TargetID != nil || patch.TargetType != nil || patch.LinkedFieldID != nil {
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
