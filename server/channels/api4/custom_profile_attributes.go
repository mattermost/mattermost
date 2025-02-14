// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitCustomProfileAttributes() {
	if api.srv.Config().FeatureFlags.CustomProfileAttributes {
		api.BaseRoutes.CustomProfileAttributesFields.Handle("", api.APISessionRequired(listCPAFields)).Methods(http.MethodGet)
		api.BaseRoutes.CustomProfileAttributesFields.Handle("", api.APISessionRequired(createCPAField)).Methods(http.MethodPost)
		api.BaseRoutes.CustomProfileAttributesField.Handle("", api.APISessionRequired(patchCPAField)).Methods(http.MethodPatch)
		api.BaseRoutes.CustomProfileAttributesField.Handle("", api.APISessionRequired(deleteCPAField)).Methods(http.MethodDelete)
		api.BaseRoutes.User.Handle("/custom_profile_attributes", api.APISessionRequired(listCPAValues)).Methods(http.MethodGet)
		api.BaseRoutes.CustomProfileAttributesValues.Handle("", api.APISessionRequired(patchCPAValues)).Methods(http.MethodPatch)
	}
}

func listCPAFields(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil || !c.App.Channels().License().IsE20OrEnterprise() {
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

	if c.App.Channels().License() == nil || !c.App.Channels().License().IsE20OrEnterprise() {
		c.Err = model.NewAppError("Api4.createCPAField", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	var pf *model.PropertyField
	err := json.NewDecoder(r.Body).Decode(&pf)
	if err != nil || pf == nil {
		c.SetInvalidParamWithErr("property_field", err)
		return
	}

	pf.SanitizeInput()

	auditRec := c.MakeAuditRecord("createCPAField", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "property_field", pf)

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

	if c.App.Channels().License() == nil || !c.App.Channels().License().IsE20OrEnterprise() {
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

	patch.SanitizeInput()

	auditRec := c.MakeAuditRecord("patchCPAField", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "property_field_patch", patch)

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

	if c.App.Channels().License() == nil || !c.App.Channels().License().IsE20OrEnterprise() {
		c.Err = model.NewAppError("Api4.deleteCPAField", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireFieldId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deleteCPAField", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "field_id", c.Params.FieldId)

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

func sanitizePropertyValue(fieldType model.PropertyFieldType, rawValue json.RawMessage) (json.RawMessage, error) {
	switch fieldType {
	case model.PropertyFieldTypeText, model.PropertyFieldTypeDate, model.PropertyFieldTypeSelect, model.PropertyFieldTypeUser:
		var value string
		if err := json.Unmarshal(rawValue, &value); err != nil {
			return nil, err
		}
		value = strings.TrimSpace(value)
		if fieldType == model.PropertyFieldTypeUser && value != "" && !model.IsValidId(value) {
			return nil, fmt.Errorf("invalid user id")
		}
		return json.Marshal(value)

	case model.PropertyFieldTypeMultiselect, model.PropertyFieldTypeMultiuser:
		var values []string
		if err := json.Unmarshal(rawValue, &values); err != nil {
			return nil, err
		}
		filteredValues := make([]string, 0, len(values))
		for _, v := range values {
			trimmed := strings.TrimSpace(v)
			if trimmed == "" {
				continue
			}
			if fieldType == model.PropertyFieldTypeMultiuser && !model.IsValidId(trimmed) {
				return nil, fmt.Errorf("invalid user id: %s", trimmed)
			}
			filteredValues = append(filteredValues, trimmed)
		}
		return json.Marshal(filteredValues)

	default:
		return nil, fmt.Errorf("unknown field type: %s", fieldType)
	}
}

func patchCPAValues(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil || !c.App.Channels().License().IsE20OrEnterprise() {
		c.Err = model.NewAppError("Api4.patchCPAValues", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	// This check is unnecessary for now
	// Will be required when/if admins can patch other's values
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

	auditRec := c.MakeAuditRecord("patchCPAValues", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "user_id", userID)

	// Get all fields at once and build a map for quick lookup
	allFields, appErr := c.App.ListCPAFields()
	if appErr != nil {
		c.Err = appErr
		return
	}

	fieldMap := make(map[string]*model.PropertyField)
	for _, field := range allFields {
		fieldMap[field.ID] = field
	}

	results := make(map[string]json.RawMessage, len(updates))
	for fieldID, rawValue := range updates {
		field, ok := fieldMap[fieldID]
		if !ok {
			c.Err = model.NewAppError("Api4.patchCPAValues", "api.custom_profile_attributes.field_not_found", nil, "", http.StatusBadRequest)
			return
		}

		sanitizedValue, err := sanitizePropertyValue(field.Type, rawValue)
		if err != nil {
			c.SetInvalidParam(fmt.Sprintf("value for field %s: %v", fieldID, err))
			return
		}

		patchedValue, appErr := c.App.PatchCPAValue(userID, fieldID, sanitizedValue)
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
	if c.App.Channels().License() == nil || !c.App.Channels().License().IsE20OrEnterprise() {
		c.Err = model.NewAppError("Api4.listCPAValues", "api.custom_profile_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireUserId()
	if c.Err != nil {
		return
	}

	userID := c.Params.UserId
	canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, userID)
	if err != nil || !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return
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
