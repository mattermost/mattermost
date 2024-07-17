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
	// to be deprecated - kept for backward compatibility
	api.BaseRoutes.Permissions.Handle("/ancillary", api.APISessionRequired(appendAncillaryPermissions)).Methods(http.MethodGet)
	api.BaseRoutes.Permissions.Handle("/ancillary", api.APISessionRequired(appendAncillaryPermissionsPost)).Methods(http.MethodPost)
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
	permissions, err := model.NonSortedArrayFromJSON(r.Body)
	if err != nil || len(permissions) < 1 {
		c.Err = model.NewAppError("appendAncillaryPermissionsPost", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	b, err := json.Marshal(model.AddAncillaryPermissions(permissions))
	if err != nil {
		c.SetJSONEncodingError(err)
		return
	}
	w.Write(b)
}
