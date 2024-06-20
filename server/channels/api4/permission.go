// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

func (api *API) InitPermissions() {
	// to be deprecated
	api.BaseRoutes.Permissions.Handle("/ancillary", api.APISessionRequired(appendAncillaryPermissions)).Methods("GET")
	api.BaseRoutes.Permissions.Handle("/ancillary", api.APISessionRequired(appendAncillaryPermissionsPost)).Methods("POST")
}

func appendAncillaryPermissions(c *Context, w http.ResponseWriter, r *http.Request) {
	keys, ok := r.URL.Query()["subsection_permissions"]

	if !ok || len(keys[0]) < 1 {
		c.SetInvalidURLParam("subsection_permissions")
		return
	}

	permissions := strings.Split(keys[0], ",")
	b, err := json.Marshal(model.AddAncillaryPermissions(permissions))
	if err != nil {
		c.SetJSONEncodingError(err)
		return
	}

	w.Write(b)
}

func appendAncillaryPermissionsPost(c *Context, w http.ResponseWriter, r *http.Request) {
	bodyMap := model.MapFromJSON(r.Body)
	keys, ok := bodyMap["subsection_permissions"]
	if !ok || len(keys) < 1 {
		c.SetInvalidURLParam("subsection_permissions")
		return
	}

	permissions := strings.Split(keys, ",")
	b, err := json.Marshal(model.AddAncillaryPermissions(permissions))
	if err != nil {
		c.SetJSONEncodingError(err)
		return
	}

	w.Write(b)
}
