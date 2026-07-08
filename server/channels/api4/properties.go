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
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

const maxPropertyValuePatchItems = 50

func (api *API) InitProperties() {
	if api.srv.Config().FeatureFlags.IntegratedBoards ||
		api.srv.Config().FeatureFlags.ManagedChannelCategories ||
		api.srv.Config().FeatureFlags.ClassificationMarkings ||
		api.srv.Config().FeatureFlags.SessionAttributes {
		api.BaseRoutes.PropertyFields.Handle("", api.APISessionRequired(getPropertyFields)).Methods(http.MethodGet)
		api.BaseRoutes.PropertyFieldsSearch.Handle("", api.APISessionRequired(searchPropertyFields)).Methods(http.MethodPost)
		api.BaseRoutes.PropertyValues.Handle("", api.APISessionRequired(getPropertyValues)).Methods(http.MethodGet)
		api.BaseRoutes.PropertySystemValues.Handle("", api.APISessionRequired(getSystemPropertyValues)).Methods(http.MethodGet)

		api.BaseRoutes.PropertyFields.Handle("", api.APISessionRequired(createPropertyField)).Methods(http.MethodPost)
		api.BaseRoutes.PropertyField.Handle("", api.APISessionRequired(patchPropertyField)).Methods(http.MethodPatch)
		api.BaseRoutes.PropertyField.Handle("", api.APISessionRequired(deletePropertyField)).Methods(http.MethodDelete)

		api.BaseRoutes.PropertyValues.Handle("", api.APISessionRequired(patchPropertyValues)).Methods(http.MethodPatch)
		api.BaseRoutes.PropertySystemValues.Handle("", api.APISessionRequired(patchSystemPropertyValues)).Methods(http.MethodPatch)
	}
}

// getV2Group resolves c.Params.GroupName to a PSAv2 property group.
// On any error (not found, or not a v2 group) it sets c.Err and returns nil.
func getV2Group(c *Context, callerName string) *model.PropertyGroup {
	group, appErr := c.App.GetPropertyGroup(c.AppContext, c.Params.GroupName)
	if appErr != nil {
		c.Err = appErr
		return nil
	}
	if !group.IsPSAv2() {
		c.Err = model.NewAppError(callerName, "api.property.v2_group_not_found.app_error", nil, "", http.StatusNotFound)
		return nil
	}
	// Session attribute schema management requires Enterprise Advanced.
	if group.Name == model.SessionAttributesPropertyGroupName && !model.MinimumEnterpriseAdvancedLicense(c.App.License()) {
		c.Err = model.NewAppError(callerName, "api.property.session_attributes.license.app_error", nil, "", http.StatusNotImplemented)
		return nil
	}
	return group
}

func createPropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType()
	if c.Err != nil {
		return
	}

	group := getV2Group(c, "createPropertyField")
	if c.Err != nil {
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

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	if field.Protected {
		c.Err = model.NewAppError("createPropertyField", "api.property_field.create.protected_via_api.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Pre-canonicalize system objects so the scope check below cannot be
	// bypassed by submitting ObjectType=system with TargetType=channel. The
	// App layer re-canonicalizes defensively for plugin/internal callers.
	app.CanonicalizeSystemObjectField(field)

	// Templates are always sysadmin-only, regardless of TargetType.
	if field.ObjectType == model.PropertyFieldObjectTypeTemplate &&
		!c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	// Scope-based create permission.
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

	// Default permission levels: pin all three for non-admins, nil-fill for
	// admins. Stays in API because it is session-bound.
	isAdmin := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	defaultLevel := app.DefaultPropertyFieldPermissionLevel(field)
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

	createdField, appErr := c.App.CreatePropertyField(rctx, field, false, connectionID)
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

func getPropertyFields(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType()
	if c.Err != nil {
		return
	}

	group := getV2Group(c, "getPropertyFields")
	if c.Err != nil {
		return
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID:     group.ID,
		ObjectTypes: []string{c.Params.ObjectType},
		PerPage:     c.Params.PerPage,
	}

	query := r.URL.Query()

	if s := query.Get("since"); s != "" {
		since, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("since", err)
			return
		}
		opts.SinceUpdateAt = since
	}

	// Cursor: directory mode uses CreateAt, delta mode (since>0) uses
	// UpdateAt.
	if cursorID := query.Get("cursor_id"); cursorID != "" {
		cur := model.PropertyFieldSearchCursor{PropertyFieldID: cursorID}
		if v := query.Get("cursor_update_at"); v != "" {
			ua, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				c.SetInvalidParamWithErr("cursor_update_at", err)
				return
			}
			cur.UpdateAt = ua
		}
		if v := query.Get("cursor_create_at"); v != "" {
			ca, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				c.SetInvalidParamWithErr("cursor_create_at", err)
				return
			}
			cur.CreateAt = ca
		}
		if err := cur.IsValid(); err != nil {
			c.SetInvalidParamWithErr("cursor", err)
			return
		}
		opts.Cursor = cur
	}

	opts.ChannelID = query.Get("channel_id")
	opts.TeamID = query.Get("team_id")
	opts.TargetType = query.Get("target_type")
	if t := query.Get("target_id"); t != "" {
		opts.TargetIDs = []string{t}
	}

	searchPropertyFieldsCore(c, w, group, opts, "getPropertyFields")
}

