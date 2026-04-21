// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file implements the "User Attributes" API handlers (formerly "Custom
// Profile Attributes" / CPA). Internal identifiers and URL paths retain the
// old naming for backward compatibility. See MM-68235.

package api4

import (
	"encoding/json"
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
	group, appErr := c.App.GetPropertyGroup(rctx, model.ProtectedAttributesPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	pfs, appErr := c.App.SearchPropertyFields(rctx, group.ID, model.PropertyFieldSearchOpts{
		GroupID:    group.ID,
		ObjectType: model.PropertyFieldObjectTypeUser,
		PerPage:    250,
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

	if appErr := pf.SanitizeAndValidate(); appErr != nil {
		c.Err = appErr
		return
	}

	// Translate to PropertyField and route through the generic property API.
	// Every server-controlled field on the decoded payload is explicitly
	// overwritten below so the no-mass-assignment invariant is local to this
	// handler: scope is fixed for CPA, identity/audit fields are store-owned,
	// and Protected plus all Permission* are enforced by the property hooks
	// registered for the protected_attributes group.
	field := pf.ToPropertyField()
	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.ProtectedAttributesPropertyGroupName)
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
	field.PermissionField = nil
	field.PermissionValues = nil
	field.PermissionOptions = nil
	field.CreatedBy = ""
	field.UpdatedBy = ""
	field.CreateAt = 0
	field.UpdateAt = 0
	field.DeleteAt = 0

	createdField := executeCreatePropertyField(c, r, field)
	if c.Err != nil {
		return
	}

	cpaField, convErr := model.NewCPAFieldFromPropertyField(createdField)
	if convErr != nil {
		c.Err = model.NewAppError("createCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(convErr)
		return
	}

	// CPA-specific websocket event (backward compat)
	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldCreated, "", "", "", nil, "")
	message.Add("field", cpaField)
	c.App.Publish(message)

	auditRec.Success()
	auditRec.AddEventResultState(cpaField)
	auditRec.AddEventObjectType("property_field")

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
	// CPA does not use targets
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

	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.ProtectedAttributesPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	updatedField, originalField := executePatchPropertyField(c, r, group.ID, model.PropertyFieldObjectTypeUser, c.Params.FieldId, patch)
	if originalField != nil {
		auditRec.AddEventPriorState(originalField)
	}
	if c.Err != nil {
		return
	}

	cpaField, convErr := model.NewCPAFieldFromPropertyField(updatedField)
	if convErr != nil {
		c.Err = model.NewAppError("patchCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(convErr)
		return
	}

	// CPA-specific websocket event (backward compat)
	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldUpdated, "", "", "", nil, "")
	message.Add("field", cpaField)
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

	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.ProtectedAttributesPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	existingField := executeDeletePropertyField(c, r, group.ID, model.PropertyFieldObjectTypeUser, c.Params.FieldId)
	if c.Err != nil {
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

	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.ProtectedAttributesPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]string{"id": group.ID}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// cpaPatchValues is the shared implementation for patchCPAValues and
// patchCPAValuesForUser. It translates the CPA request format to the
// generic property API, routes through executePatchPropertyValues, and
// emits the CPA-specific websocket event.
func cpaPatchValues(c *Context, w http.ResponseWriter, r *http.Request, userID string, updates map[string]json.RawMessage) {
	// Translate CPA format → generic PropertyValuePatchItem list
	items := make([]model.PropertyValuePatchItem, 0, len(updates))
	for fieldID, value := range updates {
		items = append(items, model.PropertyValuePatchItem{
			FieldID: fieldID,
			Value:   value,
		})
	}

	upserted := executePatchPropertyValues(c, r, model.ProtectedAttributesPropertyGroupName, model.PropertyFieldObjectTypeUser, userID, items)
	if c.Err != nil {
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
	group, appErr := c.App.GetPropertyGroup(rctx, model.ProtectedAttributesPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	values, appErr := c.App.SearchPropertyValues(rctx, group.ID, model.PropertyValueSearchOpts{
		TargetIDs:  []string{c.Params.UserId},
		TargetType: model.PropertyValueTargetTypeUser,
		PerPage:    250,
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
