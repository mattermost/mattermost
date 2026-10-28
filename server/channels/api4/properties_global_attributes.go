// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

// globalAttributesReadPermissions are the System Console permissions that open
// the System Attributes section, which holds the Global Attributes page: read
// access to any User Management resource. The page is read-only without write
// access, so these are all read permissions.
var globalAttributesReadPermissions = []*model.Permission{
	model.PermissionSysconsoleReadUserManagementUsers,
	model.PermissionSysconsoleReadUserManagementGroups,
	model.PermissionSysconsoleReadUserManagementTeams,
	model.PermissionSysconsoleReadUserManagementChannels,
	model.PermissionSysconsoleReadUserManagementPermissions,
	model.PermissionSysconsoleReadUserManagementSystemRoles,
}

// shapeListingFields gives every field in the listing, including a name
// conflict's field and template, the permissions shape the property field
// endpoints serve this caller for the group.
func shapeListingFields(c *Context, group *model.PropertyGroup, listing *model.GlobalAttributeListing) {
	var slots []**model.PropertyField
	for _, row := range listing.Rows {
		slots = append(slots, &row.Field)
		if row.NameConflict != nil {
			slots = append(slots, &row.NameConflict.Field)
			if row.NameConflict.OwnerTemplate != nil {
				slots = append(slots, &row.NameConflict.OwnerTemplate)
			}
		}
	}

	fields := make([]*model.PropertyField, len(slots))
	for i, slot := range slots {
		fields[i] = *slot
	}
	shaped := c.App.ShapePropertyFieldsForCaller(c.AppContext, *c.AppContext.Session(), fields, servesV3(c, group))
	for i, slot := range slots {
		*slot = shaped[i]
	}
}

// searchGlobalAttributeListing serves the System Console's Global Attributes
// listing: one page of rows already composed with their applies-to resources,
// owners, source and name conflict, filtered by search term, source and resource
// type.
func searchGlobalAttributeListing(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), globalAttributesReadPermissions) {
		c.SetPermissionError(globalAttributesReadPermissions...)
		return
	}

	var search model.GlobalAttributeListingSearch
	if err := json.NewDecoder(r.Body).Decode(&search); err != nil {
		c.SetInvalidParamWithErr("global_attribute_listing_search", err)
		return
	}
	search.SetDefaults()
	if err := search.IsValid(); err != nil {
		c.SetInvalidParamWithErr("global_attribute_listing_search", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventSearchGlobalAttributeListing, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "term", search.Term)
	model.AddEventParameterToAuditRec(auditRec, "source", search.Source)
	model.AddEventParameterToAuditRec(auditRec, "resource_type", search.ResourceType)
	model.AddEventParameterToAuditRec(auditRec, "page", search.Page)
	model.AddEventParameterToAuditRec(auditRec, "per_page", search.PerPage)

	rctx := app.RequestContextWithCallerID(c.AppContext, sessionCallerID(c))

	listing, appErr := c.App.SearchGlobalAttributeListing(rctx, search)
	if appErr != nil {
		c.Err = appErr
		return
	}

	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.AccessControlPropertyGroupName)
	if appErr != nil {
		c.Err = appErr
		return
	}
	shapeListingFields(c, group, listing)

	auditRec.Success()

	if err := json.NewEncoder(w).Encode(listing); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
