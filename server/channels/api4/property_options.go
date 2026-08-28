// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

// maxPropertyFieldOptionItems bounds how many options one request may create,
// change, or delete. The bound belongs to the property service, which holds every
// caller to it; this is where going over it is answered as a request-level
// refusal naming the limit, rather than as a rejected payload.
const maxPropertyFieldOptionItems = model.PropertyFieldOptionsMaxPerRequest

// propertyFieldForOptions resolves the field the URL addresses and checks the
// three things every options request needs of it. It sets c.Err and returns nil
// on failure.
//
// The field is returned rather than its ID because every caller needs it: whether
// the caller may change its options, and which of its options are its own rather
// than inherited from a template. A write does not decide anything against this
// copy's UpdateAt -- the property service re-reads the row it is about to swap
// on, since this read may have gone to a replica.
func propertyFieldForOptions(c *Context, callerName string) (*model.PropertyField, request.CTX) {
	c.RequireGroupName().RequireObjectType().RequireFieldId()
	if c.Err != nil {
		return nil, nil
	}

	group := getV2Group(c, callerName)
	if c.Err != nil {
		return nil, nil
	}

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	field, appErr := c.App.GetPropertyField(rctx, group.ID, c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return nil, nil
	}

	// Legacy fields predate the permission levels every check below rests on.
	if field.IsPSAv1() {
		c.Err = model.NewAppError(callerName, "api.property_field.options.legacy_field.app_error", nil, "", http.StatusBadRequest)
		return nil, nil
	}

	// A 404 indistinguishable from "no such field" lets fields be bucketed by the
	// object type in the URL without leaking cross-bucket existence.
	if field.ObjectType != c.Params.ObjectType {
		c.Err = model.NewAppError(callerName, "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
		return nil, nil
	}

	return field, rctx
}

// requireOptionsPermission checks that the session may change the options of the
// field it addressed.
//
// The field addressed is always the one that owns everything the change touches:
// an option a field merely inherits is refused as read-only, so the only options
// a request can reach are the ones this field owns. A field linking to a template
// therefore gates its own local options with its own permission level, which is
// the level it inherited from that template when it was created -- the same rule
// the field-level options patch already applies.
func requireOptionsPermission(c *Context, rctx request.CTX, field *model.PropertyField, callerName string) bool {
	if c.App.SessionHasPermissionToManagePropertyFieldOptions(rctx, *c.AppContext.Session(), field) {
		return true
	}
	c.Err = model.NewAppError(callerName, "api.property_field.options.no_permission.app_error", nil, "", http.StatusForbidden)
	return false
}

// decodePropertyFieldOptions reads the array of options a write carries and
// checks its size. It sets c.Err and returns nil on failure.
func decodePropertyFieldOptions(c *Context, r *http.Request, callerName string) []*model.PropertyFieldOption {
	var options []*model.PropertyFieldOption
	if err := json.NewDecoder(r.Body).Decode(&options); err != nil {
		c.SetInvalidParamWithErr("property_field_options", err)
		return nil
	}
	if !checkPropertyFieldOptionCount(c, len(options), callerName) {
		return nil
	}
	return options
}

// checkPropertyFieldOptionCount refuses a payload that names no options or too
// many of them. An empty one is refused rather than treated as a change to
// nothing, matching the option list a field is written with.
func checkPropertyFieldOptionCount(c *Context, count int, callerName string) bool {
	if count == 0 {
		c.Err = model.NewAppError(callerName, "api.property_field.options.empty_body.app_error", nil, "", http.StatusBadRequest)
		return false
	}
	if count > maxPropertyFieldOptionItems {
		c.Err = model.NewAppError(callerName, "api.property_field.options.too_many_items.request_error", map[string]any{
			"Max": maxPropertyFieldOptionItems,
		}, "", http.StatusBadRequest)
		return false
	}
	return true
}

func getPropertyFieldOptions(c *Context, w http.ResponseWriter, r *http.Request) {
	field, rctx := propertyFieldForOptions(c, "getPropertyFieldOptions")
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPropertyFieldOptions, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_name", c.Params.GroupName)
	model.AddEventParameterToAuditRec(auditRec, "field_id", field.ID)

	// A field's options are part of its definition, so seeing them is seeing the
	// field: the same scope check the field listing runs, against this field's own
	// scope rather than one from the query string.
	opts := model.PropertyFieldSearchOpts{TargetType: field.TargetType}
	if field.TargetID != "" {
		opts.TargetIDs = []string{field.TargetID}
	}
	if !resolveScopeAndCheckPermissions(c, &opts, "getPropertyFieldOptions") {
		return
	}

	query := r.URL.Query()
	cursorID := query.Get("cursor_id")
	var cursorCreateAt int64
	if v := query.Get("cursor_create_at"); v != "" {
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("cursor_create_at", err)
			return
		}
		cursorCreateAt = parsed
	}
	// Both halves or neither: the page continues after one particular option, and
	// an option is placed in the order by its creation time as well as its ID. A
	// cursor missing the time would silently start from the beginning.
	if cursorCreateAt < 0 || (cursorID == "") != (cursorCreateAt == 0) {
		c.Err = model.NewAppError("getPropertyFieldOptions", "api.property_field.options.invalid_cursor.app_error", nil, "", http.StatusBadRequest)
		return
	}

	perPage := min(c.Params.PerPage, maxPropertyFieldOptionItems)

	options, appErr := c.App.GetPropertyFieldOptions(rctx, field, cursorCreateAt, cursorID, perPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	if err := json.NewEncoder(w).Encode(options); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createPropertyFieldOptions(c *Context, w http.ResponseWriter, r *http.Request) {
	field, rctx := propertyFieldForOptions(c, "createPropertyFieldOptions")
	if c.Err != nil {
		return
	}

	options := decodePropertyFieldOptions(c, r, "createPropertyFieldOptions")
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreatePropertyFieldOptions, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", field)
	model.AddEventParameterAuditableArrayToAuditRec(auditRec, "options", options)

	if !requireOptionsPermission(c, rctx, field, "createPropertyFieldOptions") {
		return
	}

	created, appErr := c.App.CreatePropertyFieldOptions(rctx, field, options, r.Header.Get(model.ConnectionId))
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	model.AddEventParameterAuditableArrayToAuditRec(auditRec, "created_options", created)
	auditRec.AddEventObjectType("property_field_option")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchPropertyFieldOptions(c *Context, w http.ResponseWriter, r *http.Request) {
	field, rctx := propertyFieldForOptions(c, "patchPropertyFieldOptions")
	if c.Err != nil {
		return
	}

	options := decodePropertyFieldOptions(c, r, "patchPropertyFieldOptions")
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchPropertyFieldOptions, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", field)
	model.AddEventParameterAuditableArrayToAuditRec(auditRec, "options", options)

	if !requireOptionsPermission(c, rctx, field, "patchPropertyFieldOptions") {
		return
	}

	updated, prior, appErr := c.App.UpdatePropertyFieldOptions(rctx, field, options, r.Header.Get(model.ConnectionId))
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	// Both sides, because a parent link is deleted outright rather than marked:
	// without the prior state there is nothing left to say a link ever existed.
	model.AddEventParameterAuditableArrayToAuditRec(auditRec, "prior_options", prior)
	model.AddEventParameterAuditableArrayToAuditRec(auditRec, "updated_options", updated)
	auditRec.AddEventObjectType("property_field_option")

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePropertyFieldOptions(c *Context, w http.ResponseWriter, r *http.Request) {
	field, rctx := propertyFieldForOptions(c, "deletePropertyFieldOptions")
	if c.Err != nil {
		return
	}

	// The identifiers alone: there is nothing else to say about an option being
	// removed, and the whole list is judged together so that a branch of a
	// hierarchy can be taken out in one call.
	var optionIDs []string
	if err := json.NewDecoder(r.Body).Decode(&optionIDs); err != nil {
		c.SetInvalidParamWithErr("property_field_option_ids", err)
		return
	}
	if !checkPropertyFieldOptionCount(c, len(optionIDs), "deletePropertyFieldOptions") {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePropertyFieldOptions, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "property_field", field)
	model.AddEventParameterToAuditRec(auditRec, "option_ids", optionIDs)

	if !requireOptionsPermission(c, rctx, field, "deletePropertyFieldOptions") {
		return
	}

	deleted, appErr := c.App.DeletePropertyFieldOptions(rctx, field, optionIDs, r.Header.Get(model.ConnectionId))
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	// The options as they stood, names and parents included. They are the only
	// record of the links the deletion took with them.
	model.AddEventParameterAuditableArrayToAuditRec(auditRec, "deleted_options", deleted)
	auditRec.AddEventObjectType("property_field_option")

	ReturnStatusOK(w)
}
