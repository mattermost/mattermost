// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

const paramParentDN string = "parent_dn"

func (api *API) InitLdap() {
	api.BaseRoutes.LDAP.Handle("/sync", api.ApiSessionRequired(syncLdap)).Methods("POST")
	api.BaseRoutes.LDAP.Handle("/test", api.ApiSessionRequired(testLdap)).Methods("POST")

	// GET /api/v4/ldap/groups
	api.BaseRoutes.LDAP.Handle("/groups", api.ApiSessionRequired(getLdapGroups)).Methods("GET")

	// POST /api/v4/ldap/groups/:dn/link
	api.BaseRoutes.LDAP.Handle("/groups/{dn:[A-Za-z0-9]+}/link", api.ApiSessionRequired(linkLdapGroup)).Methods("POST")

	// DELETE /api/v4/ldap/groups/:dn/link
	api.BaseRoutes.LDAP.Handle("/groups/{dn:[A-Za-z0-9]+}/link", api.ApiSessionRequired(unlinkLdapGroup)).Methods("DELETE")
}

func syncLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	c.App.SyncLdap()

	ReturnStatusOK(w)
}

func testLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if c.App.License() == nil || !*c.App.License().Features.LDAP {
		c.Err = model.NewAppError("Api4.getLdapGroups", "api.ldap.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	parentDN := r.URL.Query().Get(paramParentDN)
	if parentDN == "" {
		c.SetInvalidParam(paramParentDN)
		return
	}

	scimGroups, err := c.App.Ldap.GetChildGroups(parentDN)
	if err != nil {
		c.Err = err
		return
	}

	for _, scimGroup := range scimGroups {
		group, _ := c.App.GetGroupByRemoteID(scimGroup.PrimaryKey)
		if group != nil {
			scimGroup.MattermostGroupID = &group.Id
		}
	}

	b, marshalErr := json.Marshal(scimGroups)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getLdapGroups", "api.ldap.marshal_error", nil, marshalErr.Error(), http.StatusNotImplemented)
		return
	}

	w.Write(b)
}

func linkLdapGroup(c *Context, w http.ResponseWriter, r *http.Request)   {}
func unlinkLdapGroup(c *Context, w http.ResponseWriter, r *http.Request) {}
