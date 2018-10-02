// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/utils"

	"github.com/mattermost/mattermost-server/model"
)

const paramParentDN string = "parent_dn"

func (api *API) InitLdap() {
	api.BaseRoutes.LDAP.Handle("/sync", api.ApiSessionRequired(syncLdap)).Methods("POST")
	api.BaseRoutes.LDAP.Handle("/test", api.ApiSessionRequired(testLdap)).Methods("POST")

	// GET /api/v4/ldap/groups
	api.BaseRoutes.LDAP.Handle("/groups", api.ApiSessionRequired(getLdapGroups)).Methods("GET")

	// POST /api/v4/ldap/groups/:dn/link
	api.BaseRoutes.LDAP.Handle(
		"/groups/{dn:[A-Za-z0-9=,]+}/link",
		api.ApiSessionRequired(linkLdapGroup),
	).Methods("POST")

	// DELETE /api/v4/ldap/groups/:dn/link
	api.BaseRoutes.LDAP.Handle(
		"/groups/{dn:[A-Za-z0-9]+}/link",
		api.ApiSessionRequired(unlinkLdapGroup),
	).Methods("DELETE")
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
		c.Err = model.NewAppError(
			"Api4.getLdapGroups",
			"api.ldap.license.error",
			nil,
			"",
			http.StatusNotImplemented,
		)
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
		group, _ := c.App.GetGroupByRemoteID(scimGroup.PrimaryKey, model.GroupTypeLdap)
		if group != nil {
			scimGroup.MattermostGroupID = &group.Id
		}
	}

	if len(scimGroups) == 0 {
		scimGroups = make([]*model.SCIMGroup, 0)
	}

	b, marshalErr := json.Marshal(scimGroups)
	if marshalErr != nil {
		c.Err = model.NewAppError(
			"Api4.getLdapGroups",
			"api.ldap.marshal_error",
			nil,
			marshalErr.Error(),
			http.StatusNotImplemented,
		)
		return
	}

	w.Write(b)
}

func linkLdapGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireDN()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if c.App.License() == nil || !*c.App.License().Features.LDAP {
		c.Err = model.NewAppError(
			"Api4.linkLdapGroup",
			"api.ldap.license.error",
			nil,
			"",
			http.StatusNotImplemented,
		)
		return
	}

	ldapGroup, err := c.App.Ldap.GetGroup(c.Params.DN)
	if err != nil {
		c.Err = err
		return
	}

	group, err := c.App.GetGroupByRemoteID(ldapGroup.PrimaryKey, model.GroupTypeLdap)
	if err != nil && err.DetailedError != sql.ErrNoRows.Error() {
		c.Err = err
		return
	}

	fmt.Printf("ldapGroup: %#v\n", ldapGroup)

	// Group is already linked.
	if group != nil && group.DeleteAt == 0 {
		c.Err = model.NewAppError(
			"Api4.linkLdapGroup",
			"api.ldap.already_linked",
			nil,
			"",
			http.StatusNotImplemented,
		)
		return
	}

	var status int
	var newOrUpdatedGroup *model.Group

	if group == nil {
		newGroup := &model.Group{
			Name:        utils.Slugify(ldapGroup.Name),
			DisplayName: ldapGroup.Name,
			RemoteId:    ldapGroup.PrimaryKey,
			Type:        model.GroupTypeLdap,
		}
		newOrUpdatedGroup, err = c.App.CreateGroup(newGroup)
		if err != nil {
			c.Err = err
			return
		}
		status = http.StatusCreated
	}

	if group != nil && group.DeleteAt != 0 {
		group.DeleteAt = 0
		newOrUpdatedGroup, err = c.App.UpdateGroup(group)
		if err != nil {
			c.Err = err
			return
		}
		status = http.StatusOK
	}

	b, marshalErr := json.Marshal(newOrUpdatedGroup)
	if marshalErr != nil {
		c.Err = model.NewAppError(
			"Api4.linkLdapGroup",
			"api.ldap.marshal_error",
			nil,
			marshalErr.Error(),
			http.StatusNotImplemented,
		)
		return
	}

	w.WriteHeader(status)
	w.Write(b)
}

func unlinkLdapGroup(c *Context, w http.ResponseWriter, r *http.Request) {}
