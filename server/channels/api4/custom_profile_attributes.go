// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
	// License check is kept here because the hook system doesn't cover
	// search/list operations. Write operations are covered by the hook.
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.listCPAFields", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	rctx := app.RequestContextWithCallerID(c.AppContext, c.AppContext.Session().UserId)
	fields, appErr := c.App.ListCPAFields(rctx)
	if appErr != nil {
		c.Err = appErr
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
	if appErr := pf.SanitizeAndValidate(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", pf)

	// Translate to PropertyField and route through the generic property API.
	// CPA fields are always system-scoped and admin-managed at the field level.
	field := pf.ToPropertyField()
	groupID, appErr := c.App.CpaGroupID()
	if appErr != nil {
		c.Err = appErr
		return
	}
	field.GroupID = groupID
	field.ObjectType = model.PropertyFieldObjectTypeUser
	field.TargetType = string(model.PropertyFieldTargetLevelSystem)
	sysadmin := model.PermissionLevelSysadmin
	field.PermissionField = &sysadmin
	field.PermissionOptions = &sysadmin
	// PermissionValues is set by the attribute validation hook based on managed attr

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

	groupID, appErr := c.App.CpaGroupID()
	if appErr != nil {
		c.Err = appErr
		return
	}

	updatedField := executePatchPropertyField(c, r, groupID, model.PropertyFieldObjectTypeUser, c.Params.FieldId, patch)
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

	groupID, appErr := c.App.CpaGroupID()
	if appErr != nil {
		c.Err = appErr
		return
	}

	existingField := executeDeletePropertyField(c, r, groupID, model.PropertyFieldObjectTypeUser, c.Params.FieldId)
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
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.getCPAGroup", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	groupID, appErr := c.App.CpaGroupID()
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]string{"id": groupID}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// cpaPatchValues is the shared implementation for patchCPAValues and
// patchCPAValuesForUser. It translates the CPA request format to the
// generic property API, routes through executePatchPropertyValues, and
// emits the CPA-specific websocket event.
func cpaPatchValues(c *Context, w http.ResponseWriter, r *http.Request, userID string, updates map[string]json.RawMessage) {
	// License check is kept here because the read path (GetPropertyFields)
	// inside executePatchPropertyValues returns a confusing error when the
	// license hook filters results. Write-only hooks block cleanly, but the
	// mixed read+write flow needs an early check.
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.cpaPatchValues", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

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
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.listCPAValues", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireUserId()
	if c.Err != nil {
		return
	}

	targetUserID := c.Params.UserId
	callerUserID := c.AppContext.Session().UserId

	// Allow unrestricted sessions (local mode) through
	if !c.AppContext.Session().IsUnrestricted() {
		canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, callerUserID, targetUserID)
		if err != nil || !canSee {
			c.SetPermissionError(model.PermissionViewMembers)
			return
		}
	}

	rctx := app.RequestContextWithCallerID(c.AppContext, callerUserID)
	values, appErr := c.App.ListCPAValues(rctx, targetUserID)
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
