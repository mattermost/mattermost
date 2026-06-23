// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file implements the "User Attributes" API handlers (formerly "Custom
// Profile Attributes" / CPA). Internal identifiers and URL paths retain the
// old naming for backward compatibility. See MM-68235.

package api4

import (
	"encoding/json"
	"maps"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitCustomProfileAttributes() {
	if api.srv.Config().FeatureFlags.CustomProfileAttributes {
		api.BaseRoutes.CustomProfileAttributesFields.Handle("", api.APISessionRequired(listCPAFields)).Methods(http.MethodGet)
		api.BaseRoutes.CustomProfileAttributesFields.Handle("", api.APISessionRequired(createCPAField)).Methods(http.MethodPost)
		api.BaseRoutes.CustomProfileAttributesField.Handle("", api.APISessionRequired(patchCPAField)).Methods(http.MethodPatch)
		api.BaseRoutes.CustomProfileAttributesField.Handle("", api.APISessionRequired(deleteCPAField)).Methods(http.MethodDelete)
		api.BaseRoutes.User.Handle("/custom_profile_attributes", api.APISessionRequired(listCPAValues)).Methods(http.MethodGet)
		api.BaseRoutes.CustomProfileAttributesValues.Handle("", api.APISessionRequired(patchCPAValues)).Methods(http.MethodPatch)
		api.BaseRoutes.CustomProfileAttributes.Handle("/group", api.APISessionRequired(getCPAGroup)).Methods(http.MethodGet)
		api.BaseRoutes.User.Handle("/custom_profile_attributes", api.APISessionRequired(patchCPAValuesForUser)).Methods(http.MethodPatch)
	}
}

func listCPAFields(c *Context, w http.ResponseWriter, r *http.Request) {
	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))
	group, appErr := c.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	pfs, appErr := c.App.SearchPropertyFields(rctx, group.ID, model.PropertyFieldSearchOpts{
		GroupID:    group.ID,
		ObjectType: model.PropertyFieldObjectTypeUser,
		PerPage:    model.AccessControlGroupFieldLimit + 5,
	})
	if appErr != nil {
		c.Err = appErr
		return
	}

	fields, convErr := model.CPAFieldsFromPropertyFields(pfs)
	if convErr != nil {
		c.Err = model.NewAppError("listCPAFields", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(convErr)
		return
	}

	if err := json.NewEncoder(w).Encode(fields); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	var pf *model.CPAField
	if err := json.NewDecoder(r.Body).Decode(&pf); err != nil || pf == nil {
		c.SetInvalidParamWithErr("property_field", err)
		return
	}

	pf.Name = strings.TrimSpace(pf.Name)

	auditRec := c.MakeAuditRecord(model.AuditEventCreateCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", pf)

	// CPA fields are system-scoped; only a system administrator may create
	// them. This mirrors the scope-based permission check the shared generic
	// handler enforces for system-typed fields.
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	// Translate to PropertyField and route through the generic property API.
	// Server-controlled fields (group, type, target shape, creator) are
	// stamped here; ID/TargetID/Protected are stripped so a caller can't
	// inject them. Permissions and timestamps are filled in by lower layers.
	field := pf.ToPropertyField()
	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.AccessControlPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}
	field.ID = ""
	field.GroupID = group.ID
	field.ObjectType = model.PropertyFieldObjectTypeUser
	field.TargetType = string(model.PropertyFieldTargetLevelSystem)
	field.TargetID = ""
	field.Protected = false
	field.CreatedBy = c.AppContext.Session().UserId
	field.UpdatedBy = c.AppContext.Session().UserId

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))
	connectionID := r.Header.Get(model.ConnectionId)

	createdField, appErr := c.App.CreatePropertyField(rctx, field, false, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	cpaField, convErr := model.NewCPAFieldFromPropertyField(createdField)
	if convErr != nil {
		c.Err = model.NewAppError("createCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(convErr)
		return
	}

	// Send CPA-specific websocket event for backwards compatibility
	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldCreated, "", "", "", nil, "")
	message.Add("field", cpaField)
	c.App.Publish(message)

	auditRec.AddEventObjectType("property_field")
	auditRec.AddEventResultState(cpaField)
	auditRec.Success()

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(cpaField); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFieldId()
	if c.Err != nil {
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
	// Target fields are server-controlled; prevent the caller from patching them.
	patch.TargetID = nil
	patch.TargetType = nil

	if err := patch.IsValid(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			c.Err = appErr
		} else {
			c.Err = model.NewAppError("patchCPAField", "api.custom_profile_attributes.invalid_field_patch", nil, "", http.StatusBadRequest)
		}
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field_patch", patch)

	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.AccessControlPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	existingField, appErr := c.App.GetPropertyField(rctx, group.ID, c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if existingField.ObjectType != model.PropertyFieldObjectTypeUser {
		c.Err = model.NewAppError("patchCPAField", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
		return
	}

	// Permission branching (session-bound).
	isOptionsOnly := isOptionsOnlyPatch(patch)
	if isOptionsOnly && !existingField.Type.SupportsOptions() {
		isOptionsOnly = false
	}
	if isOptionsOnly {
		if !c.App.SessionHasPermissionToManagePropertyFieldOptions(rctx, *c.AppContext.Session(), existingField) {
			c.Err = model.NewAppError("patchCPAField", "api.property_field.update.no_options_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToEditPropertyField(rctx, *c.AppContext.Session(), existingField) {
			c.Err = model.NewAppError("patchCPAField", "api.property_field.update.no_field_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	// Capture original state for audit before in-place patch (Attrs is
	// shallow-copied because Patch mutates it).
	orig := *existingField
	if existingField.Attrs != nil {
		orig.Attrs = make(model.StringInterface, len(existingField.Attrs))
		maps.Copy(orig.Attrs, existingField.Attrs)
	}
	auditRec.AddEventPriorState(&orig)

	existingField.Patch(patch, true)
	existingField.UpdatedBy = c.AppContext.Session().UserId
	connectionID := r.Header.Get(model.ConnectionId)

	updatedField, clearedIDs, updateErr := c.App.UpdatePropertyField(rctx, group.ID, existingField, false, connectionID)
	if updateErr != nil {
		c.Err = updateErr
		return
	}

	cpaField, convErr := model.NewCPAFieldFromPropertyField(updatedField)
	if convErr != nil {
		c.Err = model.NewAppError("patchCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(convErr)
		return
	}

	// CPA-specific websocket event (backward compat). delete_values:true tells
	// pre-PSAv2 webapp clients to clear cached values for this field; PSAv2
	// clients receive the same signal via WebsocketEventPropertyValuesUpdated
	// fired by App.UpdatePropertyField.
	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldUpdated, "", "", "", nil, "")
	message.Add("field", cpaField)
	message.Add("delete_values", len(clearedIDs) > 0)
	c.App.Publish(message)

	auditRec.Success()
	auditRec.AddEventResultState(cpaField)
	auditRec.AddEventObjectType("property_field")

	if err := json.NewEncoder(w).Encode(cpaField); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFieldId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "field_id", c.Params.FieldId)

	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.AccessControlPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	existingField, appErr := c.App.GetPropertyField(rctx, group.ID, c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if existingField.ObjectType != model.PropertyFieldObjectTypeUser {
		c.Err = model.NewAppError("deleteCPAField", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
		return
	}

	if !c.App.SessionHasPermissionToEditPropertyField(rctx, *c.AppContext.Session(), existingField) {
		c.Err = model.NewAppError("deleteCPAField", "api.property_field.delete.no_permission.app_error", nil, "", http.StatusForbidden)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)
	if deleteErr := c.App.DeletePropertyField(rctx, group.ID, c.Params.FieldId, false, connectionID); deleteErr != nil {
		c.Err = deleteErr
		return
	}

	// CPA-specific websocket event (backward compat)
	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldDeleted, "", "", "", nil, "")
	message.Add("field_id", c.Params.FieldId)
	c.App.Publish(message)

	auditRec.AddEventPriorState(existingField)
	auditRec.Success()
	auditRec.AddEventResultState(existingField)
	auditRec.AddEventObjectType("property_field")

	ReturnStatusOK(w)
}

func getCPAGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	// Every other CPA endpoint enforces MinimumEnterpriseLicense via the
	// LicenseCheckHook on field/value operations. GetPropertyGroup is not
	// hooked, so we enforce the same contract here inline.
	if !model.MinimumEnterpriseLicense(c.App.License()) {
		c.Err = model.NewAppError("getCPAGroup", "app.property.license_error", nil, "an Enterprise license is required", http.StatusForbidden)
		return
	}

	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.AccessControlPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]string{"id": group.ID}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// cpaPatchValues is the shared implementation for patchCPAValues and
// patchCPAValuesForUser. It translates the CPA request format to the generic
// property API, performs the same session-bound checks as the generic value
// patch handler (target access, batch caps, per-field permission), routes
// the upsert through App.UpsertPropertyValues, and emits the CPA-specific
// websocket event.
func cpaPatchValues(c *Context, w http.ResponseWriter, r *http.Request, userID string, updates map[string]json.RawMessage) {
	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))
	group, appErr := c.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !hasTargetAccess(c, model.PropertyFieldObjectTypeUser, userID, true) {
		return
	}

	// Translate CPA format → generic PropertyValuePatchItem list. Map
	// iteration is unordered, but FieldID uniqueness is guaranteed by the
	// JSON object key constraint, so we cannot hit duplicate-FieldID; still,
	// we keep the same shape as the generic handler for parity.
	items := make([]model.PropertyValuePatchItem, 0, len(updates))
	for fieldID, value := range updates {
		items = append(items, model.PropertyValuePatchItem{
			FieldID: fieldID,
			Value:   value,
		})
	}

	if len(items) == 0 {
		c.Err = model.NewAppError("cpaPatchValues", "api.property_value.patch.empty_body.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if len(items) > maxPropertyValuePatchItems {
		c.Err = model.NewAppError("cpaPatchValues", "api.property_value.patch.too_many_items.request_error", map[string]any{
			"Max": maxPropertyValuePatchItems,
		}, "", http.StatusBadRequest)
		return
	}

	fieldIDs := make([]string, 0, len(items))
	for _, item := range items {
		if !model.IsValidId(item.FieldID) {
			c.Err = model.NewAppError("cpaPatchValues", "api.property_value.patch.invalid_field_id.app_error", nil, "", http.StatusBadRequest)
			return
		}
		fieldIDs = append(fieldIDs, item.FieldID)
	}

	fields, fieldsErr := c.App.GetPropertyFields(rctx, group.ID, fieldIDs)
	if fieldsErr != nil {
		c.Err = fieldsErr
		return
	}
	fieldByID := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		fieldByID[f.ID] = f
	}
	for _, item := range items {
		f, ok := fieldByID[item.FieldID]
		if !ok {
			c.Err = model.NewAppError("cpaPatchValues", "api.property_value.patch.field_not_found.app_error",
				map[string]any{"FieldID": item.FieldID}, "", http.StatusNotFound)
			return
		}
		if f.ObjectType != model.PropertyFieldObjectTypeUser {
			c.Err = model.NewAppError("cpaPatchValues", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
			return
		}
		if !c.App.SessionHasPermissionToSetPropertyFieldValues(rctx, *c.AppContext.Session(), f, userID) {
			c.Err = model.NewAppError("cpaPatchValues", "api.property_value.patch.no_values_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	callerID := c.AppContext.Session().UserId
	values := make([]*model.PropertyValue, len(items))
	for i, item := range items {
		values[i] = &model.PropertyValue{
			TargetID:   userID,
			TargetType: model.PropertyFieldObjectTypeUser,
			GroupID:    group.ID,
			FieldID:    item.FieldID,
			Value:      item.Value,
			CreatedBy:  callerID,
			UpdatedBy:  callerID,
		}
	}
	connectionID := r.Header.Get(model.ConnectionId)

	upserted, upsertErr := c.App.UpsertPropertyValues(rctx, values, model.PropertyFieldObjectTypeUser, userID, connectionID)
	if upsertErr != nil {
		c.Err = upsertErr
		return
	}

	// Translate response to CPA format: {fieldID: value}
	results := make(map[string]json.RawMessage, len(upserted))
	for _, value := range upserted {
		results[value.FieldID] = value.Value
	}

	// CPA-specific websocket event (backward compat)
	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", results)
	c.App.Publish(message)

	if err := json.NewEncoder(w).Encode(results); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchCPAValues(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := c.AppContext.Session().UserId

	var updates map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		c.SetInvalidParamWithErr("value", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userID)

	cpaPatchValues(c, w, r, userID, updates)
	if c.Err != nil {
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("patchCPAValues")
}

func listCPAValues(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !hasTargetAccess(c, model.PropertyFieldObjectTypeUser, c.Params.UserId, false) {
		return
	}

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))
	group, appErr := c.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	values, appErr := c.App.SearchPropertyValues(rctx, group.ID, model.PropertyValueSearchOpts{
		TargetIDs:  []string{c.Params.UserId},
		TargetType: model.PropertyValueTargetTypeUser,
		// Single-target search: at most one value per (target, field), so the field cap bounds the page.
		PerPage: model.AccessControlGroupFieldLimit + 5,
	})
	if appErr != nil {
		c.Err = appErr
		return
	}

	returnValue := make(map[string]json.RawMessage)
	for _, value := range values {
		returnValue[value.FieldID] = value.Value
	}
	if err := json.NewEncoder(w).Encode(returnValue); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchCPAValuesForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userID := c.Params.UserId

	var updates map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		c.SetInvalidParamWithErr("value", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userID)

	cpaPatchValues(c, w, r, userID, updates)
	if c.Err != nil {
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("patchCPAValues")
}
