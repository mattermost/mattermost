// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitBleve() {
	api.BaseRoutes.Bleve.Handle("/purge_indexes", api.ApiSessionRequired(purgeBleveIndexes)).Methods("POST")
}

func purgeBleveIndexes(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("purgeBleveIndexes", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.PurgeBleveIndexes(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
