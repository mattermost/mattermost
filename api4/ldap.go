// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

type mixedUnlinkedGroup struct {
	Id           *string `json:"mattermost_group_id"`
	DisplayName  string  `json:"name"`
	RemoteId     string  `json:"primary_key"`
	HasSyncables *bool   `json:"has_syncables"`
}

func (api *API) InitLdap() {
	api.BaseRoutes.LDAP.Handle("/sync", api.ApiSessionRequired(syncLdap)).Methods("POST")
	api.BaseRoutes.LDAP.Handle("/test", api.ApiSessionRequired(testLdap)).Methods("POST")

	// GET /api/v4/ldap/groups?page=0&per_page=1000
	api.BaseRoutes.LDAP.Handle("/groups", api.ApiSessionRequired(getLdapGroups)).Methods("GET")

	// POST /api/v4/ldap/groups/:remote_id/link
	api.BaseRoutes.LDAP.Handle(`/groups/{remote_id}/link`, api.ApiSessionRequired(linkLdapGroup)).Methods("POST")

	// DELETE /api/v4/ldap/groups/:remote_id/link
	api.BaseRoutes.LDAP.Handle(`/groups/{remote_id}/link`, api.ApiSessionRequired(unlinkLdapGroup)).Methods("DELETE")
}

func syncLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.License() == nil || !*c.App.License().Features.LDAP {
		c.Err = model.NewAppError("Api4.syncLdap", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	c.App.SyncLdap()

	ReturnStatusOK(w)
}

func testLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.License() == nil || !*c.App.License().Features.LDAP {
		c.Err = model.NewAppError("Api4.testLdap", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.TestLdap(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getLdapGroups(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if c.App.License() == nil || !*c.App.License().Features.LDAPGroups {
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

	groups, total, err := c.App.GetAllLdapGroupsPage(c.Params.Page, c.Params.PerPage, opts)
	if err != nil {
		c.Err = err
		return
	}

	mugs := []*mixedUnlinkedGroup{}
	for _, group := range groups {
		mug := &mixedUnlinkedGroup{
			DisplayName: group.DisplayName,
			RemoteId:    group.RemoteId,
		}
		if len(group.Id) == 26 {
			mug.Id = &group.Id
			mug.HasSyncables = &group.HasSyncables
		}
		mugs = append(mugs, mug)
	}

	b, marshalErr := json.Marshal(struct {
		Count  int                   `json:"count"`
		Groups []*mixedUnlinkedGroup `json:"groups"`
	}{Count: total, Groups: mugs})
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getLdapGroups", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func linkLdapGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if c.App.License() == nil || !*c.App.License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.linkLdapGroup", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	ldapGroup, err := c.App.GetLdapGroup(c.Params.RemoteId)
	if err != nil {
		c.Err = err
		return
	}

	if ldapGroup == nil {
		c.Err = model.NewAppError("Api4.linkLdapGroup", "api.ldap_group.not_found", nil, "", http.StatusNotFound)
		return
	}

	group, err := c.App.GetGroupByRemoteID(ldapGroup.RemoteId, model.GroupSourceLdap)
	if err != nil && err.DetailedError != sql.ErrNoRows.Error() {
		c.Err = err
		return
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
			newOrUpdatedGroup, err = c.App.UpdateGroup(group)
			if err != nil {
				c.Err = err
				return
			}
		}
		status = http.StatusOK
	} else {
		// Group has never been linked
		//
		// TODO: In a future phase of LDAP groups sync `Name` will be used for at-mentions and will be editable on
		// the front-end so it will not have an initial value of `model.NewId()` but rather a slugified version of
		// the LDAP group name with an appended duplicate-breaker.
		newGroup := &model.Group{
			Name:        model.NewId(),
			DisplayName: displayName,
			RemoteId:    ldapGroup.RemoteId,
			Source:      model.GroupSourceLdap,
		}
		newOrUpdatedGroup, err = c.App.CreateGroup(newGroup)
		if err != nil {
			c.Err = err
			return
		}
		status = http.StatusCreated
	}

	b, marshalErr := json.Marshal(newOrUpdatedGroup)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.linkLdapGroup", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(status)
	w.Write(b)
}

func unlinkLdapGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if c.App.License() == nil || !*c.App.License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.unlinkLdapGroup", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	group, err := c.App.GetGroupByRemoteID(c.Params.RemoteId, model.GroupSourceLdap)
	if err != nil {
		c.Err = err
		return
	}

	if group.DeleteAt == 0 {
		_, err = c.App.DeleteGroup(group.Id)
		if err != nil {
			c.Err = err
			return
		}
	}

	ReturnStatusOK(w)
}
