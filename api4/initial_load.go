// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitInitialLoad() {
	api.BaseRoutes.InitialLoad.Handle("/", api.APIHandlerTrustRequester(initialLoad)).Methods("GET")
}

func initialLoad(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := c.AppContext.Session().UserId

	var config map[string]string

	// Not logged in initial Load
	if userID == "" {
		config = c.App.LimitedClientConfigWithComputed()
		dataBytes, jsonErr := json.Marshal(model.InitialLoad{Config: config})
		if jsonErr != nil {
			c.Err = model.NewAppError("initialLoad", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
			return
		}

		w.Write(dataBytes)
		return
	}

	config = c.App.ClientConfigWithComputed()

	var license map[string]string

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadLicenseInformation) {
		license = c.App.Srv().ClientLicense()
	} else {
		license = c.App.Srv().GetSanitizedClientLicense()
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	initialLoadData, err := c.App.GetInitialLoadData(config, license, c.IsSystemAdmin(), restrictions, userID)
	if err != nil {
		c.Err = err
		return
	}

	dataBytes, jsonErr := json.Marshal(initialLoadData)
	if jsonErr != nil {
		c.Err = model.NewAppError("initialLoad", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(dataBytes)
}
