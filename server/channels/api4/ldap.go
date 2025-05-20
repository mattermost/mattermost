// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

type mixedUnlinkedGroup struct {
	ID           *string `json:"mattermost_group_id"`
	DisplayName  string  `json:"name"`
	RemoteID     string  `json:"primary_key"`
	HasSyncables *bool   `json:"has_syncables"`
}

func (api *API) InitLdap() {
	api.BaseRoutes.LDAP.Handle("/sync", api.APISessionRequired(syncLdap)).Methods(http.MethodPost)
	api.BaseRoutes.LDAP.Handle("/test", api.APISessionRequired(testLdap)).Methods(http.MethodPost)
	api.BaseRoutes.LDAP.Handle("/migrateid", api.APISessionRequired(migrateIDLdap)).Methods(http.MethodPost)

	// GET /api/v4/ldap/groups?page=0&per_page=1000
	api.BaseRoutes.LDAP.Handle("/groups", api.APISessionRequired(getLdapGroups)).Methods(http.MethodGet)

	// POST /api/v4/ldap/groups/:remote_id/link
	api.BaseRoutes.LDAP.Handle(`/groups/{remote_id}/link`, api.APISessionRequired(linkLdapGroup)).Methods(http.MethodPost)

	// DELETE /api/v4/ldap/groups/:remote_id/link
	api.BaseRoutes.LDAP.Handle(`/groups/{remote_id}/link`, api.APISessionRequired(unlinkLdapGroup)).Methods(http.MethodDelete)

	api.BaseRoutes.LDAP.Handle("/certificate/public", api.APISessionRequired(addLdapPublicCertificate, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.LDAP.Handle("/certificate/private", api.APISessionRequired(addLdapPrivateCertificate, handlerParamFileAPI)).Methods(http.MethodPost)

	api.BaseRoutes.LDAP.Handle("/certificate/public", api.APISessionRequired(removeLdapPublicCertificate)).Methods(http.MethodDelete)
	api.BaseRoutes.LDAP.Handle("/certificate/private", api.APISessionRequired(removeLdapPrivateCertificate)).Methods(http.MethodDelete)

	api.BaseRoutes.LDAP.Handle("/users/{user_id}/group_sync_memberships", api.APISessionRequired(addUserToGroupSyncables)).Methods(http.MethodPost)
}

func syncLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAP {
		c.Err = model.NewAppError("Api4.syncLdap", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateLdapSyncJob) {
		c.SetPermissionError(model.PermissionCreateLdapSyncJob)
		return
	}

	var opts struct {
		IncludeRemovedMembers *bool `json:"include_removed_members"`
	}
	err := json.NewDecoder(r.Body).Decode(&opts)
	if err != nil {
		c.Logger.LogM(mlog.MlvlLDAPInfo, "Error decoding LDAP sync options", mlog.Err(err))
	}

	auditRec := c.MakeAuditRecord("syncLdap", audit.Fail)
	defer c.LogAuditRec(auditRec)

	c.App.SyncLdap(c.AppContext, opts.IncludeRemovedMembers)

	auditRec.Success()
	ReturnStatusOK(w)
}

func testLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAP {
		c.Err = model.NewAppError("Api4.testLdap", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionTestLdap) {
		c.SetPermissionError(model.PermissionTestLdap)
		return
	}

	if err := c.App.TestLdap(c.AppContext); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getLdapGroups(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
		return
	}

	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getLdapGroups", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	opts := model.LdapGroupSearchOpts{
		Q: c.Params.Q,
	}
	if c.Params.IsLinked != nil {
		opts.IsLinked = c.Params.IsLinked
	}
	if c.Params.IsConfigured != nil {
		opts.IsConfigured = c.Params.IsConfigured
	}

	groups, total, appErr := c.App.GetAllLdapGroupsPage(c.AppContext, c.Params.Page, c.Params.PerPage, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	mugs := []*mixedUnlinkedGroup{}
	for _, group := range groups {
		mug := &mixedUnlinkedGroup{
			DisplayName: group.DisplayName,
			RemoteID:    group.GetRemoteId(),
		}
		if len(group.Id) == 26 {
			mug.ID = &group.Id
			mug.HasSyncables = &group.HasSyncables
		}
		mugs = append(mugs, mug)
	}

	b, err := json.Marshal(struct {
		Count  int                   `json:"count"`
		Groups []*mixedUnlinkedGroup `json:"groups"`
	}{Count: total, Groups: mugs})
	if err != nil {
		c.Err = model.NewAppError("Api4.getLdapGroups", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func linkLdapGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementGroups)
		return
	}

	auditRec := c.MakeAuditRecord("linkLdapGroup", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "remote_id", c.Params.RemoteId)

	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.linkLdapGroup", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	ldapGroup, appErr := c.App.GetLdapGroup(c.AppContext, c.Params.RemoteId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if ldapGroup == nil {
		c.Err = model.NewAppError("Api4.linkLdapGroup", "api.ldap_group.not_found", nil, "", http.StatusNotFound)
		return
	}

	group, appErr := c.App.GetGroupByRemoteID(ldapGroup.GetRemoteId(), model.GroupSourceLdap)
	if appErr != nil && appErr.Id != "app.group.no_rows" {
		c.Err = appErr
		return
	}
	if group != nil {
		audit.AddEventParameterAuditable(auditRec, "group", group)
	}

	var status int
	var newOrUpdatedGroup *model.Group

	// Truncate display name if necessary
	var displayName string
	if len(ldapGroup.DisplayName) > model.GroupDisplayNameMaxLength {
		displayName = ldapGroup.DisplayName[:model.GroupDisplayNameMaxLength]
	} else {
		displayName = ldapGroup.DisplayName
	}

	// Group has been previously linked
	if group != nil {
		if group.DeleteAt == 0 {
			newOrUpdatedGroup = group
		} else {
			group.DeleteAt = 0
			group.DisplayName = displayName
			group.RemoteId = ldapGroup.RemoteId
			newOrUpdatedGroup, appErr = c.App.UpdateGroup(group)
			if appErr != nil {
				c.Err = appErr
				return
			}
			auditRec.AddEventResultState(newOrUpdatedGroup)
			auditRec.AddEventObjectType("group")
		}
		status = http.StatusOK
	} else {
		// Group has never been linked
		//
		// For group mentions implementation, the Name column will no longer be set by default.
		// Instead it will be set and saved in the web app when Group Mentions is enabled.
		newGroup := &model.Group{
			DisplayName: displayName,
			RemoteId:    ldapGroup.RemoteId,
			Source:      model.GroupSourceLdap,
		}
		newOrUpdatedGroup, appErr = c.App.CreateGroup(newGroup)
		if appErr != nil {
			c.Err = appErr
			return
		}
		auditRec.AddEventResultState(newOrUpdatedGroup)
		auditRec.AddEventObjectType("group")
		status = http.StatusCreated
	}

	b, err := json.Marshal(newOrUpdatedGroup)
	if err != nil {
		c.Err = model.NewAppError("Api4.linkLdapGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()

	w.WriteHeader(status)
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func unlinkLdapGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("unlinkLdapGroup", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "remote_id", c.Params.RemoteId)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementGroups)
		return
	}

	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.unlinkLdapGroup", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	group, err := c.App.GetGroupByRemoteID(c.Params.RemoteId, model.GroupSourceLdap)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(group)
	auditRec.AddEventObjectType("group")

	if group.DeleteAt == 0 {
		deletedGroup, err := c.App.DeleteGroup(group.Id)
		if err != nil {
			c.Err = err
			return
		}
		auditRec.AddEventResultState(deletedGroup)
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func migrateIDLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJSON(r.Body)
	toAttribute, ok := props["toAttribute"].(string)
	if !ok || toAttribute == "" {
		c.SetInvalidParam("toAttribute")
		return
	}

	auditRec := c.MakeAuditRecord("idMigrateLdap", audit.Fail)
	audit.AddEventParameter(auditRec, "to_attribute", toAttribute)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAP {
		c.Err = model.NewAppError("Api4.idMigrateLdap", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if err := c.App.MigrateIdLDAP(c.AppContext, toAttribute); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func parseLdapCertificateRequest(r *http.Request, maxFileSize int64) (*multipart.FileHeader, *model.AppError) {
	err := r.ParseMultipartForm(maxFileSize)
	if err != nil {
		return nil, model.NewAppError("addLdapCertificate", "api.admin.add_certificate.parseform.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	m := r.MultipartForm

	fileArray, ok := m.File["certificate"]
	if !ok {
		return nil, model.NewAppError("addLdapCertificate", "api.admin.add_certificate.no_file.app_error", nil, "", http.StatusBadRequest)
	}

	if len(fileArray) <= 0 {
		return nil, model.NewAppError("addLdapCertificate", "api.admin.add_certificate.array.app_error", nil, "", http.StatusBadRequest)
	}

	return fileArray[0], nil
}

func addLdapPublicCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionAddLdapPublicCert) {
		c.SetPermissionError(model.PermissionAddLdapPublicCert)
		return
	}

	fileData, err := parseLdapCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("addLdapPublicCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "filename", fileData.Filename)

	if err := c.App.AddLdapPublicCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	ReturnStatusOK(w)
}

func addLdapPrivateCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionAddLdapPrivateCert) {
		c.SetPermissionError(model.PermissionAddLdapPrivateCert)
		return
	}

	fileData, err := parseLdapCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("addLdapPrivateCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "filename", fileData.Filename)

	if err := c.App.AddLdapPrivateCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	ReturnStatusOK(w)
}

func removeLdapPublicCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRemoveLdapPublicCert) {
		c.SetPermissionError(model.PermissionRemoveLdapPublicCert)
		return
	}

	auditRec := c.MakeAuditRecord("removeLdapPublicCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.RemoveLdapPublicCertificate(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeLdapPrivateCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRemoveLdapPrivateCert) {
		c.SetPermissionError(model.PermissionRemoveLdapPrivateCert)
		return
	}

	auditRec := c.MakeAuditRecord("removeLdapPrivateCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.RemoveLdapPrivateCertificate(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

// addUserToGroupSyncables creates memberships—for the given user—to all of their group syncables (i.e. channels or teams).
// For each group the user is a member of, for each channel and/or team that group is associated with, the user will be added.
func addUserToGroupSyncables(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementGroups)
		return
	}

	user, appErr := c.App.GetUser(c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if user.AuthService != model.UserAuthServiceLdap && (user.AuthService != model.UserAuthServiceSaml || !*c.App.Config().SamlSettings.EnableSyncWithLdap) {
		c.Err = model.NewAppError("addUserToGroupSyncables", "api.user.add_user_to_group_syncables.not_ldap_user.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("addUserToGroupSyncables", audit.Fail)
	defer c.LogAuditRec(auditRec)

	params := model.CreateDefaultMembershipParams{Since: 0, ReAddRemovedMembers: true, ScopedUserID: &user.Id}
	err := c.App.CreateDefaultMemberships(c.AppContext, params)
	if err != nil {
		c.Err = model.NewAppError("addUserToGroupSyncables", "api.admin.syncables_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
