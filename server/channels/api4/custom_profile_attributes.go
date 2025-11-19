// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.listCPAFields", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	fields, appErr := c.App.ListCPAFields()
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(fields); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.createCPAField", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	var pf *model.CPAField
	err := json.NewDecoder(r.Body).Decode(&pf)
	if err != nil || pf == nil {
		c.SetInvalidParamWithErr("property_field", err)
		return
	}

	pf.Name = strings.TrimSpace(pf.Name)

	auditRec := c.MakeAuditRecord(model.AuditEventCreateCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", pf)

	createdField, appErr := c.App.CreateCPAField(pf)
	if appErr != nil {
		c.Err = appErr
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

func patchCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.patchCPAField", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireFieldId()
	if c.Err != nil {
		return
	}

	var patch *model.PropertyFieldPatch
	err := json.NewDecoder(r.Body).Decode(&patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr("property_field_patch", err)
		return
	}

	if patch.Name != nil {
		*patch.Name = strings.TrimSpace(*patch.Name)
	}
	if err := patch.IsValid(); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			c.Err = appErr
		} else {
			c.Err = model.NewAppError("createCPAField", "api.custom_profile_attributes.invalid_field_patch", nil, "", http.StatusBadRequest)
		}
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field_patch", patch)

	originalField, appErr := c.App.GetCPAField(c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventPriorState(originalField)

	patchedField, appErr := c.App.PatchCPAField(c.Params.FieldId, patch)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(patchedField)
	auditRec.AddEventObjectType("property_field")

	if err := json.NewEncoder(w).Encode(patchedField); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteCPAField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.deleteCPAField", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireFieldId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteCPAField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "field_id", c.Params.FieldId)

	field, appErr := c.App.GetCPAField(c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventPriorState(field)

	if appErr := c.App.DeleteCPAField(c.Params.FieldId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(field)
	auditRec.AddEventObjectType("property_field")

	ReturnStatusOK(w)
}

func getCPAGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.getCPAGroup", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	groupID, err := c.App.CpaGroupID()
	if err != nil {
		c.Err = model.NewAppError("Api4.getCPAGroup", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]string{"id": groupID}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchCPAValues(c *Context, w http.ResponseWriter, r *http.Request) {
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.patchCPAValues", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	userID := c.AppContext.Session().UserId
	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userID) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var updates map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		c.SetInvalidParamWithErr("value", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userID)

	// if the user is not an admin, we need to check that there are no
	// admin-managed fields
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		fields, appErr := c.App.ListCPAFields()
		if appErr != nil {
			c.Err = appErr
			return
		}

		// Check if any of the fields being updated are admin-managed
		for _, field := range fields {
			if _, isBeingUpdated := updates[field.ID]; isBeingUpdated {
				if field.IsAdminManaged() {
					c.Err = model.NewAppError("Api4.patchCPAValues", "app.custom_profile_attributes.property_field_is_managed.app_error", nil, "", http.StatusForbidden)
					return
				}
			}
		}
	}

	results := make(map[string]json.RawMessage, len(updates))
	for fieldID, rawValue := range updates {
		patchedValue, appErr := c.App.PatchCPAValue(userID, fieldID, rawValue, false)
		if appErr != nil {
			c.Err = appErr
			return
		}
		results[fieldID] = patchedValue.Value
	}

	auditRec.Success()
	auditRec.AddEventObjectType("patchCPAValues")

	if err := json.NewEncoder(w).Encode(results); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	userID := c.Params.UserId
	// we check unrestricted sessions to allow local mode requests to go through
	if !c.AppContext.Session().IsUnrestricted() {
		canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, userID)
		if err != nil || !canSee {
			c.SetPermissionError(model.PermissionViewMembers)
			return
		}
	}

	values, appErr := c.App.ListCPAValues(userID)
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
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.patchCPAValues", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	// Get userID from URL
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userID := c.Params.UserId

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userID) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var updates map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		c.SetInvalidParamWithErr("value", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchCPAValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "user_id", userID)

	// if the user is not an admin, we need to check that there are no
	// admin-managed fields
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		fields, appErr := c.App.ListCPAFields()
		if appErr != nil {
			c.Err = appErr
			return
		}

		// Check if any of the fields being updated are admin-managed
		for _, field := range fields {
			if _, isBeingUpdated := updates[field.ID]; isBeingUpdated {
				if field.IsAdminManaged() {
					c.Err = model.NewAppError("Api4.patchCPAValues", "app.custom_profile_attributes.property_field_is_managed.app_error", nil, "", http.StatusForbidden)
					return
				}
			}
		}
	}

	results := make(map[string]json.RawMessage, len(updates))
	for fieldID, rawValue := range updates {
		patchedValue, appErr := c.App.PatchCPAValue(userID, fieldID, rawValue, false)
		if appErr != nil {
			c.Err = appErr
			return
		}
		results[fieldID] = patchedValue.Value
	}

	auditRec.Success()
	auditRec.AddEventObjectType("patchCPAValues")

	if err := json.NewEncoder(w).Encode(results); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
