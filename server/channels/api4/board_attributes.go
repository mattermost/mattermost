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

func (api *API) InitBoardAttributes() {
	if api.srv.Config().FeatureFlags.BoardAttributes {
		api.BaseRoutes.BoardAttributesFields.Handle("", api.APISessionRequired(listBoardAttributeFields)).Methods(http.MethodGet)
		api.BaseRoutes.BoardAttributesFields.Handle("", api.APISessionRequired(createBoardAttributeField)).Methods(http.MethodPost)
		api.BaseRoutes.BoardAttributesField.Handle("", api.APISessionRequired(patchBoardAttributeField)).Methods(http.MethodPatch)
		api.BaseRoutes.BoardAttributesField.Handle("", api.APISessionRequired(deleteBoardAttributeField)).Methods(http.MethodDelete)
	}
}

func listBoardAttributeFields(c *Context, w http.ResponseWriter, r *http.Request) {
	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.listBoardAttributeFields", "api.board_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	fields, appErr := c.App.GetBoardAttributeFields()
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(fields); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createBoardAttributeField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.createBoardAttributeField", "api.board_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	var pf *model.PropertyField
	err := json.NewDecoder(r.Body).Decode(&pf)
	if err != nil || pf == nil {
		c.SetInvalidParamWithErr("property_field", err)
		return
	}

	pf.Name = strings.TrimSpace(pf.Name)
	// Clear ID - the store will generate a new one. Frontend may send temporary IDs.
	pf.ID = ""
	// Clear timestamps - PreSave() will set these
	pf.CreateAt = 0
	pf.UpdateAt = 0
	pf.DeleteAt = 0

	auditRec := c.MakeAuditRecord("board_attribute_field_create", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", pf)

	createdField, appErr := c.App.CreateBoardAttributeField(pf)
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

func patchBoardAttributeField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.patchBoardAttributeField", "api.board_attributes.license_error", nil, "", http.StatusForbidden)
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
			c.Err = model.NewAppError("patchBoardAttributeField", "api.board_attributes.invalid_field_patch", nil, "", http.StatusBadRequest)
		}
		return
	}

	auditRec := c.MakeAuditRecord("board_attribute_field_patch", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field_patch", patch)

	originalField, appErr := c.App.GetBoardAttributeField(c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventPriorState(originalField)

	patchedField, appErr := c.App.PatchBoardAttributeField(c.Params.FieldId, patch)
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

func deleteBoardAttributeField(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !model.MinimumEnterpriseLicense(c.App.Channels().License()) {
		c.Err = model.NewAppError("Api4.deleteBoardAttributeField", "api.board_attributes.license_error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireFieldId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("board_attribute_field_delete", model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "field_id", c.Params.FieldId)

	field, appErr := c.App.GetBoardAttributeField(c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventPriorState(field)

	if appErr := c.App.DeleteBoardAttributeField(c.Params.FieldId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(field)
	auditRec.AddEventObjectType("property_field")

	ReturnStatusOK(w)
}