func searchPropertyFields(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName()
	if c.Err != nil {
		return
	}

	group := getV2Group(c, "searchPropertyFields")
	if c.Err != nil {
		return
	}

	var search model.PropertyFieldSearch
	if err := json.NewDecoder(r.Body).Decode(&search); err != nil {
		c.SetInvalidParamWithErr("property_field_search", err)
		return
	}

	if len(search.ObjectTypes) == 0 {
		c.SetInvalidParam("object_types")
		return
	}
	for _, ot := range search.ObjectTypes {
		if !model.IsValidPropertyFieldObjectType(ot) {
			c.SetInvalidParam("object_types")
			return
		}
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID:       group.ID,
		ObjectTypes:   search.ObjectTypes,
		ChannelID:     search.ChannelID,
		TeamID:        search.TeamID,
		TargetType:    search.TargetType,
		SinceUpdateAt: search.SinceUpdateAt,
		PerPage:       search.PerPage,
	}
	if search.TargetID != "" {
		opts.TargetIDs = []string{search.TargetID}
	}
	if search.CursorID != "" {
		opts.Cursor = model.PropertyFieldSearchCursor{
			PropertyFieldID: search.CursorID,
			CreateAt:        search.CursorCreateAt,
			UpdateAt:        search.CursorUpdateAt,
		}
	}
	if opts.PerPage <= 0 {
		opts.PerPage = web.PerPageDefault
	} else if opts.PerPage > web.PerPageMaximum {
		opts.PerPage = web.PerPageMaximum
	}

	searchPropertyFieldsCore(c, w, group, opts, "searchPropertyFields")
}

