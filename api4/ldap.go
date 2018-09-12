// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitLdap() {
	api.BaseRoutes.LDAP.Handle("/sync", api.ApiSessionRequired(syncLdap)).Methods("POST")
	api.BaseRoutes.LDAP.Handle("/test", api.ApiSessionRequired(testLdap)).Methods("POST")

	// GET /api/v4/ldap/groups
	api.BaseRoutes.LDAP.Handle("/groups", api.ApiSessionRequired(getGroups)).Methods("GET")

	// POST /api/v4/ldap/groups/:dn/link
	api.BaseRoutes.LDAP.Handle("/groups/{dn:[A-Za-z0-9]+}/link", api.ApiSessionRequired(linkGroup)).Methods("POST")

	// DELETE /api/v4/ldap/groups/:dn/link
	api.BaseRoutes.LDAP.Handle("/groups/{dn:[A-Za-z0-9]+}/link", api.ApiSessionRequired(unlinkGroup)).Methods("DELETE")
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

func getGroups(c *Context, w http.ResponseWriter, r *http.Request)   {}
func linkGroup(c *Context, w http.ResponseWriter, r *http.Request)   {}
func unlinkGroup(c *Context, w http.ResponseWriter, r *http.Request) {}