// searchPropertyFieldsCore is the shared pipeline both list-style endpoints
// share once opts has been populated from query string or request body:
// scope resolution + permission checks, opts validation, audit, search,
// response encoding.
func searchPropertyFieldsCore(c *Context, w http.ResponseWriter, group *model.PropertyGroup, opts model.PropertyFieldSearchOpts, callerName string) {
	auditRec := c.MakeAuditRecord(model.AuditEventGetPropertyFields, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_name", c.Params.GroupName)
	model.AddEventParameterToAuditRec(auditRec, "object_types", opts.ObjectTypes)
	model.AddEventParameterToAuditRec(auditRec, "since", opts.SinceUpdateAt)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", opts.ChannelID)
	model.AddEventParameterToAuditRec(auditRec, "team_id", opts.TeamID)

	// System-object fields can only live at the system scope by
	// invariant (enforced at create time). When the caller asks
	// exclusively for system-object fields, any channel/team/target
	// filter is a semantic no-op — we collapse to target_type=system
	// regardless of what was passed so legacy callers don't get a
	// confusing scope_conflict on otherwise valid requests. The
	// shortcut only applies when object_types is exactly [system]:
	// mixing with other types would silently drop the non-system rows.
	if len(opts.ObjectTypes) == 1 && opts.ObjectTypes[0] == model.PropertyFieldObjectTypeSystem {
		opts.ChannelID = ""
		opts.TeamID = ""
		opts.TargetIDs = nil
		opts.TargetType = string(model.PropertyFieldTargetLevelSystem)
	}

	if !resolveScopeAndCheckPermissions(c, &opts, callerName) {
		return
	}

	if err := opts.IsValid(); err != nil {
		c.Err = model.NewAppError(callerName, "api.property_field.get.invalid_opts.app_error", nil, err.Error(), http.StatusBadRequest)
		return
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

// resolveScopeAndCheckPermissions enforces the two scope modes (hierarchical
// vs single-target) and runs the per-scope permission checks. It operates on
// already-populated opts.
func resolveScopeAndCheckPermissions(c *Context, opts *model.PropertyFieldSearchOpts, callerName string) bool {
	scopeByChanTeam := opts.ChannelID != "" || opts.TeamID != ""
	scopeByTarget := opts.TargetType != "" || len(opts.TargetIDs) > 0
	if scopeByChanTeam && scopeByTarget {
		c.Err = model.NewAppError(callerName, "api.property_field.get.scope_conflict.app_error", nil, "", http.StatusBadRequest)
		return false
	}

	switch {
	case opts.ChannelID != "":
		hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), opts.ChannelID, model.PermissionReadChannel)
		if !hasPermission {
			c.SetPermissionError(model.PermissionReadChannel)
			return false
		}
		channel, appErr := c.App.GetChannel(c.AppContext, opts.ChannelID)
		if appErr != nil {
			c.Err = appErr
			return false
		}
		opts.ChannelID = channel.Id
		opts.TeamID = channel.TeamId
	case opts.TeamID != "":
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), opts.TeamID, model.PermissionViewTeam) {
			c.SetPermissionError(model.PermissionViewTeam)
			return false
		}
	case opts.TargetType != "":
		if !model.IsValidPSAv2PropertyFieldTargetType(opts.TargetType) {
			c.Err = model.NewAppError(callerName, "api.property_field.get.invalid_target_type.app_error", nil, "", http.StatusBadRequest)
			return false
		}
		switch model.PropertyFieldTargetLevel(opts.TargetType) {
		case model.PropertyFieldTargetLevelChannel:
			if len(opts.TargetIDs) == 0 {
				c.Err = model.NewAppError(callerName, "api.property_field.get.target_id_required.app_error", nil, "", http.StatusBadRequest)
				return false
			}
			hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), opts.TargetIDs[0], model.PermissionReadChannel)
			if !hasPermission {
				c.SetPermissionError(model.PermissionReadChannel)
				return false
			}
		case model.PropertyFieldTargetLevelTeam:
			if len(opts.TargetIDs) == 0 {
				c.Err = model.NewAppError(callerName, "api.property_field.get.target_id_required.app_error", nil, "", http.StatusBadRequest)
				return false
			}
			if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), opts.TargetIDs[0], model.PermissionViewTeam) {
				c.SetPermissionError(model.PermissionViewTeam)
				return false
			}
		case model.PropertyFieldTargetLevelSystem:
			// System-level fields are visible to all authenticated users.
		}
	case len(opts.TargetIDs) > 0:
		// target_id without target_type is malformed.
		c.Err = model.NewAppError(callerName, "api.property_field.get.target_type_required.app_error", nil, "", http.StatusBadRequest)
		return false
	default:
		c.Err = model.NewAppError(callerName, "api.property_field.get.scope_required.app_error", nil, "", http.StatusBadRequest)
		return false
	}
	return true
}

func patchPropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName().RequireObjectType().RequireFieldId()
	if c.Err != nil {
		return
	}

	group := getV2Group(c, "patchPropertyField")
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

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	existingField, appErr := c.App.GetPropertyField(rctx, group.ID, c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// PSAv2 routes only operate on PSAv2 fields. Reject legacy fields.
	if existingField.IsPSAv1() {
		c.Err = model.NewAppError("patchPropertyField", "api.property_field.patch.legacy_field.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// HTTP-routing: a 404 indistinguishable from "no such field" lets us
	// bucket fields by URL ObjectType without leaking cross-bucket existence.
	if existingField.ObjectType != c.Params.ObjectType {
		c.Err = model.NewAppError("patchPropertyField", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
		return
	}

	// Permission branching (session-bound): options-only patches use a
	// narrower permission than full edits.
	isOptionsOnly := isOptionsOnlyPatch(patch)
	if isOptionsOnly && !existingField.Type.SupportsOptions() {
		isOptionsOnly = false
	}
	if isOptionsOnly {
		if !c.App.SessionHasPermissionToManagePropertyFieldOptions(rctx, *c.AppContext.Session(), existingField) {
			c.Err = model.NewAppError("patchPropertyField", "api.property_field.update.no_options_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToEditPropertyField(rctx, *c.AppContext.Session(), existingField) {
			c.Err = model.NewAppError("patchPropertyField", "api.property_field.update.no_field_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	// Capture original state for audit before the in-place patch. Attrs is
	// shallow-copied because Patch mutates it.
	orig := *existingField
	if existingField.Attrs != nil {
		orig.Attrs = make(model.StringInterface, len(existingField.Attrs))
		maps.Copy(orig.Attrs, existingField.Attrs)
	}
	auditRec.AddEventPriorState(&orig)

	existingField.Patch(patch, true)
	existingField.UpdatedBy = c.AppContext.Session().UserId
	connectionID := r.Header.Get(model.ConnectionId)

	updatedField, _, updateErr := c.App.UpdatePropertyField(rctx, group.ID, existingField, false, connectionID)
	if updateErr != nil {
		c.Err = updateErr
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

	group := getV2Group(c, "deletePropertyField")
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeletePropertyField, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "field_id", c.Params.FieldId)

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	existingField, appErr := c.App.GetPropertyField(rctx, group.ID, c.Params.FieldId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if existingField.ObjectType != c.Params.ObjectType {
		c.Err = model.NewAppError("deletePropertyField", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
		return
	}

	if !c.App.SessionHasPermissionToEditPropertyField(rctx, *c.AppContext.Session(), existingField) {
		c.Err = model.NewAppError("deletePropertyField", "api.property_field.delete.no_permission.app_error", nil, "", http.StatusForbidden)
		return
	}

	auditRec.AddEventPriorState(existingField)

	connectionID := r.Header.Get(model.ConnectionId)
	if deleteErr := c.App.DeletePropertyField(rctx, group.ID, c.Params.FieldId, false, connectionID); deleteErr != nil {
		c.Err = deleteErr
		return
	}

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

	if c.Params.ObjectType == model.PropertyFieldObjectTypeSystem {
		c.Err = model.NewAppError("getPropertyValues", "api.property_value.system_use_dedicated_route.app_error", nil, "system values must use the dedicated system values endpoint", http.StatusBadRequest)
		return
	}

	c.RequireTargetId()
	if c.Err != nil {
		return
	}

	getPropertyValuesCore(c, w, r, c.Params.ObjectType, c.Params.TargetId)
}

func getSystemPropertyValues(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName()
	if c.Err != nil {
		return
	}

	getPropertyValuesCore(c, w, r, model.PropertyFieldObjectTypeSystem, model.PropertyValueSystemTargetID)
}

func getPropertyValuesCore(c *Context, w http.ResponseWriter, r *http.Request, objectType, targetID string) {
	group := getV2Group(c, "getPropertyValues")
	if c.Err != nil {
		return
	}

	// Check target access based on object type
	if !hasTargetAccess(c, objectType, targetID, false) {
		return
	}

	query := r.URL.Query()

	opts := model.PropertyValueSearchOpts{
		TargetIDs:  []string{targetID},
		TargetType: objectType,
		PerPage:    c.Params.PerPage,
	}

	if s := query.Get("since"); s != "" {
		since, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("since", err)
			return
		}
		opts.SinceUpdateAt = since
	}

	// Cursor: directory mode uses CreateAt, delta mode (since>0) uses
	// UpdateAt. opts.IsValid below rejects the mismatched combinations.
	if cursorID := query.Get("cursor_id"); cursorID != "" {
		cur := model.PropertyValueSearchCursor{PropertyValueID: cursorID}
		if v := query.Get("cursor_update_at"); v != "" {
			ua, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				c.SetInvalidParamWithErr("cursor_update_at", err)
				return
			}
			cur.UpdateAt = ua
		}
		if v := query.Get("cursor_create_at"); v != "" {
			ca, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				c.SetInvalidParamWithErr("cursor_create_at", err)
				return
			}
			cur.CreateAt = ca
		}
		opts.Cursor = cur
	}

	if err := opts.IsValid(); err != nil {
		c.Err = model.NewAppError("getPropertyValues", "api.property_value.get.invalid_opts.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPropertyValues, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "group_name", c.Params.GroupName)
	model.AddEventParameterToAuditRec(auditRec, "object_type", objectType)
	model.AddEventParameterToAuditRec(auditRec, "target_id", targetID)
	model.AddEventParameterToAuditRec(auditRec, "since", opts.SinceUpdateAt)

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

	if c.Params.ObjectType == model.PropertyFieldObjectTypeSystem {
		c.Err = model.NewAppError("patchPropertyValues", "api.property_value.system_use_dedicated_route.app_error", nil, "system values must use the dedicated system values endpoint", http.StatusBadRequest)
		return
	}

	c.RequireTargetId()
	if c.Err != nil {
		return
	}

	patchPropertyValuesCore(c, w, r, c.Params.ObjectType, c.Params.TargetId)
}

func patchSystemPropertyValues(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupName()
	if c.Err != nil {
		return
	}

	patchPropertyValuesCore(c, w, r, model.PropertyFieldObjectTypeSystem, model.PropertyValueSystemTargetID)
}

func patchPropertyValuesCore(c *Context, w http.ResponseWriter, r *http.Request, objectType, targetID string) {
	group := getV2Group(c, "patchPropertyValues")
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
	model.AddEventParameterToAuditRec(auditRec, "object_type", objectType)
	model.AddEventParameterToAuditRec(auditRec, "target_id", targetID)

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	if !hasTargetAccess(c, objectType, targetID, true) {
		return
	}

	if len(items) == 0 {
		c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.empty_body.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if len(items) > maxPropertyValuePatchItems {
		c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.too_many_items.request_error", map[string]any{
			"Max": maxPropertyValuePatchItems,
		}, "", http.StatusBadRequest)
		return
	}

	// Pre-validate IDs and de-dup so we can bulk-load fields for the
	// session-bound permission check below. The App layer re-validates these
	// invariants (defense for plugin/internal callers).
	seen := map[string]bool{}
	fieldIDs := make([]string, 0, len(items))
	for _, item := range items {
		if !model.IsValidId(item.FieldID) {
			c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.invalid_field_id.app_error", nil, "", http.StatusBadRequest)
			return
		}
		if seen[item.FieldID] {
			c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.duplicate_field_id.app_error", nil, "", http.StatusBadRequest)
			return
		}
		seen[item.FieldID] = true
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
			c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.field_not_found.app_error",
				map[string]any{"FieldID": item.FieldID}, "", http.StatusNotFound)
			return
		}
		if f.ObjectType != objectType {
			c.Err = model.NewAppError("patchPropertyValues", "api.property_field.object_type_mismatch.app_error", nil, "", http.StatusNotFound)
			return
		}
		if !c.App.SessionHasPermissionToSetPropertyFieldValues(rctx, *c.AppContext.Session(), f, targetID) {
			c.Err = model.NewAppError("patchPropertyValues", "api.property_value.patch.no_values_permission.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	userID := c.AppContext.Session().UserId
	values := make([]*model.PropertyValue, len(items))
	for i, item := range items {
		values[i] = &model.PropertyValue{
			TargetID:   targetID,
			TargetType: objectType,
			GroupID:    group.ID,
			FieldID:    item.FieldID,
			Value:      item.Value,
			Attrs:      item.Attrs,
			CreatedBy:  userID,
			UpdatedBy:  userID,
		}
	}
	connectionID := r.Header.Get(model.ConnectionId)

	upserted, upsertErr := c.App.UpsertPropertyValues(rctx, values, objectType, targetID, connectionID)
	if upsertErr != nil {
		c.Err = upsertErr
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
	case model.PropertyFieldObjectTypeSystem:
		// Any authenticated user can read system-scoped property values.
		// Only a system administrator can write them.
		if write && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
			c.SetPermissionError(model.PermissionManageSystem)
			return false
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
